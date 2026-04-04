# DREM Statistics — Design Spec

## Goal

Add comprehensive race statistics to DREM at four levels: global (public), event, racer profile (public/shareable), and live race. Beautiful visualisations using CloudScape's chart components. Pre-computed aggregates for fast reads, updated on race submission via EventBridge.

## Levels

### 1. Global Dashboard (unauthenticated)
The public face of DREM racing. Anyone can browse global stats without logging in.

**URL**: `/stats`, `/stats/country/:countryCode`
**Auth**: API key (same as leaderboard)

**Visualisations**:
- **Hero KPI cards**: total events, total racers, total laps, countries represented
- **BarChart**: events by country
- **LineChart**: events and races per month over time
- **PieChart**: event type breakdown (official/community/workshop)
- **Table**: fastest laps ever (top 10 — racer name, event, track type, time)
- **Filters**: date range picker, country/region selector

### 2. Event Stats (authenticated, admin/operator)
Per-event breakdown visible when managing an event.

**URL**: `/admin/events/stats` (uses selected event context)
**Auth**: Cognito (admin/operator)

**Visualisations**:
- **Hero KPI cards**: unique racers, total laps, completion ratio, total races
- **BarChart**: lap time distribution (histogram — e.g. 5-6s, 6-7s, 7-8s buckets)
- **MixedLineBarChart**: per-racer comparison (bars = fastest lap, line = avg lap)
- **Table**: full racer rankings with expandable lap details
- Computed on demand from existing DynamoDB tables (single event scan is fast)

### 3. Racer Profile (public, shareable)
Cross-event career stats. Every racer gets a public link they can share.

**URL**: `/racer/:username`
**Auth**: API key (unauthenticated, public)

**Header**: racer name, country flag, avatar, highlight colour (when avatar PR merges)

**Visualisations**:
- **Hero KPI cards**: events attended, total races, total laps, best ever lap time
- **LineChart**: improvement trend per track type (best lap time over chronological events)
- **BarChart**: laps per event (volume/consistency over time)
- **Table**: event history — date, event name, track type, position, best lap, avg lap

**Data**: pre-computed `CrossEventRacerStats` from the stats table, updated on each race submission.

### 4. Live Race Stats (authenticated, commentator)
Real-time during a race. Deferred to later — design once telemetry pipeline (Greengrass Phase 3) exists.

**URL**: `/admin/races/live`
**Auth**: Cognito (admin/operator/commentator)

Planned visualisations: real-time lap time comparison, position changes over laps. Ties into task #29 (overlay redesign) and task #30 (commentator tool).

---

## Data Architecture

### Hybrid computation model

| Level | Computation | Storage |
|---|---|---|
| Global (by country, by month, totals) | Pre-computed, updated on race submission | `StatsTable` |
| Per-racer cross-event profile | Pre-computed, updated on race submission | `StatsTable` |
| Per-event | On demand (single event scan is fast) | Existing `RaceManagerTable` + `LeaderboardTable` |
| Live race | Real-time via AppSync subscription | No persistence (ephemeral) |

### StatsTable (new DynamoDB table)

Single table design with composite keys:

| Entry type | PK | SK | Data |
|---|---|---|---|
| Global totals | `GLOBAL` | `TOTALS` | totalEvents, totalRacers, totalLaps, totalCountries |
| Global by country | `GLOBAL` | `COUNTRY#GB` | events, racers, laps for that country |
| Global by month | `GLOBAL` | `MONTH#2026-04` | events, races, laps for that month |
| Global by event type | `GLOBAL` | `EVENT_TYPE#OFFICIAL_TRACK_RACE` | count |
| Global by track type | `GLOBAL` | `TRACK_TYPE#REINVENT_2018` | count, bestLap |
| Fastest laps ever | `GLOBAL` | `FASTEST_LAPS` | sorted list of top N (racer, event, track, time) |
| Racer profile | `RACER#{userId}` | `PROFILE` | eventsAttended, totalRaces, totalLaps, bestLapEver, favouriteTrack |
| Racer event summary | `RACER#{userId}` | `EVENT#{eventId}` | bestLap, avgLap, validLaps, position, trackType, eventName, eventDate |
| Racer improvement trend | `RACER#{userId}` | `TREND#{trackType}` | slope (ms/event), dataPoints |
| Racer username lookup | `USERNAME#{username}` | `LOOKUP` | userId (for public URL resolution) |

**GSI**: `sk-pk-index` (inverted) for querying all racers by country, all events for a track type, etc.

### Stats EVB Lambda

New Lambda triggered by the same EventBridge events as the leaderboard (`raceSummaryAdded`, `raceSummaryUpdated`):

1. Receive event
2. Read the racer's full race history from `RaceManagerTable` (query by userId across events)
3. Recompute racer profile + per-event summaries
4. Update racer entries in `StatsTable`
5. Increment/update global aggregates (atomic updates where possible)
6. Update fastest-laps-ever list if applicable

The computation logic ports directly from `drem-api-stats/compute.py` — pure functions, no I/O changes needed.

**Separate from leaderboard Lambda** — independent failure/retry, independent deployment. Stats computation failure must never affect leaderboard updates.

### Stats API Lambda

New Lambda resolving AppSync queries for stats data:

- `getGlobalStats` — reads `GLOBAL` partition from StatsTable
- `getCountryStats(countryCode)` — reads `COUNTRY#` entries
- `getRacerProfile(username)` — resolves username → userId via lookup entry, reads `RACER#` partition
- `getEventStats(eventId)` — computed on demand from existing tables (races + leaderboard)

**Auth**:
- `getGlobalStats`, `getCountryStats`, `getRacerProfile` — API key (public, unauthenticated)
- `getEventStats` — Cognito (admin/operator)

---

## Data Quality Rules

Ported from `drem-api-stats/compute.py`:

1. **Minimum valid lap: 5000 ms** — sub-5s laps are artefacts regardless of `isValid` flag
2. **Rolling average sanity check** — discard `best_avg_lap` if it's less than best individual lap
3. **Reset counts informational only** — not all events tracked resets; never use as primary metric
4. **Cross-track comparison invalid** — lap times are not comparable across track types; improvement trends are per-track-type only

---

## AppSync Schema Additions

```graphql
# Stats types
type GlobalStats {
  totalEvents: Int!
  totalRacers: Int!
  totalLaps: Int!
  totalValidLaps: Int!
  totalCountries: Int!
  eventsByCountry: [CountryStat!]!
  eventsByMonth: [MonthStat!]!
  eventTypeBreakdown: [EventTypeStat!]!
  trackTypeBreakdown: [TrackTypeStat!]!
  fastestLapsEver: [FastestLapEntry!]!
}

type CountryStat {
  countryCode: String!
  events: Int!
  racers: Int!
  laps: Int!
}

type MonthStat {
  month: String!  # "2026-04"
  events: Int!
  races: Int!
}

type EventTypeStat {
  typeOfEvent: String!
  count: Int!
}

type TrackTypeStat {
  trackType: String!
  count: Int!
  bestLapMs: Float
}

type FastestLapEntry {
  username: String!
  eventName: String!
  trackType: String!
  lapTimeMs: Float!
  eventDate: String!
}

type RacerProfile {
  username: String!
  userId: ID!
  countryCode: String
  avatarConfig: AWSJSON
  highlightColour: String
  eventsAttended: Int!
  totalRaces: Int!
  totalLaps: Int!
  totalValidLaps: Int!
  bestLapEverMs: Float
  bestLapEventName: String
  bestLapTrackType: String
  favouriteTrackType: String
  eventHistory: [RacerEventSummary!]!
  improvementTrends: [ImprovementTrend!]!
}

type RacerEventSummary {
  eventId: ID!
  eventName: String!
  eventDate: String!
  trackType: String!
  countryCode: String
  bestLapMs: Float
  avgLapMs: Float
  validLaps: Int!
  totalLaps: Int!
  raceCount: Int!
  position: Int
}

type ImprovementTrend {
  trackType: String!
  slopeMs: Float!  # negative = improving
  dataPoints: Int!
}

type EventDetailStats {
  eventId: ID!
  eventName: String!
  totalRacers: Int!
  totalRaces: Int!
  totalLaps: Int!
  totalValidLaps: Int!
  completionRatio: Float!
  overallBestLapMs: Float
  overallAvgLapMs: Float
  lapDistribution: [LapBucket!]!
  racerComparison: [RacerComparisonEntry!]!
}

type LapBucket {
  rangeLabel: String!  # "6-7s"
  count: Int!
}

type RacerComparisonEntry {
  username: String!
  fastestLapMs: Float!
  avgLapMs: Float!
  validLaps: Int!
  raceCount: Int!
}

# Queries
type Query {
  getGlobalStats: GlobalStats  # API key auth (public)
  getCountryStats(countryCode: String!): CountryStat  # API key auth (public)
  getRacerProfile(username: String!): RacerProfile  # API key auth (public)
  getEventStats(eventId: ID!): EventDetailStats  # Cognito auth (admin/operator)
}
```

---

## CDK Infrastructure

### New construct: `Statistics`

- **StatsTable** — DynamoDB table (PK: `pk`, SK: `sk`, GSI: `sk-pk-index`)
- **Stats EVB Lambda** — triggered by `raceSummaryAdded`/`raceSummaryUpdated` from EventBridge, writes pre-computed aggregates to StatsTable
- **Stats API Lambda** — AppSync resolver for stats queries, reads from StatsTable + existing tables
- **AppSync schema** — new types and queries as above
- **Auth** — API key for public queries (global, country, racer profile), Cognito for event stats

### Compute module

Port `drem-api-stats/compute.py` and `drem-api-stats/models.py` into a Lambda layer or inline module. These are pure functions — no changes needed for the port:

- `compute_event_stats(event, races, user_map)` → `EventStats`
- `compute_cross_event_stats(racer_event_summaries)` → `CrossEventRacerStats`
- Data quality rules (5s floor, avg sanity check) applied automatically

---

## Frontend

### Public routes (unauthenticated, API key auth)

**`/stats`** — Global Dashboard
- CloudScape `AppLayout` without authentication wrapper
- KPI cards using `Box` with large text
- `BarChart` for events by country
- `LineChart` for events/races over time
- `PieChart` for event type breakdown
- `Table` for fastest laps ever
- `DateRangePicker` and `Select` for filtering

**`/stats/country/:countryCode`** — Country filtered view
- Same layout as `/stats` but filtered to one country
- Shows that country's events, racers, lap records

**`/racer/:username`** — Racer Profile
- Header: avatar (avataaars), highlight colour bar, country flag, racer name
- KPI cards: events, races, laps, best lap
- `LineChart`: improvement trend per track type (one series per track)
- `BarChart`: laps per event over time
- `Table`: event history with sortable columns

### Authenticated routes

**`/admin/events/stats`** — Event Stats
- Added to the admin events section (existing nav)
- `BarChart`: lap time histogram
- `MixedLineBarChart`: racer comparison
- `Table`: full racer rankings

### Design principles
- CloudScape charts with consistent colour palette across all views
- Responsive — works on tablet for event operators
- Dark mode compatible (inherits from the dark mode toggle we just built)
- Loading states with CloudScape `Spinner` and `StatusIndicator`
- Empty states with helpful messages ("No race data yet" etc.)

---

## Implementation Phases

### Phase 1: Data Layer + Global Dashboard
- `Statistics` CDK construct (StatsTable, EVB Lambda, API Lambda)
- Port `compute.py` / `models.py` to Lambda
- AppSync schema additions (global stats types + queries)
- `/stats` page with KPI cards + charts
- **Deliverable**: public global stats page

### Phase 2: Racer Profile
- Racer profile pre-computation in EVB Lambda
- Username lookup entry for public URL resolution
- `getRacerProfile` query
- `/racer/:username` page with avatar, charts, event history
- **Deliverable**: shareable public racer profile

### Phase 3: Event Stats
- `getEventStats` query (on-demand computation)
- `/admin/events/stats` page with histogram, racer comparison, rankings
- **Deliverable**: per-event analytics for operators

### Phase 4: Live Race Stats
- Deferred until Greengrass telemetry pipeline (Phase 3 of Greengrass spec) is operational
- Real-time lap comparison, position tracking
- Ties into task #29 (overlay redesign) and task #30 (commentator tool)

Phases 1-3 are independent once the CDK construct is deployed. Phase 4 depends on Greengrass telemetry.
