# Shared Authentication — DREM + DRoA Integration Design Spec

## Goal

Enable single sign-on between DREM (DeepRacer Event Manager) and DRoA (DeepRacer on AWS) so that a racer signs up once and can train models in DRoA and race them on physical cars via DREM. Additionally, make DRoA-trained models available in DREM for racing.

## Current State

### DREM Authentication
- **Cognito User Pool** — created in `BaseStack` (`lib/constructs/idp.ts`)
- **Groups**: `admin`, `operator`, `commentator`, `registration`, `racer`
- **Self-signup**: enabled, default role = `racer`
- **Sign-in**: email + username
- **Identity Pool**: role mappings per group
- **Custom attributes**: `countryCode`, `avatarConfig`, `highlightColour`
- **User Pool** exports via SSM parameters (after SSM migration PRs merge)

### DRoA Authentication
- **Cognito User Pool** — created in `UserIdentity` construct (`source/apps/infra/lib/constructs/auth/userIdentity.ts`)
- **Groups**: `dr-admins`, `dr-race-facilitators`, `dr-racers`
- **Self-signup**: configurable (via AppConfig), default role = `dr-racers`
- **Sign-in**: email + username
- **Identity Pool**: role mappings per group
- **Lambda triggers**: pre-signup validation, post-confirmation group assignment
- **Profile management**: role change handler via EventBridge/CloudTrail

### Group Mapping

| DRoA | DREM | Description |
|---|---|---|
| `dr-admins` | `admin` | Full system admin |
| `dr-race-facilitators` | `operator` | Manages events/races |
| `dr-racers` | `racer` | Trains models / races |
| — | `commentator` | Race commentary view |
| — | `registration` | Registers racers at events |

### Model Storage

| System | Bucket | Path format |
|---|---|---|
| DRoA | `MODEL_DATA_BUCKET_NAME` | `{profileId}/models/{modelId}/` |
| DREM | Upload bucket | `private/{identityId}/{sub}/{username}/models/{filename}` |

DRoA models include: model artifacts, model_metadata.json, reward_function.py, sagemaker artifacts, metrics.

DREM models are uploaded as `.tar.gz` files and optimised server-side (via a Lambda-based model optimiser pipeline) before being made available for upload to cars. Only optimised models are pushed to the car.

---

## Authentication Options

### Option A: DREM owns, DRoA discovers
DREM's base stack creates and owns the Cognito User Pool. DRoA discovers it via SSM parameters and adds its own app client.

**How it works:**
1. DREM deploys first, creates User Pool with all groups (DREM + DRoA groups)
2. Publishes User Pool details to well-known SSM parameters (e.g. `/deepracer/shared/auth/*`)
3. DRoA checks for existing SSM parameters on deploy
4. If found: creates a new app client on the existing User Pool, adds any missing groups
5. If not found: creates its own User Pool (standalone mode)

**Pros:**
- Builds on DREM's existing SSM parameter pattern
- Minimal changes to DREM (just publish to shared SSM path)
- DRoA can still deploy standalone without DREM

**Cons:**
- Implies DREM deploys first for shared auth
- DREM "owns" the User Pool — DRoA is a secondary consumer
- DRoA's Lambda triggers (pre-signup, post-confirmation) need to be added to DREM's User Pool

### Option B: Standalone shared auth stack
A new lightweight CDK stack (`deepracer-auth`) that creates and owns the Cognito resources. Both DREM and DRoA reference it.

**How it works:**
1. Deploy `deepracer-auth` stack first — creates User Pool, Identity Pool, all groups
2. Exports everything via SSM parameters under `/deepracer/auth/*`
3. Both DREM and DRoA read from SSM and add their own app clients
4. Neither system creates a User Pool — they both consume

**Pros:**
- Clean separation of concerns — auth is independent
- True deployment order independence (after auth stack)
- Both systems are equal consumers
- Auth stack can be versioned and managed independently

**Cons:**
- Third stack to deploy and maintain
- Adds complexity for operators who only want one system
- Lambda triggers from both systems need coordinating on the shared pool

### Option C: Either-first with discovery
Whichever system deploys first creates the User Pool. The second discovers and reuses it.

**How it works:**
1. On deploy, check SSM for `/deepracer/shared/auth/userPoolId`
2. If not found: create User Pool, publish to SSM, add own groups + app client
3. If found: import existing User Pool, add own groups + app client
4. Both systems have identical discovery logic

**Pros:**
- True deployment order independence
- No third stack
- Graceful — works with DREM-only, DRoA-only, or both

**Cons:**
- Most complex to implement — both systems need the discovery + creation logic
- "Who owns the User Pool?" becomes ambiguous for updates
- Deleting the first-deployed system could orphan the User Pool
- Lambda triggers management is complex (which system's triggers are on the pool?)

### Option D: Federation via external IdP
Both systems use their own User Pools but federate via a shared identity provider (e.g. SAML, OIDC, or a shared Cognito domain).

**How it works:**
1. Each system keeps its own User Pool
2. A shared identity federation layer links them (e.g. Cognito as OIDC provider)
3. Users authenticate once, tokens work across both systems

**Pros:**
- No changes to either system's User Pool
- True independence
- Works with existing deployments

**Cons:**
- Most complex to set up
- Additional latency for cross-system auth
- Group/role mapping between pools is non-trivial
- May confuse users (which system am I logging into?)

---

## Existing Community Work

Community member Lars has already started implementing a variant of Option A (reversed — DRoA owns, DREM discovers):

- **DRoA PR**: [larsll/deepracer-on-aws#4](https://github.com/larsll/deepracer-on-aws/pull/4) — "Enable DREM Integration"
  - Adds DREM-compatible Cognito groups and user attributes (country, racer alias)
  - Synchronises user attributes between Cognito and DRoA's application data
  - Adds new group role mappings

- **DREM PR**: [larsll/guidance-for-aws-deepracer-event-management#2](https://github.com/larsll/guidance-for-aws-deepracer-event-management/pull/2) — "Feature: DeepRacer-on-AWS integration"
  - Adds optional `droaUserPoolId` parameter to DREM stack/pipeline config
  - If set: DREM skips creating its own User Pool and uses DRoA's existing pool
  - If not set: DREM creates its own pool as normal (standalone mode)
  - Uses rules-based role mapping for external pools, token-based for internal
  - WAF protection only applied when DREM owns the pool
  - Adds `racerName` custom attribute to schema

This approach is effectively **Option A reversed** — DRoA deploys first and owns the pool, DREM discovers it. The implementation is well-structured and handles the standalone fallback gracefully.

## Recommendation

**To be decided** — requires input from DREM upstream maintainers, DRoA upstream maintainers, and the DeepRacer Community. Lars' existing work provides a strong starting point.

Key questions for the community:
1. Is deployment order acceptable (DRoA first), or must it be truly order-independent?
2. Should we build on Lars' approach, or is a standalone auth stack preferred?
3. How many operators deploy both DREM and DRoA together vs separately?
4. Are there other DeepRacer community tools that might also want shared auth?
5. Should the "owner" be DRoA (Lars' approach) or DREM, or neither (Option B)?

---

## Model Integration

### Flow: DRoA → DREM

Regardless of which auth option is chosen, the model integration follows the same pattern:

1. **Racer trains model in DRoA** — model artifacts stored in DRoA's S3 bucket
2. **Racer marks model as "available for racing"** — new status/flag on the model in DRoA
3. **DREM discovers available models** — either via:
   - EventBridge event published by DRoA when a model is marked for racing
   - Direct API query from DREM to DRoA's model API
   - Shared DynamoDB table or S3 bucket with model references
4. **Model appears in DREM's model list** — racer sees their DRoA models alongside uploaded models
5. **Model optimised server-side** — DREM's Lambda-based model optimiser pipeline processes the `.tar.gz` before it's available for upload to cars
6. **Optimised model uploaded to car** — only optimised models are pushed to the car
7. **Model raced** — same as any other model in DREM

### Key decisions for model integration:
- Does DREM copy the model artifact to its own bucket, or reference DRoA's bucket directly?
- How does model metadata (name, training metrics, reward function) transfer?
- Should the "available for racing" flag live in DRoA's UI or DREM's UI?
- How are model versions handled? (racer may train multiple iterations)

### Model data required by DREM:
- Model name (display name)
- Model `.tar.gz` artifact (for car optimisation)
- Model owner (racer username — linked via shared auth)
- Optionally: training metrics, reward function (for display/comparison)

---

## Implementation Phases

### Phase 1: Shared Authentication
- Implement chosen auth option (A, B, C, or D)
- Merge group definitions across both systems
- Both systems authenticate against the same User Pool
- Racer signs up once, visible in both systems

### Phase 2: Model Bridge
- DRoA: "Mark for racing" UI on trained models
- DRoA: publish model availability (EventBridge or SSM/DDB)
- DREM: discover and list DRoA models in model management
- DREM: download/copy model artifact for car optimisation

### Phase 3: Unified Experience
- Single sign-in landing page with links to both DREM and DRoA
- Racer profile shared across systems (avatar, country, stats)
- Cross-system navigation (train in DRoA → race in DREM flow)

---

## Dependencies

- DREM SSM migration PRs (#165, #166) should merge first — establishes the SSM parameter pattern
- PR #171 (avatar/highlight colour) — racer identity should carry across both systems
- DRoA upstream buy-in required before implementation
