# Upstream Merge Plan — SSM Cross-Stack Migration + Feature PRs

**Generated:** 2026-04-03
**Updated:** 2026-04-25
**Upstream:** `aws-solutions-library-samples/guidance-for-aws-deepracer-event-management`
**Fork:** `davidfsmith/guidance-for-aws-deepracer-event-management`

---

## Overview

Four upstream PRs (#164–#166, #168) form a sequential migration that eliminates `Fn::ImportValue`
cross-stack dependencies, removes the Terms & Conditions feature, and consolidates websites
into a single CloudFront distribution. A fifth PR (#167) adds test infrastructure and is
independent of the migration series.

Additionally, 20+ independent feature/fix PRs (#170–#197) can be merged at any time —
they have no dependencies on the SSM migration chain or on each other (a few light ordering
notes are called out below).

**Status (2026-04-25):** Releases 3.0.1, 3.0.2, 3.0.3, and the 3.0.3a hotfix (PR #198, NAG
suppression refactor) are all merged upstream. Only 3.0.4 (#168) remains in the SSM chain.

**v3.0.3a-readiness audit:** All 20 fork PRs were audited against `upstream/main` at v3.0.3a.
Results below; the Status column in the table reflects the outcome.

| Outcome                        | Count | PRs                                                              |
| ------------------------------ | ----- | ---------------------------------------------------------------- |
| ✅ Already on v3.0.3a            | 11    | #176, #177, #178, #179, #180, #181, #182, #183, #184, #185, #186 |
| ✅ Rebased + force-pushed clean  | 5     | #187, #188, #195, #196, #197                                     |
| ⚠️ Needs manual rebase (CLAUDE.md + tsconfig.json) | 2 | #168, #172 |
| ⚠️ Needs manual rebase (CLAUDE.md + bin/drem.ts)   | 2 | #170, #171 |

**Notable findings from the audit:**

- No PR conflicts with the v3.0.3a NAG-suppression refactor in `lib/drem-app-stack.ts` — git
  auto-merges those hunks because #198 only moved per-resource suppressions to stack-level,
  which doesn't overlap with where my PRs add their construct instantiations.
- The `tsconfig.json` conflicts on #168/#172 trace back to an old commit (`5b060ed Remove
  terms and conditions from frontend and config`) from PR #164 (Release 3.0.1). Those
  branches were created before #164 landed, so they replay an outdated tsconfig change.
- The `bin/drem.ts` conflicts on #170/#171 are real CDK changes (configurable manual approval,
  Cognito attributes for avatar) that need merging by hand.

> **BREAKING CHANGE — Sequential upgrade required for existing deployments.**
> Users with an existing deployment must apply PRs 1 → 2 → 3 → 4 **in order**, deploying each
> before merging the next. Skipping directly to the latest release will fail with an
> `Fn::ImportValue` deadlock. Fresh installations are unaffected.

---

## Merge Order — SSM Migration Chain

### Release 3.0.1: Test Infrastructure + SSM Parameters + Remove T&C Frontend ✅ MERGED

| Item               | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PRs**            | [#167](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/167) + [#164](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/164)                                                                                                                                                                                                                   |
| **Titles**         | #167: Add test infrastructure and post-deploy validation stage to CDK pipeline<br>#164: SSM cross-stack sharing (PR 1 of 4): add SSM parameters + remove T&C frontend                                                                                                                                                                                                                                                                           |
| **Status**         | ✅ Merged
| **Tag**            |  `v3.0.1`                                                                                                                                                                                                                                                                                                                                                                                                                 |

---

### Release 3.0.2: Switch Infra to SSM + Remove T&C CDK Infrastructure ✅ MERGED

| Item             | Detail                                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PR**           | [#165](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/165)                                                                                                                                                                                                                                                        |
| **Title**        | SSM cross-stack sharing (PR 2 of 4): switch infra to SSM, remove T&C CDK infrastructure                                                                                                                                                                                                                                                                              |
| **Dependencies** | Release 3.0.1 must be deployed first                                                                                                                                                                                                                                                                                                                                 |
| **Status**       | ✅ Merged - 2026-04-17                                                                                                                                                                                                                                                                                                               |
| **What it does** | • Switches `DeepracerEventManagerStack` (`drem-app-stack`) to read all shared values from SSM Parameter Store instead of `Fn::ImportValue`<br>• Removes T&C CDK infrastructure (S3 bucket, CloudFront distribution, pipeline deployment)<br>• **Temporarily reverses pipeline ordering** (infra-first instead of base-first) to break the `Fn::ImportValue` deadlock |
| **Key files**    | `lib/base-stack.ts`, `lib/cdk-pipeline-stack.ts`, `lib/drem-app-stack.ts`, `lib/constructs/cdn.ts`, `lib/constructs/landing-page.ts`, `lib/constructs/leaderboard.ts`, `lib/constructs/streaming-overlay.ts`, and all construct files that consumed `Fn::ImportValue`                                                                                                |
| **Tag**          | `v3.0.2`                                                                                                                                                                                                                                                                                                                                                             |

**Deploy this fully** (verify `Fn::ImportValue` count = 0 in the infra stack) before
proceeding to PR 3.

---

### Release 3.0.3: Restore Base-First Pipeline Ordering + Fix NAG Findings ✅ MERGED

| Item             | Detail                                                                                                                                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PRs**          | [#166](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/166) + [#190](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/190)                                                      |
| **Titles**       | #166: SSM cross-stack sharing (PR 3 of 4): restore base-first pipeline ordering<br>#190: Fix NAG issues                                                                                                                                                                           |
| **Dependencies** | Releases 3.0.1 and 3.0.2 must be deployed first                                                                                                                                                                                                                                   |
| **Status**       | ✅ Merged — 2026-04-24                                                                                                                                                                                                                                                              |
| **What it does** | • Restores `stack.addDependency(baseStack)` (base-first ordering) for all future pipeline runs<br>• PR 2 temporarily used infra-first ordering to break the deadlock; this PR reverts to the correct permanent ordering<br>• Removes the `website-terms-and-conditions/` directory<br>• #190 adds NagSuppressions across the codebase so local `cdk synth` passes without env-var workarounds |
| **Key files**    | `lib/cdk-pipeline-stack.ts`, `bin/drem.ts`, `website-terms-and-conditions/terms-and-conditions.html` (removed); #190 touches most `lib/constructs/*.ts` adding suppressions                                                                                                        |
| **Tag**          | `v3.0.3`                                                                                                                                                                                                                                                                           |

---

### Release 3.0.4: Consolidate into Single CloudFront Distribution (PR 4 of 4)

| Item             | Detail                                                                                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PR**           | [#168](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/168)                                                                                                                                  |
| **Title**        | Consolidate leaderboard and overlays into single CloudFront distribution (PR 4 of 4)                                                                                                                                                           |
| **Dependencies** | Releases 3.0.1, 3.0.2, and 3.0.3 must be deployed first                                                                                                                                                                                       |
| **Status**       | ⏳ Open — ready to rebase on v3.0.3 (has a `tsconfig.json` conflict when rebased on current main)                                                                                                                                               |
| **What it does** | • Consolidates three separate website CloudFront distributions (main, leaderboard, stream-overlays) into one<br>• Single S3 bucket for all web assets<br>• Leaderboard and overlays built into `website/public/` subdirectories during pipeline |
| **Key files**    | `lib/cdk-pipeline-stack.ts`, `lib/drem-app-stack.ts`, `lib/base-stack.ts`, `compose.yaml`, `Makefile`, website build scripts                                                                                                                   |
| **Tag**          | `v3.0.4`                                                                                                                                                                                                                                       |

---

## Independent Feature/Fix PRs

These PRs have **no dependencies** on the SSM migration chain or on each other. They can be
merged in any order at any time.

| PR | Title | Dependencies | Status |
|---|---|---|---|
| [#170](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/170) | feat(pipeline): make manual approval step configurable | None | ⚠ Needs rebase — CLAUDE.md + `bin/drem.ts` |
| [#171](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/171) | feat: racer avatar, highlight colour, and identity display | None (adds Cognito attrs, leaderboard fields, overlay identity) | ⚠ Needs rebase — CLAUDE.md + `bin/drem.ts` |
| [#172](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/172) | feat: Pico W Galactic Unicorn race display with OTA updates | None (new `pico-display/` directory + admin page) | ⚠ Needs rebase — CLAUDE.md + `tsconfig.json` |
| [#176](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/176) | fix(leaderboard): scroll to and highlight racer when race submitted | None (leaderboard frontend only) — closes #40 | ✅ Already on v3.0.3a |
| [#177](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/177) | feat: data seed script for populating dev environments with test data | None (new `scripts/seed.py` + Makefile targets) | ✅ Already on v3.0.3a |
| [#178](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/178) | feat(models): drag and drop model upload using CloudScape FileUpload | None (single component swap) — closes #38 | ✅ Already on v3.0.3a |
| [#179](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/179) | feat: dark mode and compact density toggle | None (topNav + CSS only) — closes #36 | ✅ Already on v3.0.3a |
| [#180](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/180) | feat(race-admin): CSV export of race data | None (new export utility + button) | ✅ Already on v3.0.3a |
| [#181](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/181) | fix(race-admin): show track name and enable track filter | None (race admin frontend only) — closes #41 | ✅ Already on v3.0.3a |
| [#182](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/182) | fix(overlays): align numbers and show gap to leader | None (stream overlays SVG + JS only) — closes #44, #54 | ✅ Already on v3.0.3a |
| [#183](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/183) | fix(timekeeper): auto timer status display and race page layout | None (timekeeper frontend + laps table config) — closes #60 | ✅ Already on v3.0.3a |
| [#184](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/184) | fix(docker): switch to node:20-alpine — node:22-alpine npm is broken | None (Dockerfiles only) — **should merge before #171** | ✅ Already on v3.0.3a |
| [#185](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/185) | fix: lazy-load user roles on admin users page | None (Lambda + CDK + frontend) | ✅ Already on v3.0.3a |
| [#186](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/186) | feat: lap count based racing format | None (CDK schema + frontend + overlays) | ✅ Already on v3.0.3a |
| [#187](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/187) | feat: DREM data export/import CLI tools | None (new `scripts/` directory + `scripts/drem_data/` package) | ✅ Rebased on v3.0.3a 2026-04-25 |
| [#188](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/188) | feat(events): add TEST_EVENT type | None (additive enum value + frontend dropdown + i18n) | ✅ Rebased on v3.0.3a 2026-04-25 |
| [#195](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/195) | fix(leaderboard): handle null trackId in getLeaderboard resolver (closes #194) | None (Lambda-only fix) | ✅ Rebased on v3.0.3a 2026-04-25 |
| [#196](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/196) | feat(stats): racer and event statistics engine + chart.js migration | None on SSM chain. Overlaps with #188 — contains the TEST_EVENT commits via merge, so whichever lands first makes the other a partial no-op on rebase | ✅ Rebased on v3.0.3a 2026-04-25 |
| [#197](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/197) | feat: race results PDFs (organiser summary / podium / racer cert / bulk) | None. Self-contained: new CDK construct, new container-image Lambdas, new frontend hook. Task #48 | ✅ Rebased on v3.0.3a 2026-04-25 |

### Notes on independent PRs

- **#184 (Docker node:20)** should merge **before** #171 (avatar). #184 fixes all three Dockerfiles to use
  `node:20-alpine` and removes the broken `npm update -g`. #171 then adds `--legacy-peer-deps` to the website
  Dockerfile only (for the avataaars React 17 peer dep). No duplication between them.
- **#171 (avatar)** touches `lib/constructs/idp.ts` (adds Cognito attributes), `lib/constructs/user-manager.ts`,
  `lib/constructs/leaderboard.ts`, `lib/constructs/race-manager.ts`, and multiple Lambdas. It's the largest
  independent PR but has no CDK cross-stack changes that conflict with the SSM migration. Depends on #184 for
  the Dockerfile base image fix.
- **#172 (pico display)** includes a workaround commit (`e7e9c48`) adding Cognito attributes to `idp.ts` to
  match the deployed stack. This should be dropped if #171 merges first (the attributes will already be there).
  If #172 merges first, the commit is harmless (additive).
- **#170 (optional approval)** touches `lib/cdk-pipeline-stack.ts` and `Makefile` — may need a trivial rebase
  if any SSM migration PR merges first, since they also touch those files.
- **#183 (timer layout + auto timer status)** touches `racePage.tsx` and `racePageLite.tsx` which were also
  modified in the merged PR #157 (RPi5 timer) and #174 (race timer fix). No conflicts — changes are in
  different sections (layout vs WebSocket/GPIO).
- **#185 (user roles)** adds `getUserRoles` AppSync query, new Lambda resolver, `LazyRolesCell` component,
  and IAM permission. Touches `lib/constructs/user-manager.ts` and `lib/lambdas/users_function/index.py`.
  No overlap with SSM migration or other PRs.
- **#186 (lap count racing)** adds `RaceEndCondition` enum and fields to `events-manager.ts` and
  `race-manager.ts` (overlay type). Touches timekeeper pages, both overlay apps, leaderboard, and event
  config. Largest independent PR after #171. Also includes fixes for event selector store mutation,
  raceConfigPanel render loop, null guards, and SVG placeholder cleanup.
- All other independent PRs (#176–#182) are frontend-only, scripts-only, or overlay-only — zero conflict risk.
- **#187 (export/import tools)** adds a new `scripts/` directory with `drem_export.py`, `drem_import.py`,
  `drem_rebuild_stats.py`, and `scripts/drem_data/` package. Entirely new files — zero conflict risk with any
  other PR. Includes DDB and API export modes, Cognito user import with userId remapping, and a stats rebuild
  trigger. **Note:** when #171 (avatar) merges, the export/import tools will need updating to handle the new
  Cognito attributes (avatar config, highlight colour) and leaderboard fields.
- **#188 (TEST_EVENT type)** adds `TEST_EVENT` to the `TypeOfEvent` enum in `events-manager.ts` and a
  dropdown option in `eventDomain.ts`. Additive only — zero conflict risk. The stats engine (#196)
  already has the filter to exclude `TEST_EVENT` from computations and includes the same enum/dropdown
  change via a merge commit.
  **⚠ Data-model dependency:** Once #188 is deployed and any events are tagged with
  `typeOfEvent=TEST_EVENT` in DynamoDB, the `TEST_EVENT` enum value must remain present in every
  subsequently-deployed branch's `events-manager.ts`. Deploying a branch that doesn't include the
  enum value causes AppSync schema validation to reject those records on every `getEvents` query,
  which breaks the admin Events page entirely. Lesson learned during #196/#48 work — feat branches
  that pre-date #188 must either cherry-pick the enum addition or be rebased onto a main that
  contains it.
  **Note:** #186 (lap count) also touches `events-manager.ts` but in different sections (new enum + fields vs
  existing enum extension) — trivial rebase if both merge.
- **#195 (null trackId fix)** is a single-file Lambda fix in `lib/lambdas/leaderboard_api/index.py`. No
  overlap with any other PR. Safe to merge at any time.
- **#196 (stats engine + chart.js migration)** is the largest independent PR after #171. Adds a new CDK
  construct (`lib/constructs/statistics.ts`), two Python Lambdas (`lib/lambdas/stats_evb/`,
  `lib/lambdas/stats_api/`), new AppSync types (`GlobalStats`, `CountryStat`, etc.), a new `/stats`
  public route, and introduces **chart.js** as the charting library (pilot migration — the stats
  dashboard is the first page using it). Also exposes `raceTable`/`eventsTable` as public properties
  on `RaceManager`/`EventsManager` so the stats Lambda can read them without env-var lookups. Includes
  the TEST_EVENT commits via merge with #188 — see note above. No overlap with SSM chain or any other
  independent PR.
  **chart.js rationale:** the Highcharts-backed CloudScape charts require paid Highcharts licences per
  deployer, which is a non-starter for an Apache-2.0 AWS solutions-library project deployed commercially
  by third parties. chart.js is MIT-licensed and covers dual-axis, synced crosshairs, and real-time
  streaming for future telemetry features.
- **#197 (race results PDFs)** adds a new CDK construct (`lib/constructs/race-results-pdf.ts`), a
  container-image Lambda (`lib/lambdas/pdf_api/`) running WeasyPrint + Jinja templates, a `PdfJobsTable`
  DynamoDB table, new AppSync types (`PdfJob`, `PdfJobStatus`, `PdfType`), and a new frontend hook
  (`website/src/hooks/usePdfApi.ts`). Async job pattern matching DREM's existing car-upload/car-logs
  convention — mutation returns a jobId immediately, worker Lambda renders the PDF and writes terminal
  status back via an IAM-authed `updatePdfJob` mutation, which triggers an `onPdfJobUpdated`
  subscription the frontend is listening to. Consumed from the Race Admin page's `ButtonDropdown`.
  Also raises the CDK stack resource limit to 1000 via `@aws-cdk/core:stackResourceLimit` in
  `cdk.json` — CloudFormation's hard cap is 500 so the stack sits at 500 exactly after this PR.
  See #53 in the backlog for the long-term reduction plan.

---

## Merge Procedure (for each phase)

```bash
# 1. Fetch latest upstream
git fetch upstream

# 2. Create a release branch from main
git checkout main && git pull origin main
git checkout -b release/3.0.X

# 3. Merge the upstream PR branch (or cherry-pick the merge commit)
git merge upstream/pr-branch-name --no-ff

# 4. Resolve any conflicts, run tests
make test

# 5. Push and create PR against your fork's main
git push origin release/3.0.X
gh pr create --title "Release 3.0.X: <description>" --base main

# 6. After merge, tag the release
git checkout main && git pull origin main
git tag v3.0.X && git push origin v3.0.X

# 7. Deploy and verify before proceeding to next phase
```

---

## Conflict Risk Assessment

| File                                | Risk      | Notes                                                                 |
| ----------------------------------- | --------- | --------------------------------------------------------------------- |
| `lib/base-stack.ts`                 | 🟡 Medium | Modified in PRs 165, 166 — sequential merges should be clean          |
| `lib/cdk-pipeline-stack.ts`         | 🟡 Medium | Modified in PRs 165, 166, 168, 170 — may need trivial rebases        |
| `lib/drem-app-stack.ts`             | 🟡 Medium | Modified in PRs 165, 166, 168                                         |
| `lib/constructs/idp.ts`             | 🟢 Low    | Modified in #171, #172 (additive — new Cognito attributes)            |
| `lib/constructs/user-manager.ts`    | 🟢 Low    | Modified in #171 (avatar mutation), #184-roles (getUserRoles query)   |
| `website/src/App.tsx`               | 🟢 Low    | T&C removal in 164 (already merged)                                   |
| `website/public/locales/en/translation.json` | 🟢 Low | Modified by #171, #177, #178, #179, #180, #181 — additive, no conflicts |
| `Makefile`                          | 🟢 Low    | Modified by #170, #177 — different sections, no conflicts             |
| `website/src/components/topNav.tsx` | 🟢 Low    | Modified by #179 only                                                 |
| `*/Dockerfile`                      | 🟡 Medium | #184 changes base image; #171 adds `--legacy-peer-deps` — merge #184 first |
| `website/src/pages/timekeeper/pages/racePage*.tsx` | 🟡 Medium | Modified by #183 (layout) and #186 (lap count) — different sections but both touch timer/overlay publish code |
| `lib/constructs/events-manager.ts`    | 🟡 Medium | #186 (lap count enum), #188 (TEST_EVENT enum), #196 adds public `eventsTable` — all additive, trivial rebase if multiple merge |
| `lib/constructs/race-manager.ts`      | 🟡 Medium | #186 (overlay fields), #196 adds public `raceTable` — additive |
| `lib/lambdas/users_function/index.py` | 🟢 Low    | Modified by #185 (getUserRoles resolver) — additive |
| `scripts/`                              | 🟢 Low    | New directory in #187 — no overlap with any existing PR |
| `lib/constructs/statistics.ts`        | 🟢 Low    | New file in #196 |
| `lib/lambdas/stats_evb/`, `lib/lambdas/stats_api/` | 🟢 Low | New directories in #196 |
| `lib/lambdas/leaderboard_api/index.py` | 🟢 Low | Modified by #195 (null trackId fix) — single targeted change |
| `website/src/components/charts/`      | 🟢 Low    | New directory in #196 — chart.js wrappers |
| `website/src/pages/stats/`            | 🟢 Low    | New directory in #196 — /stats dashboard page |
| `lib/constructs/race-results-pdf.ts`  | 🟢 Low    | New file in #197 |
| `lib/lambdas/pdf_api/`                | 🟢 Low    | New directory in #197 — container-image Lambda |
| `website/src/hooks/usePdfApi.ts`      | 🟢 Low    | New file in #197 |
| `cdk.json`                            | 🟡 Medium | #197 adds `@aws-cdk/core:stackResourceLimit` context — trivial to merge with any concurrent cdk.json change |
| `website/src/admin/race-admin/raceAdmin.tsx` | 🟡 Medium | #197 adds PDF button dropdown; #181 (race admin track name + filter) also touches this file — different sections but both add UI |

---

## Notes

- Release 3.0.1 (PRs #167 + #164) is merged and deployed as `v3.0.1`.
- Release 3.0.2 (PR #165) is merged and deployed as `v3.0.2`.
- Release 3.0.3 (PRs #166 + #190) is merged and released as `v3.0.3` on 2026-04-24.
- Each SSM migration PR **must be deployed to the AWS account** before the next one is merged.
  This is a CloudFormation sequencing requirement, not just a code dependency.
- Fresh installations (no existing deployment) can safely apply all SSM PRs at once — the
  sequential requirement only applies to existing stacks with live `Fn::ImportValue` refs.
- Independent PRs (#170–#197) can be merged at any time without affecting the SSM migration.
  They are safe to merge before, during, or after the migration chain.
- **Merge order for independent PRs**: #184 (Docker node:20) should merge before #171 (avatar).
  All others have no ordering requirements.
- **#188 and #196 overlap**: #196 (stats engine) includes the TEST_EVENT enum commits from #188
  via a merge commit. Either PR can merge first — the other becomes a partial no-op on rebase.
- **Post-merge follow-up for #171 (avatar)**: update export/import tools (#187) to handle
  avatar config + highlight colour Cognito attributes and leaderboard fields.
- **Post-merge follow-up for #196 (stats)**: `/stats` route is currently behind the Cognito
  Authenticator wrapper. Phase 2 will make it publicly accessible (along with `/racer/:username`).
- **Post-merge follow-up for chart.js migration**: the stats dashboard is the pilot. Future chart
  additions (per-racer profile, live telemetry overlays, commentator panels) should follow the
  same pattern using the shared wrappers in `website/src/components/charts/`.
- **Post-merge follow-up for #197 (PDFs)**: once v3.0.4 lands (website consolidation removes ~25
  resources), re-measure the stack's CFN resource count and file the reduction plan for #53.
  Also worth considering white-labelling (#52) — the PDFs ship with hard-coded DeepRacer branding
  (logo + `#232F3E`/`#FF9900` palette) that admin users may want to override per event.
- **#183 and #186 both touch racePage*.tsx** — if both merge, the second will need a trivial rebase.
  They modify different sections (layout vs lap count logic) so conflicts are minor.
- If merging independent PRs to the fork's main for local development, merge them all at once
  to avoid repeated conflict resolution.
