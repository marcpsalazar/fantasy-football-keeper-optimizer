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
  type KeeperExplanation,
  type KeeperRecommendation,
  type Outlook,
  type PlayerSummary,
  type ScenarioComparison,
  type ScenarioNarrative,
  type Team,
} from "@/lib/mock-data";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

type ApiRow = Record<string, unknown>;

type ApiTable = {
  rows: ApiRow[];
  count?: number;
  selected_count?: number;
  [key: string]: unknown;
};

type ApiScenarioPayload = {
  scenarios?: ApiRow[];
  narrative?: unknown;
};

export type ManualOverrideType = "auto" | "force_keep" | "exclude";
export type CsvImportKind = "draft-results" | "final-rosters" | "adp";

export type AuthUser = {
  id: string;
  email: string;
  alias: string | null;
  role: "platform_admin" | "user";
  isActive: boolean;
  avatarDataUrl: string | null;
  teamId: string | null;
  teamName: string | null;
};

export type AdminUser = AuthUser;

export type UserForm = {
  email: string;
  alias: string;
  password: string;
  role: "platform_admin" | "user";
  isActive: boolean;
  teamId: string | null;
};

export type TeamForm = {
  name: string;
  draftSlot: number | null;
  ownerName: string;
  userId: string | null;
};

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
  keeperPickDeadline: string | null;
  regularSeasonStartDate: string | null;
  rosterSettings: LeagueRosterSettings;
};

export type LeagueWithRole = LeagueSummary & {
  leagueRole: "league_admin" | "member";
  avatarDataUrl: string | null;
};

export type LeagueCreateForm = {
  name: string;
  seasonYear: number;
  scoringFormat: string;
  draftType: string;
};

export type LeagueMembership = {
  id: string;
  userId: string;
  leagueId: string;
  role: "league_admin" | "member";
  email: string;
  alias: string | null;
  avatarDataUrl: string | null;
};

export type LeagueCalendarSettings = {
  keeperPickDeadline: string;
  regularSeasonStartDate: string;
};

export type LeagueRosterSettings = {
  slots: Record<string, number>;
  allowedPositions: string[];
  maxPositionCounts: Record<string, number>;
  benchPositionLimits: Record<string, number>;
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
  elitePlayerBonus: boolean;
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

export type NewsHeadline = {
  headline: string;
  link: string;
  publishedAt: string;
  source: string;
};

export type MockDraftStatus = "setup" | "in_progress" | "paused" | "complete" | "abandoned";

export type MockDraftPickSource = "user" | "bot" | "keeper_forfeit" | "auto_timeout";

export type MockDraftCreateForm = {
  adpSnapshotId: string | null;
  scenarioName: string | null;
  pickTimerSeconds: 30 | 60 | 90 | 120 | null;
  defaultPersonality: string;
  defaultDifficulty: string;
  teamBotOverrides: Record<string, { personality: string; difficulty: string }>;
};

export type MockDraftPick = {
  id: string;
  sessionId: string;
  round: number;
  pickInRound: number;
  overallPick: number;
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
  position: string;
  nflTeam: string;
  source: MockDraftPickSource;
  decisionTimeMs: number | null;
  botPersonality: string | null;
  botDifficulty: string | null;
  reasoningSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MockDraftBoardSlot = {
  round: number;
  pickInRound: number;
  overallPick: number;
  teamId: string | null;
  teamName: string;
  status: "Open" | "Keeper" | "Drafted";
  pick: MockDraftPick | null;
};

export type MockDraftAvailablePlayer = {
  playerId: string;
  playerName: string;
  position: string;
  nflTeam: string;
  adpPick: number | null;
  adpRound: number | null;
  risk: number | null;
  projection: number | null;
};

export type MockDraftAnalysis = {
  id: string;
  sessionId: string;
  overallLetterGrade: string;
  overallNumericScore: number;
  summary: string;
  strengths: Record<string, unknown>[];
  weaknesses: Record<string, unknown>[];
  pickFeedback: Record<string, unknown>[];
  whatIfScenarios: Record<string, unknown>[];
  projectedRankings: Record<string, unknown>;
  futureAdvice: Record<string, unknown>[];
  createdAt: string;
  updatedAt: string;
};

export type MockDraftRosterNeed = {
  slot: string;
  filled: number;
  target: number;
  remaining: number;
};

export type MockDraftStrategyPlan = {
  summary: string;
  roundPlan: Record<string, unknown>[];
  positionPriorities: Record<string, unknown>[];
  targets: Record<string, unknown>[];
  fades: Record<string, unknown>[];
  contingencies: Record<string, unknown>[];
  generatedAt: string | null;
  cacheKey: string | null;
  error: string | null;
  aiUsed: boolean;
  model: string | null;
};

export type MockDraftSession = {
  id: string;
  leagueId: string;
  userId: string | null;
  userTeamId: string;
  userTeamName: string;
  adpSnapshotId: string | null;
  status: MockDraftStatus;
  pickTimerSeconds: number | null;
  botConfig: Record<string, unknown>;
  keeperContext: Record<string, unknown>;
  draftType: string;
  roundCount: number;
  currentPick: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  picks: MockDraftPick[];
  board: MockDraftBoardSlot[];
  availablePlayers: MockDraftAvailablePlayer[];
  rosterNeeds: MockDraftRosterNeed[];
  strategyPlan: MockDraftStrategyPlan | null;
  analysis: MockDraftAnalysis | null;
};

export type MockDraftHistoryRow = {
  id: string;
  leagueId: string;
  userTeamId: string;
  userTeamName: string;
  status: MockDraftStatus;
  draftType: string;
  roundCount: number;
  pickTimerSeconds: number | null;
  completedAt: string | null;
  createdAt: string;
  overallLetterGrade: string | null;
  overallNumericScore: number | null;
  summary: string | null;
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
  scenarioNarrative: ScenarioNarrative | null;
  outlooks: Outlook[];
  draftImpact: DraftImpactPick[];
  leagueNews: NewsHeadline[];
  settings: OptimizerSettingsForm;
};

export type { ScenarioNarrative };

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
  elitePlayerBonus: true,
};

export const defaultLeagueRosterSettings: LeagueRosterSettings = {
  slots: {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    FLEX: 2,
    SUPERFLEX: 1,
    K: 1,
    DST: 1,
    BENCH: 6,
  },
  allowedPositions: ["QB", "RB", "WR", "TE", "K", "DST"],
  maxPositionCounts: {},
  benchPositionLimits: {},
};

export const mockWorkspaceData: WorkspaceData = {
  source: "mock",
  league: {
    id: "mock-league",
    name: "Maryland Mayhem",
    seasonYear: 2026,
    scoringFormat: "superflex",
    draftType: "snake",
    keeperPickDeadline: null,
    regularSeasonStartDate: "2026-09-10",
    rosterSettings: defaultLeagueRosterSettings,
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
  scenarioNarrative: null,
  outlooks: mockOutlooks,
  draftImpact: buildDraftImpact(
    mockTeams,
    mockKeeperRecommendations,
    "snake",
    countDraftRounds(mockDraftResults, mockKeeperRecommendations),
  ),
  leagueNews: [
    {
      headline: "Fantasy managers are debating early-round quarterback builds in superflex drafts",
      link: "https://news.google.com/",
      publishedAt: "2026-05-16T10:00:00Z",
      source: "Mock Feed",
    },
    {
      headline: "Running back injury reports are starting to reshape offseason keeper values",
      link: "https://news.google.com/",
      publishedAt: "2026-05-16T08:00:00Z",
      source: "Mock Feed",
    },
  ],
  settings: defaultSettings,
};

type OutlookMetrics = {
  earlyPickCount: number;
  earliestLostPick: number;
  keeperCount: number;
  remainingTop100Picks: number;
  totalKeeperValue: number;
};

export async function loadWorkspaceData(leagueId?: string): Promise<WorkspaceData | null> {
  const leagues = await fetchTable("/api/leagues/my");
  const leagueRow = leagueId
    ? (leagues.rows.find((r) => text(r.id) === leagueId) ?? leagues.rows[0])
    : leagues.rows[0];
  if (!leagueRow) {
    return null;
  }

  const league = mapLeague(leagueRow);
  const [
    teamsTable,
    draftTable,
    rosterTable,
    snapshotsTable,
    settingsRow,
    initialResultsTable,
    newsTable,
  ] =
    await Promise.all([
      fetchTable(`/api/leagues/${league.id}/teams`),
      fetchTable(`/api/leagues/${league.id}/draft-results`),
      fetchTable(`/api/leagues/${league.id}/final-rosters`),
      fetchTable(`/api/leagues/${league.id}/adp-snapshots`),
      fetchJson<ApiRow>(`/api/leagues/${league.id}/optimizer/settings`),
      fetchTable(`/api/leagues/${league.id}/optimizer/results`),
      fetchTable("/api/news/fantasy-football"),
    ]);

  const teams = teamsTable.rows.map(mapTeam);
  let resultsTable = initialResultsTable;
  if (resultsTable.rows.length === 0 && rosterTable.rows.length > 0 && snapshotsTable.rows.length > 0) {
    try {
      await runOptimizer(league.id);
      resultsTable = await fetchTable(`/api/leagues/${league.id}/optimizer/results`);
    } catch {
      resultsTable = initialResultsTable;
    }
  }
  const draftResults = draftTable.rows.map(mapDraftPick);
  const recommendations = dedupeRecommendations(resultsTable.rows.map(mapRecommendation));
  const snapshotRow = snapshotsTable.rows[0];
  const activeSnapshot = snapshotRow ? mapSnapshot(snapshotRow) : null;
  const adpEntries = activeSnapshot
    ? (await fetchTable(`/api/adp-snapshots/${activeSnapshot.id}`)).rows.map(mapAdpEntry)
    : [];

  const { comparisons: scenarioComparisons, narrative: scenarioNarrative } =
    await loadScenarios(league.id);
  const hydratedTeams = hydrateTeams(teams, recommendations, league.draftType);
  const draftRoundCount = countDraftRounds(draftResults, recommendations);

  return {
    source: "api",
    league,
    activeSnapshot,
    teams: hydratedTeams,
    draftResults,
    finalRosters: rosterTable.rows.map(mapFinalRosterEntry),
    adpEntries,
    keeperRecommendations: recommendations,
    scenarioComparisons,
    scenarioNarrative,
    outlooks: buildOutlooks(hydratedTeams, recommendations),
    draftImpact: buildDraftImpact(hydratedTeams, recommendations, league.draftType, draftRoundCount),
    leagueNews: newsTable.rows.map(mapNewsHeadline),
    settings: mapSettings(settingsRow),
  };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const payload = await fetchJson<{ user: ApiRow | null }>("/api/auth/me");
  return payload.user ? mapAuthUser(payload.user) : null;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const payload = await fetchJson<{ user: ApiRow }>("/api/auth/login", {
    body: JSON.stringify({ email, password }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return mapAuthUser(payload.user);
}

export async function logout(): Promise<void> {
  await fetchJson("/api/auth/logout", {
    body: JSON.stringify({}),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

export async function updateProfile(profile: { avatarDataUrl?: string | null; alias?: string | null }): Promise<AuthUser> {
  const body: ApiRow = {};
  if ("avatarDataUrl" in profile) {
    body.avatar_data_url = profile.avatarDataUrl;
  }
  if ("alias" in profile) {
    body.alias = profile.alias;
  }
  const payload = await fetchJson<{ user: ApiRow }>("/api/auth/profile", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });
  return mapAuthUser(payload.user);
}

export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  await fetchJson("/api/auth/password", {
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const payload = await fetchTable("/api/admin/users");
  return payload.rows.map(mapAdminUser);
}

export async function createAdminUser(form: UserForm): Promise<AdminUser> {
  const payload = await fetchJson<ApiRow>("/api/admin/users", {
    body: JSON.stringify(userFormPayload(form, true)),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return mapAdminUser(payload);
}

export async function updateAdminUser(userId: string, form: UserForm): Promise<AdminUser> {
  const payload = await fetchJson<ApiRow>(`/api/admin/users/${userId}`, {
    body: JSON.stringify(userFormPayload(form, false)),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });
  return mapAdminUser(payload);
}

export async function resetAdminUserPassword(userId: string, password: string): Promise<AdminUser> {
  const payload = await fetchJson<ApiRow>(`/api/admin/users/${userId}/reset-password`, {
    body: JSON.stringify({ password }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return mapAdminUser(payload);
}

export async function deleteAdminUser(userId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
    credentials: "include",
    method: "DELETE",
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`API ${response.status}: ${await response.text()}`);
    }
  });
}

export async function listMyLeagues(): Promise<LeagueWithRole[]> {
  const payload = await fetchTable("/api/leagues/my");
  return payload.rows.map(mapLeagueWithRole);
}

export async function createLeague(form: LeagueCreateForm): Promise<LeagueWithRole> {
  const payload = await fetchJson<ApiRow>("/api/leagues", {
    body: JSON.stringify({
      name: form.name,
      season_year: form.seasonYear,
      scoring_format: form.scoringFormat,
      draft_type: form.draftType,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return mapLeagueWithRole(payload);
}

export async function deleteLeague(leagueId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/leagues/${leagueId}`, {
    credentials: "include",
    method: "DELETE",
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`API ${response.status}: ${await response.text()}`);
    }
  });
}

export async function uploadLeagueAvatar(leagueId: string, dataUrl: string | null): Promise<void> {
  await fetchJson(`/api/leagues/${leagueId}/memberships/me/avatar`, {
    body: JSON.stringify({ avatar_data_url: dataUrl }),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });
}

export type SleeperImportPreview = {
  valid: boolean;
  seasonYear: number;
  teams: Array<{ rosterId: number; teamName: string; ownerName: string | null; playerCount: number }>;
  draftPicksCount: number;
  rosterEntriesCount: number;
  warnings: string[];
  errors: string[];
};

export type SleeperImportResult = {
  seasonYear: number;
  teamsUpserted: number;
  draftPicksUpserted: number;
  rosterEntriesUpserted: number;
  warnings: string[];
};

export async function previewSleeperImport(
  leagueId: string,
  sleeperLeagueId: string,
  seasonYear?: number,
): Promise<SleeperImportPreview> {
  const row = await fetchJson<Record<string, unknown>>(
    `/api/leagues/${leagueId}/import/sleeper/preview`,
    {
      body: JSON.stringify({ sleeper_league_id: sleeperLeagueId, season_year: seasonYear ?? null }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
  return {
    valid: Boolean(row.valid),
    seasonYear: Number(row.season_year),
    teams: ((row.teams as unknown[]) ?? []).map((t: unknown) => {
      const team = t as Record<string, unknown>;
      return {
        rosterId: Number(team.roster_id),
        teamName: String(team.team_name ?? ""),
        ownerName: team.owner_name != null ? String(team.owner_name) : null,
        playerCount: Number(team.player_count ?? 0),
      };
    }),
    draftPicksCount: Number(row.draft_picks_count ?? 0),
    rosterEntriesCount: Number(row.roster_entries_count ?? 0),
    warnings: ((row.warnings as string[]) ?? []),
    errors: ((row.errors as string[]) ?? []),
  };
}

export async function commitSleeperImport(
  leagueId: string,
  sleeperLeagueId: string,
  seasonYear?: number,
): Promise<SleeperImportResult> {
  const row = await fetchJson<Record<string, unknown>>(
    `/api/leagues/${leagueId}/import/sleeper/commit`,
    {
      body: JSON.stringify({ sleeper_league_id: sleeperLeagueId, season_year: seasonYear ?? null }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
  return {
    seasonYear: Number(row.season_year),
    teamsUpserted: Number(row.teams_upserted ?? 0),
    draftPicksUpserted: Number(row.draft_picks_upserted ?? 0),
    rosterEntriesUpserted: Number(row.roster_entries_upserted ?? 0),
    warnings: ((row.warnings as string[]) ?? []),
  };
}

export type TradePlayerRow = {
  playerId: string;
  playerName: string;
  position: string;
  nflTeam: string | null;
  keeperCostPick: number | null;
  keeperCostRound: number | null;
  adpPick: number | null;
  adpRound: number | null;
  keeperValue: number | null;
  keeperScore: number | null;
  isRecommended: boolean;
  isIncoming: boolean;
};

export type TradeAnalysisResult = {
  receivingTeamId: string;
  receivingTeamName: string;
  baselineKeepers: TradePlayerRow[];
  hypotheticalKeepers: TradePlayerRow[];
  baselineSurplus: number;
  hypotheticalSurplus: number;
  surplusDelta: number;
  gained: TradePlayerRow[];
  lost: TradePlayerRow[];
  aiNarrative: {
    verdict: "good" | "neutral" | "bad";
    summary: string;
    keyRisk: string;
    opportunityCost: string;
  } | null;
};

function mapTradePlayerRow(row: Record<string, unknown>): TradePlayerRow {
  return {
    playerId: String(row.player_id ?? ""),
    playerName: String(row.player_name ?? ""),
    position: String(row.position ?? ""),
    nflTeam: row.nfl_team != null ? String(row.nfl_team) : null,
    keeperCostPick: row.keeper_cost_pick != null ? Number(row.keeper_cost_pick) : null,
    keeperCostRound: row.keeper_cost_round != null ? Number(row.keeper_cost_round) : null,
    adpPick: row.adp_pick != null ? Number(row.adp_pick) : null,
    adpRound: row.adp_round != null ? Number(row.adp_round) : null,
    keeperValue: row.keeper_value != null ? Number(row.keeper_value) : null,
    keeperScore: row.keeper_score != null ? Number(row.keeper_score) : null,
    isRecommended: Boolean(row.is_recommended),
    isIncoming: Boolean(row.is_incoming),
  };
}

export async function analyzeKeeperTrade(
  leagueId: string,
  params: {
    receivingTeamId: string;
    give: { playerId: string }[];
    receive: { playerId: string; keeperCostRound: number | null }[];
    adpSnapshotId?: string | null;
    includeAi?: boolean;
  },
): Promise<TradeAnalysisResult> {
  const body = {
    receiving_team_id: params.receivingTeamId,
    give: params.give.map((g) => ({ player_id: g.playerId })),
    receive: params.receive.map((r) => ({
      player_id: r.playerId,
      keeper_cost_round: r.keeperCostRound,
    })),
    adp_snapshot_id: params.adpSnapshotId ?? null,
    include_ai: params.includeAi ?? false,
  };
  const raw = await fetchJson<Record<string, unknown>>(
    `/api/leagues/${leagueId}/optimizer/trade-analysis`,
    {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
  const mapRows = (arr: unknown): TradePlayerRow[] =>
    Array.isArray(arr) ? arr.map((r) => mapTradePlayerRow(r as Record<string, unknown>)) : [];
  const aiRaw = raw.ai_narrative as Record<string, unknown> | null | undefined;
  return {
    receivingTeamId: String(raw.receiving_team_id ?? ""),
    receivingTeamName: String(raw.receiving_team_name ?? ""),
    baselineKeepers: mapRows(raw.baseline_keepers),
    hypotheticalKeepers: mapRows(raw.hypothetical_keepers),
    baselineSurplus: Number(raw.baseline_surplus ?? 0),
    hypotheticalSurplus: Number(raw.hypothetical_surplus ?? 0),
    surplusDelta: Number(raw.surplus_delta ?? 0),
    gained: mapRows(raw.gained),
    lost: mapRows(raw.lost),
    aiNarrative: aiRaw
      ? {
          verdict: (aiRaw.verdict as "good" | "neutral" | "bad") ?? "neutral",
          summary: String(aiRaw.summary ?? ""),
          keyRisk: String(aiRaw.key_risk ?? ""),
          opportunityCost: String(aiRaw.opportunity_cost ?? ""),
        }
      : null,
  };
}

export async function getLeagueMemberships(leagueId: string): Promise<LeagueMembership[]> {
  const payload = await fetchTable(`/api/leagues/${leagueId}/memberships`);
  return payload.rows.map(mapLeagueMembership);
}

export async function upsertLeagueMembership(
  leagueId: string,
  userId: string,
  role: "league_admin" | "member",
): Promise<LeagueMembership> {
  const payload = await fetchJson<ApiRow>(`/api/leagues/${leagueId}/memberships`, {
    body: JSON.stringify({ user_id: userId, role }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return mapLeagueMembership(payload);
}

export async function updateLeagueMemberRole(
  leagueId: string,
  userId: string,
  role: "league_admin" | "member",
): Promise<LeagueMembership> {
  const payload = await fetchJson<ApiRow>(`/api/leagues/${leagueId}/memberships/${userId}/role`, {
    body: JSON.stringify({ role }),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });
  return mapLeagueMembership(payload);
}

export async function removeLeagueMember(leagueId: string, userId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/leagues/${leagueId}/memberships/${userId}`, {
    credentials: "include",
    method: "DELETE",
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`API ${response.status}: ${await response.text()}`);
    }
  });
}

export async function createTeam(leagueId: string, form: TeamForm): Promise<void> {
  await fetchJson(`/api/leagues/${leagueId}/teams`, {
    body: JSON.stringify(teamFormPayload(form)),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

export async function updateTeam(teamId: string, form: TeamForm): Promise<void> {
  await fetchJson(`/api/teams/${teamId}`, {
    body: JSON.stringify(teamFormPayload(form)),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });
}

export async function deleteTeam(teamId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/teams/${teamId}`, {
    credentials: "include",
    method: "DELETE",
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`API ${response.status}: ${await response.text()}`);
    }
  });
}

export async function updateLeagueCalendarSettings(
  leagueId: string,
  settings: LeagueCalendarSettings,
): Promise<LeagueSummary> {
  const payload = await fetchJson<ApiRow>(`/api/leagues/${leagueId}`, {
    body: JSON.stringify({
      keeper_pick_deadline: settings.keeperPickDeadline || null,
      regular_season_start_date: settings.regularSeasonStartDate || null,
    }),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });
  return mapLeague(payload);
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

export async function importCompositeAdpSnapshot(leagueId: string): Promise<void> {
  await fetchJson(`/api/leagues/${leagueId}/adp/import-composite`, {
    body: JSON.stringify({}),
    headers: { "content-type": "application/json" },
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

export async function generateKeeperExplanation(
  leagueId: string,
  recommendationId: string,
): Promise<KeeperExplanation | null> {
  const payload = await fetchJson<{ ai_explanation: unknown }>(
    `/api/leagues/${leagueId}/optimizer/results/${recommendationId}/explanation`,
    {
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
  return mapExplanation(payload.ai_explanation);
}

export async function runScenarioComparison(
  leagueId: string,
): Promise<{ comparisons: ScenarioComparison[]; narrative: ScenarioNarrative | null }> {
  const payload = await fetchJson<ApiScenarioPayload>(`/api/leagues/${leagueId}/optimizer/scenarios`, {
    body: JSON.stringify({ persist: false }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return {
    comparisons: mapScenarioPayload(payload),
    narrative: mapScenarioNarrative(payload.narrative),
  };
}

export async function generateScenarioNarrative(
  leagueId: string,
): Promise<ScenarioNarrative | null> {
  const payload = await fetchJson<{ narrative: unknown }>(
    `/api/leagues/${leagueId}/optimizer/scenarios/narrative`,
    {
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
  return mapScenarioNarrative(payload.narrative);
}

export async function getPlayerSummary(
  leagueId: string,
  playerId: string,
  snapshotId: string,
): Promise<PlayerSummary | null> {
  const payload = await fetchJson<{ ai_summary: unknown }>(
    `/api/leagues/${leagueId}/adp/players/${playerId}/summary?snapshot_id=${snapshotId}`,
  );
  return mapPlayerSummary(payload.ai_summary);
}

export async function generatePlayerSummary(
  leagueId: string,
  playerId: string,
  snapshotId: string,
): Promise<PlayerSummary | null> {
  const payload = await fetchJson<{ ai_summary: unknown }>(
    `/api/leagues/${leagueId}/adp/players/${playerId}/summary?snapshot_id=${snapshotId}`,
    {
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
  return mapPlayerSummary(payload.ai_summary);
}

export type { PlayerSummary };

export type AiUsageFeatureStat = {
  requests: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

export type AiUsageLog = {
  id: string;
  feature: string;
  model: string;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  error_message: string | null;
  created_at: string;
};

export type AiUsage = {
  current_month: {
    total_requests: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
    success_rate: number | null;
    by_feature: Record<string, AiUsageFeatureStat>;
  };
  recent_logs: AiUsageLog[];
  settings: {
    mock_draft_ai_enabled: boolean;
    keeper_explanation_ai_enabled: boolean;
    scenario_narrative_ai_enabled: boolean;
    player_summary_ai_enabled: boolean;
    mock_draft_ai_max_ai_round: number;
    ai_monthly_token_budget: number;
    mock_draft_ai_model: string;
  };
};

export async function getAiUsage(): Promise<AiUsage> {
  return fetchJson<AiUsage>("/api/admin/ai/usage");
}

export async function loadScenarioSelections(leagueId: string): Promise<Record<string, string>> {
  const payload = await fetchTable(`/api/leagues/${leagueId}/scenario-selections`);
  return Object.fromEntries(
    payload.rows
      .map((row) => [text(row.team_id), text(row.scenario_name)] as const)
      .filter(([teamId, scenarioName]) => teamId && scenarioName),
  );
}

export async function saveScenarioSelection(
  leagueId: string,
  teamId: string,
  scenarioName: string | null,
): Promise<void> {
  await fetchJson(`/api/leagues/${leagueId}/scenario-selections/${teamId}`, {
    body: JSON.stringify({ scenario_name: scenarioName }),
    headers: { "content-type": "application/json" },
    method: "PUT",
  });
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
      enable_elite_player_bonus: settings.elitePlayerBonus,
    }),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });
}

export async function saveLeagueRosterSettings(
  leagueId: string,
  rosterSettings: LeagueRosterSettings,
): Promise<LeagueSummary> {
  const payload = await fetchJson<ApiRow>(`/api/leagues/${leagueId}`, {
    body: JSON.stringify({
      roster_settings: leagueRosterSettingsPayload(rosterSettings),
    }),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });
  return mapLeague(payload);
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

export async function listMockDrafts(leagueId: string): Promise<MockDraftHistoryRow[]> {
  const payload = await fetchJson<ApiRow[]>(`/api/leagues/${leagueId}/mock-drafts`);
  return payload.map(mapMockDraftHistoryRow);
}

export async function createMockDraft(
  leagueId: string,
  form: MockDraftCreateForm,
): Promise<MockDraftSession> {
  const payload = await fetchJson<ApiRow>(`/api/leagues/${leagueId}/mock-drafts`, {
    body: JSON.stringify({
      adp_snapshot_id: form.adpSnapshotId,
      scenario_name: form.scenarioName,
      pick_timer_seconds: form.pickTimerSeconds,
      bot_config: {
        default_personality: form.defaultPersonality,
        default_difficulty: form.defaultDifficulty,
        teams: form.teamBotOverrides,
      },
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return mapMockDraftSession(payload);
}

export async function readMockDraft(sessionId: string): Promise<MockDraftSession> {
  return mapMockDraftSession(await fetchJson<ApiRow>(`/api/mock-drafts/${sessionId}`));
}

export async function startMockDraft(sessionId: string): Promise<MockDraftSession> {
  const payload = await fetchJson<{ session: ApiRow }>(`/api/mock-drafts/${sessionId}/start`, {
    body: JSON.stringify({}),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return mapMockDraftSession(payload.session);
}

export async function generateMockDraftStrategyPlan(sessionId: string): Promise<MockDraftSession> {
  const payload = await fetchJson<{ session: ApiRow }>(`/api/mock-drafts/${sessionId}/strategy-plan`, {
    body: JSON.stringify({}),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return mapMockDraftSession(payload.session);
}

export async function pauseMockDraft(sessionId: string): Promise<MockDraftSession> {
  const payload = await fetchJson<{ session: ApiRow }>(`/api/mock-drafts/${sessionId}/pause`, {
    body: JSON.stringify({}),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return mapMockDraftSession(payload.session);
}

export async function resumeMockDraft(sessionId: string): Promise<MockDraftSession> {
  const payload = await fetchJson<{ session: ApiRow }>(`/api/mock-drafts/${sessionId}/resume`, {
    body: JSON.stringify({}),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return mapMockDraftSession(payload.session);
}

export async function endMockDraft(sessionId: string): Promise<MockDraftSession> {
  const payload = await fetchJson<{ session: ApiRow }>(`/api/mock-drafts/${sessionId}/end`, {
    body: JSON.stringify({}),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return mapMockDraftSession(payload.session);
}

export async function makeMockDraftPick(
  sessionId: string,
  playerId: string,
): Promise<MockDraftSession> {
  const payload = await fetchJson<{ session: ApiRow }>(`/api/mock-drafts/${sessionId}/pick`, {
    body: JSON.stringify({ player_id: playerId }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return mapMockDraftSession(payload.session);
}

export async function makeMockDraftBotPick(sessionId: string): Promise<MockDraftSession> {
  const payload = await fetchJson<{ session: ApiRow }>(`/api/mock-drafts/${sessionId}/bot-pick`, {
    body: JSON.stringify({}),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return mapMockDraftSession(payload.session);
}

export async function deleteMockDraft(sessionId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/mock-drafts/${sessionId}`, {
    credentials: "include",
    method: "DELETE",
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`API ${response.status}: ${await response.text()}`);
    }
  });
}

export function exportUrl(
  leagueId: string,
  format: "xlsx" | "csv" | "pdf" | "adp-template" = "xlsx",
  teamId?: string,
): string {
  if (format === "adp-template") {
    return `${API_BASE_URL}/api/leagues/${leagueId}/exports/adp-template.csv`;
  }
  const path = exportPath(leagueId, format, teamId);
  return `${API_BASE_URL}${path}`;
}

export async function downloadAdpTemplate(leagueId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/leagues/${leagueId}/exports/adp-template.csv?ts=${Date.now()}`,
    {
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "text/csv,application/json" },
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = contentDisposition.match(/filename=\"?([^"]+)\"?/i);
  link.href = downloadUrl;
  link.download =
    filenameMatch?.[1] ?? `adp-template-${leagueId}-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
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

async function loadScenarios(
  leagueId: string,
): Promise<{ comparisons: ScenarioComparison[]; narrative: ScenarioNarrative | null }> {
  try {
    return await runScenarioComparison(leagueId);
  } catch {
    return { comparisons: [], narrative: null };
  }
}

async function fetchTable(path: string): Promise<ApiTable> {
  return fetchJson<ApiTable>(path);
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
  });
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

function mapAuthUser(row: ApiRow): AuthUser {
  return {
    id: text(row.id),
    email: text(row.email),
    alias: text(row.alias) || null,
    role: text(row.role) === "platform_admin" ? "platform_admin" : "user",
    isActive: Boolean(row.is_active),
    avatarDataUrl: text(row.avatar_data_url) || null,
    teamId: text(row.team_id) || null,
    teamName: text(row.team_name) || null,
  };
}

function mapAdminUser(row: ApiRow): AdminUser {
  return {
    ...mapAuthUser(row),
  };
}

function userFormPayload(form: UserForm, includePassword: boolean): ApiRow {
  return {
    email: form.email,
    alias: form.alias || null,
    ...(includePassword || form.password ? { password: form.password } : {}),
    role: form.role,
    is_active: form.isActive,
    team_id: form.teamId || null,
  };
}

function mapLeague(row: ApiRow): LeagueSummary {
  return {
    id: text(row.id),
    name: text(row.name),
    seasonYear: number(row.season_year),
    scoringFormat: text(row.scoring_format, "superflex"),
    draftType: text(row.draft_type, "snake"),
    keeperPickDeadline: text(row.keeper_pick_deadline) || null,
    regularSeasonStartDate: text(row.regular_season_start_date) || null,
    rosterSettings: mapLeagueRosterSettings(row.roster_settings),
  };
}

function mapLeagueWithRole(row: ApiRow): LeagueWithRole {
  const role = text(row.league_role);
  return {
    ...mapLeague(row),
    leagueRole: role === "league_admin" ? "league_admin" : "member",
    avatarDataUrl: text(row.avatar_data_url) || null,
  };
}

function mapLeagueMembership(row: ApiRow): LeagueMembership {
  const role = text(row.role);
  return {
    id: text(row.id),
    userId: text(row.user_id),
    leagueId: text(row.league_id),
    role: role === "league_admin" ? "league_admin" : "member",
    email: text(row.email),
    alias: text(row.alias) || null,
    avatarDataUrl: text(row.avatar_data_url) || null,
  };
}

function mapLeagueRosterSettings(value: unknown): LeagueRosterSettings {
  const settings = objectRecord(value);
  const slots = mapNumberRecord(settings.slots ?? settings.roster_slots);
  const maxPositionCounts = mapNumberRecord(
    settings.max_position_counts ?? settings.max_positions ?? settings.position_limits,
  );
  const benchPositionLimits = mapNumberRecord(settings.bench_position_limits ?? settings.bench_limits);
  const allowedPositions = stringArray(settings.allowed_positions).map(normalizePosition).filter(Boolean);
  return {
    slots: Object.keys(slots).length ? slots : defaultLeagueRosterSettings.slots,
    allowedPositions: allowedPositions.length ? allowedPositions : defaultLeagueRosterSettings.allowedPositions,
    maxPositionCounts,
    benchPositionLimits,
  };
}

function leagueRosterSettingsPayload(settings: LeagueRosterSettings): ApiRow {
  return {
    slots: settings.slots,
    allowed_positions: settings.allowedPositions.map(normalizePosition).filter(Boolean),
    max_position_counts: settings.maxPositionCounts,
    bench_position_limits: settings.benchPositionLimits,
  };
}

function mapNumberRecord(value: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(objectRecord(value))) {
    const normalizedKey = normalizePosition(key);
    const parsedValue = Math.max(0, Math.floor(number(rawValue, 0)));
    if (normalizedKey && parsedValue > 0) {
      result[normalizedKey] = parsedValue;
    }
  }
  return result;
}

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return normalized === "DEF" || normalized === "D/ST" ? "DST" : normalized;
}

function mapTeam(row: ApiRow): Team {
  return {
    id: text(row.id),
    userId: text(row.user_id),
    name: text(row.name),
    owner: text(row.owner_display_name, text(row.owner_name, "Unassigned")),
    draftSlot: number(row.draft_slot),
    keepers: 0,
    projectedScore: 0,
    remainingTop100Picks: 0,
  };
}

function teamFormPayload(form: TeamForm): ApiRow {
  return {
    name: form.name,
    draft_slot: form.draftSlot,
    owner_name: form.ownerName || null,
    user_id: form.userId || null,
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
    teamId: row.team_id != null ? String(row.team_id) : undefined,
    playerId: row.player_id != null ? String(row.player_id) : undefined,
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
    id: text(row.id),
    teamId: text(row.team_id),
    playerId: text(row.player_id),
    team: text(row.team_name),
    player: text(row.player_name),
    position: text(row.position),
    scenario: text(row.scenario_name),
    keeperCostPick: number(row.keeper_cost_pick),
    keeperCostRound: number(row.keeper_cost_round),
    adpPick: number(row.adp_pick),
    adpRound: number(row.adp_round),
    adpSourceNote: text(row.adp_source_note),
    keeperValue: number(row.keeper_value),
    keeperScore: number(row.keeper_score),
    status: isRecommended ? "Recommended" : isEligible ? "Eligible" : "Excluded",
    manualOverride: text(row.manual_override, "auto") as ManualOverrideType,
    reason: text(row.reason),
    aiExplanation: mapExplanation(row.ai_explanation),
  };
}

function mapExplanation(raw: unknown): KeeperExplanation | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  return {
    short_reason: String(obj.short_reason ?? ""),
    value_explanation: String(obj.value_explanation ?? ""),
    risk_note: String(obj.risk_note ?? ""),
    opportunity_cost: String(obj.opportunity_cost ?? ""),
    decision: (obj.decision as KeeperExplanation["decision"]) ?? "toss-up",
  };
}

function dedupeRecommendations(recommendations: KeeperRecommendation[]): KeeperRecommendation[] {
  const byTeamPlayer = new Map<string, KeeperRecommendation>();
  recommendations.forEach((recommendation) => {
    const key = [
      recommendation.teamId || recommendation.team,
      recommendation.playerId || recommendation.player,
      recommendation.position,
    ].join("|");
    if (!byTeamPlayer.has(key)) {
      byTeamPlayer.set(key, recommendation);
    }
  });
  return Array.from(byTeamPlayer.values());
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
    elitePlayerBonus: boolean(row.enable_elite_player_bonus, defaultSettings.elitePlayerBonus),
  };
}

function mapScenarioPayload(payload: ApiScenarioPayload): ScenarioComparison[] {
  return (payload.scenarios ?? []).map((scenario) => ({
    scenarioName: text(scenario.scenario_name) as ScenarioComparison["scenarioName"],
    description: text(scenario.description),
    totalKeeperScore: number(scenario.total_keeper_score),
    strategicNotes: text(scenario.strategic_notes),
    teams: array(scenario.teams).map((team) => ({
      teamId: text(team.team_id),
      team: text(team.team_name),
      totalKeeperScore: number(team.total_keeper_score),
      picksForfeited: stringArray(team.picks_forfeited),
      selectedKeepers: array(team.selected_keepers).map((keeper) => ({
        playerId: text(keeper.player_id),
        player: text(keeper.player_name),
        position: text(keeper.position),
        keeperCostPick: number(keeper.keeper_cost_pick),
        keeperCostRound: number(keeper.keeper_cost_round),
        keeperValue: number(keeper.keeper_value),
        keeperScore: number(keeper.keeper_score),
        reason: text(keeper.reason),
      })),
      strategicNotes: text(team.strategic_notes),
    })),
  }));
}

function mapScenarioNarrative(raw: unknown): ScenarioNarrative | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  return {
    summary: String(obj.summary ?? ""),
    best_fit: String(obj.best_fit ?? ""),
    tradeoffs: Array.isArray(obj.tradeoffs)
      ? (obj.tradeoffs as Record<string, unknown>[]).map((t) => ({
          scenario: String(t.scenario ?? ""),
          benefit: String(t.benefit ?? ""),
          cost: String(t.cost ?? ""),
        }))
      : [],
    decision_notes: Array.isArray(obj.decision_notes)
      ? (obj.decision_notes as unknown[]).map(String)
      : [],
  };
}

function mapPlayerSummary(raw: unknown): PlayerSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const rec = String(obj.draft_recommendation ?? "watchlist");
  const validRecs = ["draft now", "target next round", "watchlist", "avoid"] as const;
  return {
    quick_take: String(obj.quick_take ?? ""),
    fantasy_points_context: String(obj.fantasy_points_context ?? ""),
    value_note: String(obj.value_note ?? ""),
    risk_note: String(obj.risk_note ?? ""),
    roster_fit: String(obj.roster_fit ?? ""),
    draft_recommendation: (validRecs as readonly string[]).includes(rec)
      ? (rec as PlayerSummary["draft_recommendation"])
      : "watchlist",
  };
}

function mapNewsHeadline(row: ApiRow): NewsHeadline {
  return {
    headline: text(row.headline),
    link: text(row.link),
    publishedAt: text(row.published_at),
    source: text(row.source),
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

function mapMockDraftSession(row: ApiRow): MockDraftSession {
  return {
    id: text(row.id),
    leagueId: text(row.league_id),
    userId: text(row.user_id) || null,
    userTeamId: text(row.user_team_id),
    userTeamName: text(row.user_team_name),
    adpSnapshotId: text(row.adp_snapshot_id) || null,
    status: text(row.status, "setup") as MockDraftStatus,
    pickTimerSeconds: nullableNumber(row.pick_timer_seconds),
    botConfig: objectRecord(row.bot_config),
    keeperContext: objectRecord(row.keeper_context),
    draftType: text(row.draft_type, "snake"),
    roundCount: number(row.round_count),
    currentPick: nullableNumber(row.current_pick),
    completedAt: text(row.completed_at) || null,
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    picks: array(row.picks).map(mapMockDraftPick),
    board: array(row.board).map(mapMockDraftBoardSlot),
    availablePlayers: array(row.available_players).map(mapMockDraftAvailablePlayer),
    rosterNeeds: array(row.roster_needs).map(mapMockDraftRosterNeed),
    strategyPlan: row.strategy_plan && typeof row.strategy_plan === "object"
      ? mapMockDraftStrategyPlan(row.strategy_plan as ApiRow)
      : null,
    analysis: row.analysis && typeof row.analysis === "object"
      ? mapMockDraftAnalysis(row.analysis as ApiRow)
      : null,
  };
}

function mapMockDraftPick(row: ApiRow): MockDraftPick {
  return {
    id: text(row.id),
    sessionId: text(row.session_id),
    round: number(row.round),
    pickInRound: number(row.pick_in_round),
    overallPick: number(row.overall_pick),
    teamId: text(row.team_id),
    teamName: text(row.team_name),
    playerId: text(row.player_id),
    playerName: text(row.player_name),
    position: text(row.position),
    nflTeam: text(row.nfl_team),
    source: text(row.source, "user") as MockDraftPickSource,
    decisionTimeMs: nullableNumber(row.decision_time_ms),
    botPersonality: text(row.bot_personality) || null,
    botDifficulty: text(row.bot_difficulty) || null,
    reasoningSummary: text(row.reasoning_summary) || null,
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function mapMockDraftBoardSlot(row: ApiRow): MockDraftBoardSlot {
  return {
    round: number(row.round),
    pickInRound: number(row.pick_in_round),
    overallPick: number(row.overall_pick),
    teamId: text(row.team_id) || null,
    teamName: text(row.team_name),
    status: text(row.status, "Open") as MockDraftBoardSlot["status"],
    pick: row.pick && typeof row.pick === "object" ? mapMockDraftPick(row.pick as ApiRow) : null,
  };
}

function mapMockDraftAvailablePlayer(row: ApiRow): MockDraftAvailablePlayer {
  return {
    playerId: text(row.player_id),
    playerName: text(row.player_name),
    position: text(row.position),
    nflTeam: text(row.nfl_team),
    adpPick: nullableNumber(row.adp_pick),
    adpRound: nullableNumber(row.adp_round),
    risk: nullableNumber(row.risk),
    projection: nullableNumber(row.projection),
  };
}

function mapMockDraftAnalysis(row: ApiRow): MockDraftAnalysis {
  return {
    id: text(row.id),
    sessionId: text(row.session_id),
    overallLetterGrade: text(row.overall_letter_grade),
    overallNumericScore: number(row.overall_numeric_score),
    summary: text(row.summary),
    strengths: array(row.strengths),
    weaknesses: array(row.weaknesses),
    pickFeedback: array(row.pick_feedback),
    whatIfScenarios: array(row.what_if_scenarios),
    projectedRankings: objectRecord(row.projected_rankings),
    futureAdvice: array(row.future_advice),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function mapMockDraftRosterNeed(row: ApiRow): MockDraftRosterNeed {
  return {
    slot: text(row.slot),
    filled: number(row.filled),
    target: number(row.target),
    remaining: number(row.remaining),
  };
}

function mapMockDraftStrategyPlan(row: ApiRow): MockDraftStrategyPlan {
  return {
    summary: text(row.summary),
    roundPlan: array(row.round_plan).map(objectRecord),
    positionPriorities: array(row.position_priorities).map(objectRecord),
    targets: array(row.targets).map(objectRecord),
    fades: array(row.fades).map(objectRecord),
    contingencies: array(row.contingencies).map(objectRecord),
    generatedAt: text(row.generated_at) || null,
    cacheKey: text(row.cache_key) || null,
    error: text(row.error) || null,
    aiUsed: Boolean(row.ai_used),
    model: text(row.model) || null,
  };
}

function mapMockDraftHistoryRow(row: ApiRow): MockDraftHistoryRow {
  return {
    id: text(row.id),
    leagueId: text(row.league_id),
    userTeamId: text(row.user_team_id),
    userTeamName: text(row.user_team_name),
    status: text(row.status, "complete") as MockDraftStatus,
    draftType: text(row.draft_type, "snake"),
    roundCount: number(row.round_count),
    pickTimerSeconds: nullableNumber(row.pick_timer_seconds),
    completedAt: text(row.completed_at) || null,
    createdAt: text(row.created_at),
    overallLetterGrade: text(row.overall_letter_grade) || null,
    overallNumericScore: nullableNumber(row.overall_numeric_score),
    summary: text(row.summary) || null,
  };
}

export function hydrateTeams(
  teams: Team[],
  recommendations: KeeperRecommendation[],
  draftType: string,
): Team[] {
  const top100Rounds = Math.ceil(100 / Math.max(teams.length, 1));
  const impact = buildDraftImpact(teams, recommendations, draftType, top100Rounds);
  return teams.map((team) => {
    const teamRecommendations = recommendations.filter(
      (recommendation) => recommendation.teamId === team.id || recommendation.team === team.name,
    );
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

export function countDraftRounds(
  draftResults: DraftPick[],
  recommendations: KeeperRecommendation[],
): number {
  const maxDraftRound = draftResults.reduce(
    (maximum, pick) => Math.max(maximum, pick.round),
    0,
  );
  if (maxDraftRound > 0) {
    return maxDraftRound;
  }

  const maxKeeperRound = recommendations.reduce(
    (maximum, recommendation) => Math.max(maximum, recommendation.keeperCostRound),
    0,
  );
  return Math.max(maxKeeperRound, 1);
}

export function buildActiveKeeperRecommendations(
  teams: Team[],
  recommendations: KeeperRecommendation[],
  scenarioComparisons: ScenarioComparison[],
  draftType: string,
  selectedScenarioByTeam: Record<string, string>,
): KeeperRecommendation[] {
  if (!scenarioComparisons.length) {
    return recommendations.map((recommendation) => {
      const hasOverride = recommendation.manualOverride && recommendation.manualOverride !== "auto";
      return {
        ...recommendation,
        scenario: hasOverride ? "Custom" : recommendation.scenario,
      };
    });
  }

  const preferredScenarioByTeam = recommendScenarioSelections(teams, scenarioComparisons, draftType);
  const activeScenarioByTeam = { ...preferredScenarioByTeam, ...selectedScenarioByTeam };

  const activeRecommendations: KeeperRecommendation[] = recommendations.map((recommendation) => {
    const team = teams.find(
      (candidate) => candidate.id === recommendation.teamId || candidate.name === recommendation.team,
    );
    const teamKey = team?.id ?? recommendation.teamId;
    const scenarioName = teamKey ? activeScenarioByTeam[teamKey] : undefined;
    const scenario = scenarioComparisons.find(
      (comparison) => comparison.scenarioName === scenarioName,
    );
    const teamResult = scenario?.teams.find(
      (result) =>
        result.teamId === recommendation.teamId ||
        result.teamId === team?.id ||
        result.team === recommendation.team,
    );

    if (!scenarioName || !scenario || !teamResult) {
      const hasOverride = recommendation.manualOverride && recommendation.manualOverride !== "auto";
      return {
        ...recommendation,
        scenario: hasOverride ? "Custom" : recommendation.scenario,
      };
    }

    const selectedKeeper = teamResult.selectedKeepers.find(
      (keeper) =>
        (keeper.playerId && keeper.playerId === recommendation.playerId) ||
        keeper.player === recommendation.player,
    );
    const hasOverride = recommendation.manualOverride && recommendation.manualOverride !== "auto";
    const isExcludedOverride = recommendation.manualOverride === "exclude";
    const scenarioLabel = hasOverride ? `Custom from ${scenarioName}` : scenarioName;

    const status: KeeperRecommendation["status"] = selectedKeeper
      ? "Recommended"
      : isExcludedOverride || recommendation.status === "Excluded"
        ? "Excluded"
        : "Eligible";

    return {
      ...recommendation,
      scenario: scenarioLabel,
      keeperValue: selectedKeeper?.keeperValue ?? recommendation.keeperValue,
      keeperScore: selectedKeeper?.keeperScore ?? recommendation.keeperScore,
      status,
      reason: selectedKeeper?.reason ?? recommendation.reason,
    };
  });

  const existingKeys = new Set<string>();
  activeRecommendations.forEach((recommendation) => {
    const playerKeys = [recommendation.playerId, recommendation.player].filter(Boolean);
    const teamKeys = [recommendation.teamId, recommendation.team].filter(Boolean);
    teamKeys.forEach((teamKey) => {
      playerKeys.forEach((playerKey) => existingKeys.add([teamKey, playerKey].join("|")));
    });
  });

  teams.forEach((team) => {
    const scenarioName = activeScenarioByTeam[team.id];
    const scenario = scenarioComparisons.find(
      (comparison) => comparison.scenarioName === scenarioName,
    );
    const teamResult = scenario?.teams.find(
      (result) => result.teamId === team.id || result.team === team.name,
    );
    if (!scenarioName || !teamResult) {
      return;
    }

    teamResult.selectedKeepers.forEach((keeper) => {
      const playerKeys = [keeper.playerId, keeper.player].filter(Boolean);
      const candidateKeys = [team.id, team.name].flatMap((teamKey) =>
        playerKeys.map((playerKey) => [teamKey, playerKey].join("|")),
      );
      if (candidateKeys.some((key) => existingKeys.has(key))) {
        return;
      }
      candidateKeys.forEach((key) => existingKeys.add(key));
      activeRecommendations.push({
        teamId: team.id,
        playerId: keeper.playerId,
        team: team.name,
        player: keeper.player,
        position: keeper.position,
        scenario: scenarioName,
        keeperCostPick: keeper.keeperCostPick ?? 0,
        keeperCostRound: keeper.keeperCostRound ?? 0,
        adpPick: 0,
        adpRound: 0,
        keeperValue: keeper.keeperValue ?? 0,
        keeperScore: keeper.keeperScore,
        status: "Recommended",
        manualOverride: "auto",
        reason: keeper.reason ?? "Selected by scenario comparison",
      });
    });
  });

  return activeRecommendations;
}

export function buildOutlooks(teams: Team[], recommendations: KeeperRecommendation[]): Outlook[] {
  return teams.map((team) => {
    const selected = recommendations.filter(
      (recommendation) =>
        (recommendation.teamId === team.id || recommendation.team === team.name) &&
        recommendation.status === "Recommended",
    );
    const metrics = summarizeOutlookMetrics(
      selected.map((recommendation) => ({
        keeperCostPick: recommendation.keeperCostPick,
        keeperValue: recommendation.keeperValue,
      })),
      team.remainingTop100Picks,
    );
    return {
      teamId: team.id,
      team: team.name,
      scenario: selected[0]?.scenario ?? "Current Optimizer",
      stance: outlookStanceSummary(metrics),
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
      draftCapital: draftCapitalSummary(metrics),
      risk: outlookRiskSummary(metrics),
    };
  });
}

export function buildScenarioOutlooks(
  teams: Team[],
  fallbackOutlooks: Outlook[],
  scenarioComparisons: ScenarioComparison[],
  draftType: string,
  selectedScenarioByTeam: Record<string, string>,
): Outlook[] {
  const fallbackByTeam = new Map(
    fallbackOutlooks.map((outlook) => [outlook.teamId ?? outlook.team, outlook] as const),
  );

  return teams.map((team) => {
    const selectedScenarioName =
      selectedScenarioByTeam[team.id] ??
      recommendScenarioForTeam(team, teams, scenarioComparisons, draftType);
    if (!selectedScenarioName) {
      return (
        fallbackByTeam.get(team.id) ??
        fallbackByTeam.get(team.name) ?? {
          teamId: team.id,
          team: team.name,
          scenario: "Current Optimizer",
          stance: "Open Board",
          recommendedKeepers: [],
          lostPicks: "None",
          draftCapital: "Full draft flexibility",
          risk: "No keeper picks are tied up, so the roster stays flexible but will need more draft hits.",
        }
      );
    }

    const scenario = scenarioComparisons.find(
      (comparison) => comparison.scenarioName === selectedScenarioName,
    );
    const teamResult = scenario?.teams.find(
      (result) => result.teamId === team.id || result.team === team.name,
    );
    if (!scenario || !teamResult) {
      return fallbackByTeam.get(team.id) ?? fallbackByTeam.get(team.name) ?? {
        teamId: team.id,
        team: team.name,
        scenario: selectedScenarioName,
        stance: "Open Board",
        recommendedKeepers: [],
        lostPicks: "None",
        draftCapital: "Full draft flexibility",
        risk: "Scenario data is unavailable for this team.",
      };
    }

    const forfeitedPickNumbers = teamResult.selectedKeepers
      .map((keeper) => keeper.keeperCostPick)
      .filter((pick): pick is number => Boolean(pick));
    const metrics = summarizeOutlookMetrics(
      teamResult.selectedKeepers.map((keeper) => ({
        keeperCostPick: keeper.keeperCostPick ?? 0,
        keeperValue: keeper.keeperValue ?? 0,
      })),
      countRemainingTop100Picks(team, teams, draftType, forfeitedPickNumbers),
    );

    return {
      teamId: team.id,
      team: team.name,
      scenario: scenario.scenarioName,
      stance: outlookStanceSummary(metrics),
      recommendedKeepers: teamResult.selectedKeepers.map((keeper) => keeper.player),
      lostPicks: teamResult.picksForfeited.length ? teamResult.picksForfeited.join(", ") : "None",
      draftCapital: draftCapitalSummary(metrics),
      risk: outlookRiskSummary(metrics),
    };
  });
}

export function recommendScenarioSelections(
  teams: Team[],
  scenarioComparisons: ScenarioComparison[],
  draftType: string,
): Record<string, ScenarioComparison["scenarioName"]> {
  return Object.fromEntries(
    teams
      .map((team) => {
        const scenarioName = recommendScenarioForTeam(team, teams, scenarioComparisons, draftType);
        return scenarioName ? ([team.id, scenarioName] as const) : null;
      })
      .filter((entry): entry is readonly [string, ScenarioComparison["scenarioName"]] => Boolean(entry)),
  );
}

function outlookStanceSummary({
  keeperCount,
  totalKeeperValue,
  earliestLostPick,
  earlyPickCount,
  remainingTop100Picks,
}: OutlookMetrics): string {
  if (keeperCount === 0) {
    return "Open Board";
  }

  if (earlyPickCount >= 2 || (earliestLostPick <= 24 && remainingTop100Picks <= 5)) {
    return "Aggressive Keep";
  }

  if (keeperCount >= 4 && remainingTop100Picks <= 5) {
    return "Keeper-Heavy";
  }

  if (totalKeeperValue >= 120 && remainingTop100Picks >= 6) {
    return "Value Core";
  }

  if (remainingTop100Picks >= 8 && keeperCount <= 2) {
    return "Flexible Build";
  }

  if (totalKeeperValue / keeperCount >= 20) {
    return "Balanced Core";
  }

  return "Thin Keeper Edge";
}

function outlookRiskSummary({
  keeperCount,
  earliestLostPick,
  remainingTop100Picks,
}: OutlookMetrics): string {
  if (keeperCount === 0) {
    return "No keeper picks are tied up, so the roster stays flexible but will need more draft hits.";
  }

  if (earliestLostPick <= 24) {
    return `This plan gives up a top-24 pick, so the keeper quality needs to outweigh the lost early-round flexibility.`;
  }

  if (keeperCount >= 4) {
    return "Using four keeper slots narrows the early draft path, so there is less room to correct roster imbalances.";
  }

  if (remainingTop100Picks <= 5) {
    return "Top-100 pick access is getting tight, so the roster will have less room to add premium starters in the draft.";
  }

  if (keeperCount === 1) {
    return "Only one keeper is locked in, which keeps the board open but leaves more of the starting lineup to be built in the draft.";
  }

  return "The keeper cost looks manageable, but the roster still depends on drafting well around the protected core.";
}

function summarizeOutlookMetrics(
  keepers: Array<{ keeperCostPick: number; keeperValue: number }>,
  remainingTop100Picks: number,
): OutlookMetrics {
  const keeperCount = keepers.length;
  const totalKeeperValue = round(
    keepers.reduce((sum, keeper) => sum + keeper.keeperValue, 0),
  );
  const earliestLostPick = keepers.reduce(
    (earliest, keeper) => (keeper.keeperCostPick < earliest ? keeper.keeperCostPick : earliest),
    Number.POSITIVE_INFINITY,
  );
  const earlyPickCount = keepers.filter((keeper) => keeper.keeperCostPick <= 60).length;

  return {
    earlyPickCount,
    earliestLostPick,
    keeperCount,
    remainingTop100Picks,
    totalKeeperValue,
  };
}

function recommendScenarioForTeam(
  team: Team,
  teams: Team[],
  scenarioComparisons: ScenarioComparison[],
  draftType: string,
): ScenarioComparison["scenarioName"] | null {
  const rankedScenarios = scenarioComparisons
    .map((scenario) => {
      const teamResult = scenario.teams.find(
        (result) => result.teamId === team.id || result.team === team.name,
      );
      if (!teamResult) {
        return null;
      }

      const forfeitedPickNumbers = teamResult.selectedKeepers
        .map((keeper) => keeper.keeperCostPick)
        .filter((pick): pick is number => Boolean(pick));
      const metrics = summarizeOutlookMetrics(
        teamResult.selectedKeepers.map((keeper) => ({
          keeperCostPick: keeper.keeperCostPick ?? 0,
          keeperValue: keeper.keeperValue ?? 0,
        })),
        countRemainingTop100Picks(team, teams, draftType, forfeitedPickNumbers),
      );

      return {
        metrics,
        scenarioName: scenario.scenarioName,
        scenarioRank: recommendedScenarioRank(metrics, scenario.scenarioName),
      };
    })
    .filter(
      (
        result,
      ): result is {
        metrics: OutlookMetrics;
        scenarioName: ScenarioComparison["scenarioName"];
        scenarioRank: number;
      } => Boolean(result),
    )
    .sort((left, right) => {
      if (right.scenarioRank !== left.scenarioRank) {
        return right.scenarioRank - left.scenarioRank;
      }
      if (right.metrics.totalKeeperValue !== left.metrics.totalKeeperValue) {
        return right.metrics.totalKeeperValue - left.metrics.totalKeeperValue;
      }
      if (right.metrics.remainingTop100Picks !== left.metrics.remainingTop100Picks) {
        return right.metrics.remainingTop100Picks - left.metrics.remainingTop100Picks;
      }
      return scenarioPreferenceOrder(left.scenarioName) - scenarioPreferenceOrder(right.scenarioName);
    });

  return rankedScenarios[0]?.scenarioName ?? null;
}

function recommendedScenarioRank(
  metrics: OutlookMetrics,
  scenarioName: ScenarioComparison["scenarioName"],
): number {
  const averageKeeperValue = metrics.keeperCount ? metrics.totalKeeperValue / metrics.keeperCount : 0;
  const premiumPickPenalty =
    metrics.earliestLostPick <= 12 ? 24 : metrics.earliestLostPick <= 24 ? 16 : metrics.earliestLostPick <= 36 ? 8 : 0;
  const scenarioBias = {
    Balanced: 4,
    "Pure Value": 3,
    "Superflex Heavy": 2,
    "Win Now": 1,
    Rebuild: 0,
  }[scenarioName];

  return round(
    metrics.totalKeeperValue * 1.35 +
      averageKeeperValue * 1.5 +
      metrics.remainingTop100Picks * 4 -
      metrics.earlyPickCount * 10 -
      premiumPickPenalty +
      metrics.keeperCount * 2 +
      scenarioBias,
  );
}

function scenarioPreferenceOrder(scenarioName: ScenarioComparison["scenarioName"]): number {
  return {
    Balanced: 0,
    "Pure Value": 1,
    "Superflex Heavy": 2,
    "Win Now": 3,
    Rebuild: 4,
  }[scenarioName];
}

function draftCapitalSummary({
  keeperCount,
  earliestLostPick,
  remainingTop100Picks,
}: OutlookMetrics): string {
  if (keeperCount === 0) {
    return "Full draft flexibility";
  }

  if (earliestLostPick <= 24) {
    return "Premium pick already committed";
  }

  if (remainingTop100Picks >= 8) {
    return "Strong top-100 access";
  }

  if (remainingTop100Picks >= 6) {
    return "Healthy early-round flexibility";
  }

  if (remainingTop100Picks <= 4) {
    return "Thin early board";
  }

  return "Manageable draft pressure";
}

function countRemainingTop100Picks(
  team: Team,
  teams: Team[],
  draftType: string,
  forfeitedPickNumbers: number[],
): number {
  const teamCount = teams.length;
  if (!teamCount || !team.draftSlot) {
    return 0;
  }

  const forfeited = new Set(
    forfeitedPickNumbers
      .map((pick) => teamForfeitedOverallPick(team.draftSlot, teamCount, draftType, pick))
      .filter((pick): pick is number => pick !== null),
  );
  let remaining = 0;
  for (let overallPick = 1; overallPick <= 100; overallPick += 1) {
    if (pickBelongsToTeam(overallPick, team.draftSlot, teamCount, draftType) && !forfeited.has(overallPick)) {
      remaining += 1;
    }
  }
  return remaining;
}

function pickBelongsToTeam(
  overallPick: number,
  draftSlot: number,
  teamCount: number,
  draftType: string,
): boolean {
  const roundNumber = Math.ceil(overallPick / teamCount);
  const pickInRound = overallPick - (roundNumber - 1) * teamCount;
  if (draftType.toLowerCase() !== "snake") {
    return pickInRound === draftSlot;
  }
  return roundNumber % 2 === 1
    ? pickInRound === draftSlot
    : pickInRound === teamCount + 1 - draftSlot;
}

export function buildDraftImpact(
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
      const team = teams.find((candidate) => candidate.id === recommendation.teamId || candidate.name === recommendation.team);
      const forfeitedPick =
        team?.draftSlot
          ? teamForfeitedOverallPick(
              team.draftSlot,
              teamCount,
              draftType,
              recommendation.keeperCostPick,
              recommendation.keeperCostRound,
            )
          : null;
      if (forfeitedPick !== null) {
        forfeitedByPick.set(forfeitedPick, recommendation);
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

function teamForfeitedOverallPick(
  draftSlot: number,
  teamCount: number,
  draftType: string,
  keeperCostPick?: number,
  keeperCostRound?: number,
): number | null {
  if (!draftSlot || draftSlot < 1 || draftSlot > teamCount || teamCount <= 0) {
    return null;
  }

  const roundNumber =
    keeperCostRound && keeperCostRound > 0
      ? Math.trunc(keeperCostRound)
      : keeperCostPick && keeperCostPick > 0
        ? Math.floor((keeperCostPick - 1) / teamCount) + 1
        : 0;

  if (!roundNumber) {
    return null;
  }

  const pickInRound =
    draftType.toLowerCase() === "snake" && roundNumber % 2 === 0
      ? teamCount + 1 - draftSlot
      : draftSlot;

  return (roundNumber - 1) * teamCount + pickInRound;
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

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = number(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
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

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function camel(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
