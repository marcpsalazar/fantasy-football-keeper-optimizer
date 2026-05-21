"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Gauge,
  GitCompare,
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
  createTeam,
  deleteAdminUser,
  deleteTeam,
  downloadAdpTemplate,
  exportUrl,
  hydrateTeams,
  importCompositeAdpSnapshot,
  importCsv,
  getCurrentUser,
  listAdminUsers,
  loadWorkspaceData,
  loadScenarioSelections,
  login,
  logout,
  mockWorkspaceData,
  previewCsv,
  refreshAdpSnapshot,
  recommendScenarioSelections,
  resetAdminUserPassword,
  runOptimizer,
  runScenarioComparison,
  saveOptimizerSettings,
  saveScenarioSelection,
  setManualOverride,
  updateProfile,
  updateAdminUser,
  updateTeam,
  type AdminUser,
  type TeamForm,
  type AuthUser,
  type CsvImportKind,
  type CsvPreviewResult,
  type DraftImpactPick,
  type ManualOverrideType,
  type NewsHeadline,
  type OptimizerSettingsForm,
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
  | "draft-impact";

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
    bestFor: "Tuning the model to match league strategy.",
    howToRead: "Keeper limits, thresholds, ADP cap, position weights, and bonuses decide who qualifies and how candidates are ranked.",
    watchFor: "Save Settings persists values and reruns recommendations. Very high thresholds can produce fewer keepers.",
    view: "settings",
  },
  {
    title: "Keeper Recommendations",
    icon: Trophy,
    bestFor: "The primary decision screen.",
    howToRead: "Recommended means selected by the optimizer. Eligible means good enough but not selected because of limits. Excluded means the player failed a threshold or was manually excluded.",
    watchFor: "Use manual overrides sparingly. Force Keep and Exclude are best for league knowledge the model cannot know.",
    view: "recommendations",
  },
  {
    title: "Scenario Comparison",
    icon: GitCompare,
    bestFor: "Seeing how strategy changes the keeper list.",
    howToRead: "Each preset shows selected keepers, forfeited picks, total score, and notes by team. The Outlook Scenario selector chooses the active strategy for that team.",
    watchFor: "Run All Presets after settings or input changes. Scenario selections change Team Outlook and Draft Impact.",
    view: "scenarios",
  },
  {
    title: "Team Outlooks",
    icon: ShieldCheck,
    bestFor: "A team-by-team summary for discussion.",
    howToRead: "Each card summarizes stance, recommended keepers, lost picks, draft capital, and risk from the active keeper plan.",
    watchFor: "Outlooks are summaries, not separate rankings. Export a PDF when the team plan is ready to share.",
    view: "outlooks",
  },
  {
    title: "Draft Impact",
    icon: ClipboardList,
    bestFor: "Understanding the draft board after keeper picks are removed.",
    howToRead: "Forfeited picks are spent on keepers. Open picks remain available in the projected draft board.",
    watchFor: "Draft Impact is downstream of recommendations and scenario selections. Rerun the right calculation before using it for planning.",
    view: "draft-impact",
  },
];

const workflowSteps: WorkflowStep[] = [
  {
    title: "Confirm the source data",
    text: "Check teams, draft results, final rosters, and ADP before trusting recommendations. Admins should preview and import CSVs from Admin when those inputs need to change.",
    view: "dashboard",
  },
  {
    title: "Tune model behavior",
    text: "Use Optimizer Settings when league rules or strategy should change the calculation, such as keeper limits, QB caps, thresholds, ADP cap, position weights, or bonus toggles.",
    view: "settings",
  },
  {
    title: "Run the calculation",
    text: "Use Run Optimizer after imports, team edits, settings changes, ADP updates, or manual overrides. This recomputes keeper recommendations from live inputs.",
    view: "recommendations",
  },
  {
    title: "Review and override",
    text: "Read Keeper Recommendations first. Use Auto for model control, Force Keep for outside context the model cannot know, and Exclude for players you do not want selected.",
    view: "recommendations",
  },
  {
    title: "Compare strategies",
    text: "Use Scenario Comparison to compare Pure Value, Balanced, Superflex Heavy, Win Now, and Rebuild. Pick an Outlook Scenario per team when the report should reflect a specific strategy.",
    view: "scenarios",
  },
  {
    title: "Share the result",
    text: "Use Draft Impact and Team Outlook after recommendations are set, then export Excel, CSV, or PDF reports from the recommendation and outlook screens.",
    view: "outlooks",
  },
];

const controlGuides: ControlGuide[] = [
  {
    title: "Optimizer Settings",
    icon: SlidersHorizontal,
    text: "Changes the model input. Use it before calculation when you want stricter recommendations, more speculative candidates, different position emphasis, or different keeper caps.",
  },
  {
    title: "Save Settings",
    icon: Save,
    text: "Persists the visible settings, reruns the optimizer, clears selected scenario overrides, and refreshes recommendation-driven screens.",
  },
  {
    title: "Run Optimizer",
    icon: Play,
    text: "Saves the visible settings, recomputes keeper recommendations from teams, draft results, final rosters, ADP, overrides, and settings, then reloads the workspace.",
  },
  {
    title: "Refresh",
    icon: RefreshCw,
    text: "Reloads displayed workspace data and resets table filters or sorting. It does not rerun the optimizer or change recommendation results.",
  },
  {
    title: "Preview and Import",
    icon: Upload,
    text: "Preview validates pasted CSV before writes. Import commits valid draft, roster, or ADP rows. Run Optimizer after imports when recommendations should change.",
  },
  {
    title: "Run All Presets",
    icon: GitCompare,
    text: "Recomputes scenario presets for side-by-side strategy comparison. Use it after settings or source data change.",
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
  selectedScenarioByTeam: TeamScenarioSelection;
  tableDisplayResetSignal: number;
  refreshData: () => Promise<void>;
  logoutNow: () => Promise<void>;
  resetDisplayAndRefresh: () => Promise<void>;
  updateProfileAvatarNow: (avatarDataUrl: string | null) => Promise<void>;
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
  refreshAdpNow: () => Promise<void>;
  runScenariosNow: () => Promise<void>;
  saveSettings: (settings: OptimizerSettingsForm) => Promise<void>;
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

  const isAdmin = currentUser?.role === "admin";
  const visibleNavItems = React.useMemo(
    () => navItems.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin],
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

  const refreshData = React.useCallback(async () => {
    setApiStatus("loading");
    try {
      const loaded = await loadWorkspaceData();
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
    if (!isAdmin && activeView === "admin") {
      setActiveView("dashboard");
    }
  }, [activeView, isAdmin]);

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

  const refreshAdpNow = React.useCallback(async () => {
    const leagueId = requireLeagueId();
    if (!leagueId) {
      return;
    }
    setIsBusy(true);
    try {
      await refreshAdpSnapshot(leagueId);
      await refreshData();
      setStatusMessage("ADP refreshed from the configured API source.");
    } catch {
      setApiStatus("error");
      setStatusMessage("ADP refresh failed. Check the configured ADP API source.");
    } finally {
      setIsBusy(false);
    }
  }, [refreshData, requireLeagueId]);

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
      const scenarioComparisons = await runScenarioComparison(leagueId);
      setWorkspace((current) => ({ ...current, scenarioComparisons }));
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

  const contextValue = React.useMemo<DashboardContextValue>(
    () => ({
      data: workspaceData,
      apiStatus,
      currentUser,
      isBusy,
      statusMessage,
      isAdmin,
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
      logoutNow,
      resetDisplayAndRefresh,
      updateProfileAvatarNow,
      updateProfileAliasNow,
      changePasswordNow,
      refreshAdpNow,
      setSelectedScenarioForTeam,
      previewCsvText,
      importCsvText,
      runOptimizerNow,
      runScenariosNow,
      saveSettings,
      setManualOverrideNow,
      exportRecommendations,
    }),
    [
      apiStatus,
      changePasswordNow,
      csvPreviews,
      currentUser,
      createUserNow,
      createTeamNow,
      deleteUserNow,
      deleteTeamNow,
      downloadAdpTemplateNow,
      exportRecommendations,
      importCompositeAdpNow,
      importCsvText,
      isBusy,
      isAdmin,
      logoutNow,
      previewCsvText,
      refreshData,
      refreshAdpNow,
      resetDisplayAndRefresh,
      updateProfileAvatarNow,
      updateProfileAliasNow,
      runOptimizerNow,
      runScenariosNow,
      saveSettings,
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
                <p className="text-sm font-semibold leading-5">Keeper Optimizer</p>
                <p className="text-xs text-zinc-500">
                  {workspaceData.league?.name ?? "League"} {workspaceData.league?.seasonYear ?? ""}
                </p>
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
                  <div className="relative">
                    <button
                      aria-expanded={userMenuOpen}
                      aria-label="Open user menu"
                      className="flex size-12 items-center justify-center overflow-hidden rounded-full border border-zinc-300 bg-zinc-50 text-zinc-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      disabled={isBusy}
                      onClick={() => setUserMenuOpen((open) => !open)}
                      type="button"
                    >
                      <AvatarImage user={currentUser} className="size-12" iconClassName="size-7" />
                    </button>
                    {userMenuOpen ? (
                      <div className="absolute right-0 top-14 z-30 w-72 rounded-md border border-zinc-200 bg-white p-2 shadow-lg">
                        <div className="flex items-center gap-3 border-b border-zinc-100 px-2 pb-3 pt-1">
                          <AvatarImage user={currentUser} className="size-10" iconClassName="size-6" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-950">{currentUser.email}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <Badge variant={isAdmin ? "success" : "info"}>{currentUser.role}</Badge>
                              {currentUser.teamName ? (
                                <Badge variant="success">{currentUser.teamName}</Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <button
                          className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
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

          <div className="px-4 py-5 md:px-6">
            {activeView === "dashboard" && <LeagueDashboard />}
            {activeView === "guide" && <GuidePage onNavigate={setActiveView} />}
            {activeView === "teams" && <TeamsPage />}
            {activeView === "draft" && <DraftResultsPage />}
            {activeView === "rosters" && <FinalRostersPage />}
            {activeView === "admin" && isAdmin && (
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
          </div>
        </section>
      </div>
    </main>
    </DashboardContext.Provider>
  );
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
}: {
  className?: string;
  iconClassName?: string;
  user: AuthUser;
}) {
  if (user.avatarDataUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className={cn("rounded-full object-cover", className)}
        src={user.avatarDataUrl}
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

function ProfilePage() {
  const { changePasswordNow, currentUser, isBusy, updateProfileAliasNow, updateProfileAvatarNow } = useDashboard();
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
                <Badge variant={currentUser.role === "admin" ? "success" : "info"}>
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
  const { isAdmin } = useDashboard();
  const visibleScreenGuides = React.useMemo(
    () => screenGuides.filter((guide) => !guide.adminOnly || isAdmin),
    [isAdmin],
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
  return (
    <div className="space-y-5">
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
    </div>
  );
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
                      role: event.target.value === "admin" ? "admin" : "user",
                    }))
                  }
                  value={form.role}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
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
          <CardTitle>ADP Input</CardTitle>
          <CardDescription>
            Build or import a composite PPR and superflex ADP snapshot from the current source data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isBusy || data.source !== "api" || !data.league?.id}
              onClick={importCompositeAdpNow}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Import Composite ADP
            </Button>
            <Button
              disabled={isBusy || data.source !== "api" || !data.league?.id}
              onClick={downloadAdpTemplateNow}
              variant="outline"
            >
              <Download className="size-4" aria-hidden="true" />
              Build Composite ADP CSV
            </Button>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="adp-source">Source</Label>
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
            These controls change how strict or aggressive the optimizer becomes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-zinc-700">
          <p>
            Start with the default settings if you want the safest recommendation set. The default
            model favors positive keeper value and avoids recommending players who do not clearly
            beat their expected draft cost.
          </p>
          <p>
            Lower the minimum keeper value or minimum keeper score if you want to explore more
            aggressive builds, including borderline players. Raise them if you want only the
            clearest keeper values.
          </p>
          <p>
            Position weights decide how much keeper value matters at each position. In superflex,
            QB weight and the QB scarcity toggle will usually have the biggest impact on scenario
            differences.
          </p>
          <p>
            After saving, rerun the optimizer or scenario comparison to see the effect on keeper
            recommendations, draft impact, and team outlooks.
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
      description="Optimizer output with value, score, eligibility, and selection reason."
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
  const { currentUser } = useDashboard();
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
      { accessorKey: "player", header: "Player" },
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
    [currentUser, onOverride, teamCount],
  );

  const visibleColumns = compact
    ? columns.slice(1, 8)
    : showOverrides
      ? columns
      : columns.filter((column) => column.id !== "manualOverride");

  return (
    <DataTable
      columns={visibleColumns}
      data={data}
      resetSignal={resetSignal}
      scrollBody={!compact}
      tableId="keeper-recommendations"
      teamFilter={{ columnId: "team" }}
    />
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
  const draftSharksAdp = recommendation.adpSourceNote?.match(/DraftSharks Superflex ADP ([0-9]+(?:\.[0-9]+)?)/)?.[1];
  if (draftSharksAdp) {
    return draftSharksAdp;
  }

  if (!recommendation.adpPick) {
    return "";
  }

  if (teamCount && teamCount > 0 && Number.isInteger(recommendation.adpPick)) {
    const round = Math.floor((recommendation.adpPick - 1) / teamCount) + 1;
    const pick = ((recommendation.adpPick - 1) % teamCount) + 1;
    return `${round}.${String(pick).padStart(2, "0")}`;
  }

  return String(recommendation.adpPick);
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
  description: string;
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
