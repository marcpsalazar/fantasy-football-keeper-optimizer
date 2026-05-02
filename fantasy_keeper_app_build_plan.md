# Fantasy Keeper Optimizer App — Build Plan

## 1. Product Goal

Build a full-stack application that turns fantasy football league data into dynamic keeper recommendations, draft strategy, and scenario analysis.

The app should replace the spreadsheet workflow with a repeatable system that can be updated after the NFL Draft, during preseason ADP movement, and before keeper deadlines.

Core use case:

> Upload/import league data, update ADP, configure keeper rules, run the optimizer, compare scenarios, and export keeper recommendations.

---

## 2. League Rules to Support

The initial app should support the Maryland Mayhem keeper rules:

- 12-team league
- Snake draft
- Superflex format
- Starting lineup:
  - 1 QB
  - 2 RB
  - 2 WR
  - 1 TE
  - 2 W/R/T Flex
  - 1 W/R/T/QB Superflex
  - 1 DEF
  - 1 K
  - 7 bench
- Teams may keep 0–4 players
- Max 2 keepers at any one position
- Max 1 QB keeper
- Keeper cost:
  - If drafted by same team and still on that team: original draft pick cost
  - If acquired later / not drafted by current team: projected current-season ADP cost
- Teams are not required to use all keeper slots

---

## 3. Core App Concepts

### 3.1 League

A league contains:

- Teams
- Scoring format
- roster settings
- keeper rules
- draft order
- historical draft results
- final rosters
- ADP snapshots
- optimizer settings

### 3.2 Team

A team contains:

- team name
- draft slot
- 2025 drafted roster
- 2025 final roster
- available keeper candidates
- projected keepers
- draft picks after keeper costs

### 3.3 Player

A player contains:

- name
- position
- NFL team, optional
- current ADP
- ADP source
- ADP snapshot date
- keeper cost
- keeper value
- keeper score
- recommendation status

### 3.4 ADP Snapshot

ADP should be treated as time-sensitive data.

Each snapshot should include:

- snapshot date
- source name
- format type, such as Superflex, Half PPR, PPR
- player ADP values
- notes

---

## 4. Recommended MVP Feature Set

### MVP 1 — Data Model + Manual Input

Build the app around manually entered or pasted data first.

Features:

- Create league
- Add teams
- Enter draft order
- Upload or paste draft results
- Upload or paste final rosters
- Paste ADP table
- Configure keeper rules
- Run keeper optimizer
- View team recommendations
- Export CSV or Excel

This avoids overbuilding import automation too early.

### MVP 2 — Keeper Optimizer

The optimizer should calculate:

- ADP pick
- ADP round
- keeper cost pick
- keeper cost round
- keeper value
- keeper score
- eligibility
- projected keeper flag

The optimizer should support:

- optional keepers, 0–4
- max 2 per position
- max 1 QB
- configurable value threshold
- configurable ADP cap
- configurable score floor
- superflex QB scarcity bonuses
- manual force/exclude overrides

### MVP 3 — Scenario Comparison

Allow users to compare strategies:

- Pure Value Mode
- Balanced Mode
- Superflex Mode
- Win-Now Mode
- Rebuild Mode
- Manual Override Mode

Each scenario should output:

- selected keepers
- picks forfeited
- keeper value gained/lost
- total keeper score
- draft flexibility impact

### MVP 4 — Draft Impact View

Show the snake draft board after keepers are applied.

Features:

- Draft slot by team
- picks lost to keepers
- remaining picks
- keeper costs by round
- expected draft capital remaining
- warning if a keeper burns a premium pick without enough value

### MVP 5 — Export + Reports

Export options:

- Excel workbook
- CSV
- PDF report
- team-specific report
- league-wide keeper board

---

## 5. Keeper Score Model

### 5.1 Baseline Keeper Value

```text
Keeper Value = Keeper Cost Pick - ADP Pick
```

Positive value means the player is cheaper to keep than market.

Example:

```text
Cost Pick = 120
ADP Pick = 61
Keeper Value = 59
```

That player is a strong keeper value.

### 5.2 Keeper Score

Recommended formula:

```text
Keeper Score =
  Keeper Value × Position Weight
  + Talent Bonus
  + Status Bonus
  + Draft Slot Bonus
  + QB Scarcity Bonus
  + Elite Anchor Bonus
  - Risk Penalty
```

### 5.3 Position Weights

Initial defaults:

| Position | Weight |
|---|---:|
| QB | 1.75 |
| RB | 1.20 |
| WR | 1.00 |
| TE | 1.10 |
| K | 0.10 |
| DEF | 0.10 |

### 5.4 Talent Bonus

```text
Talent Bonus = max(0, (Talent Anchor - ADP Pick) / Talent Divisor)
```

Suggested defaults:

```text
Talent Anchor = 180
Talent Divisor = 15
```

### 5.5 Status Bonus

| Final Roster Status | Bonus |
|---|---:|
| Starter | 3 |
| Bench | 1 |
| IR | 0.5 |

### 5.6 Draft Slot Bonus

Optional minor adjustment based on draft slot.

Early-slot teams may be slightly less incentivized to keep marginal players because they can draft earlier.

Late-slot teams may benefit more from secure discounted players.

This should remain modest.

### 5.7 Superflex QB Scarcity Bonus

Do not force teams to keep a QB. Instead, apply a scarcity bonus when a QB is actually valuable.

Suggested bonus:

```text
if position == QB:
  if ADP <= 24: +40
  elif ADP <= 75: +30
  elif ADP <= 100: +20
  elif ADP <= 125: +10
  else: +0
```

Recommended QB controls:

```text
QB Position Weight = 1.75
QB Max ADP Eligibility = 100
Elite QB Hold Cutoff = 40
Elite QB Max Negative Edge = -5
```

This makes players like Justin Herbert and Baker Mayfield properly competitive without forcing teams to keep weak QBs.

### 5.8 Elite Anchor Bonus

Add a small boost for elite players who may be worth keeping even without massive value.

Suggested:

```text
if ADP <= 12: +15
elif ADP <= 24: +8
else: +0
```

This helps account for players like Ja’Marr Chase, Justin Jefferson, CeeDee Lamb, Bijan Robinson, and other hard-to-replace assets.

### 5.9 Eligibility Rules

A player should be eligible only if:

```text
ADP Pick <= Max ADP Cap
Keeper Score >= Minimum Keeper Score
AND (
  Keeper Value >= Minimum Keeper Value Threshold
  OR Elite Anchor Exception applies
  OR Superflex QB Exception applies
)
```

Default settings:

```text
Minimum Keeper Value Threshold = 10
Max ADP Cap = 140
Minimum Keeper Score = 40
```

### 5.10 Selection Rules

From eligible players, select keepers by score while enforcing:

- max 4 total keepers
- max 2 per position
- max 1 QB
- no obligation to use all slots
- manual force/exclude overrides apply first

---

## 6. Recommended App Architecture

### Frontend

Use:

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Table
- Recharts

Key pages:

- Dashboard
- League Settings
- Teams
- Draft Results
- Final Rosters
- ADP Input
- Optimizer
- Scenario Comparison
- Draft Board
- Reports / Exports

### Backend

Use:

- Python FastAPI
- PostgreSQL
- SQLAlchemy or SQLModel
- Pydantic models
- pandas for imports/exports
- openpyxl for Excel export

### Background Jobs

Optional later:

- Celery + Redis
- or simple scheduled jobs

Used for:

- ADP updates
- PDF parsing
- report generation

### Hosting

Recommended simple stack:

- Vercel for frontend
- Render, Railway, or Fly.io for FastAPI backend
- Supabase or Neon for PostgreSQL

---

## 7. Database Schema Draft

### leagues

```sql
id
name
season
team_count
scoring_format
is_superflex
created_at
updated_at
```

### teams

```sql
id
league_id
name
draft_slot
created_at
updated_at
```

### players

```sql
id
name
position
nfl_team
created_at
updated_at
```

### draft_picks

```sql
id
league_id
team_id
player_id
season
round
overall_pick
position
created_at
```

### final_roster_entries

```sql
id
league_id
team_id
player_id
season
position
roster_status
created_at
```

### adp_snapshots

```sql
id
league_id
season
name
source
format
snapshot_date
created_at
```

### adp_entries

```sql
id
snapshot_id
player_id
position
adp_pick
adp_round
source_note
```

### optimizer_settings

```sql
id
league_id
name
minimum_keeper_value
max_adp_cap
minimum_keeper_score
qb_weight
rb_weight
wr_weight
te_weight
qb_max_adp
elite_qb_cutoff
elite_qb_max_negative_edge
created_at
updated_at
```

### keeper_recommendations

```sql
id
league_id
team_id
player_id
settings_id
scenario_name
keeper_cost_pick
keeper_cost_round
adp_pick
adp_round
keeper_value
keeper_score
is_eligible
is_recommended
reason
created_at
```

### manual_overrides

```sql
id
league_id
team_id
player_id
override_type -- auto, force_keep, exclude
notes
created_at
updated_at
```

---

## 8. API Design

### League APIs

```http
POST /api/leagues
GET /api/leagues/{league_id}
PATCH /api/leagues/{league_id}
```

### Team APIs

```http
GET /api/leagues/{league_id}/teams
POST /api/leagues/{league_id}/teams
PATCH /api/teams/{team_id}
```

### Draft APIs

```http
POST /api/leagues/{league_id}/draft-results/import
GET /api/leagues/{league_id}/draft-results
```

### Roster APIs

```http
POST /api/leagues/{league_id}/final-rosters/import
GET /api/leagues/{league_id}/final-rosters
```

### ADP APIs

```http
POST /api/leagues/{league_id}/adp-snapshots
GET /api/leagues/{league_id}/adp-snapshots
GET /api/adp-snapshots/{snapshot_id}
```

### Optimizer APIs

```http
POST /api/leagues/{league_id}/optimizer/run
GET /api/leagues/{league_id}/optimizer/results
POST /api/leagues/{league_id}/optimizer/scenarios
```

### Export APIs

```http
GET /api/leagues/{league_id}/exports/excel
GET /api/leagues/{league_id}/exports/pdf
```

---

## 9. Optimizer Pseudocode

```python
def run_optimizer(league, settings, adp_snapshot, overrides):
    candidates = []

    for team in league.teams:
        for roster_player in team.final_roster:
            draft_pick = find_original_draft_pick(team, roster_player)

            if draft_pick:
                keeper_cost = draft_pick.overall_pick
            else:
                keeper_cost = adp_snapshot.get_adp(roster_player.player)

            adp_pick = adp_snapshot.get_adp(roster_player.player)

            keeper_value = keeper_cost - adp_pick
            score = calculate_keeper_score(
                player=roster_player.player,
                keeper_value=keeper_value,
                adp_pick=adp_pick,
                settings=settings,
                roster_status=roster_player.status,
                draft_slot=team.draft_slot,
            )

            eligible = calculate_eligibility(
                player=roster_player.player,
                keeper_value=keeper_value,
                adp_pick=adp_pick,
                score=score,
                settings=settings,
            )

            candidates.append(candidate)

    recommendations = []

    for team in league.teams:
        team_candidates = apply_manual_overrides(candidates, team, overrides)
        selected = select_best_keepers(team_candidates, settings)
        recommendations.extend(selected)

    return recommendations
```

---

## 10. VS Code + Codex Workflow

### 10.1 Set up the project

Recommended monorepo:

```text
fantasy-keeper-app/
  apps/
    web/          # Next.js app
    api/          # FastAPI app
  packages/
    shared/       # shared types / schemas if needed
  docs/
    product-plan.md
    scoring-model.md
  sample-data/
    draft_results.csv
    final_rosters.csv
    adp.csv
```

### 10.2 First Codex prompt

Use this in VS Code Codex:

```text
Create a monorepo for a fantasy football keeper optimizer app.

Use:
- Next.js + TypeScript + Tailwind for apps/web
- FastAPI + Python for apps/api
- PostgreSQL models using SQLAlchemy or SQLModel
- Pydantic schemas

Implement the initial folder structure, README, env examples, and docker-compose for Postgres.
Do not build the full app yet. Create a clean foundation with install/run instructions.
```

### 10.3 Second Codex prompt — backend models

```text
Implement the backend database models and Pydantic schemas for:
- League
- Team
- Player
- DraftPick
- FinalRosterEntry
- ADPSnapshot
- ADPEntry
- OptimizerSettings
- ManualOverride
- KeeperRecommendation

Use SQLModel if possible. Include Alembic migrations or a simple create_all startup path for local dev.
Add seed data support from CSV files in sample-data.
```

### 10.4 Third Codex prompt — optimizer engine

```text
Build the keeper optimizer engine in apps/api/app/services/optimizer.py.

Requirements:
- Teams may keep 0-4 players
- Max 2 keepers per position
- Max 1 QB keeper
- Keeper cost is original draft pick if drafted by same team and still on final roster, otherwise current ADP
- Keeper Value = Keeper Cost Pick - ADP Pick
- Keeper Score = Keeper Value * Position Weight + Talent Bonus + Status Bonus + Draft Slot Bonus + QB Scarcity Bonus + Elite Anchor Bonus - Risk Penalty
- Do not force a QB keeper
- Add tiered superflex QB scarcity bonus
- Support manual overrides: auto, force_keep, exclude

Write unit tests covering edge cases, especially teams with 0, 1, 2, 3, and 4 keepers.
```

### 10.5 Fourth Codex prompt — API endpoints

```text
Add FastAPI endpoints for:
- creating and reading leagues
- creating teams
- importing draft results from CSV
- importing final rosters from CSV
- importing ADP from CSV
- updating optimizer settings
- running optimizer
- reading optimizer results

Return structured JSON suitable for a frontend table.
Add pytest tests for the optimizer endpoint.
```

### 10.6 Fifth Codex prompt — frontend foundation

```text
Build the frontend pages for:
- League Dashboard
- Teams
- Draft Results
- Final Rosters
- ADP Input
- Optimizer Settings
- Keeper Recommendations
- Team Outlooks

Use shadcn/ui, TanStack Table, and Tailwind.
Use mocked API data first if backend integration is not ready.
```

### 10.7 Sixth Codex prompt — scenario comparison

```text
Add scenario comparison to the keeper optimizer.

Users should be able to run different settings presets:
- Pure Value
- Balanced
- Superflex Heavy
- Win Now
- Rebuild

Show side-by-side keeper recommendations by team, total keeper score, picks forfeited, and strategic notes.
```

### 10.8 Seventh Codex prompt — export

```text
Add Excel export for keeper recommendations.

Export sheets:
- League Summary
- Drafted Rosters
- Final Rosters
- ADP Input
- Dynamic Keeper Model
- Projected Keepers
- Team Outlooks
- Settings

Use openpyxl. Avoid Excel tables, spill formulas, and metadata-heavy features. Keep the workbook compatible with desktop Excel.
```

---

## 11. Recommended Build Order

1. Create repo foundation
2. Build backend models
3. Add CSV importers
4. Build optimizer engine with tests
5. Add API endpoints
6. Build frontend dashboard
7. Add recommendations table
8. Add settings controls
9. Add scenario comparison
10. Add draft board view
11. Add Excel export
12. Add PDF report
13. Add ADP snapshot manager
14. Add Yahoo import automation if needed

---

## 12. Testing Plan

### Unit tests

Test:

- keeper value calculation
- same-team draft cost lookup
- acquired-player ADP cost lookup
- optional keeper slots
- max 2 per position
- max 1 QB
- QB scarcity bonus
- elite anchor bonus
- manual force keep
- manual exclude

### Integration tests

Test full optimizer run with sample league data.

Expected cases:

- team with 0 keepers
- team with 1 keeper
- team with 2 keepers
- team with 3 keepers
- team with 4 keepers
- team with multiple eligible QBs but max 1 selected
- team with elite non-value player selected via anchor bonus
- team with cheap but replacement-level player excluded

### UI tests

Test:

- settings update recalculates recommendations
- scenario selection changes recommendations
- manual override changes recommendations
- export works

---

## 13. Data Import Format

### Draft Results CSV

```csv
team,round,overall_pick,player,position
SWEEP THE LEG JOHNNY,1,1,Ja'Marr Chase,WR
```

### Final Rosters CSV

```csv
team,player,position,roster_status
SWEEP THE LEG JOHNNY,Ja'Marr Chase,WR,Starter
```

### ADP CSV

```csv
player,position,adp_pick,source,snapshot_date
Ja'Marr Chase,WR,11,DraftSharks Superflex,2026-04-30
```

---

## 14. Future Advanced Features

### Yahoo Integration

Possible later:

- OAuth login
- Yahoo Fantasy API league import
- direct roster import
- direct draft results import

### Replacement Value Draft Simulator

This is the most important advanced feature.

Instead of only comparing ADP vs keeper cost, compare:

```text
Keeper Player Value vs Expected Player Available at the Forfeited Pick
```

This answers:

- Should I keep Chase at 1.01?
- Should I keep a QB at Round 7?
- Should I skip a marginal keeper because the draft pool is better?

### Draft Room Assistant

During draft:

- track taken players
- recommend best available by roster need
- detect QB runs
- show scarcity by position
- show team-by-team keeper constraints

---

## 15. Development Checklist

### Repo

- [ ] Create monorepo
- [ ] Add README
- [ ] Add docker-compose
- [ ] Add env examples

### Backend

- [ ] Models
- [ ] Schemas
- [ ] CSV importers
- [ ] Optimizer service
- [ ] Scenario service
- [ ] Export service
- [ ] Tests

### Frontend

- [ ] Dashboard
- [ ] League settings
- [ ] Data import pages
- [ ] ADP page
- [ ] Optimizer settings
- [ ] Keeper recommendations
- [ ] Team outlooks
- [ ] Scenario comparison
- [ ] Export controls

### Quality

- [ ] Unit tests
- [ ] Integration tests
- [ ] Seed data
- [ ] Error handling
- [ ] Documentation

---

## 16. First Practical Next Step

Start with a repo scaffold and CSV-driven backend optimizer.

Do not start with Yahoo API or PDF parsing.

The fastest path is:

1. Use CSV inputs
2. Build the optimizer
3. Build the UI
4. Add exports
5. Add import automation later

This keeps the app testable and prevents the project from getting stuck on messy data ingestion.

