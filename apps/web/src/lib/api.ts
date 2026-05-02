import {
  adpEntries as mockAdpEntries,
  draftResults as mockDraftResults,
  finalRosters as mockFinalRosters,
  keeperRecommendations as mockKeeperRecommendations,
  outlooks as mockOutlooks,
  scenarioComparisons as mockScenarioComparisons,
  teams as mockTeams,
  type ADPEntry,
  type DraftPick,
  type FinalRosterEntry,
  type KeeperRecommendation,
  type Outlook,
  type ScenarioComparison,
  type Team,
} from "@/lib/mock-data";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type ApiRow = Record<string, unknown>;

type ApiTable = {
  rows: ApiRow[];
  count?: number;
  selected_count?: number;
  [key: string]: unknown;
};

type ApiScenarioPayload = {
  scenarios?: ApiRow[];
};

export type ManualOverrideType = "auto" | "force_keep" | "exclude";
export type CsvImportKind = "draft-results" | "final-rosters" | "adp";

export type CsvPreviewIssue = {
  rowNumber: number | null;
  field: string;
  message: string;
  severity: "error" | "warning";
};

export type CsvPreviewRow = {
  rowNumber: number;
  status: "Ready" | "Warning" | "Error";
  [key: string]: string | number | null;
};

export type CsvPreviewResult = {
  kind: CsvImportKind;
  valid: boolean;
  totalRows: number;
  validRows: number;
  errorCount: number;
  warningCount: number;
  rows: CsvPreviewRow[];
  errors: CsvPreviewIssue[];
  warnings: CsvPreviewIssue[];
};

export type LeagueSummary = {
  id: string;
  name: string;
  seasonYear: number;
  scoringFormat: string;
  draftType: string;
};

export type ActiveSnapshot = {
  id: string;
  name: string;
  source: string;
  snapshotDate: string;
};

export type OptimizerSettingsForm = {
  minimumKeeperValue: number;
  minimumKeeperScore: number;
  maxAdpCap: number;
  maxKeepers: number;
  maxPerPosition: number;
  maxQbs: number;
  qbWeight: number;
  rbWeight: number;
  wrWeight: number;
  teWeight: number;
  superflexBonus: boolean;
  draftSlotBonus: boolean;
};

export type DraftImpactPick = {
  round: number;
  pickInRound: number;
  overallPick: number;
  team: string;
  status: "Open" | "Forfeited";
  keeperPlayer: string;
  keeperPosition: string;
  keeperScore: number;
};

export type WorkspaceData = {
  source: "api" | "mock";
  league: LeagueSummary | null;
  activeSnapshot: ActiveSnapshot | null;
  teams: Team[];
  draftResults: DraftPick[];
  finalRosters: FinalRosterEntry[];
  adpEntries: ADPEntry[];
  keeperRecommendations: KeeperRecommendation[];
  scenarioComparisons: ScenarioComparison[];
  outlooks: Outlook[];
  draftImpact: DraftImpactPick[];
  settings: OptimizerSettingsForm;
};

export const defaultSettings: OptimizerSettingsForm = {
  minimumKeeperValue: 1,
  minimumKeeperScore: 0,
  maxAdpCap: 180,
  maxKeepers: 4,
  maxPerPosition: 2,
  maxQbs: 1,
  qbWeight: 1.75,
  rbWeight: 1.2,
  wrWeight: 1,
  teWeight: 1.1,
  superflexBonus: true,
  draftSlotBonus: true,
};

export const mockWorkspaceData: WorkspaceData = {
  source: "mock",
  league: {
    id: "mock-league",
    name: "Maryland Mayhem",
    seasonYear: 2026,
    scoringFormat: "superflex",
    draftType: "snake",
  },
  activeSnapshot: {
    id: "mock-snapshot",
    name: "DraftSharks Superflex",
    source: "DraftSharks Superflex",
    snapshotDate: "2026-04-30",
  },
  teams: mockTeams,
  draftResults: mockDraftResults,
  finalRosters: mockFinalRosters,
  adpEntries: mockAdpEntries,
  keeperRecommendations: mockKeeperRecommendations,
  scenarioComparisons: mockScenarioComparisons,
  outlooks: mockOutlooks,
  draftImpact: buildDraftImpact(mockTeams, mockKeeperRecommendations, "snake", 12),
  settings: defaultSettings,
};

export async function loadWorkspaceData(): Promise<WorkspaceData | null> {
  const leagues = await fetchTable("/api/leagues");
  const leagueRow = leagues.rows[0];
  if (!leagueRow) {
    return null;
  }

  const league = mapLeague(leagueRow);
  const [teamsTable, draftTable, rosterTable, snapshotsTable, settingsRow, resultsTable] =
    await Promise.all([
      fetchTable(`/api/leagues/${league.id}/teams`),
      fetchTable(`/api/leagues/${league.id}/draft-results`),
      fetchTable(`/api/leagues/${league.id}/final-rosters`),
      fetchTable(`/api/leagues/${league.id}/adp-snapshots`),
      fetchJson<ApiRow>(`/api/leagues/${league.id}/optimizer/settings`),
      fetchTable(`/api/leagues/${league.id}/optimizer/results`),
    ]);

  const teams = teamsTable.rows.map(mapTeam);
  const recommendations = resultsTable.rows.map(mapRecommendation);
  const snapshotRow = snapshotsTable.rows[0];
  const activeSnapshot = snapshotRow ? mapSnapshot(snapshotRow) : null;
  const adpEntries = activeSnapshot
    ? (await fetchTable(`/api/adp-snapshots/${activeSnapshot.id}`)).rows.map(mapAdpEntry)
    : [];

  const [scenarioComparisons, draftImpact] = await Promise.all([
    loadScenarios(league.id),
    loadDraftImpact(league.id, teams, recommendations, league.draftType),
  ]);

  return {
    source: "api",
    league,
    activeSnapshot,
    teams: hydrateTeams(teams, recommendations, league.draftType),
    draftResults: draftTable.rows.map(mapDraftPick),
    finalRosters: rosterTable.rows.map(mapFinalRosterEntry),
    adpEntries,
    keeperRecommendations: recommendations,
    scenarioComparisons,
    outlooks: buildOutlooks(teams, recommendations),
    draftImpact,
    settings: mapSettings(settingsRow),
  };
}

export async function importCsv(
  leagueId: string,
  kind: CsvImportKind,
  csvText: string,
): Promise<void> {
  await fetchJson(`/api/leagues/${leagueId}/${kind}/import`, {
    body: csvText,
    headers: { "content-type": "text/csv" },
    method: "POST",
  });
}

export async function previewCsv(
  leagueId: string,
  kind: CsvImportKind,
  csvText: string,
): Promise<CsvPreviewResult> {
  const payload = await fetchJson<ApiRow>(`/api/leagues/${leagueId}/${kind}/preview`, {
    body: csvText,
    headers: { "content-type": "text/csv" },
    method: "POST",
  });
  return mapCsvPreview(payload, kind);
}

export async function runOptimizer(leagueId: string): Promise<void> {
  await fetchJson(`/api/leagues/${leagueId}/optimizer/run`, {
    body: JSON.stringify({}),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

export async function runScenarioComparison(leagueId: string): Promise<ScenarioComparison[]> {
  const payload = await fetchJson<ApiScenarioPayload>(`/api/leagues/${leagueId}/optimizer/scenarios`, {
    body: JSON.stringify({ persist: false }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return mapScenarioPayload(payload);
}

export async function saveOptimizerSettings(
  leagueId: string,
  settings: OptimizerSettingsForm,
): Promise<void> {
  await fetchJson(`/api/leagues/${leagueId}/optimizer/settings`, {
    body: JSON.stringify({
      minimum_keeper_value: settings.minimumKeeperValue,
      minimum_keeper_score: settings.minimumKeeperScore,
      max_adp_cap: settings.maxAdpCap,
      max_keepers: settings.maxKeepers,
      max_keepers_per_position: settings.maxPerPosition,
      max_qb_keepers: settings.maxQbs,
      qb_weight: settings.qbWeight,
      rb_weight: settings.rbWeight,
      wr_weight: settings.wrWeight,
      te_weight: settings.teWeight,
      enable_qb_scarcity_bonus: settings.superflexBonus,
      enable_draft_slot_bonus: settings.draftSlotBonus,
    }),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });
}

export async function setManualOverride(
  leagueId: string,
  teamId: string,
  playerId: string,
  overrideType: ManualOverrideType,
): Promise<void> {
  await fetchJson(`/api/leagues/${leagueId}/manual-overrides`, {
    body: JSON.stringify({
      team_id: teamId,
      player_id: playerId,
      override_type: overrideType,
    }),
    headers: { "content-type": "application/json" },
    method: "PUT",
  });
}

export function exportUrl(
  leagueId: string,
  format: "xlsx" | "csv" | "pdf" = "xlsx",
  teamId?: string,
): string {
  const path = exportPath(leagueId, format, teamId);
  return `${API_BASE_URL}${path}`;
}

function exportPath(
  leagueId: string,
  format: "xlsx" | "csv" | "pdf",
  teamId?: string,
): string {
  if (format === "pdf") {
    const query = teamId ? `?team_id=${teamId}` : "";
    return `/api/leagues/${leagueId}/exports/team-outlooks.pdf${query}`;
  }
  if (format === "csv") {
    return `/api/leagues/${leagueId}/exports/keeper-recommendations.csv`;
  }
  return `/api/leagues/${leagueId}/exports/keeper-recommendations.xlsx`;
}

async function loadScenarios(leagueId: string): Promise<ScenarioComparison[]> {
  try {
    return await runScenarioComparison(leagueId);
  } catch {
    return [];
  }
}

async function loadDraftImpact(
  leagueId: string,
  teams: Team[],
  recommendations: KeeperRecommendation[],
  draftType: string,
): Promise<DraftImpactPick[]> {
  try {
    const payload = await fetchTable(`/api/leagues/${leagueId}/draft-impact?rounds=12`);
    return payload.rows.map(mapDraftImpactPick);
  } catch {
    return buildDraftImpact(teams, recommendations, draftType, 12);
  }
}

async function fetchTable(path: string): Promise<ApiTable> {
  return fetchJson<ApiTable>(path);
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

function mapLeague(row: ApiRow): LeagueSummary {
  return {
    id: text(row.id),
    name: text(row.name),
    seasonYear: number(row.season_year),
    scoringFormat: text(row.scoring_format, "superflex"),
    draftType: text(row.draft_type, "snake"),
  };
}

function mapTeam(row: ApiRow): Team {
  return {
    id: text(row.id),
    name: text(row.name),
    owner: text(row.owner_name, "Unassigned"),
    draftSlot: number(row.draft_slot),
    keepers: 0,
    projectedScore: 0,
    remainingTop100Picks: 0,
  };
}

function mapDraftPick(row: ApiRow): DraftPick {
  return {
    team: text(row.team_name),
    round: number(row.round),
    overallPick: number(row.overall_pick),
    player: text(row.player_name),
    position: text(row.position),
    keeperCost: text(row.keeper_cost),
  };
}

function mapFinalRosterEntry(row: ApiRow): FinalRosterEntry {
  return {
    team: text(row.team_name),
    player: text(row.player_name),
    position: text(row.position),
    rosterStatus: text(row.roster_status, "Bench"),
    acquiredVia: text(row.acquired_via, "Unknown"),
  };
}

function mapAdpEntry(row: ApiRow): ADPEntry {
  return {
    player: text(row.player_name),
    position: text(row.position),
    adpPick: number(row.adp_pick),
    adpRound: number(row.adp_round),
    source: text(row.source),
    trend: text(row.source_note, "Flat"),
  };
}

function mapRecommendation(row: ApiRow): KeeperRecommendation {
  const isRecommended = Boolean(row.is_recommended);
  const isEligible = Boolean(row.is_eligible);
  return {
    teamId: text(row.team_id),
    playerId: text(row.player_id),
    team: text(row.team_name),
    player: text(row.player_name),
    position: text(row.position),
    keeperCostPick: number(row.keeper_cost_pick),
    keeperCostRound: number(row.keeper_cost_round),
    adpPick: number(row.adp_pick),
    adpRound: number(row.adp_round),
    keeperValue: number(row.keeper_value),
    keeperScore: number(row.keeper_score),
    status: isRecommended ? "Recommended" : isEligible ? "Eligible" : "Excluded",
    manualOverride: text(row.manual_override, "auto") as ManualOverrideType,
    reason: text(row.reason),
  };
}

function mapSnapshot(row: ApiRow): ActiveSnapshot {
  return {
    id: text(row.id),
    name: text(row.name),
    source: text(row.source),
    snapshotDate: text(row.snapshot_date),
  };
}

function mapSettings(row: ApiRow): OptimizerSettingsForm {
  return {
    minimumKeeperValue: number(row.minimum_keeper_value, defaultSettings.minimumKeeperValue),
    minimumKeeperScore: number(row.minimum_keeper_score, defaultSettings.minimumKeeperScore),
    maxAdpCap: number(row.max_adp_cap, defaultSettings.maxAdpCap),
    maxKeepers: number(row.max_keepers, defaultSettings.maxKeepers),
    maxPerPosition: number(row.max_keepers_per_position, defaultSettings.maxPerPosition),
    maxQbs: number(row.max_qb_keepers, defaultSettings.maxQbs),
    qbWeight: number(row.qb_weight, defaultSettings.qbWeight),
    rbWeight: number(row.rb_weight, defaultSettings.rbWeight),
    wrWeight: number(row.wr_weight, defaultSettings.wrWeight),
    teWeight: number(row.te_weight, defaultSettings.teWeight),
    superflexBonus: boolean(row.enable_qb_scarcity_bonus, defaultSettings.superflexBonus),
    draftSlotBonus: boolean(row.enable_draft_slot_bonus, defaultSettings.draftSlotBonus),
  };
}

function mapScenarioPayload(payload: ApiScenarioPayload): ScenarioComparison[] {
  return (payload.scenarios ?? []).map((scenario) => ({
    scenarioName: text(scenario.scenario_name) as ScenarioComparison["scenarioName"],
    description: text(scenario.description),
    totalKeeperScore: number(scenario.total_keeper_score),
    strategicNotes: text(scenario.strategic_notes),
    teams: array(scenario.teams).map((team) => ({
      team: text(team.team_name),
      totalKeeperScore: number(team.total_keeper_score),
      picksForfeited: array(team.picks_forfeited).map((pick) => text(pick)),
      selectedKeepers: array(team.selected_keepers).map((keeper) => ({
        player: text(keeper.player_name),
        position: text(keeper.position),
        keeperScore: number(keeper.keeper_score),
      })),
      strategicNotes: text(team.strategic_notes),
    })),
  }));
}

function mapDraftImpactPick(row: ApiRow): DraftImpactPick {
  return {
    round: number(row.round),
    pickInRound: number(row.pick_in_round),
    overallPick: number(row.overall_pick),
    team: text(row.team_name),
    status: text(row.status) === "Forfeited" ? "Forfeited" : "Open",
    keeperPlayer: text(row.keeper_player),
    keeperPosition: text(row.keeper_position),
    keeperScore: number(row.keeper_score),
  };
}

function mapCsvPreview(payload: ApiRow, kind: CsvImportKind): CsvPreviewResult {
  return {
    kind,
    valid: boolean(payload.valid),
    totalRows: number(payload.total_rows),
    validRows: number(payload.valid_rows),
    errorCount: number(payload.error_count),
    warningCount: number(payload.warning_count),
    rows: array(payload.rows).map((row) => ({
      ...Object.fromEntries(
        Object.entries(row).map(([key, value]) => [camel(key), value as string | number | null]),
      ),
      rowNumber: number(row.row_number),
      status: text(row.status, "Ready") as CsvPreviewRow["status"],
    })),
    errors: array(payload.errors).map(mapCsvPreviewIssue),
    warnings: array(payload.warnings).map(mapCsvPreviewIssue),
  };
}

function mapCsvPreviewIssue(row: ApiRow): CsvPreviewIssue {
  return {
    rowNumber: row.row_number === null ? null : number(row.row_number),
    field: text(row.field),
    message: text(row.message),
    severity: text(row.severity, "error") === "warning" ? "warning" : "error",
  };
}

function hydrateTeams(
  teams: Team[],
  recommendations: KeeperRecommendation[],
  draftType: string,
): Team[] {
  const impact = buildDraftImpact(teams, recommendations, draftType, 10);
  return teams.map((team) => {
    const teamRecommendations = recommendations.filter((recommendation) => recommendation.team === team.name);
    const selected = teamRecommendations.filter((recommendation) => recommendation.status === "Recommended");
    return {
      ...team,
      keepers: selected.length,
      projectedScore: round(selected.reduce((sum, recommendation) => sum + recommendation.keeperScore, 0)),
      remainingTop100Picks: impact.filter(
        (pick) =>
          pick.team === team.name &&
          pick.overallPick <= 100 &&
          pick.status !== "Forfeited",
      ).length,
    };
  });
}

function buildOutlooks(teams: Team[], recommendations: KeeperRecommendation[]): Outlook[] {
  return teams.map((team) => {
    const selected = recommendations.filter(
      (recommendation) => recommendation.team === team.name && recommendation.status === "Recommended",
    );
    const totalScore = selected.reduce((sum, recommendation) => sum + recommendation.keeperScore, 0);
    return {
      teamId: team.id,
      team: team.name,
      stance: selected.length >= 3 ? "Win-now" : selected.length >= 1 ? "Balanced" : "Flexible",
      recommendedKeepers: selected.map((recommendation) => recommendation.player),
      lostPicks: selected.length
        ? selected
            .map((recommendation) =>
              recommendation.keeperCostRound
                ? `${recommendation.keeperCostRound}.${String(recommendation.keeperCostPick).padStart(2, "0")}`
                : `Pick ${recommendation.keeperCostPick}`,
            )
            .join(", ")
        : "None",
      draftCapital: selected.length >= 3 ? "Compressed early board" : "Flexible pick access",
      risk: totalScore > 80 ? "Strong keeper core" : "Needs draft help to close roster gaps",
    };
  });
}

function buildDraftImpact(
  teams: Team[],
  recommendations: KeeperRecommendation[],
  draftType: string,
  rounds: number,
): DraftImpactPick[] {
  const teamCount = teams.length;
  if (!teamCount) {
    return [];
  }

  const teamsBySlot = new Map<number, Team>();
  teams
    .slice()
    .sort((a, b) => a.draftSlot - b.draftSlot || a.name.localeCompare(b.name))
    .forEach((team, index) => teamsBySlot.set(team.draftSlot || index + 1, team));

  const forfeitedByPick = new Map<number, KeeperRecommendation>();
  recommendations
    .filter((recommendation) => recommendation.status === "Recommended")
    .forEach((recommendation) => {
      if (recommendation.keeperCostPick) {
        forfeitedByPick.set(Math.trunc(recommendation.keeperCostPick), recommendation);
      }
    });

  const rows: DraftImpactPick[] = [];
  for (let roundNumber = 1; roundNumber <= rounds; roundNumber += 1) {
    const slots = Array.from({ length: teamCount }, (_, index) => index + 1);
    if (draftType.toLowerCase() === "snake" && roundNumber % 2 === 0) {
      slots.reverse();
    }

    slots.forEach((slot, index) => {
      const overallPick = (roundNumber - 1) * teamCount + index + 1;
      const team = teamsBySlot.get(slot) ?? teams[index];
      const keeper = forfeitedByPick.get(overallPick);
      rows.push({
        round: roundNumber,
        pickInRound: index + 1,
        overallPick,
        team: team?.name ?? "",
        status: keeper ? "Forfeited" : "Open",
        keeperPlayer: keeper?.player ?? "",
        keeperPosition: keeper?.position ?? "",
        keeperScore: keeper?.keeperScore ?? 0,
      });
    });
  }
  return rows;
}

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

function number(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function boolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function array(value: unknown): ApiRow[] {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === "object") as ApiRow[]) : [];
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function camel(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
