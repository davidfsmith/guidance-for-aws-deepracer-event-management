# DREM Export/Import Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python CLI tool pair that can fully export and import a DREM instance — events, races, leaderboard, fleets, landing page configs, and Cognito users with group memberships.

**Architecture:** Two entry-point scripts (`drem_export.py`, `drem_import.py`) share a library package (`scripts/drem_data/`) containing table discovery, DynamoDB helpers, Cognito helpers, and manifest management. Table names are discovered from CloudFormation stack resources. Cognito user import remaps `userId` (sub) across all DynamoDB records.

**Tech Stack:** Python 3.12, boto3, argparse. No external dependencies beyond what's in the project venv.

**Design spec:** `docs/superpowers/specs/2026-04-06-export-import-design.md`

---

## File Structure

### New files to create

| File | Responsibility |
|------|---------------|
| `scripts/drem_data/__init__.py` | Package marker |
| `scripts/drem_data/discovery.py` | Read `build.config` + `cfn.outputs`, discover DynamoDB table names via CloudFormation `list_stack_resources` |
| `scripts/drem_data/tables.py` | DynamoDB scan/write helpers — paginated scan, batch write, Decimal conversion, dry-run support |
| `scripts/drem_data/cognito.py` | Cognito user export (list + groups) and import (create + group assign + sub mapping) |
| `scripts/drem_data/manifest.py` | Manifest read/write |
| `scripts/drem_export.py` | Export CLI entry point |
| `scripts/drem_import.py` | Import CLI entry point |
| `scripts/drem_data/test_tables.py` | Unit tests for Decimal conversion and userId remapping |
| `scripts/drem_data/test_discovery.py` | Unit tests for build.config and cfn.outputs parsing |

---

## Task 1: Discovery Module

Read `build.config` and `cfn.outputs` to find the stack label, region, userPoolId. Query CloudFormation to map logical resource IDs to physical DynamoDB table names.

**Files:**
- Create: `scripts/drem_data/__init__.py`
- Create: `scripts/drem_data/discovery.py`
- Create: `scripts/drem_data/test_discovery.py`

- [ ] **Step 1: Create the package**

```python
# scripts/drem_data/__init__.py
```

(Empty file — package marker only.)

- [ ] **Step 2: Write tests for config parsing**

```python
# scripts/drem_data/test_discovery.py
"""Tests for discovery module."""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from drem_data.discovery import parse_build_config, parse_cfn_outputs


class TestParseBuildConfig:
    def test_parses_key_value_pairs(self, tmp_path):
        config = tmp_path / "build.config"
        config.write_text("region=eu-west-1\nlabel=main\nemail=test@example.com\n")
        result = parse_build_config(str(config))
        assert result["region"] == "eu-west-1"
        assert result["label"] == "main"
        assert result["email"] == "test@example.com"

    def test_ignores_blank_lines(self, tmp_path):
        config = tmp_path / "build.config"
        config.write_text("region=eu-west-1\n\nlabel=main\n")
        result = parse_build_config(str(config))
        assert result["region"] == "eu-west-1"
        assert result["label"] == "main"

    def test_missing_file_returns_empty(self, tmp_path):
        result = parse_build_config(str(tmp_path / "nonexistent"))
        assert result == {}


class TestParseCfnOutputs:
    def test_parses_outputs_array(self, tmp_path):
        outputs = [
            {"OutputKey": "userPoolId", "OutputValue": "eu-west-1_ABC123"},
            {"OutputKey": "region", "OutputValue": "eu-west-1"},
            {"OutputKey": "appsyncId", "OutputValue": "xyz"},
        ]
        path = tmp_path / "cfn.outputs"
        path.write_text(json.dumps(outputs))
        result = parse_cfn_outputs(str(path))
        assert result["userPoolId"] == "eu-west-1_ABC123"
        assert result["region"] == "eu-west-1"

    def test_missing_file_returns_empty(self, tmp_path):
        result = parse_cfn_outputs(str(tmp_path / "nonexistent"))
        assert result == {}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/davidsmith/Development/deepracer/drem-aws && .venv/bin/python -m pytest scripts/drem_data/test_discovery.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'drem_data.discovery'`

- [ ] **Step 4: Implement discovery module**

```python
# scripts/drem_data/discovery.py
"""
Discover DREM infrastructure — table names, user pool, region.
Reads build.config and cfn.outputs, queries CloudFormation for DynamoDB tables.
"""
import json
import os

import boto3


# CloudFormation logical ID prefixes → friendly names
TABLE_LOGICAL_ID_MAP = {
    "RaceManagerTable": "race",
    "EventsManagerEventsTable": "events",
    "LeaderboardTable": "leaderboard",
    "FleetsManagerFleetsTable": "fleets",
    "LandingPageManagerlandingPageConfigsTable": "landing_pages",
    "StatisticsStatsTable": "stats",
}


def parse_build_config(path: str = "build.config") -> dict:
    """Parse build.config key=value file."""
    result = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if "=" in line:
                    key, value = line.split("=", 1)
                    result[key.strip()] = value.strip()
    except FileNotFoundError:
        pass
    return result


def parse_cfn_outputs(path: str = "cfn.outputs") -> dict:
    """Parse cfn.outputs JSON array into a flat dict."""
    result = {}
    try:
        with open(path) as f:
            data = json.load(f)
        for item in data:
            result[item["OutputKey"]] = item["OutputValue"]
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        pass
    return result


def discover_tables(stack_name: str, region: str) -> dict:
    """
    Find DynamoDB table physical names by listing CloudFormation stack resources
    and matching logical IDs against TABLE_LOGICAL_ID_MAP.

    Returns: {"race": "physical-table-name", "events": "...", ...}
    """
    cf = boto3.client("cloudformation", region_name=region)
    tables = {}
    try:
        paginator = cf.get_paginator("list_stack_resources")
        for page in paginator.paginate(StackName=stack_name):
            for r in page["StackResourceSummaries"]:
                if r["ResourceType"] != "AWS::DynamoDB::Table":
                    continue
                logical_id = r["LogicalResourceId"]
                for prefix, friendly_name in TABLE_LOGICAL_ID_MAP.items():
                    if logical_id.startswith(prefix):
                        tables[friendly_name] = r["PhysicalResourceId"]
                        break
    except Exception as e:
        print(f"WARNING: CloudFormation discovery failed: {e}")
    return tables


def discover_config(stack_override: str | None = None) -> dict:
    """
    Build a complete config dict from build.config, cfn.outputs, and CloudFormation.

    Returns:
        {
            "label": "main",
            "region": "eu-west-1",
            "stack_name": "drem-backend-main-infrastructure",
            "user_pool_id": "eu-west-1_ABC123",
            "tables": {"race": "...", "events": "...", ...},
        }
    """
    build = parse_build_config()
    cfn = parse_cfn_outputs()

    label = stack_override or build.get("label", "main")
    region = cfn.get("region") or build.get("region", "eu-west-1")
    stack_name = f"drem-backend-{label}-infrastructure"
    user_pool_id = cfn.get("userPoolId", "")

    print(f"Stack:       {stack_name}")
    print(f"Region:      {region}")
    print(f"User Pool:   {user_pool_id}")
    print()

    print("Discovering tables...")
    tables = discover_tables(stack_name, region)
    for friendly, physical in sorted(tables.items()):
        print(f"  {friendly:15}: {physical}")
    print()

    return {
        "label": label,
        "region": region,
        "stack_name": stack_name,
        "user_pool_id": user_pool_id,
        "tables": tables,
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/davidsmith/Development/deepracer/drem-aws && .venv/bin/python -m pytest scripts/drem_data/test_discovery.py -v`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/drem_data/__init__.py scripts/drem_data/discovery.py scripts/drem_data/test_discovery.py
git commit -m "feat(export): add discovery module for build.config, cfn.outputs, and CloudFormation table lookup"
```

---

## Task 2: DynamoDB Table Helpers

Paginated scan, batch write with Decimal conversion, userId remapping, and dry-run support.

**Files:**
- Create: `scripts/drem_data/tables.py`
- Create: `scripts/drem_data/test_tables.py`

- [ ] **Step 1: Write tests for Decimal conversion and userId remapping**

```python
# scripts/drem_data/test_tables.py
"""Tests for DynamoDB table helpers."""
import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from drem_data.tables import to_decimal, from_decimal, remap_user_id_in_race, remap_user_id_in_leaderboard


class TestDecimalConversion:
    def test_float_to_decimal(self):
        assert to_decimal(3.14) == Decimal("3.14")

    def test_nested_dict(self):
        result = to_decimal({"time": 7234.5, "name": "test"})
        assert result == {"time": Decimal("7234.5"), "name": "test"}

    def test_nested_list(self):
        result = to_decimal([1.5, 2.5])
        assert result == [Decimal("1.5"), Decimal("2.5")]

    def test_int_unchanged(self):
        assert to_decimal(42) == 42

    def test_none_unchanged(self):
        assert to_decimal(None) is None

    def test_from_decimal(self):
        result = from_decimal({"time": Decimal("7234.5"), "count": Decimal("3")})
        assert result == {"time": 7234.5, "count": 3}

    def test_from_decimal_int_detection(self):
        """Decimal with no fractional part becomes int."""
        result = from_decimal(Decimal("42"))
        assert result == 42
        assert isinstance(result, int)


class TestUserIdRemap:
    def test_remap_race_item(self):
        mapping = {"old-sub": "new-sub"}
        item = {
            "eventId": "evt-1",
            "sk": "TRACK#track-1#USER#old-sub#RACE#race-1",
            "userId": "old-sub",
            "type": "race",
        }
        result = remap_user_id_in_race(item, mapping)
        assert result["userId"] == "new-sub"
        assert "USER#new-sub" in result["sk"]
        assert "old-sub" not in result["sk"]

    def test_remap_race_item_no_mapping(self):
        mapping = {}
        item = {
            "eventId": "evt-1",
            "sk": "TRACK#track-1#USER#some-sub#RACE#race-1",
            "userId": "some-sub",
            "type": "race",
        }
        result = remap_user_id_in_race(item, mapping)
        assert result["userId"] == "some-sub"  # unchanged

    def test_remap_leaderboard_item(self):
        mapping = {"old-sub": "new-sub"}
        item = {
            "eventId": "evt-1",
            "sk": "track-1#old-sub",
            "userId": "old-sub",
            "username": "alice",
        }
        result = remap_user_id_in_leaderboard(item, mapping)
        assert result["userId"] == "new-sub"
        assert result["sk"] == "track-1#new-sub"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/davidsmith/Development/deepracer/drem-aws && .venv/bin/python -m pytest scripts/drem_data/test_tables.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement table helpers**

```python
# scripts/drem_data/tables.py
"""
DynamoDB table helpers — scan, write, Decimal conversion, userId remapping.
"""
from decimal import Decimal

import boto3


def to_decimal(obj):
    """Convert floats to Decimal for DynamoDB."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_decimal(i) for i in obj]
    return obj


def from_decimal(obj):
    """Convert Decimals back to int/float for JSON serialization."""
    if isinstance(obj, Decimal):
        if obj == int(obj):
            return int(obj)
        return float(obj)
    if isinstance(obj, dict):
        return {k: from_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [from_decimal(i) for i in obj]
    return obj


def scan_table(table_name: str, region: str) -> list[dict]:
    """Paginated full scan of a DynamoDB table. Returns all items with Decimals converted."""
    ddb = boto3.resource("dynamodb", region_name=region)
    table = ddb.Table(table_name)
    items = []
    response = table.scan()
    items.extend(response["Items"])
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response["Items"])
    return [from_decimal(item) for item in items]


def batch_write_items(table_name: str, region: str, items: list[dict], dry_run: bool = False) -> int:
    """Write items to a DynamoDB table using batch_writer. Returns count written."""
    if dry_run:
        for item in items:
            pk_field = next((k for k in ["eventId", "fleetId", "pk"] if k in item), "?")
            print(f"  [DRY] PUT {pk_field}={item.get(pk_field, '?')}")
        return len(items)

    ddb = boto3.resource("dynamodb", region_name=region)
    table = ddb.Table(table_name)
    count = 0
    with table.batch_writer() as batch:
        for item in items:
            batch.put_item(Item=to_decimal(item))
            count += 1
    return count


def remap_user_id_in_race(item: dict, mapping: dict) -> dict:
    """Remap userId and sk in a race item. Returns a new dict."""
    item = dict(item)
    old_sub = item.get("userId", "")
    new_sub = mapping.get(old_sub, old_sub)
    item["userId"] = new_sub
    if "sk" in item and old_sub:
        item["sk"] = item["sk"].replace(old_sub, new_sub)
    return item


def remap_user_id_in_leaderboard(item: dict, mapping: dict) -> dict:
    """Remap userId and sk in a leaderboard item. Returns a new dict."""
    item = dict(item)
    old_sub = item.get("userId", "")
    new_sub = mapping.get(old_sub, old_sub)
    item["userId"] = new_sub
    if "sk" in item and old_sub:
        item["sk"] = item["sk"].replace(old_sub, new_sub)
    return item


def remap_created_by(item: dict, mapping: dict) -> dict:
    """Remap createdBy field. Returns a new dict."""
    item = dict(item)
    old_sub = item.get("createdBy", "")
    item["createdBy"] = mapping.get(old_sub, old_sub)
    return item
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/davidsmith/Development/deepracer/drem-aws && .venv/bin/python -m pytest scripts/drem_data/test_tables.py -v`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/drem_data/tables.py scripts/drem_data/test_tables.py
git commit -m "feat(export): add DynamoDB table helpers with Decimal conversion and userId remapping"
```

---

## Task 3: Cognito Helpers

Export users (list + groups) and import (create + assign groups + build sub mapping).

**Files:**
- Create: `scripts/drem_data/cognito.py`

- [ ] **Step 1: Create the Cognito module**

```python
# scripts/drem_data/cognito.py
"""
Cognito user export and import helpers.
"""
import secrets
import string

import boto3


def export_users(user_pool_id: str, region: str) -> list[dict]:
    """
    Export all users from a Cognito User Pool with their group memberships.

    Returns list of:
        {"username": str, "sub": str, "email": str, "countryCode": str,
         "enabled": bool, "status": str, "created": str, "groups": [str]}
    """
    client = boto3.client("cognito-idp", region_name=region)
    users = []

    # Paginate through all users
    paginator = client.get_paginator("list_users")
    for page in paginator.paginate(UserPoolId=user_pool_id):
        for user in page["Users"]:
            attrs = {a["Name"]: a["Value"] for a in user.get("Attributes", [])}
            user_record = {
                "username": user["Username"],
                "sub": attrs.get("sub", ""),
                "email": attrs.get("email", ""),
                "countryCode": attrs.get("custom:countryCode", ""),
                "enabled": user.get("Enabled", True),
                "status": user.get("UserStatus", ""),
                "created": user.get("UserCreateDate", "").isoformat()
                if hasattr(user.get("UserCreateDate", ""), "isoformat")
                else str(user.get("UserCreateDate", "")),
            }

            # Get group memberships
            try:
                groups_resp = client.admin_list_groups_for_user(
                    Username=user["Username"],
                    UserPoolId=user_pool_id,
                )
                user_record["groups"] = [g["GroupName"] for g in groups_resp["Groups"]]
            except Exception:
                user_record["groups"] = []

            users.append(user_record)

    return users


def import_users(
    users: list[dict],
    user_pool_id: str,
    region: str,
    dry_run: bool = False,
) -> dict:
    """
    Import users into a Cognito User Pool.

    Creates users with FORCE_CHANGE_PASSWORD, assigns groups, builds sub mapping.

    Args:
        users: List of user records from export.
        user_pool_id: Target user pool ID.
        region: AWS region.
        dry_run: If True, preview only.

    Returns:
        {"old_sub → new_sub"} mapping dict.
    """
    client = boto3.client("cognito-idp", region_name=region)
    mapping = {}

    for user in users:
        username = user["username"]
        old_sub = user["sub"]

        if dry_run:
            print(f"  [DRY] CREATE user={username} groups={user.get('groups', [])}")
            continue

        # Build user attributes
        user_attrs = []
        if user.get("email"):
            user_attrs.append({"Name": "email", "Value": user["email"]})
            user_attrs.append({"Name": "email_verified", "Value": "true"})
        if user.get("countryCode"):
            user_attrs.append({"Name": "custom:countryCode", "Value": user["countryCode"]})

        # Generate a temporary password
        temp_password = _generate_temp_password()

        try:
            response = client.admin_create_user(
                UserPoolId=user_pool_id,
                Username=username,
                TemporaryPassword=temp_password,
                UserAttributes=user_attrs,
                MessageAction="SUPPRESS",
            )
            new_sub = ""
            for attr in response["User"].get("Attributes", []):
                if attr["Name"] == "sub":
                    new_sub = attr["Value"]
                    break
            mapping[old_sub] = new_sub
            print(f"  Created user: {username} (sub: {old_sub[:8]}... → {new_sub[:8]}...)")
        except client.exceptions.UsernameExistsException:
            # User already exists — look up their current sub
            new_sub = _get_sub_for_username(client, user_pool_id, username)
            mapping[old_sub] = new_sub
            print(f"  Exists:       {username} (sub: {old_sub[:8]}... → {new_sub[:8]}...)")
        except Exception as e:
            print(f"  ERROR creating {username}: {e}")
            continue

        # Assign groups
        for group in user.get("groups", []):
            try:
                client.admin_add_user_to_group(
                    UserPoolId=user_pool_id,
                    Username=username,
                    GroupName=group,
                )
            except Exception as e:
                print(f"  WARNING: Could not add {username} to group {group}: {e}")

    return mapping


def _get_sub_for_username(client, user_pool_id: str, username: str) -> str:
    """Look up the sub for an existing user."""
    try:
        response = client.admin_get_user(
            UserPoolId=user_pool_id,
            Username=username,
        )
        for attr in response.get("UserAttributes", []):
            if attr["Name"] == "sub":
                return attr["Value"]
    except Exception:
        pass
    return ""


def _generate_temp_password(length: int = 16) -> str:
    """Generate a random password meeting Cognito requirements."""
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    # Ensure at least one of each required character type
    password = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%^&*"),
    ]
    password.extend(secrets.choice(chars) for _ in range(length - 4))
    # Shuffle to avoid predictable positions
    shuffled = list(password)
    secrets.SystemRandom().shuffle(shuffled)
    return "".join(shuffled)
```

- [ ] **Step 2: Verify syntax**

Run: `.venv/bin/python -c "import ast; ast.parse(open('scripts/drem_data/cognito.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/drem_data/cognito.py
git commit -m "feat(export): add Cognito user export/import with sub mapping and group management"
```

---

## Task 4: Manifest Module

Read and write the manifest JSON file that captures export metadata.

**Files:**
- Create: `scripts/drem_data/manifest.py`

- [ ] **Step 1: Create the manifest module**

```python
# scripts/drem_data/manifest.py
"""
Manifest read/write for DREM export bundles.
"""
import json
from datetime import datetime, timezone


def write_manifest(
    output_dir: str,
    source_stack: str,
    source_region: str,
    source_user_pool_id: str,
    counts: dict,
    options: dict,
) -> dict:
    """Write manifest.json to the export directory."""
    manifest = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "source_stack": source_stack,
        "source_region": source_region,
        "source_user_pool_id": source_user_pool_id,
        "counts": counts,
        "options": options,
    }
    path = f"{output_dir}/manifest.json"
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
    return manifest


def read_manifest(input_dir: str) -> dict:
    """Read manifest.json from an export directory."""
    path = f"{input_dir}/manifest.json"
    with open(path) as f:
        return json.load(f)


def update_manifest(input_dir: str, updates: dict):
    """Merge updates into an existing manifest.json."""
    manifest = read_manifest(input_dir)
    manifest.update(updates)
    path = f"{input_dir}/manifest.json"
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
```

- [ ] **Step 2: Verify syntax**

Run: `.venv/bin/python -c "import ast; ast.parse(open('scripts/drem_data/manifest.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/drem_data/manifest.py
git commit -m "feat(export): add manifest read/write module"
```

---

## Task 5: Export CLI

The main export entry point. Scans all tables, exports Cognito users, writes the export directory.

**Files:**
- Create: `scripts/drem_export.py`

- [ ] **Step 1: Create the export script**

```python
#!/usr/bin/env python3
"""
drem_export.py — Export a full DREM instance to a portable directory.

Usage:
    python scripts/drem_export.py                           # full export
    python scripts/drem_export.py --output ./my-export/     # custom output dir
    python scripts/drem_export.py --skip-users              # data only
    python scripts/drem_export.py --events evt-1,evt-2      # specific events
    python scripts/drem_export.py --stack dev               # override stack label
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

# Add scripts/ to path so drem_data package is importable
sys.path.insert(0, os.path.dirname(__file__))

from drem_data.discovery import discover_config
from drem_data.tables import scan_table, from_decimal
from drem_data.cognito import export_users
from drem_data.manifest import write_manifest


def main():
    parser = argparse.ArgumentParser(description="Export a DREM instance to portable files")
    parser.add_argument("--output", help="Output directory (default: auto-named)")
    parser.add_argument("--skip-users", action="store_true", help="Skip Cognito user export")
    parser.add_argument("--events", help="Comma-separated event IDs to export (default: all)")
    parser.add_argument("--stack", help="Override stack label from build.config")
    args = parser.parse_args()

    # Discover infrastructure
    config = discover_config(stack_override=args.stack)
    tables = config["tables"]
    region = config["region"]

    # Create output directory
    if args.output:
        output_dir = args.output.rstrip("/")
    else:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M%S")
        output_dir = f"drem-export-{timestamp}"
    os.makedirs(output_dir, exist_ok=True)
    print(f"Output: {output_dir}/\n")

    event_filter = None
    if args.events:
        event_filter = set(e.strip() for e in args.events.split(","))

    counts = {}

    # --- Events ---
    if "events" in tables:
        print("Exporting events...")
        events = scan_table(tables["events"], region)
        if event_filter:
            events = [e for e in events if e["eventId"] in event_filter]
        counts["events"] = len(events)
        _write_json(output_dir, "events.json", events)
        print(f"  {len(events)} events\n")
    else:
        print("WARNING: Events table not found, skipping.\n")
        events = []

    # Build set of event IDs for filtering other tables
    event_ids = {e["eventId"] for e in events}

    # --- Races ---
    if "race" in tables:
        print("Exporting races...")
        all_races = scan_table(tables["race"], region)
        # Filter by event and group by eventId
        races_by_event = {}
        for race in all_races:
            eid = race.get("eventId")
            if event_filter and eid not in event_ids:
                continue
            races_by_event.setdefault(eid, []).append(race)
        total_races = sum(len(r) for r in races_by_event.values())
        counts["races"] = total_races
        _write_json(output_dir, "races.json", races_by_event)
        print(f"  {total_races} races across {len(races_by_event)} events\n")
    else:
        print("WARNING: Race table not found, skipping.\n")

    # --- Leaderboard ---
    if "leaderboard" in tables:
        print("Exporting leaderboard...")
        leaderboard = scan_table(tables["leaderboard"], region)
        if event_filter:
            leaderboard = [e for e in leaderboard if e.get("eventId") in event_ids]
        counts["leaderboard_entries"] = len(leaderboard)
        _write_json(output_dir, "leaderboard.json", leaderboard)
        print(f"  {len(leaderboard)} entries\n")
    else:
        print("WARNING: Leaderboard table not found, skipping.\n")

    # --- Fleets ---
    if "fleets" in tables:
        print("Exporting fleets...")
        fleets = scan_table(tables["fleets"], region)
        counts["fleets"] = len(fleets)
        _write_json(output_dir, "fleets.json", fleets)
        print(f"  {len(fleets)} fleets\n")
    else:
        print("WARNING: Fleets table not found, skipping.\n")

    # --- Landing Pages ---
    if "landing_pages" in tables:
        print("Exporting landing page configs...")
        landing_pages = scan_table(tables["landing_pages"], region)
        if event_filter:
            landing_pages = [lp for lp in landing_pages if lp.get("eventId") in event_ids]
        counts["landing_pages"] = len(landing_pages)
        _write_json(output_dir, "landing_pages.json", landing_pages)
        print(f"  {len(landing_pages)} configs\n")
    else:
        print("WARNING: Landing pages table not found, skipping.\n")

    # --- Cognito Users ---
    if not args.skip_users and config["user_pool_id"]:
        print("Exporting Cognito users...")
        users = export_users(config["user_pool_id"], region)
        counts["users"] = len(users)
        _write_json(output_dir, "users.json", users)
        print(f"  {len(users)} users\n")
    elif args.skip_users:
        print("Skipping Cognito users (--skip-users).\n")
    else:
        print("WARNING: No user pool ID found, skipping users.\n")

    # --- Manifest ---
    write_manifest(
        output_dir=output_dir,
        source_stack=config["stack_name"],
        source_region=region,
        source_user_pool_id=config.get("user_pool_id", ""),
        counts=counts,
        options={
            "skip_users": args.skip_users,
            "event_filter": list(event_filter) if event_filter else None,
        },
    )

    print(f"Export complete → {output_dir}/")
    print(f"  {counts}")


def _write_json(directory: str, filename: str, data):
    """Write data to a JSON file in the export directory."""
    path = os.path.join(directory, filename)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify syntax**

Run: `.venv/bin/python -c "import ast; ast.parse(open('scripts/drem_export.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/drem_export.py
git commit -m "feat(export): add drem_export.py CLI for full DREM instance export"
```

---

## Task 6: Import CLI

The main import entry point. Reads export directory, optionally creates Cognito users, remaps userIds, writes to DynamoDB.

**Files:**
- Create: `scripts/drem_import.py`

- [ ] **Step 1: Create the import script**

```python
#!/usr/bin/env python3
"""
drem_import.py — Import a DREM export directory into a DREM deployment.

Usage:
    python scripts/drem_import.py --input ./drem-export-xxx/     # full import
    python scripts/drem_import.py --input ./xxx/ --skip-users    # data only
    python scripts/drem_import.py --input ./xxx/ --dry-run       # preview
    python scripts/drem_import.py --input ./xxx/ --stack dev     # target different env
"""
import argparse
import json
import os
import sys

# Add scripts/ to path so drem_data package is importable
sys.path.insert(0, os.path.dirname(__file__))

from drem_data.discovery import discover_config
from drem_data.tables import (
    batch_write_items,
    remap_user_id_in_race,
    remap_user_id_in_leaderboard,
    remap_created_by,
)
from drem_data.cognito import import_users
from drem_data.manifest import read_manifest, update_manifest


def main():
    parser = argparse.ArgumentParser(description="Import a DREM export into a deployment")
    parser.add_argument("--input", required=True, help="Path to export directory")
    parser.add_argument("--skip-users", action="store_true", help="Skip Cognito user import")
    parser.add_argument("--skip-leaderboard", action="store_true", help="Skip leaderboard import")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--stack", help="Override stack label from build.config")
    args = parser.parse_args()

    input_dir = args.input.rstrip("/")
    if not os.path.isdir(input_dir):
        sys.exit(f"Export directory not found: {input_dir}")

    # Read manifest
    manifest = read_manifest(input_dir)
    print(f"Import from:  {input_dir}/")
    print(f"Exported at:  {manifest['exported_at']}")
    print(f"Source stack: {manifest['source_stack']}")
    print(f"Counts:       {manifest['counts']}")
    print()

    if args.dry_run:
        print("DRY RUN — nothing will be written.\n")

    # Discover target infrastructure
    config = discover_config(stack_override=args.stack)
    tables = config["tables"]
    region = config["region"]

    user_mapping = {}

    # --- Cognito Users ---
    if not args.skip_users:
        users_file = os.path.join(input_dir, "users.json")
        if os.path.exists(users_file):
            users = _read_json(users_file)
            print(f"Importing {len(users)} Cognito users...")
            if not config["user_pool_id"]:
                print("WARNING: No user pool ID found, skipping users.\n")
            else:
                user_mapping = import_users(
                    users, config["user_pool_id"], region, dry_run=args.dry_run
                )
                print(f"  Mapped {len(user_mapping)} user subs.\n")

                # Save mapping to manifest for auditability
                if not args.dry_run and user_mapping:
                    update_manifest(input_dir, {"import_user_mapping": user_mapping})
        else:
            print("No users.json found, skipping users.\n")
    else:
        print("Skipping Cognito users (--skip-users).\n")

    # --- Events ---
    events_file = os.path.join(input_dir, "events.json")
    if os.path.exists(events_file) and "events" in tables:
        events = _read_json(events_file)
        if user_mapping:
            events = [remap_created_by(e, user_mapping) for e in events]
        print(f"Importing {len(events)} events → {tables['events']}")
        n = batch_write_items(tables["events"], region, events, dry_run=args.dry_run)
        print(f"  {'Would write' if args.dry_run else 'Wrote'} {n} events.\n")

    # --- Races ---
    races_file = os.path.join(input_dir, "races.json")
    if os.path.exists(races_file) and "race" in tables:
        races_by_event = _read_json(races_file)
        all_races = []
        for event_id, races in races_by_event.items():
            for race in races:
                if user_mapping:
                    race = remap_user_id_in_race(race, user_mapping)
                all_races.append(race)
        print(f"Importing {len(all_races)} races → {tables['race']}")
        n = batch_write_items(tables["race"], region, all_races, dry_run=args.dry_run)
        print(f"  {'Would write' if args.dry_run else 'Wrote'} {n} races.\n")

    # --- Leaderboard ---
    if not args.skip_leaderboard:
        lb_file = os.path.join(input_dir, "leaderboard.json")
        if os.path.exists(lb_file) and "leaderboard" in tables:
            leaderboard = _read_json(lb_file)
            if user_mapping:
                leaderboard = [remap_user_id_in_leaderboard(e, user_mapping) for e in leaderboard]
            print(f"Importing {len(leaderboard)} leaderboard entries → {tables['leaderboard']}")
            n = batch_write_items(tables["leaderboard"], region, leaderboard, dry_run=args.dry_run)
            print(f"  {'Would write' if args.dry_run else 'Wrote'} {n} entries.\n")
    else:
        print("Skipping leaderboard (--skip-leaderboard).\n")

    # --- Fleets ---
    fleets_file = os.path.join(input_dir, "fleets.json")
    if os.path.exists(fleets_file) and "fleets" in tables:
        fleets = _read_json(fleets_file)
        if user_mapping:
            fleets = [remap_created_by(f, user_mapping) for f in fleets]
        print(f"Importing {len(fleets)} fleets → {tables['fleets']}")
        n = batch_write_items(tables["fleets"], region, fleets, dry_run=args.dry_run)
        print(f"  {'Would write' if args.dry_run else 'Wrote'} {n} fleets.\n")

    # --- Landing Pages ---
    lp_file = os.path.join(input_dir, "landing_pages.json")
    if os.path.exists(lp_file) and "landing_pages" in tables:
        landing_pages = _read_json(lp_file)
        print(f"Importing {len(landing_pages)} landing page configs → {tables['landing_pages']}")
        n = batch_write_items(tables["landing_pages"], region, landing_pages, dry_run=args.dry_run)
        print(f"  {'Would write' if args.dry_run else 'Wrote'} {n} configs.\n")

    if args.dry_run:
        print("Dry run complete — no changes made.")
    else:
        print("Import complete.")


def _read_json(path: str):
    """Read a JSON file."""
    with open(path) as f:
        return json.load(f)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify syntax**

Run: `.venv/bin/python -c "import ast; ast.parse(open('scripts/drem_import.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/drem_import.py
git commit -m "feat(export): add drem_import.py CLI for full DREM instance import with userId remapping"
```

---

## Task 7: Integration Test — Dry Run Export

Run the export tool against the live deployment in dry-run mode to verify discovery and scanning works end-to-end.

**Files:** None (manual verification)

- [ ] **Step 1: Run unit tests**

Run: `cd /Users/davidsmith/Development/deepracer/drem-aws && .venv/bin/python -m pytest scripts/drem_data/ -v`
Expected: All tests pass.

- [ ] **Step 2: Run export against live stack**

Run: `.venv/bin/python scripts/drem_export.py --output /tmp/drem-test-export`

Expected output:
- Stack, region, user pool discovered from config files
- Tables discovered via CloudFormation
- Events, races, leaderboard, fleets, landing pages, users exported
- JSON files written to `/tmp/drem-test-export/`
- manifest.json with correct counts

- [ ] **Step 3: Verify export contents**

Run: `cat /tmp/drem-test-export/manifest.json | python3 -m json.tool`

Check that counts are reasonable and all files exist:
Run: `ls -la /tmp/drem-test-export/`

- [ ] **Step 4: Test import dry-run against same stack**

Run: `.venv/bin/python scripts/drem_import.py --input /tmp/drem-test-export --dry-run`

Expected: All items previewed with `[DRY]` prefix, no actual writes.

- [ ] **Step 5: Commit any fixes discovered during integration testing**

```bash
git add scripts/
git commit -m "fix(export): integration test fixes from live stack verification"
```

(Only if fixes were needed.)

---

## Notes

### What this delivers
- Full DREM instance export/import with Cognito user recreation
- Automatic userId (sub) remapping across all DynamoDB tables
- Table auto-discovery via CloudFormation + local config files
- Dry-run mode for safe previewing
- Selective export (specific events) and selective import (skip users/leaderboard)

### Known limitations
- Models and car log assets are not exported (S3 refs won't transfer between accounts)
- Car status is device-specific and not transferable
- Imported users get FORCE_CHANGE_PASSWORD — they must set new passwords
- The `sub` (userId) changes on import — any external system referencing old subs will need updating

### Future enhancements
- S3 model export/import (copy model files between buckets)
- Incremental export (only events since last export)
- Makefile targets (`make export`, `make import`)
