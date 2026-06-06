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
- `apps/web/src/components/sonner-toaster.tsx` — wrapper component
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

#### 8. Dashboard Homepage as a Real Dashboard ✅
**Was already done** — the `LeagueDashboard` component had been built out with MetricTile cards, League Briefing + Model Status, Top Keeper Decisions (3-column), Team Snapshot grid, and Draft Capital overview bars. Plan document was not updated when the code was written.

---

### Tier 3 — Larger Investment

#### 9. Dark Mode ✅
Added class-based dark mode infrastructure and applied it broadly across structural, dashboard, and shared UI components.

**What was done:**
- `globals.css` — `@custom-variant dark (&:where(.dark, .dark *))` + `color-scheme: dark` on `.dark`
- `layout.tsx` — inline FOUC-prevention script reads `localStorage("theme")` and adds `class="dark"` to `<html>` before paint; `suppressHydrationWarning` on `<html>`
- `useTheme()` hook in `dashboard-app.tsx` — reads `.dark` class state, toggles and persists to localStorage
- Moon/Sun toggle button added to the sticky header (right side, before ConnectionBadge)
- Structural layout: `<main>`, `<aside>`, `<header>`, nav items, sidebar footer card, user menu dropdown
- Dashboard components: MetricTile, MetricStrip, DashboardDecisionList, DashboardTeamSnapshotCard, DashboardNewsList, InfoLine, Draft Capital bars
- Auth/login screens

**Shared UI components dark-moded:**
- `card.tsx` — dark variants on Card, CardHeader, CardTitle, CardDescription
- `button.tsx` — dark variants on all variants (default, secondary, outline, ghost)
- `input.tsx` — dark border, bg, text, placeholder, focus ring, disabled state
- `textarea.tsx` — same dark treatment as Input
- `table.tsx` — dark variants on TableHeader, TableRow, TableHead, TableCell
- `data-table.tsx` — dark border, filter panel bg, sticky header bg, dropdown bg

**Not yet dark-moded** (view-specific pages — lower priority follow-up):
- Inner view pages: Recommendations, Trade Analyzer, Scenarios, Mock Draft, ADP, Admin, etc.
- Inner table rows within those views, modals, and form sections

---

#### 10. ADP Trend Mini-Charts ✅
Replaced the plain ADP number column with a sparkline showing multi-snapshot ADP movement. Rising (lower pick #) = green line + green delta, falling = red.

**What was done:**
- New backend endpoint `GET /api/leagues/{league_id}/adp-trend` queries the last N (default 4) `adp_snapshots` for the league and returns per-player `adp_pick` history in chronological order.
- `ADPEntry` type extended with `playerId?: string` and `adpHistory?: AdpHistoryPoint[]`.
- `mapAdpEntry` now captures `player_id`; `loadWorkspaceData` fetches trend data in a follow-up request and merges it into entries by `player_id`. Failure is silently swallowed so the table still renders without history.
- `AdpSparkline` component: 56×20 SVG polyline + endpoint dot + delta label. Green when ADP improved (pick number fell), red when declined, gray when flat. Falls back to "—" when fewer than 2 snapshots exist.
- ADP table column header changed from "Trend" → "4-Wk Trend"; cell uses `AdpSparkline` instead of the old text-only `TrendBadge`.

**Files changed:**
- `apps/api/app/api/routes/leagues.py` — `get_adp_trend` endpoint
- `apps/web/src/lib/mock-data.ts` — `AdpHistoryPoint` type; `ADPEntry.playerId` + `adpHistory` fields
- `apps/web/src/lib/api.ts` — `mapAdpEntry` captures `playerId`; `loadWorkspaceData` merges trend history
- `apps/web/src/components/dashboard/dashboard-app.tsx` — `AdpSparkline` component; ADP table column

---

#### 11. Draft Board Visual Grid ✅
Replaced both draft board views with a Sleeper-style grid (columns = rounds, rows = teams).

**Mock Draft Board (`MockDraftBoardPreview`):**
- Transposed from "rows = rounds, cells = teams" to "columns = rounds, rows = teams" — each team has a single row showing their entire draft from R1 → R{N}
- Sticky left column shows team name; user's row has an emerald dot + emerald tint
- Added `MockPickCell` (`React.forwardRef<HTMLTableCellElement>`) — each cell shows: pick #, player name (truncated + tooltip), `PositionBadge`, lock icon for Keeper slots
- Keeper cells: rose background + `Lock` icon
- Current-pick cell (live draft): amber outline highlight; auto-scroll centers it in view
- Open cells: zinc-tinted background, "Open" italic placeholder

**Final Draft Board (`DraftPickCell`):**
- Forfeited cells upgraded: rose bg + `Lock` icon + `PositionBadge` replacing the old `POSITION_COLORS` inline span
- Open cells kept minimal (pick # only, dimmer text)

**`POSITION_COLORS` constant (bug fix):**
- QB and TE colors were swapped (QB was violet, TE was amber — opposite of the established palette). Fixed.
- Added K, DST, DEF entries (zinc)

**Files changed:**
- `apps/web/src/components/dashboard/dashboard-app.tsx` — `Lock` import; `POSITION_COLORS` fix; `MockPickCell` forwardRef component; `MockDraftBoardPreview` full rewrite; `DraftPickCell` upgraded

---

#### 12. Draft Board Grid Unification ✅
Extended the Sleeper-style team-row × round-column grid from Mock Draft to **Draft Impact** and **Final Draft Board** so all three boards share the same visual language and orientation.

**Draft Impact (`DraftBoardPreview`):**
- Replaced the round-row div-card layout with the same `border-collapse` table structure used by `MockDraftBoardPreview`
- Teams as rows ordered by round-1 draft position; rounds as columns with `R{n}` dark pills
- Sticky left team-name column; user's team row highlighted in emerald (dot + tint)
- Cells: pick number, `Lock` icon + player name + `PositionBadge` for forfeited picks; italic "Open" for available slots

**Final Draft Board (`DraftBoardPage` / `DraftPickCell`):**
- Grid orientation flipped from round-rows × team-columns to **team-rows × round-columns** — same as Mock Draft and Draft Impact
- Added `currentUser` from `useDashboard()` so the signed-in user's team row highlights in emerald
- Added 4-metric strip: Forfeited Picks / Open Picks / Teams / Rounds
- Forfeited Picks Summary below the grid redesigned from a `<table>` to styled rose card rows with `PositionBadge`
- `DraftPickCell` updated with `min-w-[116px] border-r border-zinc-100` classes matching the new layout

**Files changed:**
- `apps/web/src/components/dashboard/dashboard-app.tsx` — `DraftBoardPreview` full rewrite; `DraftBoardPage` grid + metrics overhaul; `DraftPickCell` border classes updated

---

### Bug Fixes (found during modernization work)

#### Mock Draft PlayerCell missing imageUrl ✅
The `MockAvailablePlayer` type has `imageUrl: string | null` but `PlayerCell` in the mock draft table wasn't passing it — so players always showed the team-color fallback circle instead of their headshot. Fixed by adding `imageUrl={player.imageUrl}` to the call.

#### Backfill script missed suffixed names ✅
**Problem:** `backfill_player_images.py` matched by `full_name.lower()|position`. Sleeper stores "James Cook" / "Kenneth Walker"; our DB stores "James Cook III" / "Kenneth Walker III". The keys never matched → no image.

**Fix:** Added `_strip_suffix()` (strips Jr./Sr./II/III/IV/V/VI) and indexed each Sleeper player under both their original name and the suffix-stripped name. DB-side matching also tries the stripped fallback key. Result: 18 additional players got images including James Cook III, Kenneth Walker III, Chris Rodriguez Jr., Marvin Mims Jr., Ollie Gordon II.

**Files changed:**
- `apps/api/backfill_player_images.py`

---

## What to Build Next

These were not in the original plan but emerged as natural follow-ons during this work:

- **Dark mode — inner view pages**: Recommendations, Trade Analyzer, Scenarios, Mock Draft, ADP, Admin pages still use light-only colors in dark mode. Tables, modals, and form sections within those views need dark variants.
- **Mobile layout**: The sidebar nav collapses poorly on small screens. A bottom tab bar or slide-in drawer would make the app usable on mobile.
- **Live draft pick animation**: When a bot makes a pick during mock draft, the pick cell could animate in (fade + slide) rather than snapping in on re-render.
- **Position filter chips on ADP table**: Quick-filter buttons (All / QB / RB / WR / TE) above the ADP table to narrow the board by position.
- **Draft board color density**: Consider using position colors (not just rose/white) as subtle cell backgrounds in the mock draft grid — each drafted pick's cell tinted by position — for faster visual scanning.

---

## Technical Reference

### Position Color Palette
```
QB  →  amber-300 border / amber-100 bg / amber-800 text    (Badge variant: qb)
RB  →  emerald-300 border / emerald-100 bg / emerald-800 text  (Badge variant: rb)
WR  →  sky-300 border / sky-100 bg / sky-800 text          (Badge variant: wr)
TE  →  violet-300 border / violet-100 bg / violet-800 text  (Badge variant: te)
K   →  zinc-300 border / zinc-100 bg / zinc-600 text        (Badge variant: k)
DST →  zinc-300 border / zinc-100 bg / zinc-600 text        (Badge variant: dst)
```

Also expressed in `POSITION_COLORS` (Tailwind class strings) for inline `<span>` use in Draft Board and Season Analysis pages.

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
| `PositionBadge` | Color-coded position label using Badge CVA variants |
| `PlayerCell` | Compound table cell: avatar + name + position badge + NFL team |
| `PlayerAvatar` | Headshot or team-color fallback circle (xs/sm/md/lg sizes) |
| `AdpSparkline` | 56×20 SVG sparkline with delta label for ADP trend column |
| `DraftCountdownRing` | SVG arc timer with emerald/amber/red color shift |
| `MockPickCell` | forwardRef `<td>` for mock draft board grid cells |
| `DraftBoardPreview` | team-row × round-column grid for Draft Impact (matches MockDraftBoardPreview) |
| `DraftPickCell` | `<td>` for Final Draft Board grid cells |
| `navGroups` | Section grouping constant for sidebar nav |
| `ScenarioTeamCell` | Keeper list in scenario comparison (uses PositionBadge) |
