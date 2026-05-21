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
- Web API base URL: `NEXT_PUBLIC_API_BASE_URL`.
- API settings are environment-driven through `apps/api/app/core/config.py`.

## Production Blockers To Address

Do these before treating the app as broadly production-ready:

1. Passwords are currently persisted and returned in plaintext in admin user payloads. Store only password hashes and never return plaintext passwords from API responses.
2. Session cookies are currently set with `secure=False`. Production should use secure HTTPS cookies.
3. There is no full migration system yet. `CREATE_TABLES_ON_STARTUP=true` is acceptable for the first MVP deploy, but Alembic should be added before repeated schema changes.
4. Railway's Postgres URL may be exposed as `postgresql://...`. This project installs `psycopg`, so the safest SQLAlchemy URL is `postgresql+psycopg://...`.

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
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

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
CREATE_TABLES_ON_STARTUP=true
SEED_DATA_ON_STARTUP=false
SESSION_SECRET=<generate-a-long-random-secret>
INITIAL_ADMIN_EMAIL=<your-admin-email>
INITIAL_ADMIN_PASSWORD=<temporary-strong-password>
```

Set `DATABASE_URL` using Railway reference variables:

```text
DATABASE_URL=postgresql+psycopg://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
```

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
3. Confirm API health:

```bash
curl https://<api-domain>/health
```

Expected response:

```json
{"status":"ok","service":"Fantasy Football Keeper Optimizer API"}
```

4. Deploy web.
5. Open `https://<web-domain>`.
6. Log in with `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`.
7. Change the admin password immediately.
8. Import or create league data.
9. Verify these flows:
   - Login/logout.
   - League/team loading.
   - CSV preview/import.
   - Keeper optimizer run.
   - Manual overrides.
   - Excel export.
   - CSV export.
   - PDF export.
10. Check Railway deploy logs for both services.

## Post-Launch Cleanup

After the first successful deploy:

1. Set `CREATE_TABLES_ON_STARTUP=false` once the database schema exists.
2. Remove or rotate `INITIAL_ADMIN_PASSWORD`.
3. Keep `SESSION_SECRET` stable. Changing it invalidates all sessions.
4. Add Alembic migrations before future schema changes.
5. Add a production cookie setting, for example `SESSION_COOKIE_SECURE=true`, and wire it into the API.
6. Remove plaintext password storage and plaintext password API responses.

## Cost Notes

Railway Hobby is currently a paid monthly plan with included usage credit. Expect the project to cost at least the Hobby base subscription while deployed, with additional charges only if usage exceeds the included usage amount.

## Reference Docs

- Railway pricing plans: https://docs.railway.com/pricing/plans
- Railway monorepo deploys: https://docs.railway.com/deployments/monorepo
- Railway Postgres: https://docs.railway.com/databases/postgresql
- Railway public networking: https://docs.railway.com/networking/public-networking
- Railway private networking: https://docs.railway.com/private-networking
