# Testing Guide: SSM Cross-Stack Sharing Migration

## Overview

This change replaces CloudFormation `Fn::ImportValue` cross-stack references between
`BaseStack` and `DeepracerEventManagerStack` with SSM Parameter Store dynamic references.

**Why this matters:** CloudFormation `Fn::ImportValue` creates a hard dependency between
stacks that prevents either from being updated independently. The classic symptom is:

```
Delete canceled. Cannot delete export drem-backend-X-base:ExportsOutput...
as it is in use by drem-backend-X-infrastructure.
```

With SSM, either stack can be deployed or destroyed independently.

---

## Automated Tests

Run before doing anything else. These run without Docker or a live AWS account.

```sh
npm install
make test.cdk
```

Expected output:

```
PASS test/deepracer-event-manager.test.ts
  BaseStack
    ✓ creates all required SSM parameters for cross-stack sharing
    ✓ does not export any CloudFormation outputs for cross-stack consumption
  DeepracerEventManagerStack
    ✓ has no Fn::ImportValue references to the base stack
    ✓ resolves base stack values via CloudFormation SSM parameter types
```

If the `Fn::ImportValue` test fails, the PR should not be merged — it means a
cross-stack reference has been reintroduced.

---

## Full Integration Test Plan

This validates a clean install from the upstream `main` branch followed by an upgrade
to the branch containing this change.

### Prerequisites

- AWS account bootstrapped for CDK (`make bootstrap`)
- `build.config` configured with your account, region, email, and label
- `make install` previously run at least once (CDK bootstrap complete)
- AWS CLI and CDK CLI available locally

### Step 1 — Tear down any existing deployment

If you have an existing DREM deployment under the same label, remove it first:

```sh
make drem.clean
```

This destroys the pipeline stack, waits for the infrastructure stack to delete, then
empties and deletes the base stack. Expected duration: 15–30 minutes.

> **Note:** The logs S3 bucket is configured to log access to itself. This causes
> CloudFormation's auto-delete to fail because new log objects are written during
> deletion. `make drem.clean` handles this automatically by disabling bucket logging
> and emptying the bucket before triggering stack deletion.

> **Verify:** All three stacks (`drem-pipeline-<label>`, `drem-backend-<label>-infrastructure`,
> `drem-backend-<label>-base`) are gone in the CloudFormation console.

### Step 2 — Deploy from upstream `main` (baseline)

Update `build.config` to point at the upstream repository and its stable branch:

```
source_repo = aws-solutions-library-samples/guidance-for-aws-deepracer-event-management
source_branch = release/stable
```

Deploy the pipeline:

```sh
make install
```

Wait for the pipeline to run to completion. The pipeline has a manual approval step
(`DeployDREM`) — approve it when it appears. Expected duration: 45–90 minutes.

> **Verify:**
> - Pipeline is green in CodePipeline console
> - `make local.config` runs without errors and produces `website/src/config.json`
> - DREM website is accessible at the CloudFront URL

### Step 3 — Switch pipeline source to the feature branch

Update `build.config` to point at the fork/branch containing this change:

```
source_repo = <your-fork>/guidance-for-aws-deepracer-event-management
source_branch = main
```

Re-deploy the pipeline stack to update the source:

```sh
make install
```

This updates the CodePipeline source connection. The pipeline will then self-update
and run automatically.

> **Verify:** CodePipeline source action shows the new repository and branch.

### Step 4 — Watch the pipeline run the migration

The pipeline run triggered by Step 3 applies the SSM migration. The deployment stage
runs in this order (enforced by `stack.addDependency(baseStack)`):

1. `DeployDREM` — manual approval (approve when prompted)
2. `base.Prepare` / `base.Deploy` — adds 14 SSM parameters, removes old `CfnOutput` exports
3. `infrastructure.Prepare` / `infrastructure.Deploy` — switches to SSM-based lookups
4. Website deploy steps

> **Watch for failure at `base.Deploy`:** If you see
> `Cannot delete export ... as it is in use by drem-backend-X-infrastructure`
> then the infrastructure stack has not yet been updated to drop its `Fn::ImportValue`
> references. This should not happen with this change but indicates the dependency
> ordering is wrong.

Expected duration: 45–90 minutes.

### Step 5 — Verify post-migration state

```sh
# Config scripts still work
make local.config
make local.config.docker

# CDK tests still pass
make test.cdk

# Check no Fn::ImportValue remains between the two app stacks
aws cloudformation list-exports --region <region> \
  --query "Exports[?contains(Name, 'drem-backend-<label>-base')].[Name]" \
  --output table
```

The exports list should be empty (or contain only informational outputs not consumed
by the infrastructure stack). The 14 cross-stack values now flow through SSM:

```sh
aws ssm get-parameters-by-path \
  --path /drem-backend-<label>-base/ \
  --region <region> \
  --query 'Parameters[*].Name' \
  --output table
```

Expected: 14 parameters listed under `/drem-backend-<label>-base/`.

> **Verify:** Website is still accessible and functional after the migration.

### Step 6 — Clean up

```sh
make drem.clean
```

---

## Key Files Changed

| File | What changed |
|------|-------------|
| `lib/base-stack.ts` | Writes 14 SSM parameters at end of constructor |
| `lib/drem-app-stack.ts` | Reads from SSM via `valueForStringParameter()`; no longer takes base stack object as prop |
| `lib/cdk-pipeline-stack.ts` | `stack.addDependency(baseStack)` ensures base deploys before infra |
| `lib/constructs/cdn.ts` | Added `comment` prop for CloudFront distribution descriptions |
| `lib/constructs/leaderboard.ts` | Passes `comment` to Cdn construct |
| `lib/constructs/streaming-overlay.ts` | Passes `comment` to Cdn construct |
| `test/deepracer-event-manager.test.ts` | CDK assertion tests for the SSM pattern |
| `Makefile` | `make drem.clean`, `make venv`, Python venv fixes, `make test.cdk` |

## Adding New Cross-Stack Resources

When adding a resource to `BaseStack` that `DeepracerEventManagerStack` needs:

1. Write the resource identifier to SSM in `BaseStack` constructor:
   ```typescript
   new ssm.StringParameter(this, 'ssmMyNewResource', {
     parameterName: `/${this.stackName}/myNewResource`,
     stringValue: myResource.someArn,
   });
   ```

2. Read it in `DeepracerEventManagerStack` and reconstruct:
   ```typescript
   const myResourceArn = ssm.StringParameter.valueForStringParameter(
     this, `${ssmBase}/myNewResource`
   );
   const myResource = SomeConstruct.fromArn(this, 'ImportedMyResource', myResourceArn);
   ```

3. Add the key to the SSM parameter test in `test/deepracer-event-manager.test.ts`

4. Do **not** pass it as a constructor prop — this recreates the `Fn::ImportValue` dependency.
