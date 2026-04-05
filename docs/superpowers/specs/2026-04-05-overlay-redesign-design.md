# Streaming Overlay & Leaderboard Redesign — Design Spec

## Goal

Replace the current SVG-based overlays with a modern, broadcast-quality React overlay system inspired by F1/IndyCar/MotoGP racing graphics. Configurable colour schemes per event with a professional default. Both streaming overlay and venue leaderboard refreshed with consistent design language.

Reference: https://overlays.uno/library for overlay design patterns.

## Architecture

### Single app, route-based modes
A single React app replaces both `website-stream-overlays/` and `website-leaderboard/`. Different display modes are selected via URL route or query parameter:

- `/leaderboard` — full-screen venue display, dark background, optimised for readability at distance
- `/overlay` — streaming overlay, transparent/chroma key background, designed for broadcast composition (OBS, vMix)
- `/overlay/tower` — position tower only (for compositing alongside other sources)

**Benefits of single app:**
- Shared React components (position tower rows, timing digits, racer identity, theme provider)
- Single codebase to maintain — no duplicated logic between overlay and leaderboard
- Shared theme system, shared data subscriptions, shared animations
- One build, one deployment, one set of dependencies
- Configuration lives in the DREM admin website, not in the overlay app

**Shared components:**
- `RacerRow` — position, flag, avatar, name, time, highlight colour (renders differently based on context — compact for tower, expanded for leaderboard)
- `TimingBar` — remaining/best lap/previous display
- `RacerIdentity` — flag + avatar + name + highlight colour
- `ThemeProvider` — CSS custom properties from event config
- `TimingDigits` — monospace formatted time display

## Overlay Elements

### 1. Position Tower (left edge)
A vertical leaderboard strip on the left side of the screen, always visible during a race. F1-style.

**Layout (per row):**
```
┌──────────────────────────────┐
│ P1  🇬🇧 [avatar] SPE  8.324 │  ← highlight colour bar on left edge
│ P2  🇺🇸 [avatar] TUR  8.730 │
│ P3  🇩🇪 [avatar] DOO  8.985 │
│ P4  🇫🇷 [avatar] DBR  9.167 │
│ ...                          │
│ P10 🇯🇵 [avatar] RAC  DNF   │
└──────────────────────────────┘
```

**Details:**
- Shows 10+ racers (scrolls if more, or paginate in groups)
- Position number (P1, P2, etc.)
- Country flag (small)
- Racer avatar (small, from avataaars — when avatar PR merges)
- Racer name truncated to 3-5 characters (configurable, auto-truncate based on available width)
- Highlight colour bar on left edge of each row (from racer's `highlightColour`)
- Best lap time or gap to leader (alternating, ties into task #43)
- Top 3 positions visually distinguished (gold/silver/bronze accent or podium styling)
- Smooth animation when positions change (slide up/down)
- Current racer highlighted (glow/pulse, matches leaderboard highlight from PR #176)

### 2. Lower Third — Timing Bar
Horizontal bar at the bottom showing current racer details during a race.

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🇬🇧 [avatar] SpeedDemon    Remaining  │  Best lap  │  Previous │
│ ██ highlight colour bar     1 / 2      │  00:08.324 │  00:09.167│
└─────────────────────────────────────────────────────────────┘
```

**Details:**
- Racer identity: flag, avatar, full name, highlight colour
- Three data columns: Remaining (time or lap count), Best lap/Best avg, Previous/Current lap
- Labels consistent between streaming overlay and venue leaderboard
- For lap count races: "Remaining" shows `n / x` instead of countdown
- Slides in from bottom when race starts, slides out when race ends
- Semi-transparent background with subtle gradient

### 3. Race Summary Card
Shown briefly after a race is submitted (replaces current `raceSummaryFooter`).

**Layout:**
```
┌─────────────────────────────────────────┐
│ RACE COMPLETE                           │
│ 🇬🇧 [avatar] SpeedDemon                 │
│ Position: P3  │  Best: 00:08.324        │
│ Laps: 12/14 valid  │  Avg: 00:09.567   │
└─────────────────────────────────────────┘
```

### 4. Event Banner
Top bar showing event name, sponsor, track info.

```
┌─────────────────────────────────────────────────────────────┐
│ [sponsor logo]  DeepRacer Underground Championship  Track 1 │
└─────────────────────────────────────────────────────────────┘
```

### 5. Venue Leaderboard (full-screen)
The primary display at events — projected or on large screens, visible to racers and spectators all day. This is the most-viewed element and needs to look polished.

**Idle state (between races):**
```
┌─────────────────────────────────────────────────────────────┐
│ [Event Banner / Sponsor]                                     │
├────┬───┬────────┬──────────────────┬──────────┬─────────────┤
│ P1 │🇬🇧│[avatar]│ SpeedDemon       │ 00:08.324│ ██ highlight│
│ P2 │🇺🇸│[avatar]│ TurboTina        │ 00:08.730│ ██ highlight│
│ P3 │🇩🇪│[avatar]│ DoomBuggy        │ 00:08.985│ ██ highlight│
│ P4 │🇫🇷│[avatar]│ DBro             │ 00:09.167│ +0.843      │
│ ...│   │        │                  │          │             │
│P20 │🇯🇵│[avatar]│ RacerName        │ 00:12.456│ +4.132      │
├────┴───┴────────┴──────────────────┴──────────┴─────────────┤
│ [Footer: event stats / next race info / sponsor]             │
└─────────────────────────────────────────────────────────────┘
```

**During a race (race info footer appears):**
```
├─────────────────────────────────────────────────────────────┤
│ Currently racing: 🇬🇧 [avatar] SpeedDemon                   │
│ Remaining: 01:23.4  │  Best lap: 00:08.324  │  Current lap │
└─────────────────────────────────────────────────────────────┘
```

**Details:**
- Full racer name (not truncated like the streaming tower)
- Avatar, flag, highlight colour bar per row
- Top 3 with podium-style visual treatment (gold/silver/bronze accent)
- Gap to leader shown for P4+ (P1-P3 show absolute time)
- Auto-scroll for large leaderboards (smooth, configurable speed)
- Scroll to and highlight racer when new result submitted (existing PR #176 behaviour, restyled)
- Race info footer slides up during races, matches lower third design
- Event banner at top with event name, sponsor, track info
- Footer area for stats, next racer up (ties into task #40 queuing), or sponsor rotation
- Responsive — works on 16:9 and 4:3 projectors
- Dark background by default, themed with event colours

## Colour/Theme System

### Theme structure
```typescript
interface OverlayTheme {
  // Primary colours
  primary: string;        // Main accent colour (buttons, highlights, active states)
  primaryDark: string;    // Darker variant for backgrounds
  secondary: string;      // Secondary accent (borders, subtle highlights)

  // Backgrounds
  bgOverlay: string;      // Semi-transparent overlay background (rgba)
  bgSolid: string;        // Solid background for venue leaderboard
  bgGradientStart: string;
  bgGradientEnd: string;

  // Text
  textPrimary: string;    // Main text (names, times)
  textSecondary: string;  // Labels, descriptions
  textHighlight: string;  // Highlighted values (best lap, P1)

  // Position colours
  positionGold: string;
  positionSilver: string;
  positionBronze: string;

  // Typography
  fontFamily: string;     // Primary font
  fontFamilyMono: string; // Monospace for timing digits
}
```

### Default theme
Professional dark theme inspired by F1 broadcast graphics:
- Dark background (`#1a1a2e` or similar deep navy)
- White/light text for readability
- AWS orange (`#FF9900`) as primary accent
- Monospace font for all timing digits
- Clean sans-serif for names and labels

### Per-event override
- Stored in event config (`raceConfig.theme` or a new `overlayConfig` section)
- Operator can pick primary/secondary colours in the event creation/edit form
- CloudScape colour picker component for colour selection
- Preview in the admin UI showing how the overlay will look
- Falls back to global default for any unset values

### How themes propagate
1. Leaderboard and streaming overlay read the event's theme from the AppSync subscription data (or query on load)
2. Theme applied via CSS custom properties (`--overlay-primary`, `--overlay-bg`, etc.)
3. All overlay components reference these properties, not hardcoded colours
4. Theme changes are live — updating an event's colours updates the overlays in real-time

## Technology

### Moving away from SVG + D3
The current overlays use SVG files with D3 to manipulate text elements. This is fragile (hardcoded coordinates, alignment issues, no responsive behaviour).

**New approach:**
- **React components** with CSS for all overlay elements
- **CSS animations** for transitions (slide, fade, position changes)
- **CSS Grid/Flexbox** for layout (responsive, no hardcoded coordinates)
- **CSS custom properties** for theming
- **Framer Motion** (or CSS transitions) for smooth position change animations in the tower

### Chroma key
The streaming overlay currently uses a green/blue chroma key background. The new design should:
- Support transparent background (for software compositors that support it)
- Support configurable chroma key colour via URL param (existing pattern)
- Default to transparent

### URL parameters (existing pattern, extended)
```
?eventId=xxx&trackId=1&showLeaderboard=1&raceFormat=fastest&chromaKey=green
```

Add:
```
&theme=custom     // use event's custom theme
&tower=1          // show position tower (default: 1)
&lowerThird=1     // show lower third (default: 1)
&banner=1         // show event banner (default: 0)
```

## Implementation Phases

### Phase 1: New App Scaffold + Shared Components + Position Tower
- Create single React app (replaces both `website-stream-overlays/` and `website-leaderboard/`)
- Route-based mode selection (`/leaderboard`, `/overlay`, `/overlay/tower`)
- Shared component library: `RacerRow`, `TimingBar`, `RacerIdentity`, `TimingDigits`, `ThemeProvider`
- CSS custom properties theme system with default dark theme
- Position tower component (streaming overlay mode)
- AppSync data subscriptions (reuse existing queries/subscriptions)
- Chroma key / transparent background for overlay mode

### Phase 2: Lower Third + Venue Leaderboard
- Lower third timing bar component (streaming overlay mode)
- Full-screen venue leaderboard (`/leaderboard` route)
- Race info footer (during race) — shared `TimingBar` component
- Race summary card (after race submission)
- Scroll animation for large leaderboards
- Scroll-to and highlight on new result (PR #176 behaviour)
- Lap count support throughout

### Phase 3: Theme Configuration + Event Banner
- Event config UI in DREM admin: colour picker for primary/secondary/accent
- Theme preview in admin
- AppSync: overlay theme fields on event config
- Live theme propagation via subscription
- Event banner component (top bar: event name, sponsor, track)
- Footer area (stats, next racer, sponsor rotation)

### Phase 4: Animation + Polish
- Smooth position change animations (tower rows slide up/down)
- Gap-to-leader alternating display (task #43)
- Racer avatar + highlight colour integration (depends on PR #171)
- Stinger transitions (race start, race end, new fastest lap)
- Glass/blur effects for modern broadcast look

**Note:** This work aligns with PR #168 (website consolidation) which moves all websites into a single CloudFront distribution. The new single overlay app replaces both `website-leaderboard/` and `website-stream-overlays/`, reducing from 3 web apps to 2 (main + overlays).

## Dependencies

- **PR #171 (avatar)** — for racer identity in tower/lower third
- **Task #43 (gap to leader)** — for alternating time/gap display in tower
- **Task #42 (lap count)** — already built, overlay support included
- No CDK dependencies — entirely frontend

## Design Principles

- **Broadcast quality** — should look professional enough for a live stream
- **Readable at distance** — venue leaderboard must work on a projector
- **Dark mode first** — overlays are viewed on screens, dark backgrounds reduce eye strain
- **Consistent** — same visual language across streaming and venue displays
- **Performant** — 60fps animations, no jank on overlay transitions
- **Accessible** — sufficient contrast ratios, no colour-only information
