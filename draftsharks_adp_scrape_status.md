# DraftSharks ADP Scrape Status

## Objective
Use DraftSharks as the source for the app's generated superflex PPR ADP CSV.

## Current Status
Work is partially complete.

### Confirmed findings
- A plain HTTP fetch of `https://www.draftsharks.com/rankings/ppr-superflex` only returns about 25 to 26 visible player rows in the raw HTML.
- The full rankings table is available in a normal interactive browser session.
- In Chrome, the DraftSharks page visibly shows many more rows as the user scrolls.
- Using Computer Use against the live Chrome tab, rows well beyond 25 were confirmed.
- The accessibility tree exposed rows through about 250, including player names, NFL teams, positions, and ADP values.
- Clean Playwright sessions did **not** reproduce the same result. Both headless and headful automation sessions only saw about 25 rows.
- This means the page is not scrapeable by simple `urllib` / `requests` fetches alone, and also not yet reproducible with naive browser automation.

### Existing code state before interruption
- The backend ADP template flow currently centers on `apps/api/app/services/composite_adp.py`.
- DraftSharks parsing logic was added there for static HTML extraction.
- A defensive check was added to treat a 25/26-row DraftSharks response as a gated or truncated response rather than valid full ADP data.
- Playwright was installed into the repo with `npm install -D playwright`.
- Playwright browser binaries were installed with `npx playwright install chromium`.
- A first attempt to introduce a browser-assisted DraftSharks scrape path was started but not safely completed or verified because local filesystem permissions for shell tools became unstable.

## Main Technical Conclusion
There are two distinct behaviors:
1. Static fetch / clean automation context: about 25 rows only.
2. Real user browser session: large rendered table with many rows.

That strongly suggests one or more of the following:
- DraftSharks lazy-loads additional rows during normal interactive browsing.
- DraftSharks treats clean automation sessions differently from a real user session.
- Existing cookies, timing, or browser-state heuristics may influence what the page renders.

## Blockers Encountered
### 1. Workspace filesystem access broke for shell tools
During implementation, shell access to the repository path became unreliable.
Symptoms included:
- `Operation not permitted` on repo files and directories
- `apply_patch` failure when reading files
- shell commands not being able to list or patch repo contents reliably

### 2. Clean Playwright automation did not reproduce the full table
Tests showed:
- fresh Playwright Chromium/headless: about 25 rows
- fresh Playwright Chrome/headful: about 25 rows
- existing interactive Chrome tab via Computer Use: many more rows

This means any durable scraper must be validated against the real browser behavior, not just a fresh automated browser context.

## Recommended Next Steps
### Immediate implementation path
1. Restore reliable shell/file access to the repo.
2. Create a dedicated local scraper script, for example:
   - `scripts/draftsharks_scrape.mjs`
3. Make that script:
   - launch Chrome or attach to a real Chrome context
   - open `https://www.draftsharks.com/rankings/ppr-superflex`
   - scroll in increments until row count stops increasing
   - extract rows from `tbody[data-player-row]`
   - capture:
     - `data-player-name`
     - `data-fantasy-position`
     - visible team text from `.team-position-logo-container span`
     - ADP value from `td.adp[data-value]`
4. Return JSON to stdout.
5. Update `apps/api/app/services/composite_adp.py` so `_fetch_draftsharks_superflex_rows()` can call the local scraper script first.
6. Keep the current static HTML path only as a fallback, and continue rejecting truncated 25-row responses.

### Validation steps
After implementation:
1. Run the scraper directly and confirm row count is much greater than 25.
2. Confirm output includes late-table players such as rows 150 to 250.
3. Rebuild the app-generated ADP CSV.
4. Verify that `nfl_team`, `adp_pick`, and `adp_round` are populated for the full DraftSharks output set rather than just the first 25 players.
5. Add backend tests for:
   - successful browser-scrape JSON ingestion
   - fallback behavior when browser scrape is unavailable
   - rejection of truncated static DraftSharks HTML responses

## Important Files
- `apps/api/app/services/composite_adp.py`
- `apps/api/tests/test_optimizer_api.py`
- `package.json`
- `package-lock.json`
- planned new file: `scripts/draftsharks_scrape.mjs`

## Notes for Resume
- Do not assume the static DraftSharks HTML contains the full rankings list.
- Do not rely on a plain `curl` result as proof that the source is unusable.
- The live browser tab demonstrated that the full table can be rendered.
- The key unresolved task is reproducing that same behavior programmatically in a stable local script.
