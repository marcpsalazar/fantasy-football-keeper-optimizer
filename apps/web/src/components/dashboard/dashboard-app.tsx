"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Gauge,
  GitCompare,
  ListChecks,
  PanelLeft,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import * as React from "react";

import { DataTable } from "@/components/dashboard/data-table";
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
  exportUrl,
  importCsv,
  loadWorkspaceData,
  mockWorkspaceData,
  previewCsv,
  runOptimizer,
  runScenarioComparison,
  saveOptimizerSettings,
  setManualOverride,
  type CsvImportKind,
  type CsvPreviewResult,
  type DraftImpactPick,
  type ManualOverrideType,
  type OptimizerSettingsForm,
  type WorkspaceData,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type ViewId =
  | "dashboard"
  | "teams"
  | "draft"
  | "rosters"
  | "adp"
  | "settings"
  | "recommendations"
  | "scenarios"
  | "outlooks"
  | "draft-impact";

type NavItem = {
  id: ViewId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { id: "dashboard", label: "League Dashboard", icon: Gauge },
  { id: "teams", label: "Teams", icon: Users },
  { id: "draft", label: "Draft Results", icon: ClipboardList },
  { id: "rosters", label: "Final Rosters", icon: ListChecks },
  { id: "adp", label: "ADP Input", icon: CalendarDays },
  { id: "settings", label: "Optimizer Settings", icon: SlidersHorizontal },
  { id: "recommendations", label: "Keeper Recommendations", icon: Trophy },
  { id: "scenarios", label: "Scenario Comparison", icon: GitCompare },
  { id: "outlooks", label: "Team Outlooks", icon: ShieldCheck },
  { id: "draft-impact", label: "Draft Impact", icon: ClipboardList },
];

const formatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

type ApiStatus = "loading" | "live" | "mock" | "error";

type DashboardContextValue = {
  data: WorkspaceData;
  apiStatus: ApiStatus;
  isBusy: boolean;
  statusMessage: string;
  refreshData: () => Promise<void>;
  csvPreviews: Record<CsvImportKind, CsvPreviewResult | null>;
  previewCsvText: (kind: CsvImportKind, csvText: string) => Promise<void>;
  importCsvText: (kind: CsvImportKind, csvText: string) => Promise<void>;
  runOptimizerNow: () => Promise<void>;
  runScenariosNow: () => Promise<void>;
  saveSettings: (settings: OptimizerSettingsForm) => Promise<void>;
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

  const activeItem = navItems.find((item) => item.id === activeView) ?? navItems[0];
  const workspaceData = React.useMemo<WorkspaceData>(
    () => ({ ...workspace, settings }),
    [settings, workspace],
  );

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
      setApiStatus("live");
      setStatusMessage(`Connected to ${loaded.league?.name ?? "backend league"}.`);
    } catch {
      setWorkspace(mockWorkspaceData);
      setSettings(mockWorkspaceData.settings);
      setApiStatus("error");
      setStatusMessage("API unavailable; using mock workspace data.");
    }
  }, []);

  React.useEffect(() => {
    void refreshData();
  }, [refreshData]);

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
      await runOptimizer(leagueId);
      await refreshData();
      setStatusMessage("Optimizer run completed.");
    } catch {
      setApiStatus("error");
      setStatusMessage("Optimizer run failed. Confirm draft, roster, and ADP data are loaded.");
    } finally {
      setIsBusy(false);
    }
  }, [refreshData, requireLeagueId]);

  const runScenariosNow = React.useCallback(async () => {
    const leagueId = requireLeagueId();
    if (!leagueId) {
      return;
    }
    setIsBusy(true);
    try {
      const scenarioComparisons = await runScenarioComparison(leagueId);
      setWorkspace((current) => ({ ...current, scenarioComparisons }));
      setApiStatus("live");
      setStatusMessage("Scenario comparison completed.");
    } catch {
      setApiStatus("error");
      setStatusMessage("Scenario comparison failed. Run the optimizer inputs check first.");
    } finally {
      setIsBusy(false);
    }
  }, [requireLeagueId]);

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
        await refreshData();
        setStatusMessage("Optimizer settings saved.");
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
        setStatusMessage("Manual override saved and optimizer rerun.");
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
      isBusy,
      statusMessage,
      csvPreviews,
      refreshData,
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
      csvPreviews,
      exportRecommendations,
      importCsvText,
      isBusy,
      previewCsvText,
      refreshData,
      runOptimizerNow,
      runScenariosNow,
      saveSettings,
      setManualOverrideNow,
      statusMessage,
      workspaceData,
    ],
  );

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
              {navItems.map((item) => {
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
                  <h1 className="truncate text-xl font-semibold text-zinc-950">{activeItem.label}</h1>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{statusMessage}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ConnectionBadge status={apiStatus} />
                <Button disabled={isBusy} onClick={refreshData} variant="outline">
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Refresh
                </Button>
                <Button disabled={isBusy} onClick={() => setActiveView("adp")} variant="outline">
                  <Upload className="size-4" aria-hidden="true" />
                  Import CSV
                </Button>
                <Button disabled={isBusy} onClick={runOptimizerNow}>
                  <Play className="size-4" aria-hidden="true" />
                  Run Optimizer
                </Button>
              </div>
            </div>
          </header>

          <div className="px-4 py-5 md:px-6">
            {activeView === "dashboard" && <LeagueDashboard />}
            {activeView === "teams" && <TeamsPage />}
            {activeView === "draft" && (
              <DraftResultsPage csvText={draftCsvText} setCsvText={setDraftCsvText} />
            )}
            {activeView === "rosters" && (
              <FinalRostersPage csvText={rosterCsvText} setCsvText={setRosterCsvText} />
            )}
            {activeView === "adp" && <ADPInputPage csvText={adpCsvText} setCsvText={setAdpCsvText} />}
            {activeView === "settings" && (
              <OptimizerSettingsPage settings={settings} setSettings={setSettings} />
            )}
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

function LeagueDashboard() {
  const { data } = useDashboard();
  const recommendedCount = data.keeperRecommendations.filter(
    (recommendation) => recommendation.status === "Recommended",
  ).length;
  const totalKeeperValue = data.keeperRecommendations
    .filter((recommendation) => recommendation.status === "Recommended")
    .reduce((sum, recommendation) => sum + recommendation.keeperValue, 0);
  const topRecommendations = data.keeperRecommendations
    .filter((recommendation) => recommendation.status === "Recommended")
    .sort((a, b) => b.keeperScore - a.keeperScore);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Teams" value={data.teams.length.toString()} accent="emerald" />
        <MetricTile label="Recommended keepers" value={recommendedCount.toString()} accent="sky" />
        <MetricTile label="Keeper value" value={`+${totalKeeperValue}`} accent="amber" />
        <MetricTile label="ADP rows" value={data.adpEntries.length.toString()} accent="rose" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Keeper Board</CardTitle>
              <CardDescription>Current optimizer output by team and roster impact.</CardDescription>
            </div>
            <Badge variant="success">{recommendedCount} selected</Badge>
          </CardHeader>
          <CardContent>
            <KeeperRecommendationsTable data={topRecommendations} compact />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Draft Capital</CardTitle>
            <CardDescription>Keeper costs against remaining top-100 access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.teams.map((team) => (
              <div key={team.id}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-zinc-900">{team.name}</p>
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
    </div>
  );
}

function TeamsPage() {
  const { data } = useDashboard();
  const columns = React.useMemo<ColumnDef<Team>[]>(
    () => [
      { accessorKey: "name", header: "Team" },
      { accessorKey: "owner", header: "Owner" },
      { accessorKey: "draftSlot", header: "Draft Slot" },
      {
        accessorKey: "keepers",
        header: "Keepers",
        cell: ({ getValue }) => <Badge variant="info">{getValue<number>()}/4</Badge>,
      },
      {
        accessorKey: "projectedScore",
        header: "Projected Score",
        cell: ({ getValue }) => formatter.format(getValue<number>()),
      },
      { accessorKey: "remainingTop100Picks", header: "Top-100 Picks" },
    ],
    [],
  );

  return (
    <PagePanel
      title="Teams"
      description="Draft slots, keeper counts, and remaining draft capital."
      action={
        <Button>
          <Plus className="size-4" aria-hidden="true" />
          Add Team
        </Button>
      }
    >
      <DataTable columns={columns} data={data.teams} />
    </PagePanel>
  );
}

function DraftResultsPage({
  csvText,
  setCsvText,
}: {
  csvText: string;
  setCsvText: (value: string) => void;
}) {
  const { csvPreviews, data, importCsvText, isBusy, previewCsvText } = useDashboard();
  const columns = React.useMemo<ColumnDef<DraftPick>[]>(
    () => [
      { accessorKey: "team", header: "Team" },
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
    [],
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(340px,0.7fr)_minmax(0,1.3fr)]">
      <CsvImportPanel
        buttonLabel="Import Draft Results"
        csvText={csvText}
        description="Original draft picks used to determine same-team keeper cost."
        inputId="draft-csv"
        onChange={setCsvText}
        onImport={() => importCsvText("draft-results", csvText)}
        onPreview={() => previewCsvText("draft-results", csvText)}
        preview={csvPreviews["draft-results"]}
        title="Draft Results CSV"
        disabled={isBusy}
      />

      <PagePanel title="Draft Results" description="Imported draft picks by round and overall pick.">
        <DataTable columns={columns} data={data.draftResults} />
      </PagePanel>
    </div>
  );
}

function FinalRostersPage({
  csvText,
  setCsvText,
}: {
  csvText: string;
  setCsvText: (value: string) => void;
}) {
  const { csvPreviews, data, importCsvText, isBusy, previewCsvText } = useDashboard();
  const columns = React.useMemo<ColumnDef<FinalRosterEntry>[]>(
    () => [
      { accessorKey: "team", header: "Team" },
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
    [],
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(340px,0.7fr)_minmax(0,1.3fr)]">
      <CsvImportPanel
        buttonLabel="Import Final Rosters"
        csvText={csvText}
        description="End-of-season roster state that defines keeper candidates."
        inputId="roster-csv"
        onChange={setCsvText}
        onImport={() => importCsvText("final-rosters", csvText)}
        onPreview={() => previewCsvText("final-rosters", csvText)}
        preview={csvPreviews["final-rosters"]}
        title="Final Rosters CSV"
        disabled={isBusy}
      />

      <PagePanel title="Final Rosters" description="Current keeper candidate pool by team.">
        <DataTable columns={columns} data={data.finalRosters} />
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
  const { csvPreviews, data, importCsvText, isBusy, previewCsvText } = useDashboard();
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
    <div className="grid gap-5 xl:grid-cols-[minmax(340px,0.7fr)_minmax(0,1.3fr)]">
      <Card>
        <CardHeader>
          <CardTitle>ADP Input</CardTitle>
          <CardDescription>
            Snapshot: {data.activeSnapshot?.name ?? "No ADP snapshot loaded"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="adp-source">Source</Label>
            <Input id="adp-source" value={data.activeSnapshot?.source ?? "No source loaded"} readOnly />
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
      </Card>

      <PagePanel title="ADP Preview" description="Parsed player market data ready for optimizer runs.">
        <DataTable columns={columns} data={data.adpEntries} />
      </PagePanel>
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
            label="Max Keepers"
            max={4}
            min={0}
            value={settings.maxKeepers}
            onChange={(value) => updateNumber("maxKeepers", value)}
          />
          <NumberField
            label="Max Per Position"
            max={4}
            min={0}
            value={settings.maxPerPosition}
            onChange={(value) => updateNumber("maxPerPosition", value)}
          />
          <NumberField
            label="Max QB Keepers"
            max={2}
            min={0}
            value={settings.maxQbs}
            onChange={(value) => updateNumber("maxQbs", value)}
          />
        </SettingsGroup>

        <SettingsGroup title="Eligibility">
          <NumberField
            label="Minimum Keeper Value"
            value={settings.minimumKeeperValue}
            onChange={(value) => updateNumber("minimumKeeperValue", value)}
          />
          <NumberField
            label="Minimum Keeper Score"
            value={settings.minimumKeeperScore}
            onChange={(value) => updateNumber("minimumKeeperScore", value)}
          />
          <NumberField
            label="ADP Cap"
            value={settings.maxAdpCap}
            onChange={(value) => updateNumber("maxAdpCap", value)}
          />
        </SettingsGroup>

        <SettingsGroup title="Position Weights">
          <NumberField
            label="QB"
            step={0.05}
            value={settings.qbWeight}
            onChange={(value) => updateNumber("qbWeight", value)}
          />
          <NumberField
            label="RB"
            step={0.05}
            value={settings.rbWeight}
            onChange={(value) => updateNumber("rbWeight", value)}
          />
          <NumberField
            label="WR"
            step={0.05}
            value={settings.wrWeight}
            onChange={(value) => updateNumber("wrWeight", value)}
          />
          <NumberField
            label="TE"
            step={0.05}
            value={settings.teWeight}
            onChange={(value) => updateNumber("teWeight", value)}
          />
        </SettingsGroup>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <ToggleRow
          checked={settings.superflexBonus}
          label="Tiered Superflex QB Scarcity"
          onChange={(value) => updateBoolean("superflexBonus", value)}
        />
        <ToggleRow
          checked={settings.draftSlotBonus}
          label="Draft Slot Bonus"
          onChange={(value) => updateBoolean("draftSlotBonus", value)}
        />
      </div>
    </PagePanel>
  );
}

type OptimizerSettingsPageProps = OptimizerSettingsForm;

function KeeperRecommendationsPage() {
  const {
    data,
    exportRecommendations,
    isBusy,
    runOptimizerNow,
    setManualOverrideNow,
  } = useDashboard();
  return (
    <PagePanel
      title="Keeper Recommendations"
      description="Optimizer output with value, score, eligibility, and selection reason."
      action={
        <div className="flex flex-wrap gap-2">
          <Button disabled={isBusy} onClick={runOptimizerNow}>
            <Play className="size-4" aria-hidden="true" />
            Run Optimizer
          </Button>
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
        showOverrides
      />
    </PagePanel>
  );
}

function ScenarioComparisonPage() {
  const { data, isBusy, runScenariosNow } = useDashboard();
  const teamNames = React.useMemo(
    () =>
      Array.from(
        new Set(
          data.scenarioComparisons.flatMap((scenario) =>
            scenario.teams.map((teamResult) => teamResult.team),
          ),
        ),
      ),
    [data.scenarioComparisons],
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
              Keeper sets, total score, forfeited picks, and strategic notes by preset.
            </CardDescription>
          </div>
          <Button disabled={isBusy} onClick={runScenariosNow}>
            <Play className="size-4" aria-hidden="true" />
            Run All Presets
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="min-w-[1180px] border-collapse bg-white text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="sticky left-0 z-[1] w-56 bg-zinc-50 px-3 py-3 text-left text-xs font-semibold uppercase text-zinc-500">
                    Team
                  </th>
                  {data.scenarioComparisons.map((scenario) => (
                    <th
                      key={scenario.scenarioName}
                      className="w-[260px] px-3 py-3 text-left text-xs font-semibold uppercase text-zinc-500"
                    >
                      {scenario.scenarioName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamNames.map((teamName) => (
                  <tr key={teamName} className="border-b border-zinc-100 align-top">
                    <td className="sticky left-0 z-[1] bg-white px-3 py-4 font-semibold text-zinc-900">
                      {teamName}
                    </td>
                    {data.scenarioComparisons.map((scenario) => {
                      const teamResult = scenario.teams.find((team) => team.team === teamName);
                      return (
                        <td key={`${scenario.scenarioName}-${teamName}`} className="px-3 py-4">
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
  const { data, exportRecommendations, isBusy } = useDashboard();
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {data.outlooks.map((outlook) => (
        <OutlookCard
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
  const { data } = useDashboard();
  const forfeitedCount = data.draftImpact.filter((pick) => pick.status === "Forfeited").length;
  const openTop100 = data.draftImpact.filter(
    (pick) => pick.overallPick <= 100 && pick.status === "Open",
  ).length;
  const columns = React.useMemo<ColumnDef<DraftImpactPick>[]>(
    () => [
      { accessorKey: "round", header: "Round" },
      { accessorKey: "pickInRound", header: "Pick In Round" },
      { accessorKey: "overallPick", header: "Overall" },
      { accessorKey: "team", header: "Team" },
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
    [],
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
        <DraftBoardPreview picks={data.draftImpact} />
        <DataTable columns={columns} data={data.draftImpact} />
      </div>
    </PagePanel>
  );
}

function DraftBoardPreview({ picks }: { picks: DraftImpactPick[] }) {
  const rounds = Array.from(new Set(picks.map((pick) => pick.round))).slice(0, 8);
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
    error: "Mock",
    live: "API Live",
    loading: "Loading",
    mock: "Mock",
  }[status];
  const variant = status === "live" ? "success" : status === "loading" ? "info" : "warning";
  return <Badge variant={variant}>{label}</Badge>;
}

function ScenarioSummaryCard({ scenario }: { scenario: ScenarioComparison }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{scenario.scenarioName}</CardTitle>
        <CardDescription>{scenario.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase text-zinc-500">Total Score</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">
            {formatter.format(scenario.totalKeeperScore)}
          </p>
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
        <span className="text-xs font-semibold uppercase text-zinc-500">Score</span>
        <span className="font-semibold text-zinc-950">
          {formatter.format(teamResult.totalKeeperScore)}
        </span>
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
  showOverrides = false,
}: {
  data: KeeperRecommendation[];
  compact?: boolean;
  onOverride?: (
    teamId: string | undefined,
    playerId: string | undefined,
    overrideType: ManualOverrideType,
  ) => void;
  showOverrides?: boolean;
}) {
  const columns = React.useMemo<ColumnDef<KeeperRecommendation>[]>(
    () => [
      { accessorKey: "team", header: "Team" },
      { accessorKey: "player", header: "Player" },
      {
        accessorKey: "position",
        header: "Pos",
        cell: ({ getValue }) => <PositionBadge position={getValue<string>()} />,
      },
      { accessorKey: "keeperCostPick", header: "Cost Pick" },
      { accessorKey: "adpPick", header: "ADP" },
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
        header: "Override",
        cell: ({ row }) => (
          <ManualOverrideControls recommendation={row.original} onOverride={onOverride} />
        ),
      },
      { accessorKey: "reason", header: "Reason" },
    ],
    [onOverride],
  );

  const visibleColumns = compact
    ? columns.slice(1, 8)
    : showOverrides
      ? columns
      : columns.filter((column) => column.header !== "Override");

  return <DataTable columns={visibleColumns} data={data} />;
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
    <div className="flex items-center gap-1.5">
      <Badge variant={current === "auto" ? "default" : current === "force_keep" ? "success" : "danger"}>
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
  accent,
}: {
  label: string;
  value: string;
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
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">{value}</p>
        </div>
        <div className={cn("size-2 rounded-full", accentClass)} />
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
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
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
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white p-4">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
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
  disabled,
  onExport,
  outlook,
}: {
  disabled?: boolean;
  onExport?: () => void;
  outlook: Outlook;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="truncate">{outlook.team}</CardTitle>
          <div className="flex items-center gap-2">
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
