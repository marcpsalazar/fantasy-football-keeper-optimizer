"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  Bot,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  Gauge,
  GitCompare,
  History,
  KeyRound,
  LogOut,
  ListChecks,
  PanelLeft,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Trophy,
  Upload,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";

import { DataTable, resetDataTableDisplaySettings } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adpCsvPreview,
  draftCsvPreview,
  finalRosterCsvPreview,
  type ADPEntry,
  type DraftPick,
  type FinalRosterEntry,
  type KeeperExplanation,
  type KeeperRecommendation,
  type Outlook,
  type ScenarioComparison,
  type ScenarioTeamResult,
  type Team,
} from "@/lib/mock-data";
import {
  buildActiveKeeperRecommendations,
  buildDraftImpact,
  buildOutlooks,
  changeOwnPassword,
  countDraftRounds,
  createAdminUser,
  createLeague,
  createMockDraft,
  createTeam,
  deleteAdminUser,
  deleteLeague,
  deleteMockDraft,
  deleteTeam,
  downloadAdpTemplate,
  endMockDraft,
  exportUrl,
  generateKeeperExplanation,
  generatePlayerSummary,
  generateScenarioNarrative,
  generateMockDraftStrategyPlan,
  getAiUsage,
  getLeagueMemberships,
  getPlayerSummary,
  hydrateTeams,
  importCompositeAdpSnapshot,
  importCsv,
  getCurrentUser,
  listAdminUsers,
  listMyLeagues,
  listMockDrafts,
  loadWorkspaceData,
  loadScenarioSelections,
  login,
  logout,
  mockWorkspaceData,
  makeMockDraftBotPick,
  makeMockDraftPick,
  pauseMockDraft,
  previewCsv,
  readMockDraft,
  commitSleeperImport,
  previewSleeperImport,
  removeLeagueMember,
  resumeMockDraft,
  recommendScenarioSelections,
  resetAdminUserPassword,
  runOptimizer,
  runScenarioComparison,
  saveOptimizerSettings,
  saveLeagueRosterSettings,
  saveScenarioSelection,
  setManualOverride,
  startMockDraft,
  updateAdminUser,
  updateLeagueCalendarSettings,
  updateLeagueMemberRole,
  updateProfile,
  uploadLeagueAvatar,
  upsertLeagueMembership,
  updateTeam,
  type AdminUser,
  type TeamForm,
  type AuthUser,
  type CsvImportKind,
  type CsvPreviewResult,
  type SleeperImportPreview,
  type DraftImpactPick,
  type LeagueCalendarSettings,
  type LeagueCreateForm,
  type LeagueMembership,
  type LeagueRosterSettings,
  type LeagueWithRole,
  type ManualOverrideType,
  type AiUsage,
  type MockDraftAvailablePlayer,
  type MockDraftCreateForm,
  type MockDraftHistoryRow,
  type MockDraftSession,
  type NewsHeadline,
  type OptimizerSettingsForm,
  type PlayerSummary,
  type ScenarioNarrative,
  type UserForm,
  type WorkspaceData,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type ViewId =
  | "dashboard"
  | "guide"
  | "teams"
  | "draft"
  | "rosters"
  | "admin"
  | "settings"
  | "profile"
  | "recommendations"
  | "scenarios"
  | "outlooks"
  | "draft-impact"
  | "mock-draft";

type NavItem = {
  id: ViewId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { id: "guide", label: "How to Use", icon: BookOpen },
  { id: "dashboard", label: "League Dashboard", icon: Gauge },
  { id: "recommendations", label: "Keeper Recommendations", icon: Trophy },
  { id: "scenarios", label: "Scenario Comparison", icon: GitCompare },
  { id: "draft-impact", label: "Draft Impact", icon: ClipboardList },
  { id: "mock-draft", label: "Mock Draft", icon: Bot },
  { id: "outlooks", label: "Team Outlook", icon: ShieldCheck },
  { id: "teams", label: "Teams", icon: Users },
  { id: "draft", label: "Draft Results", icon: ClipboardList },
  { id: "rosters", label: "Final Rosters", icon: ListChecks },
  { id: "settings", label: "Optimizer Settings", icon: SlidersHorizontal },
  { id: "admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
];

const formatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const mockDraftPersonalities = [
  "Balanced",
  "Aggressive",
  "Conservative",
  "QB Lover",
  "RB Heavy",
  "WR Heavy",
  "Value Hunter",
  "Need Based",
  "Chaos",
] as const;

const mockDraftDifficulties = ["Easy", "Medium", "Hard"] as const;
const mockDraftSpeeds = ["Slow", "Medium", "Fast"] as const;
type MockDraftSpeed = (typeof mockDraftSpeeds)[number];
const DRAFT_SPEED_DELAY_MS: Record<MockDraftSpeed, number> = { Slow: 1500, Medium: 600, Fast: 150 };
const rosterPlayerPositions = ["QB", "RB", "WR", "TE", "K", "DST"] as const;
const rosterSlotPositions = ["QB", "RB", "WR", "TE", "FLEX", "SUPERFLEX", "K", "DST", "BENCH"] as const;

type DashboardDecision = {
  detail: string;
  note: string;
  team: string;
  title: string;
  variant: "danger" | "info" | "success" | "warning";
};

type ScreenGuide = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  bestFor: string;
  howToRead: string;
  watchFor: string;
  view: ViewId;
  adminOnly?: boolean;
};

type GlossaryTerm = {
  term: string;
  meaning: string;
};

type WorkflowStep = {
  title: string;
  text: string;
  view?: ViewId;
};

type ControlGuide = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  text: string;
};

const screenGuides: ScreenGuide[] = [
  {
    title: "League Dashboard",
    icon: Gauge,
    bestFor: "A quick health check before making decisions or explaining the league state.",
    howToRead: "Use the connection badge, active snapshot, keeper board, draft capital, news, and review flags to see whether the workspace is ready.",
    watchFor: "If data looks stale, use Refresh. If recommendations look stale after input changes, use Run Optimizer.",
    view: "dashboard",
  },
  {
    title: "Teams",
    icon: Users,
    bestFor: "Checking team names, owners, draft slots, keeper counts, and remaining top-100 picks.",
    howToRead: "Draft slot feeds the snake draft board and draft slot bonus. Selected keepers and top-100 picks come from the active recommendation set.",
    watchFor: "Wrong draft slots or team assignments make Draft Capital, Draft Impact, and user-specific views misleading.",
    view: "teams",
  },
  {
    title: "Draft Results",
    icon: ClipboardList,
    bestFor: "Verifying original draft cost.",
    howToRead: "If a player was drafted by the same team and is still on that final roster, the original draft pick becomes keeper cost.",
    watchFor: "Missing teams, duplicate picks, or wrong original owners create bad keeper values.",
    view: "draft",
  },
  {
    title: "Final Rosters",
    icon: ListChecks,
    bestFor: "Confirming who each team can actually keep.",
    howToRead: "This is the keeper candidate pool. Roster status adds context, so starters get more credit and injured or suspended players carry more risk.",
    watchFor: "Players not on a final roster will not become keeper candidates.",
    view: "rosters",
  },
  {
    title: "Admin",
    icon: ShieldCheck,
    bestFor: "Managing users, team assignments, CSV imports, and ADP snapshots.",
    howToRead: "Admins preview and import league source data here. ADP is the market baseline; lower ADP picks mean earlier, more expensive players.",
    watchFor: "Preview before import. Missing ADP makes scores unreliable, and imported data should be followed by Run Optimizer.",
    view: "admin",
    adminOnly: true,
  },
  {
    title: "Optimizer Settings",
    icon: SlidersHorizontal,
    bestFor: "Tuning the model to match your league's rules and strategy preferences.",
    howToRead: "Settings are grouped into three areas. Keeper Limits (max per team, max per position, max QBs) set hard caps on how many keepers the optimizer can select. Eligibility thresholds (minimum keeper value, minimum keeper score, latest ADP pick) filter out weak or fringe candidates — raise them for stricter recommendations, lower them to allow more borderline options. Position weights control how much keeper value counts at each position, which matters most in superflex formats where QB weight and the QB scarcity toggle can shift the rankings significantly.",
    watchFor: "Save Settings reruns the optimizer immediately — you do not need to click Run Optimizer separately afterward. The new recommendations then flow into Scenario Comparison, Draft Impact, Team Outlooks, and the keeper context loaded into any new Mock Draft session.",
    view: "settings",
  },
  {
    title: "Keeper Recommendations",
    icon: Trophy,
    bestFor: "The primary decision screen for finalizing keeper selections.",
    howToRead: "Recommended means selected by the optimizer within the current limits. Eligible means good enough to keep but not selected because another player ranked higher or a team or position limit was already reached. Excluded means the player failed a threshold, was manually excluded, or did not appear on a final roster.",
    watchFor: "Use manual overrides sparingly — Force Keep and Exclude are best for context the model cannot know, such as a player who has since retired or been traded. Changes here do not require a Save Settings click, but the override takes effect on the next Run Optimizer or the next time you load a Mock Draft session.",
    view: "recommendations",
  },
  {
    title: "Scenario Comparison",
    icon: GitCompare,
    bestFor: "Seeing how different strategies change the keeper list without permanently changing settings.",
    howToRead: "Each preset shows selected keepers, forfeited picks, total score, and notes by team. The Outlook Scenario selector assigns an active strategy per team so that Team Outlooks and Draft Impact reflect your chosen approach for each owner.",
    watchFor: "Run All Presets after any settings or source data change. Scenario selections feed Team Outlooks and Draft Impact, but they do not change the active recommendations used by the Mock Draft.",
    view: "scenarios",
  },
  {
    title: "Team Outlooks",
    icon: ShieldCheck,
    bestFor: "A team-by-team summary for commissioner reports and owner discussions.",
    howToRead: "Each card summarizes stance, recommended keepers, lost picks, draft capital, and risk from the active keeper plan. The outlook reflects the scenario assigned to that team in Scenario Comparison.",
    watchFor: "Outlooks are summaries driven by the active recommendations, not separate rankings. Export a PDF when the team plan is ready to share with owners.",
    view: "outlooks",
  },
  {
    title: "Draft Impact",
    icon: ClipboardList,
    bestFor: "Understanding which picks are open after keeper costs are removed from the board.",
    howToRead: "Forfeited picks are the rounds spent on keepers. Open picks are the positions that remain available in the projected snake draft order.",
    watchFor: "Draft Impact is downstream of recommendations and scenario selections. Rerun the optimizer or reassign scenarios before using it for planning.",
    view: "draft-impact",
  },
  {
    title: "Mock Draft",
    icon: Bot,
    bestFor: "Practicing your draft with keepers already locked in, AI bots filling other teams, and a live strategy coach guiding your picks.",
    howToRead: "Your team's currently recommended keepers are already accounted for before the draft starts — they do not appear in the available player pool and their picks are forfeited on the board. All other teams are controlled by AI bots. Each bot has a personality (Balanced, Aggressive, Value Hunter, etc.) that shapes its drafting style and a difficulty level (Easy, Medium, Hard) that controls how optimally it executes that style. The Strategy Coach generates an AI plan before the draft starts, showing position priorities, specific player targets, and per-round guidance that updates as picks are made.",
    watchFor: "Run the optimizer and confirm your keeper recommendations before starting a Mock Draft. Any keeper changes made in Recommendations or via Settings after a session was created will only appear in new sessions — already-created sessions retain the keeper context they were built with. If you want to test how a different keeper strategy affects your draft, update settings, save them, then create a new Mock Draft session.",
    view: "mock-draft",
  },
];

const workflowSteps: WorkflowStep[] = [
  {
    title: "Confirm the source data",
    text: "Check teams, draft results, final rosters, and ADP before trusting recommendations. Admins should preview and import CSVs from Admin when those inputs need to change.",
    view: "dashboard",
  },
  {
    title: "Tune optimizer settings",
    text: "Go to Optimizer Settings when league rules or strategy should change the calculation — keeper limits per team or position, QB caps, eligibility thresholds, ADP cap, position weights, or bonus toggles. Click Save Settings when done: it reruns the optimizer automatically, so no separate Run Optimizer click is needed.",
    view: "settings",
  },
  {
    title: "Review and override recommendations",
    text: "Read Keeper Recommendations first. Use Auto for model control, Force Keep for outside context the model cannot know, and Exclude for players you do not want selected. Use Run Optimizer to recompute after imports, team edits, ADP updates, or manual overrides.",
    view: "recommendations",
  },
  {
    title: "Compare strategies",
    text: "Use Scenario Comparison to compare Pure Value, Balanced, Superflex Heavy, Win Now, and Rebuild across all teams. Assign an Outlook Scenario per team when reports should reflect a specific strategy.",
    view: "scenarios",
  },
  {
    title: "Practice with Mock Draft",
    text: "Open Mock Draft after your keeper recommendations are set. Your recommended keepers are already removed from the available player pool and their picks are forfeited on the draft board. Choose bot personalities and difficulty, then use the AI Strategy Coach's plan to guide your picks. If you change keeper settings before the draft, save and rerun the optimizer first so the new session reflects the updated keeper list.",
    view: "mock-draft",
  },
  {
    title: "Share the result",
    text: "Use Draft Impact and Team Outlook after recommendations are finalized, then export Excel, CSV, or PDF reports from the recommendation and outlook screens.",
    view: "outlooks",
  },
];

const controlGuides: ControlGuide[] = [
  {
    title: "Optimizer Settings",
    icon: SlidersHorizontal,
    text: "Opens the settings panel where you change keeper limits, eligibility thresholds, position weights, and bonus toggles. Use it when league rules or strategy should change who the model recommends.",
  },
  {
    title: "Save Settings",
    icon: Save,
    text: "Persists the visible settings and immediately reruns the optimizer in one step — you do not need to click Run Optimizer separately. Also clears selected scenario overrides and refreshes all recommendation-driven screens.",
  },
  {
    title: "Run Optimizer",
    icon: Play,
    text: "Recomputes keeper recommendations from live inputs: teams, draft results, final rosters, ADP, manual overrides, and current settings. Use this after source data imports, team edits, ADP updates, or manual override changes.",
  },
  {
    title: "Refresh",
    icon: RefreshCw,
    text: "Reloads displayed workspace data and resets table filters or sorting. It does not rerun the optimizer or change recommendation results.",
  },
  {
    title: "Preview and Import",
    icon: Upload,
    text: "Preview validates pasted CSV before writes. Import commits valid draft, roster, or ADP rows. Always run the optimizer after an import when you want recommendations to reflect the new data.",
  },
  {
    title: "Run All Presets",
    icon: GitCompare,
    text: "Recomputes all five scenario presets for side-by-side strategy comparison. Use it after settings or source data change. Does not affect the active recommendations used by Mock Draft.",
  },
];

const glossaryTerms: GlossaryTerm[] = [
  {
    term: "Keeper Cost",
    meaning: "The draft pick a team gives up to keep a player. Same-team drafted players use their original draft pick. Traded, waiver, or otherwise unmatched players use current ADP.",
  },
  {
    term: "ADP Pick",
    meaning: "Average Draft Position, shown as an overall pick. Lower numbers are earlier and more expensive, like pick 12. Higher numbers are cheaper, like pick 140.",
  },
  {
    term: "Keeper Value",
    meaning: "Keeper Cost Pick minus ADP Pick. Bigger positive numbers are better. Example: keeping a player at pick 120 when his ADP is 45 creates +75 value.",
  },
  {
    term: "Keeper Score",
    meaning: "The overall model score used to rank candidates. It starts with keeper value, applies position weight, then adds bonuses and subtracts risk. It is a decision score, not a fantasy point projection.",
  },
  {
    term: "Total Keeper Score",
    meaning: "The sum of keeper scores for selected keepers on a team or in a scenario. It helps compare sets of keepers, but should be read with picks forfeited.",
  },
  {
    term: "Position Weight",
    meaning: "A multiplier for keeper value by position. In superflex, QB value can be weighted more heavily because starting quarterbacks are harder to replace.",
  },
  {
    term: "Talent Bonus",
    meaning: "Extra credit for players with strong ADP. Elite or near-elite players may deserve consideration even when the pure pick value is not huge.",
  },
  {
    term: "Status Bonus",
    meaning: "Extra credit based on final roster status. Starters usually get more credit than bench players. Injured, suspended, or similar statuses get less.",
  },
  {
    term: "Draft Slot Bonus",
    meaning: "A small adjustment based on where a team drafts. It helps account for the fact that giving up a pick can feel different depending on draft slot.",
  },
  {
    term: "QB Scarcity Bonus",
    meaning: "A tiered superflex bonus for quarterbacks. Better ADP quarterbacks receive more scarcity credit because they are harder to replace.",
  },
  {
    term: "Elite Anchor Bonus",
    meaning: "Extra credit for very early ADP players who can anchor a lineup. When Draft Sharks fields are available, projections, floor, ceiling, 3D Value, injury, and risk inform the bonus.",
  },
  {
    term: "Risk Penalty",
    meaning: "A score reduction for players with added uncertainty, such as injury, suspension, or questionable status.",
  },
  {
    term: "Recommended",
    meaning: "Selected by the optimizer after applying keeper limits, position limits, settings, and manual overrides.",
  },
  {
    term: "Eligible",
    meaning: "Good enough to be considered, but not selected because another keeper ranked higher or a team/position limit was reached.",
  },
  {
    term: "Manual Override",
    meaning: "A user instruction that can leave the player on auto, force the optimizer to keep the player if limits allow, or exclude the player.",
  },
  {
    term: "Picks Forfeited",
    meaning: "The draft picks a team loses by keeping its selected players.",
  },
  {
    term: "Draft Capital",
    meaning: "A plain-language summary of remaining pick strength. In the dashboard, it counts remaining open top-100 picks after keeper costs.",
  },
  {
    term: "Bot Personality",
    meaning: "The drafting style assigned to an AI-controlled team in Mock Draft. Balanced is the default. Aggressive reaches for upside, Conservative plays it safe, QB Lover stacks quarterbacks, RB/WR Heavy prioritizes that position, Value Hunter targets ADP bargains, Need Based fills roster gaps, and Chaos makes unpredictable picks.",
  },
  {
    term: "Bot Difficulty",
    meaning: "How optimally an AI bot executes its personality in Mock Draft. Easy bots make more mistakes and miss value. Hard bots draft close to their style ceiling and are harder to exploit.",
  },
  {
    term: "Strategy Coach",
    meaning: "An AI-generated draft plan in Mock Draft that shows position priorities, specific player targets, and per-round guidance. It generates when a session is created and can be regenerated while the draft is in setup or paused. Live guidance updates after each pick to reflect what is still available on the board.",
  },
  {
    term: "Pick Timer",
    meaning: "An optional countdown per pick in Mock Draft, set to 30, 60, 90, or 120 seconds. When the timer expires on your turn, the pick slot stays open but a warning is shown. Disable it by selecting No limit for a relaxed practice session.",
  },
];

type ApiStatus = "loading" | "live" | "mock" | "error";
type TeamScenarioSelection = Record<string, ScenarioComparison["scenarioName"]>;

type DashboardContextValue = {
  data: WorkspaceData;
  apiStatus: ApiStatus;
  currentUser: AuthUser | null;
  isBusy: boolean;
  statusMessage: string;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  isLeagueAdmin: boolean;
  activeLeagueId: string | null;
  userLeagues: LeagueWithRole[];
  activeLeagueMembership: LeagueWithRole | undefined;
  selectedScenarioByTeam: TeamScenarioSelection;
  tableDisplayResetSignal: number;
  refreshData: (leagueId?: string) => Promise<void>;
  switchLeague: (leagueId: string) => Promise<void>;
  createLeagueNow: (form: LeagueCreateForm) => Promise<void>;
  deleteLeagueNow: (leagueId: string) => Promise<void>;
  logoutNow: () => Promise<void>;
  resetDisplayAndRefresh: () => Promise<void>;
  updateProfileAvatarNow: (avatarDataUrl: string | null) => Promise<void>;
  updateLeagueAvatarNow: (leagueId: string, avatarDataUrl: string | null) => Promise<void>;
  updateProfileAliasNow: (alias: string | null) => Promise<void>;
  changePasswordNow: (currentPassword: string, newPassword: string) => Promise<void>;
  setSelectedScenarioForTeam: (
    teamId: string,
    scenarioName: ScenarioComparison["scenarioName"] | null,
  ) => void;
  csvPreviews: Record<CsvImportKind, CsvPreviewResult | null>;
  previewCsvText: (kind: CsvImportKind, csvText: string) => Promise<void>;
  importCsvText: (kind: CsvImportKind, csvText: string) => Promise<void>;
  runOptimizerNow: () => Promise<void>;
  runScenariosNow: () => Promise<void>;
  saveSettings: (settings: OptimizerSettingsForm) => Promise<void>;
  saveLeagueCalendarSettings: (settings: LeagueCalendarSettings) => Promise<void>;
  saveRosterSettings: (settings: LeagueRosterSettings) => Promise<void>;
  downloadAdpTemplateNow: () => Promise<void>;
  importCompositeAdpNow: () => Promise<void>;
  createUserNow: (form: UserForm) => Promise<void>;
  updateUserNow: (userId: string, form: UserForm) => Promise<void>;
  resetUserPasswordNow: (userId: string, password: string) => Promise<void>;
  deleteUserNow: (userId: string) => Promise<void>;
  createTeamNow: (form: TeamForm) => Promise<void>;
  updateTeamNow: (teamId: string, form: TeamForm) => Promise<void>;
  deleteTeamNow: (teamId: string) => Promise<void>;
  setManualOverrideNow: (
    teamId: string | undefined,
    playerId: string | undefined,
    overrideType: ManualOverrideType,
  ) => Promise<void>;
  exportRecommendations: (format: "xlsx" | "csv" | "pdf", teamId?: string) => void;
  getLeagueMembershipsNow: (leagueId: string) => Promise<LeagueMembership[]>;
  upsertLeagueMemberNow: (leagueId: string, userId: string, role: "league_admin" | "member") => Promise<void>;
  updateLeagueMemberRoleNow: (leagueId: string, userId: string, role: "league_admin" | "member") => Promise<void>;
  removeLeagueMemberNow: (leagueId: string, userId: string) => Promise<void>;
};

const DashboardContext = React.createContext<DashboardContextValue | null>(null);

function useDashboard() {
  const context = React.useContext(DashboardContext);
  if (!context) {
    throw new Error("Dashboard context is not available");
  }
  return context;
}

export function DashboardApp() {
  const [activeView, setActiveView] = React.useState<ViewId>("dashboard");
  const [workspace, setWorkspace] = React.useState<WorkspaceData>(mockWorkspaceData);
  const [apiStatus, setApiStatus] = React.useState<ApiStatus>("loading");
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [authRequired, setAuthRequired] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("Connecting to the API...");
  const [draftCsvText, setDraftCsvText] = React.useState(draftCsvPreview);
  const [rosterCsvText, setRosterCsvText] = React.useState(finalRosterCsvPreview);
  const [adpCsvText, setAdpCsvText] = React.useState(adpCsvPreview);
  const [csvPreviews, setCsvPreviews] = React.useState<Record<CsvImportKind, CsvPreviewResult | null>>({
    "draft-results": null,
    "final-rosters": null,
    adp: null,
  });
  const [settings, setSettings] = React.useState<OptimizerSettingsForm>(mockWorkspaceData.settings);
  const [selectedScenarioByTeam, setSelectedScenarioByTeam] = React.useState<TeamScenarioSelection>(
    {},
  );
  const [tableDisplayResetSignal, setTableDisplayResetSignal] = React.useState(0);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);
  const [activeLeagueId, setActiveLeagueId] = React.useState<string | null>(null);
  const [userLeagues, setUserLeagues] = React.useState<LeagueWithRole[]>([]);
  const [createLeagueModalOpen, setCreateLeagueModalOpen] = React.useState(false);

  const isPlatformAdmin = currentUser?.role === "platform_admin";
  const activeLeagueMembership = userLeagues.find((l) => l.id === activeLeagueId);
  const isLeagueAdmin = isPlatformAdmin || activeLeagueMembership?.leagueRole === "league_admin";
  const isAdmin = isPlatformAdmin;
  const visibleNavItems = React.useMemo(
    () => navItems.filter((item) => !item.adminOnly || isLeagueAdmin),
    [isLeagueAdmin],
  );
  const activeItem = visibleNavItems.find((item) => item.id === activeView) ?? visibleNavItems[0];
  const activeLabel = activeView === "profile" ? "Profile" : activeItem.label;
  const workspaceData = React.useMemo<WorkspaceData>(() => {
    const baseData = { ...workspace, settings };
    const recommendedScenarioByTeam = recommendScenarioSelections(
      baseData.teams,
      baseData.scenarioComparisons,
      baseData.league?.draftType ?? "snake",
    );
    const draftType = baseData.league?.draftType ?? "snake";
    const activeKeeperRecommendations = buildActiveKeeperRecommendations(
      baseData.teams,
      baseData.keeperRecommendations,
      baseData.scenarioComparisons,
      draftType,
      { ...recommendedScenarioByTeam, ...selectedScenarioByTeam },
    );
    const activeTeams = hydrateTeams(baseData.teams, activeKeeperRecommendations, draftType);
    return {
      ...baseData,
      teams: activeTeams,
      keeperRecommendations: activeKeeperRecommendations,
      draftImpact: buildDraftImpact(
        activeTeams,
        activeKeeperRecommendations,
        draftType,
        countDraftRounds(baseData.draftResults, activeKeeperRecommendations),
      ),
      outlooks: buildOutlooks(activeTeams, activeKeeperRecommendations),
    };
  }, [selectedScenarioByTeam, settings, workspace]);

  const setSelectedScenarioForTeam = React.useCallback(
    (teamId: string, scenarioName: ScenarioComparison["scenarioName"] | null) => {
      setSelectedScenarioByTeam((current) => {
        if (!scenarioName) {
          const next = { ...current };
          delete next[teamId];
          return next;
        }
        return { ...current, [teamId]: scenarioName };
      });
      if (workspaceData.source === "api" && workspaceData.league?.id) {
        void saveScenarioSelection(workspaceData.league.id, teamId, scenarioName);
      }
    },
    [workspaceData.league?.id, workspaceData.source],
  );

  React.useEffect(() => {
    setSelectedScenarioByTeam((current) => {
      if (!Object.keys(current).length) {
        return current;
      }
      const validTeamIds = new Set(workspace.teams.map((team) => team.id));
      const validScenarioNames = new Set(
        workspace.scenarioComparisons.map((scenario) => scenario.scenarioName),
      );
      let changed = false;
      const next: TeamScenarioSelection = {};
      Object.entries(current).forEach(([teamId, scenarioName]) => {
        if (validTeamIds.has(teamId) && validScenarioNames.has(scenarioName)) {
          next[teamId] = scenarioName;
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [workspace.scenarioComparisons, workspace.teams]);

  const refreshData = React.useCallback(async (leagueId?: string) => {
    setApiStatus("loading");
    try {
      const [loaded, leagues] = await Promise.all([
        loadWorkspaceData(leagueId),
        listMyLeagues().catch(() => [] as LeagueWithRole[]),
      ]);
      setUserLeagues(leagues);
      if (!loaded) {
        setWorkspace(mockWorkspaceData);
        setSettings(mockWorkspaceData.settings);
        setApiStatus("mock");
        setStatusMessage("No backend league yet; showing mock workspace data.");
        return;
      }
      setWorkspace(loaded);
      setSettings(loaded.settings);
      if (loaded.league?.id) {
        setActiveLeagueId(loaded.league.id);
        const selections = await loadScenarioSelections(loaded.league.id);
        setSelectedScenarioByTeam(selections as TeamScenarioSelection);
      }
      setApiStatus("live");
      setStatusMessage(`Connected to ${loaded.league?.name ?? "backend league"}.`);
    } catch {
      setWorkspace(mockWorkspaceData);
      setSettings(mockWorkspaceData.settings);
      setApiStatus("error");
      setStatusMessage("API unavailable; using mock workspace data.");
    }
  }, []);

  const resetDisplayAndRefresh = React.useCallback(async () => {
    resetDataTableDisplaySettings();
    setTableDisplayResetSignal((current) => current + 1);
    await refreshData();
  }, [refreshData]);

  const switchLeague = React.useCallback(async (leagueId: string) => {
    setActiveLeagueId(leagueId);
    setSelectedScenarioByTeam({});
    setTableDisplayResetSignal((n) => n + 1);
    await refreshData(leagueId);
  }, [refreshData]);

  const createLeagueNow = React.useCallback(async (form: LeagueCreateForm) => {
    setIsBusy(true);
    try {
      const newLeague = await createLeague(form);
      setStatusMessage(`League "${newLeague.name}" created.`);
      await refreshData(newLeague.id);
    } finally {
      setIsBusy(false);
    }
  }, [refreshData]);

  const deleteLeagueNow = React.useCallback(async (leagueId: string) => {
    setIsBusy(true);
    try {
      await deleteLeague(leagueId);
      const remaining = userLeagues.filter((l) => l.id !== leagueId);
      const next = remaining[0];
      setStatusMessage("League deleted.");
      if (next) {
        await refreshData(next.id);
      } else {
        setUserLeagues([]);
        setActiveLeagueId(null);
        setWorkspace(mockWorkspaceData);
        setSettings(mockWorkspaceData.settings);
        setApiStatus("mock");
        setStatusMessage("League deleted. No leagues remaining.");
      }
    } finally {
      setIsBusy(false);
    }
  }, [refreshData, userLeagues]);

  const loginNow = React.useCallback(
    async (email: string, password: string) => {
      setIsBusy(true);
      try {
        const user = await login(email, password);
        setCurrentUser(user);
        setAuthRequired(false);
        await refreshData();
        setStatusMessage(`Signed in as ${user.email}.`);
      } finally {
        setIsBusy(false);
      }
    },
    [refreshData],
  );

  const logoutNow = React.useCallback(async () => {
    setIsBusy(true);
    try {
      await logout();
      setCurrentUser(null);
      setAuthRequired(true);
      setWorkspace(mockWorkspaceData);
      setSettings(mockWorkspaceData.settings);
      setSelectedScenarioByTeam({});
      setStatusMessage("Signed out.");
    } finally {
      setIsBusy(false);
    }
  }, []);

  const updateProfileAvatarNow = React.useCallback(async (avatarDataUrl: string | null) => {
    setIsBusy(true);
    try {
      const user = await updateProfile({ avatarDataUrl });
      setCurrentUser(user);
      setStatusMessage(avatarDataUrl ? "Profile image updated." : "Profile image removed.");
    } catch (error) {
      setApiStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Updating profile image failed.");
      throw error;
    } finally {
      setIsBusy(false);
    }
  }, []);

  const updateLeagueAvatarNow = React.useCallback(async (leagueId: string, avatarDataUrl: string | null) => {
    setIsBusy(true);
    try {
      await uploadLeagueAvatar(leagueId, avatarDataUrl);
      const leagues = await listMyLeagues().catch(() => userLeagues);
      setUserLeagues(leagues);
      setStatusMessage(avatarDataUrl ? "League avatar updated." : "League avatar removed.");
    } catch (error) {
      setApiStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Updating league avatar failed.");
      throw error;
    } finally {
      setIsBusy(false);
    }
  }, [userLeagues]);

  const updateProfileAliasNow = React.useCallback(async (alias: string | null) => {
    setIsBusy(true);
    try {
      const trimmedAlias = alias?.trim() || null;
      const user = await updateProfile({ alias: trimmedAlias });
      setCurrentUser(user);
      await refreshData();
      setStatusMessage(trimmedAlias ? "Owner alias updated." : "Owner alias cleared.");
    } catch (error) {
      setApiStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Updating owner alias failed.");
      throw error;
    } finally {
      setIsBusy(false);
    }
  }, [refreshData]);

  const changePasswordNow = React.useCallback(async (currentPassword: string, newPassword: string) => {
    setIsBusy(true);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      setStatusMessage("Password updated.");
    } catch (error) {
      setApiStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Updating password failed.");
      throw error;
    } finally {
      setIsBusy(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    async function bootstrapAuth() {
      try {
        const user = await getCurrentUser();
        if (!cancelled) {
          setCurrentUser(user);
          setAuthRequired(false);
          setAuthChecked(true);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
          setAuthRequired(true);
          setAuthChecked(true);
          setApiStatus("error");
          setStatusMessage("Sign in to continue.");
        }
      }
    }
    void bootstrapAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!authChecked) {
      return;
    }
    if (authRequired && !currentUser) {
      return;
    }
    void refreshData();
  }, [authChecked, authRequired, currentUser, refreshData]);

  React.useEffect(() => {
    if (!isLeagueAdmin && !isPlatformAdmin && activeView === "admin") {
      setActiveView("dashboard");
    }
  }, [activeView, isLeagueAdmin, isPlatformAdmin]);

  const requireLeagueId = React.useCallback(() => {
    if (workspaceData.source !== "api" || !workspaceData.league?.id) {
      setStatusMessage("Start the API and seed or create a league before sending data.");
      return null;
    }
    return workspaceData.league.id;
  }, [workspaceData.league?.id, workspaceData.source]);

  const previewCsvText = React.useCallback(
    async (kind: CsvImportKind, csvText: string) => {
      const leagueId = requireLeagueId();
      if (!leagueId) {
        return;
      }
      setIsBusy(true);
      try {
        const preview = await previewCsv(leagueId, kind, csvText);
        setCsvPreviews((current) => ({ ...current, [kind]: preview }));
        setApiStatus("live");
        setStatusMessage(
          preview.valid
            ? `Preview ready: ${preview.validRows} row(s) can be imported.`
            : `Preview found ${preview.errorCount} error(s).`,
        );
      } catch {
        setApiStatus("error");
        setStatusMessage("Preview failed. Check the CSV header and API logs.");
      } finally {
        setIsBusy(false);
      }
    },
    [requireLeagueId],
  );

  const importCsvText = React.useCallback(
    async (kind: CsvImportKind, csvText: string) => {
      const leagueId = requireLeagueId();
      if (!leagueId) {
        return;
      }
      setIsBusy(true);
      try {
        await importCsv(leagueId, kind, csvText);
        setCsvPreviews((current) => ({ ...current, [kind]: null }));
        await refreshData();
        setStatusMessage("CSV imported and workspace refreshed.");
      } catch {
        setApiStatus("error");
        setStatusMessage("Import failed. Check the CSV columns and API logs.");
      } finally {
        setIsBusy(false);
      }
    },
    [refreshData, requireLeagueId],
  );

  const runOptimizerNow = React.useCallback(async () => {
    const leagueId = requireLeagueId();
    if (!leagueId) {
      return;
    }
    setIsBusy(true);
    try {
      await saveOptimizerSettings(leagueId, settings);
      await runOptimizer(leagueId);
      await refreshData();
      setStatusMessage("Optimizer settings applied and optimizer run completed.");
    } catch {
      setApiStatus("error");
      setStatusMessage("Optimizer run failed. Confirm draft, roster, and ADP data are loaded.");
    } finally {
      setIsBusy(false);
    }
  }, [refreshData, requireLeagueId, settings]);

  const downloadAdpTemplateNow = React.useCallback(async () => {
    const leagueId = requireLeagueId();
    if (!leagueId) {
      return;
    }
    setIsBusy(true);
    try {
      await downloadAdpTemplate(leagueId);
      setApiStatus("live");
      setStatusMessage("Composite ADP CSV downloaded.");
    } catch {
      setApiStatus("error");
      setStatusMessage("Composite ADP build failed. Check the ADP source connection.");
    } finally {
      setIsBusy(false);
    }
  }, [requireLeagueId]);

  const importCompositeAdpNow = React.useCallback(async () => {
    const leagueId = requireLeagueId();
    if (!leagueId) {
      return;
    }
    setIsBusy(true);
    try {
      await importCompositeAdpSnapshot(leagueId);
      await refreshData();
      setApiStatus("live");
      setStatusMessage("Composite ADP imported into the active snapshot.");
    } catch (error) {
      setApiStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Composite ADP import failed.");
    } finally {
      setIsBusy(false);
    }
  }, [refreshData, requireLeagueId]);

  const createUserNow = React.useCallback(
    async (form: UserForm) => {
      setIsBusy(true);
      try {
        await createAdminUser(form);
        await refreshData();
        setStatusMessage("User created.");
      } catch (error) {
        setApiStatus("error");
        setStatusMessage(error instanceof Error ? error.message : "Creating user failed.");
      } finally {
        setIsBusy(false);
      }
    },
    [refreshData],
  );

  const updateUserNow = React.useCallback(
    async (userId: string, form: UserForm) => {
      setIsBusy(true);
      try {
        await updateAdminUser(userId, form);
        await refreshData();
        setStatusMessage("User updated.");
      } catch (error) {
        setApiStatus("error");
        setStatusMessage(error instanceof Error ? error.message : "Updating user failed.");
      } finally {
        setIsBusy(false);
      }
    },
    [refreshData],
  );

  const resetUserPasswordNow = React.useCallback(
    async (userId: string, password: string) => {
      setIsBusy(true);
      try {
        await resetAdminUserPassword(userId, password);
        setStatusMessage("User password reset.");
      } catch (error) {
        setApiStatus("error");
        setStatusMessage(error instanceof Error ? error.message : "Resetting password failed.");
      } finally {
        setIsBusy(false);
      }
    },
    [],
  );

  const deleteUserNow = React.useCallback(
    async (userId: string) => {
      setIsBusy(true);
      try {
        await deleteAdminUser(userId);
        await refreshData();
        setStatusMessage("User deleted.");
      } catch (error) {
        setApiStatus("error");
        setStatusMessage(error instanceof Error ? error.message : "Deleting user failed.");
      } finally {
        setIsBusy(false);
      }
    },
    [refreshData],
  );

  const createTeamNow = React.useCallback(
    async (form: TeamForm) => {
      const leagueId = requireLeagueId();
      if (!leagueId) {
        return;
      }
      setIsBusy(true);
      try {
        await createTeam(leagueId, form);
        await refreshData();
        setStatusMessage("Team created.");
      } catch {
        setApiStatus("error");
        setStatusMessage("Creating team failed.");
      } finally {
        setIsBusy(false);
      }
    },
    [refreshData, requireLeagueId],
  );

  const updateTeamNow = React.useCallback(
    async (teamId: string, form: TeamForm) => {
      setIsBusy(true);
      try {
        await updateTeam(teamId, form);
        await refreshData();
        setStatusMessage("Team updated.");
      } catch {
        setApiStatus("error");
        setStatusMessage("Updating team failed.");
      } finally {
        setIsBusy(false);
      }
    },
    [refreshData],
  );

  const deleteTeamNow = React.useCallback(
    async (teamId: string) => {
      setIsBusy(true);
      try {
        await deleteTeam(teamId);
        await refreshData();
        setStatusMessage("Team deleted.");
      } catch {
        setApiStatus("error");
        setStatusMessage("Deleting team failed.");
      } finally {
        setIsBusy(false);
      }
    },
    [refreshData],
  );

  const runScenariosNow = React.useCallback(async () => {
    const leagueId = requireLeagueId();
    if (!leagueId) {
      return;
    }
    setIsBusy(true);
    try {
      await saveOptimizerSettings(leagueId, settings);
      const { comparisons: scenarioComparisons, narrative: scenarioNarrative } =
        await runScenarioComparison(leagueId);
      setWorkspace((current) => ({ ...current, scenarioComparisons, scenarioNarrative }));
      setApiStatus("live");
      setStatusMessage("Optimizer settings applied and scenario comparison completed.");
    } catch {
      setApiStatus("error");
      setStatusMessage("Scenario comparison failed. Run the optimizer inputs check first.");
    } finally {
      setIsBusy(false);
    }
  }, [requireLeagueId, settings]);

  const saveSettings = React.useCallback(
    async (nextSettings: OptimizerSettingsForm) => {
      setSettings(nextSettings);
      const leagueId = requireLeagueId();
      if (!leagueId) {
        return;
      }
      setIsBusy(true);
      try {
        await saveOptimizerSettings(leagueId, nextSettings);
        await runOptimizer(leagueId);
        setSelectedScenarioByTeam({});
        await refreshData();
        setStatusMessage("Optimizer settings saved and recommendations reset.");
      } catch {
        setApiStatus("error");
        setStatusMessage("Saving settings failed.");
      } finally {
        setIsBusy(false);
      }
    },
    [refreshData, requireLeagueId],
  );

  const saveLeagueCalendarSettings = React.useCallback(
    async (nextSettings: LeagueCalendarSettings) => {
      const leagueId = requireLeagueId();
      if (!leagueId) {
        return;
      }
      setIsBusy(true);
      try {
        const league = await updateLeagueCalendarSettings(leagueId, nextSettings);
        setWorkspace((current) => ({ ...current, league }));
        setApiStatus("live");
        setStatusMessage("League countdown dates saved.");
      } catch (error) {
        setApiStatus("error");
        setStatusMessage(error instanceof Error ? error.message : "Saving league dates failed.");
      } finally {
        setIsBusy(false);
      }
    },
    [requireLeagueId],
  );

  const saveRosterSettings = React.useCallback(
    async (nextSettings: LeagueRosterSettings) => {
      const leagueId = requireLeagueId();
      if (!leagueId) {
        return;
      }
      setIsBusy(true);
      try {
        await saveLeagueRosterSettings(leagueId, nextSettings);
        await refreshData();
        setStatusMessage("League roster settings saved.");
      } catch {
        setApiStatus("error");
        setStatusMessage("Saving league roster settings failed.");
      } finally {
        setIsBusy(false);
      }
    },
    [refreshData, requireLeagueId],
  );

  const setManualOverrideNow = React.useCallback(
    async (
      teamId: string | undefined,
      playerId: string | undefined,
      overrideType: ManualOverrideType,
    ) => {
      const leagueId = requireLeagueId();
      if (!leagueId || !teamId || !playerId) {
        setStatusMessage("Manual overrides need live API recommendation IDs.");
        return;
      }
      setIsBusy(true);
      try {
        await setManualOverride(leagueId, teamId, playerId, overrideType);
        await runOptimizer(leagueId);
        await refreshData();
        setStatusMessage("Manual override saved; team plan is now Custom.");
      } catch {
        setApiStatus("error");
        setStatusMessage("Manual override failed.");
      } finally {
        setIsBusy(false);
      }
    },
    [refreshData, requireLeagueId],
  );

  const exportRecommendations = React.useCallback(
    (format: "xlsx" | "csv" | "pdf", teamId?: string) => {
      const leagueId = requireLeagueId();
      if (!leagueId) {
        return;
      }
      window.location.href = exportUrl(leagueId, format, teamId);
    },
    [requireLeagueId],
  );

  const getLeagueMembershipsNow = React.useCallback(async (leagueId: string) => {
    return getLeagueMemberships(leagueId);
  }, []);

  const upsertLeagueMemberNow = React.useCallback(async (leagueId: string, userId: string, role: "league_admin" | "member") => {
    await upsertLeagueMembership(leagueId, userId, role);
    const leagues = await listMyLeagues().catch(() => userLeagues);
    setUserLeagues(leagues);
  }, [userLeagues]);

  const updateLeagueMemberRoleNow = React.useCallback(async (leagueId: string, userId: string, role: "league_admin" | "member") => {
    await updateLeagueMemberRole(leagueId, userId, role);
  }, []);

  const removeLeagueMemberNow = React.useCallback(async (leagueId: string, userId: string) => {
    await removeLeagueMember(leagueId, userId);
    const leagues = await listMyLeagues().catch(() => userLeagues);
    setUserLeagues(leagues);
  }, [userLeagues]);

  const contextValue = React.useMemo<DashboardContextValue>(
    () => ({
      data: workspaceData,
      apiStatus,
      currentUser,
      isBusy,
      statusMessage,
      isAdmin,
      isPlatformAdmin,
      isLeagueAdmin,
      activeLeagueId,
      userLeagues,
      activeLeagueMembership,
      selectedScenarioByTeam,
      tableDisplayResetSignal,
      csvPreviews,
      createUserNow,
      updateUserNow,
      resetUserPasswordNow,
      deleteUserNow,
      downloadAdpTemplateNow,
      importCompositeAdpNow,
      createTeamNow,
      updateTeamNow,
      deleteTeamNow,
      refreshData,
      switchLeague,
      createLeagueNow,
      deleteLeagueNow,
      logoutNow,
      resetDisplayAndRefresh,
      updateProfileAvatarNow,
      updateLeagueAvatarNow,
      updateProfileAliasNow,
      changePasswordNow,
      setSelectedScenarioForTeam,
      previewCsvText,
      importCsvText,
      runOptimizerNow,
      runScenariosNow,
      saveLeagueCalendarSettings,
      saveSettings,
      saveRosterSettings,
      setManualOverrideNow,
      exportRecommendations,
      getLeagueMembershipsNow,
      upsertLeagueMemberNow,
      updateLeagueMemberRoleNow,
      removeLeagueMemberNow,
    }),
    [
      activeLeagueId,
      activeLeagueMembership,
      apiStatus,
      changePasswordNow,
      createLeagueNow,
      csvPreviews,
      currentUser,
      createUserNow,
      createTeamNow,
      deleteLeagueNow,
      deleteUserNow,
      deleteTeamNow,
      downloadAdpTemplateNow,
      exportRecommendations,
      getLeagueMembershipsNow,
      importCompositeAdpNow,
      importCsvText,
      isBusy,
      isAdmin,
      isLeagueAdmin,
      isPlatformAdmin,
      logoutNow,
      previewCsvText,
      refreshData,
      removeLeagueMemberNow,
      resetDisplayAndRefresh,
      switchLeague,
      updateLeagueAvatarNow,
      updateLeagueMemberRoleNow,
      updateProfileAvatarNow,
      updateProfileAliasNow,
      upsertLeagueMemberNow,
      userLeagues,
      runOptimizerNow,
      runScenariosNow,
      saveLeagueCalendarSettings,
      saveSettings,
      saveRosterSettings,
      resetUserPasswordNow,
      selectedScenarioByTeam,
      setManualOverrideNow,
      setSelectedScenarioForTeam,
      statusMessage,
      tableDisplayResetSignal,
      updateUserNow,
      updateTeamNow,
      workspaceData,
    ],
  );

  if (!authChecked) {
    return <AuthShell title="Checking session" status="Connecting to the API..." />;
  }

  if (authRequired && !currentUser) {
    return <LoginScreen isBusy={isBusy} onLogin={loginNow} />;
  }

  return (
    <DashboardContext.Provider value={contextValue}>
      <main className="min-h-screen bg-[#f6f5f1] text-zinc-950">
      <div className="grid min-h-screen lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="border-b border-zinc-200 bg-white lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-4">
              <div className="flex size-9 items-center justify-center rounded-md bg-emerald-700 text-white">
                <Trophy className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-5">Mayhem</p>
                <p className="text-xs text-zinc-500">Fantasy Football Tools</p>
              </div>
            </div>

            <nav className="flex gap-2 overflow-x-auto p-3 lg:flex-1 lg:flex-col lg:overflow-visible">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    className={cn(
                      "inline-flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950",
                      isActive && "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200",
                    )}
                    onClick={() => setActiveView(item.id)}
                    type="button"
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="hidden border-t border-zinc-200 p-4 lg:block">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase text-amber-900">Active snapshot</p>
                <p className="mt-1 text-sm text-amber-950">
                  {workspaceData.activeSnapshot?.name ?? "No ADP snapshot"}
                </p>
                <p className="text-xs text-amber-800">
                  {workspaceData.activeSnapshot?.snapshotDate ?? "Import ADP to begin"}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <PanelLeft className="size-5 text-zinc-400 lg:hidden" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-zinc-500">League workspace</p>
                  <h1 className="truncate text-xl font-semibold text-zinc-950">{activeLabel}</h1>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{statusMessage}</p>
                </div>
                <CountdownClock league={workspaceData.league} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ConnectionBadge status={apiStatus} />
                <Button
                  aria-label="Refresh displayed workspace data from the backend without rerunning the optimizer"
                  className="h-auto min-h-12 flex-col items-start gap-0 px-3 py-2 text-left"
                  disabled={isBusy}
                  onClick={resetDisplayAndRefresh}
                  title="Reload displayed workspace data and reset table filters/sorting. This does not rerun the optimizer."
                  variant="outline"
                >
                  <span className="flex items-center gap-2">
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Refresh
                  </span>
                  <span className="text-[11px] font-normal text-zinc-500">Reload display only</span>
                </Button>
                <Button
                  aria-label="Run the optimizer to recompute keeper recommendations from the current inputs and settings"
                  className="h-auto min-h-12 flex-col items-start gap-0 px-3 py-2 text-left"
                  disabled={isBusy}
                  onClick={runOptimizerNow}
                  title="Recompute keeper recommendations from the current rosters, draft results, ADP, overrides, and optimizer settings."
                >
                  <span className="flex items-center gap-2">
                    <Play className="size-4" aria-hidden="true" />
                    Run Optimizer
                  </span>
                  <span className="text-[11px] font-normal text-zinc-300">Recompute recommendations</span>
                </Button>
                {currentUser ? (
                  <div className="relative" ref={userMenuRef}>
                    <button
                      aria-expanded={userMenuOpen}
                      aria-label="Open user menu"
                      className="flex size-12 items-center justify-center overflow-hidden rounded-full border border-zinc-300 bg-zinc-50 text-zinc-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      disabled={isBusy}
                      onClick={() => setUserMenuOpen((open) => !open)}
                      type="button"
                    >
                      <AvatarImage
                        avatarDataUrl={activeLeagueMembership?.avatarDataUrl ?? currentUser.avatarDataUrl}
                        className="size-12"
                        iconClassName="size-7"
                      />
                    </button>
                    {userMenuOpen ? (
                      <div className="absolute right-0 top-14 z-30 w-80 rounded-md border border-zinc-200 bg-white p-2 shadow-lg">
                        <div className="flex items-center gap-3 border-b border-zinc-100 px-2 pb-3 pt-1">
                          <AvatarImage
                            avatarDataUrl={activeLeagueMembership?.avatarDataUrl ?? currentUser.avatarDataUrl}
                            className="size-10"
                            iconClassName="size-6"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-950">{currentUser.email}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {isPlatformAdmin ? (
                                <Badge variant="danger">Platform Admin</Badge>
                              ) : null}
                              {activeLeagueMembership ? (
                                <Badge variant={isLeagueAdmin ? "success" : "info"}>
                                  {isLeagueAdmin ? "League Admin" : "Member"}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {userLeagues.length > 0 ? (
                          <div className="border-b border-zinc-100 py-2">
                            <div className="mb-1 flex items-center justify-between px-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Leagues</span>
                              <button
                                className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs text-emerald-700 hover:bg-emerald-50"
                                onClick={() => {
                                  setUserMenuOpen(false);
                                  setCreateLeagueModalOpen(true);
                                }}
                                title="Create a new league"
                                type="button"
                              >
                                <Plus className="size-3" aria-hidden="true" />
                                New
                              </button>
                            </div>
                            {userLeagues.map((league) => {
                              const isActive = league.id === activeLeagueId;
                              return (
                                <button
                                  key={league.id}
                                  className={cn(
                                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                                    isActive
                                      ? "bg-emerald-50 text-emerald-900"
                                      : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950",
                                  )}
                                  onClick={() => {
                                    if (!isActive) {
                                      setUserMenuOpen(false);
                                      void switchLeague(league.id);
                                    }
                                  }}
                                  type="button"
                                >
                                  <AvatarImage
                                    avatarDataUrl={league.avatarDataUrl}
                                    className="size-7 shrink-0"
                                    iconClassName="size-4"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium leading-tight">
                                      {league.name}
                                      <span className="ml-1 font-normal text-zinc-500">{league.seasonYear}</span>
                                    </p>
                                    <p className="text-[11px] text-zinc-400">
                                      {league.leagueRole === "league_admin" ? "League Admin" : "Member"}
                                    </p>
                                  </div>
                                  {isActive ? (
                                    <span className="size-2 shrink-0 rounded-full bg-emerald-600" aria-label="Active" />
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="border-b border-zinc-100 py-2 px-2">
                            <button
                              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-emerald-700 hover:bg-emerald-50"
                              onClick={() => {
                                setUserMenuOpen(false);
                                setCreateLeagueModalOpen(true);
                              }}
                              type="button"
                            >
                              <Plus className="size-4" aria-hidden="true" />
                              Create your first league
                            </button>
                          </div>
                        )}
                        <button
                          className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
                          onClick={() => {
                            setActiveView("profile");
                            setUserMenuOpen(false);
                          }}
                          type="button"
                        >
                          <UserCircle className="size-4" aria-hidden="true" />
                          View Profile
                        </button>
                        <button
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
                          onClick={() => {
                            setUserMenuOpen(false);
                            void logoutNow();
                          }}
                          type="button"
                        >
                          <LogOut className="size-4" aria-hidden="true" />
                          Logout
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          {createLeagueModalOpen ? (
            <CreateLeagueModal
              isBusy={isBusy}
              onClose={() => setCreateLeagueModalOpen(false)}
              onSubmit={async (form) => {
                await createLeagueNow(form);
                setCreateLeagueModalOpen(false);
              }}
            />
          ) : null}

          <div className="px-4 py-5 md:px-6">
            {activeView === "dashboard" && <LeagueDashboard />}
            {activeView === "guide" && <GuidePage onNavigate={setActiveView} />}
            {activeView === "teams" && <TeamsPage />}
            {activeView === "draft" && <DraftResultsPage />}
            {activeView === "rosters" && <FinalRostersPage />}
            {activeView === "admin" && isLeagueAdmin && (
              <AdminPage
                adpCsvText={adpCsvText}
                draftCsvText={draftCsvText}
                rosterCsvText={rosterCsvText}
                setAdpCsvText={setAdpCsvText}
                setDraftCsvText={setDraftCsvText}
                setRosterCsvText={setRosterCsvText}
              />
            )}
            {activeView === "settings" && (
              <OptimizerSettingsPage settings={settings} setSettings={setSettings} />
            )}
            {activeView === "profile" && <ProfilePage />}
            {activeView === "recommendations" && <KeeperRecommendationsPage />}
            {activeView === "scenarios" && <ScenarioComparisonPage />}
            {activeView === "outlooks" && <TeamOutlooksPage />}
            {activeView === "draft-impact" && <DraftImpactPage />}
            {activeView === "mock-draft" && <MockDraftPage />}
          </div>
        </section>
      </div>
    </main>
    </DashboardContext.Provider>
  );
}

function CountdownClock({ league }: { league: WorkspaceData["league"] }) {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timerId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  const countdown = React.useMemo(() => buildCountdownState(now, league), [league, now]);

  return (
    <div
      className={cn(
        "shrink-0 border-l border-zinc-200 pl-3 text-zinc-950",
        countdown.isDeadlineDay && "text-rose-700",
      )}
    >
      <p className="text-[11px] font-semibold uppercase text-current">
        {countdown.label}
        {countdown.targetDate ? <span className="ml-2">{countdown.targetDate}</span> : null}
      </p>
      <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-normal">
        {countdown.value}
      </p>
    </div>
  );
}

type CountdownState = {
  isDeadlineDay: boolean;
  label: string;
  targetDate: string | null;
  value: string;
};

function buildCountdownState(now: Date, league: WorkspaceData["league"]): CountdownState {
  const today = localDateStart(now);
  const keeperDeadline = parseLocalDate(league?.keeperPickDeadline ?? null);

  if (!keeperDeadline) {
    return {
      isDeadlineDay: false,
      label: "Keeper Deadline",
      targetDate: null,
      value: "Not set",
    };
  }

  if (sameLocalDate(today, keeperDeadline)) {
    return {
      isDeadlineDay: true,
      label: "Keeper Deadline",
      targetDate: formatDisplayDate(keeperDeadline),
      value: "00:00:00:00",
    };
  }

  if (today.getTime() < keeperDeadline.getTime()) {
    return {
      isDeadlineDay: false,
      label: "Keeper Deadline",
      targetDate: formatDisplayDate(keeperDeadline),
      value: formatCountdown(keeperDeadline.getTime() - now.getTime()),
    };
  }

  const regularSeasonStart =
    parseLocalDate(league?.regularSeasonStartDate ?? null) ??
    parseLocalDate(defaultRegularSeasonStartDate(league?.seasonYear));
  if (!regularSeasonStart) {
    return {
      isDeadlineDay: false,
      label: "NFL Kickoff",
      targetDate: null,
      value: "Not set",
    };
  }

  return {
    isDeadlineDay: false,
    label: "NFL Kickoff",
    targetDate: formatDisplayDate(regularSeasonStart),
    value: formatCountdown(Math.max(0, regularSeasonStart.getTime() - now.getTime())),
  };
}

function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [days, hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function formatDisplayDate(date: Date): string {
  return [
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    date.getFullYear(),
  ].join("/");
}

function localDateStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameLocalDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function defaultRegularSeasonStartDate(seasonYear: number | undefined): string {
  if (!seasonYear) {
    return "";
  }
  const septemberFirst = new Date(seasonYear, 8, 1);
  const laborDayOffset = (8 - septemberFirst.getDay()) % 7;
  const laborDay = new Date(seasonYear, 8, 1 + laborDayOffset);
  const kickoff = new Date(seasonYear, 8, laborDay.getDate() + 3);
  return [
    kickoff.getFullYear(),
    String(kickoff.getMonth() + 1).padStart(2, "0"),
    String(kickoff.getDate()).padStart(2, "0"),
  ].join("-");
}

function AuthShell({ status, title }: { status: string; title: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f5f1] px-4 text-zinc-950">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{status}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

function LoginScreen({
  isBusy,
  onLogin,
}: {
  isBusy: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f5f1] px-4 text-zinc-950">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>Use your keeper optimizer account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setError("");
              void onLogin(email, password).catch(() => {
                setError("Invalid email or password.");
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                autoComplete="email"
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                autoComplete="current-password"
                id="password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </div>
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            <Button className="w-full" disabled={isBusy || !email || !password} type="submit">
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function AvatarImage({
  className,
  iconClassName = "size-5",
  user,
  avatarDataUrl,
}: {
  className?: string;
  iconClassName?: string;
  user?: AuthUser | null;
  avatarDataUrl?: string | null;
}) {
  const src = avatarDataUrl ?? user?.avatarDataUrl ?? null;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className={cn("rounded-full object-cover", className)}
        src={src}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex rounded-full bg-zinc-100 text-zinc-500 ring-1 ring-inset ring-zinc-200",
        className,
      )}
    >
      <UserCircle className={cn("m-auto", iconClassName)} aria-hidden="true" />
    </span>
  );
}

function LeagueAvatarRow({
  isBusy,
  league,
  onUpload,
  onRemove,
}: {
  isBusy: boolean;
  league: LeagueWithRole;
  onUpload: (dataUrl: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [error, setError] = React.useState("");
  const [pendingDataUrl, setPendingDataUrl] = React.useState<string | null>(null);
  const [inputKey, setInputKey] = React.useState(0);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      if (reader.result.length > 1_500_000) {
        setError("Image is too large.");
        return;
      }
      setError("");
      setPendingDataUrl(reader.result);
    };
    reader.onerror = () => setError("Could not read image.");
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!pendingDataUrl) return;
    try {
      await onUpload(pendingDataUrl);
      setPendingDataUrl(null);
      setInputKey((k) => k + 1);
    } catch {
      setError("Failed to save league avatar.");
    }
  };

  const handleRemove = async () => {
    setError("");
    setPendingDataUrl(null);
    setInputKey((k) => k + 1);
    try {
      await onRemove();
    } catch {
      setError("Failed to remove.");
    }
  };

  const previewUrl = pendingDataUrl ?? league.avatarDataUrl;

  return (
    <div className="flex items-center gap-4 border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
      <AvatarImage avatarDataUrl={previewUrl} className="size-12 shrink-0" iconClassName="size-7" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-zinc-950">{league.name} <span className="font-normal text-zinc-400">{league.seasonYear}</span></p>
        <div className="mt-2 flex items-center gap-2">
          <Input
            key={inputKey}
            accept="image/*"
            disabled={isBusy}
            onChange={(e) => handleFile(e.target.files?.[0])}
            type="file"
            className="h-8 text-xs"
          />
          {pendingDataUrl ? (
            <Button
              disabled={isBusy}
              onClick={() => { void handleSave(); }}
              size="sm"
              type="button"
            >
              Save
            </Button>
          ) : null}
          {!pendingDataUrl && league.avatarDataUrl ? (
            <Button
              disabled={isBusy}
              onClick={() => { void handleRemove(); }}
              size="sm"
              type="button"
              variant="outline"
            >
              <X className="size-3.5" aria-hidden="true" />
              Remove
            </Button>
          ) : null}
        </div>
        {error ? <p className="mt-1 text-xs text-rose-700">{error}</p> : null}
      </div>
    </div>
  );
}

function CreateLeagueModal({
  isBusy,
  onClose,
  onSubmit,
}: {
  isBusy: boolean;
  onClose: () => void;
  onSubmit: (form: LeagueCreateForm) => Promise<void>;
}) {
  const currentYear = new Date().getFullYear();
  const [name, setName] = React.useState("");
  const [seasonYear, setSeasonYear] = React.useState(currentYear);
  const [scoringFormat, setScoringFormat] = React.useState("superflex");
  const [draftType, setDraftType] = React.useState("snake");
  const [error, setError] = React.useState("");
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-950">Create League</h2>
          <button
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <Label htmlFor="cl-name">League Name</Label>
            <Input
              id="cl-name"
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maryland Mayhem"
            />
          </div>
          <div>
            <Label htmlFor="cl-year">Season Year</Label>
            <Input
              id="cl-year"
              className="mt-1"
              type="number"
              value={seasonYear}
              onChange={(e) => setSeasonYear(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="cl-scoring">Scoring Format</Label>
            <select
              id="cl-scoring"
              className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              value={scoringFormat}
              onChange={(e) => setScoringFormat(e.target.value)}
            >
              <option value="superflex">Superflex</option>
              <option value="standard">Standard</option>
              <option value="half_ppr">Half PPR</option>
              <option value="ppr">PPR</option>
            </select>
          </div>
          <div>
            <Label htmlFor="cl-draft">Draft Type</Label>
            <select
              id="cl-draft"
              className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              value={draftType}
              onChange={(e) => setDraftType(e.target.value)}
            >
              <option value="snake">Snake</option>
              <option value="auction">Auction</option>
            </select>
          </div>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            disabled={isBusy || !name.trim()}
            onClick={async () => {
              setError("");
              try {
                await onSubmit({ name: name.trim(), seasonYear, scoringFormat, draftType });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to create league.");
              }
            }}
          >
            Create League
          </Button>
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
}

function ProfilePage() {
  const { changePasswordNow, currentUser, isBusy, updateLeagueAvatarNow, updateProfileAliasNow, updateProfileAvatarNow, userLeagues } = useDashboard();
  const [error, setError] = React.useState("");
  const [aliasError, setAliasError] = React.useState("");
  const [aliasSaved, setAliasSaved] = React.useState(false);
  const [alias, setAlias] = React.useState(currentUser?.alias ?? "");
  const [passwordError, setPasswordError] = React.useState("");
  const [passwordSaved, setPasswordSaved] = React.useState(false);
  const [passwordForm, setPasswordForm] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  React.useEffect(() => {
    setAlias(currentUser?.alias ?? "");
    setAliasSaved(false);
    setAliasError("");
  }, [currentUser?.alias]);

  if (!currentUser) {
    return null;
  }

  const passwordMismatch =
    passwordForm.confirmPassword.length > 0 &&
    passwordForm.newPassword !== passwordForm.confirmPassword;
  const canSavePassword =
    Boolean(passwordForm.currentPassword) &&
    Boolean(passwordForm.newPassword) &&
    passwordForm.newPassword === passwordForm.confirmPassword;

  const uploadAvatar = (file: File | undefined) => {
    if (!file) {
      return;
    }
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    if (file.size > 1_000_000) {
      setError("Choose an image smaller than 1 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("The selected image could not be read.");
        return;
      }
      void updateProfileAvatarNow(reader.result).catch(() => {
        setError("The profile image could not be saved.");
      });
    };
    reader.onerror = () => setError("The selected image could not be read.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage the image shown in the top-right user menu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <AvatarImage user={currentUser} className="size-24" iconClassName="size-14" />
            <div className="min-w-0 space-y-1">
              <p className="truncate text-base font-semibold text-zinc-950">{currentUser.email}</p>
              <div>
                <Badge variant={currentUser.role === "platform_admin" ? "success" : "info"}>
                  {currentUser.role}
                </Badge>
              </div>
              <p className="text-sm text-zinc-600">
                Assigned team:{" "}
                {currentUser.teamName ? (
                  <span className="font-medium text-zinc-950">{currentUser.teamName}</span>
                ) : (
                  <span>Not assigned</span>
                )}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="avatar-upload">Avatar image</Label>
              <Input
                accept="image/*"
                disabled={isBusy}
                id="avatar-upload"
                onChange={(event) => uploadAvatar(event.target.files?.[0])}
                type="file"
              />
            </div>
            {currentUser.avatarDataUrl ? (
              <Button
                disabled={isBusy}
                onClick={() => {
                  setError("");
                  void updateProfileAvatarNow(null).catch(() => {
                    setError("The profile image could not be removed.");
                  });
                }}
                type="button"
                variant="outline"
              >
                <X className="size-4" aria-hidden="true" />
                Remove
              </Button>
            ) : null}
          </div>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <form
            className="grid gap-3 border-t border-zinc-200 pt-5 sm:grid-cols-[1fr_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setAliasError("");
              setAliasSaved(false);
              void updateProfileAliasNow(alias)
                .then(() => setAliasSaved(true))
                .catch(() => setAliasError("The owner alias could not be saved."));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="profile-alias">Owner alias</Label>
              <Input
                disabled={isBusy}
                id="profile-alias"
                maxLength={120}
                onChange={(event) => {
                  setAlias(event.target.value);
                  setAliasSaved(false);
                }}
                placeholder="Display name for assigned team ownership"
                value={alias}
              />
              <p className="text-xs text-zinc-500">
                Teams assigned to this account show this value as the owner name.
              </p>
            </div>
            <Button disabled={isBusy || alias.trim() === (currentUser.alias ?? "")} type="submit">
              <Save className="size-4" aria-hidden="true" />
              Save Alias
            </Button>
            {aliasError ? <p className="text-sm text-rose-700 sm:col-span-2">{aliasError}</p> : null}
            {aliasSaved ? <p className="text-sm text-emerald-700 sm:col-span-2">Owner alias saved.</p> : null}
          </form>
        </CardContent>
      </Card>

      {userLeagues.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>League Avatars</CardTitle>
            <CardDescription>Upload a different profile image for each league you belong to.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {userLeagues.map((league) => (
              <LeagueAvatarRow
                key={league.id}
                isBusy={isBusy}
                league={league}
                onUpload={async (dataUrl) => { await updateLeagueAvatarNow(league.id, dataUrl); }}
                onRemove={async () => { await updateLeagueAvatarNow(league.id, null); }}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Update the password for this account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setPasswordError("");
              setPasswordSaved(false);
              if (!canSavePassword) {
                setPasswordError("Enter your current password and matching new passwords.");
                return;
              }
              void changePasswordNow(passwordForm.currentPassword, passwordForm.newPassword)
                .then(() => {
                  setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                  setPasswordSaved(true);
                })
                .catch(() => {
                  setPasswordError("The password could not be updated.");
                });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                autoComplete="current-password"
                disabled={isBusy}
                id="current-password"
                onChange={(event) => {
                  setPasswordSaved(false);
                  setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }));
                }}
                type="password"
                value={passwordForm.currentPassword}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  autoComplete="new-password"
                  disabled={isBusy}
                  id="new-password"
                  onChange={(event) => {
                    setPasswordSaved(false);
                    setPasswordForm((current) => ({ ...current, newPassword: event.target.value }));
                  }}
                  type="password"
                  value={passwordForm.newPassword}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  autoComplete="new-password"
                  disabled={isBusy}
                  id="confirm-password"
                  onChange={(event) => {
                    setPasswordSaved(false);
                    setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }));
                  }}
                  type="password"
                  value={passwordForm.confirmPassword}
                />
              </div>
            </div>
            {passwordMismatch ? <p className="text-sm text-rose-700">New passwords do not match.</p> : null}
            {passwordError ? <p className="text-sm text-rose-700">{passwordError}</p> : null}
            {passwordSaved ? <p className="text-sm text-emerald-700">Password updated.</p> : null}
            <Button disabled={isBusy || !canSavePassword} type="submit">
              <KeyRound className="size-4" aria-hidden="true" />
              Save Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function LeagueDashboard() {
  const { currentUser, data } = useDashboard();
  const recommendedKeepers = data.keeperRecommendations.filter(
    (recommendation) => recommendation.status === "Recommended",
  );
  const eligibleKeepers = data.keeperRecommendations.filter(
    (recommendation) => recommendation.status === "Eligible",
  );
  const recommendedCount = recommendedKeepers.length;
  const premiumPicksCommitted = recommendedKeepers.filter(
    (recommendation) => recommendation.keeperCostPick <= 48,
  ).length;
  const qbKeepers = recommendedKeepers.filter(
    (recommendation) => recommendation.position === "QB",
  ).length;
  const manualOverrideCount = data.keeperRecommendations.filter(
    (recommendation) =>
      recommendation.manualOverride === "exclude" ||
      recommendation.manualOverride === "force_keep",
  ).length;
  const earlyRoundTeams = new Set(
    recommendedKeepers
      .filter((recommendation) => recommendation.keeperCostPick <= 24)
      .map((recommendation) => recommendation.team),
  );
  const positionCounts = recommendedKeepers.reduce<Record<string, number>>((counts, recommendation) => {
    counts[recommendation.position] = (counts[recommendation.position] ?? 0) + 1;
    return counts;
  }, {});
  const [mostCommonKeeperPosition = "None", mostCommonKeeperCount = 0] = Object.entries(positionCounts).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  )[0] ?? [];
  const averageKeepersPerTeam = data.teams.length ? recommendedCount / data.teams.length : 0;
  const topValues = recommendedKeepers
    .slice()
    .sort(
      (left, right) =>
        right.keeperValue - left.keeperValue || right.keeperScore - left.keeperScore,
    )
    .slice(0, 5)
    .map<DashboardDecision>((recommendation) => ({
      detail: `${formatKeeperCost(recommendation, data.teams.length)} cost vs ${recommendation.adpPick} ADP`,
      note: `${formatter.format(recommendation.keeperScore)} score`,
      team: recommendation.team,
      title: `${recommendation.player} (${recommendation.position})`,
      variant: "success",
    }));
  const borderlineCalls = [...eligibleKeepers, ...recommendedKeepers]
    .filter((recommendation) => Math.abs(recommendation.keeperValue) <= 12)
    .slice()
    .sort(
      (left, right) =>
        Math.abs(left.keeperValue) - Math.abs(right.keeperValue) ||
        Math.abs(left.keeperScore) - Math.abs(right.keeperScore),
    )
    .slice(0, 5)
    .map<DashboardDecision>((recommendation) => ({
      detail: `${recommendation.status} at ${formatKeeperCost(recommendation, data.teams.length)}. ${recommendation.reason}`,
      note: recommendation.status,
      team: recommendation.team,
      title: `${recommendation.player} (${recommendation.position})`,
      variant: recommendation.status === "Recommended" ? "warning" : "info",
    }));
  const expensiveKeeps = recommendedKeepers
    .filter(
      (recommendation) =>
        recommendation.keeperCostPick <= 48 || recommendation.keeperValue <= 8,
    )
    .slice()
    .sort(
      (left, right) =>
        left.keeperCostPick - right.keeperCostPick || left.keeperValue - right.keeperValue,
    )
    .slice(0, 5)
    .map<DashboardDecision>((recommendation) => ({
      detail: `${formatKeeperCost(recommendation, data.teams.length)} cost with +${recommendation.keeperValue} value. ${recommendation.reason}`,
      note: `+${recommendation.keeperValue} value`,
      team: recommendation.team,
      title: `${recommendation.player} (${recommendation.position})`,
      variant: "warning",
    }));
  const reviewCandidates = data.teams
    .map((team) => {
      const teamRecommendations = data.keeperRecommendations.filter(
        (recommendation) => recommendation.team === team.name,
      );
      const selected = teamRecommendations.filter(
        (recommendation) => recommendation.status === "Recommended",
      );
      const manualOverrides = teamRecommendations.filter(
        (recommendation) =>
          recommendation.manualOverride === "exclude" ||
          recommendation.manualOverride === "force_keep",
      );
      const reviewReasons: string[] = [];
      if (!selected.length) {
        reviewReasons.push("No keepers selected");
      }
      if (selected.some((recommendation) => recommendation.keeperCostPick <= 24)) {
        reviewReasons.push("Early pick forfeited");
      }
      if (teamRecommendations.some((recommendation) => recommendation.status === "Eligible")) {
        reviewReasons.push("Alternative keepers available");
      }
      if (manualOverrides.length) {
        reviewReasons.push("Manual override active");
      }
      return reviewReasons.length
        ? { reasons: reviewReasons.join(" • "), teamName: team.name }
        : null;
    })
    .filter((team): team is { reasons: string; teamName: string } => Boolean(team));
  const teamsNeedingReview = reviewCandidates.slice(0, 5);
  const bestKeeperValue = recommendedKeepers
    .slice()
    .sort(
      (left, right) =>
        right.keeperValue - left.keeperValue || right.keeperScore - left.keeperScore,
    )[0];
  const outlooksByTeam = new Map(
    data.outlooks.map((outlook) => [outlook.teamId ?? outlook.team, outlook] as const),
  );
  const teamSnapshots = data.teams
    .slice()
    .sort((left, right) => {
      const leftReview = teamsNeedingReview.some((team) => team.teamName === left.name) ? 0 : 1;
      const rightReview = teamsNeedingReview.some((team) => team.teamName === right.name) ? 0 : 1;
      return leftReview - rightReview || right.projectedScore - left.projectedScore;
    })
    .map((team) => ({
      outlook: outlooksByTeam.get(team.id) ?? outlooksByTeam.get(team.name),
      review: teamsNeedingReview.find((review) => review.teamName === team.name),
      team,
    }));
  const leagueOutlookHeadline =
    !recommendedCount
      ? "No clear keeper core has emerged yet"
      : averageKeepersPerTeam >= 3
        ? "Most teams are carrying a heavy keeper core"
        : averageKeepersPerTeam >= 2
          ? "Most teams have a manageable 2 to 3 keeper core"
          : "Most teams have only a light keeper pool";
  const leagueOutlookDetail = !recommendedCount
    ? "Run the optimizer after loading ADP and rosters to generate league-wide keeper guidance."
    : `${recommendedCount} projected keepers across ${data.teams.length} teams, with ${reviewCandidates.length} teams worth a closer review.`;
  const bestKeeperValueHeadline = bestKeeperValue
    ? `${bestKeeperValue.player} (${bestKeeperValue.team})`
    : "No recommended keepers yet";
  const bestKeeperValueDetail = bestKeeperValue
    ? `Costs ${formatKeeperCost(bestKeeperValue, data.teams.length)} against ${bestKeeperValue.adpPick} ADP for +${bestKeeperValue.keeperValue} keeper value.`
    : "The strongest league-wide keeper edge will appear here after an optimizer run.";
  const mainRiskHeadline = earlyRoundTeams.size
    ? `${earlyRoundTeams.size} teams are spending a top-24 pick`
    : reviewCandidates.length
      ? `${reviewCandidates.length} teams have keeper decisions to review`
      : manualOverrideCount
        ? `${manualOverrideCount} manual override${manualOverrideCount === 1 ? "" : "s"} active`
        : "No major league-wide risk flags";
  const mainRiskDetail = earlyRoundTeams.size
    ? `${premiumPicksCommitted} projected keepers cost a top-48 pick, so early draft flexibility is already thinning out.`
    : reviewCandidates.length
      ? "These teams have alternative keeper paths, no selected keepers, or other inputs worth a second look."
      : manualOverrideCount
        ? "Manual overrides are influencing the final recommendations and should be reviewed before locking decisions."
        : "The current keeper set is relatively stable under the active settings.";
  const draftBoardShapeHeadline = recommendedCount
    ? `${mostCommonKeeperPosition} is the most common keeper position`
    : "Draft board shape is not available yet";
  const draftBoardShapeDetail = recommendedCount
    ? `${mostCommonKeeperCount} ${mostCommonKeeperPosition} keepers are projected, with ${qbKeepers} quarterback keepers and ${premiumPicksCommitted} top-48 picks already committed.`
    : "Once keepers are selected, this will summarize how the board is shifting.";

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          accent="emerald"
          detail={leagueOutlookDetail}
          label="League Keeper Outlook"
          value={leagueOutlookHeadline}
        />
        <MetricTile
          accent="sky"
          detail={bestKeeperValueDetail}
          label="Best Keeper Value"
          value={bestKeeperValueHeadline}
        />
        <MetricTile
          accent="rose"
          detail={mainRiskDetail}
          label="Main Risk"
          value={mainRiskHeadline}
        />
        <MetricTile
          accent="amber"
          detail={draftBoardShapeDetail}
          label="Draft Board Shape"
          value={draftBoardShapeHeadline}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>League Briefing</CardTitle>
              <CardDescription>Fantasy football headlines that could change keeper decisions.</CardDescription>
            </div>
            <Badge variant="info">Daily headlines</Badge>
          </CardHeader>
          <CardContent>
            <DashboardNewsList items={data.leagueNews} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model Status</CardTitle>
            <CardDescription>Input freshness and the settings currently driving the answer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricStrip label="ADP Source" value={data.activeSnapshot?.source ?? "Not loaded"} />
              <MetricStrip label="Snapshot Date" value={data.activeSnapshot?.snapshotDate ?? "Not loaded"} />
              <MetricStrip label="Min Keeper Value" value={String(data.settings.minimumKeeperValue)} />
              <MetricStrip label="ADP Rows" value={data.adpEntries.length.toString()} />
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-950">What this means</p>
              <p className="mt-2 text-sm leading-6 text-zinc-700">
                The dashboard is strongest when the ADP snapshot is current and the keeper floor
                matches your league&apos;s appetite for risk. If the recommendations look too loose or
                too strict, review the minimum keeper value and rerun the optimizer.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Keeper Decisions</CardTitle>
          <CardDescription>
            The clearest values, the closest calls, and the keeps that cost the most draft capital.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-3">
          <DashboardDecisionList
            emptyText="No recommended keepers yet."
            items={topValues}
            title="Strongest values"
          />
          <DashboardDecisionList
            emptyText="No borderline keeper calls right now."
            items={borderlineCalls}
            title="Borderline calls"
          />
          <DashboardDecisionList
            emptyText="No expensive keeps are standing out."
            items={expensiveKeeps}
            title="Expensive keeps"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Snapshot</CardTitle>
          <CardDescription>
            A simpler team-by-team view of recommended keepers, draft pressure, and review flags.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-3">
          {teamSnapshots.map(({ outlook, review, team }) => (
            <DashboardTeamSnapshotCard
              key={team.id}
              currentUser={currentUser}
              outlook={outlook}
              review={review?.reasons}
              team={team}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Draft Capital Overview</CardTitle>
          <CardDescription>
            Remaining top-100 access after keeper costs, with plain-language pressure levels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.teams
            .slice()
            .sort((left, right) => right.remainingTop100Picks - left.remainingTop100Picks)
            .map((team) => (
              <div key={team.id}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <TeamNameMark
                      className="text-sm font-medium text-zinc-900"
                      name={team.name}
                      teamId={team.id}
                      user={currentUser}
                    />
                    <p className="text-xs text-zinc-500">
                      {draftCapitalLabel(team.remainingTop100Picks)}
                    </p>
                  </div>
                  <span className="text-sm text-zinc-500">{team.remainingTop100Picks} picks</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{ width: `${Math.min(team.remainingTop100Picks * 10, 100)}%` }}
                  />
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function GuidePage({ onNavigate }: { onNavigate: (view: ViewId) => void }) {
  const { isAdmin, isLeagueAdmin } = useDashboard();
  const visibleScreenGuides = React.useMemo(
    () => screenGuides.filter((guide) => !guide.adminOnly || isAdmin || isLeagueAdmin),
    [isAdmin, isLeagueAdmin],
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle>How to Use the Keeper Optimizer</CardTitle>
            <CardDescription>
              A plain-language guide to the workflow, controls, screens, scores, and keeper terms.
            </CardDescription>
          </div>
          <Button onClick={() => onNavigate("recommendations")}>
            <Trophy className="size-4" aria-hidden="true" />
            View Recommendations
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(340px,0.58fr)]">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-950">The short version</p>
            <p className="mt-2 text-sm leading-6 text-emerald-950">
              The app compares what a player costs to keep against what that player is worth in
              the current draft market. The best keepers usually give you strong players at
              cheaper-than-market prices, while still protecting enough draft picks to build the
              rest of the roster.
            </p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-semibold text-zinc-950">How the pieces fit</p>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-zinc-700">
              <li>Teams, draft results, final rosters, and ADP are the source inputs.</li>
              <li>Optimizer settings and manual overrides shape the calculation.</li>
              <li>Recommendations feed scenarios, draft impact, outlooks, and exports.</li>
              <li>Refresh reloads displayed data; Run Optimizer recalculates results.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommended Workflow</CardTitle>
          <CardDescription>
            Follow this order when setting up data, rerunning recommendations, or preparing reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 lg:grid-cols-2">
            {workflowSteps.map((step, index) => (
              <WorkflowStepItem
                index={index}
                key={step.title}
                onNavigate={onNavigate}
                step={step}
              />
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Controls That Change Results</CardTitle>
          <CardDescription>
            Use these buttons intentionally; some reload the display, while others recalculate the model.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {controlGuides.map((control) => {
            const Icon = control.icon;
            return (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4" key={control.title}>
                <div className="flex items-center gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white text-zinc-700 ring-1 ring-zinc-200">
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-950">{control.title}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{control.text}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Screen-by-Screen Guide</h2>
          <p className="mt-1 text-sm text-zinc-600">
            What each screen is for, how to read it, and what to double-check.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleScreenGuides.map((guide) => {
            const Icon = guide.icon;
            return (
              <Card key={guide.title}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
                      <Icon className="size-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{guide.title}</CardTitle>
                      <CardDescription>{guide.bestFor}</CardDescription>
                    </div>
                  </div>
                  <Button onClick={() => onNavigate(guide.view)} size="sm" variant="outline">
                    Open
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoLine label="How to read it" value={guide.howToRead} />
                  <InfoLine label="Watch for" value={guide.watchFor} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.6fr)]">
        <Card>
          <CardHeader>
            <CardTitle>How to Read the Scores</CardTitle>
            <CardDescription>
              Scores are built to support keeper decisions, not to predict fantasy points.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-950">Keeper Score formula</p>
              <p className="mt-2 text-sm leading-6 text-zinc-700">
                Keeper Score = Keeper Value x Position Weight + Talent Bonus + Status Bonus +
                Draft Slot Bonus + QB Scarcity Bonus + Elite Anchor Bonus - Risk Penalty.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <ScoreHelpTile
                label="Higher score"
                text="Usually a stronger keeper option under the current settings."
              />
              <ScoreHelpTile
                label="Negative value"
                text="The player costs earlier than market price, so the model needs a strong reason to keep him."
              />
              <ScoreHelpTile
                label="Total score"
                text="The combined score of selected keepers. Compare it with picks forfeited."
              />
            </div>
            <p className="text-sm leading-6 text-zinc-600">
              The score is only as good as the inputs. If ADP is stale, a roster is wrong, or a
              league has special keeper rules, update the data or use manual overrides before
              treating the recommendation as final.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scenario Presets</CardTitle>
            <CardDescription>Use presets to see how strategy changes the answer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScenarioHelpLine label="Pure Value" text="Prioritizes pick savings and avoids expensive keepers." />
            <ScenarioHelpLine label="Balanced" text="The default blend of value, talent, status, and roster context." />
            <ScenarioHelpLine label="Superflex Heavy" text="Gives more credit to quarterbacks in superflex formats." />
            <ScenarioHelpLine label="Win Now" text="Accepts more cost for elite starters and lineup ceiling." />
            <ScenarioHelpLine label="Rebuild" text="Keeps only stronger value plays and protects draft flexibility." />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Glossary</CardTitle>
          <CardDescription>
            Common terms used in the tables, exports, and team outlooks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {glossaryTerms.map((item) => (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4" key={item.term}>
                <dt className="text-sm font-semibold text-zinc-950">{item.term}</dt>
                <dd className="mt-2 text-sm leading-6 text-zinc-600">{item.meaning}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function WorkflowStepItem({
  index,
  onNavigate,
  step,
}: {
  index: number;
  onNavigate: (view: ViewId) => void;
  step: WorkflowStep;
}) {
  const view = step.view;

  return (
    <li className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-zinc-500">Step {index + 1}</p>
          <p className="mt-1 text-sm font-semibold text-zinc-950">{step.title}</p>
        </div>
        {view ? (
          <Button onClick={() => onNavigate(view)} size="sm" type="button" variant="outline">
            Open
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{step.text}</p>
    </li>
  );
}

function TeamsPage() {
  const { currentUser, data, tableDisplayResetSignal } = useDashboard();
  const columns = React.useMemo<ColumnDef<Team>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Team",
        cell: ({ row }) => <TeamNameMark name={row.original.name} teamId={row.original.id} user={currentUser} />,
      },
      { accessorKey: "owner", header: "Owner" },
      { accessorKey: "draftSlot", header: "Draft Slot" },
      {
        accessorKey: "keepers",
        header: "Keepers",
        cell: ({ getValue }) => <Badge variant="info">{getValue<number>()}/4</Badge>,
      },
      {
        accessorKey: "projectedScore",
        header: "Projected Keeper Score",
        cell: ({ getValue }) => formatter.format(getValue<number>()),
      },
      { accessorKey: "remainingTop100Picks", header: "Top-100 Picks" },
    ],
    [currentUser],
  );

  return (
    <PagePanel
      title="Teams"
      description="Draft slots, keeper counts, and remaining draft capital."
    >
      <DataTable
        columns={columns}
        data={data.teams}
        resetSignal={tableDisplayResetSignal}
        tableId="teams"
        teamFilter={{ columnId: "name" }}
      />
    </PagePanel>
  );
}

function DraftResultsPage() {
  const { currentUser, data, tableDisplayResetSignal } = useDashboard();
  const columns = React.useMemo<ColumnDef<DraftPick>[]>(
    () => [
      {
        accessorKey: "team",
        header: "Team",
        cell: ({ getValue }) => <TeamNameMark name={getValue<string>()} user={currentUser} />,
      },
      { accessorKey: "round", header: "Round" },
      { accessorKey: "overallPick", header: "Pick" },
      { accessorKey: "player", header: "Player" },
      {
        accessorKey: "position",
        header: "Pos",
        cell: ({ getValue }) => <PositionBadge position={getValue<string>()} />,
      },
      { accessorKey: "keeperCost", header: "Keeper Cost" },
    ],
    [currentUser],
  );

  return (
    <PagePanel title="Draft Results" description="Imported draft picks by round and overall pick.">
      <DataTable
        columns={columns}
        data={data.draftResults}
        resetSignal={tableDisplayResetSignal}
        tableId="draft-results"
        teamFilter={{ columnId: "team" }}
      />
    </PagePanel>
  );
}

function FinalRostersPage() {
  const { currentUser, data, tableDisplayResetSignal } = useDashboard();
  const columns = React.useMemo<ColumnDef<FinalRosterEntry>[]>(
    () => [
      {
        accessorKey: "team",
        header: "Team",
        cell: ({ getValue }) => <TeamNameMark name={getValue<string>()} user={currentUser} />,
      },
      { accessorKey: "scenario", header: "Scenario" },
      { accessorKey: "player", header: "Player" },
      {
        accessorKey: "position",
        header: "Pos",
        cell: ({ getValue }) => <PositionBadge position={getValue<string>()} />,
      },
      {
        accessorKey: "rosterStatus",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
      },
      { accessorKey: "acquiredVia", header: "Acquired Via" },
    ],
    [currentUser],
  );

  return (
    <PagePanel title="Final Rosters" description="Current keeper candidate pool by team.">
      <DataTable
        columns={columns}
        data={data.finalRosters}
        resetSignal={tableDisplayResetSignal}
        tableId="final-rosters"
        teamFilter={{ columnId: "team" }}
      />
    </PagePanel>
  );
}

function AdminPage({
  adpCsvText,
  draftCsvText,
  rosterCsvText,
  setAdpCsvText,
  setDraftCsvText,
  setRosterCsvText,
}: {
  adpCsvText: string;
  draftCsvText: string;
  rosterCsvText: string;
  setAdpCsvText: (value: string) => void;
  setDraftCsvText: (value: string) => void;
  setRosterCsvText: (value: string) => void;
}) {
  const { isLeagueAdmin, isPlatformAdmin } = useDashboard();
  return (
    <div className="space-y-5">
      {isLeagueAdmin ? (
        <>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white">
              <CalendarDays className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-950">League Dates</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Set the keeper deadline and NFL regular season start date.
              </p>
            </div>
          </div>
          <LeagueCalendarSettingsPanel />

          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white">
              <Users className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-950">League Management</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Add, edit, delete, and assign teams to application users.
              </p>
            </div>
          </div>
          <LeagueManagementPanel />

          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white">
              <SlidersHorizontal className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-950">League Settings</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Configure roster slots, bench limits, and draftable position caps.
              </p>
            </div>
          </div>
          <LeagueRosterSettingsPanel />

          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white">
              <Upload className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-950">League Data Imports</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Upload draft results and final rosters used by the optimizer.
              </p>
            </div>
          </div>
          <AdminDataImports
            draftCsvText={draftCsvText}
            rosterCsvText={rosterCsvText}
            setDraftCsvText={setDraftCsvText}
            setRosterCsvText={setRosterCsvText}
          />

          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white">
              <CalendarDays className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-950">ADP Input</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Build, import, and review the league&apos;s active market snapshot.
              </p>
            </div>
          </div>
          <ADPInputPage csvText={adpCsvText} setCsvText={setAdpCsvText} />

          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white">
              <Users className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-950">League Members</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Add or remove members and manage their league roles.
              </p>
            </div>
          </div>
          <LeagueMembersPanel />

          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-rose-700 text-white">
              <Trash2 className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-950">Danger Zone</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Permanently delete this league and all associated data.
              </p>
            </div>
          </div>
          <DeleteLeaguePanel />
        </>
      ) : null}

      {isPlatformAdmin ? (
        <>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white">
              <Users className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-950">User Management</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Create accounts, reset passwords, and assign teams.
              </p>
            </div>
          </div>
          <UserManagementPanel />

          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white">
              <Bot className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-950">AI Usage</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Token consumption, request counts, and active feature flags for the current month.
              </p>
            </div>
          </div>
          <AIUsagePanel />
        </>
      ) : null}
    </div>
  );
}

function LeagueMembersPanel() {
  const { activeLeagueId, currentUser, getLeagueMembershipsNow, isBusy, isPlatformAdmin, isLeagueAdmin, removeLeagueMemberNow, updateLeagueMemberRoleNow, upsertLeagueMemberNow } = useDashboard();
  const [members, setMembers] = React.useState<LeagueMembership[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [allUsers, setAllUsers] = React.useState<AdminUser[]>([]);
  const [addUserId, setAddUserId] = React.useState("");
  const [addRole, setAddRole] = React.useState<"league_admin" | "member">("member");

  const leagueId = activeLeagueId ?? "";

  React.useEffect(() => {
    if (!leagueId) return;
    setLoading(true);
    getLeagueMembershipsNow(leagueId)
      .then(setMembers)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load members."))
      .finally(() => setLoading(false));
  }, [leagueId, getLeagueMembershipsNow]);

  const loadMembers = React.useCallback(async () => {
    if (!leagueId) return;
    try {
      setMembers(await getLeagueMembershipsNow(leagueId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reload members.");
    }
  }, [leagueId, getLeagueMembershipsNow]);

  const adminCount = members.filter((m) => m.role === "league_admin").length;

  if (!leagueId) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>League Members</CardTitle>
          {isPlatformAdmin || isLeagueAdmin ? (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const { listAdminUsers: loadUsers } = await import("@/lib/api");
                  const users = await loadUsers();
                  setAllUsers(users);
                } catch {
                  setAllUsers([]);
                }
                setAddUserId("");
                setAddRole("member");
                setAddModalOpen(true);
              }}
            >
              <Plus className="size-4 mr-1" aria-hidden="true" />
              Add Member
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {error ? <p className="mb-3 text-sm text-rose-700">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-zinc-500">Loading members...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="pb-2 pr-4">User</th>
                  <th className="pb-2 pr-4">Role</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {members.map((member) => {
                  const isLastAdmin = member.role === "league_admin" && adminCount <= 1;
                  const isSelf = currentUser?.id === member.userId;
                  return (
                    <tr key={member.id} className="py-2">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <AvatarImage avatarDataUrl={member.avatarDataUrl} className="size-7" iconClassName="size-4" />
                          <div>
                            <p className="font-medium text-zinc-900">{member.alias ?? member.email}</p>
                            {member.alias ? <p className="text-xs text-zinc-400">{member.email}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant={member.role === "league_admin" ? "success" : "info"}>
                          {member.role === "league_admin" ? "League Admin" : "Member"}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          {member.role === "member" ? (
                            <button
                              className="text-xs text-emerald-700 hover:underline disabled:text-zinc-300 disabled:no-underline"
                              disabled={isBusy}
                              onClick={async () => {
                                try {
                                  await updateLeagueMemberRoleNow(leagueId, member.userId, "league_admin");
                                  await loadMembers();
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : "Failed to promote.");
                                }
                              }}
                            >
                              Promote
                            </button>
                          ) : (
                            <button
                              className="text-xs text-amber-700 hover:underline disabled:text-zinc-300 disabled:no-underline"
                              disabled={isBusy || isLastAdmin}
                              title={isLastAdmin ? "Must have at least 1 admin" : undefined}
                              onClick={async () => {
                                try {
                                  await updateLeagueMemberRoleNow(leagueId, member.userId, "member");
                                  await loadMembers();
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : "Failed to demote.");
                                }
                              }}
                            >
                              Demote
                            </button>
                          )}
                          <button
                            className="text-xs text-rose-700 hover:underline disabled:text-zinc-300 disabled:no-underline"
                            disabled={isBusy || isLastAdmin || isSelf}
                            title={isLastAdmin ? "Must have at least 1 admin" : isSelf ? "Cannot remove yourself" : undefined}
                            onClick={async () => {
                              try {
                                await removeLeagueMemberNow(leagueId, member.userId);
                                await loadMembers();
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Failed to remove.");
                              }
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {addModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
                <h2 className="text-base font-semibold text-zinc-950">Add Member</h2>
                <button className="rounded p-1 text-zinc-400 hover:bg-zinc-100" onClick={() => setAddModalOpen(false)} type="button">
                  <X className="size-4" />
                </button>
              </div>
              <div className="space-y-4 px-5 py-4">
                <div>
                  <Label htmlFor="add-user">User</Label>
                  <select
                    id="add-user"
                    className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    value={addUserId}
                    onChange={(e) => setAddUserId(e.target.value)}
                  >
                    <option value="">Select a user…</option>
                    {allUsers.filter((u) => !members.some((m) => m.userId === u.id)).map((u) => (
                      <option key={u.id} value={u.id}>{u.alias ?? u.email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="add-role">Role</Label>
                  <select
                    id="add-role"
                    className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as "league_admin" | "member")}
                  >
                    <option value="member">Member</option>
                    <option value="league_admin">League Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
                <Button variant="outline" onClick={() => setAddModalOpen(false)} disabled={isBusy}>Cancel</Button>
                <Button
                  disabled={isBusy || !addUserId}
                  onClick={async () => {
                    try {
                      await upsertLeagueMemberNow(leagueId, addUserId, addRole);
                      await loadMembers();
                      setAddModalOpen(false);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to add member.");
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DeleteLeaguePanel() {
  const { activeLeagueId, data, deleteLeagueNow, isBusy } = useDashboard();
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState("");
  const leagueName = data.league?.name ?? "";

  return (
    <Card className="border-rose-200">
      <CardContent className="pt-5">
        <p className="mb-3 text-sm text-zinc-700">
          Permanently delete <strong>{leagueName}</strong> and all its data — teams, rosters, draft results, ADP, optimizer outputs, and mock drafts. This cannot be undone.
        </p>
        <p className="mb-2 text-sm text-zinc-600">Type the league name to confirm:</p>
        <Input
          className="mb-3"
          placeholder={leagueName}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error ? <p className="mb-2 text-sm text-rose-700">{error}</p> : null}
        <Button
          className="bg-rose-700 text-white hover:bg-rose-800"
          disabled={isBusy || confirm !== leagueName}
          onClick={async () => {
            if (!activeLeagueId) return;
            try {
              await deleteLeagueNow(activeLeagueId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to delete league.");
            }
          }}
        >
          <Trash2 className="size-4 mr-2" aria-hidden="true" />
          Delete League
        </Button>
      </CardContent>
    </Card>
  );
}

function AIUsagePanel() {
  const [usage, setUsage] = React.useState<AiUsage | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setLoading(true);
    void getAiUsage()
      .then(setUsage)
      .catch(() => setError("Failed to load AI usage data."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-zinc-500">Loading AI usage…</CardContent>
      </Card>
    );
  }
  if (error || !usage) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-zinc-500">{error || "No usage data."}</CardContent>
      </Card>
    );
  }

  const { current_month: cm, settings: s, recent_logs: logs } = usage;
  const featLabels: Record<string, string> = {
    bot_pick: "Bot Pick",
    draft_analysis: "Draft Analysis",
    strategy_plan: "Strategy Plan",
    keeper_explanation: "Keeper Explanation",
    scenario_narrative: "Scenario Narrative",
    player_summary: "Player Summary",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-700">Current Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricStrip label="Requests" value={String(cm.total_requests)} />
            <MetricStrip label="Input Tokens" value={cm.total_input_tokens.toLocaleString()} />
            <MetricStrip label="Output Tokens" value={cm.total_output_tokens.toLocaleString()} />
            <MetricStrip
              label="Success Rate"
              value={cm.success_rate !== null ? `${(cm.success_rate * 100).toFixed(1)}%` : "—"}
            />
          </div>
          {Object.keys(cm.by_feature).length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">By Feature</p>
              <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
                {Object.entries(cm.by_feature).map(([feat, stat]) => (
                  <div key={feat} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="font-medium text-zinc-800">{featLabels[feat] ?? feat}</span>
                    <span className="text-zinc-500">
                      {stat.requests} req · {stat.total_tokens.toLocaleString()} tok
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-700">Active Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {[
              ["Mock Draft AI", s.mock_draft_ai_enabled],
              ["Keeper Explanations", s.keeper_explanation_ai_enabled],
              ["Scenario Narratives", s.scenario_narrative_ai_enabled],
              ["Player Summaries", s.player_summary_ai_enabled],
            ].map(([label, enabled]) => (
              <div key={String(label)} className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block size-2 rounded-full",
                    enabled ? "bg-emerald-500" : "bg-zinc-300",
                  )}
                />
                <span className="text-zinc-700">{String(label)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricStrip label="Model" value={s.mock_draft_ai_model} />
            <MetricStrip
              label="Max AI Round"
              value={s.mock_draft_ai_max_ai_round === 0 ? "All rounds" : String(s.mock_draft_ai_max_ai_round)}
            />
            <MetricStrip
              label="Monthly Budget"
              value={s.ai_monthly_token_budget === 0 ? "Unlimited" : s.ai_monthly_token_budget.toLocaleString() + " tok"}
            />
          </div>
        </CardContent>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-700">Recent Requests</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
                    <th className="px-3 py-2 font-medium">Feature</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Tokens</th>
                    <th className="px-3 py-2 font-medium text-right">Latency</th>
                    <th className="px-3 py-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {logs.slice(0, 20).map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 text-zinc-800">{featLabels[log.feature] ?? log.feature}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            log.status === "success"
                              ? "success"
                              : log.status === "fallback"
                                ? "warning"
                                : "danger"
                          }
                        >
                          {log.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-600">
                        {log.total_tokens !== null ? log.total_tokens.toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-600">
                        {log.latency_ms !== null ? `${log.latency_ms}ms` : "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-500">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LeagueCalendarSettingsPanel() {
  const { data, isBusy, saveLeagueCalendarSettings } = useDashboard();
  const [form, setForm] = React.useState<LeagueCalendarSettings>({
    keeperPickDeadline: data.league?.keeperPickDeadline ?? "",
    regularSeasonStartDate:
      data.league?.regularSeasonStartDate ?? defaultRegularSeasonStartDate(data.league?.seasonYear),
  });

  React.useEffect(() => {
    setForm({
      keeperPickDeadline: data.league?.keeperPickDeadline ?? "",
      regularSeasonStartDate:
        data.league?.regularSeasonStartDate ?? defaultRegularSeasonStartDate(data.league?.seasonYear),
    });
  }, [data.league?.keeperPickDeadline, data.league?.regularSeasonStartDate, data.league?.seasonYear]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveLeagueCalendarSettings(form);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Countdown Clock Dates</CardTitle>
        <CardDescription>
          Dates are saved at the league level and shown to every user in the header.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-2">
            <Label htmlFor="keeper-pick-deadline">Keeper Pick Deadline</Label>
            <Input
              id="keeper-pick-deadline"
              onChange={(event) =>
                setForm((current) => ({ ...current, keeperPickDeadline: event.target.value }))
              }
              type="date"
              value={form.keeperPickDeadline}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="regular-season-start-date">Regular Season Start Date</Label>
            <Input
              id="regular-season-start-date"
              onChange={(event) =>
                setForm((current) => ({ ...current, regularSeasonStartDate: event.target.value }))
              }
              type="date"
              value={form.regularSeasonStartDate}
            />
          </div>
          <Button className="self-end" disabled={isBusy || data.source !== "api"} type="submit">
            <Save className="size-4" aria-hidden="true" />
            Save Dates
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function LeagueRosterSettingsPanel() {
  const { data, isBusy, saveRosterSettings } = useDashboard();
  const leagueSettings = data.league?.rosterSettings;
  const [form, setForm] = React.useState<LeagueRosterSettings>(
    leagueSettings ?? {
      slots: {},
      allowedPositions: [],
      maxPositionCounts: {},
      benchPositionLimits: {},
    },
  );

  React.useEffect(() => {
    if (leagueSettings) {
      setForm(leagueSettings);
    }
  }, [leagueSettings]);

  const updateSlot = (position: string, value: string) => {
    setForm((current) => ({
      ...current,
      slots: { ...current.slots, [position]: normalizeRosterSettingNumber(value) },
    }));
  };
  const updatePositionLimit = (
    key: "maxPositionCounts" | "benchPositionLimits",
    position: string,
    value: string,
  ) => {
    setForm((current) => {
      const next = { ...current[key] };
      const parsed = normalizeRosterSettingNumber(value);
      if (parsed > 0) {
        next[position] = parsed;
      } else {
        delete next[position];
      }
      return { ...current, [key]: next };
    });
  };
  const toggleAllowedPosition = (position: string, checked: boolean) => {
    setForm((current) => {
      const allowed = new Set(current.allowedPositions);
      if (checked) {
        allowed.add(position);
      } else {
        allowed.delete(position);
      }
      return { ...current, allowedPositions: Array.from(allowed) };
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roster Rules</CardTitle>
        <CardDescription>
          Mock drafts use these settings to size the draft, allow player positions, and reject invalid picks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <SettingsGroup title="Roster Slots">
            {rosterSlotPositions.map((position) => (
              <NumberField
                key={position}
                label={position}
                min={0}
                value={form.slots[position] ?? 0}
                onChange={(value) => updateSlot(position, value)}
              />
            ))}
          </SettingsGroup>

          <SettingsGroup title="Draftable Positions">
            <div className="grid gap-2">
              {rosterPlayerPositions.map((position) => (
                <label
                  className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                  key={position}
                >
                  <span className="font-medium text-zinc-700">{position}</span>
                  <input
                    checked={form.allowedPositions.includes(position)}
                    className="size-4 accent-emerald-700"
                    onChange={(event) => toggleAllowedPosition(position, event.target.checked)}
                    type="checkbox"
                  />
                </label>
              ))}
            </div>
          </SettingsGroup>

          <SettingsGroup title="Position Caps">
            {rosterPlayerPositions.map((position) => (
              <NumberField
                description="0 means no explicit cap."
                key={position}
                label={`Max ${position} Drafted`}
                min={0}
                value={form.maxPositionCounts[position] ?? 0}
                onChange={(value) => updatePositionLimit("maxPositionCounts", position, value)}
              />
            ))}
          </SettingsGroup>
        </div>

        <SettingsGroup title="Bench Position Limits">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {rosterPlayerPositions.map((position) => (
              <NumberField
                description="0 means no bench cap."
                key={position}
                label={`${position} Bench Max`}
                min={0}
                value={form.benchPositionLimits[position] ?? 0}
                onChange={(value) => updatePositionLimit("benchPositionLimits", position, value)}
              />
            ))}
          </div>
        </SettingsGroup>

        <div className="flex justify-end">
          <Button disabled={isBusy || data.source !== "api" || !data.league?.id} onClick={() => saveRosterSettings(form)}>
            <Save className="size-4" aria-hidden="true" />
            Save League Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function normalizeRosterSettingNumber(value: string): number {
  return Math.max(0, Math.floor(Number(value) || 0));
}

const emptyUserForm: UserForm = {
  email: "",
  alias: "",
  password: "",
  role: "user",
  isActive: true,
  teamId: null,
};

function UserManagementPanel() {
  const {
    createUserNow,
    currentUser,
    data,
    deleteUserNow,
    isBusy,
    resetUserPasswordNow,
    tableDisplayResetSignal,
    updateUserNow,
  } = useDashboard();
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [form, setForm] = React.useState<UserForm>(emptyUserForm);
  const [editingUserId, setEditingUserId] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");

  const loadUsers = React.useCallback(async () => {
    try {
      setUsers(await listAdminUsers());
    } catch {
      setUsers([]);
    }
  }, []);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers, data.teams]);

  const resetForm = () => {
    setEditingUserId(null);
    setForm(emptyUserForm);
    setError("");
  };

  const editUser = (user: AdminUser) => {
    setEditingUserId(user.id);
    setForm({
      email: user.email,
      alias: user.alias ?? "",
      password: "",
      role: user.role,
      isActive: user.isActive,
      teamId: user.teamId,
    });
    setError("");
  };

  const submitUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!email) {
      setError("Email is required.");
      return;
    }
    if (!editingUserId && !form.password.trim()) {
      setError("Password is required.");
      return;
    }
    const payload = { ...form, email, alias: form.alias.trim(), password: form.password.trim() };
    if (editingUserId) {
      await updateUserNow(editingUserId, payload);
    } else {
      await createUserNow(payload);
    }
    await loadUsers();
    resetForm();
  };

  const resetPassword = React.useCallback(async (user: AdminUser) => {
    const password = window.prompt(`New password for ${user.email}`);
    if (!password) {
      return;
    }
    await resetUserPasswordNow(user.id, password);
    await loadUsers();
  }, [loadUsers, resetUserPasswordNow]);

  const columns = React.useMemo<ColumnDef<AdminUser>[]>(
    () => [
      { accessorKey: "email", header: "Email" },
      {
        accessorKey: "alias",
        header: "Alias",
        cell: ({ getValue }) => getValue<string | null>() || "Not set",
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ getValue }) => <Badge variant={getValue<string>() === "admin" ? "success" : "info"}>{getValue<string>()}</Badge>,
      },
      {
        accessorKey: "teamName",
        header: "Assigned Team",
        cell: ({ row }) =>
          row.original.teamName ? (
            <TeamNameMark
              name={row.original.teamName}
              teamId={row.original.teamId}
              user={currentUser}
            />
          ) : (
            "Unassigned"
          ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ getValue }) => (
          <Badge variant={getValue<boolean>() ? "success" : "warning"}>
            {getValue<boolean>() ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex flex-wrap gap-2">
              <Button disabled={isBusy} onClick={() => editUser(user)} size="sm" type="button" variant="outline">
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
              <Button disabled={isBusy} onClick={() => void resetPassword(user)} size="sm" type="button" variant="outline">
                <KeyRound className="size-4" aria-hidden="true" />
                Reset
              </Button>
              <Button
                disabled={isBusy}
                onClick={() => {
                  if (window.confirm(`Delete ${user.email}? This unassigns their team.`)) {
                    void deleteUserNow(user.id).then(loadUsers);
                  }
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </Button>
            </div>
          );
        },
      },
    ],
    [currentUser, deleteUserNow, isBusy, loadUsers, resetPassword],
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(340px,0.7fr)_minmax(0,1.3fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{editingUserId ? "Edit User" : "Create User"}</CardTitle>
          <CardDescription>
            User passwords are write-only. Reset a password when a user needs a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void submitUser(event)}>
            <div className="grid gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                autoComplete="email"
                id="user-email"
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                type="email"
                value={form.email}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-password">{editingUserId ? "New Password" : "Password"}</Label>
              <Input
                autoComplete="new-password"
                id="user-password"
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder={editingUserId ? "Leave blank to keep current password" : ""}
                type="password"
                value={form.password}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-alias">Owner Alias</Label>
              <Input
                id="user-alias"
                maxLength={120}
                onChange={(event) => setForm((current) => ({ ...current, alias: event.target.value }))}
                placeholder="Optional team owner display name"
                value={form.alias}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-team">Assigned Team</Label>
              <select
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition-colors focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                id="user-team"
                onChange={(event) =>
                  setForm((current) => ({ ...current, teamId: event.target.value || null }))
                }
                value={form.teamId ?? ""}
              >
                <option value="">Unassigned</option>
                {data.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="user-role">Role</Label>
                <select
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition-colors focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  id="user-role"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value === "platform_admin" ? "platform_admin" : "user",
                    }))
                  }
                  value={form.role}
                >
                  <option value="user">User</option>
                  <option value="platform_admin">Platform Admin</option>
                </select>
              </div>
              <label className="flex items-center gap-2 self-end rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                <input
                  checked={form.isActive}
                  className="size-4 accent-emerald-700"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                  type="checkbox"
                />
                Active
              </label>
            </div>
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button disabled={isBusy} type="submit">
                <Plus className="size-4" aria-hidden="true" />
                {editingUserId ? "Save User" : "Create User"}
              </Button>
              {editingUserId ? (
                <Button disabled={isBusy} onClick={resetForm} type="button" variant="outline">
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <PagePanel title="Users" description="Admin-controlled accounts and team assignments.">
        <DataTable
          columns={columns}
          data={users}
          resetSignal={tableDisplayResetSignal}
          tableId="admin-users"
        />
      </PagePanel>
    </div>
  );
}

function AdminDataImports({
  draftCsvText,
  rosterCsvText,
  setDraftCsvText,
  setRosterCsvText,
}: {
  draftCsvText: string;
  rosterCsvText: string;
  setDraftCsvText: (value: string) => void;
  setRosterCsvText: (value: string) => void;
}) {
  const { csvPreviews, importCsvText, isBusy, previewCsvText } = useDashboard();

  return (
    <div className="space-y-5">
      <SleeperImportPanel />
      <div className="grid gap-5 xl:grid-cols-2">
        <CsvImportPanel
          buttonLabel="Import Draft Results"
          csvText={draftCsvText}
          description="Original draft picks used to determine same-team keeper cost."
          disabled={isBusy}
          inputId="admin-draft-csv"
          onChange={setDraftCsvText}
          onImport={() => importCsvText("draft-results", draftCsvText)}
          onPreview={() => previewCsvText("draft-results", draftCsvText)}
          preview={csvPreviews["draft-results"]}
          title="Draft Results CSV"
        />
        <CsvImportPanel
          buttonLabel="Import Final Rosters"
          csvText={rosterCsvText}
          description="End-of-season roster state that defines keeper candidates."
          disabled={isBusy}
          inputId="admin-roster-csv"
          onChange={setRosterCsvText}
          onImport={() => importCsvText("final-rosters", rosterCsvText)}
          onPreview={() => previewCsvText("final-rosters", rosterCsvText)}
          preview={csvPreviews["final-rosters"]}
          title="Final Rosters CSV"
        />
      </div>
    </div>
  );
}

function SleeperImportPanel() {
  const { activeLeagueId, data, isBusy, refreshData } = useDashboard();
  const [sleeperLeagueId, setSleeperLeagueId] = React.useState("");
  const [seasonYear, setSeasonYear] = React.useState<string>("");
  const [preview, setPreview] = React.useState<SleeperImportPreview | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  const defaultYear = data?.league?.seasonYear ?? new Date().getFullYear();

  const handlePreview = async () => {
    if (!activeLeagueId || !sleeperLeagueId.trim()) return;
    setLoading(true);
    setError("");
    setSuccessMessage("");
    setPreview(null);
    try {
      const year = seasonYear ? parseInt(seasonYear, 10) : undefined;
      const result = await previewSleeperImport(activeLeagueId, sleeperLeagueId.trim(), year);
      setPreview(result);
    } catch {
      setError("Preview failed — check the Sleeper League ID and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!activeLeagueId || !sleeperLeagueId.trim() || !preview?.valid) return;
    setLoading(true);
    setError("");
    try {
      const year = seasonYear ? parseInt(seasonYear, 10) : undefined;
      const result = await commitSleeperImport(activeLeagueId, sleeperLeagueId.trim(), year);
      await refreshData();
      setSuccessMessage(
        `Import complete: ${result.teamsUpserted} teams, ${result.draftPicksUpserted} draft picks, ${result.rosterEntriesUpserted} roster entries.`,
      );
      setPreview(null);
      setSleeperLeagueId("");
      setSeasonYear("");
    } catch {
      setError("Import failed. Check the API logs.");
    } finally {
      setLoading(false);
    }
  };

  const busy = isBusy || loading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import from Sleeper</CardTitle>
        <CardDescription>
          Automatically pull teams, draft results, and final rosters from a Sleeper league. Find your league ID in the Sleeper URL (e.g. sleeper.com/leagues/<strong>123456789</strong>).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-2">
            <Label htmlFor="sleeper-league-id">Sleeper League ID</Label>
            <Input
              id="sleeper-league-id"
              disabled={busy}
              onChange={(e) => { setSleeperLeagueId(e.target.value); setPreview(null); }}
              placeholder="e.g. 1048599578647052288"
              value={sleeperLeagueId}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sleeper-season-year">Season Year</Label>
            <Input
              id="sleeper-season-year"
              disabled={busy}
              min={2000}
              max={2100}
              onChange={(e) => { setSeasonYear(e.target.value); setPreview(null); }}
              placeholder={String(defaultYear)}
              type="number"
              className="w-28"
              value={seasonYear}
            />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            disabled={busy || !sleeperLeagueId.trim()}
            onClick={() => { void handlePreview(); }}
            variant="outline"
          >
            <ListChecks className="size-4" aria-hidden="true" />
            Preview
          </Button>
          <Button
            disabled={busy || !preview?.valid}
            onClick={() => { void handleImport(); }}
          >
            <Upload className="size-4" aria-hidden="true" />
            Import
          </Button>
        </div>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {successMessage && !preview ? (
          <p className="text-sm text-emerald-700">{successMessage}</p>
        ) : null}
        {preview ? <SleeperPreviewSummary preview={preview} /> : (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
            Enter a Sleeper League ID and click Preview to validate before importing.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SleeperPreviewSummary({ preview }: { preview: SleeperImportPreview }) {
  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={preview.valid ? "success" : "danger"}>
          {preview.valid ? "Ready" : "Error"}
        </Badge>
        {preview.valid ? (
          <span className="text-sm text-zinc-700">
            Season {preview.seasonYear} · {preview.teams.length} teams · {preview.draftPicksCount} draft picks · {preview.rosterEntriesCount} roster entries
          </span>
        ) : null}
      </div>

      {preview.errors.length > 0 ? (
        <div className="space-y-1">
          {preview.errors.map((e, i) => (
            <p key={i} className="text-sm text-rose-700">{e}</p>
          ))}
        </div>
      ) : null}

      {preview.warnings.length > 0 ? (
        <div className="space-y-1">
          {preview.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700">{w}</p>
          ))}
        </div>
      ) : null}

      {preview.valid && preview.teams.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="pb-1 pr-3 font-medium">Slot</th>
                <th className="pb-1 pr-3 font-medium">Team</th>
                <th className="pb-1 pr-3 font-medium">Owner</th>
                <th className="pb-1 font-medium text-right">Players</th>
              </tr>
            </thead>
            <tbody>
              {preview.teams.map((team) => (
                <tr key={team.rosterId} className="border-b border-zinc-100 last:border-0">
                  <td className="py-1 pr-3 text-zinc-500">{team.rosterId}</td>
                  <td className="py-1 pr-3 font-medium text-zinc-900">{team.teamName}</td>
                  <td className="py-1 pr-3 text-zinc-500">{team.ownerName ?? "—"}</td>
                  <td className="py-1 text-right text-zinc-700">{team.playerCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

const emptyTeamForm: TeamForm = {
  name: "",
  draftSlot: null,
  ownerName: "",
  userId: null,
};

function LeagueManagementPanel() {
  const {
    createTeamNow,
    currentUser,
    data,
    deleteTeamNow,
    isBusy,
    tableDisplayResetSignal,
    updateTeamNow,
  } = useDashboard();
  const [users, setUsers] = React.useState<AuthUser[]>([]);
  const [form, setForm] = React.useState<TeamForm>(emptyTeamForm);
  const [editingTeamId, setEditingTeamId] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    listAdminUsers()
      .then((loadedUsers) => {
        if (!cancelled) {
          setUsers(loadedUsers);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsers([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resetForm = () => {
    setEditingTeamId(null);
    setForm(emptyTeamForm);
    setError("");
  };

  const editTeam = (team: Team) => {
    setEditingTeamId(team.id);
    setForm({
      name: team.name,
      draftSlot: team.draftSlot || null,
      ownerName: team.userId ? "" : team.owner === "Unassigned" ? "" : team.owner,
      userId: team.userId ?? null,
    });
    setError("");
  };

  const submitTeam = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError("Team name is required.");
      return;
    }
    const payload = {
      ...form,
      name: trimmedName,
      ownerName: form.ownerName.trim(),
    };
    if (editingTeamId) {
      await updateTeamNow(editingTeamId, payload);
    } else {
      await createTeamNow(payload);
    }
    resetForm();
  };

  const columns = React.useMemo<ColumnDef<Team>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Team",
        cell: ({ row }) => <TeamNameMark name={row.original.name} teamId={row.original.id} user={currentUser} />,
      },
      { accessorKey: "owner", header: "Assigned User / Owner" },
      { accessorKey: "draftSlot", header: "Draft Slot" },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const team = row.original;
          return (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={isBusy}
                onClick={() => editTeam(team)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
              <Button
                disabled={isBusy}
                onClick={() => {
                  if (window.confirm(`Delete ${team.name}? This also removes related team data.`)) {
                    void deleteTeamNow(team.id);
                  }
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </Button>
            </div>
          );
        },
      },
    ],
    [currentUser, deleteTeamNow, isBusy],
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(340px,0.7fr)_minmax(0,1.3fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{editingTeamId ? "Edit Team" : "Add Team"}</CardTitle>
          <CardDescription>
            Team assignment controls are limited to admins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void submitTeam(event)}>
            <div className="grid gap-2">
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                value={form.name}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="team-draft-slot">Draft Slot</Label>
              <Input
                id="team-draft-slot"
                min={1}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    draftSlot: event.target.value ? Number(event.target.value) : null,
                  }))
                }
                type="number"
                value={form.draftSlot ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="team-user">Assigned User</Label>
              <select
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition-colors focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                id="team-user"
                onChange={(event) =>
                  setForm((current) => ({ ...current, userId: event.target.value || null }))
                }
                value={form.userId ?? ""}
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.alias ? `${user.alias} (${user.email})` : user.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="team-owner">Fallback Owner Name</Label>
              <Input
                id="team-owner"
                onChange={(event) =>
                  setForm((current) => ({ ...current, ownerName: event.target.value }))
                }
                placeholder="Optional display name when no user is assigned"
                value={form.ownerName}
              />
            </div>
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button disabled={isBusy} type="submit">
                <Plus className="size-4" aria-hidden="true" />
                {editingTeamId ? "Save Team" : "Add Team"}
              </Button>
              {editingTeamId ? (
                <Button disabled={isBusy} onClick={resetForm} type="button" variant="outline">
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <PagePanel title="Managed Teams" description="Admin-only team configuration.">
        <DataTable
          columns={columns}
          data={data.teams}
          resetSignal={tableDisplayResetSignal}
          tableId="admin-teams"
          teamFilter={{ columnId: "name" }}
        />
      </PagePanel>
    </div>
  );
}

function ADPInputPage({
  csvText,
  setCsvText,
}: {
  csvText: string;
  setCsvText: (value: string) => void;
}) {
  const {
    csvPreviews,
    data,
    downloadAdpTemplateNow,
    importCompositeAdpNow,
    importCsvText,
    isAdmin,
    isBusy,
    previewCsvText,
    tableDisplayResetSignal,
  } = useDashboard();
  const columns = React.useMemo<ColumnDef<ADPEntry>[]>(
    () => [
      { accessorKey: "player", header: "Player" },
      {
        accessorKey: "position",
        header: "Pos",
        cell: ({ getValue }) => <PositionBadge position={getValue<string>()} />,
      },
      { accessorKey: "adpPick", header: "ADP Pick" },
      { accessorKey: "adpRound", header: "ADP Round" },
      { accessorKey: "source", header: "Source" },
      {
        accessorKey: "trend",
        header: "Trend",
        cell: ({ getValue }) => <TrendBadge trend={getValue<string>()} />,
      },
    ],
    [],
  );

  return (
    <div className={cn("grid gap-5", isAdmin && "xl:grid-cols-[minmax(340px,0.7fr)_minmax(0,1.3fr)]")}>
      {isAdmin ? <Card>
        <CardHeader>
          <CardTitle>ADP</CardTitle>
          <CardDescription>
            Fetch live rankings from DraftSharks and Fantasy Football Calculator and import them as the active ADP snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            disabled={isBusy || data.source !== "api" || !data.league?.id}
            onClick={importCompositeAdpNow}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Update ADP
          </Button>
          <div className="grid gap-2">
            <Label htmlFor="adp-source">Active Source</Label>
            <Input
              id="adp-source"
              value={data.activeSnapshot?.source ?? "No ADP snapshot loaded"}
              readOnly
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="adp-date">Snapshot Date</Label>
            <Input id="adp-date" type="date" value={data.activeSnapshot?.snapshotDate ?? ""} readOnly />
          </div>
          <details className="group">
            <summary className="flex cursor-pointer select-none items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800">
              <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
              Manual CSV override
            </summary>
            <div className="mt-3 space-y-3 border-l-2 border-zinc-100 pl-4">
              <Button
                disabled={isBusy || data.source !== "api" || !data.league?.id}
                onClick={downloadAdpTemplateNow}
                size="sm"
                variant="outline"
              >
                <Download className="size-4" aria-hidden="true" />
                Download Composite CSV
              </Button>
              <div className="grid gap-2">
                <Label htmlFor="adp-csv">CSV</Label>
                <Textarea id="adp-csv" value={csvText} onChange={(event) => setCsvText(event.target.value)} />
              </div>
              <CsvPreviewActions
                disabled={isBusy}
                onImport={() => importCsvText("adp", csvText)}
                onPreview={() => previewCsvText("adp", csvText)}
                preview={csvPreviews.adp}
              />
              <CsvPreviewSummary preview={csvPreviews.adp} />
            </div>
          </details>
        </CardContent>
      </Card> : null}

      <Card className="h-full min-h-0">
        <CardHeader>
          <CardTitle>ADP Preview</CardTitle>
          <CardDescription>Parsed player market data ready for optimizer runs.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data.adpEntries}
            resetSignal={tableDisplayResetSignal}
            scrollBody
            scrollBodyClassName="max-h-[420px]"
            tableId="adp-preview"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function OptimizerSettingsPage({
  settings,
  setSettings,
}: {
  settings: OptimizerSettingsForm;
  setSettings: React.Dispatch<React.SetStateAction<OptimizerSettingsPageProps>>;
}) {
  const { isBusy, saveSettings } = useDashboard();
  const updateNumber = (key: keyof OptimizerSettingsPageProps, value: string) => {
    setSettings((current) => ({ ...current, [key]: Number(value) }));
  };

  const updateBoolean = (key: keyof OptimizerSettingsPageProps, value: boolean) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  return (
    <PagePanel
      title="Optimizer Settings"
      description="Keeper limits, eligibility floors, and positional scoring weights."
      action={
        <Button disabled={isBusy} onClick={() => saveSettings(settings)}>
          <Save className="size-4" aria-hidden="true" />
          Save Settings
        </Button>
      }
    >
      <div className="grid gap-5 xl:grid-cols-3">
        <SettingsGroup title="Keeper Limits">
          <NumberField
            description="The most players a team can keep. League rules currently allow 0 to 4."
            label="Maximum Keepers Per Team"
            max={4}
            min={0}
            value={settings.maxKeepers}
            onChange={(value) => updateNumber("maxKeepers", value)}
          />
          <NumberField
            description="The most keepers allowed from any single position group, such as RB or WR."
            label="Maximum Keepers Per Position"
            max={4}
            min={0}
            value={settings.maxPerPosition}
            onChange={(value) => updateNumber("maxPerPosition", value)}
          />
          <NumberField
            description="A separate cap for quarterbacks. This prevents the optimizer from overloading on QB keepers."
            label="Maximum QB Keepers"
            max={2}
            min={0}
            value={settings.maxQbs}
            onChange={(value) => updateNumber("maxQbs", value)}
          />
        </SettingsGroup>

        <SettingsGroup title="Eligibility">
          <NumberField
            description="The minimum pick-value edge a player must have before the optimizer will consider keeping him. Default is 1. Lower values allow more speculative recommendations."
            label="Minimum Keeper Value Threshold"
            min={-5}
            value={settings.minimumKeeperValue}
            onChange={(value) => updateNumber("minimumKeeperValue", value)}
          />
          <NumberField
            description="The minimum total model score required for a player to qualify as a recommended keeper."
            label="Minimum Keeper Score Threshold"
            value={settings.minimumKeeperScore}
            onChange={(value) => updateNumber("minimumKeeperScore", value)}
          />
          <NumberField
            description="Ignore players whose ADP is later than this overall pick. This helps remove fringe players from consideration."
            label="Latest ADP Pick to Consider"
            value={settings.maxAdpCap}
            onChange={(value) => updateNumber("maxAdpCap", value)}
          />
        </SettingsGroup>

        <SettingsGroup title="Position Weights">
          <NumberField
            description="How strongly QB keeper value affects the final score."
            label="QB Weight"
            step={0.05}
            value={settings.qbWeight}
            onChange={(value) => updateNumber("qbWeight", value)}
          />
          <NumberField
            description="How strongly RB keeper value affects the final score."
            label="RB Weight"
            step={0.05}
            value={settings.rbWeight}
            onChange={(value) => updateNumber("rbWeight", value)}
          />
          <NumberField
            description="How strongly WR keeper value affects the final score."
            label="WR Weight"
            step={0.05}
            value={settings.wrWeight}
            onChange={(value) => updateNumber("wrWeight", value)}
          />
          <NumberField
            description="How strongly TE keeper value affects the final score."
            label="TE Weight"
            step={0.05}
            value={settings.teWeight}
            onChange={(value) => updateNumber("teWeight", value)}
          />
        </SettingsGroup>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <ToggleRow
          checked={settings.superflexBonus}
          description="Adds a tiered bonus to quarterbacks when strong QB scarcity matters in superflex formats."
          label="Tiered Superflex QB Scarcity"
          onChange={(value) => updateBoolean("superflexBonus", value)}
        />
        <ToggleRow
          checked={settings.draftSlotBonus}
          description="Applies a small score adjustment based on where each team drafts in the order."
          label="Use Draft Slot Bonus"
          onChange={(value) => updateBoolean("draftSlotBonus", value)}
        />
        <ToggleRow
          checked={settings.elitePlayerBonus}
          description="Adds data-driven bonus value for truly elite players using Draft Sharks metrics when available."
          label="Use Elite Player Bonus"
          onChange={(value) => updateBoolean("elitePlayerBonus", value)}
        />
      </div>

      <Card className="mt-5 border-zinc-200 bg-zinc-50">
        <CardHeader>
          <CardTitle className="text-base">How to Use These Settings</CardTitle>
          <CardDescription>
            What each group does, when to change it, and how to apply changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-zinc-700">
          <p>
            <strong className="text-zinc-950">Keeper Limits</strong> enforce hard caps that match your league rules. Set Maximum Keepers Per Team to the number your rules allow. Use Maximum Keepers Per Position if your league prevents stacking a single position. Use Maximum QB Keepers to prevent the optimizer from filling slots with quarterbacks in superflex leagues where QBs score highly.
          </p>
          <p>
            <strong className="text-zinc-950">Eligibility thresholds</strong> control who gets considered. Minimum Keeper Value Threshold is the pick-savings edge a player must have to qualify — lower it (toward zero or negative) to allow borderline or speculative picks, raise it to keep only the most cost-efficient options. Minimum Keeper Score is a combined quality floor after bonuses and penalties are applied. Latest ADP Pick removes late-round fringe players from the candidate pool entirely.
          </p>
          <p>
            <strong className="text-zinc-950">Position Weights</strong> multiply how much keeper value counts at each position. The default weights are roughly equal. Raise QB Weight in superflex formats where starting a QB is nearly mandatory — pairing this with the Tiered Superflex QB Scarcity toggle adds an additional tiered bonus for quarterbacks with stronger ADP.
          </p>
          <p>
            <strong className="text-zinc-950">Applying changes:</strong> click Save Settings when done. Save reruns the optimizer immediately — recommendations, Draft Impact, Team Outlooks, and Scenario Comparison all update in one step. You do not need to click Run Optimizer separately. These updated recommendations also flow into the keeper context loaded by any new Mock Draft session you create afterward.
          </p>
        </CardContent>
      </Card>
    </PagePanel>
  );
}

type OptimizerSettingsPageProps = OptimizerSettingsForm;

function KeeperRecommendationsPage() {
  const {
    data,
    exportRecommendations,
    isBusy,
    setManualOverrideNow,
    tableDisplayResetSignal,
  } = useDashboard();
  return (
    <PagePanel
      title="Keeper Recommendations"
      description={
        <>
          Optimizer output with value, score, eligibility, and selection reason.{" "}
          <span className="text-emerald-700">Click a player name for an AI explanation.</span>
        </>
      }
      action={
        <div className="flex flex-wrap gap-2">
          <Button disabled={isBusy} onClick={() => exportRecommendations("xlsx")} variant="outline">
            <Download className="size-4" aria-hidden="true" />
            Excel
          </Button>
          <Button disabled={isBusy} onClick={() => exportRecommendations("csv")} variant="outline">
            <Download className="size-4" aria-hidden="true" />
            CSV
          </Button>
          <Button disabled={isBusy} onClick={() => exportRecommendations("pdf")} variant="outline">
            <FileText className="size-4" aria-hidden="true" />
            PDF
          </Button>
        </div>
      }
    >
      <KeeperRecommendationsTable
        data={data.keeperRecommendations}
        onOverride={setManualOverrideNow}
        resetSignal={tableDisplayResetSignal}
        showOverrides
        teamCount={data.teams.length}
      />
    </PagePanel>
  );
}

function ScenarioComparisonPage() {
  const {
    currentUser,
    data,
    isBusy,
    runScenariosNow,
    selectedScenarioByTeam,
    setSelectedScenarioForTeam,
  } = useDashboard();
  const [localNarrative, setLocalNarrative] = React.useState<ScenarioNarrative | null>(
    data.scenarioNarrative,
  );
  const [narrativeLoading, setNarrativeLoading] = React.useState(false);
  const [narrativeError, setNarrativeError] = React.useState(false);

  React.useEffect(() => {
    setLocalNarrative(data.scenarioNarrative);
  }, [data.scenarioNarrative]);

  const handleGenerateNarrative = React.useCallback(async () => {
    const leagueId = data.league?.id;
    if (!leagueId) return;
    setNarrativeLoading(true);
    setNarrativeError(false);
    try {
      const result = await generateScenarioNarrative(leagueId);
      setLocalNarrative(result);
    } catch {
      setNarrativeError(true);
    } finally {
      setNarrativeLoading(false);
    }
  }, [data.league?.id]);

  const teams = React.useMemo(
    () =>
      data.teams
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name)),
    [data.teams],
  );
  const recommendedScenarioByTeam = React.useMemo(
    () =>
      recommendScenarioSelections(
        data.teams,
        data.scenarioComparisons,
        data.league?.draftType ?? "snake",
      ),
    [data.league?.draftType, data.scenarioComparisons, data.teams],
  );

  return (
    <div className="space-y-5">
      <ScenarioNarrativePanel
        narrative={localNarrative}
        loading={narrativeLoading}
        error={narrativeError}
        onGenerate={handleGenerateNarrative}
        disabled={isBusy || narrativeLoading}
      />
      <div className="grid gap-3 xl:grid-cols-5">
        {data.scenarioComparisons.map((scenario) => (
          <ScenarioSummaryCard key={scenario.scenarioName} scenario={scenario} />
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle>Side-by-Side Team Comparison</CardTitle>
                <CardDescription>
                  Keeper sets, forfeited picks, and strategic notes by preset.
                </CardDescription>
              </div>
          <Button disabled={isBusy} onClick={runScenariosNow}>
            <Play className="size-4" aria-hidden="true" />
            Run All Presets
          </Button>
        </CardHeader>
        <CardContent>
          <div className="max-h-[70vh] overflow-auto rounded-md border border-zinc-200">
            <table className="min-w-[1180px] border-collapse bg-white text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="sticky left-0 top-0 z-30 w-64 bg-zinc-50 px-3 py-3 text-left text-xs font-semibold uppercase text-zinc-500 shadow-[inset_0_-1px_0_#e4e4e7]">
                    Team
                  </th>
                  {data.scenarioComparisons.map((scenario) => (
                    <th
                      key={scenario.scenarioName}
                      className="sticky top-0 z-20 w-[260px] bg-zinc-50 px-3 py-3 text-left text-xs font-semibold uppercase text-zinc-500 shadow-[inset_0_-1px_0_#e4e4e7]"
                    >
                      {scenario.scenarioName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr
                    key={team.id}
                    className={cn(
                      "border-b border-zinc-100 align-top",
                      isCurrentUserTeam({ name: team.name, teamId: team.id, user: currentUser }) &&
                        "bg-emerald-50/30",
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 bg-white px-3 py-4 shadow-[inset_-1px_0_0_#e4e4e7]",
                        isCurrentUserTeam({ name: team.name, teamId: team.id, user: currentUser }) &&
                          "bg-emerald-50",
                      )}
                    >
                      <div className="space-y-2">
                        <TeamNameMark
                          className="font-semibold text-zinc-900"
                          name={team.name}
                          teamId={team.id}
                          user={currentUser}
                        />
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold uppercase text-zinc-500">
                            Outlook Scenario
                          </Label>
                          <select
                            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                            onChange={(event) => {
                              const value = event.target.value;
                              setSelectedScenarioForTeam(
                                team.id,
                                value ? (value as ScenarioComparison["scenarioName"]) : null,
                              );
                            }}
                            value={selectedScenarioByTeam[team.id] ?? recommendedScenarioByTeam[team.id] ?? ""}
                          >
                            {data.scenarioComparisons.map((scenario) => (
                              <option key={scenario.scenarioName} value={scenario.scenarioName}>
                                {scenario.scenarioName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </td>
                    {data.scenarioComparisons.map((scenario) => {
                      const teamResult = scenario.teams.find(
                        (teamResult) => teamResult.teamId === team.id || teamResult.team === team.name,
                      );
                      return (
                        <td key={`${scenario.scenarioName}-${team.id}`} className="px-3 py-4">
                          {teamResult ? <ScenarioTeamCell teamResult={teamResult} /> : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TeamOutlooksPage() {
  const { currentUser, data, exportRecommendations, isBusy } = useDashboard();
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {data.outlooks.map((outlook) => (
        <OutlookCard
          currentUser={currentUser}
          disabled={isBusy}
          key={outlook.team}
          onExport={() => exportRecommendations("pdf", outlook.teamId)}
          outlook={outlook}
        />
      ))}
    </div>
  );
}

function DraftImpactPage() {
  const { currentUser, data, tableDisplayResetSignal } = useDashboard();
  const forfeitedCount = data.draftImpact.filter((pick) => pick.status === "Forfeited").length;
  const openTop100 = data.draftImpact.filter(
    (pick) => pick.overallPick <= 100 && pick.status === "Open",
  ).length;
  const columns = React.useMemo<ColumnDef<DraftImpactPick>[]>(
    () => [
      { accessorKey: "round", header: "Round" },
      { accessorKey: "pickInRound", header: "Pick In Round" },
      { accessorKey: "overallPick", header: "Overall" },
      {
        accessorKey: "team",
        header: "Team",
        cell: ({ getValue }) => <TeamNameMark name={getValue<string>()} user={currentUser} />,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => (
          <Badge variant={getValue<DraftImpactPick["status"]>() === "Forfeited" ? "danger" : "success"}>
            {getValue<string>()}
          </Badge>
        ),
      },
      { accessorKey: "keeperPlayer", header: "Keeper" },
      {
        accessorKey: "keeperPosition",
        header: "Pos",
        cell: ({ getValue }) => {
          const position = getValue<string>();
          return position ? <PositionBadge position={position} /> : null;
        },
      },
      {
        accessorKey: "keeperScore",
        header: "Score",
        cell: ({ getValue }) => {
          const score = getValue<number>();
          return score ? formatter.format(score) : "";
        },
      },
    ],
    [currentUser],
  );

  return (
    <PagePanel
      title="Draft Impact"
      description="Projected draft board after selected keeper picks are forfeited."
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricStrip label="Projected Picks" value={data.draftImpact.length.toString()} />
          <MetricStrip label="Forfeited" value={forfeitedCount.toString()} />
          <MetricStrip label="Open Top-100" value={openTop100.toString()} />
        </div>
        <DraftBoardPreview currentUser={currentUser} picks={data.draftImpact} />
        <DataTable
          columns={columns}
          data={data.draftImpact}
          resetSignal={tableDisplayResetSignal}
          tableId="draft-impact"
          teamFilter={{ columnId: "team" }}
        />
      </div>
    </PagePanel>
  );
}

function MockDraftPage() {
  const { currentUser, data, isBusy } = useDashboard();
  const leagueId = data.source === "api" ? data.league?.id : null;
  const userTeam = data.teams.find(
    (team) => team.id === currentUser?.teamId || team.name === currentUser?.teamName,
  );
  const [form, setForm] = React.useState<MockDraftCreateForm>({
    adpSnapshotId: data.activeSnapshot?.id ?? null,
    scenarioName: null,
    pickTimerSeconds: 60,
    defaultPersonality: "Balanced",
    defaultDifficulty: "Medium",
    teamBotOverrides: {},
  });
  const [history, setHistory] = React.useState<MockDraftHistoryRow[]>([]);
  const [activeSession, setActiveSession] = React.useState<MockDraftSession | null>(null);
  const [selectedComparisonIds, setSelectedComparisonIds] = React.useState<string[]>([]);
  const [comparisonSessions, setComparisonSessions] = React.useState<MockDraftSession[]>([]);
  const [playerSearch, setPlayerSearch] = React.useState("");
  const [positionFilter, setPositionFilter] = React.useState("ALL");
  const [selectedPlayer, setSelectedPlayer] = React.useState<MockDraftAvailablePlayer | null>(null);
  const [timeRemaining, setTimeRemaining] = React.useState<number | null>(null);
  const [timerNotice, setTimerNotice] = React.useState("");
  const timerAlertSecondRef = React.useRef<number | null>(null);
  const userTurnAlertKeyRef = React.useRef<string | null>(null);
  const [autoScrollBoard, setAutoScrollBoard] = React.useState(true);
  const [isAutoAdvancingBots, setIsAutoAdvancingBots] = React.useState(false);
  const isAutoAdvancingBotsRef = React.useRef(false);
  const [draftSpeed, setDraftSpeed] = React.useState<MockDraftSpeed>("Medium");
  const [isDraftWorkspaceOpen, setIsDraftWorkspaceOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [strategyGenerationMessage, setStrategyGenerationMessage] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState("");

  React.useEffect(() => {
    setForm((current) => ({
      ...current,
      adpSnapshotId: data.activeSnapshot?.id ?? null,
      teamBotOverrides: Object.fromEntries(
        Object.entries(current.teamBotOverrides).filter(([teamId]) =>
          data.teams.some((team) => team.id === teamId),
        ),
      ),
    }));
  }, [data.activeSnapshot?.id, data.teams]);

  const refreshHistory = React.useCallback(async () => {
    if (!leagueId) {
      setHistory([]);
      return;
    }
    setIsLoading(true);
    try {
      setHistory(await listMockDrafts(leagueId));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Loading mock draft history failed.");
    } finally {
      setIsLoading(false);
    }
  }, [leagueId]);

  React.useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  React.useEffect(() => {
    setSelectedComparisonIds((current) =>
      current.filter((sessionId) => history.some((row) => row.id === sessionId)),
    );
    setComparisonSessions((current) =>
      current.filter((session) => history.some((row) => row.id === session.id)),
    );
  }, [history]);

  const startNewSession = React.useCallback(async () => {
    if (!leagueId) {
      setErrorMessage("Live league data is required.");
      return;
    }
    setIsLoading(true);
    setStrategyGenerationMessage("Generating strategy...");
    try {
      const session = await createMockDraft(leagueId, form);
      setActiveSession(session);
      setIsDraftWorkspaceOpen(true);
      setErrorMessage("");
      await refreshHistory();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Creating mock draft failed.");
    } finally {
      setStrategyGenerationMessage("");
      setIsLoading(false);
    }
  }, [form, leagueId, refreshHistory]);

  const startActiveSession = React.useCallback(async () => {
    if (!activeSession) {
      return;
    }
    setIsLoading(true);
    try {
      setActiveSession(await startMockDraft(activeSession.id));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Starting mock draft failed.");
    } finally {
      setIsLoading(false);
    }
  }, [activeSession]);

  const generateStrategyPlan = React.useCallback(async () => {
    if (!activeSession) {
      return;
    }
    setIsLoading(true);
    setStrategyGenerationMessage("Regenerating strategy...");
    try {
      setActiveSession(await generateMockDraftStrategyPlan(activeSession.id));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Generating strategy plan failed.");
    } finally {
      setStrategyGenerationMessage("");
      setIsLoading(false);
    }
  }, [activeSession]);

  const pauseSession = React.useCallback(async () => {
    if (!activeSession) {
      return;
    }
    setIsLoading(true);
    try {
      setActiveSession(await pauseMockDraft(activeSession.id));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Pausing mock draft failed.");
    } finally {
      setIsLoading(false);
    }
  }, [activeSession]);

  const resumeSession = React.useCallback(async () => {
    if (!activeSession) {
      return;
    }
    setIsLoading(true);
    try {
      setActiveSession(await resumeMockDraft(activeSession.id));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Resuming mock draft failed.");
    } finally {
      setIsLoading(false);
    }
  }, [activeSession]);

  const endSession = React.useCallback(async () => {
    if (!activeSession) {
      return;
    }
    if (!window.confirm("End this mock draft? Incomplete mock drafts are excluded from history.")) {
      return;
    }
    setIsLoading(true);
    try {
      setActiveSession(await endMockDraft(activeSession.id));
      setErrorMessage("");
      await refreshHistory();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Ending mock draft failed.");
    } finally {
      setIsLoading(false);
    }
  }, [activeSession, refreshHistory]);

  const advanceBotPick = React.useCallback(async () => {
    if (!activeSession) {
      return;
    }
    setIsLoading(true);
    try {
      const nextSession = await makeMockDraftBotPick(activeSession.id);
      setActiveSession(nextSession);
      setErrorMessage("");
      if (nextSession.status === "complete") {
        await refreshHistory();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Bot pick failed.");
    } finally {
      setIsLoading(false);
    }
  }, [activeSession, refreshHistory]);

  const draftPlayer = React.useCallback(
    async (playerId: string) => {
      if (!activeSession) {
        return;
      }
      setIsLoading(true);
      try {
        const pickableSession =
          activeSession.status === "paused"
            ? await resumeMockDraft(activeSession.id)
            : activeSession;
        const nextSession = await makeMockDraftPick(pickableSession.id, playerId);
        setActiveSession(nextSession);
        setTimerNotice("");
        setErrorMessage("");
        if (nextSession.status === "complete") {
          await refreshHistory();
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Drafting player failed.");
      } finally {
        setIsLoading(false);
      }
    },
    [activeSession, refreshHistory],
  );

  const openHistorySession = React.useCallback(async (sessionId: string) => {
    setIsLoading(true);
    try {
      setActiveSession(await readMockDraft(sessionId));
      setIsDraftWorkspaceOpen(true);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Opening mock draft failed.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const prepareRerun = React.useCallback((session: MockDraftSession) => {
    const botConfig = session.botConfig;
    const defaultPersonality =
      typeof botConfig.default_personality === "string"
        ? botConfig.default_personality
        : "Balanced";
    const defaultDifficulty =
      typeof botConfig.default_difficulty === "string"
        ? botConfig.default_difficulty
        : "Medium";
    const teamBotOverrides = objectEntries(botConfig.teams).reduce<
      Record<string, { personality: string; difficulty: string }>
    >((overrides, [teamId, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return overrides;
      }
      const config = value as Record<string, unknown>;
      overrides[teamId] = {
        personality:
          typeof config.personality === "string" ? config.personality : defaultPersonality,
        difficulty:
          typeof config.difficulty === "string" ? config.difficulty : defaultDifficulty,
      };
      return overrides;
    }, {});
    setForm({
      adpSnapshotId: session.adpSnapshotId,
      scenarioName:
        typeof session.keeperContext.scenario_name === "string"
          ? session.keeperContext.scenario_name
          : null,
      pickTimerSeconds:
        session.pickTimerSeconds === 30 ||
        session.pickTimerSeconds === 60 ||
        session.pickTimerSeconds === 90 ||
        session.pickTimerSeconds === 120
          ? session.pickTimerSeconds
          : null,
      defaultPersonality,
      defaultDifficulty,
      teamBotOverrides,
    });
    setActiveSession(null);
    setIsDraftWorkspaceOpen(false);
    setErrorMessage("");
  }, []);

  const rerunFromHistory = React.useCallback(
    async (sessionId: string) => {
      setIsLoading(true);
      try {
        prepareRerun(await readMockDraft(sessionId));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Preparing rerun failed.");
      } finally {
        setIsLoading(false);
      }
    },
    [prepareRerun],
  );

  const toggleComparison = React.useCallback((sessionId: string) => {
    setSelectedComparisonIds((current) => {
      if (current.includes(sessionId)) {
        return current.filter((id) => id !== sessionId);
      }
      return [...current, sessionId].slice(-4);
    });
  }, []);

  const loadComparison = React.useCallback(async () => {
    if (!selectedComparisonIds.length) {
      setComparisonSessions([]);
      return;
    }
    setIsLoading(true);
    try {
      setComparisonSessions(await Promise.all(selectedComparisonIds.map((id) => readMockDraft(id))));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Loading comparison failed.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedComparisonIds]);

  const deleteHistorySession = React.useCallback(
    async (sessionId: string) => {
      if (!window.confirm("Delete this completed mock draft? This removes its saved recap and analysis.")) {
        return;
      }
      setIsLoading(true);
      try {
        await deleteMockDraft(sessionId);
        setHistory((current) => current.filter((row) => row.id !== sessionId));
        setSelectedComparisonIds((current) => current.filter((id) => id !== sessionId));
        setComparisonSessions((current) => current.filter((session) => session.id !== sessionId));
        setActiveSession((current) => (current?.id === sessionId ? null : current));
        setErrorMessage("");
        await refreshHistory();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Deleting mock draft failed.");
      } finally {
        setIsLoading(false);
      }
    },
    [refreshHistory],
  );

  const keeperCount = data.keeperRecommendations.filter(
    (recommendation) =>
      recommendation.status === "Recommended" &&
      (!userTeam || recommendation.teamId === userTeam.id || recommendation.team === userTeam.name),
  ).length;
  const currentSlot = activeSession?.board.find((slot) => slot.overallPick === activeSession.currentPick) ?? null;
  const isUserTurn = Boolean(
    activeSession?.status === "in_progress" &&
      currentSlot &&
      (currentSlot.teamId === activeSession.userTeamId || currentSlot.teamName === activeSession.userTeamName),
  );
  const isUserPickSlot = Boolean(
    activeSession &&
      currentSlot &&
      (activeSession.status === "in_progress" || activeSession.status === "paused") &&
      (currentSlot.teamId === activeSession.userTeamId || currentSlot.teamName === activeSession.userTeamName),
  );
  const isBotTurn = Boolean(
    activeSession?.status === "in_progress" &&
      currentSlot &&
      currentSlot.teamId !== activeSession.userTeamId &&
      currentSlot.teamName !== activeSession.userTeamName,
  );
  React.useEffect(() => {
    if (!activeSession || !isBotTurn || isAutoAdvancingBotsRef.current) {
      return;
    }
    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      isAutoAdvancingBotsRef.current = true;
      setIsAutoAdvancingBots(true);
      try {
        const nextSession = await makeMockDraftBotPick(activeSession.id);
        if (cancelled) {
          return;
        }
        setActiveSession(nextSession);
        setErrorMessage("");
        if (nextSession.status === "complete") {
          await refreshHistory();
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Bot pick failed.");
        }
      } finally {
        isAutoAdvancingBotsRef.current = false;
        setIsAutoAdvancingBots(false);
      }
    }, DRAFT_SPEED_DELAY_MS[draftSpeed]);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeSession, draftSpeed, isBotTurn, refreshHistory]);

  const timerKey = `${activeSession?.id ?? "none"}:${activeSession?.currentPick ?? "none"}:${activeSession?.status ?? "none"}`;
  React.useEffect(() => {
    if (isUserTurn && activeSession?.pickTimerSeconds) {
      setTimeRemaining(activeSession.pickTimerSeconds);
      setTimerNotice("");
      timerAlertSecondRef.current = null;
      return;
    }
    setTimeRemaining(null);
    timerAlertSecondRef.current = null;
    if (!isUserTurn) {
      setTimerNotice("");
    }
  }, [activeSession?.pickTimerSeconds, isUserTurn, timerKey]);

  React.useEffect(() => {
    if (!isUserTurn || timeRemaining === null || activeSession?.status !== "in_progress") {
      return;
    }
    const intervalId = window.setInterval(() => {
      setTimeRemaining((current) => {
        if (current === null) {
          return current;
        }
        return Math.max(0, current - 1);
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [activeSession?.status, isUserTurn, timeRemaining]);

  React.useEffect(() => {
    if (!isUserTurn || timeRemaining !== 0 || activeSession?.status !== "in_progress") {
      return;
    }
    setTimerNotice("Timer expired. Draft paused; choose a player to continue.");
    void pauseSession();
  }, [activeSession?.status, isUserTurn, pauseSession, timeRemaining]);

  React.useEffect(() => {
    if (
      !isUserTurn ||
      activeSession?.status !== "in_progress" ||
      timeRemaining === null ||
      timeRemaining > 10 ||
      timeRemaining <= 0 ||
      timerAlertSecondRef.current === timeRemaining
    ) {
      return;
    }
    timerAlertSecondRef.current = timeRemaining;
    playDraftTimerAlert();
  }, [activeSession?.status, isUserTurn, timeRemaining]);

  React.useEffect(() => {
    if (!isUserTurn || activeSession?.status !== "in_progress") {
      return;
    }
    const alertKey = `${activeSession.id}:${activeSession.currentPick ?? "none"}`;
    if (userTurnAlertKeyRef.current === alertKey) {
      return;
    }
    userTurnAlertKeyRef.current = alertKey;
    playDraftTurnAlert();
  }, [activeSession?.currentPick, activeSession?.id, activeSession?.status, isUserTurn]);

  const positionOptions = React.useMemo(
    () =>
      Array.from(new Set(activeSession?.availablePlayers.map((player) => player.position).filter(Boolean) ?? []))
        .sort((a, b) => a.localeCompare(b)),
    [activeSession?.availablePlayers],
  );
  const filteredPlayers = React.useMemo(() => {
    const query = playerSearch.trim().toLowerCase();
    return (activeSession?.availablePlayers ?? [])
      .filter((player) => positionFilter === "ALL" || player.position === positionFilter)
      .filter((player) => {
        if (!query) {
          return true;
        }
        return [player.playerName, player.position, player.nflTeam]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .slice(0, 80);
  }, [activeSession?.availablePlayers, playerSearch, positionFilter]);
  const userRoster = React.useMemo(() => {
    if (!activeSession) {
      return [];
    }
    return activeSession.picks.filter(
      (pick) =>
        pick.teamId === activeSession.userTeamId ||
        pick.teamName === activeSession.userTeamName,
    );
  }, [activeSession]);
  const lastBotPick = React.useMemo(() => {
    return activeSession?.picks.slice().reverse().find((pick) => pick.source === "bot") ?? null;
  }, [activeSession?.picks]);
  const rosterCounts = React.useMemo(() => {
    return userRoster.reduce<Record<string, number>>((counts, pick) => {
      const position = pick.position || "UNK";
      counts[position] = (counts[position] ?? 0) + 1;
      return counts;
    }, {});
  }, [userRoster]);
  const positionsAtLimit = React.useMemo(() => {
    const maxCounts = data.league?.rosterSettings?.maxPositionCounts ?? {};
    const limited = new Set<string>();
    for (const [pos, cap] of Object.entries(maxCounts)) {
      if (cap > 0 && (rosterCounts[pos] ?? 0) >= cap) {
        limited.add(pos);
      }
    }
    return limited;
  }, [data.league?.rosterSettings?.maxPositionCounts, rosterCounts]);
  const timerLabel =
    timerNotice
      ? "Expired"
      : activeSession?.pickTimerSeconds && timeRemaining !== null
      ? `${timeRemaining}s`
      : activeSession?.pickTimerSeconds
        ? `${activeSession.pickTimerSeconds}s`
        : "No limit";
  const isTimerCritical = isUserTurn && timeRemaining !== null && timeRemaining <= 10;

  return (
    <PagePanel
      title="Mock Draft"
      description="League-specific draft setup, saved results, and recap history."
      action={
        <Button disabled={isBusy || isLoading || !leagueId} onClick={refreshHistory} variant="outline">
          <RefreshCw className="mr-2 size-4" aria-hidden="true" />
          Refresh
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <MetricStrip label="User Team" value={userTeam?.name ?? "Unassigned"} />
          <MetricStrip label="Selected Keepers" value={keeperCount.toString()} />
          <MetricStrip label="ADP Snapshot" value={data.activeSnapshot?.name ?? "Not loaded"} />
          <MetricStrip label="Completed Mocks" value={history.length.toString()} />
        </div>

        {errorMessage ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            {errorMessage}
          </div>
        ) : null}

        {strategyGenerationMessage ? <StrategyGenerationDialog message={strategyGenerationMessage} /> : null}

        <div className="grid gap-5">
          <section className="rounded-md border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-950">Setup</h2>
                <p className="text-sm text-zinc-500">{userTeam?.name ?? "No assigned team"}</p>
              </div>
              <Badge variant={leagueId ? "success" : "warning"}>{leagueId ? "API" : "Mock"}</Badge>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700">Timer</span>
                <select
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                  value={form.pickTimerSeconds ?? "none"}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      pickTimerSeconds:
                        event.target.value === "none"
                          ? null
                          : (Number(event.target.value) as 30 | 60 | 90 | 120),
                    }))
                  }
                >
                  <option value="none">No limit</option>
                  <option value="30">30 seconds</option>
                  <option value="60">60 seconds</option>
                  <option value="90">90 seconds</option>
                  <option value="120">120 seconds</option>
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700">Bot Personality</span>
                <select
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                  value={form.defaultPersonality}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, defaultPersonality: event.target.value }))
                  }
                >
                  {mockDraftPersonalities.map((personality) => (
                    <option key={personality} value={personality}>
                      {personality}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700">Bot Difficulty</span>
                <select
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                  value={form.defaultDifficulty}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, defaultDifficulty: event.target.value }))
                  }
                >
                  {mockDraftDifficulties.map((difficulty) => (
                    <option key={difficulty} value={difficulty}>
                      {difficulty}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700">Draft Speed</span>
                <select
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                  value={draftSpeed}
                  onChange={(event) => setDraftSpeed(event.target.value as MockDraftSpeed)}
                >
                  {mockDraftSpeeds.map((speed) => (
                    <option key={speed} value={speed}>
                      {speed}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-950">Team Bot Overrides</h3>
                  <p className="text-xs text-zinc-500">Unset teams use the global bot settings.</p>
                </div>
                <Badge variant="info">
                  {Object.keys(form.teamBotOverrides).length} custom
                </Badge>
              </div>
              <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
                {data.teams
                  .filter((team) => team.id !== userTeam?.id)
                  .map((team) => {
                    const override = form.teamBotOverrides[team.id];
                    return (
                      <div
                        className="grid gap-2 rounded-md border border-zinc-200 bg-white p-2 sm:grid-cols-[minmax(0,1fr)_150px_130px_auto]"
                        key={team.id}
                      >
                        <div className="min-w-0 self-center">
                          <p className="truncate text-sm font-medium text-zinc-950">{team.name}</p>
                          <p className="text-xs text-zinc-500">
                            Slot {team.draftSlot || "-"}
                          </p>
                        </div>
                        <select
                          className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm"
                          value={override?.personality ?? form.defaultPersonality}
                          onChange={(event) =>
                            setTeamBotOverride(
                              setForm,
                              team.id,
                              event.target.value,
                              override?.difficulty ?? form.defaultDifficulty,
                              form,
                            )
                          }
                        >
                          {mockDraftPersonalities.map((personality) => (
                            <option key={personality} value={personality}>
                              {personality}
                            </option>
                          ))}
                        </select>
                        <select
                          className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm"
                          value={override?.difficulty ?? form.defaultDifficulty}
                          onChange={(event) =>
                            setTeamBotOverride(
                              setForm,
                              team.id,
                              override?.personality ?? form.defaultPersonality,
                              event.target.value,
                              form,
                            )
                          }
                        >
                          {mockDraftDifficulties.map((difficulty) => (
                            <option key={difficulty} value={difficulty}>
                              {difficulty}
                            </option>
                          ))}
                        </select>
                        <Button
                          disabled={!override}
                          onClick={() =>
                            setForm((current) => {
                              const next = { ...current.teamBotOverrides };
                              delete next[team.id];
                              return { ...current, teamBotOverrides: next };
                            })
                          }
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Reset
                        </Button>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button disabled={isBusy || isLoading || !leagueId || !userTeam} onClick={startNewSession}>
                <Play className="mr-2 size-4" aria-hidden="true" />
                Create Draft Room
              </Button>
              {activeSession ? (
                <Button onClick={() => setIsDraftWorkspaceOpen(true)} type="button" variant="outline">
                  Open Active Draft
                </Button>
              ) : null}
            </div>
          </section>
        </div>

        {activeSession && isDraftWorkspaceOpen ? (
          <div
            aria-label="Mock Draft Room"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-zinc-950/60 p-3 sm:p-5"
            role="dialog"
          >
            <div className="flex h-full flex-col overflow-hidden rounded-md bg-white shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-base font-semibold text-zinc-950">Mock Draft Room</h2>
                    {isUserTurn && activeSession.pickTimerSeconds ? (
                      <div
                        aria-live="polite"
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-sm font-semibold tabular-nums",
                          isTimerCritical
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800",
                        )}
                        role="timer"
                      >
                        {timerLabel}
                      </div>
                    ) : null}
                  </div>
                  <p className="text-sm text-zinc-500">
                    {activeSession.currentPick
                      ? `Pick ${activeSession.currentPick}: ${currentSlot?.teamName ?? "Current team"}`
                      : "Draft complete"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={activeSession.status === "in_progress" ? "success" : "default"}>
                    {activeSession.status.replace("_", " ")}
                  </Badge>
                  <Button onClick={() => setIsDraftWorkspaceOpen(false)} size="sm" variant="ghost">
                    <X className="mr-2 size-4" aria-hidden="true" />
                    Close
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-4">
                <div className="space-y-5">
                  <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.75fr)]">
                    <div className="space-y-5">
                    <MockDraftStrategyPanel
                      disabled={isBusy || isLoading}
                      onGenerate={generateStrategyPlan}
                      onStart={startActiveSession}
                      session={activeSession}
                    />

                    <section className="rounded-md border border-zinc-200 bg-white p-4">
                      <div className="grid gap-3 sm:grid-cols-4">
                        <MetricStrip label="Board Picks" value={activeSession.board.length.toString()} />
                        <MetricStrip label="Drafted" value={activeSession.picks.length.toString()} />
                        <MetricStrip label="Available" value={activeSession.availablePlayers.length.toString()} />
                        <MetricStrip label="Timer" value={timerLabel} />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          disabled={isBusy || isLoading || activeSession.status !== "setup"}
                          onClick={startActiveSession}
                          variant="default"
                        >
                          <Play className="mr-2 size-4" aria-hidden="true" />
                          Start Draft
                        </Button>
                        <Button
                          disabled={isBusy || isLoading || isAutoAdvancingBots || !isBotTurn}
                          onClick={advanceBotPick}
                          variant="outline"
                        >
                          <Bot className="mr-2 size-4" aria-hidden="true" />
                          Bot Pick
                        </Button>
                        <Button
                          disabled={isBusy || isLoading || activeSession.status !== "in_progress"}
                          onClick={pauseSession}
                          variant="outline"
                        >
                          Pause
                        </Button>
                        <Button
                          disabled={isBusy || isLoading || activeSession.status !== "paused"}
                          onClick={resumeSession}
                          variant="outline"
                        >
                          Resume
                        </Button>
                        <Button
                          disabled={
                            isBusy ||
                            isLoading ||
                            activeSession.status === "complete" ||
                            activeSession.status === "abandoned"
                          }
                          onClick={endSession}
                          variant="outline"
                        >
                          End
                        </Button>
                      </div>
                      <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                        {activeSession.status === "paused"
                          ? "Draft paused."
                          : activeSession.status === "setup"
                            ? "Review the strategy plan, then start the draft."
                            : isUserTurn
                            ? "Your team is on the clock."
                            : isAutoAdvancingBots
                              ? "Bot pick is being generated."
                              : isBotTurn
                                ? `${currentSlot?.teamName ?? "A bot team"} is on the clock; bot pick will run automatically.`
                                : activeSession.status === "complete"
                                  ? activeSession.analysis?.summary ?? "Draft complete."
                                  : "Draft is ready."}
                        {lastBotPick?.reasoningSummary ? (
                          <p className="mt-2 text-xs text-zinc-500">{lastBotPick.reasoningSummary}</p>
                        ) : null}
                        {timerNotice ? (
                          <p className="mt-2 text-xs font-medium text-amber-700">{timerNotice}</p>
                        ) : null}
                      </div>
                    </section>

                  </div>

                  <div className="space-y-5">
                    <section className="rounded-md border border-zinc-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-base font-semibold text-zinc-950">Available Players</h2>
                          <p className="text-sm text-zinc-500">
                            {isUserPickSlot ? "Select a player for your pick." : "Visible player pool from current ADP."}
                          </p>
                        </div>
                        <Badge variant={isUserPickSlot ? "success" : "default"}>
                          {isUserPickSlot ? "User pick" : "Locked"}
                        </Badge>
                      </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
                <Input
                  placeholder="Search players"
                  value={playerSearch}
                  onChange={(event) => setPlayerSearch(event.target.value)}
                />
                <select
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                  value={positionFilter}
                  onChange={(event) => setPositionFilter(event.target.value)}
                >
                  <option value="ALL">All positions</option>
                  {positionOptions.map((position) => (
                    <option key={position} value={position}>
                      {position}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 max-h-[390px] overflow-auto rounded-md border border-zinc-200">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="py-1.5 pl-2 pr-2">Player</th>
                      <th className="py-1.5 pr-2">Pos</th>
                      <th className="py-1.5 pr-2">NFL</th>
                      <th className="py-1.5 pr-2">ADP</th>
                      <th className="py-1.5 pr-2">Proj</th>
                      <th className="py-1.5 pr-2">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredPlayers.map((player, index) => {
                      const value =
                        activeSession.currentPick && player.adpPick !== null
                          ? player.adpPick - activeSession.currentPick
                          : null;
                      return (
                        <tr key={player.playerId}>
                          <td className="py-1.5 pl-2 pr-2">
                            <div className="flex items-center gap-2">
                              <Button
                                disabled={isBusy || isLoading || !isUserPickSlot || positionsAtLimit.has(player.position)}
                                onClick={() => void draftPlayer(player.playerId)}
                                size="sm"
                                title={positionsAtLimit.has(player.position) ? `${player.position} draft limit reached` : undefined}
                              >
                                Draft
                              </Button>
                              <button
                                className="min-w-0 truncate text-left font-medium text-zinc-950 underline-offset-2 hover:text-emerald-800 hover:underline"
                                onClick={() => setSelectedPlayer(player)}
                                type="button"
                              >
                                <span className="mr-1 text-zinc-400">{index + 1}.</span>
                                {player.playerName}
                              </button>
                            </div>
                          </td>
                          <td className="py-1.5 pr-2">
                            <PositionBadge position={player.position} />
                          </td>
                          <td className="py-1.5 pr-2 text-zinc-600">{player.nflTeam || "-"}</td>
                          <td className="py-1.5 pr-2 text-zinc-600">
                            {player.adpPick === null ? "-" : formatter.format(player.adpPick)}
                          </td>
                          <td className="py-1.5 pr-2 text-zinc-600">
                            {player.projection === null ? "-" : formatter.format(player.projection)}
                          </td>
                          <td className="py-1.5 pr-2 text-zinc-600">
                            {value === null ? "-" : formatter.format(value)}
                          </td>
                        </tr>
                      );
                    })}
                    {!filteredPlayers.length ? (
                      <tr>
                        <td className="py-5 pl-3 text-zinc-500" colSpan={6}>
                          No available players match the current filters.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
                    </section>

                    <section className="rounded-md border border-zinc-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-base font-semibold text-zinc-950">{activeSession.userTeamName}</h2>
                          <p className="text-sm text-zinc-500">Drafted roster</p>
                        </div>
                        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                          {Object.entries(rosterCounts)
                            .sort(([left], [right]) => left.localeCompare(right))
                            .map(([position, count]) => `${position}: ${count}`)
                            .join("  ") || "No drafted positions yet."}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {activeSession.rosterNeeds.map((need) => {
                          const isCapHit = need.remaining > 0 && positionsAtLimit.has(need.slot);
                          return (
                            <div
                              className={cn(
                                "rounded-md border px-2 py-1.5",
                                isCapHit
                                  ? "border-rose-200 bg-rose-50"
                                  : need.remaining > 0
                                  ? "border-amber-200 bg-amber-50"
                                  : "border-emerald-200 bg-emerald-50",
                              )}
                              key={need.slot}
                              title={isCapHit ? `${need.slot} draft limit reached` : undefined}
                            >
                              <p className="truncate text-[10px] font-semibold uppercase text-zinc-500">{need.slot}</p>
                              <p className={cn("mt-0.5 text-sm font-semibold", isCapHit ? "text-rose-700" : "text-zinc-950")}>
                                {need.filled}/{need.target}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 max-h-64 space-y-2 overflow-auto">
                        {userRoster.map((pick) => (
                          <div
                            className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
                            key={pick.id}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-zinc-950">{pick.playerName}</p>
                              <p className="text-zinc-500">Pick {pick.overallPick}</p>
                            </div>
                            <PositionBadge position={pick.position} />
                          </div>
                        ))}
                        {!userRoster.length ? (
                          <div className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
                            No drafted players yet.
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </div>
                </div>
                  <section className="rounded-md border border-zinc-200 bg-white p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-zinc-950">Draft Board</h2>
                        <p className="text-sm text-zinc-500">Current pick stays highlighted as the draft advances.</p>
                      </div>
                      <label className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                        <input
                          checked={autoScrollBoard}
                          className="size-4 accent-emerald-700"
                          onChange={(event) => setAutoScrollBoard(event.target.checked)}
                          type="checkbox"
                        />
                        Auto-scroll
                      </label>
                    </div>
                    <MockDraftBoardPreview
                      autoScroll={autoScrollBoard}
                      session={activeSession}
                      currentUser={currentUser}
                    />
                  </section>

                  {activeSession.status === "complete" ? (
                    <MockDraftRecap
                      session={activeSession}
                      currentUser={currentUser}
                      onRerun={() => prepareRerun(activeSession)}
                    />
                  ) : null}
                </div>
              </div>
            </div>
            {selectedPlayer ? (
              <MockDraftPlayerDialog
                currentPick={activeSession.currentPick}
                disabled={isBusy || isLoading || !isUserPickSlot}
                leagueId={activeSession.leagueId}
                snapshotId={activeSession.adpSnapshotId}
                onClose={() => setSelectedPlayer(null)}
                onDraft={() => {
                  const playerId = selectedPlayer.playerId;
                  setSelectedPlayer(null);
                  void draftPlayer(playerId);
                }}
                player={selectedPlayer}
              />
            ) : null}
          </div>
        ) : null}

        <section className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="size-4 text-zinc-500" aria-hidden="true" />
              <h2 className="text-base font-semibold text-zinc-950">History</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={isBusy || isLoading || selectedComparisonIds.length < 2}
                onClick={loadComparison}
                size="sm"
                variant="outline"
              >
                Compare Selected
              </Button>
              <Button
                disabled={!selectedComparisonIds.length && !comparisonSessions.length}
                onClick={() => {
                  setSelectedComparisonIds([]);
                  setComparisonSessions([]);
                }}
                size="sm"
                variant="ghost"
              >
                Clear
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-2 pr-4">Compare</th>
                  <th className="py-2 pr-4">Completed</th>
                  <th className="py-2 pr-4">Team</th>
                  <th className="py-2 pr-4">Rounds</th>
                  <th className="py-2 pr-4">Timer</th>
                  <th className="py-2 pr-4">Grade</th>
                  <th className="py-2 pr-4">Summary</th>
                  <th className="py-2 pr-0 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className="py-3 pr-4">
                      <input
                        aria-label={`Compare mock draft ${row.id}`}
                        checked={selectedComparisonIds.includes(row.id)}
                        className="size-4 rounded border-zinc-300"
                        onChange={() => toggleComparison(row.id)}
                        type="checkbox"
                      />
                    </td>
                    <td className="py-3 pr-4 text-zinc-700">{formatMockDraftDate(row.completedAt)}</td>
                    <td className="py-3 pr-4 font-medium text-zinc-950">{row.userTeamName}</td>
                    <td className="py-3 pr-4 text-zinc-700">{row.roundCount}</td>
                    <td className="py-3 pr-4 text-zinc-700">
                      {row.pickTimerSeconds ? `${row.pickTimerSeconds}s` : "No limit"}
                    </td>
                    <td className="py-3 pr-4">
                      {row.overallLetterGrade ? (
                        <Badge variant="info">
                          {row.overallLetterGrade}
                          {row.overallNumericScore !== null ? ` ${row.overallNumericScore}` : ""}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="max-w-[360px] truncate py-3 pr-4 text-zinc-600">{row.summary}</td>
                    <td className="py-3 pr-0">
                      <div className="flex justify-end gap-2">
                        <Button
                          disabled={isBusy || isLoading}
                          onClick={() => void openHistorySession(row.id)}
                          size="sm"
                          variant="outline"
                        >
                          Open
                        </Button>
                        <Button
                          disabled={isBusy || isLoading}
                          onClick={() => void rerunFromHistory(row.id)}
                          size="sm"
                          variant="outline"
                        >
                          Rerun
                        </Button>
                        <Button
                          disabled={isBusy || isLoading}
                          onClick={() => void deleteHistorySession(row.id)}
                          size="sm"
                          variant="destructive"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!history.length ? (
                  <tr>
                    <td className="py-5 text-zinc-500" colSpan={8}>
                      No completed mock drafts.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {comparisonSessions.length ? (
            <MockDraftComparison sessions={comparisonSessions} />
          ) : null}
        </section>
      </div>
    </PagePanel>
  );
}

function MockDraftStrategyPanel({
  disabled,
  onGenerate,
  onStart,
  session,
}: {
  disabled: boolean;
  onGenerate: () => void;
  onStart: () => void;
  session: MockDraftSession;
}) {
  const plan = session.strategyPlan;
  const currentRound = session.currentPick
    ? session.board.find((slot) => slot.overallPick === session.currentPick)?.round
    : null;
  const currentRoundPlan = plan?.roundPlan.find(
    (item) => strategyNumber(item.round) === currentRound,
  );
  const liveAdvice = buildLiveStrategyAdvice(session);
  const priorities = buildLivePositionPriorities(session, plan?.positionPriorities ?? []);
  const topTargets = buildLiveTargets(session, plan?.targets ?? []);

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">Strategy Coach</h2>
          <p className="text-sm text-zinc-500">
            {plan?.aiUsed ? `AI plan from ${plan.model ?? "model"}` : "Cached draft plan"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {session.status === "setup" ? (
            <Button disabled={disabled} onClick={onStart} size="sm">
              <Play className="mr-2 size-4" aria-hidden="true" />
              Start Draft
            </Button>
          ) : null}
          <Button
            disabled={disabled || !["setup", "paused"].includes(session.status)}
            onClick={onGenerate}
            size="sm"
            variant="outline"
          >
            <RefreshCw className="mr-2 size-4" aria-hidden="true" />
            Regenerate
          </Button>
        </div>
      </div>

      {plan ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-6 text-zinc-700">{plan.summary}</p>
          {plan.error ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              AI plan fell back to deterministic guidance: {plan.error}
            </div>
          ) : null}

          {liveAdvice ? (
            <div className="rounded-md border border-sky-200 bg-sky-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-sky-950">
                  Live guidance: {liveAdvice.priority}
                </p>
                <Badge variant="info">Updates after picks</Badge>
              </div>
              <p className="mt-1 text-sm text-sky-900">{liveAdvice.detail}</p>
              {liveAdvice.targets.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {liveAdvice.targets.map((player) => (
                    <span
                      className="rounded-md border border-sky-200 bg-white px-2 py-1 text-xs text-sky-900"
                      key={player.playerId}
                    >
                      {player.playerName}
                      {player.position ? ` ${player.position}` : ""}
                      {player.adpPick ? `, ADP ${player.adpPick}` : ""}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {currentRoundPlan ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-emerald-950">
                  Round {currentRound}: {strategyText(currentRoundPlan.priority)}
                </p>
                <Badge variant="success">Current round</Badge>
              </div>
              <p className="mt-1 text-sm text-emerald-900">{strategyText(currentRoundPlan.notes)}</p>
              <p className="mt-1 text-xs text-emerald-800">
                Avoid: {strategyText(currentRoundPlan.avoid)}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="text-sm font-semibold text-zinc-950">Priorities</h3>
              <div className="mt-2 space-y-2">
                {priorities.map((item, index) => (
                  <div
                    className="flex items-start justify-between gap-2 text-sm"
                    key={`${strategyText(item.position)}-${index}`}
                  >
                    <span className="font-medium text-zinc-800">{strategyText(item.position)}</span>
                    <span className="text-right text-zinc-600">{strategyText(item.priority)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 lg:col-span-2">
              <h3 className="text-sm font-semibold text-zinc-950">Targets</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {topTargets.map((item, index) => (
                  <div
                    className="rounded-md border border-zinc-200 bg-white p-2"
                    key={`${item.playerId}-${index}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-zinc-950">
                        {item.playerName}
                      </p>
                      <PositionBadge position={item.position} />
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.reason}
                      {item.acceptableRange ? ` Range ${item.acceptableRange}` : ""}
                    </p>
                  </div>
                ))}
                {!topTargets.length ? (
                  <p className="rounded-md border border-dashed border-zinc-300 bg-white p-3 text-sm text-zinc-500 sm:col-span-2">
                    No current targets remain from the strategy plan.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
          No strategy plan is attached to this draft yet.
        </div>
      )}
    </section>
  );
}

function MockDraftBoardPreview({
  autoScroll,
  session,
  currentUser,
}: {
  autoScroll: boolean;
  session: MockDraftSession;
  currentUser: AuthUser | null;
}) {
  const currentPickRef = React.useRef<HTMLDivElement | null>(null);
  const boardScrollRef = React.useRef<HTMLDivElement | null>(null);
  const rounds = React.useMemo(() => {
    const grouped = new Map<number, MockDraftSession["board"]>();
    for (const slot of session.board) {
      grouped.set(slot.round, [...(grouped.get(slot.round) ?? []), slot]);
    }
    return Array.from(grouped.entries())
      .sort(([left], [right]) => left - right)
      .map(([round, slots]) => ({
        round,
        slots: slots.slice().sort((left, right) => left.pickInRound - right.pickInRound),
      }));
  }, [session.board]);
  React.useEffect(() => {
    if (!autoScroll || !session.currentPick) {
      return;
    }
    const container = boardScrollRef.current;
    const currentPick = currentPickRef.current;
    if (!container || !currentPick) {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const pickRect = currentPick.getBoundingClientRect();
    const left =
      container.scrollLeft +
      pickRect.left -
      containerRect.left -
      container.clientWidth / 2 +
      currentPick.clientWidth / 2;
    const top =
      container.scrollTop +
      pickRect.top -
      containerRect.top -
      container.clientHeight / 2 +
      currentPick.clientHeight / 2;
    container.scrollTo({
      behavior: "smooth",
      left: Math.max(0, left),
      top: Math.max(0, top),
    });
  }, [autoScroll, session.currentPick]);

  return (
    <div ref={boardScrollRef} className="max-h-[560px] space-y-3 overflow-auto pb-2 pr-2">
      {rounds.map(({ round, slots }) => (
        <div className="min-w-[1420px]" key={round}>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-semibold text-white">
              Round {round}
            </span>
          </div>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(156px, 1fr))` }}
          >
            {slots.map((slot) => {
              const isUserTeam =
                slot.teamId === currentUser?.teamId || slot.teamName === currentUser?.teamName;
              const isCurrentPick = slot.overallPick === session.currentPick;
              return (
                <div
                  className={cn(
                    "min-h-28 rounded-md border p-3 text-xs",
                    slot.status === "Keeper"
                      ? "border-rose-200 bg-rose-50 text-rose-950"
                      : slot.status === "Drafted"
                        ? "border-sky-200 bg-sky-50 text-sky-950"
                        : "border-zinc-200 bg-zinc-50 text-zinc-800",
                    isUserTeam && "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200",
                    isCurrentPick && "border-amber-400 bg-amber-50 ring-2 ring-amber-300",
                  )}
                  key={slot.overallPick}
                  ref={isCurrentPick ? currentPickRef : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{slot.overallPick}</span>
                    <span className="text-[10px] uppercase text-zinc-500">{slot.status}</span>
                  </div>
                  <p className="mt-1 truncate font-medium">{slot.teamName}</p>
                  <p className="mt-1 line-clamp-2 text-zinc-600">
                    {slot.pick ? `${slot.pick.playerName} ${slot.pick.position ? `(${slot.pick.position})` : ""}` : "Open"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StrategyGenerationDialog({ message }: { message: string }) {
  return (
    <div
      aria-label="Strategy generation in progress"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/55 p-4"
      role="dialog"
    >
      <div
        aria-live="polite"
        className="flex w-full max-w-sm items-center gap-3 rounded-md border border-zinc-200 bg-white p-4 shadow-xl"
        role="status"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
          <RefreshCw className="size-5 animate-spin" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">{message}</h3>
          <p className="mt-1 text-sm text-zinc-500">Waiting for the AI response.</p>
        </div>
      </div>
    </div>
  );
}

function playDraftTimerAlert() {
  playToneSequence([{ frequency: 880, start: 0, duration: 0.18, peak: 0.12 }]);
}

function playDraftTurnAlert() {
  playToneSequence([
    { frequency: 660, start: 0, duration: 0.16, peak: 0.11 },
    { frequency: 880, start: 0.18, duration: 0.2, peak: 0.13 },
  ]);
}

function playToneSequence(
  tones: { frequency: number; start: number; duration: number; peak: number }[],
) {
  if (typeof window === "undefined") {
    return;
  }
  const audioWindow = window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextClass = window.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }
  try {
    const context = new AudioContextClass();
    let latestStop = context.currentTime;
    for (const tone of tones) {
      const start = context.currentTime + tone.start;
      const stop = start + tone.duration;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = tone.frequency;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(tone.peak, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, stop);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(stop);
      latestStop = Math.max(latestStop, stop);
    }
    window.setTimeout(() => {
      void context.close();
    }, Math.max(250, (latestStop - context.currentTime) * 1000 + 80));
  } catch {
    // Browsers can block audio until the page has received a user gesture.
  }
}

const DRAFT_REC_VARIANT: Record<
  PlayerSummary["draft_recommendation"],
  "success" | "info" | "warning" | "danger"
> = {
  "draft now": "success",
  "target next round": "info",
  watchlist: "warning",
  avoid: "danger",
};

function MockDraftPlayerDialog({
  currentPick,
  disabled,
  leagueId,
  snapshotId,
  onClose,
  onDraft,
  player,
}: {
  currentPick: number | null;
  disabled: boolean;
  leagueId: string;
  snapshotId: string | null;
  onClose: () => void;
  onDraft: () => void;
  player: MockDraftAvailablePlayer;
}) {
  const [summary, setSummary] = React.useState<PlayerSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = React.useState(false);

  React.useEffect(() => {
    if (!snapshotId) return;
    let cancelled = false;
    setSummary(null);
    setSummaryLoading(true);
    void (async () => {
      try {
        const cached = await getPlayerSummary(leagueId, player.playerId, snapshotId);
        if (cancelled) return;
        if (cached) {
          setSummary(cached);
          setSummaryLoading(false);
          return;
        }
        const generated = await generatePlayerSummary(leagueId, player.playerId, snapshotId);
        if (!cancelled) setSummary(generated);
      } catch {
        // AI unavailable — summary stays null, no error shown
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leagueId, player.playerId, snapshotId]);

  const value =
    currentPick && player.adpPick !== null
      ? player.adpPick - currentPick
      : null;
  const valueLabel =
    value === null
      ? "No ADP edge"
      : value >= 12
        ? "Strong value"
        : value >= 0
          ? "Fair value"
          : "Reach";
  return (
    <div
      aria-label={`${player.playerName} details`}
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/50 p-4"
      role="dialog"
    >
      <div className="w-full max-w-lg overflow-y-auto rounded-md bg-white shadow-xl" style={{ maxHeight: "90vh" }}>
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 p-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-zinc-950">{player.playerName}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PositionBadge position={player.position} />
              <Badge variant="info">{player.nflTeam || "FA"}</Badge>
              <Badge variant={value !== null && value >= 0 ? "success" : "warning"}>{valueLabel}</Badge>
              {summary && (
                <Badge variant={DRAFT_REC_VARIANT[summary.draft_recommendation]}>
                  {summary.draft_recommendation}
                </Badge>
              )}
            </div>
          </div>
          <Button onClick={onClose} size="sm" variant="ghost">
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <MetricStrip
            label="Projected Points"
            value={player.projection === null ? "-" : formatter.format(player.projection)}
          />
          <MetricStrip
            label="ADP Pick"
            value={player.adpPick === null ? "-" : formatter.format(player.adpPick)}
          />
          <MetricStrip
            label="ADP Round"
            value={player.adpRound === null ? "-" : formatter.format(player.adpRound)}
          />
          <MetricStrip
            label="Pick Value"
            value={value === null ? "-" : formatter.format(value)}
          />
          <MetricStrip
            label="Risk"
            value={player.risk === null ? "-" : formatter.format(player.risk)}
          />
          <MetricStrip label="Position" value={player.position || "-"} />
        </div>

        {summaryLoading ? (
          <div className="border-t border-zinc-200 px-4 pb-3 pt-3">
            <p className="flex items-center gap-2 text-sm text-zinc-500">
              <Bot className="size-4 shrink-0 animate-pulse" aria-hidden="true" />
              Generating AI analysis…
            </p>
          </div>
        ) : summary ? (
          <div className="border-t border-zinc-200 space-y-3 p-4">
            <p className="text-sm font-semibold text-zinc-700">{summary.quick_take}</p>
            <div className="grid gap-2 text-sm text-zinc-600 sm:grid-cols-2">
              <div>
                <span className="font-medium text-zinc-800">Fantasy context: </span>
                {summary.fantasy_points_context}
              </div>
              <div>
                <span className="font-medium text-zinc-800">Value: </span>
                {summary.value_note}
              </div>
              <div>
                <span className="font-medium text-zinc-800">Risk: </span>
                {summary.risk_note}
              </div>
              <div>
                <span className="font-medium text-zinc-800">Roster fit: </span>
                {summary.roster_fit}
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            <p>
              {player.projection === null
                ? "Projection data is unavailable for this player."
                : `${player.projection.toFixed(1)} projected fantasy points are available from the active ADP snapshot.`}
            </p>
            <p className="mt-2">
              {value === null
                ? "No current-pick value can be calculated without ADP and pick context."
                : value >= 0
                  ? `This player is ${formatter.format(value)} picks past market cost at the current pick.`
                  : `This player is ${formatter.format(Math.abs(value))} picks ahead of market cost at the current pick.`}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 p-4">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
          <Button disabled={disabled} onClick={onDraft}>
            Draft
          </Button>
        </div>
      </div>
    </div>
  );
}

function MockDraftRecap({
  session,
  currentUser,
  onRerun,
}: {
  session: MockDraftSession;
  currentUser: AuthUser | null;
  onRerun: () => void;
}) {
  const analysis = session.analysis;
  const userRoster = session.picks.filter(
    (pick) => pick.teamId === session.userTeamId || pick.teamName === session.userTeamName,
  );
  const bestPickFeedback = analysis?.pickFeedback
    .slice()
    .sort((left, right) => feedbackValue(right) - feedbackValue(left))
    .slice(0, 6) ?? [];
  const projected = analysis?.projectedRankings ?? {};
  const componentScores = projected.component_scores as Record<string, unknown> | undefined;

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">Recap</h2>
          <p className="text-sm text-zinc-500">{formatMockDraftDate(session.completedAt)}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Button onClick={() => exportMockDraftRecapCsv(session)} variant="outline">
            <Download className="mr-2 size-4" aria-hidden="true" />
            Export CSV
          </Button>
          <Button onClick={onRerun} variant="outline">
            <RotateCcw className="mr-2 size-4" aria-hidden="true" />
            Rerun Setup
          </Button>
          {analysis ? (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase text-sky-700">Grade</p>
              <p className="text-2xl font-semibold text-sky-950">
                {analysis.overallLetterGrade} {analysis.overallNumericScore}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {analysis ? (
        <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
          {analysis.summary}
        </p>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-md border border-zinc-200 p-4">
          <h3 className="text-sm font-semibold text-zinc-950">Final Roster</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {userRoster.map((pick) => (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm" key={pick.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate font-medium text-zinc-950">{pick.playerName}</p>
                  <PositionBadge position={pick.position} />
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Pick {pick.overallPick} · {pick.source.replace("_", " ")}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 p-4">
          <h3 className="text-sm font-semibold text-zinc-950">Pick Feedback</h3>
          <div className="mt-3 space-y-2">
            {bestPickFeedback.map((feedback, index) => (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm" key={index}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-950">
                      {String(feedback.player_name ?? "Unknown player")}
                    </p>
                    <p className="text-xs text-zinc-500">{formatFeedbackContext(feedback)}</p>
                  </div>
                  <Badge variant={feedbackValue(feedback) >= 0 ? "success" : "warning"}>
                    {formatFeedbackValue(feedback)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-zinc-600">{String(feedback.summary ?? "")}</p>
              </div>
            ))}
            {!bestPickFeedback.length ? (
              <p className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
                No pick feedback saved.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <RecapList title="Strengths" items={analysis?.strengths ?? []} variant="success" />
        <RecapList title="Weaknesses" items={analysis?.weaknesses ?? []} variant="warning" />
      </div>

      {analysis ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)]">
          <div className="rounded-md border border-zinc-200 p-4">
            <h3 className="text-sm font-semibold text-zinc-950">Projection</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MetricStrip
                label="Finish"
                value={String(projected.projected_finish ?? "-")}
              />
              <MetricStrip
                label="Playoff Tier"
                value={String(projected.playoff_odds_tier ?? "TBD")}
              />
              <MetricStrip
                label="Value"
                value={String(componentScores?.value_score ?? "-")}
              />
              <MetricStrip
                label="Roster"
                value={String(componentScores?.roster_construction_score ?? "-")}
              />
            </div>
          </div>

          <div className="rounded-md border border-zinc-200 p-4">
            <h3 className="text-sm font-semibold text-zinc-950">What-If Scenarios</h3>
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {analysis.whatIfScenarios.map((scenario, index) => (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm" key={index}>
                  <p className="font-medium text-zinc-950">{String(scenario.name ?? "Scenario")}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Changed picks: {String(scenario.changed_picks ?? 0)} · Score delta:{" "}
                    {String(scenario.score_delta ?? 0)}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-zinc-600">
                    {String(scenario.recommendation ?? "")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {analysis?.futureAdvice.length ? (
        <div className="mt-5">
          <RecapList title="Future Advice" items={analysis.futureAdvice} variant="success" />
        </div>
      ) : null}

      <div className="mt-5">
        <h3 className="mb-3 text-sm font-semibold text-zinc-950">Final Board</h3>
        <MockDraftBoardPreview autoScroll={false} session={session} currentUser={currentUser} />
      </div>
    </section>
  );
}

function MockDraftComparison({ sessions }: { sessions: MockDraftSession[] }) {
  return (
    <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-950">Comparison</h3>
        <Button onClick={() => exportMockDraftComparisonCsv(sessions)} size="sm" variant="outline">
          <Download className="mr-2 size-4" aria-hidden="true" />
          Export CSV
        </Button>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
            <tr>
              <th className="py-2 pr-4">Completed</th>
              <th className="py-2 pr-4">Grade</th>
              <th className="py-2 pr-4">Value</th>
              <th className="py-2 pr-4">Roster</th>
              <th className="py-2 pr-4">Balance</th>
              <th className="py-2 pr-4">Finish</th>
              <th className="py-2 pr-4">Timer</th>
              <th className="py-2 pr-4">Bots</th>
              <th className="py-2 pr-0">Overrides</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {sessions.map((session) => {
              const projected = session.analysis?.projectedRankings ?? {};
              const components = projected.component_scores as Record<string, unknown> | undefined;
              return (
                <tr key={session.id}>
                  <td className="py-3 pr-4 text-zinc-700">{formatMockDraftDate(session.completedAt)}</td>
                  <td className="py-3 pr-4">
                    <Badge variant="info">
                      {session.analysis?.overallLetterGrade ?? "-"}{" "}
                      {session.analysis?.overallNumericScore ?? ""}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 text-zinc-700">{String(components?.value_score ?? "-")}</td>
                  <td className="py-3 pr-4 text-zinc-700">
                    {String(components?.roster_construction_score ?? "-")}
                  </td>
                  <td className="py-3 pr-4 text-zinc-700">
                    {String(components?.positional_balance_score ?? "-")}
                  </td>
                  <td className="py-3 pr-4 text-zinc-700">
                    {String(projected.projected_finish ?? "-")}
                  </td>
                  <td className="py-3 pr-4 text-zinc-700">
                    {session.pickTimerSeconds ? `${session.pickTimerSeconds}s` : "No limit"}
                  </td>
                  <td className="py-3 pr-4 text-zinc-700">
                    {String(session.botConfig.default_personality ?? "Balanced")} /{" "}
                    {String(session.botConfig.default_difficulty ?? "Medium")}
                  </td>
                  <td className="py-3 pr-0 text-zinc-700">{countTeamBotOverrides(session.botConfig)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecapList({
  title,
  items,
  variant,
}: {
  title: string;
  items: Record<string, unknown>[];
  variant: "success" | "warning";
}) {
  return (
    <div className="rounded-md border border-zinc-200 p-4">
      <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm" key={index}>
            <Badge variant={variant}>{String(item.label ?? title)}</Badge>
            <p className="mt-2 text-zinc-600">{String(item.detail ?? "")}</p>
          </div>
        ))}
        {!items.length ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
            No {title.toLowerCase()} saved.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function feedbackValue(feedback: Record<string, unknown>): number {
  const value = feedback.value_vs_adp;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatFeedbackValue(feedback: Record<string, unknown>): string {
  const value = feedbackValue(feedback);
  if (value === 0) {
    return "ADP even";
  }
  return `${value > 0 ? "+" : ""}${formatter.format(value)}`;
}

function formatFeedbackContext(feedback: Record<string, unknown>): string {
  const source = String(feedback.source ?? "");
  if (source === "keeper_forfeit") {
    return `Keeper cost pick ${String(feedback.keeper_cost_pick ?? feedback.overall_pick ?? "-")} · ADP ${String(feedback.adp_pick ?? "-")}`;
  }
  return `Draft pick ${String(feedback.overall_pick ?? "-")} · ADP ${String(feedback.adp_pick ?? "-")}`;
}

function exportMockDraftRecapCsv(session: MockDraftSession) {
  const analysis = session.analysis;
  const projected = analysis?.projectedRankings ?? {};
  const components = projected.component_scores as Record<string, unknown> | undefined;
  const rows: Record<string, string | number | null>[] = [
    {
      section: "summary",
      completed_at: session.completedAt,
      team: session.userTeamName,
      grade: analysis?.overallLetterGrade ?? null,
      score: analysis?.overallNumericScore ?? null,
      projected_finish: csvScalar(projected.projected_finish),
      value_score: csvScalar(components?.value_score),
      roster_score: csvScalar(components?.roster_construction_score),
      balance_score: csvScalar(components?.positional_balance_score),
      summary: analysis?.summary ?? null,
    },
    ...session.picks
      .filter((pick) => pick.teamId === session.userTeamId || pick.teamName === session.userTeamName)
      .map((pick) => ({
        section: "roster",
        overall_pick: pick.overallPick,
        round: pick.round,
        player: pick.playerName,
        position: pick.position,
        source: pick.source,
      })),
    ...(analysis?.pickFeedback ?? []).map((feedback) => ({
      section: "pick_feedback",
      overall_pick: csvScalar(feedback.overall_pick),
      player: csvScalar(feedback.player_name),
      position: csvScalar(feedback.position),
      grade: csvScalar(feedback.grade),
      adp_pick: csvScalar(feedback.adp_pick),
      value_vs_adp: csvScalar(feedback.value_vs_adp),
      summary: csvScalar(feedback.summary),
    })),
  ];
  downloadCsv(`mock-draft-recap-${session.id}.csv`, rows);
}

function exportMockDraftComparisonCsv(sessions: MockDraftSession[]) {
  const rows = sessions.map((session) => {
    const projected = session.analysis?.projectedRankings ?? {};
    const components = projected.component_scores as Record<string, unknown> | undefined;
    return {
      session_id: session.id,
      completed_at: session.completedAt,
      team: session.userTeamName,
      grade: session.analysis?.overallLetterGrade ?? null,
      score: session.analysis?.overallNumericScore ?? null,
      value_score: csvScalar(components?.value_score),
      roster_score: csvScalar(components?.roster_construction_score),
      balance_score: csvScalar(components?.positional_balance_score),
      projected_finish: csvScalar(projected.projected_finish),
      timer_seconds: session.pickTimerSeconds,
      rounds: session.roundCount,
      default_personality: csvScalar(session.botConfig.default_personality ?? "Balanced"),
      default_difficulty: csvScalar(session.botConfig.default_difficulty ?? "Medium"),
      team_bot_overrides: countTeamBotOverrides(session.botConfig),
      summary: session.analysis?.summary ?? null,
    };
  });
  downloadCsv("mock-draft-comparison.csv", rows);
}

function downloadCsv(filename: string, rows: Record<string, string | number | null | undefined>[]) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csvText = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const textValue = String(value);
  return /[",\n]/.test(textValue) ? `"${textValue.replaceAll('"', '""')}"` : textValue;
}

function csvScalar(value: unknown): string | number | null {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}

function DraftBoardPreview({
  currentUser,
  picks,
}: {
  currentUser: AuthUser | null;
  picks: DraftImpactPick[];
}) {
  const rounds = React.useMemo(() => {
    return Array.from(new Set(picks.map((pick) => pick.round))).sort((a, b) => a - b);
  }, [picks]);
  const picksByRound = new Map<number, DraftImpactPick[]>();
  for (const round of rounds) {
    picksByRound.set(
      round,
      picks.filter((pick) => pick.round === round),
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
      <div className="min-w-[920px] divide-y divide-zinc-100">
        {rounds.map((round) => (
          <div key={round} className="grid grid-cols-[72px_minmax(0,1fr)]">
            <div className="flex items-center justify-center bg-zinc-50 px-3 py-3 text-sm font-semibold text-zinc-700">
              R{round}
            </div>
            <div
              className="grid gap-2 p-2"
              style={{
                gridTemplateColumns: `repeat(${Math.max(picksByRound.get(round)?.length ?? 1, 1)}, minmax(88px, 1fr))`,
              }}
            >
              {(picksByRound.get(round) ?? []).map((pick) => (
                <div
                  className={cn(
                    "min-h-20 rounded-md border p-2 text-xs",
                    pick.status === "Forfeited"
                      ? "border-rose-200 bg-rose-50 text-rose-950"
                      : "border-zinc-200 bg-zinc-50 text-zinc-800",
                    isCurrentUserTeam({ name: pick.team, user: currentUser }) &&
                      "border-emerald-300 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200",
                  )}
                  key={pick.overallPick}
                  title={
                    pick.status === "Forfeited"
                      ? `${pick.team}: ${pick.keeperPlayer}`
                      : `${pick.team}: open pick`
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{pick.overallPick}</span>
                    <span className="text-[10px] uppercase text-zinc-500">{pick.status}</span>
                  </div>
                  <p className="mt-1 truncate font-medium">{pick.team}</p>
                  <p className="mt-1 truncate text-zinc-600">
                    {pick.status === "Forfeited"
                      ? `${pick.keeperPlayer} ${pick.keeperPosition ? `(${pick.keeperPosition})` : ""}`
                      : "Open pick"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectionBadge({ status }: { status: ApiStatus }) {
  const label = {
    error: "API Error",
    live: "API Live",
    loading: "Loading",
    mock: "Mock",
  }[status];
  const variant = status === "live" ? "success" : status === "loading" ? "info" : "warning";
  return <Badge variant={variant}>{label}</Badge>;
}

function ScenarioNarrativePanel({
  narrative,
  loading,
  error,
  onGenerate,
  disabled,
}: {
  narrative: ScenarioNarrative | null;
  loading: boolean;
  error: boolean;
  onGenerate: () => void;
  disabled: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>AI Scenario Analysis</CardTitle>
          <CardDescription>
            AI-generated summary comparing tradeoffs across keeper presets.
          </CardDescription>
        </div>
        <Button disabled={disabled} onClick={onGenerate} variant="outline" size="sm">
          <Bot className="size-4" aria-hidden="true" />
          {loading ? "Generating…" : narrative ? "Regenerate" : "Generate Analysis"}
        </Button>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
            Analyzing scenarios…
          </div>
        )}
        {error && !loading && (
          <p className="text-sm text-red-600">Failed to generate analysis. Please try again.</p>
        )}
        {!loading && !error && !narrative && (
          <p className="text-sm text-zinc-500">
            Click &ldquo;Generate Analysis&rdquo; to get an AI-powered comparison of your keeper
            presets.
          </p>
        )}
        {!loading && narrative && (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-zinc-700">{narrative.summary}</p>
            {narrative.best_fit && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-zinc-500">Best Fit</span>
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  {narrative.best_fit}
                </Badge>
              </div>
            )}
            {narrative.tradeoffs.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-zinc-500">Tradeoffs</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {narrative.tradeoffs.map((t) => (
                    <div
                      key={t.scenario}
                      className="rounded-md border border-zinc-100 bg-zinc-50 p-3 text-sm"
                    >
                      <p className="font-medium text-zinc-800">{t.scenario}</p>
                      {t.benefit && <p className="mt-1 text-emerald-700">{t.benefit}</p>}
                      {t.cost && <p className="mt-0.5 text-red-600">{t.cost}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {narrative.decision_notes.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase text-zinc-500">Decision Notes</p>
                <ul className="space-y-1">
                  {narrative.decision_notes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                      <span className="mt-0.5 text-emerald-500" aria-hidden="true">
                        •
                      </span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScenarioSummaryCard({ scenario }: { scenario: ScenarioComparison }) {
  const selectedKeeperCount = scenario.teams.reduce(
    (sum, team) => sum + team.selectedKeepers.length,
    0,
  );
  const forfeitedPickCount = scenario.teams.reduce(
    (sum, team) => sum + team.picksForfeited.length,
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{scenario.scenarioName}</CardTitle>
        <CardDescription>{scenario.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-500">Keepers</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{selectedKeeperCount}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-500">Picks Lost</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{forfeitedPickCount}</p>
          </div>
        </div>
        <p className="text-sm leading-6 text-zinc-700">{scenario.strategicNotes}</p>
      </CardContent>
    </Card>
  );
}

function ScenarioTeamCell({ teamResult }: { teamResult: ScenarioTeamResult }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase text-zinc-500">Keepers</span>
        <span className="font-semibold text-zinc-950">{teamResult.selectedKeepers.length}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {teamResult.selectedKeepers.length ? (
          teamResult.selectedKeepers.map((keeper) => (
            <Badge key={`${keeper.player}-${keeper.position}`} variant="success">
              {keeper.player} ({keeper.position})
            </Badge>
          ))
        ) : (
          <Badge>No keepers</Badge>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Picks Forfeited</p>
        <p className="text-sm text-zinc-800">
          {teamResult.picksForfeited.length ? teamResult.picksForfeited.join(", ") : "None"}
        </p>
      </div>

      <p className="text-sm leading-6 text-zinc-600">{teamResult.strategicNotes}</p>
    </div>
  );
}

function KeeperRecommendationsTable({
  data,
  compact = false,
  onOverride,
  resetSignal,
  showOverrides = false,
  teamCount,
}: {
  data: KeeperRecommendation[];
  compact?: boolean;
  onOverride?: (
    teamId: string | undefined,
    playerId: string | undefined,
    overrideType: ManualOverrideType,
  ) => void;
  resetSignal?: number;
  showOverrides?: boolean;
  teamCount?: number;
}) {
  const { currentUser, data: workspaceData } = useDashboard();
  const leagueId = workspaceData.league?.id;
  const [loadingIds, setLoadingIds] = React.useState<Set<string>>(new Set());
  const [errorIds, setErrorIds] = React.useState<Set<string>>(new Set());
  const [localExplanations, setLocalExplanations] = React.useState<
    Record<string, KeeperExplanation>
  >({});
  const [selectedRec, setSelectedRec] = React.useState<KeeperRecommendation | null>(null);

  const handleGenerateExplanation = React.useCallback(
    async (rec: KeeperRecommendation) => {
      if (!leagueId || !rec.id) return;
      setLoadingIds((prev) => new Set(prev).add(rec.id!));
      setErrorIds((prev) => {
        const next = new Set(prev);
        next.delete(rec.id!);
        return next;
      });
      try {
        const explanation = await generateKeeperExplanation(leagueId, rec.id);
        if (explanation) {
          setLocalExplanations((prev) => ({ ...prev, [rec.id!]: explanation }));
        }
      } catch {
        setErrorIds((prev) => new Set(prev).add(rec.id!));
      } finally {
        setLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(rec.id!);
          return next;
        });
      }
    },
    [leagueId],
  );

  const columns = React.useMemo<ColumnDef<KeeperRecommendation>[]>(
    () => [
      {
        accessorKey: "team",
        header: "Team",
        cell: ({ row }) => (
          <TeamNameMark
            name={row.original.team}
            teamId={row.original.teamId}
            user={currentUser}
          />
        ),
      },
      { accessorKey: "scenario", header: "Scenario" },
      {
        accessorKey: "player",
        header: "Player",
        cell: ({ row }) => {
          const rec = row.original;
          return (
            <button
              className="text-left font-medium text-zinc-900 hover:text-emerald-700 hover:underline focus-visible:underline focus:outline-none"
              onClick={() => {
                setSelectedRec(rec);
                const hasExplanation = rec.id
                  ? !!(localExplanations[rec.id] ?? rec.aiExplanation)
                  : !!rec.aiExplanation;
                if (!hasExplanation && rec.id && !loadingIds.has(rec.id) && !errorIds.has(rec.id)) {
                  handleGenerateExplanation(rec);
                }
              }}
              type="button"
            >
              {rec.player}
            </button>
          );
        },
      },
      {
        accessorKey: "position",
        header: "Pos",
        cell: ({ getValue }) => <PositionBadge position={getValue<string>()} />,
      },
      {
        accessorKey: "keeperCostPick",
        header: "Cost Pick",
        cell: ({ row }) => formatKeeperCost(row.original, teamCount),
      },
      {
        accessorKey: "adpPick",
        header: "ADP",
        cell: ({ row }) => formatRecommendationAdp(row.original, teamCount),
      },
      {
        accessorKey: "keeperValue",
        header: "Value",
        cell: ({ getValue }) => {
          const value = getValue<number>();
          return <span className={cn("font-medium", value > 0 && "text-emerald-700")}>{value}</span>;
        },
      },
      {
        accessorKey: "keeperScore",
        header: "Score",
        cell: ({ getValue }) => formatter.format(getValue<number>()),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <RecommendationBadge status={getValue<KeeperRecommendation["status"]>()} />,
      },
      {
        accessorKey: "manualOverride",
        id: "manualOverride",
        enableSorting: false,
        header: () => <ManualOverrideHeader />,
        cell: ({ row }) => (
          <ManualOverrideControls recommendation={row.original} onOverride={onOverride} />
        ),
      },
      { accessorKey: "reason", header: "Reason" },
    ],
    [
      currentUser,
      errorIds,
      handleGenerateExplanation,
      loadingIds,
      localExplanations,
      onOverride,
      setSelectedRec,
      teamCount,
    ],
  );

  const visibleColumns = compact
    ? columns.slice(1, 8)
    : showOverrides
      ? columns
      : columns.filter((column) => column.id !== "manualOverride");

  const modalRec = selectedRec;
  const modalExplanation = modalRec?.id
    ? (localExplanations[modalRec.id] ?? modalRec.aiExplanation ?? null)
    : (modalRec?.aiExplanation ?? null);

  return (
    <>
      <DataTable
        columns={visibleColumns}
        data={data}
        resetSignal={resetSignal}
        scrollBody={!compact}
        tableId="keeper-recommendations"
        teamFilter={{ columnId: "team" }}
      />
      {modalRec && (
        <KeeperExplanationModal
          rec={modalRec}
          explanation={modalExplanation}
          isLoading={modalRec.id ? loadingIds.has(modalRec.id) : false}
          hasError={modalRec.id ? errorIds.has(modalRec.id) : false}
          onClose={() => setSelectedRec(null)}
          onRetry={() => handleGenerateExplanation(modalRec)}
        />
      )}
    </>
  );
}

function ManualOverrideHeader() {
  return (
    <div className="grid min-w-[190px] grid-cols-[4rem_repeat(3,2.25rem)] gap-x-1.5 whitespace-normal">
      <p className="mb-1 text-xs font-semibold uppercase leading-none text-zinc-500">Override</p>
      <span className="col-start-2 text-center text-[10px] font-semibold uppercase leading-[0.95] text-zinc-500">
        Auto
      </span>
      <span className="text-center text-[10px] font-semibold uppercase leading-[0.95] text-zinc-500">
        Force
        <br />
        Keep
      </span>
      <span className="text-center text-[10px] font-semibold uppercase leading-[0.95] text-zinc-500">
        Exclude
      </span>
    </div>
  );
}

const EXPLANATION_DECISION_STYLES: Record<KeeperExplanation["decision"], string> = {
  "strong keep": "bg-emerald-100 text-emerald-800",
  "lean keep": "bg-blue-100 text-blue-800",
  "toss-up": "bg-amber-100 text-amber-800",
  avoid: "bg-red-100 text-red-800",
};

function KeeperExplanationModal({
  rec,
  explanation,
  isLoading,
  hasError,
  onClose,
  onRetry,
}: {
  rec: KeeperRecommendation;
  explanation: KeeperExplanation | null;
  isLoading: boolean;
  hasError: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const decisionStyle = explanation
    ? (EXPLANATION_DECISION_STYLES[explanation.decision] ?? "bg-zinc-100 text-zinc-700")
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-zinc-500">
              {rec.team} · {rec.scenario}
            </p>
            <h2 className="truncate text-lg font-semibold text-zinc-950">{rec.player}</h2>
            <div className="mt-1.5 flex items-center gap-2">
              <PositionBadge position={rec.position} />
              {explanation && decisionStyle && (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                    decisionStyle,
                  )}
                >
                  {explanation.decision}
                </span>
              )}
            </div>
          </div>
          <button
            aria-label="Close"
            className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
              Generating explanation…
            </div>
          )}
          {hasError && !isLoading && (
            <div className="space-y-2">
              <p className="text-sm text-red-600">Failed to generate explanation.</p>
              <button className="text-sm text-zinc-600 underline" onClick={onRetry} type="button">
                Try again
              </button>
            </div>
          )}
          {!isLoading && !hasError && !explanation && (
            <p className="text-sm text-zinc-400">No explanation available.</p>
          )}
          {!isLoading && explanation && (
            <div className="space-y-3 text-sm">
              <p className="text-zinc-700">{explanation.short_reason}</p>
              {explanation.value_explanation && (
                <div>
                  <p className="font-semibold text-zinc-800">Value</p>
                  <p className="text-zinc-600">{explanation.value_explanation}</p>
                </div>
              )}
              {explanation.risk_note && (
                <div>
                  <p className="font-semibold text-zinc-800">Risk</p>
                  <p className="text-zinc-600">{explanation.risk_note}</p>
                </div>
              )}
              {explanation.opportunity_cost && (
                <div>
                  <p className="font-semibold text-zinc-800">Opportunity Cost</p>
                  <p className="text-zinc-600">{explanation.opportunity_cost}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatKeeperCost(recommendation: KeeperRecommendation, teamCount?: number): string {
  const costPick = recommendation.keeperCostPick;
  if (!costPick) {
    return "";
  }

  const derivedRound =
    teamCount && teamCount > 0 ? Math.ceil(costPick / teamCount) : recommendation.keeperCostRound;
  return derivedRound ? `${costPick} (R${derivedRound})` : String(costPick);
}

function formatRecommendationAdp(recommendation: KeeperRecommendation, teamCount?: number): string {
  const adpPick = recommendation.adpPick;
  if (!adpPick) {
    return "";
  }

  const derivedRound =
    teamCount && teamCount > 0 ? Math.ceil(adpPick / teamCount) : recommendation.adpRound;
  return derivedRound ? `${adpPick} (R${derivedRound})` : String(adpPick);
}

function ManualOverrideControls({
  recommendation,
  onOverride,
}: {
  recommendation: KeeperRecommendation;
  onOverride?: (
    teamId: string | undefined,
    playerId: string | undefined,
    overrideType: ManualOverrideType,
  ) => void;
}) {
  const current = recommendation.manualOverride ?? "auto";
  const disabled = !onOverride || !recommendation.teamId || !recommendation.playerId;
  return (
    <div className="grid grid-cols-[4rem_repeat(3,2.25rem)] items-center gap-1.5">
      <Badge
        className="justify-center"
        variant={current === "auto" ? "default" : current === "force_keep" ? "success" : "danger"}
      >
        {current === "force_keep" ? "Force" : current === "exclude" ? "Exclude" : "Auto"}
      </Badge>
      <Button
        aria-label={`Set ${recommendation.player} to auto`}
        disabled={disabled}
        onClick={() => onOverride?.(recommendation.teamId, recommendation.playerId, "auto")}
        size="icon"
        title="Auto"
        variant={current === "auto" ? "secondary" : "ghost"}
      >
        <RotateCcw className="size-4" aria-hidden="true" />
      </Button>
      <Button
        aria-label={`Force keep ${recommendation.player}`}
        disabled={disabled}
        onClick={() => onOverride?.(recommendation.teamId, recommendation.playerId, "force_keep")}
        size="icon"
        title="Force keep"
        variant={current === "force_keep" ? "secondary" : "ghost"}
      >
        <CheckCircle2 className="size-4" aria-hidden="true" />
      </Button>
      <Button
        aria-label={`Exclude ${recommendation.player}`}
        disabled={disabled}
        onClick={() => onOverride?.(recommendation.teamId, recommendation.playerId, "exclude")}
        size="icon"
        title="Exclude"
        variant={current === "exclude" ? "destructive" : "ghost"}
      >
        <Ban className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

function CsvImportPanel({
  title,
  description,
  inputId,
  csvText,
  disabled,
  onChange,
  onImport,
  onPreview,
  preview,
}: {
  title: string;
  description: string;
  inputId: string;
  csvText: string;
  buttonLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onImport: () => void;
  onPreview: () => void;
  preview: CsvPreviewResult | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor={inputId}>CSV</Label>
          <Textarea id={inputId} value={csvText} onChange={(event) => onChange(event.target.value)} />
        </div>
        <CsvPreviewActions
          disabled={disabled}
          onImport={onImport}
          onPreview={onPreview}
          preview={preview}
        />
        <CsvPreviewSummary preview={preview} />
      </CardContent>
    </Card>
  );
}

function CsvPreviewActions({
  disabled,
  onImport,
  onPreview,
  preview,
}: {
  disabled?: boolean;
  onImport: () => void;
  onPreview: () => void;
  preview: CsvPreviewResult | null;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button disabled={disabled} onClick={onPreview} variant="outline">
        <ListChecks className="size-4" aria-hidden="true" />
        Preview
      </Button>
      <Button disabled={disabled || !preview?.valid} onClick={onImport}>
        <Upload className="size-4" aria-hidden="true" />
        Import
      </Button>
    </div>
  );
}

function CsvPreviewSummary({ preview }: { preview: CsvPreviewResult | null }) {
  if (!preview) {
    return (
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
        Preview required before import.
      </div>
    );
  }

  const issueRows = [...preview.errors, ...preview.warnings].slice(0, 6);
  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={preview.valid ? "success" : "danger"}>
          {preview.valid ? "Ready" : "Blocked"}
        </Badge>
        <span className="text-sm text-zinc-700">
          {preview.validRows}/{preview.totalRows} rows ready
        </span>
        <span className="text-sm text-zinc-500">
          {preview.errorCount} errors, {preview.warningCount} warnings
        </span>
      </div>

      {issueRows.length ? (
        <div className="space-y-2">
          {issueRows.map((issue, index) => (
            <div
              className="rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-700"
              key={`${issue.severity}-${issue.rowNumber}-${issue.field}-${index}`}
            >
              <div className="flex items-center gap-2">
                <Badge variant={issue.severity === "error" ? "danger" : "warning"}>
                  {issue.severity}
                </Badge>
                <span className="font-medium">
                  {issue.rowNumber ? `Row ${issue.rowNumber}` : "Header"}
                  {issue.field ? ` / ${issue.field}` : ""}
                </span>
              </div>
              <p className="mt-1">{issue.message}</p>
            </div>
          ))}
        </div>
      ) : null}

      {preview.rows.length ? (
        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-2 py-1.5">Row</th>
                <th className="px-2 py-1.5">Status</th>
                <th className="px-2 py-1.5">Name</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 5).map((row) => (
                <tr className="border-t border-zinc-100" key={row.rowNumber}>
                  <td className="px-2 py-1.5">{row.rowNumber}</td>
                  <td className="px-2 py-1.5">{row.status}</td>
                  <td className="px-2 py-1.5">
                    {String(row.player ?? row.team ?? row.source ?? "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function PagePanel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail?: string;
  accent: "emerald" | "sky" | "amber" | "rose";
}) {
  const accentClass = {
    emerald: "bg-emerald-600",
    sky: "bg-sky-600",
    amber: "bg-amber-500",
    rose: "bg-rose-600",
  }[accent];

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">{label}</p>
          <p className="mt-1 text-base font-semibold leading-6 text-zinc-950">{value}</p>
          {detail ? <p className="mt-2 text-sm leading-6 text-zinc-600">{detail}</p> : null}
        </div>
        <div className={cn("mt-1 size-2 shrink-0 rounded-full", accentClass)} />
      </CardContent>
    </Card>
  );
}

function MetricStrip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function DashboardDecisionList({
  emptyText,
  items,
  title,
}: {
  emptyText: string;
  items: DashboardDecision[];
  title: string;
}) {
  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm font-semibold text-zinc-950">{title}</p>
      {items.length ? (
        items.map((item, index) => (
          <div className="rounded-md border border-zinc-200 bg-white p-3" key={`${item.team}-${item.title}-${index}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-950">{item.title}</p>
                <p className="text-xs text-zinc-500">{item.team}</p>
              </div>
              <Badge variant={item.variant}>{item.note}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-700">{item.detail}</p>
          </div>
        ))
      ) : (
        <p className="text-sm text-zinc-600">{emptyText}</p>
      )}
    </div>
  );
}

function DashboardNewsList({ items }: { items: NewsHeadline[] }) {
  if (!items.length) {
    return <p className="text-sm text-zinc-600">No fantasy football headlines are available right now.</p>;
  }

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {items.map((item) => (
        <a
          className="block rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:border-emerald-300 hover:bg-emerald-50"
          href={item.link}
          key={`${item.link}-${item.publishedAt}`}
          rel="noreferrer"
          target="_blank"
        >
          <div className="flex items-center justify-between gap-2">
            <Badge variant="info">{item.source}</Badge>
            <span className="text-xs text-zinc-500">{formatNewsDate(item.publishedAt)}</span>
          </div>
          <p className="mt-2 text-sm font-semibold leading-5 text-zinc-950">{item.headline}</p>
        </a>
      ))}
    </div>
  );
}

function DashboardTeamSnapshotCard({
  currentUser,
  outlook,
  review,
  team,
}: {
  currentUser: AuthUser | null;
  outlook: Outlook | undefined;
  review?: string;
  team: Team;
}) {
  const displayedKeeperCount = outlook?.recommendedKeepers.length ?? team.keepers;
  const isCurrentTeam = isCurrentUserTeam({ name: team.name, teamId: team.id, user: currentUser });

  return (
    <div
      className={cn(
        "rounded-md border border-zinc-200 bg-white p-4",
        isCurrentTeam && "border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-100",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <TeamNameMark
            className="text-sm font-semibold text-zinc-950"
            name={team.name}
            teamId={team.id}
            user={currentUser}
          />
          <p className="text-xs text-zinc-500">{team.owner || "Owner not assigned"}</p>
        </div>
        <Badge variant={review ? "warning" : "success"}>
          {review ? "Review" : outlook?.stance ?? "Stable"}
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricStrip label="Keepers" value={`${displayedKeeperCount}/4`} />
        <MetricStrip label="Top-100 Picks Left" value={String(team.remainingTop100Picks)} />
      </div>
      <div className="mt-4 space-y-3">
        <InfoLine
          label="Recommended Keepers"
          value={
            outlook?.recommendedKeepers.length
              ? outlook.recommendedKeepers.join(", ")
              : "No keepers recommended"
          }
        />
        <InfoLine label="Draft Capital" value={outlook?.draftCapital ?? draftCapitalLabel(team.remainingTop100Picks)} />
        <InfoLine
          label={review ? "Needs Review" : "Outlook"}
          value={review ?? outlook?.risk ?? "No major warning signs."}
        />
      </div>
    </div>
  );
}

function draftCapitalLabel(remainingTop100Picks: number): string {
  if (remainingTop100Picks >= 8) {
    return "Strong draft flexibility";
  }
  if (remainingTop100Picks >= 6) {
    return "Moderate draft pressure";
  }
  return "Heavy early-pick cost";
}

function formatNewsDate(value: string): string {
  if (!value) {
    return "Today";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMockDraftDate(value: string | null): string {
  if (!value) {
    return "Not complete";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function strategyText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function strategyNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

type LiveTarget = {
  playerId: string;
  playerName: string;
  position: string;
  reason: string;
  acceptableRange: string;
};

function buildLivePositionPriorities(
  session: MockDraftSession,
  planPriorities: Record<string, unknown>[],
): Record<string, unknown>[] {
  const liveNeeds = session.rosterNeeds
    .filter((need) => need.remaining > 0)
    .filter((need) => !["BENCH"].includes(need.slot))
    .map((need) => ({
      position: need.slot,
      priority: ["K", "DST", "DEF"].includes(need.slot) ? "low" : "high",
      reason: `${need.remaining} ${need.slot} slot${need.remaining === 1 ? "" : "s"} still open.`,
    }));
  const livePositions = new Set(liveNeeds.map((need) => need.position));
  const remainingPlanPriorities = planPriorities.filter(
    (item) => !livePositions.has(strategyText(item.position)),
  );
  return [...liveNeeds, ...remainingPlanPriorities].slice(0, 5);
}

function buildLiveTargets(
  session: MockDraftSession,
  planTargets: Record<string, unknown>[],
): LiveTarget[] {
  const availableById = new Map(session.availablePlayers.map((player) => [player.playerId, player]));
  const availableByNamePosition = new Map(
    session.availablePlayers.map((player) => [targetKey(player.playerName, player.position), player]),
  );
  const targets: LiveTarget[] = [];
  for (const item of planTargets) {
    const playerId = strategyText(item.player_id);
    const playerName = strategyText(item.player_name);
    const position = strategyText(item.position);
    const available =
      availableById.get(playerId) ??
      availableByNamePosition.get(targetKey(playerName, position));
    if (!available) {
      continue;
    }
    targets.push({
      playerId: available.playerId,
      playerName: available.playerName,
      position: available.position,
      reason: strategyText(item.reason) || liveTargetReason(available, session.currentPick),
      acceptableRange: strategyText(item.acceptable_range),
    });
  }
  const existingIds = new Set(targets.map((target) => target.playerId));
  const liveAdvice = buildLiveStrategyAdvice(session);
  for (const player of liveAdvice?.targets ?? []) {
    if (existingIds.has(player.playerId)) {
      continue;
    }
    targets.push({
      playerId: player.playerId,
      playerName: player.playerName,
      position: player.position,
      reason: liveTargetReason(player, session.currentPick),
      acceptableRange: "",
    });
  }
  return targets.slice(0, 4);
}

function targetKey(playerName: string, position: string): string {
  return `${playerName.trim().toLowerCase()}|${position.trim().toUpperCase()}`;
}

function liveTargetReason(player: MockDraftAvailablePlayer, currentPick: number | null): string {
  if (player.adpPick !== null && currentPick !== null) {
    const value = player.adpPick - currentPick;
    if (value >= 0) {
      return `${formatter.format(value)} picks past market cost.`;
    }
    return `${formatter.format(Math.abs(value))} picks ahead of market cost.`;
  }
  return "Available fit for current roster needs.";
}

function buildLiveStrategyAdvice(session: MockDraftSession): {
  priority: string;
  detail: string;
  targets: MockDraftAvailablePlayer[];
} | null {
  if (session.status === "complete" || session.status === "abandoned") {
    return null;
  }
  const currentSlot = session.currentPick
    ? session.board.find((slot) => slot.overallPick === session.currentPick)
    : null;
  const baseNeeds = session.rosterNeeds.filter(
    (need) =>
      need.remaining > 0 &&
      !["BENCH", "FLEX", "SUPERFLEX", "K", "DST", "DEF"].includes(need.slot),
  );
  const flexNeed = session.rosterNeeds.find((need) => need.slot === "FLEX" && need.remaining > 0);
  const superflexNeed = session.rosterNeeds.find(
    (need) => need.slot === "SUPERFLEX" && need.remaining > 0,
  );
  const lateSpecialTeamNeed = currentSlot && currentSlot.round >= Math.max(13, session.roundCount - 2)
    ? session.rosterNeeds.find((need) => ["K", "DST", "DEF"].includes(need.slot) && need.remaining > 0)
    : null;

  let priorityPositions = baseNeeds.map((need) => need.slot);
  let priority = priorityPositions.length
    ? `Fill ${priorityPositions.slice(0, 3).join("/")}`
    : "Best value";
  let detail = priorityPositions.length
    ? `Your roster still needs ${baseNeeds
        .map((need) => `${need.remaining} ${need.slot}`)
        .join(", ")} before leaning into bench depth.`
    : "Core starter slots are mostly covered; lean into ADP value and upside.";

  if (!priorityPositions.length && superflexNeed) {
    priorityPositions = ["QB", "RB", "WR"];
    priority = "Fill Superflex";
    detail = "Superflex is still open; prioritize QB value first, then strong RB/WR value.";
  } else if (!priorityPositions.length && flexNeed) {
    priorityPositions = ["RB", "WR", "TE"];
    priority = "Fill Flex";
    detail = "Flex is still open; prioritize RB/WR volume, with TE only on a clear value fall.";
  } else if (!priorityPositions.length && lateSpecialTeamNeed) {
    priorityPositions = [lateSpecialTeamNeed.slot === "DEF" ? "DST" : lateSpecialTeamNeed.slot];
    priority = `Fill ${priorityPositions[0]}`;
    detail = "It is late enough to address the remaining special-teams roster slot.";
  }

  const positionSet = new Set(priorityPositions.map((position) => (position === "DEF" ? "DST" : position)));
  const targets = session.availablePlayers
    .filter((player) => positionSet.size === 0 || positionSet.has(player.position === "DEF" ? "DST" : player.position))
    .filter((player) => {
      const normalized = player.position === "DEF" ? "DST" : player.position;
      return !["K", "DST"].includes(normalized) || (currentSlot?.round ?? 1) >= Math.max(13, session.roundCount - 2);
    })
    .slice(0, 4);

  if (currentSlot && currentSlot.teamId !== session.userTeamId) {
    detail = `${currentSlot.teamName || "A bot team"} is on the clock. ${detail}`;
  }

  return { priority, detail, targets };
}

function setTeamBotOverride(
  setForm: React.Dispatch<React.SetStateAction<MockDraftCreateForm>>,
  teamId: string,
  personality: string,
  difficulty: string,
  form: MockDraftCreateForm,
) {
  setForm((current) => {
    const next = { ...current.teamBotOverrides };
    if (personality === form.defaultPersonality && difficulty === form.defaultDifficulty) {
      delete next[teamId];
    } else {
      next[teamId] = { personality, difficulty };
    }
    return { ...current, teamBotOverrides: next };
  });
}

function objectEntries(value: unknown): [string, unknown][] {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value as Record<string, unknown>)
    : [];
}

function countTeamBotOverrides(botConfig: Record<string, unknown>): number {
  return objectEntries(botConfig.teams).length;
}

function ScoreHelpTile({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <p className="text-sm font-semibold text-zinc-950">{label}</p>
      <p className="mt-1 text-sm leading-6 text-zinc-600">{text}</p>
    </div>
  );
}

function ScenarioHelpLine({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <Badge variant="info">{label}</Badge>
      <p className="text-sm leading-6 text-zinc-700">{text}</p>
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <p className="mb-4 text-sm font-semibold text-zinc-900">{title}</p>
      <div className="grid gap-4">{children}</div>
    </div>
  );
}

function NumberField({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {description ? <p className="text-sm leading-6 text-zinc-600">{description}</p> : null}
      <Input
        max={max}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        step={step}
        type="number"
        value={value}
      />
    </div>
  );
}

function ToggleRow({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description?: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white p-4">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-800">{label}</span>
        {description ? <span className="mt-1 block text-sm leading-6 text-zinc-600">{description}</span> : null}
      </span>
      <input
        checked={checked}
        className="size-4 accent-emerald-700"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

function OutlookCard({
  currentUser,
  disabled,
  onExport,
  outlook,
}: {
  currentUser: AuthUser | null;
  disabled?: boolean;
  onExport?: () => void;
  outlook: Outlook;
}) {
  const isCurrentTeam = isCurrentUserTeam({
    name: outlook.team,
    teamId: outlook.teamId,
    user: currentUser,
  });

  return (
    <Card className={cn(isCurrentTeam && "border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-100")}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="min-w-0">
            <TeamNameMark name={outlook.team} teamId={outlook.teamId} user={currentUser} />
          </CardTitle>
          <div className="flex items-center gap-2">
            {outlook.scenario ? <Badge>{outlook.scenario}</Badge> : null}
            <Badge variant="info">{outlook.stance}</Badge>
            <Button
              aria-label={`Export ${outlook.team} outlook PDF`}
              disabled={disabled || !outlook.teamId}
              onClick={onExport}
              size="icon"
              title="Export outlook PDF"
              variant="outline"
            >
              <FileText className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase text-zinc-500">Recommended Keepers</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {outlook.recommendedKeepers.map((keeper) => (
              <Badge key={keeper} variant="success">
                {keeper}
              </Badge>
            ))}
          </div>
        </div>
        <InfoLine label="Lost Picks" value={outlook.lostPicks} />
        <InfoLine label="Draft Capital" value={outlook.draftCapital} />
        <InfoLine label="Risk" value={outlook.risk} />
      </CardContent>
    </Card>
  );
}

function TeamNameMark({
  className,
  name,
  teamId,
  user,
}: {
  className?: string;
  name: string;
  teamId?: string | null;
  user: AuthUser | null;
}) {
  const isCurrentTeam = isCurrentUserTeam({ name, teamId, user });

  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-2 align-middle",
        isCurrentTeam && "rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-950",
        className,
      )}
    >
      <span className="truncate">{name}</span>
      {isCurrentTeam ? (
        <Badge className="shrink-0" variant="success">
          Your team
        </Badge>
      ) : null}
    </span>
  );
}

function isCurrentUserTeam({
  name,
  teamId,
  user,
}: {
  name: string;
  teamId?: string | null;
  user: AuthUser | null;
}): boolean {
  if (!user) {
    return false;
  }
  if (teamId && user.teamId && teamId === user.teamId) {
    return true;
  }
  return Boolean(name && user.teamName && name === user.teamName);
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-sm text-zinc-900">{value}</p>
    </div>
  );
}

function PositionBadge({ position }: { position: string }) {
  const variant = position === "QB" ? "warning" : position === "RB" ? "success" : "default";
  return <Badge variant={variant}>{position}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "Starter" ? "success" : status === "Bench" ? "info" : "warning";
  return <Badge variant={variant}>{status}</Badge>;
}

function TrendBadge({ trend }: { trend: string }) {
  const variant = trend.startsWith("Up") ? "success" : trend.startsWith("Down") ? "danger" : "default";
  return <Badge variant={variant}>{trend}</Badge>;
}

function RecommendationBadge({ status }: { status: KeeperRecommendation["status"] }) {
  const variant =
    status === "Recommended" ? "success" : status === "Eligible" ? "info" : "danger";
  return <Badge variant={variant}>{status}</Badge>;
}
