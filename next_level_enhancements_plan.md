# Next-Level Enhancements Plan

This document captures the product roadmap beyond the current AI-backed feature set. All features described here are in scope for a **preseason keeper optimization and draft prep** product. In-season tools remain intentionally out of scope.

---

## Status at Plan Creation

The core product is fully functional and deployed:

- Keeper optimizer with composite ADP (DraftSharks + FFC weighted median)
- AI keeper explanations, scenario narratives, strategy plans, bot picks, post-draft analysis
- Mock draft with 9 bot personalities × 3 difficulty levels
- Role-based auth, admin panel, CSV imports, Excel/CSV/PDF exports
- **Multi-league support** — any user can create leagues, switch between them, manage members, and upload per-league avatars; platform admin role sits above league admins *(shipped after plan creation)*

The biggest product gaps are not AI-depth — they are **onboarding friction** (manual CSVs), **market coverage** (auction leagues unsupported), and **viral surface area** (nothing shareable, no network effects).

---

## Tier 1 — Remove Friction

These are the highest-priority improvements because they determine whether new users adopt the app or leave before seeing its value.

---

### ~~1.1 Sleeper League Import~~ ✅ Complete

Sleeper import shipped: `apps/api/app/services/sleeper_import.py` fetches league info, rosters, draft picks, and the full Sleeper player DB. Players are matched by Sleeper ID first (populates `Player.external_id` for fast re-import), then by name+position fallback. Two endpoints (`preview` / `commit`) follow the same preview-before-import pattern as CSV imports. The `SleeperImportPanel` UI lives at the top of League Data Imports: enter a Sleeper league ID, preview a team table with pick/roster counts and warnings, then import in one click.

---

### 1.2 Auction Draft Mode

**Why it matters:** A large segment of keeper leagues use auction format. In auction keeper leagues, the keeper cost is a retained salary (dollar value), not a draft pick. The entire optimizer math — `Keeper Value = Cost Pick - ADP Pick` — does not apply. Without this, the app is useless for auction leagues.

**Scope:**

- New `draft_format` field on `League` model: `snake` (existing) | `auction`
- Parallel optimizer path in `apps/api/app/services/optimizer.py`:
  - Keeper value becomes `ADP Dollar Value - Retained Salary`
  - ADP dollar values sourced from FFC auction data (`https://fantasyfootballcalculator.com/api/v1/adp/auction`)
  - All bonus/penalty terms reformulated in dollar units
- `OptimizerSettings` gains `budget_per_team`, `max_keeper_salary_pct` fields
- Frontend: auction-mode toggle in league settings; salary column replaces pick cost column in Keeper Recommendations table

**Dependencies:** FFC auction ADP endpoint (already fetching from FFC; add auction format parameter).

---

### ~~1.3 Multi-League Dashboard~~ ✅ Complete

Multi-league support shipped: users can create leagues, switch between them via the profile menu, manage league members and roles (league admin / member / platform admin), and upload per-league avatars. The implicit single-league assumption has been removed from both the frontend and backend.

---

## Tier 2 — Unique Differentiation

These features have no direct equivalent in competing tools. They represent the strongest arguments for why this product is worth paying for.

---

### 2.1 Keeper Trade Calculator

**Why it matters:** Keeper leagues are defined by trade strategy, and no tool evaluates trades in keeper cost terms. The trade calculator answers: "If I trade for Player X with a Year 2 keeper cost of Pick Y, what does my optimal keeper set become, and what's the net value swing vs. what I'm giving up?" The optimizer already solves the hard part — this is a UI and hypothetical re-run wrapper around it.

**Scope:**

- New endpoint: `POST /api/leagues/{league_id}/optimizer/trade-analysis`
  - Body: `{ give: [{player_id, team_id}], receive: [{player_id, keeper_cost_override}] }`
  - Runs optimizer twice: current state, then hypothetical post-trade state
  - Returns: current vs. projected keeper sets, delta in total surplus rounds, net recommendation change per team
- AI layer: optional narrative explaining the tradeoff
  - Inputs: trade summary, pre/post optimizer results, positional context
  - Output: `{ verdict: "good/neutral/bad", summary, key_risk, opportunity_cost }`
- Frontend: "Trade Analyzer" tab within Keeper Recommendations page
  - Drag-and-drop or dropdown pickers for give/receive players
  - Shows before/after keeper tables side by side with delta highlighted
  - One-click "What if I extend the keeper cost by 1 round?" sensitivity toggle

**Dependencies:** Requires Phase 2.2 (Opponent Keeper Intelligence) to be fully accurate, but useful standalone.

**Acceptance criteria:**
- Trade analysis reruns the optimizer with hypothetical roster changes without writing to the DB
- Delta calculation is accurate (net rounds gained vs. lost)
- AI narrative correctly identifies the dominant consideration (value, positional fit, pick savings)

---

### 2.2 Opponent Keeper Intelligence

**Why it matters:** When multiple teams in the same league use the app, their individually optimal keeper sets can be inferred and fed back into each other's analysis. If you know opponents are likely to keep Ja'Marr Chase, his value to you in the draft changes because he is no longer available. This creates network effects — every additional leaguemate makes the app more valuable for everyone.

**Scope:**

- New model: `TeamKeeperSignal` — stores whether a team's assigned user has run the optimizer, and what their top recommendations are (not keepers they've committed to, just signals)
- New endpoint: `GET /api/leagues/{league_id}/keeper-signals` — returns inferred keeper signals for all teams (admin-visible; individual user sees only their own team + aggregate impact)
- Optimizer enhancement: optional `exclude_probable_keepers` flag — if enabled, probable opponent keepers (above a confidence threshold) are removed from the draft pool before running mock strategy analysis
- Frontend: "Opponent Intelligence" section in Mock Draft setup — shows which players opposing teams are likely to keep, and how that affects available-at-your-slot projections
- Privacy: individual team keeper choices are not exposed to other league members without consent; signals are based on optimizer recommendations, not explicit commitments

**Dependencies:** Requires multi-user league setup (already exists). Requires league-wide optimizer results (already exists).

---

### 2.3 Historical Keeper ROI Tracker

**Why it matters:** Year-over-year data is a defensible moat. If the app tracks whether past keeper decisions paid off — did they finish in the top 12? did the ADP hold? — it gives users a reason to come back every offseason and builds unique per-league historical data no external source has.

**Scope:**

- New `season_year` dimension on all optimizer result records (already present on `League`)
- New model: `KeeperOutcome` — records final season finish (fantasy points or rank), whether keeper met their ADP projection, and a boolean "bust" flag
- Admin import: end-of-season results CSV (player, team, finish rank, fantasy points total)
- New endpoint: `GET /api/leagues/{league_id}/keeper-history` — returns multi-year keeper ROI summary per team and per player
- Frontend: "Keeper History" tab in the League Dashboard
  - League-level: average surplus rounds captured per year; % of recommended keepers who hit their ADP projections
  - Team-level: individual manager's keeper ROI track record
  - Player-level: historical keeper cost vs. actual finish — useful for recurring keeper candidates

**Dependencies:** Requires historical data accumulated over at least one prior season. Can be bootstrapped by letting admins manually enter prior-year outcomes via CSV.

---

## Tier 3 — Viral and Acquisition

These features grow the user base by making outputs shareable and by targeting commissioners as the acquisition channel.

---

### 3.1 Shareable Keeper Report Card

**Why it matters:** People share things that make them look smart. A one-page visual summary of a manager's keeper decisions — letter grade, surplus rounds captured, best/worst keeper, verdict — exportable as a PNG image card, would get shared in league group chats. It drives organic acquisition.

**Scope:**

- New export endpoint: `GET /api/leagues/{league_id}/teams/{team_id}/exports/keeper-card.png`
  - Renders a styled card: team name, league name, season year, overall grade, total surplus rounds, best keeper call, worst keeper call (if any busts), a single verdict line
  - Server-side render using `Pillow` (Python) or a Next.js API route that renders a React component to an image via `@vercel/og` or `html2canvas`
- Frontend: "Share" button in Team Outlook page → downloads the PNG card
- Design: clean dark card with league branding, position badges, round surplus indicators; readable at mobile share sizes

**Dependencies:** Requires keeper recommendations and optimizer results (already exist). Optional: post-season outcome data from the ROI tracker improves the "grade" narrative.

---

### 3.2 Commissioner Tools Pack

**Why it matters:** Commissioners choose the platform for the whole league. One convinced commissioner brings 10+ new users. Giving commissioners tools they actually need on draft day — deadline reminders, a compliance checker, a league-wide keeper reveal — makes the app a commissioner platform, not just a personal optimizer.

**Scope:**

- **Keeper Deadline Reminder Emails:** commissioner enters draft date and keeper deadline; app sends reminder emails to all league members with assigned accounts 7 days and 2 days before deadline. Uses `sendgrid` or `SMTP` via a new `apps/api/app/services/notifications.py`.
- **Keeper Rule Compliance Checker:** before the draft, shows a table of all teams with a pass/fail per rule (max keepers, max per position, max QB, cost validity). Red badge if any team is over limits, green if all teams are compliant.
- **League-Wide Keeper Reveal Page:** commissioner sets a "reveal date"; before that date, individual users see only their own keepers; on reveal date, a public `/leagues/{league_id}/reveal` page shows all teams' keepers simultaneously. Creates anticipation and is shareable.
- **Bulk Export:** single-click export of all teams' keeper reports as a ZIP of PDFs or a single multi-team Excel workbook.

**Dependencies:** User account + email system (auth exists; email delivery is new). Reveal page needs a `keeper_locked` field on `Team`.

---

## Tier 4 — Depth and Retention

These features increase the value of the app for power users who return year-round.

---

### 4.1 Real-Time News → Keeper Value Alerts

**Why it matters:** An injury, trade, or depth chart change can shift a player's ADP by 5–10 rounds overnight, flipping a borderline keeper from a pass to a must-keep (or vice versa). The app already has a news feed — wiring it to the optimizer so it surfaces "this news affects your keeper value" would make users open the app throughout the offseason, not just at draft time.

**Scope:**

- News feed ingestion service (already exists) monitors headlines for player names matching active keeper candidates
- New endpoint: `POST /api/leagues/{league_id}/optimizer/news-impact` — given a player and a projected new ADP, returns updated keeper value and recommendation change
- Frontend: "Impact Alerts" banner in League Dashboard when a news story matches a keeper candidate and the new ADP would change their recommendation status
- ADP sensitivity display: in Keeper Recommendations, a "Would flip at ADP X" annotation showing how far ADP needs to move before the recommendation changes

**Dependencies:** News feed (exists). ADP sensitivity requires one additional optimizer pass per candidate with modified ADP — computationally cheap.

---

### 4.2 Value Window Multi-Year Projection

**Why it matters:** "Keep now or let go" is a multi-year decision. A 30-year-old WR on a declining ADP trajectory is a different keeper than a 23-year-old breakout candidate. Showing a player's expected keeper cost trajectory over 2–3 seasons — and when they stop being a value keep — is unique and actionable.

**Scope:**

- New model inputs: player age (derivable from NFL player data), position aging curves (built-in constants for QB/RB/WR/TE career arcs)
- New service: `apps/api/app/services/value_window.py`
  - Inputs: current ADP, current keeper cost, player age, position
  - Outputs: projected ADP in years 1, 2, 3 (applying position aging curve); projected keeper cost in each year (assuming same-team keeper escalation rule); projected value window (years where keeping is positive expected value)
- AI enhancement: narrative explaining the value window and when to consider trading the player instead of keeping
- Frontend: "Value Window" expandable section in Keeper Explanation modal — shows a simple bar or line chart of keep value by year; "Optimal keep through Year N" verdict

**Dependencies:** Player age data (can be seeded from Sleeper's player database if Sleeper import is implemented, otherwise from a static table). Position aging curves are built-in constants.

---

## Priority Order

| Priority | Feature | Impact | Effort |
|----------|---------|--------|--------|
| ✅ | ~~Multi-League Dashboard (1.3)~~ | — | — |
| ✅ | ~~Sleeper League Import (1.1)~~ | — | — |
| 1 | Keeper Trade Calculator (2.1) | Unique differentiator; no competing tool does this | Medium-High |
| 3 | Auction Draft Mode (1.2) | Opens a large excluded market segment | High |
| 4 | Shareable Keeper Report Card (3.1) | Low effort, viral surface, organic acquisition | Low |
| 5 | Commissioner Tools Pack (3.2) | Acquisition via commissioners = leverage | Medium |
| 6 | Historical Keeper ROI Tracker (2.3) | Long-term data moat; requires at least one full season | Medium |
| 7 | Opponent Keeper Intelligence (2.2) | Network effects; valuable but requires multi-user adoption | Medium |
| 8 | News → Keeper Value Alerts (4.1) | Drives offseason re-engagement | Medium |
| 9 | Value Window Projection (4.2) | Depth feature for power users | Medium |

---

## What to Build First

**Keeper Trade Calculator** is next.

Sleeper import is complete. The trade calculator is the feature most likely to be written about in fantasy football communities — it is genuinely unique, it is directly actionable, and it leverages the optimizer infrastructure already built.

The shareable report card (3.1) is a low-effort companion once the mock draft grading is already producing letter grades and surplus summaries — it is worth adding shortly after the first two.
