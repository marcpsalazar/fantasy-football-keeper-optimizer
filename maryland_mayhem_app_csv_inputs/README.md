# Maryland Mayhem CSV inputs

Copy these files into the repository `sample-data/` folder, replacing the sample files if desired.

Generated files:

- `leagues.csv`
- `teams.csv`
- `players.csv`
- `draft_results.csv`
- `final_rosters.csv`
- `adp.csv`

Notes:

- Season year is set to 2026 because these inputs are for the 2026 keeper decision using 2025 draft/final-roster history.
- ADP values are the custom superflex modeled values we developed in the keeper workbook, not an automatically scraped live ADP feed.
- K and DEF are included with late replacement-level ADP values so imports validate, but they should generally not become keeper candidates.
