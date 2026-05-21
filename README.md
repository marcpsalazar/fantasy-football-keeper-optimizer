# Fantasy Football Keeper Optimizer

Full-stack keeper optimizer for fantasy football leagues. The app imports league data from CSV files, calculates keeper recommendations, compares strategy presets, shows draft impact, supports manual overrides, and exports keeper reports.

## What It Does

- Create and read leagues and teams.
- Import draft results, final rosters, and ADP snapshots from CSV.
- Preview CSV files before importing, with row-level errors and warnings.
- Run a keeper optimizer with league constraints:
  - Teams may keep 0-4 players.
  - Max 2 keepers per position.
  - Max 1 QB keeper.
  - QB keepers are not forced.
  - Keeper cost is original draft pick when the player was drafted by the same team and remains on that final roster; otherwise cost falls back to current ADP.
- Compare strategy presets:
  - Pure Value
  - Balanced
  - Superflex Heavy
  - Win Now
  - Rebuild
- Apply manual overrides:
  - `auto`
  - `force_keep`
  - `exclude`
- Export:
  - Excel workbook for keeper recommendations and supporting sheets.
  - CSV keeper recommendations.
  - PDF team outlook reports.

## Stack

- `apps/api`: FastAPI, SQLModel, Pydantic, openpyxl
- `apps/web`: Next.js, TypeScript, Tailwind, shadcn-style UI components, TanStack Table
- Database: PostgreSQL for normal local development, SQLite works for quick local smoke testing
- Local DB bootstrap: SQLModel `create_all`
- Seed data: CSV files in `sample-data`

## Repository Layout

```text
fantasy-football-keeper-optimizer/
  apps/
    api/
      app/
        api/routes/
        core/
        db/
        models/
        schemas/
        services/
      tests/
      pyproject.toml
      .env.example
    web/
      src/app/
      src/components/
      src/lib/
      package.json
      .env.example
  sample-data/
    leagues.csv
    teams.csv
    draft_results.csv
    final_rosters.csv
    adp.csv
  docker-compose.yml
  package.json
  .env.example
```

## Prerequisites

- Node.js 20+
- npm 10+
- Python 3.12+
- Docker Desktop or Docker Engine with Compose

## Quick Start

From the repository root:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm install
docker compose up -d postgres
```

Set up the API:

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python -c "from app.db.session import init_db; init_db()"
python -m app.db.seed
uvicorn app.main:app --reload
```

In another terminal, start the web app from the repository root:

```bash
npm run dev:web
```

Open:

- Web app: `http://localhost:3000`
- API health: `http://localhost:8000/health`
- API docs: `http://localhost:8000/docs`

## Environment Files

Root `.env` is used by Docker Compose.

```text
POSTGRES_USER=keeper
POSTGRES_PASSWORD=keeper
POSTGRES_DB=keeper_optimizer
POSTGRES_PORT=5432

DATABASE_URL=postgresql+psycopg://keeper:keeper@localhost:5432/keeper_optimizer
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
CREATE_TABLES_ON_STARTUP=false
SEED_DATA_ON_STARTUP=false
SAMPLE_DATA_PATH=sample-data
SESSION_SECRET=change-me
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=change-me
```

`apps/api/.env` is loaded by FastAPI:

```text
APP_NAME=Fantasy Football Keeper Optimizer API
ENVIRONMENT=development
DATABASE_URL=postgresql+psycopg://keeper:keeper@localhost:5432/keeper_optimizer
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
CREATE_TABLES_ON_STARTUP=false
SEED_DATA_ON_STARTUP=false
SAMPLE_DATA_PATH=sample-data
SESSION_SECRET=change-me
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=change-me
```

`apps/web/.env.local` is loaded by Next.js:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Running With Automatic Table Creation and Seed Data

For local development, the API can create tables and seed CSV data on startup:

```bash
cd apps/api
CREATE_TABLES_ON_STARTUP=true \
SEED_DATA_ON_STARTUP=true \
SAMPLE_DATA_PATH=../../sample-data \
SESSION_SECRET=local-dev-session-secret \
INITIAL_ADMIN_EMAIL=admin@example.com \
INITIAL_ADMIN_PASSWORD=change-me \
uvicorn app.main:app --reload
```

You can also seed manually:

```bash
cd apps/api
python -m app.db.seed
```

The seeder supports:

- `leagues.csv`
- `teams.csv`
- `players.csv`
- `draft_results.csv`
- `final_rosters.csv`
- `adp.csv`
- `optimizer_settings.csv`
- `manual_overrides.csv`

## CSV Formats

The sample files in `sample-data` are the best starting templates.

### `leagues.csv`

```csv
name,season_year,scoring_format,draft_type,max_keepers,max_keepers_per_position,max_qb_keepers
Maryland Mayhem,2026,superflex,snake,4,2,1
```

### `teams.csv`

```csv
league,season_year,name,owner_name,draft_slot
Maryland Mayhem,2026,SWEEP THE LEG JOHNNY,Johnny Lawrence,1
```

### `draft_results.csv`

```csv
team,round,overall_pick,player,position
SWEEP THE LEG JOHNNY,1,1,Ja'Marr Chase,WR
```

Supported aliases include `pick` or `draft_pick` for `overall_pick`, and `draft_round` for `round`.

### `final_rosters.csv`

```csv
team,player,position,roster_status
SWEEP THE LEG JOHNNY,Ja'Marr Chase,WR,Starter
```

Supported aliases include `status` for `roster_status`.

### `adp.csv`

```csv
player,position,adp_pick,source,snapshot_date,format
Ja'Marr Chase,WR,5,DraftSharks Superflex,2026-04-30,superflex
```

Supported aliases include:

- `adp` or `pick` for `adp_pick`
- `date` for `snapshot_date`
- `format_type` or `scoring_format` for `format`
- `source_name` for `source`

Supported positions:

- `QB`
- `RB`
- `WR`
- `TE`
- `K`
- `DEF`
- `DST`

## How to Use the App

The app is a shared league workspace with user-specific modeling. Admins manage league inputs,
ADP, teams, users, and shared setup. Every signed-in user can review the league data, tune their
own optimizer settings, run recommendations, choose scenario views, apply manual overrides, and
export their reports.

The main workflow is:

1. Sign in.
2. Confirm the league, teams, draft results, final rosters, and ADP snapshot are loaded.
3. Adjust `Optimizer Settings` when the model should use a different strategy or league rule.
4. Click `Run Optimizer` to recompute keeper recommendations from the current inputs.
5. Review `Keeper Recommendations`.
6. Use manual overrides only for context the model cannot know.
7. Review `Scenario Comparison`, `Draft Impact`, and `Team Outlook`.
8. Export Excel, CSV, or PDF reports when the recommendations are ready.

### Core Concepts

The optimizer connects four data sets:

- `Teams`: the league teams, owners or assigned users, draft slots, keeper limits, and remaining
  draft capital.
- `Draft Results`: the original draft board. If a player was drafted by the same team and is still
  on that team's final roster, the original draft pick becomes the keeper cost.
- `Final Rosters`: the current keeper candidate pool. Players must be on a final roster before they
  can become recommendations.
- `ADP`: the current market price for each player. ADP is used to score drafted keepers against
  market value, and it becomes the keeper cost for unmatched players such as traded or waiver
  players.

The optimizer compares keeper cost against ADP, applies position weights and bonuses, enforces
keeper limits, then writes recommendation results. Downstream screens read those results:

- `League Dashboard` summarizes the current workspace, top recommendations, draft capital, news,
  and data health.
- `Keeper Recommendations` is the primary decision table.
- `Scenario Comparison` recalculates alternate strategic presets.
- `Draft Impact` projects which draft picks remain open or are forfeited.
- `Team Outlook` turns the selected keeper plan into team-by-team summaries.

### Sign In and Profile

Open the web app and sign in with an account created by an admin. The user menu in the top-right
shows your role and assigned team. Open `View Profile` from that menu to upload or remove a profile
image, review your assigned team, or change your password.

Admins see the `Admin` navigation item. Regular users do not see admin-only controls.

### League Dashboard

Use `League Dashboard` as the first stop after signing in or importing data. It shows whether the
frontend is connected to the API, which ADP snapshot is active, the top keeper board, draft capital,
league news, and data review warnings.

If the dashboard shows mock data or stale values, first confirm the API is running, then click
`Refresh`. If data is connected but recommendations look old, click `Run Optimizer`.

### Teams

Use `Teams` to review team names, owners or assigned users, draft slots, selected keepers, forfeited
picks, and remaining top-100 picks. Admins can add, edit, delete, and assign teams from the admin
team management controls.

Draft slot matters because it drives the projected snake draft board and the draft slot bonus. Fix
wrong draft slots before trusting `Draft Impact` or team draft capital.

### Draft Results

Use `Draft Results` to verify the original draft board. This table determines keeper cost for
players who were drafted by the same team that still rosters them. Missing picks, duplicate picks,
or incorrect teams can make keeper values wrong.

Admins import draft results from `Admin` -> `League Data Imports`. Paste the CSV, click `Preview`,
review errors and warnings, then click `Import` once the preview is valid.

### Final Rosters

Use `Final Rosters` to confirm every team's current keeper candidates. Roster status contributes to
the model: starters receive more status credit, while injured, suspended, questionable, or similar
statuses can carry risk penalties.

Admins import final rosters from `Admin` -> `League Data Imports`. Players not included in final
rosters will not be considered by the optimizer.

### Admin

Admins use `Admin` for account management, team management, and shared league imports.

`Users` lets admins create accounts, set roles, activate or deactivate users, assign users to teams,
view generated credentials, reset passwords, edit users, and delete users.

`Managed Teams` lets admins add teams, edit team names and draft slots, assign teams to users, set
fallback owner names, and delete teams.

`League Data Imports` handles draft results and final rosters. The import workflow is always:

1. Paste CSV data.
2. Click `Preview`.
3. Review row counts, errors, and warnings.
4. Fix CSV issues if needed.
5. Click `Import` once the preview is valid.

Preview validation catches missing headers, missing required values, invalid positions, invalid
numeric picks or ADP values, duplicate draft picks, duplicate player rows, and missing teams.
Missing teams are warnings because the import path can create missing teams automatically.

### ADP Input and ADP Preview

Admins manage ADP from the `Admin` screen. The ADP snapshot is the market baseline used by the
optimizer, so refresh or import ADP before running recommendations for a new decision cycle.

Use `Import Composite ADP` to build and import the configured composite ADP directly into the
active snapshot. Use `Build Composite ADP CSV` to download the generated composite CSV for review
or offline editing. You can also paste ADP CSV manually, click `Preview`, and then `Import`.

`ADP Preview` shows the active parsed ADP rows used by optimizer runs. Check this table when a
player has an unexpected score, missing value, or strange keeper cost.

### Optimizer Settings

Use `Optimizer Settings` when you want to change the model behavior before calculating
recommendations. Settings are part of the optimizer input; they do not simply change table display.

Keeper limits:

- `Maximum Keepers Per Team`: the maximum selected keepers per team.
- `Maximum Keepers Per Position`: the maximum selected keepers from any one position.
- `Maximum QB Keepers`: a separate QB cap, useful in superflex leagues where QB value can otherwise
  dominate.

Eligibility:

- `Minimum Keeper Value Threshold`: the minimum pick-value edge required before a player is worth
  considering. Lower it to include borderline or aggressive keepers. Raise it to require clearer
  pick savings.
- `Minimum Keeper Score Threshold`: the minimum final model score required. Raise it for stricter
  recommendations.
- `Latest ADP Pick to Consider`: ignores players with ADP later than this overall pick. Lower it to
  focus on stronger market players. Raise it to include more deep candidates.

Position weights:

- `QB Weight`, `RB Weight`, `WR Weight`, and `TE Weight` multiply keeper value by position.
- In superflex, QB weight usually has the largest strategic effect.
- Increase a position weight when replacement value is scarce or your league format rewards that
  position more heavily.
- Decrease a position weight when you want the model to protect draft picks instead of chasing that
  position.

Bonus toggles:

- `Tiered Superflex QB Scarcity`: adds extra QB credit by ADP tier.
- `Use Draft Slot Bonus`: adjusts scores based on where the team drafts.
- `Use Elite Player Bonus`: adds extra credit for elite players, using richer Draft Sharks metrics
  when available.

Click `Save Settings` when you intentionally change the model. Saving settings persists the new
values, reruns the optimizer, clears selected scenario overrides, refreshes the workspace, and
updates recommendations, draft impact, and outlooks.

Use settings before `Run Optimizer` when league rules or strategy changed. Examples:

- Lower thresholds when you want to inspect more speculative keepers.
- Raise thresholds when you only want obvious keeper values.
- Increase `QB Weight` or enable QB scarcity for superflex formats.
- Reduce `Maximum QB Keepers` if the league or your strategy should prevent multiple QB keepers.
- Lower `Latest ADP Pick to Consider` when fringe late-round players are cluttering the output.

### Run Optimizer

`Run Optimizer` is the main recompute button in the page header. It saves the currently visible
optimizer settings, runs the optimizer against live league data, and refreshes the displayed
workspace.

Click `Run Optimizer` after:

- importing draft results, final rosters, or ADP;
- changing optimizer settings but not using `Save Settings`;
- changing manual overrides;
- refreshing or importing ADP;
- editing team draft slots or keeper-relevant league data;
- returning to the app after someone else updated shared inputs.

`Run Optimizer` uses the current draft results, final rosters, active ADP snapshot, manual
overrides, team data, and optimizer settings. It changes the recommendation results.

### Refresh

`Refresh` is the display reload button in the page header. It reloads workspace data from the API
and resets table display state such as filters and sorting. It does not rerun the optimizer and it
does not change recommendations.

Click `Refresh` when:

- the API was started or restarted;
- another user or admin changed data and you want to reload it;
- table filters or sorting are hiding rows;
- the UI status looks stale but you do not want to recalculate recommendations.

Use `Run Optimizer`, not `Refresh`, when input changes should produce new keeper recommendations.

### Keeper Recommendations

Use `Keeper Recommendations` as the primary decision screen. It shows each candidate's team, player,
position, keeper cost, ADP, keeper value, score, eligibility or recommendation state, reason, and
manual override controls.

Recommendation states:

- `Recommended`: selected by the optimizer after applying settings and limits.
- `Eligible`: good enough to consider, but not selected because another player ranked higher or a
  team or position limit was reached.
- `Excluded`: failed a threshold or was manually excluded.

Manual overrides:

- `Auto`: let the optimizer decide.
- `Force Keep`: request that the optimizer keep the player if roster and keeper limits allow it.
- `Exclude`: remove the player from selection.

Use manual overrides sparingly for real-world context the model does not know, such as personal
risk tolerance, news that has not affected ADP, special league rules, or intentional team strategy.
Saving a manual override reruns the optimizer and marks the team plan as custom.

Exports are available from this screen:

- `Excel`: workbook of keeper recommendations.
- `CSV`: selected keeper recommendation rows.
- `PDF`: league or team outlook report.

### Scenario Comparison

Use `Scenario Comparison` to compare strategy presets without manually changing all settings.
Available presets include `Pure Value`, `Balanced`, `Superflex Heavy`, `Win Now`, and `Rebuild`.

Click `Run All Presets` after data or settings change. The button saves the current settings and
recomputes the preset comparison. The comparison shows selected keepers, forfeited picks, and notes
by team.

Each team has an `Outlook Scenario` selector. This controls which scenario feeds that team's active
keeper plan, team outlook, and draft impact view. The app recommends a scenario when no explicit
selection is saved, but you can choose a different preset for a team when you want the report to
reflect a specific strategy.

### Draft Impact

Use `Draft Impact` after recommendations or scenario selections are set. It projects the draft board
after selected keeper picks are forfeited, counts forfeited picks, and shows open top-100 picks.

This view is downstream of keeper selections. If a keeper, manual override, optimizer setting, ADP
snapshot, or scenario selection changes, rerun the optimizer or scenario comparison as appropriate
before using this as a draft planning source.

### Team Outlook

Use `Team Outlook` for a plain-language summary by team. Each outlook summarizes the team stance,
recommended keepers, lost picks, draft capital, and risk notes. Export a team PDF when you need a
shareable report for one manager.

Outlooks are summaries of the active selected keeper plan. The detailed math remains in `Keeper
Recommendations`.

## Scoring Model

The optimizer uses:

```text
Keeper Score =
  Keeper Value * Position Weight
  + Talent Bonus
  + Status Bonus
  + Draft Slot Bonus
  + QB Scarcity Bonus
  + Elite Anchor Bonus
  - Risk Penalty
```

Where:

```text
Keeper Value = Keeper Cost Pick - ADP Pick
```

Superflex QB scarcity bonus is tiered:

- `+40`
- `+30`
- `+20`
- `+10`

Elite anchor bonus:

- Top 12 ADP: `+15`
- Top 24 ADP: `+8`

## Exports

Available from the UI and API:

- Excel: keeper recommendations workbook
- CSV: selected keeper recommendation rows
- PDF: league/team outlook report

Excel workbook sheets:

- League Summary
- Drafted Rosters
- Final Rosters
- ADP Input
- Dynamic Keeper Model
- Projected Keepers
- Team Outlooks
- Settings

The workbook avoids Excel tables, spill formulas, charts, and metadata-heavy features for desktop Excel compatibility.

## Useful Commands

From the repository root:

```bash
npm run dev:web
npm run build:web
npm run lint:web
npm run typecheck:web
```

From `apps/api`:

```bash
.venv/bin/pytest
.venv/bin/ruff check app tests
.venv/bin/python -m compileall app
uvicorn app.main:app --reload
```

## API Endpoints

Primary endpoints:

```text
GET    /health

POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
PATCH  /api/auth/profile
POST   /api/auth/password

POST   /api/admin/users
GET    /api/admin/users
PATCH  /api/admin/users/{user_id}
POST   /api/admin/users/{user_id}/reset-password
DELETE /api/admin/users/{user_id}
GET    /api/admin/defaults/optimizer-settings
PATCH  /api/admin/defaults/optimizer-settings

POST   /api/leagues
GET    /api/leagues
GET    /api/leagues/{league_id}
PATCH  /api/leagues/{league_id}
POST   /api/leagues/{league_id}/teams
GET    /api/leagues/{league_id}/teams
PATCH  /api/teams/{team_id}
DELETE /api/teams/{team_id}

GET    /api/leagues/{league_id}/draft-results
POST   /api/leagues/{league_id}/draft-results/preview
POST   /api/leagues/{league_id}/draft-results/import

GET    /api/leagues/{league_id}/final-rosters
POST   /api/leagues/{league_id}/final-rosters/preview
POST   /api/leagues/{league_id}/final-rosters/import

POST   /api/leagues/{league_id}/adp-snapshots
GET    /api/leagues/{league_id}/adp-snapshots
GET    /api/adp-snapshots/{snapshot_id}
POST   /api/leagues/{league_id}/adp/preview
POST   /api/leagues/{league_id}/adp/import
POST   /api/leagues/{league_id}/adp/refresh
POST   /api/leagues/{league_id}/adp/import-composite

GET    /api/leagues/{league_id}/optimizer/settings
PATCH  /api/leagues/{league_id}/optimizer/settings
POST   /api/leagues/{league_id}/optimizer/run
GET    /api/leagues/{league_id}/optimizer/results
POST   /api/leagues/{league_id}/optimizer/scenarios

GET    /api/leagues/{league_id}/manual-overrides
PUT    /api/leagues/{league_id}/manual-overrides

GET    /api/leagues/{league_id}/scenario-selections
PUT    /api/leagues/{league_id}/scenario-selections/{team_id}
GET    /api/news/fantasy-football
GET    /api/leagues/{league_id}/draft-impact
GET    /api/leagues/{league_id}/exports/keeper-recommendations.xlsx
GET    /api/leagues/{league_id}/exports/keeper-recommendations.csv
GET    /api/leagues/{league_id}/exports/adp-template.csv
GET    /api/leagues/{league_id}/exports/team-outlooks.pdf
```

Interactive OpenAPI docs are available at:

```text
http://localhost:8000/docs
```

## Local SQLite Smoke Test

If you want to try the API without Postgres:

```bash
cd apps/api
DATABASE_URL=sqlite:////tmp/keeper_optimizer_dev.db \
CREATE_TABLES_ON_STARTUP=true \
SEED_DATA_ON_STARTUP=true \
SAMPLE_DATA_PATH=../../sample-data \
SESSION_SECRET=local-dev-session-secret \
INITIAL_ADMIN_EMAIL=admin@example.com \
INITIAL_ADMIN_PASSWORD=change-me \
uvicorn app.main:app --reload
```

This is useful for quick development, but Postgres is the recommended local database.

## Troubleshooting

### The web app shows mock data

The frontend falls back to mock data if the API is unavailable or no league exists.

Check:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/leagues
```

Also confirm `apps/web/.env.local` contains:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### CSV import button is disabled

Click `Preview` first. Imports are disabled until the current preview has no errors.

### Optimizer run fails

Confirm the league has:

- Teams
- Draft results
- Final rosters
- At least one ADP snapshot

### Frontend returns stale Next.js errors after a build

Stop and restart the dev server:

```bash
npm run dev:web
```

### Database schema is missing tables

For local development, either run:

```bash
cd apps/api
python -c "from app.db.session import init_db; init_db()"
```

Or start the API with:

```bash
CREATE_TABLES_ON_STARTUP=true uvicorn app.main:app --reload
```

## Current Limitations

- Alembic migrations are not wired yet.
- Yahoo or external league-provider integration is not implemented yet.
- Frontend CRUD is focused on users, teams, imports, optimizer runs, overrides, scenarios, draft impact, and exports.
- PDF reports are intentionally simple and dependency-free.
