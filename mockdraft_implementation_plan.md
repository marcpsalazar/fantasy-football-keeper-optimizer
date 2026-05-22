# Mock Draft Implementation Plan

## Goal

Add a mock draft feature that lets users run league-specific mock drafts after they finalize keeper recommendations, manual overrides, and scenario selections. The mock draft should use the actual league draft order, keeper-forfeited picks, current ADP, roster rules, and user team assignment. All completed drafts and post-draft analysis should be saved and viewable from mock draft history.

## Product Flow

1. User finishes keeper recommendations, manual overrides, and scenario selections.
2. User opens a new `Mock Draft` view from the dashboard, near `Draft Impact`.
3. User creates a mock draft session from the current league state:
   - current league
   - current user and assigned team
   - current selected keeper plan
   - draft order from team `draft_slot`
   - active ADP snapshot
   - league roster settings
4. Draft board starts with keeper-forfeited picks already marked.
5. User controls only their assigned team.
6. Bot teams draft automatically.
7. User controls draft execution and can start, pause, resume, or end the draft.
8. Completed drafts are saved and listed under mock draft history.
9. If the user ends a draft before completion, that draft is discarded and is not saved in mock draft history.
10. Each completed draft generates and saves post-draft scoring, feedback, what-if scenarios, projected rankings, and advice for future drafts.

## Core Requirements

- The draft order has already been set.
- The mock draft board should visually follow the existing `Draft Impact` board.
- User assumes the position of the team assigned to their account.
- All other teams are run by AI-style bot logic.
- Each bot team can be assigned a draft personality.
- Bot difficulty should control the depth of pick analysis.
- Users can set their pick timer to no limit, 30 seconds, 60 seconds, 90 seconds, or 120 seconds.
- Timer only applies to the user. Bots pick as soon as their decision is available.
- Users can start, pause, resume, or end a mock draft.
- Paused drafts should preserve the current in-progress state until the user resumes or ends them.
- Drafts ended by the user before completion are not retained in mock draft history.
- Available players come from the most recent ADP snapshot plus all known possible players from the latest available player data.
- Mock draft positional limits and roster slots follow league rules and are admin configurable.
- Mock draft results and analysis are saved and available from history.

## Backend Models

Add a new model module, likely `apps/api/app/models/mock_draft.py`.

### `MockDraftSession`

- `id`
- `league_id`
- `user_id`
- `user_team_id`
- `adp_snapshot_id`
- `status`: `setup`, `in_progress`, `paused`, `complete`, `abandoned`
- `pick_timer_seconds`: `30`, `60`, `90`, `120`, or `null`
- `bot_config` JSON
- `keeper_context` JSON snapshot
- `draft_type`
- `round_count`
- `created_at`
- `updated_at`
- `completed_at`

### `MockDraftPick`

- `id`
- `session_id`
- `round`
- `pick_in_round`
- `overall_pick`
- `team_id`
- `player_id`
- `source`: `user`, `bot`, `keeper_forfeit`, `auto_timeout`
- `decision_time_ms`
- `bot_personality`
- `bot_difficulty`
- `reasoning_summary`
- `created_at`
- `updated_at`

### `MockDraftAnalysis`

- `id`
- `session_id`
- `overall_letter_grade`: `A+` through `F`
- `overall_numeric_score`: `0-100`
- `summary`
- `strengths` JSON
- `weaknesses` JSON
- `pick_feedback` JSON
- `what_if_scenarios` JSON
- `projected_rankings` JSON
- `future_advice` JSON
- `created_at`
- `updated_at`

### Optional Supporting Model: `MockDraftRosterSlot`

Use only if roster validation becomes too complex to keep inside service-level calculations.

- `session_id`
- `team_id`
- `slot_type`
- `player_id`
- `source_pick_id`

## API Endpoints

Add endpoints under `apps/api/app/api/routes/leagues.py` or a new dedicated route module.

```text
POST   /api/leagues/{league_id}/mock-drafts
GET    /api/leagues/{league_id}/mock-drafts
GET    /api/mock-drafts/{session_id}
PATCH  /api/mock-drafts/{session_id}
POST   /api/mock-drafts/{session_id}/start
POST   /api/mock-drafts/{session_id}/pick
POST   /api/mock-drafts/{session_id}/bot-pick
POST   /api/mock-drafts/{session_id}/pause
POST   /api/mock-drafts/{session_id}/resume
POST   /api/mock-drafts/{session_id}/complete
POST   /api/mock-drafts/{session_id}/end
POST   /api/mock-drafts/{session_id}/analysis/rerun
DELETE /api/mock-drafts/{session_id}
```

First version can generate bot picks synchronously as the frontend advances the draft. A later version can move bot turns to background tasks or websocket-driven updates.

## Draft Engine

Create `apps/api/app/services/mock_draft.py`.

Responsibilities:

- Generate the draft board using the same snake or linear logic used by draft impact.
- Pre-fill keeper-forfeited picks from the selected keeper scenario.
- Build the available player pool from:
  - active ADP snapshot
  - known `players`
  - any imported player data from final rosters or draft results
- Remove kept players and already drafted players from the available pool.
- Enforce roster settings from `league.roster_settings`.
- Enforce position limits and total roster slots.
- Validate user picks.
- Generate bot picks.
- Persist all picks.
- Persist completed rosters.
- Trigger post-draft analysis when a draft completes.
- Pause an in-progress draft without advancing bot turns.
- Resume a paused draft from the same current pick.
- End an incomplete draft on user request and exclude it from history.

Existing draft impact logic should be reused where practical:

- API draft impact builder in `apps/api/app/api/routes/leagues.py`
- Frontend `buildDraftImpact` in `apps/web/src/lib/api.ts`
- Existing `Team.draft_slot`
- Existing `League.draft_type`
- Existing keeper recommendation and scenario selection data

## Bot Personalities

Start with deterministic scoring profiles before adding heavier AI logic.

Recommended personalities:

- `Balanced`: blends ADP, roster need, scarcity, and value.
- `Aggressive`: favors upside, positional runs, and ceiling.
- `Conservative`: follows ADP closely and fills starters early.
- `QB Lover`: boosts QB value heavily, especially in superflex.
- `RB Heavy`: pushes RBs earlier.
- `WR Heavy`: pushes WR depth and value.
- `Value Hunter`: prioritizes players falling below ADP.
- `Need Based`: fills starting roster gaps before bench upside.
- `Chaos`: lower-difficulty profile with more randomness.

Recommended difficulty levels:

- `Easy`: mostly ADP with randomness.
- `Medium`: ADP plus roster need and positional scarcity.
- `Hard`: ADP, roster need, scarcity, keeper context, remaining tiers, opponent tendencies, and future pick distance.

## Bot Pick Scoring

Each bot pick should compute a weighted score for available players.

Inputs:

- ADP rank
- current pick number
- value versus ADP
- roster needs
- starter slot scarcity
- positional scarcity
- keeper-adjusted roster state
- team personality
- difficulty level
- future pick distance
- position runs
- player risk, if available from ADP metadata

Example scoring dimensions:

- `adp_score`
- `value_score`
- `need_score`
- `scarcity_score`
- `upside_score`
- `risk_penalty`
- `personality_modifier`
- `difficulty_noise`

## Timer Behavior

User timer options:

- no limit
- 30 seconds
- 60 seconds
- 90 seconds
- 120 seconds

Rules:

- Timer applies only to the user pick.
- Bot picks happen immediately after bot decision generation.
- Timer is suspended while the draft is paused.
- Timer restarts or resumes when the user resumes the draft, depending on the selected product behavior.
- If user time expires, app can either:
  - auto-pick best available based on user team needs, or
  - pause and mark the pick as expired.

Recommendation: auto-pick only if the user explicitly enables auto-pick on timeout. Default should pause or require a pick to avoid frustrating accidental picks.

## Draft Run Controls

Users should control execution of the mock draft.

Controls:

- `Start Draft`: transitions a setup draft to `in_progress`.
- `Pause Draft`: transitions an in-progress draft to `paused`.
- `Resume Draft`: transitions a paused draft back to `in_progress`.
- `End Draft`: stops the current draft immediately.

Rules:

- Only the user who created the mock draft session can control it.
- Pausing should preserve all picks already made, the current pick, timer state, and bot settings.
- Bots should not make picks while the draft is paused.
- Resuming should continue from the same current pick.
- Ending a draft before all required picks are made should mark it `abandoned` or delete it.
- Abandoned drafts should not appear in mock draft history.
- Only `complete` drafts should appear in history and generate saved post-draft analysis.
- If the user ends a completed draft from the recap or history view, treat that as delete/archive behavior only if explicitly implemented later.

## Admin Settings

Use existing `League.roster_settings` JSON before adding many fixed columns.

Admin-configurable settings:

- roster slots by position:
  - QB
  - RB
  - WR
  - TE
  - FLEX
  - SUPERFLEX
  - K
  - DST
  - bench
- max rostered players per position, if desired
- draft rounds
- whether keeper-forfeited players count as occupied roster slots
- allowed player positions
- default bot difficulty
- default bot personality
- timeout behavior

## Frontend Additions

Update `apps/web/src/components/dashboard/dashboard-app.tsx` and `apps/web/src/lib/api.ts`.

### Navigation

Add `Mock Draft` after `Draft Impact`.

### Setup View

Controls:

- user team display
- timer selector
- global bot difficulty
- per-team bot personality
- per-team bot difficulty override
- selected keeper context summary
- start draft button

### Live Draft View

UI sections:

- draft board matching `DraftBoardPreview`
- current pick indicator
- user team highlight
- keeper-forfeited pick state
- drafted player state
- available player table
- position filters
- search
- team roster panel
- remaining roster needs
- pick timer
- bot pick reasoning summary
- pause draft button
- resume draft button when paused
- end draft button with confirmation

Available player table columns:

- rank
- player
- position
- NFL team
- ADP
- value versus current pick
- roster fit
- risk
- projection, if available

### History View

Show saved mock drafts:

- completed date
- user team
- draft settings
- bot settings
- overall grade
- projected finish
- top strengths
- top weaknesses
- open recap action

Only completed drafts should be shown. Incomplete drafts ended by the user should be excluded from this list.

### Recap View

Show:

- final draft board
- final roster
- grade card
- detailed feedback
- team strengths
- team weaknesses
- best picks
- riskiest picks
- missed opportunities
- projected rankings
- what-if scenario tabs
- future draft advice

## Post-Draft Analysis

When a mock draft completes, generate and save a `MockDraftAnalysis`.

The analysis should include:

- overall draft score from `A+` through `F`
- numeric score from `0-100`
- detailed feedback summary
- team strengths
- team weaknesses
- best picks
- riskiest picks
- missed opportunities
- roster construction grade
- value grade
- positional balance grade
- keeper-plan fit grade
- projected league ranking
- projected playoff outlook
- future draft advice
- what-if scenarios

### Scoring Categories

Recommended score components:

- `value_score`: did the team draft players at or below market cost?
- `roster_construction_score`: did the final roster satisfy starters, flex, superflex, and bench needs?
- `positional_balance_score`: did the team avoid overloading or neglecting positions?
- `scarcity_score`: did the team handle scarce positions before drop-offs?
- `keeper_fit_score`: did draft choices complement selected keepers?
- `risk_score`: did the team balance upside and floor?
- `depth_score`: does the bench protect fragile positions?
- `draft_slot_efficiency_score`: did the user get appropriate value from their actual draft position?

### What-If Scenarios

Save what-if scenarios with the completed draft history.

Recommended scenarios:

- What if the user picked best available by ADP every round?
- What if the user prioritized QB earlier?
- What if the user waited on QB?
- What if the user drafted RB-heavy?
- What if the user drafted WR-heavy?
- What if the user filled flex or superflex earlier?
- What if the user took the highest-upside player instead of the safest player?
- What if the user followed roster need strictly?
- What if the user ignored keepers and drafted from a neutral roster baseline?

Each scenario should include:

- changed picks
- projected roster impact
- score delta
- ranking delta
- strengths gained
- weaknesses created
- plain-English recommendation

### Projected Rankings

Save projected rankings after each completed mock draft:

- projected finish among league teams
- projected regular-season rank
- projected playoff odds tier
- positional rank by team:
  - QB
  - RB
  - WR
  - TE
  - FLEX
  - SUPERFLEX
  - bench depth
- comparison to average mock draft result
- comparison to current keeper-adjusted baseline

### Future Draft Advice

The final analysis should give practical advice for the real league draft:

- positions to attack early
- positions to avoid reaching on
- player archetypes to target
- roster risks to manage
- how keeper decisions affected draft flexibility
- likely pressure points based on draft slot
- round-by-round tactical advice
- contingency plans if positional runs happen

## Recommended Enhancements

Include these in the feature scope if time allows:

- keeper-adjusted roster needs before the mock starts
- grade each user pick against ADP, roster need, and league scarcity
- show players unlikely to make it back before each user pick
- show team-by-team draft tendencies after the draft
- save a best-available-at-my-next-pick projection
- allow rerunning the same draft setup with different bot personalities
- compare final mock result against keeper recommendation scenarios
- export mock draft recap as CSV or PDF
- allow users to favorite or annotate completed mock drafts
- show average result across multiple mock drafts

## Implementation Order

1. Add DB models, relationships, and Alembic migration.
2. Add Pydantic schemas for sessions, picks, setup payloads, and analysis.
3. Build `mock_draft` service with board generation, player pool generation, roster validation, and simple bot scoring.
4. Add API routes for session creation, loading, starting, picking, completing, and history.
5. Add pause, resume, and end behavior. Ensure ended incomplete drafts are excluded from history.
6. Add post-draft analysis generation and persistence.
7. Add frontend API functions and TypeScript types.
8. Add `Mock Draft` dashboard navigation and setup UI.
9. Add live draft board, available players, roster panel, timer, and draft run controls.
10. Add mock draft history and recap views.
11. Add tests for board generation, keeper-forfeited picks, pick validation, bot picks, roster limits, draft controls, saved history, and saved analysis.
12. Polish with pick grades, what-if scenarios, projected rankings, and recap exports.

## Testing Plan

Backend tests:

- creates mock draft session from league state
- requires user to have an assigned team
- generates board in correct draft order
- handles snake draft reversal
- marks keeper-forfeited picks
- excludes kept and drafted players from available pool
- validates roster limits
- rejects user picking for another team
- bot pick respects available players
- bot pick respects roster limits
- pause preserves current draft state
- resume continues from the same current pick
- ending an incomplete draft excludes it from history
- completed draft persists all picks
- completed draft generates analysis
- history returns saved drafts with analysis summary

Frontend tests or manual verification:

- setup renders with assigned team
- timer options work
- bot settings are editable
- board resembles draft impact board
- current pick advances correctly
- user pick updates board and roster
- bot picks appear quickly
- pause prevents timer and bot advancement
- resume continues the draft
- ending an incomplete draft removes it from history
- history shows completed drafts
- recap shows saved grade and analysis

## Rollout Notes

Recommended first release:

- synchronous bot picks
- deterministic bot scoring
- saved sessions and history
- saved post-draft analysis
- simple what-if scenarios
- no websocket dependency

Recommended later release:

- live websocket updates
- deeper AI explanations
- draft room animations
- exportable reports
- aggregate trends across many mock drafts
- configurable bot profiles saved by admin
