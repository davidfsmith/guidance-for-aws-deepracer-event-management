# DREM Export/Import Tool — Design Spec

## Goal

A Python CLI tool pair that can fully export a DREM instance (all event data, race history, leaderboard state, fleet config, landing page configs, and Cognito users with group memberships) and import it into another DREM deployment to recreate the instance.

## Data Scope

| Source | Export | Import | Notes |
|--------|--------|--------|-------|
| Events table | Full scan | Direct DDB write | Core event config, tracks, race config |
| Race table | Full scan | Direct DDB write, remap userId | Race records with laps and averageLaps |
| Leaderboard table | Full scan | Direct DDB write, remap userId | Derived but included for immediate availability |
| Fleets table | Full scan | Direct DDB write | Fleet-to-car mappings |
| LandingPageConfigs table | Full scan | Direct DDB write | Per-event landing page links |
| Cognito User Pool | `list_users` + `admin_list_groups_for_user` | `admin_create_user` + group assignment | Force password change on import |
| Stats table | Skipped | Recomputed automatically via EVB triggers | Derived data — rebuilds when races are imported |
| CarStatus table | Skipped | Device-specific, not transferable | SSM-managed car instances |
| Models table | Skipped | S3 refs won't transfer between accounts | Model metadata |
| CarLogAssets table | Skipped | S3 refs won't transfer | Video/log asset metadata |
| Job tables | Skipped | Transient upload/fetch state | Not meaningful to export |

## Export Format

```
drem-export-YYYY-MM-DD-HHMMSS/
  manifest.json
  events.json
  races.json
  leaderboard.json
  fleets.json
  landing_pages.json
  users.json
```

### manifest.json

```json
{
  "exported_at": "2026-04-06T14:30:00Z",
  "source_stack": "drem-backend-main-infrastructure",
  "source_region": "eu-west-1",
  "source_user_pool_id": "eu-west-1_XXXXXXX",
  "counts": {
    "events": 42,
    "races": 1250,
    "leaderboard_entries": 380,
    "fleets": 5,
    "landing_pages": 42,
    "users": 95
  },
  "options": {
    "skip_users": false,
    "event_filter": null
  }
}
```

### events.json

Array of event items as stored in DynamoDB:

```json
[
  {
    "eventId": "abc-123",
    "eventName": "UK Regional 2026",
    "eventDate": "2026-03-15",
    "typeOfEvent": "OFFICIAL_TRACK_RACE",
    "countryCode": "GB",
    "createdAt": "2026-03-01T10:00:00.000Z",
    "createdBy": "user-sub-uuid",
    "raceConfig": {
      "trackType": "REINVENT_2018",
      "rankingMethod": "BEST_LAP_TIME",
      "raceTimeInMin": 4,
      "numberOfResetsPerLap": 0,
      "averageLapsWindow": 3,
      "maxRunsPerRacer": "0"
    },
    "tracks": [
      {"trackId": "track-1", "fleetId": "fleet-1", "leaderBoardTitle": "...", "leaderBoardFooter": "..."}
    ],
    "sponsor": "AWS"
  }
]
```

### races.json

Dict keyed by eventId, each value is an array of race DDB items:

```json
{
  "abc-123": [
    {
      "eventId": "abc-123",
      "sk": "TRACK#track-1#USER#user-sub#RACE#race-uuid",
      "type": "race",
      "trackId": "track-1",
      "userId": "user-sub-uuid",
      "raceId": "race-uuid",
      "createdAt": "2026-03-15T14:30:00.000Z",
      "racedByProxy": false,
      "laps": [
        {"lapId": 0, "time": 7234, "isValid": true, "resets": 0}
      ],
      "averageLaps": [
        {"startLapId": 0, "endLapId": 2, "avgTime": 7500}
      ]
    }
  ]
}
```

### leaderboard.json

Array of leaderboard entry DDB items:

```json
[
  {
    "eventId": "abc-123",
    "sk": "track-1#user-sub-uuid",
    "type": "leaderboard_entry",
    "trackId": "track-1",
    "userId": "user-sub-uuid",
    "username": "alice",
    "countryCode": "GB",
    "numberOfValidLaps": 12,
    "numberOfInvalidLaps": 3,
    "fastestLapTime": 6850,
    "avgLapTime": 7234,
    "lapCompletionRatio": 80.0,
    "avgLapsPerAttempt": 5.0,
    "mostConcecutiveLaps": 4,
    "fastestAverageLap": {"startLapId": 0, "endLapId": 2, "avgTime": 7100},
    "racedByProxy": false
  }
]
```

### fleets.json

Array of fleet DDB items:

```json
[
  {
    "fleetId": "fleet-uuid",
    "fleetName": "Main Fleet",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "createdBy": "admin-sub-uuid",
    "carIds": ["car-instance-1", "car-instance-2"]
  }
]
```

### landing_pages.json

Array of landing page config DDB items:

```json
[
  {
    "eventId": "abc-123",
    "links": [
      {"linkName": "Register", "linkHref": "https://...", "linkDescription": "Sign up here"}
    ]
  }
]
```

### users.json

Array of Cognito user records:

```json
[
  {
    "username": "alice",
    "sub": "user-sub-uuid",
    "email": "alice@example.com",
    "countryCode": "GB",
    "enabled": true,
    "status": "CONFIRMED",
    "created": "2026-01-10T09:00:00Z",
    "groups": ["operator", "racer"]
  }
]
```

## Table Discovery

1. Read `build.config` for `label` and `region`
2. Read `cfn.outputs` for `userPoolId` and `region`
3. Use CloudFormation `list_stack_resources` on `drem-backend-{label}-infrastructure` to find DynamoDB table physical names by matching logical IDs:
   - `RaceManager` construct → race table (logical ID contains `RaceManagerTable`)
   - `EventsManager` construct → events table (logical ID contains `EventsManagerEventsTable`)
   - `Leaderboard` construct → leaderboard table (logical ID contains `LeaderboardTable`)
   - `FleetsManager` construct → fleets table (logical ID contains `FleetsManagerFleetsTable`)
   - `LandingPageManager` construct → landing pages table (logical ID contains `LandingPageManagerlandingPageConfigsTable`)
4. `--stack` flag overrides the label from `build.config`

## Cognito User Handling

### Export

For each user in the pool:
1. `list_users` (paginated) — captures `Username`, `sub`, `email`, `custom:countryCode`, `UserStatus`, `Enabled`, `UserCreateDate`
2. `admin_list_groups_for_user` per user — captures group memberships

### Import

1. Create users via `admin_create_user`:
   - `Username` preserved from export
   - `TemporaryPassword` set to a random secure value
   - `MessageAction: SUPPRESS` (no welcome email sent)
   - `UserAttributes`: `email`, `custom:countryCode`
2. Assign to groups via `admin_add_user_to_group` for each group
3. Users land in `FORCE_CHANGE_PASSWORD` state — they must set a new password on first login
4. Build `old_sub → new_sub` mapping by matching on `Username`:
   - After creating the user, read back the new `sub` from the response
   - Store mapping in memory for DDB userId remapping
5. If user already exists (username conflict), catch the error, look up the existing user's `sub`, and use that for the mapping
6. Write the `old_sub → new_sub` mapping to `manifest.json` under an `"import_user_mapping"` key for auditability

### userId Remapping

All DDB records referencing a `userId` (Cognito `sub`) are remapped during import:
- Race items: `userId` field and `sk` field (contains `USER#{userId}`)
- Leaderboard items: `userId` field and `sk` field (contains `{trackId}#{userId}`)
- Event items: `createdBy` field
- Fleet items: `createdBy` field

If `--skip-users` is used on import, no remapping occurs — userIds are written as-is from the export (useful for same-environment restores or when users already exist).

## CLI Interface

### Export

```bash
python scripts/drem_export.py                              # full export, auto-named dir
python scripts/drem_export.py --output ./my-export/        # custom output dir
python scripts/drem_export.py --skip-users                 # data only, no Cognito
python scripts/drem_export.py --events evt-1,evt-2         # specific events only
python scripts/drem_export.py --stack dev                  # override label from build.config
```

### Import

```bash
python scripts/drem_import.py --input ./drem-export-xxx/   # full import
python scripts/drem_import.py --input ./xxx/ --skip-users  # data only, no Cognito
python scripts/drem_import.py --input ./xxx/ --dry-run     # preview without writing
python scripts/drem_import.py --input ./xxx/ --stack dev   # target different environment
python scripts/drem_import.py --input ./xxx/ --skip-leaderboard  # skip derived data
```

## File Structure

```
scripts/
  drem_export.py        # Export CLI entry point
  drem_import.py        # Import CLI entry point
  drem_data/
    __init__.py
    discovery.py        # Table + Cognito discovery from build.config/cfn.outputs/CloudFormation
    tables.py           # DynamoDB scan/write helpers (pagination, Decimal conversion, dry-run)
    cognito.py          # Cognito user export/import (list, create, group management, sub mapping)
    manifest.py         # Manifest read/write
```

## Dependencies

- `boto3` — already in the project venv
- No other external dependencies (pure stdlib + boto3)

## Error Handling

- `--dry-run` previews all writes with `[DRY]` prefix, counts logged
- Import is idempotent: `put_item` overwrites existing records; `admin_create_user` for existing users is caught and the existing sub is used for mapping
- Both tools print progress summaries (items exported/imported per table)
- If `cfn.outputs` doesn't exist, fall back to querying CloudFormation directly
- If a table can't be discovered, warn and skip (same pattern as `import_to_drem.py`)

## Python Environment

Uses the project venv created by `make local.config.python`. The tool should be runnable as:

```bash
source .venv/bin/activate
python scripts/drem_export.py
```

Or directly:

```bash
.venv/bin/python scripts/drem_export.py
```
