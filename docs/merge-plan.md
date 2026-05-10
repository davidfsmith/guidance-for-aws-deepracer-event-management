# Upstream Merge Plan — SSM Cross-Stack Migration + Feature PRs

**Generated:** 2026-04-03
**Updated:** 2026-05-10
**Upstream:** `aws-solutions-library-samples/guidance-for-aws-deepracer-event-management`
**Fork:** `davidfsmith/guidance-for-aws-deepracer-event-management`

---

## Overview

Four upstream PRs (#164–#166, #168→#200) formed a sequential migration that eliminated
`Fn::ImportValue` cross-stack dependencies, removed the Terms & Conditions feature, and
consolidated websites into a single CloudFront distribution. A fifth PR (#167) added test
infrastructure and was independent of the migration series.

Additionally, 20+ independent feature/fix PRs (#170–#197) can be merged at any time —
they have no dependencies on the SSM migration chain or on each other (a few light ordering
notes are called out below).

**Status (2026-05-10):** **The full SSM migration chain is merged.** v3.0.1, v3.0.2, v3.0.3,
v3.0.3a, v3.0.4, and v3.0.5 are all upstream. The Tier 1 quick-win batch (#170, #195, #202)
has now landed on top of v3.0.5 (not yet tagged). The 16 remaining fork PRs are all rebased
onto current main, mergeable, and waiting for review. PR #197 (race results PDFs) is now
out of draft after a long polish pass; #201 (pico-display-v2) was rebased today (61 commits,
single Makefile section-header conflict).

**Recent merges (chronological since v3.0.4):**

- 2026-05-03: #184 (Docker node:20-alpine fix) → `f225bce`
- 2026-05-04: #171 (racer avatar + identity, original Cognito-attr design) → `14ba923`
- 2026-05-08: #203 (RacerProfile DDB rework — replaces Cognito-attr storage) → `ad20c2e`
- (these three are released as **v3.0.5**)
- 2026-05-09: #200 (this was always v3.0.4 — listed for completeness above)
- 2026-05-09: #202 (Makefile cleanup + `make help` polish) → `20ba574`
- 2026-05-09: #195 (null-trackId leaderboard fix) → `94652e7`
- 2026-05-09: #170 (configurable manual approval) → `b47e82c`
- (#202, #195, #170 are post-v3.0.5; not yet tagged in a release)

**v3.0.3a-readiness audit (2026-04-25):** All 20 fork PRs were originally audited against
`upstream/main` at v3.0.3a. Results below capture that initial snapshot. **Subsequently
(2026-05-02) all PRs were rebased onto v3.0.4** — see the per-PR Status column further
down for the current commit SHA per branch.

| Outcome (as of audit)          | Count | PRs                                                              |
| ------------------------------ | ----- | ---------------------------------------------------------------- |
| ✅ Already on v3.0.3a            | 11    | #176, #177, #178, #179, #180, #181, #182, #183, #184, #185, #186 |
| ✅ Rebased + force-pushed clean  | 5     | #187, #188, #195, #196, #197                                     |
| ✅ Manual conflict resolved      | 2     | #170 (`Makefile` — kept `$(require_approval_arg)` injection), #171 (`lib/cdk-pipeline-stack.ts` — kept upstream's extracted-step refactor + branch's `--legacy-peer-deps`) |
| ✅ Recreated as fresh PR         | 2     | #168 → **#200** ✅ Merged in v3.0.4 (2026-04-30, commit `5e94d3d`). Originally 6 commits + 2 follow-up fixes on top of v3.0.3a; required two backward-compat shims (`dd58bb6`) after a customer hit the path-B upgrade failure (see §Pipeline self-mutation lessons below).<br>#172 → **#201** (`feat/pico-display-v2`, 61 clean commits on top of v3.0.4 after rebase 2026-05-01; old #172 closed as superseded) |

---

## Tier 1 quick wins — partial release (2026-05-09 / 2026-05-10)

First wave landed on 2026-05-09:

| PR | Title | Closes | Status |
|---|---|---|---|
| [#170](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/170) | feat(pipeline): make manual approval step configurable | — | ✅ **Merged** 2026-05-09 (`b47e82c`) |
| [#195](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/195) | fix(leaderboard): handle null trackId in getLeaderboard resolver | [#194](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/194) | ✅ **Merged** 2026-05-09 (`94652e7`) |
| [#202](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/202) | chore: clean up v3.0.4 consolidation leftovers and tidy the Makefile | — | ✅ **Merged** 2026-05-09 (`20ba574`) |

Second wave landed on 2026-05-10:

| PR | Title | Closes | Status |
|---|---|---|---|
| [#179](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/179) | feat: dark mode and compact density toggle | [#36](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/36) | ✅ **Merged** 2026-05-10 (`bc9e28c`) |
| [#181](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/181) | fix(race-admin): show track name and enable track filter | [#41](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/41) | ✅ **Merged** 2026-05-10 (`0f33d6f`) |
| [#182](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/182) | fix(overlays): align numbers and show gap to leader | [#44](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/44), [#54](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/54) | ✅ **Merged** 2026-05-10 (`ad8eea4`) |
| [#183](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/183) | fix(timekeeper): auto timer status display and race page layout | [#60](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/60) | ✅ **Merged** 2026-05-10 (`18d6ece`) |
| [#176](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/176) | fix(leaderboard): scroll to and highlight racer when race submitted | [#40](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/40) | ✅ **Merged** 2026-05-10 (`944b919`) — Steve-flagged follow-ups bundled in: new-finisher overlay clear of bottom entry (`805c96c` + `b97e9db`), back-to-top timer rescue at 60s (`2195e02`), highlight overflow past leaderboard borders (`8a92177`) |
| [#199](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/199) | Fix NAGs for Custom Certificate | — | ✅ **Merged** 2026-05-10 (`d417299`) — upstream PR by Steve, not in fork backlog |

The remaining four still-open Tier 1 PRs are listed below — all rebased onto post-#170
main, mergeable, no schema/CFN-resource changes:

| PR | Title | Closes | Surface |
|---|---|---|---|
| [#185](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/185) | fix: lazy-load user roles on admin users page | — | Lambda + CDK + frontend; additive |
| [#178](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/178) | feat(models): drag and drop model upload using CloudScape FileUpload | [#38](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/38) | Single component swap |
| [#180](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/180) | feat(race-admin): CSV export of race data | — | New export utility + button |
| [#177](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/177) | feat: data seed script for populating dev environments | — | New `scripts/seed.py` + Makefile targets |

**Why these are still safe to ship together:**

- **Zero overlap between PRs** — every one of them touches a different file or concern. No coordination cost.
- **All on ✅ Mergeable status** post-rebase against current main (2026-05-10).
- **Issues closed:** six remaining upstream issues (#36, #38, #40, #41, #44, #54, #60) clear in this batch.
- **No schema changes** — none of these touch AppSync types, DynamoDB tables, or Cognito attributes. No codegen refresh required for any consumer.
- **No CFN-resource removal** — pure additive or in-place edits.

**Held back from this batch (but worth knowing):**

- [#201](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/201) (pico W display v2) — large, hardware-dependent feature; deserves its own release window. Rebased 2026-05-10 onto post-#170 main (61 commits, single Makefile section-header conflict resolved by giving pico its own `##@ Pico display` section).
- [#186](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/186), [#187](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/187), [#188](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/188), [#196](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/196), [#197](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/197) — Tier 3 features; touch shared schema or large new constructs. Plan a separate release after Tier 1 finishes.
- #197 (race results PDFs) is now ready for review after a polish pass on the cert + podium templates (avatar+flag rendering, layout robustness on the WeasyPrint Lambda runtime).

---

**Notable findings from the audit:**

- No PR conflicts with the v3.0.3a NAG-suppression refactor in `lib/drem-app-stack.ts` — git
  auto-merges those hunks because #198 only moved per-resource suppressions to stack-level,
  which doesn't overlap with where my PRs add their construct instantiations.
- The earlier prediction of `tsconfig.json` conflicts on #168/#172 was wrong — they hit
  `CLAUDE.md` first. They likely have the tsconfig conflict further along the rebase too,
  but that surfaces only after skipping the fork-only `CLAUDE.md` adds.
- The earlier prediction of `bin/drem.ts` conflicts on #170/#171 was also misleading — once
  resolved, the actual files in conflict were `Makefile` and `lib/cdk-pipeline-stack.ts`
  respectively.

### Recreation strategy for #168 + #172

#168 was successfully recreated as **#200** (`feat/consolidate-websites-v2`) on 2026-04-25.
Process documented below for future reference.

After the initial rebase audit, #168 (consolidate-websites) was attempted via cherry-pick
onto v3.0.3a and produced **5 conflict files in a single commit** (`46c91aa Consolidate
leaderboard and overlays into main website`):

| File | Conflict blocks | Notes |
|---|---|---|
| `Makefile` | 1 | New `local.build.*` targets — interrelated with `local.config` script-removal |
| `jest.config.js` | 1 | Compiled output vs plain JS; entangled with the unrelated `7dce3a1 Convert jest config to TypeScript` cleanup commit |
| `lib/cdk-pipeline-stack.ts` | 2 | Single-CloudFront restructure interleaves with v3.0.3a's `mainSiteDeployStep` extraction |
| `lib/drem-app-stack.ts` | 2 | Removes Leaderboard + StreamingOverlay constructs |
| `website/leaderboard/vitest.config.ts` | — | New file added |

These are interrelated changes (Makefile build steps + script removals + CDK construct
deletions + new vitest config) that need to be applied together coherently. Surgical
conflict resolution risks producing a synth-clean but feature-broken state.

**#172 (pico-display) has a hard dependency on #168** — pico modifies
`website/leaderboard/src/components/raceInfoFooter.tsx` and `website/overlays/src/App.tsx`,
which only exist after consolidation.

**Plan executed:**

1. ✅ **Deployed v3.0.3a as a fresh DREM environment** (2026-04-25) — clean baseline.
   Smoke-tested: login, event, fleet, racer, race — all green.
2. ✅ **Recreated #168 → #200** — fresh branch `feat/consolidate-websites-v2` off
   `upstream/main` (v3.0.3a), cherry-picked the 9 feature commits in order. 3 were
   empty / no-ops (already in v3.0.3a). 6 commits applied with conflict resolution
   on `46c91aa`, `8fb9559`, `674e38e`. Final branch is 6 clean commits ahead of
   v3.0.3a; CDK synth passes; CDK assertion tests pass (5/5). Old #168 closed as
   superseded.
3. ✅ **Done — rebased #172 (now #201) onto v3.0.4** on 2026-05-01, the day after #200
   shipped as `5e94d3d`. Used `git rebase --onto main d139764 feat/pico-display-v2 --empty=drop`
   to skip past the consolidate commits and replay only the pico work. 61 clean commits
   on `5e94d3d`. The two pipeline-fix commits (`bbd731b` move-website-tests-out-of-synth,
   `dd58bb6` backward-compat shims) auto-dropped during rebase as `patch contents already
   upstream`. Force-pushed with lease. CDK build + tests green. The earlier prediction was
   correct: pico commits replayed cleanly, no manual conflict resolution needed. Backup
   branch `backup/pico-display-v2-pre-rebase` retained locally.

**Key conflict resolutions in the v2 recreation** (for future reference):

| Commit | File | Resolution |
|---|---|---|
| `46c91aa` | `Makefile` | Took branch's new `local.build.*` targets |
| `46c91aa` | `jest.config.js` | Kept HEAD (plain JS) — branch's compiled-output was an artifact of the unrelated `7dce3a1` jest-to-TS commit which we didn't pick |
| `46c91aa` | `lib/cdk-pipeline-stack.ts` | Removed leaderboard/overlay outputs but kept `dremWebsiteUrl` and `appsyncId` (added to upstream after the branch fork) |
| `46c91aa` | `lib/drem-app-stack.ts` | Same pattern — removed leaderboard/overlay outputs + cwRumLeaderboardAppMonitor outputs, kept the upstream-added `dremWebsiteUrl`/`appsyncId` and the `this.appsyncId =` assignment |
| `46c91aa` | `website/leaderboard/vitest.config.ts` | File-location move from `website-leaderboard/` to `website/leaderboard/` — accepted both deletion of old and addition of new |
| `8fb9559` | `lib/cdk-pipeline-stack.ts` | Branch consolidates 3 deploy steps to 1 `WebsiteDeployToS3`; kept it as a `const websiteDeployStep` so v3.0.3a's `postDeployStep.addStepDependency()` keeps working |
| `674e38e` | `lib/cdk-pipeline-stack.ts` | Branch wanted `npm install --ignore-scripts` (drops tests); kept HEAD's tests, just fixed the stale `website-leaderboard` path to `website/leaderboard` |
| `e5d8b8e` | `jest.config.js` | Skipped (would have deleted the file; we kept the JS version since we didn't take the unrelated TS conversion) |

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
| **PR**           | [#200](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/200) (replaces closed-as-superseded [#168](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/168)) |
| **Title**        | Consolidate leaderboard and overlays into single CloudFront distribution (PR 4 of 4) [v2]                                                                                                                                                                  |
| **Dependencies** | Releases 3.0.1, 3.0.2, and 3.0.3a must be deployed first                                                                                                                                                                                                  |
| **Status**       | ✅ Merged — 2026-04-30 (squash-merge `5e94d3d`). Path-A (local `cdk deploy`) validated 2026-04-26. Path-B (PR-merge + GitHub poll) failed initially because the v3.0.3a buildspec is baked into CodeBuild and ran against the new source — fixed via two backward-compat shims in `dd58bb6` (root postinstall + `website-leaderboard/package.json` stub). See **Pipeline self-mutation lessons** below. |
| **What it does** | • Consolidates three separate website CloudFront distributions (main, leaderboard, stream-overlays) into one<br>• Single S3 bucket for all web assets<br>• Leaderboard and overlays built into `website/public/` subdirectories during pipeline<br>• `WebsiteTests` separated from synth so directory restructures can't block self-mutation<br>• Backward-compat shims so v3.0.3a → v3.0.4 self-mutates cleanly via either upgrade path |
| **Key files**    | `lib/cdk-pipeline-stack.ts`, `lib/drem-app-stack.ts`, `lib/base-stack.ts`, `compose.yaml`, `Makefile`, website build scripts, `package.json` (postinstall), `website-leaderboard/package.json` (shim)                                                                                                                  |
| **Tag**          | `v3.0.4`                                                                                                                                                                                                                                       |

---

### Release 3.0.5: Docker base + Racer Avatar / Identity Display ✅ MERGED

| Item             | Detail                                                                                                                                                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PRs**          | [#184](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/184) + [#171](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/171) + [#203](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/203) |
| **Titles**       | #184: switch Docker base image to `node:20-alpine` (npm broken in `node:22-alpine`)<br>#171: racer avatar, highlight colour, and identity display<br>#203: rework profile storage to dedicated `RacerProfile` DDB table                                              |
| **Dependencies** | Release 3.0.4 must be deployed first                                                                                                                                                                                                                                   |
| **Status**       | ✅ Merged — 2026-05-03 (#184 `f225bce`), 2026-05-04 (#171 `14ba923`), 2026-05-08 (#203 `ad20c2e`). Tagged `v3.0.5`.                                                                                                                                                    |
| **What it does** | • Stops the broken-npm bug in `node:22-alpine` from blocking pipeline image builds<br>• Adds a circular avataaars-driven avatar + a highlight colour + country code per racer, surfaced on the timekeeper, leaderboard, stream overlays, and racer profile page<br>• #203 immediately replaces the original Cognito-attribute storage with a dedicated `RacerProfile` DDB table accessed via AppSync direct-DDB JS resolvers, with field resolvers on `LeaderBoardEntry.profile` and `Overlay.profile` so leaderboard/overlay reads always reflect the latest profile (no staleness) |
| **Key files**    | `lib/constructs/idp.ts` (kept `custom:countryCode`, dropped avatar/highlight); new `lib/constructs/racer-profile.ts`; `lib/constructs/leaderboard.ts` (added `profile: RacerProfile` field + pipeline resolver); `lib/lambdas/leaderboard_entry_evb/index.py`; `website/src/admin/user-profile/AvatarBuilder.tsx`; `website/src/components/AvatarDisplay.tsx`; `website/src/hooks/useAuth.ts` (switched source to `getRacerProfile`) |
| **Tag**          | `v3.0.5`                                                                                                                                                                                                                                                                |

**Outstanding follow-up:** standalone overlays app (`website/overlays/`) still doesn't render avatars; deferred to task #29 (overlay redesign moves to HTML+CSS).

---

### Release 3.0.6 (next): Tier 1 quick wins — partial release ⏳ IN FLIGHT

| Item             | Detail                                                                                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PRs merged**   | First wave 2026-05-09: [#170](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/170) (configurable manual approval) + [#195](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/195) (null-trackId fix) + [#202](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/202) (Makefile cleanup). Second wave 2026-05-10: [#179](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/179) (dark mode) + [#181](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/181) (race admin track filter) + [#182](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/182) (overlay alignment + gap) + [#183](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/183) (timekeeper auto timer status) + [#176](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/176) (leaderboard scroll + highlight). Plus upstream-only [#199](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/199) (Fix NAGs for Custom Certificate, by Steve).                                                                                                                                                                              |
| **Status**       | ✅ All nine merged (`b47e82c`, `94652e7`, `20ba574`, `bc9e28c`, `0f33d6f`, `ad8eea4`, `18d6ece`, `944b919`, `d417299`); not yet tagged                                                                                                                                                                  |
| **Still open**   | Four more Tier 1 PRs (#177, #178, #180, #185) — all rebased onto post-#170 main and ready for review                                                                                                                                                                                                   |
| **What it does** | Once everything in this tier merges, the release will close upstream issue #38 (already-resolved upstream issues #36, #40, #41, #44, #54, #60, #194 cleared in waves above).                                                                                                                           |

---

## Pipeline self-mutation lessons (from v3.0.4 rollout)

The v3.0.4 release exposed a class of pipeline-stack bug worth documenting for future PRs that
touch the synth buildspec or the build directory layout.

**There are two upgrade paths a customer might follow.** Both must work for a release to be
safely shipped.

| Path | What the customer does | What happens |
|---|---|---|
| **Path A** | Runs `make pipeline.deploy` from local | `cdk deploy` of the pipeline stack with the new template. CFN UPDATE applies the new CodeBuild buildspec immediately. Next pipeline run uses the new buildspec. |
| **Path B** | Merges the PR (or pulls the next release) and waits | Existing CodeBuild project still has the **old** buildspec. The poll-triggered run executes those old commands against the new source code. If the old commands fail on the new source, `cdk synth` never runs, `cdk.out` is never produced, and the pipeline cannot self-mutate. Stuck. |

Path B is the realistic customer experience — most users don't pull and run `cdk deploy`
manually. Path A is what the maintainer uses during testing, and it bypasses the whole
class of failure. **Local validation alone is not enough** — also walk through every command
in the previous release's buildspec mentally against the new source tree, or actually exercise
path B on a test account.

**Concrete failure on PR #200:**

- New source: postinstall gated by `$CODEBUILD_BUILD_ID` (skips on CodeBuild), `website-leaderboard/`
  directory renamed to `website/leaderboard/`.
- Old (v3.0.3a) buildspec: `npm install && npm test && cd website && npm test && cd .. &&
  cd website-leaderboard && npm test && cdk synth`.
- Path B execution: `npm install` skips website deps → `cd website && npm test` fails ("vitest:
  command not found"). Even if that worked, `cd website-leaderboard` would fail (directory
  missing). `cdk.out` never produced. Pipeline stuck.

**Fix pattern: backward-compatibility shims** in the new source so the old buildspec still
passes. They get ignored after self-mutation but they get the customer through path B.

For #200 specifically:
1. Drop `$CODEBUILD_BUILD_ID` skip from root postinstall + `|| true` per subdir.
2. Add `website-leaderboard/package.json` stub with a no-op test script.

**Cleanup task #55** in the backlog tracks removal of these shims in a future release once we're
confident no v3.0.3a deployments remain.

**For future PRs that change the synth buildspec or directory layout**, ask: *if a customer's
CodeBuild still has the previous release's buildspec, can each command in that previous
buildspec succeed against my new source?* If not, add a shim or the customer's pipeline gets
stuck.

---

## Independent Feature/Fix PRs

These PRs have **no dependencies** on the SSM migration chain or on each other. They can be
merged in any order at any time.

"Closes" column lists the upstream issue(s) the PR formally closes (`closes #N` / `fixes #N`
keywords picked up by GitHub). Where blank, the PR doesn't have a tracked issue — most are
fork-originated improvements that pre-date issue tracking on the upstream repo.

| PR | Title | Closes | Dependencies | Status |
|---|---|---|---|---|
| [#170](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/170) | feat(pipeline): make manual approval step configurable | — | None | ✅ **Merged 2026-05-09** as upstream commit `b47e82c`. Final rebase added `$(require_approval_arg)` to `pipeline.synth` / `pipeline.deploy` after #202's `$(CDK_CONTEXT)` extraction landed first. |
| [#171](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/171) + [#203](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/203) | feat: racer avatar, highlight colour, and identity display (RacerProfile DDB table) | — | None | ✅ **Both merged.** #171 merged 2026-05-04 (`14ba923`) with the original Cognito-attr design. Architecture reworked afterward — Cognito attrs replaced by dedicated `RacerProfile` DDB table with live-join field resolvers on `LeaderBoardEntry.profile` and `Overlay.profile` — because Steve flagged the staleness problem with the snapshot model and Cognito's per-pool attribute limits. Spec/plan: `docs/superpowers/specs/2026-05-05-racer-profile-table-design.md` + `docs/superpowers/plans/2026-05-05-racer-profile-table.md`. Steve's UX work (silhouette `AvatarDisplay`, neutral default, mini avatar in top nav, preview in collapsed header) preserved end-to-end. **#203 merged 2026-05-08** (`ad20c2e`). Both released as part of v3.0.5. Standalone overlays app (`website/overlays/`) avatar render still deferred to task #29 (overlay redesign moves to HTML+CSS). |
| [#172](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/172) → [#201](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/201) | feat: Pico W Galactic Unicorn race display with OTA updates [v2] | — | Was hard-dep on #200 — now landed in v3.0.4 | ✅ Rebased onto post-#170 main 2026-05-10 (61 commits, single Makefile section-header conflict — pico's `pico.sync` / `pico.test` targets clashed with #202's new `##@`-style sections; resolved by giving pico its own `##@ Pico display` section above `##@ Misc`). Force-pushed `953f3f2`. |
| [#176](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/176) | fix(leaderboard): scroll to and highlight racer when race submitted | [#40](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/40) | None (leaderboard frontend only) | ✅ Rebased on post-#170 main 2026-05-10 — clean fast-forward; was previously on v3.0.4 2026-05-02 (`76f6f7c`) — git auto-followed rename to `website/leaderboard/` |
| [#177](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/177) | feat: data seed script for populating dev environments with test data | — | None (new `scripts/seed.py` + Makefile targets) | ✅ Rebased on post-#170 main 2026-05-10 — clean fast-forward; was previously on v3.0.4 2026-05-02 (`9b5f9da`) — clean fast-forward |
| [#178](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/178) | feat(models): drag and drop model upload using CloudScape FileUpload | [#38](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/38) | None (single component swap) | ✅ Rebased on post-#170 main 2026-05-10 — clean fast-forward; was previously on v3.0.4 2026-05-02 (`1d4b019`) — clean fast-forward |
| [#179](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/179) | feat: dark mode and compact density toggle | [#36](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/36) | None (topNav + CSS only) | ✅ **Merged 2026-05-10** as upstream commit `bc9e28c` |
| [#180](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/180) | feat(race-admin): CSV export of race data | — | None (new export utility + button) | ✅ Rebased on post-#170 main 2026-05-10 — clean fast-forward; was previously on v3.0.4 2026-05-02 (`39f9ef0`) — clean fast-forward |
| [#181](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/181) | fix(race-admin): show track name and enable track filter | [#41](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/41) | None (race admin frontend only) | ✅ **Merged 2026-05-10** as upstream commit `0f33d6f` |
| [#182](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/182) | fix(overlays): align numbers and show gap to leader | [#44](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/44), [#54](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/54) | None (stream overlays SVG + JS only) | ✅ **Merged 2026-05-10** as upstream commit `ad8eea4` (Steve picked up the alignment + gap-to-leader visibility fixes after our `a88aecc` test branch was deployed) |
| [#183](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/183) | fix(timekeeper): auto timer status display and race page layout | [#60](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/60) | None (timekeeper frontend + laps table config) | ✅ **Merged 2026-05-10** as upstream commit `18d6ece` |
| [#184](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/184) | fix(docker): switch to node:20-alpine — node:22-alpine npm is broken | — | None (single Dockerfile after v3.0.4 consolidation) | ✅ **Merged 2026-05-03** as upstream commit `f225bce` |
| [#185](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/185) | fix: lazy-load user roles on admin users page | — | None (Lambda + CDK + frontend) | ✅ Rebased on post-#170 main 2026-05-10 — clean fast-forward; was previously on v3.0.4 2026-05-02 (`30a7711`) — clean fast-forward |
| [#186](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/186) | feat: lap count based racing format | — | None (CDK schema + frontend + overlays) | ✅ Rebased on post-#170 main 2026-05-10 — clean fast-forward; was previously on v3.0.4 2026-05-02 (`5c906ac`) — single conflict on a stale codegen `website/leaderboard/src/graphql/subscriptions.js` artefact (the `.ts` is the source of truth); deleted, no functional change |
| [#187](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/187) | feat: DREM data export/import CLI tools | — | None (new `scripts/` directory + `scripts/drem_data/` package) | ✅ Rebased on post-#170 main 2026-05-10 — clean fast-forward; was previously on v3.0.4 2026-05-02 (`9f656e4`) — clean fast-forward |
| [#188](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/188) | feat(events): add TEST_EVENT type | — | None (additive enum value + frontend dropdown + i18n) | ✅ Rebased on post-#170 main 2026-05-10 — clean fast-forward; was previously on v3.0.4 2026-05-02 (`4fd4601`) — clean fast-forward |
| [#195](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/195) | fix(leaderboard): handle null trackId in getLeaderboard resolver | [#194](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/194) | None (Lambda-only fix) | ✅ **Merged 2026-05-09** as upstream commit `94652e7` |
| [#196](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/196) | feat(stats): racer and event statistics engine + chart.js migration | — | None on SSM chain. Overlaps with #188 — contains the TEST_EVENT commits via merge, so whichever lands first makes the other a partial no-op on rebase | ✅ Rebased on post-#170 main 2026-05-10 — clean fast-forward; was previously on v3.0.4 2026-05-02 (`6a9aaeb`) — single conflict on `lib/drem-app-stack.ts`: dropped the (now-removed) `StreamingOverlay` import, kept the new `Statistics` import |
| [#197](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/197) | feat: race results PDFs (organiser summary / podium / racer cert / bulk) | — | None. Self-contained: new CDK construct, new container-image Lambdas, new frontend hook. Backlog task #48 | ✅ Rebased on post-#170 main 2026-05-10 — clean fast-forward. **Out of draft 2026-05-10** after a long polish pass on the Lambda-side PDF rendering: rasterised avataaars + silhouette via CairoSVG → PNG data URIs (WeasyPrint 62.3 mishandled the avataaars masks and the inline silhouette SVG); added country flags via flagcdn.com with in-process caching; instant flash message on Download click (placeholder while the ~5s mutate resolves); per-event highlight colour applied as both the cert/podium border and the bottom-of-stack stripe. |

### Notes on independent PRs

- **#184 (Docker node:20)** ✅ merged 2026-05-03 — was a prerequisite for #171 (avatar). #171 has been
  rebased on top of the merged #184 and pushed; the `--legacy-peer-deps` line for avataaars now sits
  cleanly on the node:20-alpine base.
- **#171 (avatar)** touches `lib/constructs/idp.ts` (adds Cognito attributes), `lib/constructs/user-manager.ts`,
  `lib/constructs/leaderboard.ts`, `lib/constructs/race-manager.ts`, and multiple Lambdas. It's the largest
  independent PR but has no CDK cross-stack changes that conflict with the SSM migration. Depends on #184 for
  the Dockerfile base image fix.
- **#172 → #201 (pico display)**: the original #172 included a workaround commit (`e7e9c48`) adding
  Cognito attributes to `idp.ts` to match the deployed stack. The v2 recreation (#201) was rebuilt from
  scratch and **does not** include this commit — Steve flagged it for removal post-#171, but it's already
  absent. No action needed when #171 lands.
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
- Release 3.0.3a (PR #198, NAG suppression refactor hotfix) shipped on top of `v3.0.3`.
- Release 3.0.4 (PR #200) is merged and released as `v3.0.4` on 2026-04-30 (commit `5e94d3d`).
  Includes both the website consolidation and two backward-compat shims for the v3.0.3a → v3.0.4
  upgrade path. **The full SSM migration chain is now upstream.**
- Release 3.0.5 (#184 + #171 + #203) tagged on top of `v3.0.4`. Combines the Docker base image
  fix and the racer-avatar / RacerProfile DDB rework. #184 unblocked image builds; #171 introduced
  avatar + highlight + country code; #203 immediately re-architected storage from Cognito attrs
  to a dedicated DDB table after Steve flagged staleness on the snapshot model.
- Tier 1 partial release in flight (next tag, currently un-tagged): #170 + #195 + #202 merged
  2026-05-09, sitting on top of `v3.0.5` in upstream main. Nine more Tier 1 PRs are mergeable
  and waiting for review.
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
- **Post-merge follow-up for #197 (PDFs)**: now actionable — v3.0.4 is upstream, so the website
  consolidation has removed ~25 resources from the stack. Re-measure the stack's CFN resource count
  and file the reduction plan for #53. Per-event branding decision (2026-05-10): white-labelling
  scope is now **per-event logo upload** (organiser uploads on event create/edit, used on podium,
  cert, organiser summary PDFs and on the leaderboard / overlays for that event). Falls back to
  the DeepRacer logo when not set. See `project_white_labelling.md` for the design notes; not yet
  numbered on the backlog.
- **Post-merge follow-up for #200 (consolidation)**: backward-compat shims need removing in a
  future release once we're confident no v3.0.3a deployments remain — see backlog task #55.
  Earliest target is roughly v3.0.6.
- **Post-v3.0.4 unblocks pipeline optimisation (task #50)**: the build structure is now stable,
  so optimisation work can start. See `project_pipeline_optimisation.md` for area list.
- **#183 and #186 both touch racePage*.tsx** — if both merge, the second will need a trivial rebase.
  They modify different sections (layout vs lap count logic) so conflicts are minor.
- If merging independent PRs to the fork's main for local development, merge them all at once
  to avoid repeated conflict resolution.
