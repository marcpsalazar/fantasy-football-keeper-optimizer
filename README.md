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

## CSV Preview and Import Workflow

In the web app:

1. Open `Draft Results`, `Final Rosters`, or `ADP Input`.
2. Paste CSV data.
3. Click `Preview`.
4. Review row counts, errors, and warnings.
5. Click `Import` once the preview is valid.

Preview validation catches:

- Missing headers
- Missing required values
- Invalid positions
- Invalid numeric picks or ADP values
- Duplicate draft picks
- Duplicate player rows
- Missing teams

Missing teams are warnings, not errors, because the import path can create missing teams automatically.

## Optimizer Workflow

1. Create or seed a league.
2. Create or import teams.
3. Import draft results.
4. Import final rosters.
5. Import an ADP snapshot.
6. Open `Optimizer Settings` and adjust limits, eligibility floors, and position weights.
7. Click `Run Optimizer`.
8. Review `Keeper Recommendations`.
9. Apply manual overrides if needed:
   - Auto: let the optimizer decide.
   - Force Keep: select the player if roster constraints allow.
   - Exclude: remove the player from selection.
10. Review `Scenario Comparison`, `Draft Impact`, and `Team Outlooks`.
11. Export reports.

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
POST   /api/leagues
GET    /api/leagues
GET    /api/leagues/{league_id}
PATCH  /api/leagues/{league_id}
POST   /api/leagues/{league_id}/teams
GET    /api/leagues/{league_id}/teams
PATCH  /api/teams/{team_id}

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

GET    /api/leagues/{league_id}/optimizer/settings
PATCH  /api/leagues/{league_id}/optimizer/settings
POST   /api/leagues/{league_id}/optimizer/run
GET    /api/leagues/{league_id}/optimizer/results
POST   /api/leagues/{league_id}/optimizer/scenarios

GET    /api/leagues/{league_id}/manual-overrides
PUT    /api/leagues/{league_id}/manual-overrides

GET    /api/leagues/{league_id}/draft-impact
GET    /api/leagues/{league_id}/exports/keeper-recommendations.xlsx
GET    /api/leagues/{league_id}/exports/keeper-recommendations.csv
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
- There is no authentication or multi-user ownership model yet.
- Yahoo or external league-provider integration is not implemented yet.
- Frontend CRUD is partial; imports, optimizer runs, overrides, scenarios, draft impact, and exports are wired.
- PDF reports are intentionally simple and dependency-free.
