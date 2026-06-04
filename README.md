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
- **Multi-league platform**: create or join multiple leagues, switch between them with the league selector. Platform admins can access all leagues without a per-league membership.
- **Trade Analyzer**: model the keeper value impact of a proposed trade before agreeing to it. Supports player-for-player trades and draft pick swaps. Shows baseline vs. hypothetical keeper lineups, surplus delta, gained and lost players, and an optional AI narrative verdict.
- **Opponent Keeper Intelligence**: surfaces probable keeper choices for every team in the league, derived from each team's optimizer recommendations. Visible in Mock Draft setup as an expandable panel showing opponent teams, their likely-kept players (name, position, ADP round, confidence), and a position breakdown. Probable keepers are also injected into the AI strategy plan context so the plan accounts for players likely off the board before pick 1.
- **End-of-Season Analysis Suite**: a four-screen system for closing the loop on keeper decisions each year.
  - **Final Keepers**: admin records the official keeper list for each team after the deadline. Admins can pre-fill from optimizer recommendations, adjust per team, then click Finalize & Lock to publish to all members. Non-admin members see a read-only view.
  - **Final Draft Board**: auto-generated snake draft grid derived from Final Keeper Selections. Forfeited picks are highlighted in red with the kept player's name and position. Available picks show by overall pick number, with columns fixed by draft slot.
  - **Season Analysis**: post-season decision quality report. Cross-references Final Keeper Selections, KeeperOutcomes, and Recommendations to categorize each player as Hit, Miss, Bust, Left on Table, Dodged, Below ADP, or Unknown. Shows league-level hit rate, bust rate, recommendation accuracy, and opportunity cost, with per-team expandable tables.
  - **Keeper History** (formerly Historical Keeper ROI Tracker): multi-year ROI tracking by season, team, and player. Admins import end-of-season outcomes via Sleeper auto-fetch (available to all leagues regardless of platform — no Sleeper account required) or CSV fallback. The Sleeper stats API cross-references keeper candidates by Sleeper player ID first, then by full name + NFL team composite.
- **Player headshots**: player dialogs (keeper explanation modal and mock draft player detail) display the player's headshot sourced from the Sleeper CDN, with a team-color circle fallback showing the team abbreviation when no photo is available.
- **Sleeper league import**: paste a Sleeper League ID to automatically pull teams, draft results, and final rosters — preview first, then commit.
- **Yahoo Fantasy league import**: connect via Yahoo OAuth to automatically pull teams, draft results, and final rosters from a Yahoo Fantasy Sports league — preview first, then commit.
- **Mock Draft**: run a simulated draft against AI-powered bots, get a personalized pre-draft strategy plan, and receive a graded post-draft analysis.
  - Full snake draft board with keeper forfeit pre-placement.
  - 9 bot personalities × 3 difficulty levels, configurable per team.
  - Bot pick speed: Slow / Medium / Fast animation delay.
  - AI bot picks, AI strategy plans, and AI post-draft analysis (all optional; deterministic fallbacks always available).
  - AI player detail summaries in the player dialog (opt-in; requires `PLAYER_SUMMARY_AI_ENABLED=true`).
  - Position draft limits enforced — Draft button disabled and roster tiles highlighted when a position cap is reached.
  - Pick timer (30 / 60 / 90 / 120 seconds) with auto-pick on expiry.
  - Completed mock history with letter grade, score, and recap. Side-by-side draft comparison. Rerun analysis on any completed session.
- **AI keeper explanations**: click any player name in Keeper Recommendations to open a detail modal showing the player's headshot, position, and a plain-English explanation of why the optimizer recommended or passed on that player (short reason, value explanation, risk note, opportunity cost, decision badge). Responses are cached.
- **AI scenario narratives**: click "Generate AI Analysis" in Scenario Comparison for a plain-English tradeoff summary across all five presets. Personalized for the signed-in user's assigned team when available.
- **Composite ADP**: one-click "Update ADP" button builds a weighted-median board from DraftSharks + Fantasy Football Calculator and imports it directly.
- **AI cost controls**: set a monthly token budget (`AI_MONTHLY_TOKEN_BUDGET`) to cap all AI spending. Platform admins can review token usage and estimated costs in the Admin AI Usage panel.

## Stack

- `apps/api`: FastAPI, SQLModel, Pydantic, openpyxl
- `apps/web`: Next.js, TypeScript, Tailwind, shadcn-style UI components, TanStack Table
- Database: PostgreSQL for normal local development, SQLite works for quick local smoke testing
- Local DB bootstrap: SQLModel `create_all`
- Seed data: CSV files in `sample-data`
- Production hosting: Railway web service, Railway API service, and Railway Postgres

## User Roles

Three role tiers control access:

| Role | Scope | Capabilities |
|---|---|---|
| `platform_admin` | Global | Manage all leagues and all users; access Admin panel for every league; review AI usage |
| `league_admin` | Per-league | Manage one league's teams, imports, ADP, and memberships |
| `member` | Per-league | View league data, run optimizer, use mock draft, export reports |

Platform admins are created by seeding or by direct DB assignment. League admins are assigned per-league from `Admin` → `Members`. A platform admin always has league admin privileges in every league without needing an explicit membership.

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
alembic upgrade head
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
API_PROXY_TARGET=http://localhost:8000
NEXT_PUBLIC_API_BASE_URL=
CREATE_TABLES_ON_STARTUP=false
SEED_DATA_ON_STARTUP=false
SAMPLE_DATA_PATH=sample-data
SESSION_SECRET=change-me
SESSION_COOKIE_NAME=keeper_optimizer_session
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_SAMESITE=lax
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
SESSION_COOKIE_NAME=keeper_optimizer_session
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_SAMESITE=lax
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=change-me

# ADP
ADP_PROVIDER=fantasyfootballcalculator
FANTASY_FOOTBALL_CALCULATOR_ADP_URL=https://fantasyfootballcalculator.com/api/v1/adp
ADP_REFRESH_URL=
ADP_REFRESH_TOKEN=
ADP_REFRESH_TIMEOUT_SECONDS=20
ADP_AUTO_REFRESH_ENABLED=false
ADP_AUTO_REFRESH_INTERVAL_HOURS=168
ADP_AUTO_REFRESH_ON_STARTUP=true

# AI-synthesized ADP (ADP_PROVIDER=ai_synthesized)
ADP_AI_BOARD_SIZE=250
ADP_AI_EXTRA_CANDIDATES=100
ADP_AI_REVIEW_REQUIRED=true
ADP_AI_TIMEOUT_SECONDS=180
ADP_AI_MAX_OUTPUT_TOKENS=32000
ADP_AI_MAX_JUMP_WARNING=60
ADP_AI_MAX_JUMP_WARNING_COUNT=25

# AI features
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
AI_MONTHLY_TOKEN_BUDGET=0

MOCK_DRAFT_AI_ENABLED=false
MOCK_DRAFT_AI_MODEL=gpt-5.4-mini
MOCK_DRAFT_AI_TIMEOUT_SECONDS=90
MOCK_DRAFT_AI_CANDIDATE_LIMIT=40
MOCK_DRAFT_AI_MAX_AI_ROUND=0

KEEPER_EXPLANATION_AI_ENABLED=false
KEEPER_EXPLANATION_MODEL=gpt-5.4-mini
KEEPER_EXPLANATION_AI_TIMEOUT_SECONDS=30

SCENARIO_NARRATIVE_AI_ENABLED=false
SCENARIO_NARRATIVE_MODEL=gpt-5.4-mini
SCENARIO_NARRATIVE_AI_TIMEOUT_SECONDS=45

PLAYER_SUMMARY_AI_ENABLED=false
PLAYER_SUMMARY_MODEL=gpt-5.4-mini
PLAYER_SUMMARY_AI_TIMEOUT_SECONDS=30
```

AI features are opt-in. All AI calls require `OPENAI_API_KEY` to be set. Each feature has its own enable flag:

- `MOCK_DRAFT_AI_ENABLED=true` — bot picks, post-draft analysis, and strategy plans call an OpenAI model. Falls back to deterministic logic if the model call fails or returns an invalid player. Set `MOCK_DRAFT_AI_MAX_AI_ROUND` to a round number to limit AI picks to early rounds only (0 = no limit).
- `KEEPER_EXPLANATION_AI_ENABLED=true` — keeper recommendation explanations are generated on demand and cached.
- `SCENARIO_NARRATIVE_AI_ENABLED=true` — scenario comparison narratives are generated on demand and cached.
- `PLAYER_SUMMARY_AI_ENABLED=true` — player detail summaries in the mock draft player dialog are generated on demand and cached.

Set `AI_MONTHLY_TOKEN_BUDGET` to a positive integer (total tokens) to enforce a monthly spending cap across all AI features. When the budget is exceeded, all AI calls are blocked until the next calendar month. Platform admins can review usage in `Admin` → `AI Usage`.

AI-synthesized ADP is also opt-in. Set `ADP_PROVIDER=ai_synthesized`,
`ADP_AUTO_REFRESH_ENABLED=true`, and `OPENAI_API_KEY` on the API service to refresh ADP weekly.
The generated board must pass guardrails before import: exact board size, no duplicate players,
only `QB/RB/WR/TE/K/DST`, at least one player from every allowed position, valid positive ADP
picks, contiguous ranks, source notes, and bounded movement warnings versus the prior snapshot.

`apps/web/.env.local` is loaded by Next.js:

```text
API_PROXY_TARGET=http://localhost:8000
NEXT_PUBLIC_API_BASE_URL=
```

By default the browser calls same-origin `/api/...` paths. Next.js rewrites those requests to
`API_PROXY_TARGET`. This keeps local development simple and avoids production third-party-cookie
issues by letting the hosted web app and API share the public web origin. `NEXT_PUBLIC_API_BASE_URL`
is still supported for explicit direct API calls, but it should normally stay blank.

Session cookie behavior:

- In development, cookies default to `Secure=false` and `SameSite=lax`.
- In production, cookies default to `Secure=true` and `SameSite=none`.
- `SESSION_COOKIE_SECURE` and `SESSION_COOKIE_SAMESITE` can override those defaults.

## Railway Deployment

Production is deployed on Railway in project `easygoing-upliftment` with three services:

```text
@keeper-optimizer/web  Next.js frontend
api                    FastAPI backend
Postgres               Railway PostgreSQL database
```

Current public service URLs:

```text
Web: https://keeper-optimizerweb-production.up.railway.app
API: https://api-production-666b.up.railway.app
Custom domain target: https://mayhemfantasyfootballtools.com
```

Attach the custom domain to `@keeper-optimizer/web`, not to `api`. The web service proxies `/api/*`
to the API service, so users should only need the web domain.

### API Railway Variables

Set these on the `api` service:

```text
APP_NAME=Fantasy Football Keeper Optimizer API
ENVIRONMENT=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
CORS_ORIGINS=["https://keeper-optimizerweb-production.up.railway.app","https://mayhemfantasyfootballtools.com"]
CREATE_TABLES_ON_STARTUP=false
SEED_DATA_ON_STARTUP=false
SESSION_SECRET=<long-random-secret>
SESSION_COOKIE_SECURE=true
INITIAL_ADMIN_EMAIL=<admin-email>
INITIAL_ADMIN_PASSWORD=<temporary-admin-password>
```

The API normalizes Railway's plain `postgresql://...` database URL to
`postgresql+psycopg://...` before creating the SQLAlchemy engine.

`apps/api/railway.json` configures the API service to:

- build with `apps/api/Dockerfile`;
- run `alembic upgrade head` before deploy;
- use `/health` as the health check;
- start the container with the Dockerfile `CMD`.

### Web Railway Variables

Set these on `@keeper-optimizer/web`:

```text
API_PROXY_TARGET=https://api-production-666b.up.railway.app
NEXT_PUBLIC_API_BASE_URL=
```

The deployed frontend should not bake in the API hostname. Keeping `NEXT_PUBLIC_API_BASE_URL` blank
means browser requests go to `/api/...` on the current web origin, including the custom domain.

### Railway CLI Commands

Useful production checks:

```bash
railway status
railway service list
railway deployment list --service api --environment production --json
railway deployment list --service '@keeper-optimizer/web' --environment production --json
railway logs --service api --environment production --lines 120
railway logs --service '@keeper-optimizer/web' --environment production --lines 120
```

Deploy from the repository root:

```bash
# API: pass-as-root is required to avoid Node.js builder detection from the monorepo package.json
railway up ./apps/api --path-as-root --service api --environment production --detach
# Web: must have a committed git state first
railway up --service '@keeper-optimizer/web' --environment production --detach
```

Add the custom domain from the Railway dashboard if the CLI domain command returns an authorization
error:

1. Open Railway project `easygoing-upliftment`.
2. Select `@keeper-optimizer/web`.
3. Open `Settings` -> `Networking`.
4. Add `mayhemfantasyfootballtools.com`.
5. Wait for DNS and SSL provisioning to complete.

After domain activation, verify:

```bash
curl https://mayhemfantasyfootballtools.com
curl -i -X OPTIONS https://api-production-666b.up.railway.app/api/auth/me \
  -H 'Origin: https://mayhemfantasyfootballtools.com' \
  -H 'Access-Control-Request-Method: GET'
```

## Database Migrations and Seed Data

Apply database migrations before running the API:

```bash
cd apps/api
alembic upgrade head
```

Seed manually after migrations:

```bash
cd apps/api
python -m app.db.seed
```

`CREATE_TABLES_ON_STARTUP=true` remains available for quick throwaway development databases, but Alembic is the normal path for local and production schema changes.

### One-time data backfill scripts

`apps/api/backfill_player_images.py` — matches existing CSV-imported players to Sleeper's player database by name and position, then writes the Sleeper CDN headshot URL to `players.image_url`. Only needs to be run once after migrating to `0018`. New Sleeper and Yahoo imports populate `image_url` automatically.

```bash
# Local
cd apps/api
.venv/bin/python backfill_player_images.py

# Production (via Railway public DB URL)
railway run --service Postgres -- bash -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" .venv/bin/python backfill_player_images.py'
```

Pass `--dry-run` to preview matches without writing to the database.

For a database that was previously created with `CREATE_TABLES_ON_STARTUP=true`, stamp the baseline before applying newer migrations:

```bash
cd apps/api
alembic stamp 20260521_0001
alembic upgrade head
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

The app is a multi-league platform with user-specific modeling. Platform admins manage users globally. League admins manage league inputs, ADP, teams, and memberships. Every signed-in member can review league data, tune their own optimizer settings, run recommendations, choose scenario views, apply manual overrides, and export their reports.

The main workflow is:

1. Sign in.
2. Select the active league from the league selector (top of sidebar) if you belong to more than one.
3. Confirm the league, teams, draft results, final rosters, and ADP snapshot are loaded.
4. Adjust `Optimizer Settings` when the model should use a different strategy or league rule.
5. Click `Run Optimizer` to recompute keeper recommendations from the current inputs.
6. Review `Keeper Recommendations`.
7. Use manual overrides only for context the model cannot know.
8. Review `Scenario Comparison`, `Draft Impact`, and `Team Outlook`.
9. Export Excel, CSV, or PDF reports when the recommendations are ready.

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

League admins and platform admins see the `Admin` navigation item. Regular members do not see admin-only controls.

After signing in, the league selector at the top of the sidebar shows all leagues you belong to. Select a league to switch the active workspace. Platform admins can access any league without an explicit membership.

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

Admins use `Admin` for account management, team management, shared league imports, league settings, and AI observability.

`Users` (platform admin only) lets admins create accounts, set global roles (`user` or `platform_admin`), activate or deactivate users, view generated credentials, reset passwords, edit users, and delete users.

`Managed Teams` lets admins add teams, edit team names and draft slots, assign teams to users, set fallback owner names, and delete teams.

`Members` lets league admins add or remove league members and set per-league roles (`league_admin` or `member`).

`League Data Imports` handles draft results and final rosters. The import workflow is always:

1. Paste CSV data.
2. Click `Preview`.
3. Review row counts, errors, and warnings.
4. Fix CSV issues if needed.
5. Click `Import` once the preview is valid.

Preview validation catches missing headers, missing required values, invalid positions, invalid
numeric picks or ADP values, duplicate draft picks, duplicate player rows, and missing teams.
Missing teams are warnings because the import path can create missing teams automatically.

`Import from Sleeper` pulls teams, draft results, and final rosters from a live Sleeper league:

1. Paste the Sleeper League ID (found in the Sleeper URL, e.g. `sleeper.com/leagues/123456789`).
2. Select the season year.
3. Click `Preview` to validate the import — the panel shows which teams, draft picks, and roster entries will be created.
4. Click `Import` to commit.

`Roster Settings` lets admins configure the mock draft round count, allowed positions, roster slot counts, position caps, and bench limits for the league.

`AI Usage` (platform admin only) shows a log of recent AI requests with token counts, estimated cost, feature type, and whether the monthly budget is currently exceeded. Use this to monitor spending when AI features are enabled.

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

### Trade Analyzer

Use `Trade Analyzer` to model the keeper value impact of a proposed trade before agreeing to it.

1. Select your team from the dropdown.
2. In the **Give** section, choose one or more players from your roster to trade away. For pick-only or pick-included trades, add draft rounds under **Give Picks**.
3. In the **Receive** section, choose players you would receive. If a received player comes with a draft pick (which becomes the keeper cost), set the round under **Receive Picks**.
4. Click `Analyze Trade` to run the optimizer on both the baseline (current roster) and the hypothetical (post-trade roster).
5. Review:
   - **Baseline Keepers**: which players the optimizer would currently recommend keeping.
   - **Hypothetical Keepers**: which players would be recommended after the trade.
   - **Surplus Delta**: the net change in keeper pick surplus from the trade.
   - **Gained / Lost**: the players added and removed from the keeper plan.
6. Enable AI narrative (requires `KEEPER_EXPLANATION_AI_ENABLED=true`) for a plain-English verdict: `Good`, `Neutral`, or `Bad`, with a summary, key risk, and opportunity cost.

The trade analyzer does not commit any changes. It is a modeling tool only.

### Final Keepers

Use `Final Keepers` after the keeper deadline to record each team's official selections and publish them to all league members.

**Admin workflow:**

1. Open `Final Keepers` from the sidebar.
2. Click `Pre-fill from Recommendations` to load the optimizer's current recommendations as a starting point.
3. For each team, add or remove players as needed. Each chip shows the player's name, position, and keeper cost round.
4. Click `Save` per team to persist changes.
5. When all teams are confirmed, click `Finalize & Lock` to publish the selections and lock them from further changes.

Once finalized:
- All league members see the confirmed selections in a read-only view with a green confirmation banner.
- The Final Draft Board is automatically populated with the forfeited picks.
- Finalization is irreversible except by a platform admin via `unfinalize`.

Non-admin members see a read-only display; no save or finalize buttons are shown.

### Final Draft Board

Use `Final Draft Board` to see the full snake draft pick grid after keepers are finalized.

- Columns are fixed by draft slot (one column per team, ordered by slot number).
- Rows are draft rounds.
- **Red cells** are forfeited picks, showing the kept player's name and position badge.
- **Gray pick numbers** are available picks.
- A **Forfeited Picks Summary** table below the grid lists every forfeited pick with overall pick number, round, team, kept player, and position.

The round count is derived from Roster Settings under Admin (`slots` total). If rounds look wrong, check the roster slot configuration. The board reflects whatever `cost_round` and `cost_pick` were recorded on each keeper selection in Final Keepers.

### Season Analysis

Use `Season Analysis` after the season and after outcomes have been imported to review decision quality.

League summary cards show:
- **Hit Rate**: percentage of kept players who met ADP projection.
- **Bust Rate**: percentage of kept players who significantly underperformed.
- **Left on Table**: players not kept who would have been Hits.
- **Dodged**: players not kept who turned out to be Busts.
- **Rec Hit Rate**: how often the optimizer's recommended keepers actually hit.
- **Avg Opportunity Cost**: average rounds of value left on the table per missed keeper.

Expand a team card to see a decision table for every keeper candidate, with category badges color-coded: Hit (green), Miss (amber), Bust (red), Left on Table (blue), Dodged (gray).

Requires season outcomes to be imported. See the Admin section for Sleeper auto-fetch and CSV import.

### Keeper History

Use `Keeper History` for multi-year ROI tracking after one or more seasons of outcome data have been imported.

Three sections:
- **League Season Summary**: year-by-year league-wide stats — hit rate, bust rate, opportunity cost.
- **Team ROI**: expandable cards per manager showing their keeper track record across seasons.
- **Player History**: expandable cards per recurring keeper candidate — how often they were kept and whether they paid off.

**Importing season outcomes (Admin only):**

1. Open `Admin` → `Season Outcomes`.
2. Select **Auto-fetch from Sleeper** (recommended): choose the season year and scoring format, click `Fetch & Preview` to match keeper candidates against Sleeper's global stats database, then click `Import` to commit.
3. Alternatively, select **Upload CSV** and paste a CSV with columns `team`, `player`, `position`, `finish_rank`, `fantasy_points`.

Sleeper auto-fetch works for all leagues regardless of whether the league uses Sleeper — it pulls stats from Sleeper's public API and cross-references your keeper candidates by name and NFL team. No Sleeper account or league ID is required.

### Mock Draft

Use `Mock Draft` to simulate a draft against AI-powered bots using real league keeper context and
the current ADP snapshot.

**Setup:**

1. Select your team (or have an admin assign you one).
2. Choose bot personality and difficulty per opposing team, or use the defaults.
3. Choose a bot pick speed: `Slow` (1.5 s delay), `Medium` (0.6 s), or `Fast` (0.15 s).
4. Set an optional pick timer (30–120 seconds). Expired picks are filled automatically with the top available player.
5. Click `Generate Strategy Plan` to get an AI-generated pre-draft plan with targets, fades, round priorities, and contingencies (requires `MOCK_DRAFT_AI_ENABLED=true`).
6. Click `Start Draft` to begin.

**During the draft:**

- Keeper forfeits are pre-placed on the draft board. They do not count as picks and cannot be changed.
- When it is your pick, use `Available Players` to browse by position or scroll by ADP. Click a player row to open the player detail dialog, which shows the player's headshot, stats, and ADP edge. If `PLAYER_SUMMARY_AI_ENABLED=true`, an AI scouting note is also shown.
- Click `Draft` to select a player.
- If a position's draft limit is reached, the `Draft` button for players of that position is grayed out and the corresponding roster tile turns red.
- Bots pick automatically. AI bot picks are used when `MOCK_DRAFT_AI_ENABLED=true`; otherwise bots fall back to deterministic scoring. Set `MOCK_DRAFT_AI_MAX_AI_ROUND` to limit AI picks to early rounds (0 = unlimited).
- `Pause` and `Resume` are available if you need to step away.

**After the draft:**

- `Complete` ends the draft and generates a post-draft analysis with a letter grade, numeric score, pick feedback, what-if scenarios, and future advice.
- Completed mocks are saved to history. Select two or more from history to compare side-by-side.
- `Rerun Analysis` is available on any completed session to regenerate the post-draft grade and feedback.

**League roster settings** control the mock draft round count, allowed positions, slot counts, position caps, and bench limits. Admins can edit these from `Roster Settings` under `Admin`.

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
GET    /api/admin/ai/usage

POST   /api/leagues
GET    /api/leagues
GET    /api/leagues/my
GET    /api/leagues/{league_id}
PATCH  /api/leagues/{league_id}
DELETE /api/leagues/{league_id}
POST   /api/leagues/{league_id}/teams
GET    /api/leagues/{league_id}/teams
PATCH  /api/teams/{team_id}
DELETE /api/teams/{team_id}

GET    /api/leagues/{league_id}/memberships
POST   /api/leagues/{league_id}/memberships
PATCH  /api/leagues/{league_id}/memberships/{user_id}/role
DELETE /api/leagues/{league_id}/memberships/{user_id}
PATCH  /api/leagues/{league_id}/memberships/me/avatar

GET    /api/leagues/{league_id}/draft-results
POST   /api/leagues/{league_id}/draft-results/preview
POST   /api/leagues/{league_id}/draft-results/import

GET    /api/leagues/{league_id}/final-rosters
POST   /api/leagues/{league_id}/final-rosters/preview
POST   /api/leagues/{league_id}/final-rosters/import

POST   /api/leagues/{league_id}/import/sleeper/preview
POST   /api/leagues/{league_id}/import/sleeper/commit

POST   /api/leagues/{league_id}/adp-snapshots
GET    /api/leagues/{league_id}/adp-snapshots
GET    /api/adp-snapshots/{snapshot_id}
POST   /api/leagues/{league_id}/adp/preview
POST   /api/leagues/{league_id}/adp/import
POST   /api/leagues/{league_id}/adp/refresh
POST   /api/leagues/{league_id}/adp/import-composite
GET    /api/leagues/{league_id}/adp/coverage-summary
GET    /api/leagues/{league_id}/adp/players/{player_id}/summary
POST   /api/leagues/{league_id}/adp/players/{player_id}/summary

GET    /api/leagues/{league_id}/optimizer/settings
PATCH  /api/leagues/{league_id}/optimizer/settings
POST   /api/leagues/{league_id}/optimizer/run
GET    /api/leagues/{league_id}/optimizer/results
POST   /api/leagues/{league_id}/optimizer/scenarios
POST   /api/leagues/{league_id}/optimizer/trade-analysis
GET    /api/leagues/{league_id}/keeper-signals

POST   /api/leagues/{league_id}/keeper-outcomes/preview
POST   /api/leagues/{league_id}/keeper-outcomes/import
POST   /api/leagues/{league_id}/keeper-outcomes/sleeper-preview
POST   /api/leagues/{league_id}/keeper-outcomes/sleeper-import
GET    /api/leagues/{league_id}/keeper-history

GET    /api/leagues/{league_id}/final-keepers
GET    /api/leagues/{league_id}/final-keepers/prefill
PUT    /api/leagues/{league_id}/final-keepers/{team_id}
POST   /api/leagues/{league_id}/final-keepers/finalize
POST   /api/leagues/{league_id}/final-keepers/unfinalize

GET    /api/leagues/{league_id}/draft-board
GET    /api/leagues/{league_id}/season-analysis

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

POST   /api/mock-drafts
GET    /api/mock-drafts/{session_id}
PATCH  /api/mock-drafts/{session_id}
DELETE /api/mock-drafts/{session_id}
POST   /api/mock-drafts/{session_id}/start
POST   /api/mock-drafts/{session_id}/pause
POST   /api/mock-drafts/{session_id}/resume
POST   /api/mock-drafts/{session_id}/pick
POST   /api/mock-drafts/{session_id}/bot-pick
POST   /api/mock-drafts/{session_id}/complete
POST   /api/mock-drafts/{session_id}/end
POST   /api/mock-drafts/{session_id}/strategy-plan
POST   /api/mock-drafts/{session_id}/analysis/rerun
GET    /api/leagues/{league_id}/mock-drafts

POST   /api/leagues/{league_id}/optimizer/results/{rec_id}/explanation
GET    /api/leagues/{league_id}/optimizer/results/{rec_id}/explanation
POST   /api/leagues/{league_id}/optimizer/scenarios/narrative
GET    /api/leagues/{league_id}/optimizer/scenarios/narrative
```

Interactive OpenAPI docs are available at:

```text
http://localhost:8000/docs
```

## Local SQLite Smoke Test

If you want to try the API without Postgres:

```bash
cd apps/api
DATABASE_URL=sqlite:////tmp/keeper_optimizer_dev.db alembic upgrade head

DATABASE_URL=sqlite:////tmp/keeper_optimizer_dev.db \
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
curl http://localhost:3000/api/leagues
```

Also confirm `apps/web/.env.local` contains:

```text
API_PROXY_TARGET=http://localhost:8000
NEXT_PUBLIC_API_BASE_URL=
```

In production, confirm the web service has `API_PROXY_TARGET` set to the API service URL and that
the browser is calling `/api/...` on the web domain. If the custom domain is active, the API CORS
allowlist must include `https://mayhemfantasyfootballtools.com`.

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

- ESPN league import is not implemented. Sleeper and Yahoo Fantasy Sports are the supported third-party league providers.
- Frontend CRUD is focused on users, teams, imports, optimizer runs, overrides, scenarios, draft impact, and exports.
- PDF reports are intentionally simple and dependency-free.
