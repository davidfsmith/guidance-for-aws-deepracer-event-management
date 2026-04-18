# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AWS DeepRacer Event Manager (DREM) — a full-stack event management platform for running AWS DeepRacer autonomous vehicle racing events. It consists of a React admin SPA, a public leaderboard SPA, a streaming overlays SPA, and AWS CDK infrastructure deploying a serverless AWS backend.

## Commands

### CDK Infrastructure (root)
```sh
npm run build        # Compile TypeScript CDK code
npm test             # Run CDK unit tests (Jest)
```

### Main Website (`website/`)
```sh
npm start            # Vite dev server on port 3000
npm run build        # Type-check + Vite build
npm test             # Vitest (single pass)
npm run test:watch   # Vitest (watch mode)
```
Run a single test file: `npx vitest run src/path/to/file.test.tsx`

### Leaderboard (`website-leaderboard/`) / Overlays (`website-stream-overlays/`)
```sh
npm start            # Vite dev server (leaderboard: 3001, overlays: 3002)
npm run build        # Type-check + Vite build
npm run lint         # ESLint
```

### Makefile shortcuts
```sh
make test            # Run main website tests
make local.run       # Start main website (port 3000)
make local.run-leaderboard   # Start leaderboard (port 3001)
make local.run-overlays      # Start overlays (port 3002)
make local.config    # Pull CloudFormation outputs + regenerate Amplify configs
make manual.deploy   # Deploy all CDK stacks directly (no pipeline)
make manual.deploy.hotswap   # Fast Lambda/asset hotswap redeploy
```

### Local dev setup
Before running locally, `make local.config` must be run against a deployed stack to generate `aws-exports.json` for all three websites (uses `scripts/generate_amplify_config.py`).

### Python Lambda development
```sh
make local.config.python     # Create venv + pip install -e .[dev]
pytest                        # Run Python tests
```

### Data Export/Import (`scripts/`)
Requires the project venv (`make local.config.python` or `make venv`). Run from the repo root (where `build.config` and `cfn.outputs` live).

```sh
# Export from your own DREM instance (direct DynamoDB access)
.venv/bin/python scripts/drem_export.py                              # full export
.venv/bin/python scripts/drem_export.py --skip-users                 # data only
.venv/bin/python scripts/drem_export.py --events evt-1,evt-2         # specific events

# Export from a remote DREM instance (GraphQL API, no AWS access needed)
.venv/bin/python scripts/drem_export.py --api --endpoint <URL> --token <JWT>

# Import into your DREM instance
.venv/bin/python scripts/drem_import.py --input ./drem-export-xxx/   # full import
.venv/bin/python scripts/drem_import.py --input ./xxx/ --dry-run     # preview
.venv/bin/python scripts/drem_import.py --input ./xxx/ --skip-users  # data only

# Rebuild statistics after import (direct DDB writes bypass EventBridge)
.venv/bin/python scripts/drem_rebuild_stats.py
```

## Architecture

### Two CDK Stacks (deployed via `lib/`)
1. **BaseStack** (`drem-backend-<label>-base`) — WAF, CloudFront for main site, Cognito User Pool + Identity Pool, EventBridge custom bus, shared Lambda layers, optional Route53/ACM
2. **DeepracerEventManagerStack** (`drem-backend-<label>-infrastructure`) — everything else; all domain constructs attach their types/resolvers to a single **AppSync GraphQL API**

**Deployment pipeline** (`CdkPipelineStack`) — self-mutating AWS CodePipeline pulling from GitHub; builds all three React apps and deploys both stacks. Configured via `build.config`.

### Backend Pattern
- All backend logic is **Python 3.12 ARM64 Lambda**, using AWS Lambda Powertools (`@tracer`, `@logger`, `AppSyncResolver`)
- Each domain construct (e.g. `RaceManager`, `ModelsManager`) appends its own GraphQL types/queries/mutations to the AppSync schema using `awscdk-appsync-utils` — the schema is code-first
- DynamoDB is used per domain (separate tables); Lambda resolvers handle all CRUD
- AppSync auth: **Cognito User Pool** (default), **API Key** (public leaderboard/overlays), **IAM** (Lambda-to-Lambda)
- Inter-service events flow through an **EventBridge custom bus**

### Frontend (`website/`)
- **Entry:** `src/App.tsx` — configures Amplify v6, initialises CloudWatch RUM, wraps app in Cognito `Authenticator`
- **UI:** [AWS CloudScape Design System](https://cloudscape.design/) throughout
- **Routing:** React Router v6, driven by `TopNav` with a side navigation
- **State:** Custom context-based store (`src/store/`) with domain stores: `usersStore`, `racesStore`, `modelsStore`, `carsStore`, `eventsStore`, `fleetsStore`, `assetsStore`
- **API layer:** Custom hooks per domain (`useCarsApi`, `useModelsApi`, `useRacesApi`, etc.) calling AppSync via Amplify v6
- **Timekeeper feature** (`src/pages/timekeeper/`) — the core race-management UI; uses an **XState v4** state machine (`ReadyToStartRace → RaceStarted → RaceIsOver`) to manage race flow
- **i18n:** i18next with translations in `src/i18n/` (de, en, es, fr, jp, se)

### Cognito User Groups / Roles
`admin`, `operator`, `commentator`, `registration`, `racer` — access control is enforced both in IAM (via group roles) and in AppSync resolvers.

### Public Frontends
- **Leaderboard** (`website-leaderboard/`) — unauthenticated, subscribes to AppSync via API key for live data; supports URL query params for display (lang, QR, track, format, flag)
- **Stream Overlays** (`website-stream-overlays/`) — unauthenticated, API key auth; uses D3.js for animated visualisations; supports chroma key background for broadcast use

## Repository Context

### Fork Structure
- **Upstream:** `aws-solutions-library-samples/guidance-for-aws-deepracer-event-management`
- **Fork:** `davidfsmith/guidance-for-aws-deepracer-event-management`
- Current main is at **v3.0.2** (PRs #164, #165, #167 merged)

### Upstream SSM Migration Chain (sequential, deploy-between-each)
PRs #164–#168 eliminate `Fn::ImportValue` cross-stack dependencies, remove Terms & Conditions, and consolidate websites into a single CloudFront distribution. **Existing deployments must apply in order.**

| Release | PRs | Status |
|---------|-----|--------|
| 3.0.1 | #167 (test infra) + #164 (SSM params + remove T&C frontend) | ✅ Merged |
| 3.0.2 | #165 (switch infra to SSM, remove T&C CDK) | ✅ Merged 2026-04-17 |
| 3.0.3 | #166 (restore base-first pipeline ordering) | ⏳ Open, ready for rebase |
| 3.0.4 | #168 (consolidate into single CloudFront) | ⏳ Open, needs rebase after #166 |

### Independent Feature/Fix PRs (no dependencies on SSM chain)
| PR | Title | Notes |
|----|-------|-------|
| #170 | feat(pipeline): configurable manual approval | Touches `cdk-pipeline-stack.ts`, `Makefile` |
| #171 | feat: racer avatar, highlight colour, identity | Largest independent PR — needs #184 first |
| #172 | feat: Pico W race display with OTA | New `pico-display/` dir |
| #176 | fix(leaderboard): scroll to racer on submit | Leaderboard frontend only |
| #177 | feat: data seed script | New `scripts/seed.py` |
| #178 | feat(models): drag-and-drop upload | Single component swap |
| #179 | feat: dark mode + compact density toggle | topNav + CSS only |
| #180 | feat(race-admin): CSV export | New export utility |
| #181 | fix(race-admin): track name + filter | Race admin frontend |
| #182 | fix(overlays): align numbers + gap to leader | Stream overlays SVG/JS |
| #183 | fix(timekeeper): auto timer status + layout | Timekeeper frontend |
| #184 | fix(docker): node:20-alpine | **Merge before #171** |
| #185 | fix: lazy-load user roles | Lambda + CDK + frontend |
| #186 | feat: lap count racing | CDK schema + frontend + overlays |

### Merge order notes
- **#184** (Docker node:20) must merge **before** #171 (avatar)
- #183 and #186 both touch `racePage*.tsx` — second to merge needs trivial rebase
- All independent PRs are safe to merge before, during, or after the SSM migration

## Current Work — Task Backlog

### Pending tasks (17)

| # | Task | Status | Upstream PR |
|---|------|--------|-------------|
| 1 | AWS Greengrass integration | Spec done, blocked on SSM PRs | |
| 2 | Racer and event statistics | Phase 1 deployed + tested with 474 events | |
| 3 | Real-time car performance data | Depends on #1 | |
| 4 | Comprehensive test coverage | | #167 (test infra merged) |
| 6 | Shared auth DREM + DRoA | Spec done, awaiting community input | |
| 8 | Race status light (DMX) | Parked | |
| 9 | F1-style overlays with telemetry | Depends on #1 + #29 | |
| 29 | Revise overlays to broadcast style | Spec done, blocked on PR #171 (avatar) | |
| 30 | Commentator display control tool | | |
| 33 | Public racer stats page | Part of stats (#2) Phase 2 | |
| 35 | Full export/import of DREM data | Built + tested, DDB + API modes | #187 |
| 36 | Migrate GraphQL codegen to TS | | |
| 37 | Real-time reset alert on pico | Depends on #39 | |
| 39 | Add reset detection to RPi timer | | |
| 40 | Racer queuing system | Spec done, awaiting pit crew/event feedback | |
| 41 | Auto-adopt SSM devices to fleet | Depends on #1 (Greengrass) | |
| 43 | Gap to faster racer | Part of #29 (overlay redesign) | |
| 45 | Consistent debug handler | | |
| 46 | Fix NULL trackId bug in getLeaderboard Lambda | Bug: `begins_with` on NULL trackId | |

### Key dependency chains
- **#1 (Greengrass)** blocks #3, #9, #41
- **#29 (overlay redesign)** blocks #9, includes #43 — blocked on PR #171 (avatar)
- **#39 (reset detection)** blocks #37
- **#2 (stats)** Phase 1 → #33 (racer stats page is Phase 2)
- **PR #184** (Docker node:20) must merge before **PR #171** (avatar)

### Design specs completed (6)
Greengrass, Statistics, Overlay Redesign, Lap Count (shipped), Shared Auth, Racer Queue
Specs live on the `docs/design-specs` branch.

### Follow-ups
- **When PR #171 (avatar) merges:** update export/import tools (#35 / PR #187) to handle avatar config + highlight colour fields in Cognito user attributes and leaderboard entries
- **When SSM migration lands (v3.0.4):** investigate pipeline build optimisation
- **Stats `/stats` route** is currently behind the Cognito Authenticator — needs public (unauthenticated) access for Phase 2

### Statistics Engine — Phase 1 (Task #2)
Branch `feat/statistics` — deployed and tested with 474 events, 6,201 racers, 43 countries imported from the live DREM community instance:
- **CDK construct** (`lib/constructs/statistics.ts`): StatsTable (DynamoDB), EVB Lambda, API Lambda, AppSync schema
- **EVB Lambda** (`lib/lambdas/stats_evb/`): triggered by `raceSummaryAdded/Updated/Deleted`, full-rebuild of global aggregates
- **API Lambda** (`lib/lambdas/stats_api/`): AppSync resolver for `getGlobalStats` (API key auth, public)
- **Frontend** (`website/src/pages/stats/globalDashboard.tsx`): `/stats` route with KPI cards, country bar chart, timeline, event type pie chart, fastest laps table
- **API key fix:** `generate_amplify_config_cfn.py` + `App.tsx` updated to pass `appsyncApiKey` to Amplify v6 config
- **Implementation plan:** `docs/superpowers/plans/2026-04-06-statistics-phase1.md`
- Phase 2 will add per-racer profiles (`/racer/:username`) and Phase 3 adds per-event stats

### Export/Import Tools (Task #35)
Branch `feat/export-import` — upstream PR #187:
- **`scripts/drem_export.py`**: DDB mode (direct table scan) + API mode (`--api --endpoint --token` for remote DREM instances)
- **`scripts/drem_import.py`**: full import with Cognito user creation, FORCE_CHANGE_PASSWORD, userId (sub) remapping across all tables
- **`scripts/drem_rebuild_stats.py`**: triggers stats EVB Lambda after import (direct DDB writes bypass EventBridge)
- **`scripts/drem_data/`**: shared library — discovery, table helpers, Cognito helpers, API client, manifest
- **Tested:** exported 516 events, 11,305 races, 5,752 users from live DREM; imported into dev instance
- **Design spec:** `docs/superpowers/specs/2026-04-06-export-import-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-04-06-export-import.md`
- **Docs:** `scripts/README.md`
### Cross-Stack Sharing Pattern

`BaseStack` and `DeepracerEventManagerStack` share values exclusively via **SSM Parameter Store** — there are no CloudFormation `Fn::ImportValue` / `CfnOutput` cross-stack references between them. This means either stack can be updated independently and in any order without CloudFormation blocking on export dependencies.

**How it works:**
- `BaseStack` writes all shared resource identifiers to SSM under `/${stackName}/<key>` at the end of its constructor
- `DeepracerEventManagerStack` reads them via `ssm.StringParameter.valueForStringParameter()` (resolved at CloudFormation deploy time, not synth time) and reconstructs CDK objects using `from*` static methods (`Role.fromRoleArn`, `EventBus.fromEventBusArn`, `Bucket.fromBucketName`, etc.)
- `DeepracerEventManagerStack` only takes `baseStackName: string` as a cross-stack prop

**When adding new resources to BaseStack that InfrastructureStack needs:**
1. Write the resource identifier to SSM in `BaseStack` constructor
2. Read it with `valueForStringParameter` in `DeepracerEventManagerStack` and reconstruct the CDK object
3. Do NOT pass it as a constructor prop — this would recreate the `Fn::ImportValue` dependency

**When removing resources from BaseStack:**
Because there are no `Fn::ImportValue` dependencies, you can remove a resource from `BaseStack` and deploy in a single pipeline run without the "cannot delete export in use" error. Ensure `InfrastructureStack` no longer reads the corresponding SSM parameter in the same commit.
