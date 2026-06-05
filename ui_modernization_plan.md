# UI Modernization Plan

Initiated June 2026. Goal: bring the app's visual language up to the standard set by Sleeper, Yahoo, and ESPN — sleeker, more dynamic, without sacrificing ease of use, intuitive navigation, or clear data communication.

Reference platforms studied:
- **Sleeper** — dark mode, position color coding, card-based layout, animated draft room, mobile-first feel
- **Yahoo** — clean white/blue, strong typography, color-coded position badges in table rows, player headshots in line
- **ESPN** — bold accents, position color coding, card dashboards, projections prominently shown

---

## Completed

### Tier 1 — Quick Wins

#### 1. Toast Notification System ✅
**Problem:** User feedback lived in a `<p>` tag in the sticky header — invisible when scrolled, same style for success and error.

**Solution:** Replaced with [Sonner](https://sonner.emilkowal.ski/) (`sonner` npm package). All 56 `setStatusMessage(...)` call sites replaced with `toast.success()`, `toast.error()`, `toast.warning()`, or `toast.info()`. The `<Toaster>` component is mounted in `apps/web/src/app/layout.tsx` (position: bottom-right, richColors, closeButton).

**Files changed:**
- `apps/web/src/app/layout.tsx` — added `<Toaster />`
- `apps/web/src/components/dashboard/dashboard-app.tsx` — replaced all status message calls; removed status `<p>` from header
- `apps/web/package.json` — added `sonner ^2.0.7`

---

#### 2. Position Color Coding ✅
**Problem:** All position badges were zinc (gray) except QB (amber) and RB (green). WR, TE, K, DST were indistinguishable.

**Solution:** Defined a 6-color position palette across the app:

| Position | Color |
|----------|-------|
| QB | Amber |
| RB | Emerald |
| WR | Sky (blue) |
| TE | Violet |
| K | Zinc |
| DST | Zinc |

Added `qb`, `rb`, `wr`, `te`, `k`, `dst` CVA variants to the `Badge` component. Rewrote `PositionBadge` to use a `variantMap` lookup (handles `DEF` → `dst` alias). Also applied to the Scenario Comparison page's `ScenarioTeamCell` which was rendering all keeper badges as `variant="success"` (all green) regardless of position.

**Files changed:**
- `apps/web/src/components/ui/badge.tsx` — added 6 position variants
- `apps/web/src/components/dashboard/dashboard-app.tsx` — rewrote `PositionBadge`; fixed `ScenarioTeamCell`

---

#### 3. Interactive Card Elevation ✅
**Problem:** Cards were flat with `shadow-sm`. Hoverable cards gave no motion cue.

**Solution:** Added `transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md` to `OutlookCard` and `DashboardTeamSnapshotCard`.

**Files changed:**
- `apps/web/src/components/dashboard/dashboard-app.tsx` — `OutlookCard` and `DashboardTeamSnapshotCard` root elements

---

#### 4. Skeleton Loading States ✅
**Problem:** Three key async areas showed a spinning `RefreshCw` icon + plain text while loading.

**Solution:** Replaced spinners with `animate-pulse bg-zinc-200 rounded` skeleton bars shaped to match the content that will appear.

Locations updated:
- **AI Keeper Explanation modal** — 6 skeleton lines matching the explanation paragraph/section structure
- **Mock Draft player AI analysis panel** — 6 skeleton lines in a 2-column grid matching the quick-take + context items
- **Value Window projection panel** — 3 skeleton lines

**Files changed:**
- `apps/web/src/components/dashboard/dashboard-app.tsx` — three loading state blocks

---

### Tier 2 — Medium Effort

#### 5. Navigation Redesign ✅
**Problem:** 19 flat items with identical visual weight, no grouping, active state was a subtle ring/bg change.

**Solution:**
- Regrouped nav items into 5 logical sections: *(ungrouped top)*, **KEEPER TOOLS**, **DRAFT ROOM**, **LEAGUE DATA**, **SETTINGS**
- Defined `navGroups` constant mapping section labels to `ViewId[]`; render loop produces labeled group divs
- New active state: `border-l-2 border-emerald-600` left-border accent + `bg-emerald-50 font-semibold text-emerald-900` + emerald icon (`text-emerald-600`)
- Inactive icons: `text-zinc-400`, hover: `text-zinc-600`
- Row height reduced from 40px → 36px (`h-9`); nav items reordered within groups to match natural workflow

**Files changed:**
- `apps/web/src/components/dashboard/dashboard-app.tsx` — `navItems` reordered, `navGroups` added, `<nav>` rendering replaced

---

#### 6. Table Row Player Cards ✅
**Problem:** Player names were plain text in table cells; position badge was a separate column.

**Solution:** Created a `PlayerCell` compound component:
```
[32px avatar]  Player Name (bold, clickable if onClick provided)
               [PosBadge]  NFL Team (gray, when available)
```

The avatar shows a headshot if `imageUrl` is present; falls back to the NFL team color circle with team abbreviation; only renders at all when `nflTeam` or `imageUrl` is provided (no orphan circle for name-only rows).

Added `xs` size (`size-8` / 32px) to `PlayerAvatar` for table-density use.

Applied to:
- **Keeper Recommendations table** — merged `player` + `position` columns; `onClick` opens explanation modal
- **Mock Draft available players** — merged Player/Pos/NFL columns into one; reduced table `colSpan` from 6 → 4
- **Draft Results table** — merged `player` + `position`
- **Final Rosters table** — merged `player` + `position`
- **ADP table** — merged `player` + `position`

**Files changed:**
- `apps/web/src/components/dashboard/dashboard-app.tsx` — `PlayerAvatar` (xs size), `PlayerCell` component, 5 table column definitions

---

#### 7. Mock Draft Countdown Ring + On-the-Clock Banner ✅
**Problem:** Timer displayed as a plain number in a static colored badge. No clear visual indicator when it was the user's pick.

**Solution:**

**Countdown ring** (`DraftCountdownRing` component): 48px SVG with two circles — a gray track and a depleting progress arc. Arc color shifts based on remaining time fraction:
- > 50% → emerald-500
- 25–50% → amber-500
- ≤ 25% → red-500

Uses `stroke-dasharray` / `stroke-dashoffset` with CSS transitions (`stroke-dashoffset 0.9s linear`). Rendered in the draft room header whenever `pickTimerSeconds` is set and `timeRemaining !== null`.

**On-the-clock banner**: Solid `bg-emerald-600` banner with a pulsing white dot and bold `ON THE CLOCK — [Team Name]` text. Appears above the Available Players section when `isUserPickSlot && activeSession.status === "in_progress"`. Disappears immediately after the pick is made.

**Files changed:**
- `apps/web/src/components/dashboard/dashboard-app.tsx` — `DraftCountdownRing` component; replaced timer badge; added banner above Available Players

---

### Bug Fixes (found during this work)

#### Mock Draft PlayerCell missing imageUrl ✅
The `MockAvailablePlayer` type has `imageUrl: string | null` but `PlayerCell` in the mock draft table wasn't passing it — so players always showed the team-color fallback circle instead of their headshot. Fixed by adding `imageUrl={player.imageUrl}` to the call.

#### Backfill script missed suffixed names ✅
**Problem:** `backfill_player_images.py` matched by `full_name.lower()|position`. Sleeper stores "James Cook" / "Kenneth Walker"; our DB stores "James Cook III" / "Kenneth Walker III". The keys never matched → no image.

**Fix:** Added `_strip_suffix()` (strips Jr./Sr./II/III/IV/V/VI) and indexed each Sleeper player under both their original name and the suffix-stripped name. DB-side matching also tries the stripped fallback key. Result: 18 additional players got images including James Cook III, Kenneth Walker III, Chris Rodriguez Jr., Marvin Mims Jr., Ollie Gordon II.

**Files changed:**
- `apps/api/backfill_player_images.py`

---

## Remaining

### Tier 2

#### 8. Dashboard Homepage as a Real Dashboard ✅
**Was already done** — the `LeagueDashboard` component had been built out with MetricTile cards, League Briefing + Model Status, Top Keeper Decisions (3-column), Team Snapshot grid, and Draft Capital overview bars. Plan document was not updated when the code was written.

---

### Tier 3 — Larger Investment

#### 9. Dark Mode ✅
Added class-based dark mode infrastructure and applied it to all structural + dashboard-level elements.

**What was done:**
- `globals.css` — `@custom-variant dark (&:where(.dark, .dark *))` + `color-scheme: dark` on `.dark`
- `layout.tsx` — inline FOUC-prevention script reads `localStorage("theme")` and adds `class="dark"` to `<html>` before paint; `suppressHydrationWarning` on `<html>`
- `useTheme()` hook in `dashboard-app.tsx` — reads `.dark` class state, toggles and persists to localStorage
- Moon/Sun toggle button added to the sticky header (right side, before ConnectionBadge)
- `card.tsx` — dark variants on Card, CardHeader, CardTitle, CardDescription
- `button.tsx` — dark variants on all button variants (default, secondary, outline, ghost)
- Structural layout: `<main>`, `<aside>`, `<header>`, nav items, sidebar footer card, user menu dropdown
- Dashboard components: MetricTile, MetricStrip, DashboardDecisionList, DashboardTeamSnapshotCard, DashboardNewsList, InfoLine, Draft Capital bars
- Auth/login screens

**Not yet dark-moded** (inner view pages — Tiers 2+3 follow-up):
- View-specific pages: Recommendations, Trade Analyzer, Scenarios, Mock Draft, ADP, Admin, etc.
- Inner table rows, form inputs, modals (they still use light colors in dark mode)

#### 10. ADP Trend Mini-Charts ✅
Replace the plain ADP number column with a sparkline showing 4-week ADP movement. Rising (lower pick #) = green line + green delta, falling = red. History fetched from backend.

**What was done:**
- New backend endpoint `GET /api/leagues/{league_id}/adp-trend` queries the last N (default 4) `adp_snapshots` for the league and returns per-player `adp_pick` history in chronological order.
- `ADPEntry` type extended with `playerId?: string` and `adpHistory?: AdpHistoryPoint[]`.
- `mapAdpEntry` now captures `player_id`; `loadWorkspaceData` fetches trend data in a follow-up request and merges it into entries by `player_id`.
- `AdpSparkline` component: 56×20 SVG polyline + endpoint dot + delta label. Green when ADP improved (pick number fell), red when declined, gray when flat. Falls back to "—" when only 1 snapshot exists.
- ADP table column header changed from "Trend" → "4-Wk Trend"; cell uses `AdpSparkline` instead of the old `TrendBadge`.

**Files changed:**
- `apps/api/app/api/routes/leagues.py` — `get_adp_trend` endpoint
- `apps/web/src/lib/mock-data.ts` — `AdpHistoryPoint` type; `ADPEntry.playerId` + `adpHistory` fields
- `apps/web/src/lib/api.ts` — `mapAdpEntry` captures `playerId`; `loadWorkspaceData` merges trend history
- `apps/web/src/components/dashboard/dashboard-app.tsx` — `AdpSparkline` component; ADP table column

#### 11. Draft Board Visual Grid ✅
Replaced both draft board views with a Sleeper-style grid.

**What was done:**

**Mock Draft Board (`MockDraftBoardPreview`):**
- Transposed from "rows = rounds, cells = teams" to "columns = rounds, rows = teams" — each team has a single row showing their entire draft from R1 → R{N}
- New sticky left column shows team name with an emerald dot for the user's team; entire user row has a subtle emerald tint
- Added `MockPickCell` (`React.forwardRef`) — each cell shows: pick #, player name (truncated with tooltip), `PositionBadge`, lock icon for Keeper slots
- Keeper cells: rose background + `Lock` icon
- Current-pick cell (live draft): amber outline highlight; auto-scroll centers it
- Open cells: zinc-tinted background, "Open" italic placeholder

**Final Draft Board (`DraftPickCell`):**
- Forfeited cells upgraded: rose bg + `Lock` icon + `PositionBadge` replacing the old `POSITION_COLORS` inline span
- Open cells kept minimal (pick # only, dimmer text)

**`POSITION_COLORS` constant:**
- Fixed QB↔TE color swap (QB was violet/should be amber; TE was amber/should be violet)
- Added K, DST, DEF entries (zinc)

**Files changed:**
- `apps/web/src/components/dashboard/dashboard-app.tsx` — `Lock` import; `POSITION_COLORS` fix; `MockPickCell` forwardRef component; `MockDraftBoardPreview` full rewrite; `DraftPickCell` upgraded

---

## Technical Reference

### Position Color Palette
```
QB  →  amber-300 border / amber-100 bg / amber-900 text
RB  →  emerald-300 border / emerald-100 bg / emerald-900 text
WR  →  sky-300 border / sky-100 bg / sky-900 text
TE  →  violet-300 border / violet-100 bg / violet-900 text
K   →  zinc-300 border / zinc-100 bg / zinc-600 text
DST →  zinc-300 border / zinc-100 bg / zinc-600 text
```

### Toast Variants Used
| Situation | Toast type |
|-----------|-----------|
| Successful save / import / action | `toast.success` |
| API/network error, "failed" outcome | `toast.error` |
| Degraded mode (mock data, no API) | `toast.warning` |
| Auth prompt, informational state | `toast.info` |

### Key Component Locations (dashboard-app.tsx)
| Component | Purpose |
|-----------|---------|
| `PositionBadge` | Color-coded position label using Badge variants |
| `PlayerCell` | Compound table cell: avatar + name + position + team |
| `PlayerAvatar` | Headshot or team-color fallback circle (xs/sm/md/lg) |
| `DraftCountdownRing` | SVG arc timer with color shift |
| `DraftCountdownRing` usage | Draft room header, renders when timer is active |
| `navGroups` | Section grouping constant for sidebar nav |
| `ScenarioTeamCell` | Keeper list in scenario comparison (fixed position colors) |
