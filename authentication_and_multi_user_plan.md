# Authentication and Multi-User Modeling Implementation Plan

## Summary
Introduce application authentication with email/password and two roles: `admin` and `user`. Keep league source data shared across the app, but make modeling state user-specific so each person can run independent keeper research without affecting anyone else. Admins manage shared league/application data and the default optimizer baseline; users work from those defaults inside their own private modeling workspace.

## Implementation Changes

### 1. Authentication and user model
- Add a `User` entity with:
  - `id`
  - `email` (unique)
  - `password_hash`
  - `role` (`admin` or `user`)
  - `is_active`
  - timestamps
- Implement password hashing with a standard server-side password hasher.
- Use cookie-based session auth for the web app.
- Add auth endpoints:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Add admin-only user management for v1:
  - `POST /api/admin/users`
  - optional `GET /api/admin/users`

### 2. Shared data vs. user-private modeling
Keep these shared and admin-managed:
- leagues
- teams
- draft imports
- final roster imports
- ADP snapshots and refresh
- app/default optimizer baseline

Make these user-specific:
- optimizer settings
- manual overrides
- selected scenario per team
- persisted optimizer results
- persisted scenario-comparison results, if stored

Schema changes:
- Add `user_id` to `OptimizerSettings`
- Add `user_id` to `ManualOverride`
- Add `user_id` to `KeeperRecommendation`
- Add a new `TeamScenarioSelection` table:
  - `league_id`
  - `team_id`
  - `user_id`
  - `scenario_name`
  - timestamps
- Add a global admin-managed default settings source:
  - preferred: dedicated `AppDefaultOptimizerSettings` table with one active row
- Update uniqueness rules:
  - optimizer settings unique on `(league_id, user_id, name)`
  - manual overrides unique on `(league_id, user_id, team_id, player_id)`
  - scenario selections unique on `(league_id, user_id, team_id)`

### 3. Settings/default resolution rules
- Admin owns the application default optimizer settings.
- When a user has no saved settings for a league, reads resolve to the admin defaults.
- User saves create or update that user’s private settings record.
- Admin default changes affect only users who have not saved their own settings.
- Existing saved user settings are not overwritten by later admin default changes.

### 4. API authorization model
Add request dependencies:
- `require_current_user`
- `require_admin`

Admin-only actions:
- create/update shared league data
- import draft/final roster CSVs
- import/refresh ADP
- manage users
- update default optimizer settings

Authenticated user actions:
- read shared league data
- read/write own optimizer settings
- read/write own manual overrides
- read/write own team scenario selections
- run optimizer for own workspace
- run scenario comparison for own workspace
- read/export own optimizer outputs

Endpoint behavior changes:
- current optimizer settings endpoints become current-user scoped by default
- manual override endpoints become current-user scoped by default
- optimizer results endpoints return only the authenticated user’s result set
- add scenario selection persistence endpoints:
  - `GET /api/leagues/{league_id}/scenario-selections`
  - `PUT /api/leagues/{league_id}/scenario-selections/{team_id}`
- add admin default settings endpoints:
  - `GET /api/admin/defaults/optimizer-settings`
  - `PATCH /api/admin/defaults/optimizer-settings`

### 5. Optimizer and persistence behavior
- Optimizer reads the authenticated user’s settings and overrides.
- Scenario comparison uses the authenticated user’s settings baseline unless an admin-only default-preview mode is added later.
- Recommendation persistence must carry `user_id` so batches are isolated by user.
- Export endpoints (`csv`, `xlsx`, `pdf`) must use the authenticated user’s latest persisted results or explicit user-scoped scenario selection.

### 6. Frontend application changes
- Add login screen and auth bootstrap flow.
- Add a session-aware app shell with:
  - current user email
  - role badge
  - logout action
- Block dashboard access until authenticated.
- Persist scenario selections via API instead of local-only React state.
- Rename/label user-specific controls clearly:
  - `Your optimizer settings`
  - `Your manual overrides`
  - `Your selected scenarios`
- Keep shared league data screens readable by all authenticated users, but only show edit/import controls to admins.
- Add admin-only UI for:
  - creating users
  - editing application default optimizer settings

## Migration and compatibility
- Add database migrations for:
  - `users`
  - `team_scenario_selections`
  - default settings table
  - `user_id` columns on existing modeling tables
- Backfill strategy for existing rows:
  - existing optimizer settings become admin defaults or system-owned defaults
  - existing manual overrides and recommendations are treated as legacy shared data and should not be surfaced as user-owned records without explicit migration rules
- Seed flow should support creating an initial admin account from environment variables for local/dev bootstrap.

## Test Plan
- Auth tests:
  - valid login
  - invalid password
  - inactive user blocked
  - logout clears session
  - `me` returns authenticated user
- Authorization tests:
  - unauthenticated access returns 401
  - user blocked from admin-only endpoints
- Isolation tests:
  - two users save different settings for the same league without conflict
  - two users save different manual overrides for the same player/team without conflict
  - two users save different scenario selections for the same team without conflict
  - optimizer results returned to one user exclude the other user’s results
- Default tests:
  - new user sees admin defaults before saving
  - user save overrides defaults for that user only
  - admin default changes do not overwrite existing user settings
- Frontend tests:
  - login gate
  - role-based visibility
  - scenario selection persistence across refresh
  - user-specific settings persistence
  - admin-only controls hidden from regular users

## Assumptions
- Account creation is admin-managed only in v1.
- No password reset, email verification, or self-signup in this phase.
- Shared league data remains common to all authenticated users.
- Session-cookie auth is the implementation default.
- Admin defaults are global application defaults, not per-user and not per-league unless expanded later.
