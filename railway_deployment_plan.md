# Railway Deployment Plan

This app is a good fit for Railway because the repository already has two deployable services and a normal Postgres-backed API:

```text
Railway Project
├─ apps/web   -> Next.js service
├─ apps/api   -> FastAPI service
└─ Postgres   -> Railway Postgres database service
```

Railway is a better first production target than Cloudflare Pages/Workers for this app because the backend is not edge-native. It uses FastAPI, SQLModel, Postgres, Python 3.12, server-side exports, Excel generation, and PDF report generation. Moving that backend to Workers/D1 would require a significant rewrite without enough benefit for the current project.

## Current Repo Shape

- `apps/web`: Next.js 15, React 19, TypeScript, Tailwind, shadcn-style UI components.
- `apps/api`: FastAPI, SQLModel, Pydantic settings, psycopg, openpyxl.
- Database: local Docker Postgres for development; Railway Postgres for hosted production.
- Runtime API entry point: `app.main:app`.
- Database migrations: Alembic from `apps/api/alembic`.
- Web API base URL: `NEXT_PUBLIC_API_BASE_URL`.
- API settings are environment-driven through `apps/api/app/core/config.py`.

## Production Readiness Status

Current production blocker status:

1. Addressed: the app stores password hashes only and no longer returns plaintext passwords from API responses.
2. Addressed: production session cookies use the secure flag by default, with `SESSION_COOKIE_SECURE` available for explicit override.
3. Addressed: Railway's plain `postgresql://...` URLs are normalized to `postgresql+psycopg://...` before SQLAlchemy engine creation.
4. Addressed: Alembic migrations are available for production schema changes.

The deployment path below assumes a new Railway Postgres database. If an existing database was previously created with `CREATE_TABLES_ON_STARTUP=true`, stamp the baseline first, then upgrade:

```bash
alembic stamp 20260521_0001
alembic upgrade head
```

## Target Railway Services

### 1. Postgres

Create this first.

1. Open Railway.
2. Create a new project.
3. Click `+ New`.
4. Select `Database`.
5. Select `PostgreSQL`.
6. Name the service `Postgres`.

Railway will provide these variables automatically:

```text
PGHOST
PGPORT
PGUSER
PGPASSWORD
PGDATABASE
DATABASE_URL
```

Use reference variables from the API service rather than copying static credentials.

### 2. API Service

Create this from the GitHub repository.

1. Click `+ New`.
2. Select `GitHub Repo`.
3. Select `fantasy-football-keeper-optimizer`.
4. Set root directory:

```text
apps/api
```

5. Set build command if Railway does not detect it correctly:

```bash
pip install -e .
```

6. Set start command:

```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

This runs pending migrations before each API boot. If Railway is later configured with a separate pre-deploy/release command, move `alembic upgrade head` there and leave the start command as only `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

7. Generate a public domain for the API service under `Settings` -> `Networking`.

### 3. Web Service

Create this from the same GitHub repository.

1. Click `+ New`.
2. Select `GitHub Repo`.
3. Select `fantasy-football-keeper-optimizer`.
4. Set root directory:

```text
apps/web
```

5. Set build command:

```bash
npm run build
```

6. Set start command:

```bash
npm run start
```

7. Generate a public domain for the web service under `Settings` -> `Networking`.

## API Environment Variables

Set these on the API Railway service:

```text
APP_NAME=Fantasy Football Keeper Optimizer API
ENVIRONMENT=production
CREATE_TABLES_ON_STARTUP=false
SEED_DATA_ON_STARTUP=false
SESSION_SECRET=<generate-a-long-random-secret>
SESSION_COOKIE_SECURE=true
INITIAL_ADMIN_EMAIL=<your-admin-email>
INITIAL_ADMIN_PASSWORD=<temporary-strong-password>
```

Set `DATABASE_URL` using Railway reference variables:

```text
DATABASE_URL=postgresql+psycopg://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
```

The API also normalizes Railway's plain `postgresql://...` URL to `postgresql+psycopg://...` before creating the SQLAlchemy engine.

Keep `CREATE_TABLES_ON_STARTUP=false` in production. Alembic should own schema creation and future schema changes.

After the web service has a public domain, set CORS:

```text
CORS_ORIGINS=["https://<web-domain>"]
```

Then redeploy the API service.

## Web Environment Variables

Set this on the web Railway service before building:

```text
NEXT_PUBLIC_API_BASE_URL=https://<api-domain>
```

This value is baked into the Next.js build, so redeploy the web service after changing it.

## First Deployment Checklist

1. Deploy Postgres.
2. Deploy API.
3. Check API deploy logs and confirm Alembic reached `head`.
4. Confirm API health:

```bash
curl https://<api-domain>/health
```

Expected response:

```json
{"status":"ok","service":"Fantasy Football Keeper Optimizer API"}
```

5. Deploy web.
6. Open `https://<web-domain>`.
7. Log in with `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`.
8. Change the admin password immediately.
9. Import or create league data.
10. Verify these flows:
   - Login/logout.
   - League/team loading.
   - CSV preview/import.
   - Keeper optimizer run.
   - Manual overrides.
   - Excel export.
   - CSV export.
   - PDF export.
11. Check Railway deploy logs for both services.

## Post-Launch Cleanup

After the first successful deploy:

1. Remove `INITIAL_ADMIN_PASSWORD` after the first admin has been created, or rotate it if it was exposed.
2. Keep `SESSION_SECRET` stable. Changing it invalidates all sessions.
3. Keep schema changes in Alembic migrations and deploy with `alembic upgrade head`.

## Cost Notes

Railway Hobby is currently a paid monthly plan with included usage credit. Expect the project to cost at least the Hobby base subscription while deployed, with additional charges only if usage exceeds the included usage amount.

## Reference Docs

- Railway pricing plans: https://docs.railway.com/pricing/plans
- Railway monorepo deploys: https://docs.railway.com/deployments/monorepo
- Railway Postgres: https://docs.railway.com/databases/postgresql
- Railway public networking: https://docs.railway.com/networking/public-networking
- Railway private networking: https://docs.railway.com/private-networking
