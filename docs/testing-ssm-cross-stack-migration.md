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

With SSM, either stack can be deployed or destroyed independently — and resources can
be added to or removed from `BaseStack` without CloudFormation blocking on export
dependencies.

---

## 2-PR Upgrade Strategy

This migration is delivered in two pull requests to ensure a clean upgrade from any
existing deployment without manual intervention:

**PR 1 — This PR (SSM migration):**
- Adds 14 SSM parameters to `BaseStack` for all shared resource identifiers
- Switches `DeepracerEventManagerStack` to read from SSM instead of `Fn::ImportValue`
- Removes T&C checkbox/link from the sign-up flow and admin UI (frontend only)
- `BaseStack` still deploys the T&C S3 bucket and CloudFront distributions

**PR 2 — Follow-up (T&C CDK infrastructure removal):**
- Removes the T&C S3 bucket, CloudFront distributions, and pipeline deploy step
- Safe to run after PR 1 because no `Fn::ImportValue` dependencies remain — CloudFormation
  can freely remove resources from `BaseStack` without blocking

> **If you skip PR 1 and apply PR 2 directly**, the pipeline will fail at `base.Deploy`
> with `Cannot delete export ... as it is in use by drem-backend-X-infrastructure`.
> Apply PR 1 first, wait for it to deploy successfully, then apply PR 2.

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

This validates a clean upgrade from the upstream `release/stable` branch to this PR.

### Prerequisites

- AWS account bootstrapped for CDK (`make bootstrap`)
- `build.config` configured with your account, region, email, and label
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
> and emptying the bucket before triggering stack deletion. If the base stack enters
> `DELETE_FAILED`, re-run the empty and retry:
> ```sh
> BUCKET=<bucket-name> REGION=<region>
> aws s3api put-bucket-logging --bucket $BUCKET --bucket-logging-status {} --region $REGION
> aws s3 rm s3://$BUCKET --recursive --region $REGION
> aws cloudformation delete-stack --stack-name drem-backend-<label>-base --region $REGION
> ```

> **Verify:** All three stacks (`drem-pipeline-<label>`, `drem-backend-<label>-infrastructure`,
> `drem-backend-<label>-base`) are gone in the CloudFormation console.

### Step 2 — Deploy from upstream `release/stable` (baseline)

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
> - Sign-up flow shows a T&C checkbox (this is the upstream baseline state)

### Step 3 — Switch pipeline source to this branch

Update `build.config` to point at the fork/branch containing this change:

```
source_repo = <your-fork>/guidance-for-aws-deepracer-event-management
source_branch = feat/ssm-cross-stack-sharing
```

Re-deploy the pipeline stack to update the source:

```sh
make install
```

This updates the CodePipeline source connection. The pipeline will self-update
and run automatically.

> **Verify:** CodePipeline source action shows the new repository and branch.

### Step 4 — Watch the pipeline run the migration

The pipeline run triggered by Step 3 applies the SSM migration. The key deployment
sequence (enforced by `stack.addDependency(baseStack)`):

1. `DeployDREM` — manual approval (approve when prompted)
2. `base.Prepare` / `base.Deploy` — adds 14 SSM parameters; T&C resources remain
3. `infrastructure.Prepare` / `infrastructure.Deploy` — drops all `Fn::ImportValue`,
   switches to SSM-based lookups for 12 values; still receives T&C props directly
4. Website deploy steps (main site, leaderboard, overlays, T&C)

This ordering is safe because `base.Deploy` only **adds** SSM parameters — it does
not remove any existing `CfnOutput` exports that the current infra stack imports.
After infra deploys, it no longer holds any `Fn::ImportValue` references.

> **If `base.Deploy` fails** with `Cannot delete export ... as it is in use`, it means
> the branch still contains a resource removal from `BaseStack` that infra currently
> imports. Check that no T&C CDK resources have been removed from this branch.

Expected duration: 45–90 minutes.

### Step 5 — Verify post-migration state

#### AWS Console — SSM Parameter Store

Open the [SSM Parameter Store console](https://console.aws.amazon.com/systems-manager/parameters)
and filter by path `/drem-backend-<label>-base/`. You should see **14 parameters**:

| Parameter | Value type |
|-----------|-----------|
| `/drem-backend-<label>-base/cloudfrontDistributionId` | CloudFront distribution ID |
| `/drem-backend-<label>-base/cloudfrontDistributionDomainName` | CloudFront domain (e.g. `abc123.cloudfront.net`) |
| `/drem-backend-<label>-base/cloudfrontDomainName` | Custom domain or CloudFront domain |
| `/drem-backend-<label>-base/logsBucketName` | S3 bucket name |
| `/drem-backend-<label>-base/websiteBucketName` | S3 bucket name |
| `/drem-backend-<label>-base/eventBusArn` | EventBridge ARN |
| `/drem-backend-<label>-base/userPoolId` | Cognito User Pool ID |
| `/drem-backend-<label>-base/identityPoolId` | Cognito Identity Pool ID |
| `/drem-backend-<label>-base/userPoolClientWebId` | Cognito App Client ID |
| `/drem-backend-<label>-base/adminGroupRoleArn` | IAM Role ARN |
| `/drem-backend-<label>-base/operatorGroupRoleArn` | IAM Role ARN |
| `/drem-backend-<label>-base/commentatorGroupRoleArn` | IAM Role ARN |
| `/drem-backend-<label>-base/registrationGroupRoleArn` | IAM Role ARN |
| `/drem-backend-<label>-base/authenticatedUserRoleArn` | IAM Role ARN |

Or via CLI:

```sh
aws ssm get-parameters-by-path \
  --path /drem-backend-<label>-base/ \
  --region <region> \
  --query 'Parameters[*].Name' \
  --output table
```

#### AWS Console — CloudFormation

Open the [CloudFormation Exports console](https://console.aws.amazon.com/cloudformation/home#/exports)
and search for `drem-backend-<label>-base`. You will see some `CfnOutput` exports from
`BaseStack` — this is expected. What matters is that **none of them are consumed by
`drem-backend-<label>-infrastructure`**.

To confirm no `Fn::ImportValue` references remain in the infra stack, check the
template directly:

```sh
aws cloudformation get-template \
  --stack-name drem-backend-<label>-infrastructure \
  --region <region> \
  --query 'TemplateBody' \
  | grep -c 'Fn::ImportValue'
```

Expected output: `0`

#### Functional verification

```sh
# Config scripts still work
make local.config
make local.config.docker

# CDK tests still pass
make test.cdk
```

> **Verify:**
> - Website is accessible and functional
> - Sign-up flow no longer shows a T&C checkbox (frontend removal included in this PR)
> - Admin "Create User" form no longer shows a T&C checkbox
> - T&C page is still accessible at its CloudFront URL (CDK infrastructure not yet removed)

### Step 6 — Clean up

```sh
make drem.clean
```

---

## Key Files Changed

| File | What changed |
|------|-------------|
| `lib/base-stack.ts` | Writes 14 SSM parameters at end of constructor |
| `lib/drem-app-stack.ts` | Reads from SSM via `valueForStringParameter()`; interface reduced to `baseStackName` + T&C props |
| `lib/cdk-pipeline-stack.ts` | `stack.addDependency(baseStack)` ensures base deploys before infra; passes only `baseStackName` + T&C props |
| `lib/constructs/cdn.ts` | Added `comment` prop for CloudFront distribution descriptions |
| `lib/constructs/leaderboard.ts` | Passes `comment` to Cdn construct |
| `lib/constructs/streaming-overlay.ts` | Passes `comment` to Cdn construct |
| `lib/constructs/*.ts` (11 files) | `eventbus` prop type changed from `EventBus` to `IEventBus` |
| `website/src/App.tsx` | Removed T&C checkbox and footer link from sign-up flow |
| `website/src/admin/users/createUser.tsx` | Removed T&C checkbox from Create User form |
| `website/public/locales/en/translation.json` | Removed T&C translation strings |
| `scripts/generate_amplify_config_cfn.py` | Removed `termsAndConditionsUrl` from config output |
| `tsconfig.json` | Exclude `website*/` subdirs so CDK `tsc` doesn't compile Vite/React files |
| `test/deepracer-event-manager.test.ts` | CDK assertion tests for the SSM pattern |
| `jest.config.ts` | Converted from `.js` to `.ts`; replaces `jest.config.js` |
| `Makefile` | `make drem.clean`, `make venv`, Python venv fixes, `make test.cdk`, `--require-approval never` |
| `docs/testing-ssm-cross-stack-migration.md` | This file |

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
