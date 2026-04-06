# Racer Queue System — Design Spec

## Goal

Implement a racer queuing system that minimises dead time at events by ensuring the next racer is always briefed, their car is prepped (models loaded, batteries checked, calibration verified, tail light colour set), and spectators know who's racing and who's coming next.

The queue serves three audiences:
- **Operators** — efficient event flow, car prep checklist, one-click race setup
- **Racers** — know when they're up, check in on arrival, see their position
- **Spectators** — engaged by "up next" racer cards with profile/history

## Queue Lifecycle

### Pre-event
1. Event created in DREM with queue enabled
2. Racers pre-register for the event online (adds them to the queue)
3. Queue order defaults to registration order (FCFS)
4. Operator can reorder the queue before the event

### At-event
1. Racers **check in** on arrival — confirms they're physically present
2. System verifies racer has models uploaded in DREM
3. Walk-up racers can join the queue (added to the end)
4. Operator manages the queue — reorder, skip, remove

### During racing
1. Queue shows next racer with readiness status
2. Operator selects car for the race
3. System checks racer's models are on the selected car
4. If models missing — operator triggers upload via SSM
5. Car tail light colour set to racer's `highlightColour` (via SSM)
6. Timekeeper auto-populates racer + car
7. Operator starts race
8. Race completes → queue advances to next racer

## Queue States (per racer)

| State | Set by | Description |
|---|---|---|
| `REGISTERED` | System | Pre-registered online, not yet at the event |
| `ARRIVED` | Racer | Racer has flagged "I'm here" — waiting for staff check-in |
| `CHECKED_IN` | Registration staff | Staff verified identity and models, racer is in the queue |
| `STEPPED_AWAY` | Racer | Temporarily unavailable — retains queue position |
| `ON_DECK` | Operator | Next up — car being prepped |
| `RACING` | System | Currently on track |
| `COMPLETED` | System | Has raced (may re-queue for additional runs if `maxRunsPerRacer` allows) |
| `SKIPPED` | Operator | Was called but not ready — moved to back of queue |
| `WITHDRAWN` | Operator/Racer | Removed from queue |

## Readiness Checks

When a racer checks in or moves to `ON_DECK`, the system validates:

- [ ] Racer is checked in (physically present)
- [ ] At least one model uploaded to DREM
- [ ] Model(s) available on the assigned car (checked when car is selected)
- [ ] Racer hasn't exceeded `maxRunsPerRacer` for this event

Readiness shown as a checklist with green/amber/red indicators.

## Car Prep Flow

When operator selects a car for the next racer:

1. **Check models** — are the racer's models on this car?
   - If yes: green tick
   - If no: show which models need uploading, offer one-click upload via SSM
2. **Set tail light colour** — send SSM command to set the car's tail light to the racer's `highlightColour`
   - If racer has no highlight colour set: use default (blue)
3. **Battery/calibration** — informational reminder (not automated, operator checks manually)
4. **Ready indicator** — all green = car is prepped, timekeeper can auto-populate

## Timekeeper Integration

When operator starts a new race from the timekeeper:

- If queue is active, the **next checked-in racer** is auto-selected in the racer dropdown
- The **assigned car** is auto-selected in the car dropdown
- Operator confirms and hits start
- On race completion, queue advances automatically
- If racer has remaining runs (`maxRunsPerRacer`), they can re-queue

## Admin Screens

Two separate screens for two roles working in parallel at an event:

### Check-in Screen (`/admin/queue/checkin`) — Registration Staff

The "front desk" — where racers arrive and get verified. Accessible to the `registration` Cognito group.

```
┌─────────────────────────────────────────────────────────────────┐
│ Racer Check-in: DeepRacer Underground Championship              │
├─────────────────────────────────────────────────────────────────┤
│ Search: [_______________] or scan QR                            │
├────┬───┬────────────────┬──────────────┬──────────┬─────────────┤
│    │   │ Racer          │ Status       │ Models   │ Actions     │
├────┼───┼────────────────┼──────────────┼──────────┼─────────────┤
│    │🇬🇧│ SpeedDemon     │ 🟢 Checked in│ 3 ready  │             │
│    │🇺🇸│ TurboTina      │ 🟡 Registered│ 2 ready  │ [Check in]  │
│    │🇩🇪│ DoomBuggy      │ 🟡 Registered│ 0        │ [Check in]  │
│    │🇫🇷│ DBro           │ 🟡 Registered│ 1 ready  │ [Check in]  │
│ ...│   │                │              │          │             │
└────┴───┴────────────────┴──────────────┴──────────┴─────────────┘
│ [+ Register walk-up racer]                                      │
└─────────────────────────────────────────────────────────────────┘
```

**Check-in detail panel (split panel on racer select):**
```
┌─────────────────────────────────────────────────────────────┐
│ 🇺🇸 [avatar] TurboTina                                      │
├─────────────────────────────────────────────────────────────┤
│ Readiness:                                                  │
│ ⬜ Checked in                                               │
│ ✅ 2 models uploaded to DREM                                │
│   - TurboModel_v3.tar.gz (optimised ✅)                     │
│   - TurboModel_v5.tar.gz (optimised ✅)                     │
│                                                             │
│ Racer info:                                                 │
│ Events attended: 8  │  Best lap: 7.102s                     │
│ Highlight colour: 🔵  │  Country: US                        │
│                                                             │
│ [✓ Check in racer]  [Upload model for racer]                │
└─────────────────────────────────────────────────────────────┘
```

**QR code check-in flow:**
1. Racer opens their profile page on their phone (or has it printed)
2. Profile page displays a QR code encoding their racer ID / profile URL
3. Registration staff taps "Scan QR" on the check-in screen
4. Camera opens, reads the QR code
5. Check-in screen jumps directly to that racer's detail panel
6. Staff verifies identity, confirms models, taps "Check in"

The QR code on the racer profile page (task #33, `/racer/{username}`) serves dual purpose — shareable profile link and event check-in credential.

**Responsibilities:**
- Scan QR or search/find pre-registered racers
- Verify racer identity
- Confirm models are uploaded and optimised in DREM
- Help racers upload models if needed
- Register walk-up racers (create account + add to queue)
- Mark racers as checked in

### Queue Management Screen (`/admin/queue`) — Operator

The "track-side" view — manages the running order and car prep. Accessible to the `operator` and `admin` Cognito groups.

```
┌─────────────────────────────────────────────────────────────────┐
│ Race Queue: DeepRacer Underground Championship                   │
├────┬───┬────────┬──────────────┬──────────┬────────┬────────────┤
│  # │   │ Racer  │ Status       │ Models   │ Runs   │ Actions    │
├────┼───┼────────┼──────────────┼──────────┼────────┼────────────┤
│  1 │🇬🇧│ Speed  │ 🟢 On deck   │ 3 ready  │ 0 / 3  │ [▲][▼][✕]  │
│  2 │🇺🇸│ Turbo  │ 🟢 Checked in│ 2 ready  │ 0 / 3  │ [▲][▼][✕]  │
│  3 │🇩🇪│ Doom   │ 🟡 Registered│ 1 ready  │ 0 / 3  │ [▲][▼][✕]  │
│  4 │🇫🇷│ DBro   │ 🔴 No models │ 0        │ 0 / 3  │ [▲][▼][✕]  │
│ ...│   │        │              │          │        │            │
└────┴───┴────────┴──────────────┴──────────┴────────┴────────────┘
│ [Shuffle queue]  [Reset queue]                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Controls:**
- **Move up/down** — reorder individual racers
- **Skip** — move racer to back of queue (with reason)
- **Remove** — withdraw racer from queue
- **Shuffle** — randomise the queue order
- **Reset** — clear all states back to registered

**Car prep panel (split panel on racer select):**
```
┌─────────────────────────────────────────────────────────────┐
│ Preparing: 🇬🇧 SpeedDemon                                    │
├─────────────────────────────────────────────────────────────┤
│ Car: [Select car ▼]                                         │
│                                                             │
│ Readiness:                                                  │
│ ✅ Racer checked in                                         │
│ ✅ 3 models uploaded to DREM                                │
│ ⬜ Models on car (select car first)                         │
│ ⬜ Tail light colour set                                    │
│                                                             │
│ [Upload models to car]  [Set tail light]  [Send to race]    │
└─────────────────────────────────────────────────────────────┘
```

**Responsibilities:**
- Manage race order
- Select car for next racer
- Verify models are on the car, trigger upload if needed
- Set car tail light colour to racer's highlight colour
- Send racer + car to timekeeper (auto-populate)
- Handle skips and no-shows

## Public Queue Display

### Venue display (`/queue?eventId=xxx`)
Unauthenticated, designed for a screen at the event. Shows:

```
┌─────────────────────────────────────────────────────────────┐
│ RACE QUEUE — DeepRacer Underground Championship             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ NOW RACING:                                                 │
│ 🇬🇧 [avatar] SpeedDemon                                     │
│ Events: 12 │ Best lap: 6.234s │ Races today: 2/3           │
│                                                             │
│ UP NEXT:                                                    │
│ 🇺🇸 [avatar] TurboTina                                      │
│ Events: 8 │ Best lap: 7.102s │ First race today            │
│                                                             │
│ ON DECK:                                                    │
│ 🇩🇪 DoomBuggy  →  🇫🇷 DBro  →  🇯🇵 RacerX  →  ...           │
│                                                             │
│ Queue position: check your phone at /queue/my               │
└─────────────────────────────────────────────────────────────┘
```

Features:
- Large, readable at distance (same design language as venue leaderboard)
- "Now racing" racer card with avatar, flag, highlight colour, mini stats
- "Up next" racer card — the crowd knows who's coming
- Remaining queue as a horizontal scroll
- Auto-updates via AppSync subscription
- Themed with event colours (ties into overlay redesign #29)

### Racer personal view (`/queue/my` — authenticated)
Racer logs in and sees:

- Their queue position
- Estimated wait time (based on average race duration)
- Readiness checklist (models uploaded, checked in by staff)
- "I'm here" button — signals to registration staff that the racer has arrived at the event (not a check-in — staff still verify and formally check in)
- "I need to step away" / "I'm back" toggle — temporarily flags the racer as unavailable without losing queue position

**Note:** Racers cannot check themselves in. Check-in is performed by registration staff at `/admin/queue/checkin` after verifying identity and model readiness. The racer's "I'm here" status helps staff prioritise who to process next.

### Overlay integration
The venue leaderboard footer and streaming overlay can show:
- "Up next: [avatar] TurboTina 🇺🇸" during races
- Builds anticipation for the crowd

## Data Model

### New DynamoDB table: `QueueTable`

| PK | SK | Data |
|---|---|---|
| `EVENT#{eventId}` | `QUEUE#{position}` | userId, username, status, checkedInAt, models[], runs, highlightColour, avatarConfig, countryCode |
| `EVENT#{eventId}` | `CONFIG` | queueEnabled, maxQueueSize, autoAdvance |
| `USER#{userId}` | `EVENT#{eventId}` | position, status (for racer's personal view lookup) |

### AppSync additions
- `getQueue(eventId)` — returns ordered queue entries (API key for public, Cognito for operator actions)
- `joinQueue(eventId)` — racer joins the queue (Cognito auth, racer group)
- `updateQueueEntry(eventId, userId, ...)` — operator moves/skips/removes (Cognito auth, operator/admin)
- `checkIn(eventId)` — racer checks in (Cognito auth, racer group)
- `advanceQueue(eventId)` — move to next racer (Cognito auth, operator/admin)
- `onQueueUpdated(eventId)` — subscription for real-time updates (API key for public display)

### Event config additions
- `queueEnabled: Boolean` — toggle queue for this event
- `maxRunsPerRacer` — already exists, used for run tracking

## Implementation Phases

### Phase 1: Core Queue + Operator UI
- QueueTable DynamoDB table
- AppSync schema (queries, mutations, subscriptions)
- Queue management admin page (`/admin/queue`)
- Join queue, reorder, skip, remove, add walk-up
- Readiness checks (checked in, models uploaded)
- Queue advances on race completion

### Phase 2: Car Prep + Timekeeper Integration
- Car selection with model verification
- One-click model upload to car via SSM
- Tail light colour set via SSM
- Timekeeper auto-populate from queue (next racer + assigned car)
- Car prep checklist panel

### Phase 3: Public Display + Racer View
- Public queue display (`/queue?eventId=xxx`)
- "Now racing" and "Up next" racer cards with profile/stats
- Racer personal view (`/queue/my`) with position and estimated wait
- Check-in via racer's phone
- "Step away / I'm back" toggle

### Phase 4: Overlay Integration + Polish
- "Up next" in venue leaderboard footer
- "Up next" in streaming overlay
- Estimated wait time calculation
- Push notifications (future — when racer is on deck)
- Racer profile cards with cross-event stats (depends on task #2 stats engine)

## Dependencies

- **PR #171 (avatar)** — racer identity in queue display and racer cards
- **Task #2 (stats)** — racer profile stats for the "up next" card (Phase 4)
- **Task #29 (overlay redesign)** — queue display in the new overlay system (Phase 4)
- **Existing SSM car management** — model upload and tail light commands
- No SSM migration dependency — queue is a new feature with its own table

## Design Principles

- **Zero dead time** — the system should make it impossible to have an idle track
- **Racer experience** — racers always know where they are in the queue and what they need to do
- **Spectator engagement** — the crowd knows who's racing and who's coming next
- **Operator efficiency** — one-click car prep, auto-populated timekeeper, visual readiness checks
- **Graceful degradation** — queue is optional per event, everything works without it
