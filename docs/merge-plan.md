# Upstream Merge Plan — SSM Cross-Stack Migration + Feature PRs

**Generated:** 2026-04-03
**Updated:** 2026-05-15
**Upstream:** `aws-solutions-library-samples/guidance-for-aws-deepracer-event-management`
**Fork:** `davidfsmith/guidance-for-aws-deepracer-event-management`

---

## Overview

The full SSM migration chain (PRs #164–#166, #200) and a wave of independent feature/fix PRs (#170–#197) have shipped upstream. Two fork PRs remain open and one feature branch is in flight. Everything historical is preserved in the **Reference** section below.

**Status (2026-05-15):** Massive merge wave landed today — 11 of my PRs in a single day, including the stats engine (#196) and race-results PDFs (#197). Fork main is at `1f08be87`. Two PRs remain open.

---

## Open work (current)

### Open PRs (2)

| PR | Title | Status |
|---|---|---|
| [#186](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/186) | feat: lap count based racing format | ⏳ Open, mergeable. Rebased onto upstream `1f08be87` 2026-05-15. Touches CDK schema + frontend + overlays. Adds `RaceEndCondition` enum and lap-count fields to `events-manager.ts` and `race-manager.ts`. |
| [#201](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/201) | feat: Pico W Galactic Unicorn race display with OTA updates [v2] | ⏳ Open, mergeable. Rebased onto upstream `1f08be87` 2026-05-15. 61 commits — recreated from #172 after the v3.0.4 consolidation. Hardware-dependent feature; deserves its own release window. |

### Active branches (not yet PR'd)

| Branch | Status |
|---|---|
| `feat/overlay-html-rebuild` (worktree at `/Users/davidsmith/Development/deepracer/drem-overlay-rebuild`) | Task #29 — HTML+CSS rebuild of overlays app, behind `?engine=html` feature flag. 12 commits, 33 vitest tests passing. Manual smoke test partly done 2026-05-12, parked 2026-05-15 with timer-interpolation fix committed. Next: finish smoke test, then open PR. Plan: `docs/superpowers/plans/2026-05-12-overlay-html-rebuild.md` on the branch. |

### Recent activity — 2026-05-15 merge wave

Steve merged 11 of my PRs in one day:

| PR | Title | Upstream commit |
|---|---|---|
| #177 | Data seed script (with RacerProfile generation) | `a747144` |
| #178 | Drag-and-drop model upload | `3f830ab` |
| #180 | CSV export of race data | `396e82f1` |
| #185 | Lazy-load user roles | `fd68ec6a` |
| #187 | DREM data export/import CLI tools | `09fdbbe` |
| #188 | TEST_EVENT + AWS_SUMMIT event types | `4595af42` |
| #206 | Remove `docs/superpowers/` from upstream | `0a6bb18` |
| #211 | Restore CodeBuild postinstall skip guard (#55 cleanup pt 1) | `1fde1a5` |
| #212 | Remove `website-leaderboard/` shim (#55 cleanup pt 2) | `2c69f28` |
| #196 | Stats engine + chart.js migration | `fde93249` |
| #197 | Race results PDFs (organiser/podium/cert) | `1f08be87` |

Plus upstream-only #169 (deps bump), #193 (pillow), #210 (Steven's sidenav memoisation fix).

### Follow-up actions (post-merge)

- **#188 + #196 shipped:** retag the ~30 AWS Summit events in prod manually, plus mark "Dry-Run"/"Setup" variants as TEST_EVENT — TEST wins where overlapping with summit. Then rebuild stats via `scripts/drem_rebuild_stats.py`.
- **#196 shipped:** turn on TEST_EVENT exclusion in the stats engine. `/stats` route is currently behind the Cognito Authenticator wrapper — needs public access for Phase 2 (along with `/racer/:username`). See `project_stats_public_routes.md`.
- **#197 shipped:** test PDF generation end-to-end on dev. Re-measure stack's CFN resource count for #53 reduction plan (we raised the cap to 1000 via `@aws-cdk/core:stackResourceLimit`; CloudFormation hard cap is 500 so stack sits at 500 exactly).
- **#171/#203 already shipped:** standalone overlays app still doesn't render avatars — picked up by task #29 (overlay rebuild in progress).
- **#200 backward-compat shims now removed via #211/#212:** v3.0.3a → v3.0.4 → v3.0.7 upgrade path no longer protected. Any deployment still on v3.0.3a would need to merge an intermediate release before pulling current main.

---

## Reference (merged + historical)

### Release history

| Release | Tag | PRs | What it did |
|---|---|---|---|
| 3.0.1 | `v3.0.1` | #167 + #164 | Test infrastructure + SSM parameters added, T&C frontend removed |
| 3.0.2 | `v3.0.2` (2026-04-17) | #165 | Switched infra stack to SSM, removed T&C CDK infrastructure, temporarily reversed pipeline ordering to break `Fn::ImportValue` deadlock |
| 3.0.3 | `v3.0.3` (2026-04-24) | #166 + #190 | Restored base-first pipeline ordering, NAG suppressions across codebase |
| 3.0.3a | (hotfix) | #198 | NAG suppression refactor on top of v3.0.3 |
| 3.0.4 | `v3.0.4` (2026-04-30, `5e94d3d`) | #200 (recreated from #168) | Consolidated three CloudFront distributions into one, single S3 bucket for all web assets, backward-compat shims for upgrade path. Both upgrade paths validated. |
| 3.0.5 | `v3.0.5` (2026-05-08) | #184 + #171 + #203 | Docker base → `node:20-alpine`, racer avatar + identity display, profile storage reworked to dedicated `RacerProfile` DDB table |
| 3.0.6 | `v3.0.6` (2026-05-11, `e7daf6b`) | #170 + #195 + #202 + #179 + #181 + #182 + #183 + #176 + #208 + upstream #199 | Tier 1 wave: configurable manual approval, null-trackId fix, Makefile tidy, dark mode, race-admin track filter, overlay alignment + gap-to-leader, timekeeper auto-status, leaderboard scroll-and-highlight, avatar vertical alignment, NAG fixes for Custom Certificate |
| (post-3.0.6 wave) | (not yet tagged) | #177 + #178 + #180 + #185 + #187 + #188 + #196 + #197 + #206 + #211 + #212 | 11 PRs merged 2026-05-15 — anticipate v3.0.7 |

### Pipeline self-mutation lessons (from v3.0.4 rollout)

The v3.0.4 release exposed a class of pipeline-stack bug worth documenting for future PRs that touch the synth buildspec or the build directory layout.

**Two upgrade paths a customer might follow.** Both must work for a release to be safely shipped.

| Path | What the customer does | What happens |
|---|---|---|
| **Path A** | Runs `make pipeline.deploy` from local | `cdk deploy` of the pipeline stack with the new template. CFN UPDATE applies the new CodeBuild buildspec immediately. Next pipeline run uses the new buildspec. |
| **Path B** | Merges the PR (or pulls the next release) and waits | Existing CodeBuild project still has the **old** buildspec. The poll-triggered run executes those old commands against the new source code. If the old commands fail on the new source, `cdk synth` never runs, `cdk.out` is never produced, and the pipeline cannot self-mutate. Stuck. |

Path B is the realistic customer experience — most users don't pull and run `cdk deploy` manually. Path A is what the maintainer uses during testing, and it bypasses the whole class of failure. **Local validation alone is not enough** — also walk through every command in the previous release's buildspec mentally against the new source tree, or actually exercise path B on a test account.

**Concrete failure on PR #200:**

- New source: postinstall gated by `$CODEBUILD_BUILD_ID` (skips on CodeBuild), `website-leaderboard/` directory renamed to `website/leaderboard/`.
- Old (v3.0.3a) buildspec: `npm install && npm test && cd website && npm test && cd .. && cd website-leaderboard && npm test && cdk synth`.
- Path B execution: `npm install` skips website deps → `cd website && npm test` fails ("vitest: command not found"). Even if that worked, `cd website-leaderboard` would fail (directory missing). `cdk.out` never produced. Pipeline stuck.

**Fix pattern: backward-compatibility shims** in the new source so the old buildspec still passes. They get ignored after self-mutation but they get the customer through path B.

For #200 specifically:
1. Drop `$CODEBUILD_BUILD_ID` skip from root postinstall + `|| true` per subdir.
2. Add `website-leaderboard/package.json` stub with a no-op test script.

Both shims have since been removed via #211 (postinstall guard restored 2026-05-15) and #212 (shim file deleted 2026-05-15).

**For future PRs that change the synth buildspec or directory layout**, ask: *if a customer's CodeBuild still has the previous release's buildspec, can each command in that previous buildspec succeed against my new source?* If not, add a shim or the customer's pipeline gets stuck.

### Recreation strategy for #168 + #172

#168 was successfully recreated as **#200** (`feat/consolidate-websites-v2`) on 2026-04-25.

After the initial rebase audit, #168 was attempted via cherry-pick onto v3.0.3a and produced **5 conflict files in a single commit** (`46c91aa Consolidate leaderboard and overlays into main website`):

| File | Conflict blocks | Notes |
|---|---|---|
| `Makefile` | 1 | New `local.build.*` targets — interrelated with `local.config` script-removal |
| `jest.config.js` | 1 | Compiled output vs plain JS; entangled with the unrelated `7dce3a1 Convert jest config to TypeScript` cleanup commit |
| `lib/cdk-pipeline-stack.ts` | 2 | Single-CloudFront restructure interleaves with v3.0.3a's `mainSiteDeployStep` extraction |
| `lib/drem-app-stack.ts` | 2 | Removes Leaderboard + StreamingOverlay constructs |
| `website/leaderboard/vitest.config.ts` | — | New file added |

These interrelated changes (Makefile build steps + script removals + CDK construct deletions + new vitest config) need to be applied together coherently. Surgical conflict resolution risks producing a synth-clean but feature-broken state.

**#172 (pico-display) had a hard dependency on #168** — pico modifies `website/leaderboard/src/components/raceInfoFooter.tsx` and `website/overlays/src/App.tsx`, which only exist after consolidation.

**Plan executed:**

1. ✅ **Deployed v3.0.3a as a fresh DREM environment** (2026-04-25) — clean baseline. Smoke-tested: login, event, fleet, racer, race — all green.
2. ✅ **Recreated #168 → #200** — fresh branch `feat/consolidate-websites-v2` off `upstream/main` (v3.0.3a), cherry-picked 9 feature commits in order. 3 were empty / no-ops. 6 commits applied with conflict resolution on `46c91aa`, `8fb9559`, `674e38e`. Final branch is 6 clean commits ahead of v3.0.3a; CDK synth passes; CDK assertion tests pass. Old #168 closed as superseded.
3. ✅ **Rebased #172 (now #201) onto v3.0.4** 2026-05-01. Used `git rebase --onto main d139764 feat/pico-display-v2 --empty=drop` to skip past the consolidate commits and replay only the pico work. 61 clean commits on `5e94d3d`. The two pipeline-fix commits (`bbd731b`, `dd58bb6`) auto-dropped during rebase as `patch contents already upstream`. CDK build + tests green.

**Key conflict resolutions in the v2 recreation** (for future reference):

| Commit | File | Resolution |
|---|---|---|
| `46c91aa` | `Makefile` | Took branch's new `local.build.*` targets |
| `46c91aa` | `jest.config.js` | Kept HEAD (plain JS) — branch's compiled-output was an artifact of unrelated `7dce3a1` jest-to-TS commit we didn't pick |
| `46c91aa` | `lib/cdk-pipeline-stack.ts` | Removed leaderboard/overlay outputs but kept `dremWebsiteUrl` and `appsyncId` (added to upstream after the branch fork) |
| `46c91aa` | `lib/drem-app-stack.ts` | Same pattern — removed leaderboard/overlay outputs, kept upstream-added `dremWebsiteUrl`/`appsyncId` and `this.appsyncId =` assignment |
| `46c91aa` | `website/leaderboard/vitest.config.ts` | File-location move from `website-leaderboard/` to `website/leaderboard/` — accepted both deletion of old and addition of new |
| `8fb9559` | `lib/cdk-pipeline-stack.ts` | Branch consolidates 3 deploy steps to 1 `WebsiteDeployToS3`; kept as `const websiteDeployStep` so v3.0.3a's `postDeployStep.addStepDependency()` keeps working |
| `674e38e` | `lib/cdk-pipeline-stack.ts` | Branch wanted `npm install --ignore-scripts` (drops tests); kept HEAD's tests, just fixed the stale `website-leaderboard` path to `website/leaderboard` |
| `e5d8b8e` | `jest.config.js` | Skipped (would have deleted the file; we kept the JS version since we didn't take the unrelated TS conversion) |

### Independent PRs — final state

These PRs had no dependencies on the SSM migration chain or on each other. They could be merged in any order at any time. All are now merged unless flagged in the **Open work** section above.

"Closes" column lists upstream issues each PR formally closed.

| PR | Title | Closes | Status |
|---|---|---|---|
| [#170](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/170) | feat(pipeline): make manual approval step configurable | — | ✅ Merged 2026-05-09 (`b47e82c`). Final rebase added `$(require_approval_arg)` to `pipeline.synth` / `pipeline.deploy` after #202's `$(CDK_CONTEXT)` extraction landed first. |
| [#171](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/171) + [#203](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/203) | feat: racer avatar, highlight colour, and identity display (RacerProfile DDB table) | — | ✅ Both merged. #171 merged 2026-05-04 (`14ba923`) with original Cognito-attr design; reworked via #203 (2026-05-08, `ad20c2e`) to a dedicated `RacerProfile` DDB table with live-join field resolvers on `LeaderBoardEntry.profile` and `Overlay.profile`. Spec/plan: `docs/superpowers/specs/2026-05-05-racer-profile-table-design.md`. |
| [#172](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/172) → [#201](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/201) | feat: Pico W race display [v2] | — | Recreated as #201 — **still open**, see top of doc. |
| [#176](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/176) | fix(leaderboard): scroll to and highlight racer when race submitted | [#40](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/40) | ✅ Merged 2026-05-10 (`944b919`). Bundled in Steve-flagged follow-ups: new-finisher overlay clear, back-to-top timer rescue at 60s, highlight overflow past leaderboard borders. |
| [#177](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/177) | feat: data seed script (now includes RacerProfile generation) | — | ✅ Merged 2026-05-15 (`a747144`). |
| [#178](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/178) | feat(models): drag and drop model upload using CloudScape FileUpload | [#38](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/38) | ✅ Merged 2026-05-15 (`3f830ab`). |
| [#179](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/179) | feat: dark mode and compact density toggle | [#36](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/36) | ✅ Merged 2026-05-10 (`bc9e28c`). |
| [#180](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/180) | feat(race-admin): CSV export of race data | — | ✅ Merged 2026-05-15 (`396e82f1`). |
| [#181](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/181) | fix(race-admin): show track name and enable track filter | [#41](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/41) | ✅ Merged 2026-05-10 (`0f33d6f`). |
| [#182](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/182) | fix(overlays): align numbers and show gap to leader | [#44](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/44), [#54](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/54) | ✅ Merged 2026-05-10 (`ad8eea4`). |
| [#183](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/183) | fix(timekeeper): auto timer status display and race page layout | [#60](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/60) | ✅ Merged 2026-05-10 (`18d6ece`). |
| [#184](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/184) | fix(docker): switch to node:20-alpine — node:22-alpine npm is broken | — | ✅ Merged 2026-05-03 (`f225bce`). |
| [#185](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/185) | fix: lazy-load user roles on admin users page | — | ✅ Merged 2026-05-15 (`fd68ec6a`). |
| [#186](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/186) | feat: lap count based racing format | — | ⏳ **Still open** — see top of doc. |
| [#187](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/187) | feat: DREM data export/import CLI tools | — | ✅ Merged 2026-05-15 (`09fdbbe`). |
| [#188](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/188) | feat(events): add TEST_EVENT and AWS_SUMMIT event types | — | ✅ Merged 2026-05-15 (`4595af42`). |
| [#195](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/195) | fix(leaderboard): handle null trackId in getLeaderboard resolver | [#194](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/194) | ✅ Merged 2026-05-09 (`94652e7`). |
| [#196](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/196) | feat(stats): racer and event statistics engine + chart.js migration | — | ✅ Merged 2026-05-15 (`fde93249`). |
| [#197](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/197) | feat: race results PDFs (organiser summary / podium / racer cert / bulk) | — | ✅ Merged 2026-05-15 (`1f08be87`). |
| [#199](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/199) | Fix NAGs for Custom Certificate | — | ✅ Merged 2026-05-10 (`d417299`) — upstream PR by Steve. |
| [#202](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/202) | chore: clean up v3.0.4 consolidation leftovers and tidy the Makefile | — | ✅ Merged 2026-05-09 (`20ba574`). |
| [#206](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/206) | chore: remove docs/superpowers from upstream | — | ✅ Merged 2026-05-15 (`0a6bb18`). |
| [#208](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/208) | fix(leaderboard): align avatars vertically for positions 4+ | [#207](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/207) | ✅ Merged 2026-05-11 (`e7daf6b`, v3.0.6 tag commit). |
| [#210](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/210) | fix(sidenav): memoize nav items to prevent expandable menus collapsing | — | ✅ Merged 2026-05-13 (`129c8546`) — Steven Askwith's fix. |
| [#211](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/211) | chore(pipeline): restore CodeBuild postinstall skip guard (#55 cleanup pt 1) | — | ✅ Merged 2026-05-15 (`1fde1a5`). |
| [#212](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/pull/212) | chore: remove v3.0.3a leaderboard shim (#55 cleanup pt 2) | — | ✅ Merged 2026-05-15 (`2c69f28`). |

### Conflict risk assessment (historical)

For reference — captured during the v3.0.3a audit and used to plan the merge order:

| File | Risk | Notes |
|---|---|---|
| `lib/base-stack.ts` | 🟡 Medium | Modified in PRs 165, 166 — sequential merges were clean |
| `lib/cdk-pipeline-stack.ts` | 🟡 Medium | Modified in PRs 165, 166, 168, 170 — needed trivial rebases |
| `lib/drem-app-stack.ts` | 🟡 Medium | Modified in PRs 165, 166, 168 |
| `lib/constructs/idp.ts` | 🟢 Low | Modified in #171, #172 (additive — new Cognito attributes) |
| `lib/constructs/user-manager.ts` | 🟢 Low | Modified in #171 (avatar mutation), #185 (getUserRoles query) |
| `website/src/App.tsx` | 🟢 Low | T&C removal in 164 (already merged) |
| `website/public/locales/en/translation.json` | 🟢 Low | Modified by #171, #177, #178, #179, #180, #181 — additive |
| `Makefile` | 🟢 Low | Modified by #170, #177 — different sections |
| `website/src/components/topNav.tsx` | 🟢 Low | Modified by #179 only |
| `*/Dockerfile` | 🟡 Medium | #184 changed base image; #171 added `--legacy-peer-deps` — merged #184 first |
| `website/src/pages/timekeeper/pages/racePage*.tsx` | 🟡 Medium | Modified by #183 (layout) and #186 (lap count) — different sections |
| `lib/constructs/events-manager.ts` | 🟡 Medium | #186 (lap count enum), #188 (TEST_EVENT enum), #196 adds public `eventsTable` — all additive |
| `lib/constructs/race-manager.ts` | 🟡 Medium | #186 (overlay fields), #196 adds public `raceTable` — additive |
| `lib/lambdas/users_function/index.py` | 🟢 Low | Modified by #185 (getUserRoles resolver) — additive |
| `scripts/` | 🟢 Low | New directory in #187 |
| `lib/constructs/statistics.ts` | 🟢 Low | New file in #196 |
| `lib/lambdas/stats_evb/`, `lib/lambdas/stats_api/` | 🟢 Low | New directories in #196 |
| `lib/lambdas/leaderboard_api/index.py` | 🟢 Low | Modified by #195 (null trackId fix) |
| `website/src/components/charts/` | 🟢 Low | New directory in #196 — chart.js wrappers |
| `website/src/pages/stats/` | 🟢 Low | New directory in #196 — `/stats` dashboard page |
| `lib/constructs/race-results-pdf.ts` | 🟢 Low | New file in #197 |
| `lib/lambdas/pdf_api/` | 🟢 Low | New directory in #197 — container-image Lambda |
| `website/src/hooks/usePdfApi.ts` | 🟢 Low | New file in #197 |
| `cdk.json` | 🟡 Medium | #197 added `@aws-cdk/core:stackResourceLimit` context |
| `website/src/admin/race-admin/raceAdmin.tsx` | 🟡 Medium | #197 added PDF button dropdown; #181 also touches this file — different sections |

### Merge procedure (template — for future PRs)

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

### Notes — historical

- **Pre-merge wave coordination:**
  - #184 (Docker node:20) was merged before #171 (avatar) so the `--legacy-peer-deps` line for avataaars sat cleanly on `node:20-alpine`.
  - #188 (TEST_EVENT) and #196 (stats engine) overlap — #196 included the TEST_EVENT commits via a merge commit. Whichever landed first made the other a partial no-op on rebase.
- **Data-model dependency from #188 (TEST_EVENT):** Once any events were tagged with `typeOfEvent=TEST_EVENT` in DynamoDB, the enum value had to remain present in every subsequently-deployed branch's `events-manager.ts`. Deploying a branch missing the enum value would cause AppSync schema validation to reject those records on every `getEvents` query. Lesson learned during #196/#48 work — feat branches that pre-dated #188 had to either cherry-pick the enum addition or rebase onto a main that contained it.
- **Post-merge follow-up for chart.js migration (#196):** the stats dashboard was the pilot. Future chart additions (per-racer profile, live telemetry overlays, commentator panels) should follow the same pattern using the shared wrappers in `website/src/components/charts/`.
- **Stats /stats route is currently behind Authenticator** — Phase 2 will make it publicly accessible (along with `/racer/:username`). See `project_stats_public_routes.md`.
- **Per-event branding decision (2026-05-10):** white-labelling scope is now per-event logo upload (organiser uploads on event create/edit, used on podium, cert, organiser summary PDFs and on the leaderboard / overlays for that event). Falls back to the DeepRacer logo when not set. See `project_white_labelling.md`.
- **Each SSM migration PR had to be deployed to the AWS account** before the next was merged — a CloudFormation sequencing requirement, not just a code dependency. Fresh installations could safely apply all SSM PRs at once.
- **#183 and #186 both touch racePage*.tsx** — if both merge (only #186 left open), the remaining one will need a trivial rebase against the merged sections.

---

> **BREAKING CHANGE — Sequential upgrade required for existing deployments (historical).**
> Users with an existing deployment had to apply PRs 1 → 2 → 3 → 4 **in order**, deploying each before merging the next. Skipping directly would have failed with an `Fn::ImportValue` deadlock. Fresh installations were unaffected. This requirement no longer applies post-v3.0.4 — all subsequent releases are non-sequential.
