# Lap Count Based Racing Format — Design Spec

## Goal

Add a lap-count-based racing format as an alternative to the existing time-based format. Used primarily for event finals where racers get a fixed number of laps (e.g. 3) to set their fastest single lap time. Ranking is still by fastest lap — the only change is how the race ends.

## Context

At events, finals are often decided by giving each racer a fixed number of laps rather than a timed race. Currently DREM only supports time-based races (e.g. 2 minutes), so organisers have no way to enforce a lap limit. This feature fills that gap.

## Event Configuration

### Existing fields (unchanged)
- **Ranking method**: `BEST_LAP_TIME` | `BEST_AVERAGE_LAP_TIME_X_LAP`
- **Race time in minutes**: 1, 2, 3, 4 (used when race type = `Time based`)
- **Average laps window**: 3, 5 (used when ranking = `BEST_AVERAGE_LAP_TIME_X_LAP`)
- **Number of resets per lap**: 0–5
- **Max runs per racer**: 1–5

### New fields
- **Race type**: `TIME_TRIAL` (default) | `LAP_COUNT`
  - Only available when ranking method = `BEST_LAP_TIME`
  - When ranking method = `BEST_AVERAGE_LAP_TIME_X_LAP`, race type is forced to `TIME_TRIAL` and the selector is disabled/hidden
- **Number of laps**: 1, 2, 3, 4, 5, 10
  - Only visible/enabled when race type = `LAP_COUNT`

### Event creation/edit UI
The race type field is added to the Race Customisations section of the event creation/edit form:

```
Race Settings
├── Ranking method:  [Best lap time ▼]
│
Race Customisations
├── Race type:       [Time based ▼]        ← new field
├── Race time (min): [2 ▼]                 ← shown when Time based
├── Number of laps:  [3 ▼]                 ← shown when Lap count
├── Resets per lap:  [3 ▼]
├── Avg laps window: [3 ▼]                 ← shown when ranking = average
└── Max runs/racer:  [3 ▼]
```

When the user selects ranking method `BEST_AVERAGE_LAP_TIME_X_LAP`, the race type selector is disabled (not hidden) and locked to `Time based`. Similarly, when race type is `Time based`, the number of laps field is disabled (not hidden). Fields remain visible so the user can see what options exist — disabled fields should include a hint explaining why they're unavailable.

## Data Model

### raceConfig changes (AppSync schema)

Add to the existing `RaceConfig` type and input:

```graphql
type RaceConfig {
  trackType: TrackType!
  rankingMethod: RankingMethod!
  raceTimeInMin: Int!
  numberOfResetsPerLap: Int!
  averageLapsWindow: Int!
  maxRunsPerRacer: Int!
  raceType: RaceType          # new — default TIME_TRIAL
  numberOfLaps: Int            # new — only used when raceType = LAP_COUNT
}

enum RaceType {
  TIME_TRIAL
  LAP_COUNT
}
```

`raceType` defaults to `TIME_TRIAL` if absent (backwards compatible — existing events continue to work unchanged).

## Timekeeper Changes

### XState state machine

The race state machine currently transitions:
```
ReadyToStart → TOGGLE → RaceStarted → (timer expires) → RaceIsOver
```

With lap count:
```
ReadyToStart → TOGGLE → RaceStarted → (lap N captured) → RaceIsOver
```

#### Implementation
- On `CAPTURE_LAP` / `CAPTURE_AUT_LAP` action, check if `raceConfig.raceType === 'LAP_COUNT'` and the number of completed laps (valid + invalid) equals `raceConfig.numberOfLaps`
- If so, automatically fire `END` to transition to `RaceIsOver`
- The manual `END` button remains available for operator intervention at any time

### Timer display

**Time-based (existing, unchanged):**
```
┌──────────────────┐
│     01:23.4      │  ← countdown timer
│                  │
└──────────────────┘
```

**Lap count:**
```
┌──────────────────┐
│    Lap 2 / 5     │  ← lap counter (prominent)
│     00:45.2      │  ← elapsed time (smaller)
└──────────────────┘
```

- The race timer component switches from countdown to count-up when `raceType === 'LAP_COUNT'`
- Lap counter shows `currentLap / totalLaps`
- Current lap increments on each lap capture (valid or invalid — all laps count toward the limit)
- Elapsed time runs from 00:00.0 upward

### Race end behaviour
- **Time based**: timer reaches zero → race ends automatically
- **Lap count**: target laps reached → race ends automatically
- **Both**: operator can manually end at any time via the `END` button
- No safety time limit for lap count — if the car crashes repeatedly, the operator manually ends

## Stream Overlay Changes

The lower third currently shows "REMAINING" with a countdown timer. For lap-count races:
- **Label**: changes from "REMAINING" to "LAPS" (or localised equivalent)
- **Value**: shows "2 / 5" (current lap / total laps) instead of "01:23"
- The overlay receives race config via the `onNewOverlayInfo` subscription which already includes `raceConfig` — the overlay reads `raceType` and `numberOfLaps` to switch display mode
- Both `RacerAndLapInfo-Localized.svg` and `RacerAndLapInfo-BestAvg.svg` use the same `REMAINING-LABEL` and `TOTAL-TIME-REMAINING-TEXT` element IDs, so the switch is handled in `helperFunctions.js` at render time, not in the SVG

## What Doesn't Change

- **Leaderboard ranking**: still fastest single valid lap (or best average, but that's time-based only)
- **Leaderboard display**: unchanged — shows fastest lap time regardless of format
- **Leaderboard computation**: `__calculate_race_summary` in `race_api` Lambda is unchanged — it already computes fastest lap, average, consecutive laps from whatever laps exist
- **CSV export**: unchanged — exports whatever laps were recorded
- **Public leaderboard**: unchanged

## Files to Modify

### CDK / Backend
- `lib/constructs/events-manager.ts` — add `RaceType` enum, `raceType` and `numberOfLaps` fields to `raceConfig` type and input
- No Lambda changes needed — race config is stored as-is in DynamoDB, leaderboard computation is format-agnostic

### Frontend — Event Config
- `website/src/admin/events/pages/createEvent.tsx` — add race type selector + number of laps dropdown
- `website/src/admin/events/pages/editEvent.tsx` — same
- `website/public/locales/en/translation.json` — i18n strings for new fields

### Frontend — Timekeeper
- `website/src/pages/timekeeper/pages/racePage.tsx` — lap count check on lap capture, auto-end, UI switch
- `website/src/pages/timekeeper/pages/racePageLite.tsx` — same (both pages must be updated)
- `website/src/pages/timekeeper/components/raceTimer.tsx` — support count-up mode + lap counter display

### Frontend — Stream Overlays
- `website-stream-overlays/src/helperFunctions.js` — switch REMAINING label/value based on raceType
- `website-stream-overlays/src/App.tsx` — pass raceConfig through to helper functions

## Implementation — Single Phase

All delivered together as one complete feature:
- AppSync schema: `RaceType` enum, `raceType` + `numberOfLaps` fields
- Event creation/edit UI: race type selector + number of laps (disabled when not applicable)
- Timekeeper: auto-end on lap count reached, count-up timer, lap counter display
- Both `racePage.tsx` and `racePageLite.tsx` updated
- Stream overlay: show laps remaining instead of time remaining for lap-count races

### Follow-up (separate tasks)
- Seed data: add lap-count events as a variant
- Pico display: show lap counter

## Backwards Compatibility

- `raceType` defaults to `TIME_TRIAL` if absent — existing events and races are unaffected
- `numberOfLaps` is ignored when `raceType !== 'LAP_COUNT'`
- No migration needed — existing DynamoDB data works unchanged
