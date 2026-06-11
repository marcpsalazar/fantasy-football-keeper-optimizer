# In-Season Tools Suite — Implementation Plan

## Context

The app is feature-complete for pre-season keeper optimization and mock drafting as of June 2026. The next growth vector is in-season tooling: live standings, weekly matchup views, waiver wire, start/sit, injury alerts, and strategy recommendations. These are table-stakes for daily engagement once the season starts.

The unique opportunity is delivering every in-season tool through a **keeper/dynasty lens** — something no existing platform (ESPN, Yahoo, Sleeper, FantasyPros) does. Waiver wire pickups rated by keeper value. Injury alerts that answer "does this hurt my keeper decision?" Start/sit advice that flags which players are on your keeper watch list. This framing turns a commodity feature set into a genuine differentiator for the keeper/dynasty market.

A second driver is UX: the existing nav presents ~15 items regardless of season phase. A seasonal UX (pre-season / in-season / post-season) dramatically reduces cognitive load and makes the app feel purpose-built rather than a feature dump.

---

## Competitive Analysis

### What major platforms offer today

| Feature | ESPN | Yahoo | Sleeper | FantasyPros | This App (today) |
|---------|------|-------|---------|-------------|-----------------|
| Start/sit recommendations | ✅ | ✅ | ❌ | ✅ | ❌ |
| Waiver wire rankings | ✅ | ✅ | ✅ (trending) | ✅ | ❌ |
| Injury reports | ✅ | ✅ | ✅ | ✅ | Partial (news only) |
| Live scoring | ✅ | ✅ | ✅ | ❌ | ❌ |
| Trade analyzer | ✅ | ✅ | ❌ | ✅ | ✅ (keeper-aware) |
| Power rankings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Cross-platform view | ❌ | ❌ | ❌ | Partial | ✅ (Yahoo+Sleeper+ESPN) |
| Keeper value context | ❌ | ❌ | ❌ | ❌ | ✅ |
| Multi-year player outlook | ❌ | ❌ | ❌ | ❌ | ✅ |
| Dynasty-specific tools | ❌ | ❌ | ❌ | ❌ | ✅ |

### What this app can own

**1. Keeper-aware waiver wire** — rate every available player by both this-week projected points AND next-year keeper value ("Pacheco: +6.2 round surplus if kept"). No competitor does this.

**2. Injury alerts with keeper decision context** — the existing `flip_adp_round` from `news_impact.py` is exactly this framework: "CMC on IR → his ADP likely rises to Rd 4, your cost is Rd 5 → he stops being a keeper value. Watch list." ESPN/Yahoo/Sleeper show injuries with zero keeper context.

**3. Cross-platform in-season view** — this app already imports from Yahoo, Sleeper, and ESPN. Extending the same infrastructure for in-season sync creates a unified view no single-platform tool can match.

**4. Trade analyzer with season-context verdicts** — the existing savepoint optimizer already does keeper-aware trade grading. Layering in Week N record + performance produces contextually-aware verdicts: "Team A is 1-8 — trading keeper value for a win-now push is the right call."

**5. `[KEEPER]` badge everywhere** — any player flagged by the optimizer gets this badge in every in-season view. A persistent visual link between pre-season analysis and every in-season decision.

---

## UX Architecture: Seasonal Modes

### Mode Detection

Season mode is computed from `League.regular_season_start_date` (already stored):

| Mode | Condition |
|------|-----------|
| `preseason` | today < start_date (or no start date set) |
| `in_season` | start_date ≤ today ≤ start_date + 17 weeks |
| `postseason` | today > start_date + 17 weeks |

A `season_mode_override` field on `League` lets admins force a mode for testing.

### Navigation Structure

The existing `navGroups` array in `dashboard-app.tsx` becomes conditional on `seasonMode`. Key decision: **do not hide pre-season tools in-season** — dynasty/keeper players re-run the optimizer mid-season. Collapse them into a secondary group, not removed.

**Pre-season (unchanged):**
- Keeper Tools: Recommendations, Trade Analyzer, Scenarios, Draft Impact, Outlooks
- Draft Room: Mock Draft, Keeper History, Final Keepers, Draft Board
- League Data: Teams, Draft Results, Final Rosters, Settings

**In-season (new primary group + pre-season collapsed to secondary):**
- **In-Season Tools** (primary):
  - Dashboard — weekly summary + top keeper alerts
  - My Team / Roster — current lineup with `[KEEPER]` badges + injury status
  - This Week's Matchup — side-by-side lineup vs opponent
  - Standings — live league table
  - Waiver Wire + Keeper Value — **key differentiator**
  - Start/Sit Advisor — projected points + keeper watch list annotations
  - Injury Alerts — enhanced existing news alerts
  - Trade Analyzer — in-season mode with record context
- Keeper Tools (collapsed, same links)
- League Data (unchanged)

**Post-season (existing features, reorganized):**
- Season Wrap-Up: Season Analysis, Keeper Outcomes, Final Draft Board

### Season Mode Banner

A persistent strip at the top of every in-season page:
> `"Week 9 in progress · Last synced 2h ago · [Sync Now]"`

Clicking "Sync Now" triggers `POST /api/leagues/{id}/in-season/sync`.

---

## Data Architecture

### Prerequisite: League External ID Persistence

External platform IDs (Sleeper league ID, Yahoo league key, ESPN league ID) are passed at import time but not stored. This must be fixed before reliable automated sync is possible.

Add to `League` model (`apps/api/app/models/league.py`):

```python
platform: str | None               # "sleeper" | "yahoo" | "espn"
external_league_id: str | None     # stored at first successful import
current_week: int | None           # cached, refreshed by sync
season_mode_override: str | None   # admin override for testing
```

Backfill by updating `commit_sleeper_import`, `commit_yahoo_import`, `commit_espn_import` to write these fields after a successful commit.

### New Models (`apps/api/app/models/in_season.py`)

**`InSeasonRosterEntry`**

```python
league_id: UUID                     # FK → leagues.id
team_id: UUID                       # FK → teams.id
player_id: UUID                     # FK → players.id
season_year: int
scoring_period: int                 # NFL week 1–18
lineup_slot: str                    # QB / RB / WR / TE / FLEX / BN / IR
is_starter: bool
injury_status: str | None           # Active / Q / D / IR / Out
projected_points: float | None
actual_points: float | None
```

Unique: `(league_id, team_id, player_id, season_year, scoring_period)`. Replaces `FinalRosterEntry` for in-season use; the existing model stays for pre-season data.

**`WeeklyProjection`**

```python
player_id: UUID                     # FK → players.id
season_year: int
week: int
projected_points: float
source: str                         # "sleeper" | "fantasynerd"
opponent_nfl_team: str | None
fetched_at: datetime
```

Unique: `(player_id, season_year, week, source)`. Populated from Sleeper's free `/projections/nfl/regular/{year}/{week}` endpoint. FantasyNerds is the premium upgrade (key already in Settings).

**`LeagueMatchup`**

```python
league_id: UUID
season_year: int
week: int
team_a_id: UUID
team_b_id: UUID
team_a_projected: float | None
team_b_projected: float | None
team_a_actual: float | None
team_b_actual: float | None
team_a_won: bool | None             # null = in progress
status: str                         # "upcoming" | "in_progress" | "complete"
```

**`TeamStandings`**

```python
league_id: UUID
team_id: UUID
season_year: int
week: int                           # snapshot after this week completes
wins: int
losses: int
ties: int
points_for: float
points_against: float
waiver_priority: int | None
```

### FAAB Configuration on League

Add to `League` model (`apps/api/app/models/league.py`):

```python
waiver_type: str | None       # "faab" | "priority" | "none"
faab_budget: int | None       # total season budget (e.g., 100); null if waiver_type != "faab"
```

These are set manually in league settings OR auto-populated during the first successful in-season sync (see platform notes below).

### Extensions to Existing Models

**`TeamStandings`** — add FAAB fields (same model, no separate table needed):

```python
faab_spent: float | None      # cumulative FAAB spent this season
faab_remaining: float | None  # computed: league.faab_budget - faab_spent; null if not FAAB league
```

**`Player`** (`apps/api/app/models/player.py`) — add three fields:

```python
injury_status: str | None           # cached from Sleeper player DB
depth_chart_position: str | None    # "starter" | "backup" | "reserve"
injury_status_updated_at: datetime | None
```

Enables injury filtering across all queries without joining through `InSeasonRosterEntry`.

---

## Backend Services

### New Services

| Service | Purpose | Key Reuse |
|---------|---------|-----------|
| `in_season_sync.py` | Orchestrator: dispatches to platform fetchers, upserts all in-season models | Extends `adp_scheduler.py` background loop pattern |
| `sleeper_in_season.py` | Fetches Sleeper matchups, rosters, transactions | Reuses `_fetch_json`, `_build_player_lookup` from `sleeper_import.py` |
| `yahoo_in_season.py` | Yahoo roster/matchup fetch | Reuses `yahoo_get()` from `yahoo_oauth.py` (auto-refresh built-in) |
| `espn_in_season.py` | ESPN matchup/roster fetch via `?view=mMatchup&view=mMatchupScore` | Extends existing ESPN HTTP layer from `espn_import.py` |
| `weekly_projections.py` | Fetch/store `WeeklyProjection` from Sleeper or FantasyNerds | Cross-refs by `Player.external_id`, same as `sleeper_season_stats.py` |
| `waiver_wire.py` | Players not on any roster; enriched with keeper value + FAAB bid suggestions | Calls `compute_value_window()` from `value_window.py` with `next_year_adp_round_override` |
| `faab_advisor.py` | AI-powered FAAB bid recommendations; analyzes competition + budget pacing | Calls OpenAI with roster context, `TeamStandings.faab_remaining`, league standings |
| `start_sit.py` | Ranks lineup by projected points; annotates with keeper/injury context | Calls `compute_value_window()` and joins `KeeperRecommendation` |
| `in_season_trade_context.py` | Builds `TradeInSeasonContext` (season points per player, team records) | Injected as optional param into existing `trade_analysis.py` |

### `value_window.py` Change

`compute_value_window()` needs one new optional parameter:

```python
def compute_value_window(
    ...,
    next_year_adp_round_override: float | None = None,  # for waiver wire projections
) -> ValueWindowResult
```

This allows the waiver wire service to pass a projected next-year ADP (current ADP + 1 round escalation) without a stored ADP snapshot.

### New API Route File

Create `apps/api/app/api/routes/in_season.py` (existing `leagues.py` is large enough to warrant separation). Register in `main.py`.

```
POST /api/leagues/{id}/in-season/sync                   # full sync trigger (admin)
GET  /api/leagues/{id}/in-season/roster/{team_id}       # ?week=N
GET  /api/leagues/{id}/in-season/matchup                # ?week=N&team_id=X
GET  /api/leagues/{id}/in-season/standings              # ?week=N — includes faab_remaining per team
GET  /api/leagues/{id}/in-season/waiver-wire            # ?week=N&position=RB — includes bid suggestions when FAAB league
POST /api/leagues/{id}/in-season/faab-advice            # AI bid advice for one or more players
GET  /api/leagues/{id}/in-season/start-sit/{team_id}    # ?week=N
GET  /api/leagues/{id}/in-season/injury-alerts          # enhanced; no new params
POST /api/leagues/{id}/in-season/projections/refresh    # ?week=N (admin)
POST /api/leagues/{id}/in-season/digest                 # ?week=N — AI weekly summary
```

### Background Sync Loop

Extend `apps/api/app/services/adp_scheduler.py` or add `in_season_scheduler.py`. New env vars:

```
INSEASON_SYNC_ENABLED=false
INSEASON_SYNC_INTERVAL_HOURS=6
```

---

## FAAB System

### League Configuration

FAAB is opt-in per league. `League.waiver_type` drives all FAAB behavior:

- `"faab"` — bidding is enabled; bid suggestions and budget tracking are shown
- `"priority"` — traditional waiver priority; waiver wire shows only player value rankings
- `"none"` — free agency (first-come-first-served); waiver wire shows only rankings

Admins set `waiver_type` and `faab_budget` in League Settings, or it is auto-populated on the first successful in-season sync from the platform (see below). The UI in League Settings should show a toggle: **Waiver Type** (FAAB / Priority / Free Agency) and, if FAAB, a **Total Budget** input (default: 100).

### Platform Sync — FAAB Data Availability

**Sleeper (confirmed, data already fetched)**

The `league_info` dict returned by `_fetch_league_data()` already contains:
- `league_info["settings"]["waiver_budget"]` — total season FAAB budget (integer)
- `league_info["settings"]["waiver_type"]` — `0` = rolling priority, `1` = next-day priority, `2` = FAAB

Each entry in `rosters` (already fetched) contains:
- `roster["settings"]["waiver_budget_used"]` — cumulative FAAB spent by this team

So: `faab_remaining = league_info["settings"]["waiver_budget"] - roster["settings"]["waiver_budget_used"]`

No new API calls needed. Both values are in the payload already fetched by `_fetch_league_data()`.

**Yahoo (needs investigation)**

The Yahoo Fantasy API's `team` resource includes a `faab_balance` field when the league uses FAAB. This is accessible via the existing `yahoo_get()` call pattern:

```
GET /fantasy/v2/league/{league_key}/teams;out=faab
```

League-level FAAB settings are in the `league` resource under `settings > waiver_rule` (`"faab"` or `"standard"`). The total FAAB budget is in `settings > faab_budget`.

*Requires verification against a live Yahoo FAAB league.* The existing Yahoo OAuth layer handles auth; this is a new resource URL, not a new auth pattern.

**ESPN (needs investigation)**

ESPN's `?view=mTeam` response includes `acquisitionBudgetSpent` per team. League-level settings include:
- `settings.acquisitionSettings.isUsingAcquisitionLimit` — boolean, true if FAAB
- `settings.acquisitionSettings.acquisitionBudget` — total FAAB budget

*Requires verification against a live ESPN FAAB league.* The existing cookie-based ESPN HTTP layer should work without changes.

### FAAB Sync in `in_season_sync.py`

When syncing Sleeper:
1. Read `league_info["settings"]["waiver_type"]` → map `2` → `"faab"`, else `"priority"` or `"none"`
2. Write to `League.waiver_type` and `League.faab_budget` if not already set (don't overwrite admin-set values)
3. Per roster, write `faab_spent` and compute `faab_remaining` into `TeamStandings` for the current week

### AI FAAB Advisor

New service: `apps/api/app/services/faab_advisor.py`

Enabled by new env var: `FAAB_ADVISOR_AI_ENABLED=false`

**Endpoint:**

```
POST /api/leagues/{id}/in-season/faab-advice
Body: {
  team_id: UUID,
  week: int,
  player_ids: list[UUID]     # 1–5 players the user is considering bidding on
}
```

**AI context injected:**

```python
{
  # The requesting team
  "team_name": str,
  "faab_remaining": float,       # e.g., 42 (out of 100)
  "weeks_remaining": int,        # e.g., 6
  "record": "5-3",
  "playoff_contention": bool,    # wins > median wins in league

  # Each target player
  "players": [
    {
      "name": str,
      "position": str,
      "projected_points_this_week": float,
      "keeper_value_rounds": float,    # from compute_value_window()
      "is_keeper_candidate": bool,     # from KeeperRecommendation
      "injury_status": str,
    }
  ],

  # All other teams — to estimate competition
  "other_teams": [
    {
      "name": str,
      "faab_remaining": float,
      "record": str,
      "roster_needs": list[str],     # positions with weak depth from InSeasonRosterEntry
      "playoff_contention": bool,
    }
  ],

  # League context
  "total_faab_budget": int,          # e.g., 100
  "average_faab_remaining": float,   # league-wide average
  "scoring_format": str,             # from League.scoring_format
}
```

**AI output format:**

```python
{
  "bids": [
    {
      "player_id": UUID,
      "suggested_bid": float,           # e.g., 18
      "bid_range": [float, float],      # e.g., [12, 25]
      "confidence": str,                # "high" | "medium" | "low"
      "rationale": str,                 # 2-3 sentences
      "competition_assessment": str,    # "2-3 teams likely bidding; Team X needs RBs"
      "budget_pacing_note": str,        # "You have $42 left; $7/week floor suggested"
      "keeper_note": str | None,        # if player is a keeper candidate
    }
  ],
  "budget_strategy": str,              # overall pacing recommendation for the week
}
```

**Bid logic the AI is prompted to apply:**

1. **Player value** — project this week's points + keeper surplus in rounds converted to dollar equivalent (1 round surplus ≈ 10% of average team FAAB budget)
2. **Competition estimation** — teams with matching positional needs and remaining FAAB above the league average are likely competitors; named explicitly in the rationale
3. **Budget pacing** — with N weeks remaining, the "safe floor" to retain is `faab_remaining * (2 / weeks_remaining)` to avoid running dry in the playoff push. Bids are constrained to not blow below this floor for low-value adds
4. **Keeper premium** — if the player is a keeper candidate, the AI explicitly notes the long-term value justification for a higher bid
5. **Playoff context** — a team that is 1-8 gets different advice than a 7-2 team (rebuild vs. win-now)

The AI follows the same pattern as `scenario_narrative_ai.py` and `trade_analysis.py`: deterministic fallback if AI is disabled (rule-based bid estimate using the budget pacing formula above), AI narrative layered on top when enabled.

### Frontend: WaiverWirePanel FAAB Integration

`WaiverWirePanel.tsx` gains FAAB mode when `league.waiver_type === "faab"`:

- **Column additions to the player table:**
  - **Suggested Bid** — `$18` with a tooltip showing the bid range and confidence badge
  - **Competition** — color-coded: `Low` / `Medium` / `High` (from AI competition assessment)
  - *(Keeper Val column remains; in FAAB mode it shows a dollar equivalent alongside rounds)*

- **"Get AI Bid Advice" button** — appears above the table when FAAB mode is active; sends selected player IDs to `POST .../faab-advice` and renders a side panel with per-player rationale + the budget strategy note

- **Budget tracker widget** — top of the Waiver Wire panel shows: `Your FAAB: $42 remaining · League avg: $31 · 6 weeks left · Safe floor: ~$14`; updated from `TeamStandings.faab_remaining` for the user's team

- **Standings table** in `StandingsPanel.tsx` gains a **FAAB Remaining** column (hidden when `waiver_type !== "faab"`)

---

## Frontend Components

New directory: `apps/web/src/components/in-season/`

All panels follow the existing `card + DataTable` pattern. The `[KEEPER]` badge and "Keeper Val" column use the same color system as the existing surplus badge in the trade analyzer (green = positive, red = overpay).

| Component | Purpose |
|-----------|---------|
| `InSeasonProvider.tsx` | Context: current week, season mode, last-sync time, sync trigger |
| `SeasonModeBanner.tsx` | Persistent "Week N · synced Xh ago · Sync Now" strip |
| `InSeasonDashboard.tsx` | Weekly summary: matchup preview, top waiver pickup, alert count |
| `MyTeamPanel.tsx` | Current roster with `[KEEPER]` badge, injury status, projected points |
| `MatchupPanel.tsx` | Side-by-side lineup vs opponent, projected + actual scores |
| `StandingsPanel.tsx` | League standings table |
| `WaiverWirePanel.tsx` | Available players with **Keeper Val** + **Suggested Bid** + **Competition** columns (FAAB mode); budget tracker widget at top |
| `StartSitPanel.tsx` | Ranked lineup recommendations with keeper watchlist annotations |
| `InjuryAlertsPanel.tsx` | Extends existing news alerts: adds `injury_status`, `flip_adp_round`, keeper context |

---

## Implementation Sequence

### Phase 1 — Foundation (~12 dev-days)

**Step 1: League external ID persistence (1 day)**
- Alembic migration: add `platform`, `external_league_id`, `current_week`, `season_mode_override` to `leagues`
- Update `commit_sleeper_import`, `commit_yahoo_import`, `commit_espn_import` to write these fields

**Step 2: Player injury status fields (0.5 day)**
- Alembic migration: add `injury_status`, `depth_chart_position`, `injury_status_updated_at` to `players`
- Add `refresh_player_injury_status()` in new `player_sync.py` — fetches Sleeper `/players/nfl` full player DB
- Immediately exposes injury status in the existing injury alerts endpoint → fastest user-visible value

**Step 3: New DB models + migration (1 day)**
- Create `models/in_season.py` with `InSeasonRosterEntry`, `WeeklyProjection`, `LeagueMatchup`, `TeamStandings` (include `faab_spent` + `faab_remaining` on `TeamStandings`)
- Add `waiver_type` + `faab_budget` to `leagues` in the same migration as Step 1 (or consolidate into one migration)
- Add to `models/__init__.py`

**Step 4: Weekly projections service (2 days)**
- `services/weekly_projections.py` — Sleeper projection fetch + `WeeklyProjection` upsert
- `POST /api/leagues/{id}/in-season/projections/refresh` endpoint
- Validates cross-reference via `Player.external_id` (same pattern as `sleeper_season_stats.py`)

**Step 5: Sleeper in-season sync (3 days)**
- `services/sleeper_in_season.py` — matchup + roster fetch; read `league_info["settings"]["waiver_budget"]` + `waiver_type` (already in the `_fetch_league_data()` payload) and `roster["settings"]["waiver_budget_used"]` per team
- `services/in_season_sync.py` — platform orchestrator; writes `League.waiver_type`, `League.faab_budget`, and `TeamStandings.faab_spent/faab_remaining` on first sync
- `POST .../sync`, `GET .../standings`, `GET .../roster/{team_id}`, `GET .../matchup` endpoints

**Step 6: Waiver wire + start/sit + FAAB advisor (3 days)**
- `services/waiver_wire.py` — keeper value enrichment via `compute_value_window()`; include `faab_remaining` for user's team and basic rule-based bid estimate (deterministic fallback, no AI required)
- `services/faab_advisor.py` — AI bid recommendations; rule-based path always runs, AI narrative added when `FAAB_ADVISOR_AI_ENABLED=true`
- `services/start_sit.py` — keeper badge annotations
- `GET .../waiver-wire`, `POST .../faab-advice`, and `GET .../start-sit/{team_id}` endpoints
- League Settings UI: add **Waiver Type** toggle + **FAAB Budget** input

**Step 7: Enhanced injury alerts (0.5 day)**
- Extend existing `news_impact.py` endpoint to join `Player.injury_status` + `flip_adp_round`
- No new service needed; query extension only

### Phase 2 — UX Mode Switching (~6 dev-days)

**Step 8: Season mode infrastructure (2 days — frontend)**
- `InSeasonProvider.tsx` context
- `SeasonModeBanner.tsx` component
- `season_mode` derived field on League schema response
- Conditional `navGroups` in `dashboard-app.tsx`

**Step 9: In-season panel components (5 days — frontend)**
- All 8 components listed above
- `WaiverWirePanel`: FAAB mode columns (Suggested Bid, Competition) + budget tracker widget + "Get AI Bid Advice" side panel
- `StandingsPanel`: FAAB Remaining column (conditional on `waiver_type`)
- Wired to Phase 1 API endpoints

### Phase 3 — Full Platform Coverage + AI (~7 dev-days)

**Step 10: Yahoo + ESPN in-season sync (3–4 days)**
- `services/yahoo_in_season.py` — roster/matchup fetch; also attempt `GET /fantasy/v2/league/{key}/teams;out=faab` for `faab_balance` per team (verify against a live Yahoo FAAB league; fall back gracefully if not available)
- `services/espn_in_season.py` — matchup/roster fetch via `?view=mMatchup&view=mMatchupScore`; also check `acquisitionBudgetSpent` on `?view=mTeam` and `acquisitionSettings` on `?view=mSettings` for FAAB config (verify against a live ESPN FAAB league)
- Both wired into `in_season_sync.py` platform dispatch with FAAB field writes matching Sleeper path

**Step 11: AI weekly digest (2 days)**
- `services/weekly_digest_ai.py` — follows `scenario_narrative_ai.py` pattern
- Env var toggle: `WEEKLY_DIGEST_AI_ENABLED`
- `POST .../digest` endpoint

**Step 12: In-season trade analyzer enhancement (1 day)**
- `services/in_season_trade_context.py`
- Extend `trade_analysis.py` to accept optional `InSeasonContext` param
- Frontend: show current season points in trade analyzer when in-season mode

**Step 13: Background sync loop (1 day)**
- Add `in_season_scheduler.py` or extend `adp_scheduler.py`
- Wire into `main.py` lifespan

**Total estimate:** ~27 dev-days. Phase 1 (13 days) = MVP including FAAB sync + rule-based bids. Phase 2 (7 days) = usable product with FAAB UI. Phase 3 (7 days) = full platform coverage + AI digest.

---

## Design Decisions That Drive Differentiation

1. **"Keeper Val" column everywhere** — sortable, color-coded (green = surplus, red = overpay). Users should be able to sort the entire waiver wire by keeper value in one click. This is the single most distinctive feature vs. any competitor.

2. **`[KEEPER]` badge** — any player currently flagged `is_recommended` from the optimizer gets this badge in every in-season view. Creates a persistent visual thread between pre-season analysis and in-season decisions.

3. **Injury → keeper decision alerts** — when `Player.injury_status` changes to IR/Out and the player is a keeper candidate, surface: "CMC (IR) → if his ADP rises to Rd 4 next year, he stops being a keeper value (current cost: Rd 5)." This is `flip_adp_round` applied to injury events and no competitor does it.

4. **Trade analyzer with record context** — inject team record and points rank into the AI trade narrative. A 1-8 team trading away keeper value is making a different (correct) decision than a 7-2 team doing the same.

5. **Pre-season tools stay accessible** — dynasty/keeper players constantly re-evaluate. Don't bury the optimizer in-season; deprioritize it in the nav but keep it one click away.

---

## Verification

- **Phase 1**: Call `POST /api/leagues/{id}/in-season/sync` on a test Sleeper league with active matchups. Confirm `InSeasonRosterEntry`, `LeagueMatchup`, and `TeamStandings` rows populate. For a FAAB league, verify `League.waiver_type = "faab"`, `League.faab_budget` is set, and `TeamStandings.faab_remaining` is populated per team. Call `GET .../waiver-wire` and verify `keeper_value` fields are non-null; on a FAAB league verify `suggested_bid` appears in the response. Call `POST .../faab-advice` and confirm the rule-based path returns a bid range without AI enabled, and an enriched rationale with `FAAB_ADVISOR_AI_ENABLED=true`.
- **Phase 2**: Set `season_mode_override = "in_season"` on a test league to trigger the in-season nav before the real season starts. Confirm pre-season tools remain accessible in the collapsed secondary group.
- **Phase 3**: Confirm AI digest returns keeper-contextualized language, not generic fantasy advice. Verify Yahoo and ESPN matchup data matches what the respective platforms display natively.
- **Regression**: Existing keeper optimizer, mock draft, and trade analyzer must continue working regardless of `season_mode`. The seasonal UX is additive.

---

## Open Questions / Future Phases

- **Live scoring during game day** — polling every 5–10 minutes is doable via Sleeper API but adds infra complexity (more aggressive background task). Defer to post-MVP.
- **Push notifications / SMS** — for injury alerts and waiver wire claims. Requires Twilio or similar. Phase 4.
- **Dynasty-specific tools** — contract years (auction), devy picks, taxi squads, rookie pick trading. High value for dynasty leagues specifically; scoped separately from this plan.
- **Power rankings** — computable from `TeamStandings` + `InSeasonRosterEntry` keeper strength score. 1-day add-on once Phase 1 data is in place.
- **MyFantasyLeague (MFL) support** — popular for dynasty leagues; adding a 4th platform import would significantly expand the TAM.
- **Yahoo/ESPN FAAB verification** — Yahoo's `faab_balance` field and ESPN's `acquisitionBudgetSpent` are documented in platform API references but need to be confirmed against a live FAAB league before Step 10. If unavailable, fall back to manual FAAB tracking (admin enters remaining budgets per team).
- **FAAB transaction history** — tracking individual bid outcomes (who won, at what price) would improve AI competition modeling over time. Sleeper exposes this via `/league/{id}/transactions/{week}`; deferred to a later phase.
