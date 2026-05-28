# AI-Backed Upgrades Implementation Plan

## Current Progress

The app is on the `mockdraft` branch with three phases of AI-backed infrastructure fully implemented and merged into the branch.

### Implemented backend AI configuration

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `MOCK_DRAFT_AI_ENABLED`
- `MOCK_DRAFT_AI_MODEL` (default: `gpt-5.4-mini`)
- `MOCK_DRAFT_AI_TIMEOUT_SECONDS`
- `MOCK_DRAFT_AI_CANDIDATE_LIMIT`
- `ADP_PROVIDER`
- `ADP_AUTO_REFRESH_ENABLED`
- `ADP_AUTO_REFRESH_INTERVAL_HOURS`
- `ADP_AUTO_REFRESH_ON_STARTUP`
- `ADP_AI_BOARD_SIZE`
- `ADP_AI_EXTRA_CANDIDATES`
- `ADP_AI_REVIEW_REQUIRED`
- `ADP_AI_TIMEOUT_SECONDS`
- `ADP_AI_MAX_OUTPUT_TOKENS`
- `ADP_AI_MAX_JUMP_WARNING`
- `ADP_AI_MAX_JUMP_WARNING_COUNT`

### Implemented mock draft core

- Full snake draft board generation with keeper forfeit pre-placement.
- Session lifecycle: `setup → in_progress → paused → complete/abandoned`.
- Bot system: 9 personalities (QB Lover, RB Heavy, WR Heavy, Conservative, Aggressive, Balanced, Value Hunter, Need Based, Chaos) × 3 difficulties, configurable per team.
- All pick sources tracked: `user`, `bot`, `keeper_forfeit`, `auto_timeout`.
- Roster fit validation enforces slot limits, position caps, bench limits, and FLEX/SUPERFLEX eligibility.
- Available player list sorted by ADP; K/DST demoted until late rounds.
- Fallback ADP mechanism: if active snapshot has no entry for a player, prior snapshot entries are consulted.
- Unsubstantiated AI-sourced player names are excluded from available player lists.

### Implemented AI mock draft behavior

- Bot picks call OpenAI through `apps/api/app/services/mock_draft_ai.py`.
- Bot context includes league settings, current pick, roster counts, roster needs, recent picks, bot personality, and validated candidate pool (capped by `MOCK_DRAFT_AI_CANDIDATE_LIMIT`).
- Bot output constrained to structured JSON: `player_id`, `reasoning_summary`, `confidence`.
- AI-selected players accepted only if in the legal candidate set; otherwise falls back to deterministic bot scoring.
- Post-draft analysis calls OpenAI after deterministic scoring completes.
- Deterministic score, grade, and component metrics (value 45%, roster construction 35%, positional balance 20%) remain the source of truth.
- AI analysis can replace narrative fields only: summary, strengths, weaknesses, what-if scenarios, and future advice.
- Analysis records whether AI was used and which model was active.
- Previous completed mock summary is included in strategy plan context for continuity.

### Implemented AI-synthesized ADP

- `ADP_PROVIDER=ai_synthesized` supported by the existing ADP refresh path.
- `apps/api/app/services/ai_adp.py` builds an AI-synthesized board using OpenAI Responses API with `web_search_preview` tool.
- Top 250 PPR Superflex redraft board requested, with `ADP_AI_EXTRA_CANDIDATES` overhead to allow deduplication and trimming.
- Structured JSON output with per-row fields: `full_name`, `position`, `nfl_team`, `adp_pick`, `adp_round`, `sources`, `confidence`, `source_note`.
- Prior snapshot entries used as fallback fill if AI board is short.
- Normal import path creates `ADPSnapshot`, `ADPEntry`, and `Player` records.
- Weekly background refresh loop in `apps/api/app/services/adp_scheduler.py`; starts only when `ADP_AUTO_REFRESH_ENABLED=true`; cancelled cleanly on app shutdown.
- `ADP_AI_REVIEW_REQUIRED=true` routes weekly refresh to create a pending candidate instead of auto-importing.

### Implemented ADP guardrails

- Exact board size.
- Contiguous ranks.
- No duplicate player-position pairs.
- Only allowed positions: `QB`, `RB`, `WR`, `TE`, `K`, `DST`.
- At least one kicker and one defense/DST.
- Positive numeric ADP picks.
- Confidence must be `high`, `medium`, or `low`.
- Every row must include at least one source and a source note (≤12 words).
- Source notes containing `"insufficient current source substantiation"` are flagged and those players excluded from available player lists and analysis.
- Position-name placeholders (`Kickers`, `Defenses`, etc.) are rejected.
- Large movement warnings computed versus the prior snapshot; too many warnings reject the board.
- Provenance (provider, model, generation timestamp, guardrails, warnings, source summary) stored in snapshot notes.

### Implemented composite ADP pipeline

`apps/api/app/services/composite_adp.py` builds a multi-source weighted-median ADP board in one step, replaces the AI-synthesized and single-source refresh paths as the primary ADP mechanism.

**Sources:**
- **DraftSharks** — Playwright browser scrape (`scripts/draftsharks_scrape.mjs`) of `/rankings/ppr-superflex`. Scraper fixed: `process.exit()` replaced with `process.exitCode + process.stdout.end()` to prevent 64 KB pipe buffer truncation of large payloads.
- **Fantasy Football Calculator 2QB** — JSON API fetch, team count and year parameterized.
- **Fantasy Football Calculator PPR** — same API, different scoring format.

**Composite logic:**
- `_player_key(name, position)` — normalized `(name, position)` dedup key with suffix stripping (Jr/Sr/II/III).
- `_normalize_position()` — canonical position mapping: `PK→K`, `DEF→DST`.
- `_source_weights()` — format-specific weights. Superflex: `{draftsharks: 1.3, ffc_2qb: 0.85, ffc_ppr: 0.35, existing: 0.15}`. PPR: `{draftsharks: 0.45, ffc_2qb: 0.35, ffc_ppr: 1.0, existing: 0.15}`.
- `_weighted_median()` — source value that crosses the 50% cumulative weight threshold wins.
- DS weight intentionally set to 1.3 for superflex (>50% of 2.5 total) so DraftSharks drives QB ordering for superflex formats.
- For K and DST positions, DS is excluded from the composite entirely (DS kicker/DST rankings are unreliable in both directions — see guardrails).
- Existing ADP snapshot used as a light fallback (0.15×) only when fewer than 2 live sources are present.

**DraftSharks parsing fixes:**
- Removed `rank` parameter from `_draftsharks_overall_pick` in `_parse_draftsharks_browser_payload`. Browser payload `rank` is DS's value rank, not draft position — using it caused Drake Maye to land at pick 12 instead of pick 3.
- Filtered K/DST rows with `adp_pick < 100` from the browser payload (DraftSharks emits some kickers as implausibly early overall picks due to their internal data format).
- DS fully excluded from K/DST composite: DS kicker rankings are unreliable in both directions (some kickers too early, established kickers like Aubrey/Boswell/Butker too late).

**Data quality guardrails in `csv_imports.py`:**
- `_is_garbled_player_name()` — rejects names that are all-lowercase, have no spaces, and are longer than 6 chars (concatenated import artifacts).
- `_get_or_create_player()` — fixed to prevent duplicate player records when the same player appears with different `nfl_team` values; prefers exact team match, falls back to null-team record, updates team if missing.
- `_is_implausible_special_team_adp()` — blocks K/DST entries with ADP < 100 from being imported as active entries.

**Coverage and review flags:**
- `review_flag` column in composite output surfaces `single_source_top150`, `source_disagreement_Npicks`, `missing_all_sources`, and Sleeper status flags.
- `disagreement_flag` set when source spread ≥ 35 picks.
- `adp_movement` and `movement_flag` (`riser_N` / `faller_N`) compare against prior snapshot.

**Endpoints:**
- `GET  /api/leagues/{league_id}/exports/adp-template.csv` — download composite CSV (admin).
- `POST /api/leagues/{league_id}/adp/import-composite` — build composite and write directly to active snapshot (admin).
- `GET  /api/leagues/{league_id}/adp/coverage-summary` — JSON coverage breakdown by source.

**Frontend:**
- "Update ADP" — full-width primary button on the ADP page; calls `import-composite` directly; fetches live DS + FFC, builds weighted median, writes to DB in one click.
- "Manual CSV override" — collapsed `<details>` section with "Download Composite CSV" and a textarea/preview/import for edge-case admin use.
- Removed: "Generate AI Candidate", "Refresh ADP", `AIAdpCandidatePanel`, all AI candidate API calls and callbacks, `adpRefreshCandidates` from `WorkspaceData` (eliminates one network request on every page load).

### Implemented ADP admin review and approval (Phase 2)

- `ADPRefreshCandidate` model (`apps/api/app/models/adp.py`) with fields: `id`, `league_id`, `provider`, `model`, `status` (pending/approved/rejected/failed), `board_size`, `generated_at`, `source_summary`, `warnings`, `normalized_rows`, `error_message`, `approved_by_user_id`, `approved_at`.
- Migration `20260525_0005` creates `adp_refresh_candidates` table with all indexes.
- `apps/api/app/services/adp_review.py` creates candidates from AI board output.
- Backend endpoints in `leagues.py` retained for API-level use:
  - `POST /api/leagues/{league_id}/adp/ai-refresh-candidates` — generate candidate (admin only)
  - `GET  /api/leagues/{league_id}/adp/ai-refresh-candidates` — list candidates
  - `GET  /api/adp/ai-refresh-candidates/{candidate_id}` — read candidate with full rows
  - `POST /api/adp/ai-refresh-candidates/{candidate_id}/approve` — import rows, mark approved
  - `POST /api/adp/ai-refresh-candidates/{candidate_id}/reject` — mark rejected with reason
- **Frontend UI removed** — AI candidate generate/approve/reject panel removed from the ADP page. The composite direct-import path is now the primary workflow. Backend routes remain in place for potential future use.

### Implemented pre-draft strategy coach (Phase 3)

- `generate_strategy_plan()` in `apps/api/app/services/mock_draft.py`.
- Plan generated on session creation; regeneratable from setup or paused sessions.
- Cache key is SHA-256 of league settings, user team, draft slot, ADP snapshot, keeper context, round count, and bot config.
- Plan not regenerated if cache key matches existing plan (unless `force=True`).
- When AI is enabled: context includes league settings, user team, roster needs, top player tiers by position, keeper context, prior mock summary, and available player list.
- AI output filtered to remove placeholder player names and duplicate targets/fades.
- Deterministic fallback generates round plan, position priorities, targets from top ADP players, and two contingency rules.
- Strategy plan stored as JSON on `MockDraftSession` with `strategy_plan_cache_key`, `strategy_plan_generated_at`, and `strategy_plan_error` columns (migration `20260526_0006`).
- Endpoint: `POST /api/mock-drafts/{session_id}/strategy-plan` (owner only, forces regeneration).
- Frontend: `MockDraftStrategyPanel` component with round plan, position priorities, targets, fades, and contingencies. Visible in draft room before `Start Draft`. Regenerate button available. Current round recommendation surfaced during draft.

### Implemented mock draft frontend

- `MockDraftPage` — top-level tab view with setup, active draft, history, and comparison modes.
- `MockDraftStrategyPanel` — strategy plan display with targets, fades, round plan, contingencies.
- `MockDraftBoardPreview` — scrollable draft board showing all slots, pick status (Open / Keeper / Drafted), and team names.
- `MockDraftPlayerDialog` — available player picker with ADP, position, projection, and risk data.
- `MockDraftRecap` — post-draft analysis display with letter grade, numeric score, strengths, weaknesses, pick feedback table, what-if scenarios, projected finish/odds tier, and future advice.
- `MockDraftComparison` — side-by-side comparison of completed mock drafts.
- CSV exports: recap CSV (per-pick feedback) and comparison CSV (multi-session summary).
- Full session lifecycle controls: create, start, pause, resume, complete (force option), end (abandon), delete.
- Bot personality and difficulty selectors with per-team config.
- Pick timer selector (30 / 60 / 90 / 120 seconds).
- History view shows completed sessions with letter grade, score, and summary.

### Implemented keeper explanation UX (Phase 4 UI)

- Removed AI explanation column from `KeeperRecommendationsTable`; replaced with single-click modal.
- Clicking a player name in the recommendations table auto-generates the AI explanation (if not cached) and opens `KeeperExplanationModal` immediately — one click, no scroll required.
- Modal shows: team/scenario header, player name, position badge, decision badge, `short_reason`, `value_explanation`, `risk_note`, and `opportunity_cost`.
- Closes on backdrop click, X button, or Escape key.
- Instructions added next to the recommendations description text: "Click any player name to see their AI-powered keeper recommendation."
- `KEEPER_EXPLANATION_AI_ENABLED` and `SCENARIO_NARRATIVE_AI_ENABLED` feature flags added to `.env`.

### Implemented personalized scenario narratives (Phase 5 UI)

- `build_narrative_context` branches on whether the current user has an assigned team.
- When a user has an assigned team, `analysis_mode: "personalized"` — AI focuses on that team's actual players and picks forfeited, not generic league-wide analysis.
- When no team is assigned, falls back to `analysis_mode: "generic"` — league-wide tradeoff summary.
- Identical-keeper annotation: `_build_user_team_context` detects scenarios with exactly the same player sets and adds `identical_keepers_to` on each matching scenario.
- AI instructions explicitly handle identical keeper sets — treats them as strategically equivalent, uses picks forfeited as the differentiator, and avoids implying score differences between identical sets reflect real value differences.
- Per-player `keeper_score` removed from AI context to prevent misleading score-based comparisons across scenarios (scores differ because scenario presets use different weights, not because keepers are different).
- Cache hash updated to use player names + picks forfeited instead of scores, so identical keeper sets always hit the same cache entry.

### Implemented mock draft position limit UI

- `positionsAtLimit` — a `Set<string>` computed from `rosterCounts` vs `data.league.rosterSettings.maxPositionCounts`. A position enters the set when `rosterCounts[pos] >= maxPositionCounts[pos]`.
- Available players list: Draft button is `disabled` when `positionsAtLimit.has(player.position)`, with a tooltip: `"QB draft limit reached"` (or whichever position). Button is visually grayed out and unclickable.
- Drafted roster needs grid: when a slot matches a position at its cap and the slot still has `remaining > 0`, the tile turns rose (`border-rose-200 bg-rose-50`) with rose-colored count text, visually distinguishing "cap hit, slot unfillable" from "needs more players" (amber) and "slot filled" (emerald).

### Validation run

- `ruff check` passes.
- `pytest apps/api/tests/test_optimizer_api.py` passes with **77 tests** covering:
  - Mock draft session creation, keeper prefill, bot picks, user picks, roster limits, analysis grading, and keeper cost evaluation.
  - AI bot pick integration (monkeypatched boundary).
  - AI analysis narrative integration (monkeypatched boundary).
  - Strategy plan creation, cache key behavior, AI strategy plan integration, and regeneration endpoint.
  - AI ADP board import, candidate approve/reject flow.
  - ADP guardrails: duplicate players, position placeholders, unsubstantiated source notes, early special teams, deduplication.
  - ADP refresh providers (FFC, Fantasy Nerds, CSV URL, AI synthesized).
  - Phase 4: keeper explanation generation, caching by input hash, `GET` null before generation, `POST 503` when AI disabled, hash determinism, hash change on input change.
  - Phase 5: scenario narrative generation, caching, appears in scenarios response, `POST 503` when AI disabled, hash determinism, hash change, personalized vs generic mode toggle.
  - Existing optimizer, scenario comparison, draft impact, and export tests.
  - FastAPI `dependency_overrides` used for test settings isolation (prevents `.env` AI flags from contaminating AI-disabled tests).
- Local API health check passes.

---

## Target AI Feature Set

The AI scope stays focused on preseason keeper optimization, draft prep, mock drafts, and ADP quality. In-season tools are intentionally out of scope.

| # | Feature | Status |
|---|---------|--------|
| 1 | Multi-source composite ADP (DraftSharks + FFC weighted median) | **Done** |
| 2 | AI-synthesized ADP refresh (backend only, UI removed) | Done (backend retained) |
| 3 | AI-backed mock draft bot picks | **Done** |
| 4 | AI-backed post-draft analysis | **Done** |
| 5 | AI pre-draft strategy coach | **Done** |
| 6 | AI keeper recommendation explanations | **Done** |
| 7 | AI scenario comparison narratives | **Done** |
| 8 | AI player detail summaries | Not started |
| 9 | AI-assisted CSV/data cleanup | Not started |
| 10 | Cost controls, caching, and observability | Partial (candidate limit, cache key exist; per-feature flags and token tracking not started) |
| 11 | Admin controls for AI settings and refresh approval | Done (composite import); Not started (settings UI) |

---

## Model Recommendation

Use `gpt-5.4-mini` as the default model. The app sends compact structured context with strict JSON schemas and bounded output tokens.

`MOCK_DRAFT_AI_MODEL` is currently reused for all AI calls (ADP, bot picks, analysis, strategy). If output quality diverges by feature, split into separate settings:

```text
MOCK_DRAFT_AI_MODEL=gpt-5.4-mini   # bot picks, analysis, strategy plan
ADP_AI_MODEL=gpt-5.4-mini          # ADP synthesis
EXPLANATION_AI_MODEL=gpt-5.4-mini  # keeper and scenario explanations (future)
```

---

## Phase 1: Stabilize Current AI Infrastructure

**Status: In progress — infrastructure complete, live validation needed.**

Tasks remaining:

- Run a live manual ADP refresh using `ADP_PROVIDER=ai_synthesized`.
- Run a live mock draft with `MOCK_DRAFT_AI_ENABLED=true`.
- Confirm OpenAI Responses API payloads work with `gpt-5.4-mini`.
- Confirm `web_search_preview` tool calls are accepted for ADP refresh.
- Add logging for AI success/failure without logging secrets or full prompts.
- Add duration metrics for ADP refresh, bot picks, and analysis.
- Add token usage capture from Responses API payloads.
- Confirm weekly scheduler does not block app startup.
- Confirm failed weekly refresh rolls back and does not poison the DB session.
- Confirm Railway API picks up environment variables after redeploy.

Acceptance criteria:

- Manual AI ADP refresh creates a valid pending candidate with 250 rows.
- Admin can approve the candidate and confirm it becomes the active snapshot.
- Manual mock draft can complete with AI bot picks enabled.
- Failed model calls fall back or fail gracefully.
- No API key or prompt payload is exposed in logs or responses.

---

## Phase 2: ADP Admin Review and Approval

**Status: Backend done; UI superseded by composite direct-import.**

- `ADPRefreshCandidate` table and migration exist.
- All five backend endpoints implemented and tested.
- Scheduler routes to candidate creation when `ADP_AI_REVIEW_REQUIRED=true`.
- Frontend UI removed — composite direct-import (`POST /adp/import-composite`) is now the primary ADP workflow. The AI candidate generate/approve/reject panel has been removed from the ADP page.
- Backend routes and DB table retained in case the AI-synthesized path is needed in the future.

---

## Phase 3: AI Pre-Draft Strategy Coach

**Status: Done.**

- Strategy plan generated on session creation, cached by SHA-256 of inputs, stored on `MockDraftSession`.
- AI enhances with personalized targets, fades, round priorities, and contingencies.
- Deterministic fallback always available.
- Displayed in draft room before draft starts; regeneratable via API and UI button.

---

## Phase 4: Keeper Recommendation Explanations

**Status: Done.**

Goal: explain optimizer recommendations in plain English.

Inputs:

- Player, team, keeper cost, ADP, keeper value.
- Optimizer score components.
- Scenario name and league rules.

Output:

```json
{
  "short_reason": "...",
  "value_explanation": "...",
  "risk_note": "...",
  "opportunity_cost": "...",
  "decision": "strong keep | lean keep | toss-up | avoid"
}
```

Backend:

- Add a generalized `AIExplanation` table for caching AI-generated text by entity:

```text
AIExplanation
- id
- league_id
- user_id
- entity_type: keeper_recommendation, scenario_comparison, player, mock_draft_pick
- entity_id
- input_hash
- model
- content JSON
- token_usage JSON
- created_at
- updated_at
```

- Generate explanation lazily on demand; cache by `input_hash`.
- Re-running optimizer invalidates explanations for changed recommendations.

Frontend:

- Explanation text inline in recommendation rows or a popover.
- Regenerate action for admins/owners if needed.

Acceptance criteria:

- Keeper recommendation explanations are cached; re-running optimizer does not regenerate unchanged ones.
- Explanation clearly ties ADP, cost, and roster context together.

---

## Phase 5: Scenario Comparison Narratives

**Status: Done.** (2026-05-27)

Goal: summarize tradeoffs between optimizer scenarios in plain English.

Inputs: scenario comparison outputs, keeper sets, positional balance, forfeited picks, ADP snapshot.

Output:

```json
{
  "summary": "...",
  "best_fit": "Balanced",
  "tradeoffs": [
    {"scenario": "Superflex Heavy", "benefit": "...", "cost": "..."}
  ],
  "decision_notes": ["..."]
}
```

Frontend: narrative above or beside the scenario comparison table. Keep table as source of truth; narrative interprets, not replaces, numeric comparison.

Acceptance criteria:

- Narrative generated once per comparison input hash.
- Identifies meaningful differences between strategies.
- Does not contradict table values.

---

## Phase 6: AI Player Detail Summaries

**Status: In progress.**

Goal: snap-decision summary when a user clicks a player in mock draft or ADP views.

Inputs: player, position, NFL team, ADP, projection fields, risk/injury, current roster context, league settings.

Output:

```json
{
  "quick_take": "...",
  "fantasy_points_context": "...",
  "value_note": "...",
  "risk_note": "...",
  "roster_fit": "...",
  "draft_recommendation": "draft now | target next round | watchlist | avoid"
}
```

Caching:

- Base player summary cached by player ID, ADP snapshot, scoring format, and draft type.
- Roster-fit layer cached by draft session and current pick if needed (not yet implemented).

Frontend: clicking a player in the mock draft available-players list opens `MockDraftPlayerDialog`; existing ADP/risk data shows immediately, AI summary auto-generates and fills in below.

New config:

```text
PLAYER_SUMMARY_AI_ENABLED=true
```

Acceptance criteria:

- Popup opens instantly with known data.
- AI summary fills in when available (auto-triggered on open, no manual button needed).
- Repeated clicks use cached summary.

**Future work — projection data source:**

- `consensus_projection`, `floor_projection`, `ceiling_projection` in `adp_entries` are populated only when the active snapshot was imported from a DraftSharks CSV that includes projection columns. The composite ADP refresh (FFC-only path) leaves these `null`.
- Action: research a free or low-cost projection source (FantasyPros projections CSV, ESPN projections API, or a Sleeper seasonal projection endpoint) that can be wired into the composite ADP pipeline so projections are reliably populated.
- Until then, the AI summary prompt degrades gracefully — it uses ADP rank and position tier context when projections are null.

---

## Phase 7: AI-Assisted CSV and Data Cleanup

**Status: Not started.**

Goal: reduce import friction without allowing AI to silently mutate data.

Use cases: player name normalization, team abbreviation normalization, DST name normalization, duplicate detection, position correction suggestions, header mapping for nonstandard CSVs.

Workflow:

1. User previews CSV.
2. Existing deterministic parser reports warnings/errors.
3. User clicks `Suggest Fixes`.
4. AI returns proposed corrections with reasons.
5. Admin reviews and applies fixes.

Guardrails: AI cannot import directly; all changes require preview; original CSV retained; every change has a stated reason.

---

## Phase 8: Cost Controls

**Status: Partial — candidate limit and strategy plan caching exist. Per-feature flags and token tracking not started.**

Current expected cost with `gpt-5.4-mini`:

- ~$0.20–$0.47 per completed mock draft.
- Planning estimate: $0.35 per mock draft.
- For 5–10 users running several mocks per month: ~$10–$30/month; safe budget $40–$60/month.

Remaining work:

- Add per-feature enable flags:
  - `AI_BOT_PICKS_ENABLED`
  - `AI_DRAFT_ANALYSIS_ENABLED`
  - `AI_ADP_REFRESH_ENABLED`
  - `AI_KEEPER_EXPLANATIONS_ENABLED`
  - `AI_PLAYER_SUMMARIES_ENABLED`
- Use AI only for early and mid-round bot picks (`MOCK_DRAFT_AI_MAX_AI_ROUND`); fall back to deterministic for late rounds.
- Add token capture from Responses API and store in logs or audit table.
- Add monthly spend guardrail that refuses optional calls when budget is exhausted.
- Cache keeper explanations, scenario narratives, and player summaries (reuse `AIExplanation` table from Phase 4).

Potential config additions:

```text
AI_MONTHLY_TOKEN_BUDGET_INPUT=50000000
AI_MONTHLY_TOKEN_BUDGET_OUTPUT=5000000
MOCK_DRAFT_AI_MAX_AI_ROUND=10
AI_CACHE_TTL_DAYS=30
```

---

## Phase 9: Observability and Audit

**Status: Not started.**

Recommended `AIRequestLog` table:

```text
AIRequestLog
- id
- feature
- league_id
- user_id
- model
- status: success, fallback, failed
- input_tokens
- output_tokens
- total_tokens
- latency_ms
- error_message
- created_at
```

Do not store: API keys, full prompts containing sensitive data, full session cookies.

May store: input hash, output hash, feature metadata, candidate count, board size.

Acceptance criteria:

- Admin can diagnose AI failures from log data.
- Monthly token usage can be estimated from app data.
- Logs do not leak secrets.

---

## Phase 10: Deployment

**Status: Variables configured in Railway. Pre-production checklist not confirmed complete.**

Railway API variables:

```text
OPENAI_API_KEY=<secret>
ADP_PROVIDER=ai_synthesized
ADP_AUTO_REFRESH_ENABLED=true
ADP_AUTO_REFRESH_INTERVAL_HOURS=168
ADP_AUTO_REFRESH_ON_STARTUP=true
ADP_AI_REVIEW_REQUIRED=true
ADP_AI_BOARD_SIZE=250
MOCK_DRAFT_AI_ENABLED=true
MOCK_DRAFT_AI_MODEL=gpt-5.4-mini
```

Pre-production checklist:

- [ ] Redeploy API after variable changes.
- [ ] Run `alembic upgrade head` — migrations 0004–0007 must be applied (0007 adds `ai_explanations` for keeper explanation and scenario narrative caching).
- [ ] Set `KEEPER_EXPLANATION_AI_ENABLED=true` and `SCENARIO_NARRATIVE_AI_ENABLED=true` on the Railway API service.
- [ ] Click "Update ADP" in the admin ADP page; confirm composite snapshot imports cleanly (DraftSharks + FFC sources visible in source notes).
- [ ] Spot-check QB ADPs — top QBs (Allen, Mahomes, Lamar, Drake Maye) should be first-round picks.
- [ ] Spot-check K/DST ADPs — kickers should be rounds 11–16, not earlier.
- [ ] Run one complete mock draft with AI bot picks enabled.
- [ ] Verify position draft limits: draft up to the cap for one position — confirm Draft button grays out and roster tile turns red.
- [ ] Click a player name in Keeper Recommendations — confirm AI explanation modal opens on first click.
- [ ] Run all presets in Scenario Comparison and click "Generate AI Analysis" — confirm personalized narrative for a user with an assigned team.
- [ ] Check logs for AI failures or truncated responses.
- [ ] Confirm weekly refresh loop starts without blocking API startup.
- [ ] Ensure Playwright and Node.js are available in the Railway environment for the DraftSharks browser scrape.

---

## Immediate Next Steps

Phases 1–5 and mock draft core are complete on the `mockdraft` branch. The branch is ready for live validation and then merge.

1. Apply pending migrations in the target environment (migration 0007 adds `ai_explanations`):

```bash
cd apps/api
alembic upgrade head
```

2. Run baseline checks:

```bash
apps/api/.venv/bin/ruff check apps/api/app apps/api/tests
apps/api/.venv/bin/pytest apps/api/tests/test_optimizer_api.py
npm run typecheck --workspace apps/web
npm run lint --workspace apps/web
```

3. Validate composite ADP in production:
   - Click "Update ADP" in the admin ADP page.
   - Confirm DraftSharks + FFC sources appear in the snapshot source notes.
   - Spot-check top QBs (should be picks 1–5), kickers (should be rounds 11–16).
   - If DraftSharks scrape fails on Railway (Playwright/Chrome not available), the composite falls back to FFC-only — verify the fallback works and consider whether to install Playwright in the Railway build.

4. Verify AI settings are active without printing secrets:

```bash
apps/api/.venv/bin/python - <<'PY'
from app.core.config import Settings
s = Settings()
print("OPENAI_API_KEY=<set>" if s.openai_api_key else "OPENAI_API_KEY=<missing>")
print("MOCK_DRAFT_AI_ENABLED=", s.mock_draft_ai_enabled)
print("MOCK_DRAFT_AI_MODEL=", s.mock_draft_ai_model)
print("KEEPER_EXPLANATION_AI_ENABLED=", s.keeper_explanation_ai_enabled)
print("SCENARIO_NARRATIVE_AI_ENABLED=", s.scenario_narrative_ai_enabled)
PY
```

5. Run a complete mock draft with `MOCK_DRAFT_AI_ENABLED=true`.
6. Test keeper explanation modal: click a player name in Keeper Recommendations, confirm AI explanation loads in the popup on the first click.
7. Test scenario narrative: run all presets, click "Generate AI Analysis" in Scenario Comparison, confirm personalized narrative when a user has an assigned team.
8. Once live validation passes, open the PR to merge `mockdraft` into `main`.
9. After merge, the next unstarted feature is Phase 6 (AI Player Detail Summaries — snap-decision player popup in mock draft and ADP views).

---

## Known Risks

- AI ADP can be plausible but wrong; admin review (`ADP_AI_REVIEW_REQUIRED=true`) is strongly recommended and is the default.
- `web_search_preview` tool availability and naming can change in the OpenAI API; validate against live API before relying on weekly refresh.
- `ADPSnapshot.notes` has a 500-character limit, so ADP provenance is compressed via `_compact_json`.
- `MOCK_DRAFT_AI_MODEL` is currently reused for ADP generation, bot picks, analysis, and strategy plans; split if model requirements diverge by feature.
- Candidate board size of 250 requires sufficient `ADP_AI_MAX_OUTPUT_TOKENS`; adjust if live response truncates.
- API key lives only in ignored local env files and Railway variables — never commit env files or echo the key in logs.
- Bot pick AI is called once per pick for every non-user team; with `MOCK_DRAFT_AI_CANDIDATE_LIMIT=40` and many rounds, token cost adds up — consider `MOCK_DRAFT_AI_MAX_AI_ROUND` cutoff (Phase 8).
