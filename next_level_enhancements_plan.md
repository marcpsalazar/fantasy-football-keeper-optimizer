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

### ~~2.1 Keeper Trade Calculator~~ ✅ Complete

Trade calculator shipped: `apps/api/app/services/trade_analysis.py` runs the optimizer twice — baseline and hypothetical — using a DB savepoint to apply temporary roster/pick changes without persisting them. The `POST /api/leagues/{league_id}/optimizer/trade-analysis` endpoint accepts give/receive player lists with optional per-player keeper cost round overrides. The frontend `TradeAnalyzerPage` (reachable via "Trade Analyzer" in the sidebar) provides team selection, checkbox pickers for given-away players, a searchable receive panel with keeper round inputs, before/after surplus comparison, gained/lost keeper badges, and a "+1 round sensitivity" toggle. Optional AI narrative (verdict + summary + key risk + opportunity cost) is generated via the same OpenAI Responses API pattern used elsewhere. `FinalRosterEntry` type extended with `teamId` and `playerId` to support roster-based player lookups in the frontend.

---

### ~~2.2 Opponent Keeper Intelligence~~ ✅ Complete

Opponent intelligence shipped: `apps/api/app/services/keeper_signals.py` derives probable keeper choices for every team directly from existing `KeeperRecommendation` rows — no new DB table required. The `GET /api/leagues/{league_id}/keeper-signals` endpoint returns per-team signal objects with player name, position, ADP round, and a confidence score (normalised 0.6–1.0 from keeper_score within the team's recommended set). Running the optimizer is treated as implicit consent to share recommendations as signals; league admins see all teams' details. Probable opponent keepers are also injected into the mock draft strategy plan context via `signals_to_strategy_context`, so AI plans account for players likely off the board before pick 1. The `OpponentIntelligencePanel` frontend component lives in Mock Draft setup — it expands to show each opponent's probable keepers as position-coloured chips (player name, position badge, ADP round) and a summary of the position breakdown across all signals.

---

### ~~2.3 Historical Keeper ROI Tracker~~ ✅ Complete

Shipped. `KeeperOutcome` model and Alembic migration `20260602_0012` add a dedicated table with full keeper economics (cost, ADP at time of keep, keeper value, finish rank, fantasy points, `met_adp_projection`, `is_bust`). `keeper_history.py` service handles CSV preview/import and multi-year aggregation. Three new endpoints: `POST /api/leagues/{league_id}/keeper-outcomes/preview`, `POST /api/leagues/{league_id}/keeper-outcomes/import`, and `GET /api/leagues/{league_id}/keeper-history`. The admin panel gains a Season Outcomes CSV card. A new "Keeper History" nav entry renders three collapsible sections: League Season Summary (keepers kept, % hit ADP, bust rate, avg surplus), Team ROI (per-team breakdown with expandable outcome rows), and Player History (sorted by times kept, with per-player outcome drill-down).

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
| ✅ | ~~Keeper Trade Calculator (2.1)~~ | — | — |
| ✅ | ~~Opponent Keeper Intelligence (2.2)~~ | — | — |
| 3 | Auction Draft Mode (1.2) | Opens a large excluded market segment | High |
| 4 | Shareable Keeper Report Card (3.1) | Low effort, viral surface, organic acquisition | Low |
| 5 | Commissioner Tools Pack (3.2) | Acquisition via commissioners = leverage | Medium |
| ✅ | ~~Historical Keeper ROI Tracker (2.3)~~ | — | — |
| 7 | News → Keeper Value Alerts (4.1) | Drives offseason re-engagement | Medium |
| 8 | Value Window Projection (4.2) | Depth feature for power users | Medium |

---

## What to Build Next

**Shareable Keeper Report Card (3.1)** or **Auction Draft Mode (1.2)** are the top candidates. With 2.2 and 2.3 both shipped, the entire Tier 2 intelligence features are now live.

The trade calculator and opponent intelligence are complete. The report card (3.1) is low effort and viral — it leverages the optimizer surplus data already computed and would get shared in league group chats. Auction mode (1.2) opens a large excluded market segment but requires a parallel optimizer path and new ADP source integration.
