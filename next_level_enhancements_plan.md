# Next-Level Enhancements Plan

This document captures the product roadmap beyond the current AI-backed feature set. All features described here are in scope for a **preseason keeper optimization and draft prep** product. In-season tools remain intentionally out of scope.

---

## Status as of June 2026

The core product is fully functional and deployed. All Tier 1, Tier 2, and several post-plan features have shipped:

- Keeper optimizer with composite ADP (DraftSharks + FFC 2QB + FFC PPR + Yahoo — weighted median, auto-refreshed weekly)
- AI keeper explanations, scenario narratives, strategy plans, bot picks, post-draft analysis
- Mock draft with 9 bot personalities × 3 difficulty levels, cross-season owner profiles in AI context
- Role-based auth, admin panel, CSV imports, Excel/CSV/PDF exports
- **Multi-league support** — any user can create leagues, switch between them, manage members, and upload per-league avatars; platform admin role sits above league admins
- **Sleeper league import** — preview + commit pattern; player matching by Sleeper ID then name+position fallback
- **Yahoo Fantasy league import** — OAuth2 flow, PPR detection, batch player name lookups, same preview/commit pattern
- **Keeper Trade Calculator** — dual-optimizer savepoint approach; AI verdict with surplus comparison, sensitivity toggle
- **Opponent Keeper Intelligence** — confidence-scored signals derived from recommendations; injected into mock draft AI strategy context
- **Historical Keeper ROI Tracker** — `KeeperOutcome` model with full economics; League/Team/Player drill-down views
- **End-of-Season Keeper Finalization Workflow** (4-step):
  1. Final Keeper Selections — admin finalizes per-team keepers, pre-populated from recommendations
  2. Sleeper Season Stats — fetches actual fantasy points and finish rank for each kept player
  3. End-of-Season Analysis — decision categorization (HIT / MISS / BUST / LEFT_ON_TABLE / DODGED / BELOW_ADP) with league ROI summary
  4. Final Draft Board — snake-draft grid showing forfeited keeper picks by round/team
- **Draft History / Owner Profiles** — cross-season pick data used to generate AI bot enrichment and real owner tendency profiles in mock draft strategy plans

The biggest remaining gaps are **auction league support** (entire excluded market segment), **viral surface area** (nothing shareable), and **commissioner tooling** (no reminders, compliance checks, or reveal mechanics).

---

## Tier 1 — Remove Friction

---

### ~~1.1 Sleeper League Import~~ ✅ Complete

Sleeper import shipped: `apps/api/app/services/sleeper_import.py` fetches league info, rosters, draft picks, and the full Sleeper player DB. Players are matched by Sleeper ID first (populates `Player.external_id` for fast re-import), then by name+position fallback. Two endpoints (`preview` / `commit`) follow the same preview-before-import pattern as CSV imports. The `SleeperImportPanel` UI lives at the top of League Data Imports.

---

### ~~1.1b Yahoo Fantasy League Import~~ ✅ Complete *(shipped after plan creation)*

Yahoo import shipped: `apps/api/app/services/yahoo_import.py` and `yahoo_oauth.py` implement a full OAuth2 flow (authorize → callback → token storage in `YahooOAuthToken`). Handles Yahoo API quirks: numeric-keyed collections, flattened team metadata, batch player name lookups, PPR detection via reception stat modifier. Same preview/commit pattern as Sleeper import. Users connect their Yahoo account via the League Data Imports panel.

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

---

### ~~2.1 Keeper Trade Calculator~~ ✅ Complete

Trade calculator shipped: `apps/api/app/services/trade_analysis.py` runs the optimizer twice — baseline and hypothetical — using a DB savepoint to apply temporary roster/pick changes without persisting them. The `POST /api/leagues/{league_id}/optimizer/trade-analysis` endpoint accepts give/receive player lists with optional per-player keeper cost round overrides. The frontend `TradeAnalyzerPage` provides team selection, checkbox pickers, a searchable receive panel with keeper round inputs, before/after surplus comparison, gained/lost keeper badges, and a "+1 round sensitivity" toggle. Optional AI narrative via the OpenAI Responses API.

---

### ~~2.2 Opponent Keeper Intelligence~~ ✅ Complete

Opponent intelligence shipped: `apps/api/app/services/keeper_signals.py` derives probable keeper choices for every team from existing `KeeperRecommendation` rows — no new DB table required. The `GET /api/leagues/{league_id}/keeper-signals` endpoint returns per-team signal objects with player name, position, ADP round, and a confidence score (normalised 0.6–1.0). Probable opponent keepers are injected into mock draft strategy plan context via `signals_to_strategy_context`. The `OpponentIntelligencePanel` frontend component lives in Mock Draft setup.

---

### ~~2.3 Historical Keeper ROI Tracker~~ ✅ Complete

Shipped: `KeeperOutcome` model and Alembic migration `20260602_0012` add a dedicated table with full keeper economics (cost, ADP at time of keep, keeper value, finish rank, fantasy points, `met_adp_projection`, `is_bust`). `keeper_history.py` service handles CSV preview/import and multi-year aggregation. Three new endpoints: preview, import, and history GET. The admin panel gains a Season Outcomes CSV card. A "Keeper History" nav entry renders three collapsible sections: League Season Summary, Team ROI, and Player History.

---

### ~~2.4 End-of-Season Keeper Finalization Workflow~~ ✅ Complete *(shipped after plan creation)*

Four-step guided workflow for closing out a keeper season:

- **Step 1 — Final Keeper Selections** (`apps/api/app/services/final_keepers.py`): Admin finalizes which players each team is actually keeping, pre-populated from optimizer recommendations. Selections are visible to all league members once locked.
- **Step 2 — Sleeper Season Stats** (`apps/api/app/services/sleeper_season_stats.py`): Fetches actual fantasy points and finish rank for each kept player via Sleeper API. Populates `KeeperOutcome` finish data.
- **Step 3 — End-of-Season Analysis** (`apps/api/app/services/season_analysis.py`): Categorizes every recommended player's outcome — HIT (kept, met projection), MISS (kept, underperformed), BUST (kept, bust), LEFT_ON_TABLE (not kept, would have hit), DODGED (not kept, was a bust), BELOW_ADP (correctly passed). Produces per-team and league ROI summary.
- **Step 4 — Final Draft Board**: Snake-draft grid showing which picks each team forfeited for their keepers, giving a visual preview of the upcoming draft's pick landscape.

---

## Tier 3 — Viral and Acquisition

---

### 3.1 Shareable Keeper Report Card

**Why it matters:** People share things that make them look smart. A one-page visual summary of a manager's keeper decisions — letter grade, surplus rounds captured, best/worst keeper, verdict — exportable as a PNG image card, would get shared in league group chats. It drives organic acquisition.

**Scope:**

- New export endpoint: `GET /api/leagues/{league_id}/teams/{team_id}/exports/keeper-card.png`
  - Renders a styled card: team name, league name, season year, overall grade, total surplus rounds, best keeper call, worst keeper call (if any busts), a single verdict line
  - Server-side render using `Pillow` (Python) or a Next.js API route that renders a React component to an image via `@vercel/og` or `html2canvas`
- Frontend: "Share" button in Team Outlook page → downloads the PNG card
- Design: clean dark card with league branding, position badges, round surplus indicators; readable at mobile share sizes

**Dependencies:** Requires keeper recommendations and optimizer results (already exist). Post-season outcome data from the ROI tracker and end-of-season analysis now available to improve the grade narrative.

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

---

### 4.1 Real-Time News → Keeper Value Alerts

**Why it matters:** An injury, trade, or depth chart change can shift a player's ADP by 5–10 rounds overnight, flipping a borderline keeper from a pass to a must-keep (or vice versa). The app already has a live news feed (`/news/fantasy-football` endpoint, powered by `news_feed.py`) — wiring it to the optimizer so it surfaces "this news affects your keeper value" would make users open the app throughout the offseason, not just at draft time.

**Current state:** `news_feed.py` fetches and caches RSS headlines. The news feed is live and displayed in the UI. What's missing is the optimizer-side impact analysis and the alert surface.

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

- New model inputs: player age (derivable from Sleeper's player database — already fetched during Sleeper import), position aging curves (built-in constants for QB/RB/WR/TE career arcs)
- New service: `apps/api/app/services/value_window.py`
  - Inputs: current ADP, current keeper cost, player age, position
  - Outputs: projected ADP in years 1, 2, 3 (applying position aging curve); projected keeper cost in each year (assuming same-team keeper escalation rule); projected value window (years where keeping is positive expected value)
- AI enhancement: narrative explaining the value window and when to consider trading the player instead of keeping
- Frontend: "Value Window" expandable section in Keeper Explanation modal — shows a simple bar or line chart of keep value by year; "Optimal keep through Year N" verdict

**Dependencies:** Player age data (available from Sleeper player DB since Sleeper import is live). Position aging curves are built-in constants.

---

## Priority Order

| Priority | Feature | Impact | Effort |
|----------|---------|--------|--------|
| ✅ | ~~Multi-League Dashboard (1.3)~~ | — | — |
| ✅ | ~~Sleeper League Import (1.1)~~ | — | — |
| ✅ | ~~Yahoo Fantasy League Import (1.1b)~~ | — | — |
| ✅ | ~~Keeper Trade Calculator (2.1)~~ | — | — |
| ✅ | ~~Opponent Keeper Intelligence (2.2)~~ | — | — |
| ✅ | ~~Historical Keeper ROI Tracker (2.3)~~ | — | — |
| ✅ | ~~End-of-Season Finalization Workflow (2.4)~~ | — | — |
| 1 | Auction Draft Mode (1.2) | Opens a large excluded market segment | High |
| 2 | Shareable Keeper Report Card (3.1) | Low effort, viral surface, organic acquisition | Low |
| 3 | Commissioner Tools Pack (3.2) | Acquisition via commissioners = leverage | Medium |
| 4 | News → Keeper Value Alerts (4.1) | Drives offseason re-engagement; news feed already live | Medium |
| 5 | Value Window Projection (4.2) | Depth feature for power users; player age data now available via Sleeper | Medium |

---

## What to Build Next

**Shareable Keeper Report Card (3.1)** is the lowest-effort next step with the highest viral upside — it leverages optimizer surplus data and the new end-of-season outcome categorizations (HIT/MISS/BUST) that are now live, making the grade meaningful. Effort is low (server-side PNG render via Pillow + one export endpoint + a "Share" button).

**Auction Draft Mode (1.2)** is the highest-impact unbuilt feature — it opens the entire auction keeper league segment that is currently excluded. It requires a parallel optimizer path and the FFC auction ADP endpoint, making it a heavier lift but the most strategically important gap remaining.

**News → Keeper Value Alerts (4.1)** is closer to done than it looks: `news_feed.py` and the news endpoint are already live. The remaining work is pattern-matching headlines to keeper candidates and adding one optimizer pass for ADP sensitivity.
