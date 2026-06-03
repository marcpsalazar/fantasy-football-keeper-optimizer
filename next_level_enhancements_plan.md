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

The biggest remaining gaps are **auction league support** (entire excluded market segment) and **engagement hooks** (news-driven alerts, multi-year projections). Commissioner tooling and the shareable report card have shipped.

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

### ~~3.1 Shareable Keeper Report Card~~ ✅ Complete

Shipped: `apps/api/app/services/keeper_card.py` renders a 900×500 PNG card using Pillow. Queries the team's Default-scenario recommendations to compute total surplus rounds, assigns a letter grade (A ≥ 10 / B ≥ 6 / C ≥ 2 / D < 2), and draws a dark card with: league/year header, team name + owner, per-keeper position-coloured rows with surplus rounds, grade circle, surplus stat, best pick, and a verdict footer. Font resolution tries macOS → Ubuntu system fonts in order, falls back to Pillow's built-in default. `GET /api/leagues/{league_id}/teams/{team_id}/exports/keeper-card.png` endpoint added to `leagues.py`. Each `OutlookCard` on the Team Outlooks page gains a Share button: on mobile it calls `navigator.share({ files: [pngFile] })` to open the native OS share sheet (covering Instagram, Facebook, X, Messages, etc.); on desktop it falls back to a file download. `pillow>=10.1.0` added to `pyproject.toml`.

---

### ~~3.2 Commissioner Tools Pack~~ ✅ Complete

Shipped: a dedicated **Commissioner Tools** tab (admin-only, Wrench icon) with five panels:

- **League Dates** — all four season dates in one place: keeper pick deadline, draft date, keeper reveal date, regular season start. Consolidated from the former Admin > League Dates panel so commissioners manage the full calendar from one screen.
- **Keeper Rule Compliance Checker** (`apps/api/app/services/compliance.py`) — runs automatically on page load; per-team pass/fail table against four rules: max keepers, max per position, max QB keepers, cost validity (cost ≥ 1). Red rows highlight violations; lists invalid-cost player names explicitly. `GET /api/leagues/{id}/commissioner/compliance`.
- **Keeper Reveal** — date-gated reveal: before `keeper_reveal_date`, each user sees only their own team's keepers; on or after the reveal date, all teams' selections become visible league-wide. `GET /api/leagues/{id}/reveal`. Commissioner panel shows a live preview of what each team currently sees.
- **Keeper Deadline Reminders** (`apps/api/app/services/notifications.py`) — sends an HTML + plain-text reminder email to every active league member with a linked account. Dry-run mode previews the recipient list without sending. SMTP configured via `SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` env vars. `POST /api/leagues/{id}/commissioner/reminders/send`.
- **Bulk Export** (`apps/api/app/services/bulk_export.py`) — single-click ZIP containing one team outlook PDF per team, a combined all-teams PDF, and the full Excel keeper recommendations workbook. `GET /api/leagues/{id}/exports/bulk`.

New league fields: `draft_date`, `keeper_reveal_date` (migration `20260602_0015`). Admin tab no longer contains date settings — all four dates live in Commissioner Tools.

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
| ✅ | ~~Shareable Keeper Report Card (3.1)~~ | — | — |
| ✅ | ~~Commissioner Tools Pack (3.2)~~ | — | — |
| 1 | Auction Draft Mode (1.2) | Opens a large excluded market segment | High |
| 2 | News → Keeper Value Alerts (4.1) | Drives offseason re-engagement; news feed already live | Medium |
| 3 | Value Window Projection (4.2) | Depth feature for power users; player age data now available via Sleeper | Medium |

---

## What to Build Next

**Auction Draft Mode (1.2)** is the highest-impact unbuilt feature — it opens the entire auction keeper league segment that is currently excluded. It requires a parallel optimizer path and the FFC auction ADP endpoint, making it a heavier lift but the most strategically important gap remaining.

**News → Keeper Value Alerts (4.1)** is closer to done than it looks: `news_feed.py` and the `/news/fantasy-football` endpoint are already live. The remaining work is pattern-matching headlines to keeper candidates and adding one optimizer pass per candidate for ADP sensitivity.

**Value Window Projection (4.2)** is a pure depth feature — player age is already available from the Sleeper player DB. The value is high for power users doing multi-year roster construction.
