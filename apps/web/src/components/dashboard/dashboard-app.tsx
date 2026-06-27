"use client";

import confetti from "canvas-confetti";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeftRight,
  BarChart2,
  Ban,
  Bot,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Gauge,
  GitCompare,
  History,
  KeyRound,
  Lock,
  LogOut,
  ListChecks,
  MessageCircle,
  PanelLeft,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
  Trophy,
  Upload,
  UserCircle,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";

import { DataTable, resetDataTableDisplaySettings } from "@/components/dashboard/data-table";
import { MessagingOverlay } from "@/components/messaging/MessagingOverlay";
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
  type AdpHistoryPoint,
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
  downloadBulkExport,
  downloadCurrentAdp,
  downloadKeeperCard,
  endMockDraft,
  exportUrl,
  generateKeeperExplanation,
  generatePlayerSummary,
  generateScenarioNarrative,
  generateMockDraftStrategyPlan,
  getAiUsage,
  getComplianceReport,
  getKeeperReveal,
  getNewsAlerts,
  getLeagueMemberships,
  getMessagingContacts,
  getPlayerSummary,
  getSmtpStatus,
  hydrateTeams,
  importCompositeAdpSnapshot,
  importCsv,
  getCurrentUser,
  getUserLeagueMemberships,
  adminListLeagues,
  listAdminUsers,
  listLeagueTeams,
  listMyLeagues,
  setUserLeagueTeam,
  listMockDrafts,
  loadWorkspaceData,
  loadScenarioSelections,
  login,
  logout,
  register,
  mockWorkspaceData,
  fetchMockDraftPickRecommendation,
  makeMockDraftBotPick,
  makeMockDraftPick,
  pauseMockDraft,
  previewCsv,
  readMockDraft,
  analyzeKeeperTrade,
  commitEspnImport,
  commitSleeperImport,
  commitYahooImport,
  getYahooAuthStatus,
  initYahooAuth,
  listYahooUserLeagues,
  previewEspnImport,
  previewSleeperImport,
  previewYahooImport,
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
  sendKeeperReminders,
  startMockDraft,
  updateAdminUser,
  updateCommissionerSettings,
  updateLeagueCalendarSettings,
  updateLeagueFormat,
  updateLeagueMemberRole,
  updateProfile,
  uploadLeagueAvatar,
  upsertLeagueMembership,
  updateTeam,
  type AdminLeague,
  type AdminUser,
  type LeagueTeam,
  type UserLeagueMembership,
  type TeamForm,
  type AuthUser,
  type ComplianceResult,
  type NewsAlert,
  type CsvImportKind,
  type CsvPreviewResult,
  type KeeperRevealResult,
  type EspnImportPreview,
  type SleeperImportPreview,
  type SmtpStatus,
  type YahooAuthStatus,
  type YahooImportPreview,
  type YahooUserLeague,
  type DraftImpactPick,
  type LeagueCalendarSettings,
  type LeagueCreateForm,
  type LeagueMembership,
  type MessagingContact,
  type LeagueRosterSettings,
  type LeagueWithRole,
  type ManualOverrideType,
  type AiUsage,
  type MockDraftAvailablePlayer,
  type MockDraftBoardSlot,
  type MockDraftCreateForm,
  type MockDraftHistoryRow,
  type MockDraftPickRecommendation,
  type MockDraftSession,
  type NewsHeadline,
  type TeamDraftHistory,
  getLeagueDraftHistory,
  getLeagueKeeperSignals,
  getKeeperHistory,
  previewKeeperOutcomesCsv,
  importKeeperOutcomesCsv,
  getFinalKeepers,
  getFinalKeepersPrefill,
  setTeamFinalKeepers,
  finalizeKeepers,
  selfFinalizeTeamKeepers,
  selfUnfinalizeTeamKeepers,
  type KeeperHistory,
  type KeeperOutcomesPreviewResult,
  type TeamKeeperHistory,
  type PlayerKeeperHistory,
  type LeagueKeeperSeasonSummary,
  type FinalKeepersResult,
  type FinalKeeperTeam,
  type FinalKeeperSelectionRow,
  type FinalKeepersPrefillResult,
  type FinalKeeperInput,
  previewSleeperOutcomes,
  importSleeperOutcomes,
  getSeasonAnalysis,
  getDraftBoard,
  type SleeperOutcomesPreviewResult,
  type SleeperOutcomeRow,
  type SeasonAnalysisResult,
  type TeamSeasonAnalysis,
  type SeasonDecision,
  type SeasonDecisionCategory,
  type DraftBoardResult,
  type DraftBoardPick,
  type LeagueKeeperSignals,
  type TeamKeeperSignal,
  type OptimizerSettingsForm,
  type PlayerSummary,
  type ScenarioNarrative,
  type TradeAnalysisResult,
  type TradePlayerRow,
  type UserForm,
  type ValueWindowResult,
  type WorkspaceData,
  type KeeperTenureRow,
  getValueWindow,
  saveLeagueKeeperSettings,
  loadKeeperTenure,
  previewTenureCsv,
  importTenureCsv,
  deleteTenureRecord,
  clearAllTenure,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  searchWatchlistPlayers,
  getEmailSettings,
  updateEmailSettings,
  setMemberEmailOptOut,
  sendCustomCommissionerEmail,
  sendLeagueInvite,
  type EmailSettings,
  type LeagueMembershipEmailPref,
  type WatchlistEntry,
  type WatchlistSearchResult,
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
  | "trade-analyzer"
  | "scenarios"
  | "outlooks"
  | "draft-impact"
  | "mock-draft"
  | "mock-draft-history"
  | "keeper-history"
  | "final-keepers"
  | "season-analysis"
  | "draft-board"
  | "commissioner-tools";

type NavItem = {
  id: ViewId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  platformAdminOnly?: boolean;
};

const navItems: NavItem[] = [
  { id: "guide", label: "How to Use", icon: BookOpen },
  { id: "dashboard", label: "League Dashboard", icon: Gauge },
  { id: "recommendations", label: "Keeper Recommendations", icon: Trophy },
  { id: "trade-analyzer", label: "Trade Analyzer", icon: ArrowLeftRight },
  { id: "scenarios", label: "Scenario Comparison", icon: GitCompare },
  { id: "draft-impact", label: "Draft Impact", icon: ClipboardList },
  { id: "outlooks", label: "Team Outlook", icon: ShieldCheck },
  { id: "season-analysis", label: "Season Analysis", icon: BarChart2 },
  { id: "mock-draft", label: "Mock Draft", icon: Bot },
  { id: "mock-draft-history", label: "Mock Draft History", icon: History },
  { id: "keeper-history", label: "Keeper History", icon: ClipboardList },
  { id: "final-keepers", label: "Final Keepers", icon: KeyRound },
  { id: "draft-board", label: "Final Draft Board", icon: ListChecks },
  { id: "teams", label: "Teams", icon: Users },
  { id: "draft", label: "Draft Results", icon: ClipboardList },
  { id: "rosters", label: "Final Rosters", icon: ListChecks },
  { id: "settings", label: "Optimizer Settings", icon: SlidersHorizontal },
  { id: "commissioner-tools", label: "Commissioner Tools", icon: Wrench, adminOnly: true },
  { id: "admin", label: "Platform Admin", icon: ShieldCheck, platformAdminOnly: true },
];

const navGroups: { label: string | null; ids: ViewId[] }[] = [
  { label: null, ids: ["guide", "dashboard"] },
  { label: "Keeper Tools", ids: ["recommendations", "trade-analyzer", "scenarios", "draft-impact", "outlooks", "season-analysis", "final-keepers", "keeper-history"] },
  { label: "Draft Room", ids: ["mock-draft", "mock-draft-history", "draft-board"] },
  { label: "League Data", ids: ["teams", "draft", "rosters"] },
  { label: "Settings", ids: ["settings", "commissioner-tools", "admin"] },
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
    title: "Platform Admin",
    icon: ShieldCheck,
    bestFor: "Platform-admin-only controls: AI token usage monitoring, ADP snapshot management, user management, and league management.",
    howToRead: "AI Usage shows token consumption, request counts, and estimated cost by feature for the current month — use this to track spending when AI features are enabled. ADP Input lets you build and import a composite ADP board or paste a custom CSV snapshot directly. User Management creates and manages platform accounts and per-league memberships. League Management lists every league on the platform — expand any row to see its members and their roles, or delete a league using the danger-indicated Delete button.",
    watchFor: "This menu is only visible to platform admins. AI Usage is read-only; to change AI behavior, update the feature flags in the API environment variables. Always run the optimizer after importing a new ADP snapshot. League deletion is permanent and cascades to all associated data — confirm the correct league before proceeding.",
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
    bestFor: "The primary decision screen for reviewing keeper recommendations — and for league members to officially submit their own team's keepers.",
    howToRead: "Recommended means selected by the optimizer. Eligible means qualified but not selected due to a limit. Excluded means failed a threshold or was manually removed. The collapsible Value vs. Cost chart plots each candidate by cost (round forfeited, X-axis) and value (rounds saved vs. ADP, Y-axis) — use the My Team shortcut above the team list to focus the chart on your own team, or check individual teams with the checkboxes. The Finalize Keepers button sits to the left of the Team Filter in the table toolbar: clicking it locks your team's recommended keepers into the Final Keepers board. Once finalized, the button changes to Unfinalize (available until the keeper deadline). A blue What Changed banner appears at the top after an optimizer re-run whenever the Recommended set shifts.",
    watchFor: "Finalize Keepers submits the current Recommended keepers for your team — review them first. The Unfinalize option disappears after the keeper deadline, so submit before that date. Manual overrides (Force Keep and Exclude) are best for real-world context the model cannot know; they take effect on the next Run Optimizer.",
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
    howToRead: "Your team's currently recommended keepers are already accounted for before the draft starts — they do not appear in the available player pool and their picks are forfeited on the board. All other teams are controlled by AI bots. Each bot has a personality (Balanced, Aggressive, Value Hunter, etc.) that shapes its drafting style and a difficulty level (Easy, Medium, Hard) that controls how optimally it executes that style. The Strategy Coach generates an AI plan before the draft starts, showing position priorities, specific player targets, and per-round guidance that updates as picks are made. When it is your pick, a Best Available card highlights the top player by ADP value with a direct Draft button. The position chip row below the search box filters the available player list and shows how many of each position you have already drafted.",
    watchFor: "Run the optimizer and confirm your keeper recommendations before starting a Mock Draft. Any keeper changes made in Recommendations or via Settings after a session was created will only appear in new sessions — already-created sessions retain the keeper context they were built with. If you want to test how a different keeper strategy affects your draft, update settings, save them, then create a new Mock Draft session. League roster settings (round count, position slots, caps) are configured under Commissioner Tools.",
    view: "mock-draft",
  },
  {
    title: "Final Keepers",
    icon: KeyRound,
    bestFor: "Tracking which teams have submitted their keeper picks and giving commissioners one place to review, fill in, and ultimately lock the official list.",
    howToRead: "Each team card shows their keepers and a green Submitted badge when the team owner has self-finalized from the Recommendations board. The board is hidden from non-admin members until the Keeper Reveal Date set in Commissioner Tools — after that date all members can view it. Commissioners can click Finalize for Team on any card where the owner missed the deadline, which copies that team's current recommendations into their selections. When every team is accounted for, click Finalize & Lock to publish the official list league-wide and populate the Final Draft Board.",
    watchFor: "The board is not visible to members until the reveal date — if members report they cannot see it, check the date in Commissioner Tools → League Dates. Finalize & Lock is irreversible except by a platform admin. Confirm all teams are correct before locking.",
    view: "final-keepers",
    adminOnly: false,
  },
  {
    title: "Final Draft Board",
    icon: ClipboardList,
    bestFor: "Seeing the full draft pick grid after keepers are finalized — which picks are forfeited and which remain available in each round.",
    howToRead: "Each cell shows the overall pick number. Red cells are forfeited by a keeper — the kept player's name and position are shown inline. Available picks are shown by pick number only. Columns are fixed by draft slot so each team's picks stay in the same column across rounds.",
    watchFor: "The board is computed from Final Keeper Selections. If pick numbers look wrong, check that keeper cost rounds and pick numbers were entered correctly in Final Keepers. The round count comes from League Settings under Commissioner Tools.",
    view: "draft-board",
  },
  {
    title: "Season Analysis",
    icon: BarChart2,
    bestFor: "Post-season review of keeper decision quality — who hit, who busted, what value was left on the table, and how well the optimizer's recommendations performed.",
    howToRead: "League summary cards show hit rate, bust rate, left-on-table count, and recommendation accuracy. Expand a team card to see every keeper decision categorized as Hit, Miss, Bust, Left on Table, Dodged, or Below ADP, with finish rank and fantasy points alongside the original ADP projection.",
    watchFor: "Requires season outcomes to be imported first. Ask a league commissioner to run Sleeper auto-fetch or upload a CSV from Commissioner Tools → League Data Imports. Analysis is only meaningful once FinalKeeperSelections are recorded — without them, the Hit/Miss/Left on Table distinction cannot be made.",
    view: "season-analysis",
  },
  {
    title: "Keeper History",
    icon: History,
    bestFor: "Multi-year keeper ROI tracking across the league, broken down by season, team, and individual player.",
    howToRead: "The League Season Summary table shows league-wide hit rate, bust rate, and opportunity cost per season. Team ROI cards break down each manager's historical keeper decisions. Player History cards show each recurring keeper candidate's track record — how often they were kept, and whether they paid off.",
    watchFor: "Data only appears after season outcomes have been imported for at least one year. The richer the outcome history, the more meaningful the trend data becomes.",
    view: "keeper-history",
  },
  {
    title: "Commissioner Tools",
    icon: Wrench,
    bestFor: "All league commissioner tasks: managing teams, members, imports, league settings, keeper rules, compliance, reveal, reminders, invites, and bulk export.",
    howToRead: "League Management, Draft Format, League Settings, League Data Imports (Sleeper / Yahoo / ESPN / CSV), League Members, Invite Member, Keeper Rules, and Keeper Tenure are all here. Commissioner Dates sets deadlines and reveal date, Compliance Checker verifies every team is within limits, Keeper Reveal controls member visibility, Reminder Emails sends deadline notices, Send Message to League composes a custom email blast, and Bulk Export bundles all keeper card PNGs into a ZIP. Use Invite Member to onboard owners: if the email matches an existing account, a branded invite email is queued and an in-app DM is sent to that user; if the email is not yet registered, enter an Owner Alias (how they'll be addressed in the email) and a registration invite is sent instead.",
    watchFor: "Run the optimizer after any import so the compliance checker has fresh data. Always preview imports before committing. Set the reveal date before finalization so the keeper reveal works as expected. SMTP credentials must be configured on the server before email sending or invites are enabled.",
    view: "commissioner-tools",
    adminOnly: true,
  },
  {
    title: "League Messages",
    icon: MessageCircle,
    bestFor: "Real-time direct messages between league members and a shared league-wide channel — accessible from anywhere in the app without leaving your current screen.",
    howToRead: "Click the emerald chat button fixed in the bottom-right corner to open the message panel. The panel shows two types of conversations: the League Chat channel (marked with a # badge) where all members can post, and individual Direct Message threads with each member. Select any conversation to load its history and start typing. Press Enter to send or Shift+Enter for a new line. Messages deliver instantly to anyone online at the same time; members who are offline will see them the next time they open the panel. A red badge on the chat button counts all unread messages across every conversation.",
    watchFor: "The message panel is only available when you are signed in and have an active league selected. Direct messages are scoped to members of your leagues — you can only DM someone you share a league with. The league commissioner always appears in your DM list even if they have not been assigned a team.",
    view: "guide",
  },
];

const workflowSteps: WorkflowStep[] = [
  {
    title: "Confirm the source data",
    text: "Check teams, draft results, final rosters, and ADP before trusting recommendations. Admins can pull data automatically from Sleeper, Yahoo Fantasy, or ESPN via the import panels in Commissioner Tools, or paste CSV directly. Always run the optimizer after any import.",
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
    title: "Finalize keeper selections",
    text: "League members submit their own team's keepers directly from Keeper Recommendations: review the list, then click Finalize Keepers (left of the Team Filter). This locks your picks into the Final Keepers board and shows a Submitted badge for your team. Members can Unfinalize before the keeper deadline if they need to make changes. If a member misses the deadline, the commissioner can open Final Keepers and click Finalize for Team on that card. When all teams are set, the commissioner clicks Finalize & Lock to publish the official list and auto-generate the Final Draft Board.",
    view: "final-keepers",
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
  {
    title: "Import season outcomes",
    text: "After the season, open Admin and use the Sleeper Season Stats auto-fetch to pull end-of-season stats for all keeper candidates — no Sleeper league account required. Choose the season year and scoring format, preview the match results, then import. Use Upload CSV as a fallback if auto-fetch doesn't cover your league.",
    view: "admin",
  },
  {
    title: "Review Season Analysis and Keeper History",
    text: "Open Season Analysis for a full post-season breakdown: which kept players hit or busted, what value was left on the table by not keeping certain players, and how well the optimizer's recommendations performed. Open Keeper History for multi-year ROI trends by season, team, and individual player.",
    view: "season-analysis",
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
    text: "Preview validates data before any writes — for CSV pastes this catches errors row by row; for platform imports (Sleeper, Yahoo, ESPN) it shows which teams, picks, and roster entries will be created. Import commits the validated data. Always run the optimizer after an import when you want recommendations to reflect the new data.",
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
    meaning: "An optional countdown per pick in Mock Draft, set to 30, 60, 90, or 120 seconds. When the timer expires on your turn, the AI automatically makes your pick using the top available player by ADP. Disable it by selecting No limit for a relaxed practice session.",
  },
  {
    term: "Final Keepers",
    meaning: "The admin-confirmed list of players each team is officially keeping, locked before the draft deadline and published to all league members. Serves as the source of truth for forfeited picks on the Final Draft Board and for the Season Analysis kept/not-kept distinction.",
  },
  {
    term: "Final Draft Board",
    meaning: "The full snake-draft pick grid generated from Final Keeper Selections. Each forfeited pick shows the kept player's name and position. Available picks are shown by overall pick number. Columns are fixed by draft slot.",
  },
  {
    term: "Season Outcome",
    meaning: "End-of-season stats for a keeper candidate: finish rank at their position, fantasy points scored, and whether they met or busted the ADP projection made at the time of the keep. Imported via Sleeper auto-fetch or CSV.",
  },
  {
    term: "Hit",
    meaning: "A kept player who met or exceeded their ADP projection — their finish rank was within the expected tier based on their keeper cost. Counts toward a team's hit rate.",
  },
  {
    term: "Miss",
    meaning: "A kept player who underperformed their ADP projection but was not a full bust — they finished worse than expected without crossing the bust threshold.",
  },
  {
    term: "Bust",
    meaning: "A kept player who significantly underperformed — their finish rank was more than 3× the implied ADP tier. A kept player who was a bust hurt the team both in lost draft capital and in actual production.",
  },
  {
    term: "Left on Table",
    meaning: "A player who was not kept but would have been a Hit if kept. Represents opportunity cost — the team passed on pick savings and production it could have had.",
  },
  {
    term: "Dodged",
    meaning: "A player who was not kept and turned out to be a Bust. Represents a correct non-keep decision — the team avoided wasting a draft pick on a player who underperformed.",
  },
  {
    term: "Keeper ROI",
    meaning: "The return on investment across keeper decisions over one or more seasons, measured by hit rate, bust rate, and opportunity cost. Visible in Keeper History and Season Analysis.",
  },
];

type ApiStatus = "loading" | "live" | "mock" | "no-league" | "error";
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
  downloadCurrentAdpNow: () => Promise<void>;
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
  setActiveView: (view: ViewId) => void;
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
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const activeGroup = navGroups.find((g) => g.label && g.ids.includes(activeView));
    if (activeGroup?.label) {
      setExpandedGroups((prev) => new Set([...prev, activeGroup.label!]));
    }
  }, [activeView]);
  const [workspace, setWorkspace] = React.useState<WorkspaceData>(mockWorkspaceData);
  const [apiStatus, setApiStatus] = React.useState<ApiStatus>("loading");
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(null);
  const currentUserRef = React.useRef<AuthUser | null>(null);
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
    "keeper-tenure": null,
  });
  const [settings, setSettings] = React.useState<OptimizerSettingsForm>(mockWorkspaceData.settings);
  const [selectedScenarioByTeam, setSelectedScenarioByTeam] = React.useState<TeamScenarioSelection>(
    {},
  );
  const [tableDisplayResetSignal, setTableDisplayResetSignal] = React.useState(0);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [leagueMembers, setLeagueMembers] = React.useState<MessagingContact[]>([]);

  const isPlatformAdmin = currentUser?.role === "platform_admin";
  const activeLeagueMembership = userLeagues.find((l) => l.id === activeLeagueId);
  const isLeagueAdmin = isPlatformAdmin || activeLeagueMembership?.leagueRole === "league_admin";
  const isAdmin = isPlatformAdmin;
  const visibleNavItems = React.useMemo(
    () => navItems.filter((item) => {
      if (item.platformAdminOnly) return isPlatformAdmin;
      if (item.adminOnly) return isLeagueAdmin;
      return true;
    }),
    [isLeagueAdmin, isPlatformAdmin],
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
        const user = currentUserRef.current;
        if (user && user.role !== "platform_admin") {
          setApiStatus("no-league");
          return;
        }
        setWorkspace(mockWorkspaceData);
        setSettings(mockWorkspaceData.settings);
        setApiStatus("mock");
        toast.info("No backend league yet; showing mock workspace data.");
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
      toast.success(`Connected to ${loaded.league?.name ?? "backend league"}.`);
    } catch {
      setWorkspace(mockWorkspaceData);
      setSettings(mockWorkspaceData.settings);
      setApiStatus("error");
      toast.warning("API unavailable; using mock workspace data.");
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
      toast.success(`League "${newLeague.name}" created.`);
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
      toast.success("League deleted.");
      if (next) {
        await refreshData(next.id);
      } else {
        setUserLeagues([]);
        setActiveLeagueId(null);
        setWorkspace(mockWorkspaceData);
        setSettings(mockWorkspaceData.settings);
        setApiStatus("mock");
        toast.info("League deleted. No leagues remaining.");
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
        currentUserRef.current = user;
        setAuthRequired(false);
        await refreshData();
        toast.success(`Signed in as ${user.email}.`);
      } finally {
        setIsBusy(false);
      }
    },
    [refreshData],
  );

  const registerNow = React.useCallback(
    async (email: string, password: string, alias?: string) => {
      setIsBusy(true);
      try {
        const user = await register(email, password, alias);
        setCurrentUser(user);
        currentUserRef.current = user;
        setAuthRequired(false);
        await refreshData();
        toast.success(`Account created. Welcome!`);
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
      toast.success("Signed out.");
    } finally {
      setIsBusy(false);
    }
  }, []);

  const updateProfileAvatarNow = React.useCallback(async (avatarDataUrl: string | null) => {
    setIsBusy(true);
    try {
      const user = await updateProfile({ avatarDataUrl });
      setCurrentUser(user);
      toast.success(avatarDataUrl ? "Profile image updated." : "Profile image removed.");
    } catch (error) {
      setApiStatus("error");
      toast.error(error instanceof Error ? error.message : "Updating profile image failed.");
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
      toast.success(avatarDataUrl ? "League avatar updated." : "League avatar removed.");
    } catch (error) {
      setApiStatus("error");
      toast.error(error instanceof Error ? error.message : "Updating league avatar failed.");
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
      toast.success(trimmedAlias ? "Owner alias updated." : "Owner alias cleared.");
    } catch (error) {
      setApiStatus("error");
      toast.error(error instanceof Error ? error.message : "Updating owner alias failed.");
      throw error;
    } finally {
      setIsBusy(false);
    }
  }, [refreshData]);

  const changePasswordNow = React.useCallback(async (currentPassword: string, newPassword: string) => {
    setIsBusy(true);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      toast.success("Password updated.");
    } catch (error) {
      setApiStatus("error");
      toast.error(error instanceof Error ? error.message : "Updating password failed.");
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
          toast.info("Sign in to continue.");
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
    if (!isPlatformAdmin && activeView === "admin") {
      setActiveView("dashboard");
    }
  }, [activeView, isPlatformAdmin]);

  React.useEffect(() => {
    if (!activeLeagueId) {
      setLeagueMembers([]);
      return;
    }
    getMessagingContacts().then(setLeagueMembers).catch(() => {});
  }, [activeLeagueId]);

  const requireLeagueId = React.useCallback(() => {
    if (workspaceData.source !== "api" || !workspaceData.league?.id) {
      toast.warning("Start the API and seed or create a league before sending data.");
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
        if (preview.valid) {
          toast.success(`Preview ready: ${preview.validRows} row(s) can be imported.`);
        } else {
          toast.warning(`Preview found ${preview.errorCount} error(s).`);
        }
      } catch {
        setApiStatus("error");
        toast.error("Preview failed. Check the CSV header and API logs.");
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
        toast.success("CSV imported and workspace refreshed.");
      } catch {
        setApiStatus("error");
        toast.error("Import failed. Check the CSV columns and API logs.");
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
      toast.success("Optimizer settings applied and optimizer run completed.");
    } catch {
      setApiStatus("error");
      toast.error("Optimizer run failed. Confirm draft, roster, and ADP data are loaded.");
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
      toast.success("Composite ADP CSV downloaded.");
    } catch {
      setApiStatus("error");
      toast.error("Composite ADP build failed. Check the ADP source connection.");
    } finally {
      setIsBusy(false);
    }
  }, [requireLeagueId]);

  const downloadCurrentAdpNow = React.useCallback(async () => {
    const leagueId = requireLeagueId();
    if (!leagueId) {
      return;
    }
    setIsBusy(true);
    try {
      await downloadCurrentAdp(leagueId);
      setApiStatus("live");
      toast.success("ADP CSV downloaded.");
    } catch {
      setApiStatus("error");
      toast.error("ADP download failed. No ADP snapshot may be loaded yet.");
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
      toast.success("Composite ADP imported into the active snapshot.");
    } catch (error) {
      setApiStatus("error");
      toast.error(error instanceof Error ? error.message : "Composite ADP import failed.");
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
        toast.success("User created.");
      } catch (error) {
        setApiStatus("error");
        toast.error(error instanceof Error ? error.message : "Creating user failed.");
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
        toast.success("User updated.");
      } catch (error) {
        setApiStatus("error");
        toast.error(error instanceof Error ? error.message : "Updating user failed.");
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
        toast.success("User password reset.");
      } catch (error) {
        setApiStatus("error");
        toast.error(error instanceof Error ? error.message : "Resetting password failed.");
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
        toast.success("User deleted.");
      } catch (error) {
        setApiStatus("error");
        toast.error(error instanceof Error ? error.message : "Deleting user failed.");
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
        toast.success("Team created.");
      } catch {
        setApiStatus("error");
        toast.error("Creating team failed.");
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
        toast.success("Team updated.");
      } catch {
        setApiStatus("error");
        toast.error("Updating team failed.");
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
        toast.success("Team deleted.");
      } catch {
        setApiStatus("error");
        toast.error("Deleting team failed.");
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
      toast.success("Optimizer settings applied and scenario comparison completed.");
    } catch {
      setApiStatus("error");
      toast.error("Scenario comparison failed. Run the optimizer inputs check first.");
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
        toast.success("Optimizer settings saved and recommendations reset.");
      } catch {
        setApiStatus("error");
        toast.error("Saving settings failed.");
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
        toast.success("League countdown dates saved.");
      } catch (error) {
        setApiStatus("error");
        toast.error(error instanceof Error ? error.message : "Saving league dates failed.");
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
        toast.success("League roster settings saved.");
      } catch {
        setApiStatus("error");
        toast.error("Saving league roster settings failed.");
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
        toast.warning("Manual overrides need live API recommendation IDs.");
        return;
      }
      setIsBusy(true);
      try {
        await setManualOverride(leagueId, teamId, playerId, overrideType);
        await runOptimizer(leagueId);
        await refreshData();
        toast.success("Manual override saved; team plan is now Custom.");
      } catch {
        setApiStatus("error");
        toast.error("Manual override failed.");
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
      downloadCurrentAdpNow,
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
      setActiveView,
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
      downloadCurrentAdpNow,
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
      setActiveView,
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
    return <LoginScreen isBusy={isBusy} onLogin={loginNow} onRegister={registerNow} />;
  }

  if (currentUser && apiStatus === "no-league") {
    return <NoLeagueScreen user={currentUser} onLogout={logoutNow} />;
  }

  return (
    <DashboardContext.Provider value={contextValue}>
      <main className="min-h-screen bg-[#f6f5f1] text-zinc-950 dark:bg-[#040E1B] dark:text-[#EBF4F9]">
      <div className="grid min-h-screen lg:grid-cols-[264px_minmax(0,1fr)]">
        {mobileSidebarOpen && (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-72 border-r border-zinc-200 bg-white transition-transform dark:border-[#1a3050] dark:bg-[#071829] lg:static lg:z-auto lg:w-auto lg:transition-none",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
          style={{ borderTop: "2px solid #FFB340" }}
        >
          <div className="flex h-full flex-col">
            {/* Sidebar brand header — py-[10px] compensates for the 2px aside border-top so
                this div's bottom border lines up with the main header's bottom border */}
            <div className="relative flex items-center justify-center border-b border-[#1a3050] bg-[#040E1B] px-4 py-[10px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/large_text_shield_logo_with_dark_background.png"
                alt="Mayhem Fantasy Football Tools"
                className="h-40 w-auto max-w-full object-contain"
              />
              <button
                aria-label="Close navigation menu"
                className="absolute right-2 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-md text-[#8fa4b3] hover:bg-[rgba(128,232,255,0.08)] hover:text-[#80E8FF] lg:hidden"
                onClick={() => setMobileSidebarOpen(false)}
                type="button"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
              {navGroups.map((group) => {
                const groupItems = group.ids
                  .map((id) => visibleNavItems.find((item) => item.id === id))
                  .filter(Boolean) as NavItem[];
                if (!groupItems.length) return null;
                const isExpanded = !group.label || expandedGroups.has(group.label);
                return (
                  <div key={group.label ?? "top"} className="lg:mb-1">
                    {group.label && (
                      <button
                        className="flex w-full items-center justify-between px-3 pb-1 pt-3 text-left transition-colors hover:text-[#EBF4F9]"
                        onClick={() =>
                          setExpandedGroups((prev) => {
                            const next = new Set(prev);
                            if (next.has(group.label!)) next.delete(group.label!);
                            else next.add(group.label!);
                            return next;
                          })
                        }
                        type="button"
                      >
                        <span className="text-[10px] font-['Oswald'] font-semibold uppercase tracking-widest text-[#80E8FF]">
                          {group.label}
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-3 text-[#8fa4b3] transition-transform duration-200",
                            isExpanded && "rotate-180",
                          )}
                          aria-hidden="true"
                        />
                      </button>
                    )}
                    {isExpanded && groupItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeView === item.id;
                      return (
                        <button
                          key={item.id}
                          className={cn(
                            "group flex min-h-[44px] w-full shrink-0 items-center gap-2.5 rounded-r-md border-l-2 pl-2.5 pr-3 text-left text-sm transition-colors lg:min-h-0 lg:h-9 lg:w-auto",
                            isActive
                              ? "border-[#FFB340] bg-[rgba(255,179,64,0.12)] font-semibold text-[#FFB340]"
                              : "border-transparent font-medium text-[#BDC8D3] hover:bg-[rgba(128,232,255,0.06)] hover:text-[#EBF4F9]",
                          )}
                          onClick={() => { setActiveView(item.id); setMobileSidebarOpen(false); }}
                          title={item.label}
                          type="button"
                        >
                          <Icon
                            className={cn(
                              "size-4 shrink-0 transition-colors",
                              isActive ? "text-[#FFB340]" : "text-[#8fa4b3] group-hover:text-[#80E8FF]",
                            )}
                            aria-hidden="true"
                          />
                          <span className="whitespace-nowrap">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </nav>

            <div className="border-t border-[#1a3050] p-4">
              <div className="rounded-md border border-[rgba(255,179,64,0.3)] bg-[rgba(255,179,64,0.07)] p-3">
                <p className="text-[10px] font-['Oswald'] font-semibold uppercase tracking-widest text-[#FFB340]">Active snapshot</p>
                <p className="mt-1 text-sm text-[#EBF4F9]">
                  {workspaceData.activeSnapshot?.name ?? "No ADP snapshot"}
                </p>
                <p className="text-xs text-[#BDC8D3]">
                  {workspaceData.activeSnapshot?.snapshotDate ?? "Import ADP to begin"}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-[#1a3050] bg-[rgba(4,14,27,0.95)] px-4 py-3 backdrop-blur md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  aria-label="Open navigation menu"
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-[#8fa4b3] hover:bg-[rgba(128,232,255,0.08)] hover:text-[#80E8FF] lg:hidden"
                  onClick={() => setMobileSidebarOpen(true)}
                  type="button"
                >
                  <PanelLeft className="size-5" aria-hidden="true" />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/logo-shield.png"
                  alt="Mayhem"
                  className="hidden h-8 w-8 shrink-0 rounded object-cover lg:block"
                />
                <div className="min-w-0">
                  <p className="hidden text-[10px] font-['Oswald'] font-semibold uppercase tracking-widest text-[#80E8FF] sm:block">Mayhem &bull; League Workspace</p>
                  <h1 className="truncate font-['Oswald'] text-base font-semibold uppercase tracking-wide sm:text-xl" style={CHROME_TEXT_STYLE}>{activeLabel}</h1>
                </div>
                <div className="hidden sm:block">
                  <CountdownClock league={workspaceData.league} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
<ConnectionBadge status={apiStatus} />
                <Button
                  aria-label="Refresh displayed workspace data from the backend without rerunning the optimizer"
                  className="h-9 px-2 sm:h-auto sm:min-h-12 sm:flex-col sm:items-start sm:gap-0 sm:px-3 sm:py-2 sm:text-left"
                  disabled={isBusy}
                  onClick={resetDisplayAndRefresh}
                  title="Reload displayed workspace data and reset table filters/sorting. This does not rerun the optimizer."
                  variant="outline"
                >
                  <RefreshCw className="size-4 sm:hidden" aria-hidden="true" />
                  <span className="hidden sm:flex items-center gap-2">
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Refresh
                  </span>
                  <span className="hidden text-[11px] font-normal text-zinc-500 sm:block">Reload display only</span>
                </Button>
                <Button
                  aria-label="Run the optimizer to recompute keeper recommendations from the current inputs and settings"
                  className="h-9 px-2 sm:h-auto sm:min-h-12 sm:flex-col sm:items-start sm:gap-0 sm:px-3 sm:py-2 sm:text-left hover:bg-transparent dark:hover:bg-transparent hover:text-[#0C132C] dark:hover:text-[#0C132C] hover:brightness-110"
                  disabled={isBusy}
                  onClick={runOptimizerNow}
                  title="Recompute keeper recommendations from the current rosters, draft results, ADP, overrides, and optimizer settings."
                  style={{
                    backgroundImage: "url('/metallic_gold_background.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    color: "#0C132C",
                  }}
                >
                  <Play className="size-4 sm:hidden" aria-hidden="true" />
                  <span className="hidden sm:flex items-center gap-2">
                    <Play className="size-4" aria-hidden="true" />
                    Run Optimizer
                  </span>
                  <span className="hidden text-[11px] font-normal sm:block" style={{ color: "rgba(12,19,44,0.6)" }}>Recompute recommendations</span>
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
                      <div className="absolute right-0 top-14 z-30 w-[calc(100vw-2rem)] max-w-80 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                        <div className="flex items-center gap-3 border-b border-zinc-100 px-2 pb-3 pt-1 dark:border-zinc-700">
                          <AvatarImage
                            avatarDataUrl={activeLeagueMembership?.avatarDataUrl ?? currentUser.avatarDataUrl}
                            className="size-10"
                            iconClassName="size-6"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">{currentUser.email}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {isPlatformAdmin ? (
                                <Badge variant="danger">Platform Admin</Badge>
                              ) : null}
                              {activeLeagueMembership ? (
                                <Badge variant={isLeagueAdmin ? "success" : "info"}>
                                  {isLeagueAdmin ? "League Commissioner" : "Member"}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {userLeagues.length > 0 ? (
                          <div className="border-b border-zinc-100 py-2 dark:border-zinc-700">
                            <div className="mb-1 flex items-center justify-between px-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Leagues</span>
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
                                      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-400"
                                      : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
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
                                      {league.leagueRole === "league_admin" ? "League Commissioner" : "Member"}
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
                          className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
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
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
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
            {activeView === "admin" && isPlatformAdmin && (
              <AdminPage
                adpCsvText={adpCsvText}
                setAdpCsvText={setAdpCsvText}
              />
            )}
            {activeView === "settings" && (
              <OptimizerSettingsPage settings={settings} setSettings={setSettings} />
            )}
            {activeView === "profile" && <ProfilePage />}
            {activeView === "recommendations" && <KeeperRecommendationsPage />}
            {activeView === "trade-analyzer" && <TradeAnalyzerPage />}
            {activeView === "scenarios" && <ScenarioComparisonPage />}
            {activeView === "outlooks" && <TeamOutlooksPage />}
            {activeView === "draft-impact" && <DraftImpactPage />}
            {activeView === "mock-draft" && <MockDraftPage />}
            {activeView === "mock-draft-history" && <MockDraftHistoryPage />}
            {activeView === "keeper-history" && <KeeperHistoryPage />}
            {activeView === "final-keepers" && <FinalKeepersPage />}
            {activeView === "draft-board" && <DraftBoardPage />}
            {activeView === "season-analysis" && <SeasonAnalysisPage />}
            {activeView === "commissioner-tools" && isLeagueAdmin && (
              <CommissionerToolsPage
                draftCsvText={draftCsvText}
                rosterCsvText={rosterCsvText}
                setDraftCsvText={setDraftCsvText}
                setRosterCsvText={setRosterCsvText}
              />
            )}
          </div>
        </section>
      </div>
    </main>
    {currentUser && (
      <MessagingOverlay
        currentUser={currentUser}
        leagueId={activeLeagueId}
        leagueName={workspaceData.league?.name ?? null}
        members={leagueMembers}
      />
    )}
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

  const adpLockDisplay = React.useMemo(() => {
    if (!league?.adpLockDate) return null;
    const lockDate = parseLocalDate(league.adpLockDate);
    if (!lockDate) return null;
    const today = localDateStart(now);
    const isLocked = today.getTime() >= lockDate.getTime();
    return { date: formatDisplayDate(lockDate), isLocked };
  }, [league, now]);

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "shrink-0 border-l border-[#1a3050] pl-3",
          countdown.isDeadlineDay && "text-rose-700 dark:text-rose-400",
        )}
      >
        <p
          className="text-[11px] font-semibold uppercase"
          style={!countdown.isDeadlineDay ? { color: "#C7EEFF", opacity: 0.75 } : undefined}
        >
          {countdown.label}
          {countdown.targetDate ? <span className="ml-2">{countdown.targetDate}</span> : null}
        </p>
        <p
          className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-normal"
          style={!countdown.isDeadlineDay ? CHROME_TEXT_STYLE : undefined}
        >
          {countdown.value}
        </p>
      </div>
      {adpLockDisplay && (
        <div
          className={cn(
            "shrink-0 border-l border-zinc-200 pl-3 dark:border-zinc-700",
            adpLockDisplay.isLocked
              ? "text-amber-700 dark:text-amber-400"
              : "text-zinc-500 dark:text-zinc-400",
          )}
          title={
            adpLockDisplay.isLocked
              ? `ADP is locked as of ${adpLockDisplay.date}. Player values are frozen so teams can evaluate keeper costs with certainty. No further ADP refreshes are allowed.`
              : `ADP will freeze on ${adpLockDisplay.date}. After this date no further ADP refreshes are allowed, giving teams a stable view of player values before the keeper deadline.`
          }
        >
          <p className="text-[11px] font-semibold uppercase">
            ADP Lock
            <span className="ml-2">{adpLockDisplay.date}</span>
          </p>
          <p className="mt-0.5 text-sm font-semibold">
            {adpLockDisplay.isLocked ? "Locked" : "Active"}
          </p>
        </div>
      )}
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
    <main className="flex min-h-screen items-center justify-center bg-[#f6f5f1] px-4 text-zinc-950 dark:bg-[#0f0f12] dark:text-zinc-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{status}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

/* ── Shared page shell: stadium background + logo top + centered card ── */
function FormShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-start px-4 pt-8 pb-12"
      style={{
        backgroundImage: "url('/brand/bg-stadium.png')",
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundColor: "#040E1B",
      }}
    >
      {/* Dark gradient overlay — heavier at bottom so card is readable, lighter at top so stadium shows */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom, rgba(4,14,27,0.45) 0%, rgba(4,14,27,0.72) 40%, rgba(4,14,27,0.88) 100%)",
        }}
      />

      {/* Content above overlay */}
      <div className="relative z-10 flex w-full max-w-[400px] flex-col items-center">

        {/* Logo banner — dark background blends into the stadium overlay */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-signin-top.png"
          alt="Mayhem Fantasy Football Tools"
          className="mb-8 w-full max-w-[400px] rounded-xl object-cover"
          style={{ boxShadow: "0 4px 32px rgba(4,14,27,0.7)" }}
        />

        {/* Sign-in card */}
        <div
          className="w-full rounded-md border border-[#1a3050] bg-[rgba(4,14,27,0.88)] p-8 backdrop-blur-md"
          style={{
            borderTop: "2px solid #FFB340",
            boxShadow: "0 8px 48px rgba(4,14,27,0.9), 0 0 40px rgba(255,179,64,0.07)",
          }}
        >
          <div className="mb-6">
            <p className="mayhem-section-label mb-1 text-[#FFB340]">Mayhem Fantasy Football Tools</p>
            <h1 className="font-['Oswald'] text-2xl font-bold uppercase tracking-wider text-[#EBF4F9]">{title}</h1>
            <p className="mt-1 text-sm text-[#8fa4b3]">{subtitle}</p>
          </div>
          {children}
        </div>

        <p className="mt-6 text-xs text-[#3d5870]">
          &copy; {new Date().getFullYear()} Mayhem Fantasy Football Tools
        </p>
      </div>
    </main>
  );
}

function LoginScreen({
  isBusy,
  onLogin,
  onRegister,
}: {
  isBusy: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, alias?: string) => Promise<void>;
}) {
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [alias, setAlias] = React.useState("");
  const [error, setError] = React.useState("");

  function reset() {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setAlias("");
    setError("");
  }

  if (mode === "register") {
    return (
      <FormShell title="Create Account" subtitle="Register to join a keeper league.">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            if (password !== confirmPassword) {
              setError("Passwords do not match.");
              return;
            }
            if (password.length < 8) {
              setError("Password must be at least 8 characters.");
              return;
            }
            void onRegister(email, password, alias || undefined).catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : "";
              if (msg.includes("409") || msg.toLowerCase().includes("already")) {
                setError("An account with that email already exists.");
              } else {
                setError("Registration failed. Please try again.");
              }
            });
          }}
        >
          <div className="space-y-1.5">
            <Label className="text-[#BDC8D3]" htmlFor="reg-email">Email</Label>
            <Input autoComplete="email" id="reg-email" onChange={(e) => setEmail(e.target.value)} type="email" value={email} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[#BDC8D3]" htmlFor="reg-alias">Display name <span className="text-[#8fa4b3]">(optional)</span></Label>
            <Input autoComplete="nickname" id="reg-alias" onChange={(e) => setAlias(e.target.value)} placeholder="How you'll appear in the app" type="text" value={alias} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[#BDC8D3]" htmlFor="reg-password">Password</Label>
            <Input autoComplete="new-password" id="reg-password" onChange={(e) => setPassword(e.target.value)} type="password" value={password} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[#BDC8D3]" htmlFor="reg-confirm">Confirm password</Label>
            <Input autoComplete="new-password" id="reg-confirm" onChange={(e) => setConfirmPassword(e.target.value)} type="password" value={confirmPassword} />
          </div>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          <Button className="w-full" disabled={isBusy || !email || !password || !confirmPassword} type="submit">
            Create Account
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-[#8fa4b3]">
          Already have an account?{" "}
          <button className="font-semibold text-[#80E8FF] hover:underline" onClick={() => { reset(); setMode("login"); }} type="button">
            Sign in
          </button>
        </p>
      </FormShell>
    );
  }

  return (
    <FormShell title="Sign In" subtitle="Use your keeper optimizer account to continue.">
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
        <div className="space-y-1.5">
          <Label className="text-[#BDC8D3]" htmlFor="email">Email</Label>
          <Input autoComplete="email" id="email" onChange={(e) => setEmail(e.target.value)} type="email" value={email} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[#BDC8D3]" htmlFor="password">Password</Label>
          <Input autoComplete="current-password" id="password" onChange={(e) => setPassword(e.target.value)} type="password" value={password} />
        </div>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        <Button className="w-full" disabled={isBusy || !email || !password} type="submit">
          Sign In
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-[#8fa4b3]">
        Don&apos;t have an account?{" "}
        <button className="font-semibold text-[#80E8FF] hover:underline" onClick={() => { reset(); setMode("register"); }} type="button">
          Create one
        </button>
      </p>
    </FormShell>
  );
}

function NoLeagueScreen({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f5f1] px-4 text-zinc-950 dark:bg-[#0f0f12] dark:text-zinc-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome!</CardTitle>
          <CardDescription>
            You&apos;re signed in as <strong>{user.alias ?? user.email}</strong> but haven&apos;t
            been added to a league yet. Ask your commissioner to add you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={onLogout}>
            Sign Out
          </Button>
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
              className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none focus:border-[#80E8FF] focus:ring-2 focus:ring-[rgba(128,232,255,0.12)]"
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
              className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none focus:border-[#80E8FF] focus:ring-2 focus:ring-[rgba(128,232,255,0.12)]"
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
  const [emailPrefs, setEmailPrefs] = React.useState<import("@/lib/api").LeagueMembershipEmailPref[]>([]);
  const [emailPrefsSaving, setEmailPrefsSaving] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    void import("@/lib/api").then(({ getMyLeagueMemberships }) =>
      getMyLeagueMemberships().then(setEmailPrefs).catch(() => {})
    );
  }, []);

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

      {emailPrefs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Email Preferences</CardTitle>
            <CardDescription>Choose which leagues you want to receive deadline reminder emails for.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-zinc-100">
            {emailPrefs.map((pref) => (
              <div key={pref.leagueId} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{pref.leagueName}</p>
                  {pref.seasonYear ? (
                    <p className="text-xs text-zinc-500">{pref.seasonYear} season</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {pref.emailOptOut ? (
                    <span className="text-xs text-zinc-400">Opted out</span>
                  ) : (
                    <span className="text-xs text-emerald-600">Receiving emails</span>
                  )}
                  <Button
                    disabled={emailPrefsSaving[pref.leagueId]}
                    onClick={async () => {
                      setEmailPrefsSaving((s) => ({ ...s, [pref.leagueId]: true }));
                      try {
                        const { updateMemberEmailOptOut } = await import("@/lib/api");
                        const result = await updateMemberEmailOptOut(pref.leagueId, !pref.emailOptOut);
                        setEmailPrefs((prev) =>
                          prev.map((p) =>
                            p.leagueId === pref.leagueId ? { ...p, emailOptOut: result.emailOptOut } : p
                          )
                        );
                      } catch {
                        // ignore
                      } finally {
                        setEmailPrefsSaving((s) => ({ ...s, [pref.leagueId]: false }));
                      }
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {pref.emailOptOut ? "Opt back in" : "Opt out"}
                  </Button>
                </div>
              </div>
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
  const { activeLeagueId, currentUser, data, downloadCurrentAdpNow, isBusy, isLeagueAdmin, tableDisplayResetSignal } = useDashboard();
  const [adpPositionFilter, setAdpPositionFilter] = React.useState("ALL");
  const ADP_POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"] as const;
  const filteredAdpEntries = React.useMemo(
    () =>
      adpPositionFilter === "ALL"
        ? data.adpEntries
        : data.adpEntries.filter((e) => e.position === adpPositionFilter),
    [data.adpEntries, adpPositionFilter],
  );
  const adpColumns = React.useMemo<ColumnDef<ADPEntry>[]>(
    () => [
      {
        accessorKey: "player",
        header: "Player",
        meta: { className: "w-[130px] overflow-hidden px-2" },
        cell: ({ row }) => (
          <PlayerCell name={row.original.player} position={row.original.position} />
        ),
      },
      { accessorKey: "adpPick", header: "Pick", meta: { className: "w-12 px-2" } },
      { accessorKey: "adpRound", header: "Round", meta: { className: "hidden sm:table-cell w-16 px-2" } },
      {
        id: "trend",
        header: "Trend",
        meta: { className: "pl-4 pr-2" },
        cell: ({ row }) => (
          <AdpSparkline history={row.original.adpHistory ?? []} />
        ),
      },
    ],
    [],
  );
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
          <CardContent className="space-y-4">
            {isLeagueAdmin && <NewsImpactSummary leagueId={activeLeagueId} />}
            <DashboardNewsList items={data.leagueNews} />
            <WatchlistSection leagueId={activeLeagueId} />
          </CardContent>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="shrink-0">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>ADP Status</CardTitle>
              <Button
                disabled={isBusy || !data.adpEntries.length || !data.league?.id}
                onClick={downloadCurrentAdpNow}
                size="sm"
                variant="outline"
              >
                <Download className="size-4" aria-hidden="true" />
                Download ADP
              </Button>
            </div>
            <CardDescription>Current ADP snapshot and market data driving the optimizer.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-5 overflow-y-auto">
            <div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {ADP_POSITIONS.map((pos) => {
                  const isActive = adpPositionFilter === pos;
                  const posColorMap: Record<string, string> = {
                    QB: isActive ? "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-300" : "border-zinc-200 text-zinc-600 hover:bg-amber-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-amber-950/30",
                    RB: isActive ? "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-700 dark:text-emerald-300" : "border-zinc-200 text-zinc-600 hover:bg-emerald-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-emerald-950/30",
                    WR: isActive ? "bg-sky-100 border-sky-300 text-sky-800 dark:bg-sky-900/40 dark:border-sky-700 dark:text-sky-300" : "border-zinc-200 text-zinc-600 hover:bg-sky-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-sky-950/30",
                    TE: isActive ? "bg-violet-100 border-violet-300 text-violet-800 dark:bg-violet-900/40 dark:border-violet-700 dark:text-violet-300" : "border-zinc-200 text-zinc-600 hover:bg-violet-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-violet-950/30",
                    K:  isActive ? "bg-zinc-200 border-zinc-400 text-zinc-800 dark:bg-zinc-700 dark:border-zinc-500 dark:text-zinc-200" : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700",
                    DST: isActive ? "bg-zinc-200 border-zinc-400 text-zinc-800 dark:bg-zinc-700 dark:border-zinc-500 dark:text-zinc-200" : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700",
                    ALL: isActive ? "bg-zinc-100 border-zinc-100 text-zinc-900" : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800",
                  };
                  return (
                    <button
                      key={pos}
                      onClick={() => setAdpPositionFilter(pos)}
                      className={cn(
                        "rounded-full border px-3 py-0.5 text-xs font-semibold transition-colors",
                        posColorMap[pos],
                      )}
                    >
                      {pos}
                    </button>
                  );
                })}
              </div>
              <DataTable
                columns={adpColumns}
                data={filteredAdpEntries}
                resetSignal={tableDisplayResetSignal}
                scrollBody
                scrollBodyClassName="max-h-[360px]"
                fixedLayout
                tableId="adp-preview-dashboard"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricStrip label="ADP Source" value={data.activeSnapshot?.source ?? "Not loaded"} />
              <MetricStrip label="Snapshot Date" value={data.activeSnapshot?.snapshotDate ?? "Not loaded"} />
              <MetricStrip label="Min Keeper Value" value={String(data.settings.minimumKeeperValue)} />
              <MetricStrip label="ADP Rows" value={data.adpEntries.length.toString()} />
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
              <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">What this means</p>
              <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
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
                      className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
                      name={team.name}
                      teamId={team.id}
                      user={currentUser}
                    />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {draftCapitalLabel(team.remainingTop100Picks)}
                    </p>
                  </div>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">{team.remainingTop100Picks} picks</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
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
            <p className="text-sm font-semibold text-zinc-950 dark:text-[#FFB340]">The short version</p>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-zinc-900 dark:text-[#EBF4F9]">
              <li><span className="font-medium">Import your league data</span> — pull teams, draft results, rosters, and ADP from Sleeper, Yahoo, or ESPN, or paste CSV directly. Run the optimizer after any import.</li>
              <li><span className="font-medium">Tune the model to your rules</span> — set keeper limits, position caps, eligibility thresholds, and strategy weights in Optimizer Settings. Saving reruns automatically.</li>
              <li><span className="font-medium">Review ranked recommendations</span> — each player is scored by comparing their keeper cost against their ADP value. Override individual players with Force Keep or Exclude when you have context the model doesn&apos;t.</li>
              <li><span className="font-medium">Compare strategies side by side</span> — Scenario Comparison runs five preset strategies (Pure Value, Balanced, Win Now, Rebuild, and more) across all teams so you can see the tradeoffs before committing.</li>
              <li><span className="font-medium">Finalize and practice</span> — lock keeper picks through the Final Keepers board, then open Mock Draft to simulate the upcoming draft with AI bots and a personalized strategy plan.</li>
              <li><span className="font-medium">Review the season after the fact</span> — import end-of-season stats to see which recommendations hit or busted, what value was missed, and multi-year ROI trends by team and player.</li>
            </ul>
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
      { accessorKey: "owner", header: "Owner", meta: { className: "hidden sm:table-cell" } },
      { accessorKey: "draftSlot", header: "Draft Slot" },
      {
        accessorKey: "keepers",
        header: "Keepers",
        cell: ({ getValue }) => <Badge variant="info">{getValue<number>()}/4</Badge>,
      },
      {
        accessorKey: "projectedScore",
        header: "Projected Keeper Score",
        meta: { className: "hidden sm:table-cell" },
        cell: ({ getValue }) => formatter.format(getValue<number>()),
      },
      { accessorKey: "remainingTop100Picks", header: "Top-100 Picks", meta: { className: "hidden sm:table-cell" } },
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
      { accessorKey: "round", header: "Round", meta: { className: "hidden sm:table-cell" } },
      { accessorKey: "overallPick", header: "Pick" },
      {
        accessorKey: "player",
        header: "Player",
        cell: ({ row }) => (
          <PlayerCell name={row.original.player} position={row.original.position} />
        ),
      },
      { accessorKey: "keeperCost", header: "Keeper Cost", meta: { className: "hidden sm:table-cell" } },
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
      { accessorKey: "scenario", header: "Scenario", meta: { className: "hidden sm:table-cell" } },
      {
        accessorKey: "player",
        header: "Player",
        cell: ({ row }) => (
          <PlayerCell name={row.original.player} position={row.original.position} />
        ),
      },
      {
        accessorKey: "rosterStatus",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
      },
      { accessorKey: "acquiredVia", header: "Acquired Via", meta: { className: "hidden sm:table-cell" } },
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
  setAdpCsvText,
}: {
  adpCsvText: string;
  setAdpCsvText: (value: string) => void;
}) {
  return (
    <div className="space-y-5">
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
          <h2 className="text-lg font-semibold text-zinc-950">User Management</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Create and manage platform accounts and league memberships.
          </p>
        </div>
      </div>
      <UserManagementPanel />

      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-950">League Management</h2>
          <p className="mt-1 text-sm text-zinc-600">
            View all leagues, their details, members, and delete leagues if needed.
          </p>
        </div>
      </div>
      <AllLeaguesPanel />
    </div>
  );
}

function AllLeaguesPanel() {
  const [leagues, setLeagues] = React.useState<AdminLeague[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoading(true);
    adminListLeagues()
      .then(setLeagues)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load leagues."))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = React.useCallback(async (leagueId: string) => {
    setDeletingId(leagueId);
    try {
      await deleteLeague(leagueId);
      setLeagues((prev) => prev.filter((lg) => lg.id !== leagueId));
      setConfirmDeleteId(null);
      toast.success("League deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }, []);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading leagues...</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }

  return (
    <div className="space-y-3">
      {leagues.length === 0 && (
        <p className="text-sm text-zinc-500">No leagues found.</p>
      )}
      {leagues.map((lg) => {
        const isExpanded = expandedId === lg.id;
        const isConfirming = confirmDeleteId === lg.id;
        const isDeleting = deletingId === lg.id;
        return (
          <Card key={lg.id} className="border border-zinc-200">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base">{lg.name}</CardTitle>
                    <Badge variant="default" className="text-xs font-normal">
                      {lg.seasonYear}
                    </Badge>
                    {lg.keepersFinalized && (
                      <Badge className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200">
                        Finalized
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-500">
                    <span className="capitalize">{lg.scoringFormat.replace(/_/g, " ")}</span>
                    <span className="capitalize">{lg.draftType} draft</span>
                    <span>{lg.teamCount} team{lg.teamCount !== 1 ? "s" : ""}</span>
                    <span>{lg.memberCount} member{lg.memberCount !== 1 ? "s" : ""}</span>
                    {lg.keeperPickDeadline && (
                      <span>Deadline: {lg.keeperPickDeadline}</span>
                    )}
                    {lg.createdAt && (
                      <span>Created: {lg.createdAt.slice(0, 10)}</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-zinc-600"
                    onClick={() => setExpandedId(isExpanded ? null : lg.id)}
                  >
                    {isExpanded ? "Hide members" : `Members (${lg.memberCount})`}
                  </Button>
                  {!isConfirming ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50 hover:text-rose-800"
                      onClick={() => setConfirmDeleteId(lg.id)}
                    >
                      <Trash2 className="size-3.5 mr-1" aria-hidden="true" />
                      Delete
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-rose-700 font-medium">Confirm?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="text-xs h-7 px-2"
                        disabled={isDeleting}
                        onClick={() => handleDelete(lg.id)}
                      >
                        {isDeleting ? "Deleting…" : "Yes, delete"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 px-2"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="pt-0">
                {lg.members.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">No members.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="py-1.5 text-left text-xs font-medium text-zinc-500">Email</th>
                        <th className="py-1.5 text-left text-xs font-medium text-zinc-500">Alias</th>
                        <th className="py-1.5 text-left text-xs font-medium text-zinc-500">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lg.members.map((m) => (
                        <tr key={m.userId} className="border-b border-zinc-50 last:border-0">
                          <td className="py-1.5 text-xs text-zinc-700">{m.email ?? "—"}</td>
                          <td className="py-1.5 text-xs text-zinc-700">{m.alias ?? "—"}</td>
                          <td className="py-1.5 text-xs">
                            {m.role === "league_admin" ? (
                              <Badge className="text-[10px] py-0 bg-amber-100 text-amber-800 border-amber-200">
                                Commissioner
                              </Badge>
                            ) : (
                              <Badge variant="default" className="text-[10px] py-0">
                                Member
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
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
                          {member.role === "league_admin" ? "League Commissioner" : "Member"}
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
                    className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none focus:border-[#80E8FF] focus:ring-2 focus:ring-[rgba(128,232,255,0.12)]"
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
                    className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none focus:border-[#80E8FF] focus:ring-2 focus:ring-[rgba(128,232,255,0.12)]"
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as "league_admin" | "member")}
                  >
                    <option value="member">Member</option>
                    <option value="league_admin">League Commissioner</option>
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
                    enabled ? "bg-[#FFB340]" : "bg-zinc-300",
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

function DraftFormatPanel() {
  const { activeLeagueId, data, isBusy, refreshData } = useDashboard();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const currentFormat = (data.league?.draftFormat ?? "snake") as "snake" | "auction";
  const [format, setFormat] = React.useState<"snake" | "auction">(currentFormat);

  React.useEffect(() => {
    setFormat((data.league?.draftFormat ?? "snake") as "snake" | "auction");
  }, [data.league?.draftFormat]);

  const handleSave = async () => {
    if (!activeLeagueId) return;
    setSaving(true);
    setError("");
    try {
      await updateLeagueFormat(activeLeagueId, format);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update draft format.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Draft Format</CardTitle>
        <CardDescription>
          Choose whether keeper costs are draft picks (snake) or retained salaries (auction). Changing this switches the optimizer to the appropriate valuation formula.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${format === "snake" ? "border-emerald-600 bg-emerald-50" : "border-zinc-200 bg-white hover:bg-zinc-50"}`}>
            <input
              checked={format === "snake"}
              className="mt-0.5 accent-[#FFB340]"
              onChange={() => setFormat("snake")}
              type="radio"
            />
            <div>
              <p className="font-semibold text-zinc-900">Snake Draft</p>
              <p className="mt-0.5 text-sm text-zinc-500">
                Keeper cost is a forfeited draft pick. Keeper value = cost pick − ADP pick (rounds saved).
              </p>
            </div>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${format === "auction" ? "border-emerald-600 bg-emerald-50" : "border-zinc-200 bg-white hover:bg-zinc-50"}`}>
            <input
              checked={format === "auction"}
              className="mt-0.5 accent-[#FFB340]"
              onChange={() => setFormat("auction")}
              type="radio"
            />
            <div>
              <p className="font-semibold text-zinc-900">Auction Draft</p>
              <p className="mt-0.5 text-sm text-zinc-500">
                Keeper cost is a retained salary ($). Keeper value = market ADP value − retained salary (dollar surplus).
              </p>
            </div>
          </label>
        </div>
        {format === "auction" && (
          <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            Auction mode requires a <strong>keeper_salary</strong> column in your roster CSV and FFC auction ADP data (fetched automatically from the composite ADP build).
          </p>
        )}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <div className="flex justify-end">
          <Button
            disabled={isBusy || saving || data.source !== "api" || !activeLeagueId || format === currentFormat}
            onClick={() => void handleSave()}
          >
            <Save className="size-4" aria-hidden="true" />
            Save Draft Format
          </Button>
        </div>
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
                    className="size-4 accent-[#FFB340]"
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

function KeeperRulesPanel() {
  const { activeLeagueId, data, isBusy, refreshData } = useDashboard();
  const current = data.league?.maxConsecutiveKeeperSeasons ?? null;
  const [value, setValue] = React.useState<string>(current != null ? String(current) : "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setValue(data.league?.maxConsecutiveKeeperSeasons != null ? String(data.league.maxConsecutiveKeeperSeasons) : "");
  }, [data.league?.maxConsecutiveKeeperSeasons]);

  const parsed = value.trim() === "" ? null : parseInt(value, 10);
  const isValid = parsed === null || (!isNaN(parsed) && parsed >= 1);
  const isDirty = parsed !== current;

  const handleSave = async () => {
    if (!activeLeagueId || !isValid) return;
    setSaving(true);
    setError("");
    try {
      await saveLeagueKeeperSettings(activeLeagueId, parsed);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save keeper rules.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consecutive Season Limit</CardTitle>
        <CardDescription>
          Set the maximum number of consecutive seasons any team may retain the same player as a keeper. Leave blank to disable the restriction. Players who reach the limit will be marked ineligible by the optimizer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="w-40 space-y-1">
            <label className="text-sm font-medium text-zinc-700" htmlFor="max-consec-seasons">
              Max consecutive seasons
            </label>
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(128,232,255,0.15)]"
              id="max-consec-seasons"
              min={1}
              placeholder="No limit"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <p className="pb-2 text-sm text-zinc-500">
            {parsed != null
              ? `Players kept for ${parsed} consecutive season${parsed !== 1 ? "s" : ""} will be ineligible.`
              : "No consecutive season limit is enforced."}
          </p>
        </div>
        {!isValid && (
          <p className="text-sm text-rose-600">Value must be a whole number ≥ 1 or left blank.</p>
        )}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <div className="flex justify-end">
          <Button
            disabled={isBusy || saving || data.source !== "api" || !activeLeagueId || !isDirty || !isValid}
            onClick={() => void handleSave()}
          >
            <Save className="size-4" aria-hidden="true" />
            Save Keeper Rules
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function KeeperTenurePanel() {
  const { activeLeagueId, data, isBusy } = useDashboard();
  const leagueId = activeLeagueId ?? "";
  const maxSn = data.league?.maxConsecutiveKeeperSeasons ?? null;

  const [tenureRows, setTenureRows] = React.useState<KeeperTenureRow[]>([]);
  const [loadingRows, setLoadingRows] = React.useState(false);
  const [csvText, setCsvText] = React.useState("");
  const [preview, setPreview] = React.useState<CsvPreviewResult | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<{ importedCount: number; updatedCount: number; skippedCount: number } | null>(null);
  const [error, setError] = React.useState("");

  const loadTenure = React.useCallback(async () => {
    if (!leagueId) return;
    setLoadingRows(true);
    try {
      const rows = await loadKeeperTenure(leagueId);
      setTenureRows(rows);
    } catch {
      // silently ignore
    } finally {
      setLoadingRows(false);
    }
  }, [leagueId]);

  React.useEffect(() => {
    void loadTenure();
  }, [loadTenure]);

  const handlePreview = async () => {
    if (!leagueId || !csvText.trim()) return;
    setPreviewing(true);
    setError("");
    setPreview(null);
    try {
      const result = await previewTenureCsv(leagueId, csvText);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!leagueId || !csvText.trim()) return;
    setImporting(true);
    setError("");
    setImportResult(null);
    try {
      const result = await importTenureCsv(leagueId, csvText);
      setImportResult(result);
      setCsvText("");
      setPreview(null);
      await loadTenure();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (tenureId: string) => {
    if (!leagueId) return;
    try {
      await deleteTenureRecord(leagueId, tenureId);
      await loadTenure();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const handleClearAll = async () => {
    if (!leagueId || !window.confirm("Clear all keeper tenure records for this league? This cannot be undone.")) return;
    try {
      await clearAllTenure(leagueId);
      await loadTenure();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keeper Tenure Records</CardTitle>
        <CardDescription>
          ESPN, Sleeper, and Yahoo do not expose consecutive keeper season counts through their APIs — this data must be entered manually. Upload a CSV with columns: <code className="text-xs bg-zinc-100 px-1 rounded">player, position, team, consecutive_seasons</code> (and optional <code className="text-xs bg-zinc-100 px-1 rounded">last_kept_season_year</code>). Each import upserts records; existing entries are updated, not duplicated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {tenureRows.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-700">
                {tenureRows.length} record{tenureRows.length !== 1 ? "s" : ""} on file
              </p>
              <Button
                className="text-xs"
                disabled={isBusy}
                size="sm"
                variant="outline"
                onClick={() => void handleClearAll()}
              >
                Clear All
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border border-zinc-200">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Team</th>
                    <th className="px-3 py-2 text-left">Player</th>
                    <th className="px-3 py-2 text-left">Pos</th>
                    <th className="px-3 py-2 text-center">Seasons Kept</th>
                    <th className="px-3 py-2 text-center">Last Year</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {tenureRows.map((row) => (
                    <tr key={row.tenureId} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 text-zinc-700">{row.teamName ?? "—"}</td>
                      <td className="px-3 py-2 font-medium text-zinc-900">{row.playerName ?? "—"}</td>
                      <td className="px-3 py-2 text-zinc-500">{row.position ?? "—"}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={row.atLimit ? "font-semibold text-rose-600" : "text-zinc-700"}>
                          {row.consecutiveSeasons}
                          {maxSn != null ? `/${maxSn}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-zinc-500">{row.lastKeptSeasonYear ?? "—"}</td>
                      <td className="px-3 py-2 text-center">
                        {row.atLimit ? (
                          <Badge variant="danger" className="text-[9px]">Ineligible</Badge>
                        ) : (
                          <Badge variant="success" className="text-[9px]">Eligible</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          className="text-xs text-rose-500 hover:text-rose-700"
                          title="Remove this tenure record"
                          onClick={() => void handleDelete(row.tenureId)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          !loadingRows && (
            <p className="rounded-md bg-zinc-50 border border-zinc-200 px-4 py-3 text-sm text-zinc-500">
              No tenure records on file. Upload a CSV below to add them.
            </p>
          )
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-zinc-700">CSV Data</label>
            <label className={`flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors ${isBusy || previewing || importing ? "pointer-events-none opacity-50" : ""}`}>
              <Upload className="size-3" aria-hidden="true" />
              Choose file
              <input
                accept=".csv,text/csv"
                className="sr-only"
                disabled={isBusy || previewing || importing}
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setCsvText((ev.target?.result as string) ?? "");
                    setPreview(null);
                    setImportResult(null);
                  };
                  reader.readAsText(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <textarea
            className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[rgba(128,232,255,0.15)]"
            disabled={isBusy || previewing || importing}
            placeholder={"player,position,team,consecutive_seasons\nPatrick Mahomes,QB,Team A,2\nJustin Jefferson,WR,Team B,3"}
            rows={6}
            value={csvText}
            onChange={(e) => { setCsvText(e.target.value); setPreview(null); setImportResult(null); }}
          />
          <div className="flex gap-2">
            <Button
              disabled={isBusy || previewing || importing || !csvText.trim() || data.source !== "api"}
              size="sm"
              variant="outline"
              onClick={() => void handlePreview()}
            >
              {previewing ? "Previewing…" : "Preview"}
            </Button>
            <Button
              disabled={isBusy || importing || !csvText.trim() || data.source !== "api"}
              size="sm"
              onClick={() => void handleImport()}
            >
              {importing ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>

        {preview && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={preview.valid ? "success" : "danger"}>
                {preview.valid ? "Valid" : "Has Errors"}
              </Badge>
              <span className="text-sm text-zinc-500">
                {preview.validRows} of {preview.totalRows} rows valid
              </span>
            </div>
            {preview.errors.length > 0 && (
              <ul className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 space-y-0.5">
                {preview.errors.map((e, i) => (
                  <li key={i}>{e.rowNumber != null ? `Row ${e.rowNumber}: ` : ""}{e.message}</li>
                ))}
              </ul>
            )}
            {preview.warnings.length > 0 && (
              <ul className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 space-y-0.5">
                {preview.warnings.map((w, i) => (
                  <li key={i}>{w.rowNumber != null ? `Row ${w.rowNumber}: ` : ""}{w.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {importResult && (
          <p className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
            Import complete — {importResult.importedCount} added, {importResult.updatedCount} updated, {importResult.skippedCount} skipped.
          </p>
        )}

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
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

function UserLeagueMembershipsSection({ userId }: { userId: string }) {
  const { isBusy, removeLeagueMemberNow, updateLeagueMemberRoleNow, upsertLeagueMemberNow } = useDashboard();
  const [allLeagues, setAllLeagues] = React.useState<LeagueWithRole[]>([]);
  const [memberships, setMemberships] = React.useState<UserLeagueMembership[]>([]);
  const [teamsByLeague, setTeamsByLeague] = React.useState<Record<string, LeagueTeam[]>>({});
  const [pendingLeagueId, setPendingLeagueId] = React.useState("");
  const [pendingRole, setPendingRole] = React.useState<"league_admin" | "member">("member");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const [leagues, mems] = await Promise.all([
      listMyLeagues().catch(() => [] as LeagueWithRole[]),
      getUserLeagueMemberships(userId).catch(() => [] as UserLeagueMembership[]),
    ]);
    setAllLeagues(leagues);
    setMemberships(mems);
    if (mems.length > 0) {
      const teamResults = await Promise.all(
        mems.map((m) => listLeagueTeams(m.leagueId).catch(() => [] as LeagueTeam[])),
      );
      const map: Record<string, LeagueTeam[]> = {};
      mems.forEach((m, i) => { map[m.leagueId] = teamResults[i]; });
      setTeamsByLeague(map);
    }
  }, [userId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const membershipMap = React.useMemo(
    () => new Map(memberships.map((m) => [m.leagueId, m])),
    [memberships],
  );

  const addToLeague = async () => {
    if (!pendingLeagueId) return;
    setBusy(true);
    try {
      await upsertLeagueMemberNow(pendingLeagueId, userId, pendingRole);
      await load();
      setPendingLeagueId("");
    } finally {
      setBusy(false);
    }
  };

  const removeFromLeague = async (leagueId: string) => {
    setBusy(true);
    try {
      await removeLeagueMemberNow(leagueId, userId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (leagueId: string, role: "league_admin" | "member") => {
    setBusy(true);
    try {
      await updateLeagueMemberRoleNow(leagueId, userId, role);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const changeTeam = async (leagueId: string, teamId: string) => {
    setBusy(true);
    try {
      await setUserLeagueTeam(userId, leagueId, teamId || null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const nonMemberLeagues = allLeagues.filter((l) => !membershipMap.has(l.id));

  return (
    <div className="space-y-3 border-t border-zinc-200 pt-4">
      <p className="text-sm font-medium text-zinc-700">League Memberships</p>

      {memberships.length === 0 ? (
        <p className="text-sm text-zinc-400">Not a member of any league.</p>
      ) : (
        <div className="space-y-3">
          {memberships.map((m) => {
            const leagueTeams = teamsByLeague[m.leagueId] ?? [];
            return (
              <div
                key={m.leagueId}
                className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 truncate font-medium">
                    {m.leagueName}
                    {m.seasonYear ? (
                      <span className="ml-1 font-normal text-zinc-400">{m.seasonYear}</span>
                    ) : null}
                  </span>
                  <select
                    className="h-7 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-950 outline-none focus:border-[#80E8FF]"
                    disabled={busy || isBusy}
                    onChange={(e) =>
                      void changeRole(m.leagueId, e.target.value as "league_admin" | "member")
                    }
                    value={m.role}
                  >
                    <option value="member">Member</option>
                    <option value="league_admin">League Commissioner</option>
                  </select>
                  <Button
                    disabled={busy || isBusy}
                    onClick={() => void removeFromLeague(m.leagueId)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Trash2 className="size-3" aria-hidden="true" />
                  </Button>
                </div>
                {leagueTeams.length > 0 && (
                  <div className="flex items-center gap-2 pl-0.5">
                    <span className="text-xs text-zinc-500 shrink-0">Team</span>
                    <select
                      className="h-7 flex-1 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-950 outline-none focus:border-[#80E8FF]"
                      disabled={busy || isBusy}
                      onChange={(e) => void changeTeam(m.leagueId, e.target.value)}
                      value={m.teamId ?? ""}
                    >
                      <option value="">Unassigned</option>
                      {leagueTeams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <select
          className="h-9 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none focus:border-[#80E8FF] focus:ring-2 focus:ring-[rgba(128,232,255,0.12)]"
          disabled={busy || isBusy || nonMemberLeagues.length === 0}
          onChange={(e) => setPendingLeagueId(e.target.value)}
          value={pendingLeagueId}
        >
          <option value="">
            {nonMemberLeagues.length === 0 ? "No more leagues to add" : "Add to a league…"}
          </option>
          {nonMemberLeagues.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}{l.seasonYear ? ` (${l.seasonYear})` : ""}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none focus:border-[#80E8FF] focus:ring-2 focus:ring-[rgba(128,232,255,0.12)]"
          disabled={busy || isBusy || nonMemberLeagues.length === 0}
          onChange={(e) => setPendingRole(e.target.value as "league_admin" | "member")}
          value={pendingRole}
        >
          <option value="member">Member</option>
          <option value="league_admin">League Commissioner</option>
        </select>
        <Button
          disabled={busy || isBusy || !pendingLeagueId}
          onClick={() => void addToLeague()}
          size="sm"
          type="button"
        >
          Add
        </Button>
      </div>
    </div>
  );
}

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
        id: "leagues",
        header: "Leagues",
        cell: ({ row }) => {
          const ls = row.original.leagues;
          if (!ls || ls.length === 0) return <span className="text-zinc-400">None</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {ls.map((l) => (
                <Badge key={l.leagueId} variant="info">{l.leagueName}</Badge>
              ))}
            </div>
          );
        },
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
        accessorKey: "lastLoginAt",
        header: "Last Login",
        cell: ({ getValue }) => {
          const val = getValue<string | null>();
          if (!val) return <span className="text-zinc-400">Never</span>;
          const d = new Date(val);
          return (
            <span title={d.toISOString()}>
              {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          );
        },
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="user-role">Role</Label>
                <select
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition-colors focus:border-[#80E8FF] focus:ring-2 focus:ring-[rgba(128,232,255,0.12)]"
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
                  className="size-4 accent-[#FFB340]"
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
          {editingUserId ? <UserLeagueMembershipsSection userId={editingUserId} /> : null}
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
      <YahooImportPanel />
      <EspnImportPanel />
      <KeeperOutcomesImportPanel />
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

function YahooImportPanel() {
  const { activeLeagueId, data, isBusy, refreshData } = useDashboard();

  const [authStatus, setAuthStatus] = React.useState<YahooAuthStatus | null>(null);
  const [userLeagues, setUserLeagues] = React.useState<YahooUserLeague[]>([]);
  const [selectedLeagueKey, setSelectedLeagueKey] = React.useState("");
  const [seasonYear, setSeasonYear] = React.useState<string>("");
  const [importLeagueSettings, setImportLeagueSettings] = React.useState(true);
  const [preview, setPreview] = React.useState<YahooImportPreview | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  const defaultYear = data?.league?.seasonYear ?? new Date().getFullYear();

  // Check OAuth status + handle callback redirect on mount
  React.useEffect(() => {
    if (!activeLeagueId) return;
    void (async () => {
      setLoading(true);
      try {
        const status = await getYahooAuthStatus();
        setAuthStatus(status);
        if (status.connected) {
          const leagues = await listYahooUserLeagues(activeLeagueId);
          setUserLeagues(leagues);
        }
        // Pick up ?yahoo_connected=1 from the OAuth callback redirect
        const params = new URLSearchParams(window.location.search);
        if (params.get("yahoo_connected")) {
          setSuccessMessage("Yahoo account connected! Select your league below to import.");
          const url = new URL(window.location.href);
          url.searchParams.delete("yahoo_connected");
          window.history.replaceState({}, "", url.toString());
        }
        if (params.get("yahoo_error")) {
          setError(`Yahoo connection failed: ${params.get("yahoo_error")}`);
          const url = new URL(window.location.href);
          url.searchParams.delete("yahoo_error");
          url.searchParams.delete("detail");
          window.history.replaceState({}, "", url.toString());
        }
      } catch {
        // silently fail — panel will show "not connected"
      } finally {
        setLoading(false);
      }
    })();
  }, [activeLeagueId]);

  const handleConnect = async () => {
    setLoading(true);
    setError("");
    try {
      const authUrl = await initYahooAuth();
      window.location.href = authUrl;
    } catch {
      setError("Could not start Yahoo authorization. Is Yahoo integration configured on this server?");
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!activeLeagueId || !selectedLeagueKey.trim()) return;
    setLoading(true);
    setError("");
    setSuccessMessage("");
    setPreview(null);
    try {
      const year = seasonYear ? parseInt(seasonYear, 10) : undefined;
      const result = await previewYahooImport(activeLeagueId, selectedLeagueKey.trim(), year, importLeagueSettings);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error && err.message.includes("403")
        ? "Yahoo account not connected or token expired. Please reconnect."
        : "Preview failed — check the league key and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!activeLeagueId || !selectedLeagueKey.trim() || !preview?.valid) return;
    setLoading(true);
    setError("");
    try {
      const year = seasonYear ? parseInt(seasonYear, 10) : undefined;
      const result = await commitYahooImport(activeLeagueId, selectedLeagueKey.trim(), year, importLeagueSettings);
      await refreshData();
      const parts = [
        `${result.teamsUpserted} teams`,
        `${result.draftPicksUpserted} draft picks`,
        `${result.rosterEntriesUpserted} roster entries`,
      ];
      if (result.leagueSettingsUpdated) parts.push("league settings updated");
      setSuccessMessage(`Import complete: ${parts.join(", ")}.`);
      setPreview(null);
      setSelectedLeagueKey("");
      setSeasonYear("");
    } catch {
      setError("Import failed. Check the API logs.");
    } finally {
      setLoading(false);
    }
  };

  const busy = isBusy || loading;
  const isConnected = authStatus?.connected ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import from Yahoo Fantasy</CardTitle>
        <CardDescription>
          Pull teams, draft results, final rosters, and league settings from a Yahoo Fantasy league.
          Requires a Yahoo account connected via OAuth.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">
              Connect your Yahoo account to enable import. You will be redirected to Yahoo to authorize access, then returned here.
            </p>
            <Button disabled={busy} onClick={() => { void handleConnect(); }} variant="outline">
              Connect Yahoo Account
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="grid gap-2">
                <Label htmlFor="yahoo-league-key">Yahoo League</Label>
                {userLeagues.length > 0 ? (
                  <select
                    id="yahoo-league-key"
                    className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
                    disabled={busy}
                    value={selectedLeagueKey}
                    onChange={(e) => { setSelectedLeagueKey(e.target.value); setPreview(null); }}
                  >
                    <option value="">Select a league…</option>
                    {userLeagues.map((lg) => (
                      <option key={lg.leagueKey} value={lg.leagueKey}>
                        {lg.name} ({lg.season}, {lg.numTeams} teams)
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="yahoo-league-key"
                    disabled={busy}
                    onChange={(e) => { setSelectedLeagueKey(e.target.value); setPreview(null); }}
                    placeholder="e.g. nfl.l.12345"
                    value={selectedLeagueKey}
                  />
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="yahoo-season-year">Season Year</Label>
                <Input
                  id="yahoo-season-year"
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
            <div className="flex items-center gap-2">
              <input
                id="yahoo-import-settings"
                type="checkbox"
                checked={importLeagueSettings}
                disabled={busy}
                onChange={(e) => setImportLeagueSettings(e.target.checked)}
                className="size-4 rounded border-zinc-300"
              />
              <Label htmlFor="yahoo-import-settings" className="text-sm font-normal">
                Also import league settings (scoring format, roster slots)
              </Label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                disabled={busy || !selectedLeagueKey.trim()}
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
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs text-zinc-400 underline hover:text-zinc-600"
                onClick={() => { void handleConnect(); }}
                disabled={busy}
              >
                Reconnect Yahoo account
              </button>
            </div>
          </>
        )}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {successMessage && !preview ? (
          <p className="text-sm text-emerald-700">{successMessage}</p>
        ) : null}
        {preview ? <YahooPreviewSummary preview={preview} /> : isConnected ? (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
            Select a Yahoo league and click Preview to validate before importing.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EspnImportPanel() {
  const { activeLeagueId, data, isBusy, refreshData } = useDashboard();
  const [espnLeagueId, setEspnLeagueId] = React.useState("");
  const [seasonYear, setSeasonYear] = React.useState<string>("");
  const [espnS2, setEspnS2] = React.useState("");
  const [swid, setSwid] = React.useState("");
  const [showCredentials, setShowCredentials] = React.useState(false);
  const [preview, setPreview] = React.useState<EspnImportPreview | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  const defaultYear = data?.league?.seasonYear ?? new Date().getFullYear();

  const handlePreview = async () => {
    if (!activeLeagueId || !espnLeagueId.trim() || !seasonYear.trim()) return;
    setLoading(true);
    setError("");
    setSuccessMessage("");
    setPreview(null);
    try {
      const result = await previewEspnImport(
        activeLeagueId,
        parseInt(espnLeagueId.trim(), 10),
        parseInt(seasonYear, 10),
        espnS2.trim() || undefined,
        swid.trim() || undefined,
      );
      setPreview(result);
    } catch {
      setError("Preview failed — check the ESPN League ID and season year.");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!activeLeagueId || !espnLeagueId.trim() || !seasonYear.trim() || !preview?.valid) return;
    setLoading(true);
    setError("");
    try {
      const result = await commitEspnImport(
        activeLeagueId,
        parseInt(espnLeagueId.trim(), 10),
        parseInt(seasonYear, 10),
        espnS2.trim() || undefined,
        swid.trim() || undefined,
      );
      await refreshData();
      setSuccessMessage(
        `Import complete: ${result.teamsUpserted} teams, ${result.draftPicksUpserted} draft picks, ${result.rosterEntriesUpserted} roster entries.`,
      );
      setPreview(null);
      setEspnLeagueId("");
      setSeasonYear("");
      setEspnS2("");
      setSwid("");
    } catch {
      setError("Import failed. Check the API logs.");
    } finally {
      setLoading(false);
    }
  };

  const busy = isBusy || loading;
  const canPreview = !busy && !!espnLeagueId.trim() && !!seasonYear.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import from ESPN Fantasy</CardTitle>
        <CardDescription>
          Pull teams, draft results, and final rosters from an ESPN Fantasy league. Find your league ID in the ESPN URL
          (e.g. fantasy.espn.com/football/league?leagueId=<strong>123456</strong>).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-2">
            <Label htmlFor="espn-league-id">ESPN League ID</Label>
            <Input
              id="espn-league-id"
              disabled={busy}
              onChange={(e) => { setEspnLeagueId(e.target.value); setPreview(null); }}
              placeholder="e.g. 123456"
              value={espnLeagueId}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="espn-season-year">Season Year</Label>
            <Input
              id="espn-season-year"
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
        <div>
          <button
            type="button"
            className="text-xs text-zinc-500 underline hover:text-zinc-700"
            onClick={() => setShowCredentials((v) => !v)}
          >
            {showCredentials ? "Hide" : "Private league?"} — enter ESPN credentials
          </button>
          {showCredentials ? (
            <div className="mt-3 grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs text-zinc-500">
                For private leagues, provide your <code className="font-mono">espn_s2</code> and <code className="font-mono">SWID</code> cookies from{" "}
                <strong>fantasy.espn.com</strong>. Open browser DevTools → Application → Cookies to find them.
              </p>
              <div className="grid gap-2">
                <Label htmlFor="espn-s2" className="text-xs">espn_s2 cookie</Label>
                <Input
                  id="espn-s2"
                  disabled={busy}
                  onChange={(e) => setEspnS2(e.target.value)}
                  placeholder="AEB..."
                  type="password"
                  value={espnS2}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="espn-swid" className="text-xs">SWID cookie</Label>
                <Input
                  id="espn-swid"
                  disabled={busy}
                  onChange={(e) => setSwid(e.target.value)}
                  placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}"
                  value={swid}
                />
              </div>
            </div>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            disabled={!canPreview}
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
        {preview ? <EspnPreviewSummary preview={preview} /> : (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
            Enter an ESPN League ID and season year, then click Preview to validate before importing.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EspnPreviewSummary({ preview }: { preview: EspnImportPreview }) {
  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={preview.valid ? "success" : "danger"}>
          {preview.valid ? "Ready" : "Error"}
        </Badge>
        {preview.valid ? (
          <span className="text-sm text-zinc-700">
            {preview.leagueName} · Season {preview.seasonYear} · {preview.teams.length} teams · {preview.draftPicksCount} draft picks · {preview.rosterEntriesCount} roster entries
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
                <th className="pb-1 pr-3 font-medium">ID</th>
                <th className="pb-1 pr-3 font-medium">Team</th>
                <th className="pb-1 pr-3 font-medium">Owner</th>
                <th className="pb-1 font-medium text-right">Players</th>
              </tr>
            </thead>
            <tbody>
              {preview.teams.map((team) => (
                <tr key={team.teamId} className="border-b border-zinc-100 last:border-0">
                  <td className="py-1 pr-3 text-zinc-500">{team.teamId}</td>
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

function KeeperOutcomesImportPanel() {
  const { activeLeagueId, data } = useDashboard();
  const [mode, setMode] = React.useState<"sleeper" | "csv">("sleeper");

  // ── Sleeper auto-fetch state ──
  const defaultYear = data?.league?.seasonYear ? data.league.seasonYear - 1 : undefined;
  const [seasonYear, setSeasonYear] = React.useState<string>(defaultYear ? String(defaultYear) : "");
  const [scoringFormat, setScoringFormat] = React.useState("ppr");
  const [sleeperPreview, setSleeperPreview] = React.useState<SleeperOutcomesPreviewResult | null>(null);
  const [sleeperLoading, setSleeperLoading] = React.useState(false);
  const [sleeperError, setSleeperError] = React.useState("");
  const [sleeperSuccess, setSleeperSuccess] = React.useState("");

  // ── CSV fallback state ──
  const [csvText, setCsvText] = React.useState("");
  const [csvPreview, setCsvPreview] = React.useState<KeeperOutcomesPreviewResult | null>(null);
  const [csvLoading, setCsvLoading] = React.useState(false);
  const [csvError, setCsvError] = React.useState("");
  const [csvSuccess, setCsvSuccess] = React.useState("");

  const handleSleeperPreview = async () => {
    if (!activeLeagueId) return;
    setSleeperLoading(true);
    setSleeperError("");
    setSleeperSuccess("");
    setSleeperPreview(null);
    try {
      const yr = seasonYear ? parseInt(seasonYear, 10) : undefined;
      const result = await previewSleeperOutcomes(activeLeagueId, yr, scoringFormat);
      setSleeperPreview(result);
    } catch {
      setSleeperError("Could not fetch stats from Sleeper — check your connection and try again.");
    } finally {
      setSleeperLoading(false);
    }
  };

  const handleSleeperImport = async () => {
    if (!activeLeagueId) return;
    setSleeperLoading(true);
    setSleeperError("");
    setSleeperSuccess("");
    try {
      const yr = seasonYear ? parseInt(seasonYear, 10) : undefined;
      const result = await importSleeperOutcomes(activeLeagueId, yr, scoringFormat);
      setSleeperSuccess(
        `Imported ${result.importedCount} new, updated ${result.updatedCount}, skipped ${result.skippedCount}.`,
      );
      setSleeperPreview(null);
    } catch {
      setSleeperError("Import failed — try again.");
    } finally {
      setSleeperLoading(false);
    }
  };

  const handleCsvPreview = async () => {
    if (!activeLeagueId || !csvText.trim()) return;
    setCsvLoading(true);
    setCsvError("");
    setCsvSuccess("");
    setCsvPreview(null);
    try {
      const result = await previewKeeperOutcomesCsv(activeLeagueId, csvText);
      setCsvPreview(result);
    } catch {
      setCsvError("Preview failed — check the CSV format and try again.");
    } finally {
      setCsvLoading(false);
    }
  };

  const handleCsvImport = async () => {
    if (!activeLeagueId || !csvText.trim()) return;
    setCsvLoading(true);
    setCsvError("");
    setCsvSuccess("");
    try {
      const result = await importKeeperOutcomesCsv(activeLeagueId, csvText);
      setCsvSuccess(
        `Imported ${result.importedCount} new, updated ${result.updatedCount}, skipped ${result.skippedCount} rows.`,
      );
      setCsvPreview(null);
      setCsvText("");
    } catch {
      setCsvError("Import failed — check the CSV and try again.");
    } finally {
      setCsvLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Season Outcomes</CardTitle>
        <CardDescription>
          Import end-of-season results to populate the Keeper History ROI tracker.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode toggle */}
        <div className="flex rounded-md border border-zinc-200 p-0.5 text-sm">
          <button
            className={cn(
              "flex-1 rounded py-1.5 text-center transition-colors",
              mode === "sleeper"
                ? "bg-zinc-900 text-white"
                : "text-zinc-500 hover:text-zinc-700",
            )}
            onClick={() => setMode("sleeper")}
          >
            Auto-fetch from Sleeper
          </button>
          <button
            className={cn(
              "flex-1 rounded py-1.5 text-center transition-colors",
              mode === "csv"
                ? "bg-zinc-900 text-white"
                : "text-zinc-500 hover:text-zinc-700",
            )}
            onClick={() => setMode("csv")}
          >
            Upload CSV
          </button>
        </div>

        {mode === "sleeper" && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              Fetches stats for all keeper candidates from Sleeper&apos;s public API. Works for any
              league — no Sleeper league ID required. Players are matched by Sleeper ID (if
              league was imported from Sleeper) or by name + NFL team.
            </p>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="mb-1 block text-xs">Season Year</Label>
                <Input
                  className="h-8 text-sm"
                  onChange={(e) => { setSeasonYear(e.target.value); setSleeperPreview(null); }}
                  placeholder={defaultYear ? String(defaultYear) : "e.g. 2025"}
                  value={seasonYear}
                />
              </div>
              <div className="flex-1">
                <Label className="mb-1 block text-xs">Scoring Format</Label>
                <select
                  className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm"
                  onChange={(e) => { setScoringFormat(e.target.value); setSleeperPreview(null); }}
                  value={scoringFormat}
                >
                  <option value="ppr">PPR</option>
                  <option value="half_ppr">Half PPR</option>
                  <option value="standard">Standard</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={sleeperLoading}
                onClick={handleSleeperPreview}
                size="sm"
                variant="outline"
              >
                {sleeperLoading && !sleeperPreview ? "Fetching…" : "Fetch & Preview"}
              </Button>
              <Button
                disabled={sleeperLoading || !sleeperPreview}
                onClick={handleSleeperImport}
                size="sm"
              >
                {sleeperLoading && sleeperPreview ? "Importing…" : "Import"}
              </Button>
            </div>
            {sleeperError && <p className="text-sm text-red-600">{sleeperError}</p>}
            {sleeperSuccess && <p className="text-sm text-emerald-600">{sleeperSuccess}</p>}
            {sleeperPreview && <SleeperOutcomesPreview preview={sleeperPreview} />}
          </div>
        )}

        {mode === "csv" && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              Required columns:{" "}
              <code className="font-mono">player, position, team, finish_rank, fantasy_points</code>
              . Optional:{" "}
              <code className="font-mono">season_year, met_projection, is_bust, notes</code>.
            </p>
            <Textarea
              className="min-h-[120px] font-mono text-xs"
              disabled={csvLoading}
              onChange={(e) => { setCsvText(e.target.value); setCsvPreview(null); setCsvSuccess(""); setCsvError(""); }}
              placeholder={"player,position,team,finish_rank,fantasy_points\nPatrick Mahomes,QB,Chiefs,1,420.5"}
              value={csvText}
            />
            <div className="flex gap-2">
              <Button disabled={csvLoading || !csvText.trim()} onClick={handleCsvPreview} size="sm" variant="outline">
                {csvLoading ? "Loading…" : "Preview"}
              </Button>
              <Button disabled={csvLoading || !csvPreview?.valid} onClick={handleCsvImport} size="sm">
                Import
              </Button>
            </div>
            {csvError && <p className="text-sm text-red-600">{csvError}</p>}
            {csvSuccess && <p className="text-sm text-emerald-600">{csvSuccess}</p>}
            {csvPreview && (
              <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={csvPreview.valid ? "success" : "danger"}>
                    {csvPreview.valid ? "Ready to Import" : "Has Errors"}
                  </Badge>
                  <span className="text-zinc-500">{csvPreview.validRows}/{csvPreview.totalRows} valid rows</span>
                  {csvPreview.warningCount > 0 && <span className="text-amber-600">{csvPreview.warningCount} warning(s)</span>}
                </div>
                {csvPreview.errors.length > 0 && (
                  <ul className="space-y-1 text-red-600">
                    {csvPreview.errors.slice(0, 5).map((e, i) => (
                      <li key={i} className="text-xs">Row {String(e.row_number)}: {String(e.message)}</li>
                    ))}
                    {csvPreview.errors.length > 5 && <li className="text-xs text-zinc-500">…and {csvPreview.errors.length - 5} more</li>}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SleeperOutcomesPreview({ preview }: { preview: SleeperOutcomesPreviewResult }) {
  const [showUnmatched, setShowUnmatched] = React.useState(false);
  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="success">{preview.matchCount} matched</Badge>
        {preview.unmatchCount > 0 && (
          <Badge variant="warning">{preview.unmatchCount} unmatched</Badge>
        )}
        <span className="text-zinc-500">
          {preview.keptCount} kept · {preview.candidateCount - preview.keptCount} candidates not kept
        </span>
        <span className="text-zinc-400 text-xs">{preview.scoringField}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="pb-1 text-left">Player</th>
              <th className="pb-1 text-left">Pos</th>
              <th className="pb-1 text-left">Team</th>
              <th className="pb-1 text-right">Pts</th>
              <th className="pb-1 text-right">Rank</th>
              <th className="pb-1 text-center">Kept</th>
              <th className="pb-1 text-center">Hit ADP</th>
              <th className="pb-1 text-center">Bust</th>
              <th className="pb-1 text-left">Match</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {preview.matched.map((r: SleeperOutcomeRow) => (
              <tr key={`${r.teamId}-${r.playerId}`} className={cn(!r.wasKept && "opacity-50")}>
                <td className="py-1 pr-2 font-medium">{r.playerName}</td>
                <td className="py-1 pr-2">
                  <span className={cn("rounded px-1 py-0.5 font-medium", POSITION_COLORS[r.position] ?? "bg-zinc-100 text-zinc-700")}>
                    {r.position}
                  </span>
                </td>
                <td className="py-1 pr-2 text-zinc-500">{r.teamName}</td>
                <td className="py-1 pr-2 text-right">{r.fantasyPoints != null ? r.fantasyPoints.toFixed(1) : "—"}</td>
                <td className="py-1 pr-2 text-right">{r.finishRank ?? "—"}</td>
                <td className="py-1 pr-2 text-center">
                  {r.wasKept == null ? "?" : r.wasKept ? "✓" : "—"}
                </td>
                <td className="py-1 pr-2 text-center">
                  {r.metAdpProjection == null ? "—" : r.metAdpProjection ? "✓" : "✗"}
                </td>
                <td className="py-1 pr-2 text-center">
                  {r.isBust ? <span className="text-red-500">✗</span> : "—"}
                </td>
                <td className="py-1 text-zinc-400">{r.matchMethod === "external_id" ? "ID" : "Name"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview.unmatched.length > 0 && (
        <div>
          <button
            className="text-xs text-zinc-500 underline"
            onClick={() => setShowUnmatched((v) => !v)}
          >
            {showUnmatched ? "Hide" : "Show"} {preview.unmatched.length} unmatched player(s)
          </button>
          {showUnmatched && (
            <ul className="mt-1 space-y-0.5 text-xs text-zinc-500">
              {preview.unmatched.map((u, i) => (
                <li key={i}>{u.playerName} ({u.position}, {u.nflTeam ?? "no team"}) — {u.teamName}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function YahooPreviewSummary({ preview }: { preview: YahooImportPreview }) {
  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={preview.valid ? "success" : "danger"}>
          {preview.valid ? "Ready" : "Error"}
        </Badge>
        {preview.valid ? (
          <span className="text-sm text-zinc-700">
            {preview.leagueName} · Season {preview.seasonYear} · {preview.teams.length} teams ·{" "}
            {preview.draftPicksCount} draft picks · {preview.rosterEntriesCount} roster entries
          </span>
        ) : null}
      </div>

      {preview.leagueSettingsPreview ? (
        <div className="text-xs text-zinc-500">
          <span className="font-medium">League settings: </span>
          Scoring: {preview.leagueSettingsPreview.scoringFormat} · Draft: {preview.leagueSettingsPreview.draftType}
        </div>
      ) : null}

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
                <tr key={team.teamKey} className="border-b border-zinc-100 last:border-0">
                  <td className="py-1 pr-3 text-zinc-500">{team.draftPosition}</td>
                  <td className="py-1 pr-3 font-medium text-zinc-900">{team.name}</td>
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
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition-colors focus:border-[#80E8FF] focus:ring-2 focus:ring-[rgba(128,232,255,0.12)]"
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
  return (
    <div className="grid gap-5">
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
    activeLeagueId,
    currentUser,
    data,
    exportRecommendations,
    isLeagueAdmin,
    isBusy,
    setManualOverrideNow,
    tableDisplayResetSignal,
  } = useDashboard();

  const prevRecsRef = React.useRef<KeeperRecommendation[]>(data.keeperRecommendations);
  const [recDelta, setRecDelta] = React.useState<{ gained: string[]; lost: string[] } | null>(null);
  const [chartCollapsed, setChartCollapsed] = React.useState(false);

  // Per-team self-finalization state
  const myTeamId = currentUser?.teamId ?? null;
  const [teamFinalized, setTeamFinalized] = React.useState<boolean | null>(null);
  const [finalizeLoading, setFinalizeLoading] = React.useState(false);
  const [finalizeError, setFinalizeError] = React.useState<string | null>(null);

  // Load finalization status from getFinalKeepers when user has a team
  React.useEffect(() => {
    if (!activeLeagueId || !myTeamId) return;
    getFinalKeepers(activeLeagueId)
      .then((result) => {
        const myTeam = result.teams.find((t) => t.teamId === myTeamId);
        setTeamFinalized(myTeam?.teamKeepersFinalized ?? false);
      })
      .catch(() => {
        // If forbidden (before reveal date), treat as not finalized
        setTeamFinalized(false);
      });
  }, [activeLeagueId, myTeamId]);

  const keeperDeadline = data.league?.keeperPickDeadline ?? null;
  const pastDeadline = keeperDeadline ? new Date() > new Date(keeperDeadline + "T23:59:59") : false;

  const handleSelfFinalize = async () => {
    if (!activeLeagueId || !myTeamId) return;
    setFinalizeLoading(true);
    setFinalizeError(null);
    try {
      await selfFinalizeTeamKeepers(activeLeagueId, myTeamId);
      setTeamFinalized(true);
      toast.success("Your keepers have been finalized.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to finalize keepers.";
      setFinalizeError(msg);
    } finally {
      setFinalizeLoading(false);
    }
  };

  const handleSelfUnfinalize = async () => {
    if (!activeLeagueId || !myTeamId) return;
    setFinalizeLoading(true);
    setFinalizeError(null);
    try {
      await selfUnfinalizeTeamKeepers(activeLeagueId, myTeamId);
      setTeamFinalized(false);
      toast.success("Your keeper selection has been reopened.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to unfinalize keepers.";
      setFinalizeError(msg);
    } finally {
      setFinalizeLoading(false);
    }
  };

  React.useEffect(() => {
    const prev = prevRecsRef.current;
    if (prev === data.keeperRecommendations) return;
    if (prev.length > 0) {
      const prevRec = new Set(prev.filter((r) => r.status === "Recommended").map((r) => r.id ?? r.player));
      const newRec = new Set(data.keeperRecommendations.filter((r) => r.status === "Recommended").map((r) => r.id ?? r.player));
      const gained = data.keeperRecommendations
        .filter((r) => r.status === "Recommended" && !prevRec.has(r.id ?? r.player))
        .map((r) => r.player);
      const lost = prev
        .filter((r) => r.status === "Recommended" && !newRec.has(r.id ?? r.player))
        .map((r) => r.player);
      if (gained.length > 0 || lost.length > 0) {
        setRecDelta({ gained, lost });
        const timer = setTimeout(() => setRecDelta(null), 25_000);
        return () => clearTimeout(timer);
      }
    }
    prevRecsRef.current = data.keeperRecommendations;
  }, [data.keeperRecommendations]);

  return (
    <div className="space-y-5">
      {isLeagueAdmin && <NewsImpactPanel leagueId={activeLeagueId} />}
      {recDelta && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm dark:border-sky-900/50 dark:bg-sky-950/20">
          <div className="space-y-1">
            <p className="font-semibold text-sky-950 dark:text-sky-200">Optimizer updated</p>
            {recDelta.gained.length > 0 && (
              <p className="text-sky-800 dark:text-sky-300">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">↑ New:</span>{" "}
                {recDelta.gained.join(", ")}
              </p>
            )}
            {recDelta.lost.length > 0 && (
              <p className="text-sky-800 dark:text-sky-300">
                <span className="font-medium text-rose-600 dark:text-rose-400">↓ Dropped:</span>{" "}
                {recDelta.lost.join(", ")}
              </p>
            )}
          </div>
          <button
            onClick={() => setRecDelta(null)}
            className="shrink-0 text-sky-500 hover:text-sky-800 dark:text-sky-400"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      {data.keeperRecommendations.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>Value vs. Cost</CardTitle>
              {!chartCollapsed && (
                <CardDescription>
                  X = keeper cost (round forfeited), Y = value (rounds saved vs. ADP). Above the dashed line = positive keeper value (worth keeping). Top-left is best: cheap cost and high value. Filled = Recommended, ring = Eligible.
                </CardDescription>
              )}
            </div>
            <button
              onClick={() => setChartCollapsed((c) => !c)}
              aria-label={chartCollapsed ? "Expand chart" : "Collapse chart"}
              className="shrink-0 text-xs text-[#1C4D93] dark:text-sky-400"
            >
              {chartCollapsed ? "Show" : "Hide"}
            </button>
          </CardHeader>
          {!chartCollapsed && (
            <CardContent>
              <KeeperScatterPlot recs={data.keeperRecommendations} />
            </CardContent>
          )}
        </Card>
      )}
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
        {finalizeError && (
          <p className="mb-3 text-sm text-red-600">{finalizeError}</p>
        )}
        <KeeperRecommendationsTable
          data={data.keeperRecommendations}
          draftFormat={data.league?.draftFormat ?? "snake"}
          finalizeButton={
            myTeamId && teamFinalized !== null ? (
              teamFinalized ? (
                <Button
                  variant="outline"
                  className="h-8 gap-1.5 px-3 text-xs font-semibold"
                  disabled={finalizeLoading || pastDeadline}
                  onClick={handleSelfUnfinalize}
                  title={pastDeadline ? "The keeper deadline has passed" : undefined}
                >
                  <RotateCcw className="size-3.5" />
                  {finalizeLoading ? "Saving…" : "Unfinalize"}
                </Button>
              ) : (
                <Button
                  className="h-8 gap-1.5 px-3 text-xs font-semibold shadow-sm hover:bg-transparent dark:hover:bg-transparent hover:text-[#0C132C] dark:hover:text-[#0C132C] hover:brightness-110"
                  disabled={finalizeLoading || pastDeadline}
                  onClick={handleSelfFinalize}
                  title={pastDeadline ? "The keeper deadline has passed" : undefined}
                  style={{
                    backgroundImage: "url('/metallic_gold_background.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    color: "#0C132C",
                  }}
                >
                  <CheckCircle2 className="size-3.5" />
                  {finalizeLoading ? "Saving…" : "Finalize Keepers"}
                </Button>
              )
            ) : undefined
          }
          minimumKeeperValue={data.settings.minimumKeeperValue}
          onOverride={setManualOverrideNow}
          resetSignal={tableDisplayResetSignal}
          showOverrides
          teamCount={data.teams.length}
        />
      </PagePanel>
    </div>
  );
}

function TradeAnalyzerPage() {
  const { data } = useDashboard();
  const leagueId = data.league?.id ?? null;
  const teams = data.teams;

  const [receivingTeamId, setReceivingTeamId] = React.useState<string>(teams[0]?.id ?? "");
  const [givingTeamId, setGivingTeamId] = React.useState<string>(
    teams.find((t) => t.id !== (teams[0]?.id ?? ""))?.id ?? teams[1]?.id ?? "",
  );
  const [givePlayerIds, setGivePlayerIds] = React.useState<string[]>([]);
  const [givePicks, setGivePicks] = React.useState<number[]>([]);
  const [receiveItems, setReceiveItems] = React.useState<
    { playerId: string; keeperCostRound: number | null }[]
  >([]);
  const [receivePicks, setReceivePicks] = React.useState<number[]>([]);
  const [result, setResult] = React.useState<TradeAnalysisResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sensitivityShift, setSensitivityShift] = React.useState(0);
  const [givePickRound, setGivePickRound] = React.useState<string>("");
  const [receivePickRound, setReceivePickRound] = React.useState<string>("");

  const teamRosterMap = React.useMemo(() => {
    const m = new Map<string, { playerId: string; player: string; position: string }[]>();
    for (const entry of data.finalRosters) {
      if (!entry.teamId || !entry.playerId) continue;
      const list = m.get(entry.teamId) ?? [];
      list.push({ playerId: entry.playerId, player: entry.player, position: entry.position });
      m.set(entry.teamId, list);
    }
    return m;
  }, [data.finalRosters]);

  const myRoster = teamRosterMap.get(receivingTeamId) ?? [];
  const theirRoster = teamRosterMap.get(givingTeamId) ?? [];

  const receivePlayerIds = new Set(receiveItems.map((r) => r.playerId));
  const giveSet = new Set(givePlayerIds);

  const toggleGive = (playerId: string) => {
    setGivePlayerIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId],
    );
    setResult(null);
  };

  const toggleReceive = (playerId: string) => {
    if (receivePlayerIds.has(playerId)) {
      setReceiveItems((prev) => prev.filter((r) => r.playerId !== playerId));
    } else {
      setReceiveItems((prev) => [...prev, { playerId, keeperCostRound: null }]);
    }
    setResult(null);
  };

  const updateReceiveCost = (playerId: string, cost: number | null) => {
    setReceiveItems((prev) =>
      prev.map((r) => (r.playerId === playerId ? { ...r, keeperCostRound: cost } : r)),
    );
    setResult(null);
  };

  const addGivePick = () => {
    const round = parseInt(givePickRound, 10);
    if (!round || round < 1 || round > 30 || givePicks.includes(round)) return;
    setGivePicks((prev) => [...prev, round].sort((a, b) => a - b));
    setGivePickRound("");
    setResult(null);
  };

  const removeGivePick = (round: number) => {
    setGivePicks((prev) => prev.filter((r) => r !== round));
    setResult(null);
  };

  const addReceivePick = () => {
    const round = parseInt(receivePickRound, 10);
    if (!round || round < 1 || round > 30 || receivePicks.includes(round)) return;
    setReceivePicks((prev) => [...prev, round].sort((a, b) => a - b));
    setReceivePickRound("");
    setResult(null);
  };

  const removeReceivePick = (round: number) => {
    setReceivePicks((prev) => prev.filter((r) => r !== round));
    setResult(null);
  };

  const handleRun = React.useCallback(
    async (shift = 0) => {
      if (!leagueId || !receivingTeamId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await analyzeKeeperTrade(leagueId, {
          receivingTeamId,
          givingTeamId: givingTeamId || null,
          give: givePlayerIds.map((id) => ({ playerId: id })),
          givePicks: givePicks.map((r) => ({ round: r })),
          receive: receiveItems.map((r) => ({
            playerId: r.playerId,
            keeperCostRound:
              r.keeperCostRound != null ? r.keeperCostRound + shift : null,
          })),
          receivePicks: receivePicks.map((r) => ({ round: r })),
          includeAi: true,
        });
        setResult(res);
        setSensitivityShift(shift);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analysis failed.");
      } finally {
        setLoading(false);
      }
    },
    [leagueId, receivingTeamId, givePlayerIds, givePicks, receiveItems, receivePicks],
  );

  const hasSensitivityData =
    result !== null && receiveItems.some((r) => r.keeperCostRound != null);

  const totalRounds = React.useMemo(() => {
    const slots = data.league?.rosterSettings?.slots as Record<string, number> | undefined;
    if (slots) {
      const total = Object.values(slots).reduce((s, v) => s + (Number(v) || 0), 0);
      if (total > 0) return total;
    }
    return 15;
  }, [data.league]);

  const pickValue = React.useCallback(
    (round: number) => {
      if (round < 1 || totalRounds < 2) return 0;
      const total = Math.max(totalRounds, round);
      const frac = Math.max(0, (total - round) / (total - 1));
      return Math.round(5.0 * Math.pow(frac, 1.8) * 10) / 10;
    },
    [totalRounds],
  );

  const surplusDeltaColor =
    result == null
      ? ""
      : result.surplusDelta > 0
        ? "text-emerald-600"
        : result.surplusDelta < 0
          ? "text-rose-600"
          : "text-zinc-500";

  const totalDeltaColor =
    result == null
      ? ""
      : result.totalValueDelta > 0
        ? "text-emerald-600"
        : result.totalValueDelta < 0
          ? "text-rose-600"
          : "text-zinc-500";

  return (
    <PagePanel
      title="Trade Analyzer"
      description="Model the keeper value impact of a proposed trade before you agree to it."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Team A column — gives */}
          <div className="rounded-lg overflow-hidden border border-[#1a3050]">
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{ backgroundImage: "url('/metallic_background.png')", backgroundSize: "cover", backgroundPosition: "center" }}
            >
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#0C132C" }}>Team A</span>
              <span className="text-[10px] font-semibold uppercase" style={{ color: "rgba(12,19,44,0.55)" }}>Trading Away</span>
            </div>
            <div className="bg-[#071829] p-4">
              <div className="mb-3">
                <select
                  className="w-full rounded-md border border-[#1a3050] bg-[#0a2040] px-3 py-2 text-sm text-[#EBF4F9] focus:outline-none focus:ring-2 focus:ring-[#C7EEFF]/30"
                  value={receivingTeamId}
                  onChange={(e) => {
                    setReceivingTeamId(e.target.value);
                    setGivePlayerIds([]);
                    setGivePicks([]);
                    setResult(null);
                  }}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <p className="mb-2 text-xs font-semibold text-[#C7EEFF]">Players Trading Away</p>
              {myRoster.length === 0 ? (
                <p className="text-xs text-[#8fa4b3]">No roster data. Import final rosters first.</p>
              ) : (
                <div className="max-h-60 space-y-0.5 overflow-y-auto pr-1">
                  {myRoster.map((p) => (
                    <label
                      key={p.playerId}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm transition-colors",
                        giveSet.has(p.playerId)
                          ? "text-[#C7EEFF]"
                          : "text-[#BDC8D3] hover:bg-[rgba(199,238,255,0.07)]",
                      )}
                      style={giveSet.has(p.playerId) ? { backgroundColor: "rgba(199,238,255,0.15)" } : undefined}
                    >
                      <input
                        type="checkbox"
                        className="accent-[#80E8FF]"
                        checked={giveSet.has(p.playerId)}
                        onChange={() => toggleGive(p.playerId)}
                      />
                      <span className="flex-1 font-medium">{p.player}</span>
                      <Badge className="text-[10px]">{p.position}</Badge>
                    </label>
                  ))}
                </div>
              )}

              <div className="mt-3 border-t border-[#1a3050] pt-3">
                <p className="mb-2 text-xs font-semibold text-[#C7EEFF]">Draft Picks Trading Away</p>
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="w-20 rounded border border-[#1a3050] bg-[#0a2040] px-2 py-1 text-xs text-[#EBF4F9] focus:outline-none focus:ring-1 focus:ring-[#C7EEFF]/30"
                    placeholder="Round"
                    value={givePickRound}
                    onChange={(e) => setGivePickRound(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addGivePick(); }}
                  />
                  <Button size="sm" variant="outline" onClick={addGivePick} className="h-7 px-2 text-xs">
                    <Plus className="mr-1 size-3" />
                    Add
                  </Button>
                </div>
                {givePicks.length === 0 ? (
                  <p className="text-xs text-[#8fa4b3]">No picks added.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {givePicks.map((round) => (
                      <span
                        key={round}
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: "rgba(199,238,255,0.12)", color: "#C7EEFF" }}
                      >
                        Rd {round}
                        <span style={{ color: "rgba(199,238,255,0.55)" }}>·{pickValue(round).toFixed(1)}</span>
                        <button onClick={() => removeGivePick(round)} className="opacity-60 hover:opacity-100">
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Team B column — receives */}
          <div className="rounded-lg overflow-hidden border border-[rgba(255,179,64,0.3)]">
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{ backgroundImage: "url('/metallic_gold_background.png')", backgroundSize: "cover", backgroundPosition: "center" }}
            >
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#0C132C" }}>Team B</span>
              <span className="text-[10px] font-semibold uppercase" style={{ color: "rgba(12,19,44,0.55)" }}>Receiving</span>
            </div>
            <div className="bg-[#071829] p-4">
              <div className="mb-3">
                <select
                  className="w-full rounded-md border border-[rgba(255,179,64,0.3)] bg-[#0a2040] px-3 py-2 text-sm text-[#EBF4F9] focus:outline-none focus:ring-2 focus:ring-[#FFB340]/30"
                  value={givingTeamId}
                  onChange={(e) => {
                    setGivingTeamId(e.target.value);
                    setReceiveItems([]);
                    setResult(null);
                  }}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <p className="mb-2 text-xs font-semibold text-[#FFB340]">Players Receiving</p>
              {theirRoster.length === 0 ? (
                <p className="text-xs text-[#8fa4b3]">No roster data for this team. Import final rosters first.</p>
              ) : (
                <div className="max-h-60 space-y-0.5 overflow-y-auto pr-1">
                  {theirRoster.map((p) => {
                    const isSelected = receivePlayerIds.has(p.playerId);
                    const item = receiveItems.find((r) => r.playerId === p.playerId);
                    return (
                      <div key={p.playerId}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm transition-colors",
                            isSelected
                              ? "text-[#FFB340]"
                              : "text-[#BDC8D3] hover:bg-[rgba(255,179,64,0.07)]",
                          )}
                          style={isSelected ? { backgroundColor: "rgba(255,179,64,0.15)" } : undefined}
                        >
                          <input
                            type="checkbox"
                            className="accent-[#FFB340]"
                            checked={isSelected}
                            onChange={() => toggleReceive(p.playerId)}
                          />
                          <span className="flex-1 font-medium">{p.player}</span>
                          <Badge className="text-[10px]">{p.position}</Badge>
                          {isSelected && (
                            <input
                              type="number"
                              min={1}
                              max={20}
                              className="w-14 rounded border border-[rgba(255,179,64,0.3)] bg-[#0a2040] px-1.5 py-0.5 text-xs text-center text-[#EBF4F9] focus:outline-none focus:ring-1 focus:ring-[#FFB340]/30"
                              placeholder="Rd"
                              title="Keeper cost round"
                              value={item?.keeperCostRound ?? ""}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                updateReceiveCost(p.playerId, e.target.value ? Number(e.target.value) : null)
                              }
                            />
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 border-t border-[rgba(255,179,64,0.2)] pt-3">
                <p className="mb-2 text-xs font-semibold text-[#FFB340]">Draft Picks Receiving</p>
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="w-20 rounded border border-[rgba(255,179,64,0.3)] bg-[#0a2040] px-2 py-1 text-xs text-[#EBF4F9] focus:outline-none focus:ring-1 focus:ring-[#FFB340]/30"
                    placeholder="Round"
                    value={receivePickRound}
                    onChange={(e) => setReceivePickRound(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addReceivePick(); }}
                  />
                  <Button size="sm" variant="outline" onClick={addReceivePick} className="h-7 px-2 text-xs">
                    <Plus className="mr-1 size-3" />
                    Add
                  </Button>
                </div>
                {receivePicks.length === 0 ? (
                  <p className="text-xs text-[#8fa4b3]">No picks added.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {receivePicks.map((round) => (
                      <span
                        key={round}
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: "rgba(255,179,64,0.12)", color: "#C5A07A" }}
                      >
                        Rd {round}
                        <span style={{ color: "rgba(197,160,122,0.65)" }}>·{pickValue(round).toFixed(1)}</span>
                        <button onClick={() => removeReceivePick(round)} className="opacity-60 hover:opacity-100">
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Run button */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => handleRun(0)}
            disabled={
            loading ||
            !receivingTeamId ||
            (givePlayerIds.length === 0 &&
              givePicks.length === 0 &&
              receiveItems.length === 0 &&
              receivePicks.length === 0)
          }
          >
            {loading ? (
              <RefreshCw className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <ArrowLeftRight className="mr-2 size-4" aria-hidden />
            )}
            Analyze Trade
          </Button>
          {hasSensitivityData && result && (
            <Button
              variant="outline"
              onClick={() => handleRun(sensitivityShift === 0 ? 1 : 0)}
              disabled={loading}
            >
              {sensitivityShift === 0 ? "+1 Round Cost (Sensitivity)" : "Reset to Original Cost"}
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {/* Results */}
        {result && (
          <div className="space-y-5">
            {/* Delta summary */}
            <div className="space-y-3 rounded-lg border border-[#1a3050] bg-[#071829] p-4">
              {/* Keeper value row */}
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8fa4b3]">
                  Keeper Value Impact
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="text-center">
                    <p className="text-xs text-[#8fa4b3]">Before</p>
                    <p className="text-lg font-bold text-[#EBF4F9]">
                      {result.baselineSurplus > 0 ? "+" : ""}
                      {result.baselineSurplus.toFixed(1)}
                    </p>
                  </div>
                  <div className="text-[#1a3050] font-bold">→</div>
                  <div className="text-center">
                    <p className="text-xs text-[#8fa4b3]">After</p>
                    <p className="text-lg font-bold text-[#EBF4F9]">
                      {result.hypotheticalSurplus > 0 ? "+" : ""}
                      {result.hypotheticalSurplus.toFixed(1)}
                    </p>
                  </div>
                  <div className="text-[#1a3050] font-bold">=</div>
                  <div className="text-center">
                    <p className="text-xs text-[#8fa4b3]">Change</p>
                    <p className={cn("text-lg font-bold", surplusDeltaColor)}>
                      {result.surplusDelta > 0 ? "+" : ""}
                      {result.surplusDelta.toFixed(1)}
                    </p>
                  </div>
                  {sensitivityShift !== 0 && (
                    <Badge variant="warning" className="self-center text-xs">
                      +{sensitivityShift} rd sensitivity
                    </Badge>
                  )}
                </div>
              </div>

              {/* Pick value row — only shown when picks are involved */}
              {(result.givePicksValue > 0 || result.receivePicksValue > 0) && (
                <div className="border-t border-[#1a3050] pt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8fa4b3]">
                    Draft Pick Value
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-[#8fa4b3]">Sending</p>
                      <p className="text-lg font-bold text-rose-500">
                        -{result.givePicksValue.toFixed(1)}
                      </p>
                    </div>
                    <div className="text-[#1a3050] font-bold">+</div>
                    <div className="text-center">
                      <p className="text-xs text-[#8fa4b3]">Receiving</p>
                      <p className="text-lg font-bold text-emerald-600">
                        +{result.receivePicksValue.toFixed(1)}
                      </p>
                    </div>
                    <div className="text-[#1a3050] font-bold">=</div>
                    <div className="text-center">
                      <p className="text-xs text-[#8fa4b3]">Net Picks</p>
                      <p className={cn("text-lg font-bold", result.pickValueDelta >= 0 ? "text-emerald-600" : "text-rose-500")}>
                        {result.pickValueDelta > 0 ? "+" : ""}
                        {result.pickValueDelta.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Total row */}
              <div className="border-t border-[#1a3050] pt-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8fa4b3]">
                  Total Trade Impact
                </p>
                <p className={cn("text-2xl font-bold", totalDeltaColor)}>
                  {result.totalValueDelta > 0 ? "+" : ""}
                  {result.totalValueDelta.toFixed(1)} rounds
                </p>
                <p className="mt-0.5 text-xs text-[#8fa4b3]">
                  {result.totalValueDelta > 1
                    ? "This trade favors Team A"
                    : result.totalValueDelta < -1
                      ? "This trade favors Team B"
                      : "Roughly even trade"}
                </p>
              </div>
            </div>

            {/* Keeper tables — both teams, before and after */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {result.receivingTeamName || "Team A"}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TradeKeeperTable title="Current Keepers" rows={result.baselineKeepers} variant="baseline" />
                <TradeKeeperTable title="Projected Keepers" rows={result.hypotheticalKeepers} variant="hypothetical" />
              </div>
            </div>
            {result.givingTeamName && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {result.givingTeamName}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TradeKeeperTable title="Current Keepers" rows={result.givingBaselineKeepers} variant="baseline" />
                  <TradeKeeperTable title="Projected Keepers" rows={result.givingHypotheticalKeepers} variant="hypothetical" />
                </div>
              </div>
            )}

            {/* AI narrative */}
            {result.aiNarrative && (
              <div
                className={cn(
                  "rounded-lg border p-4 space-y-4",
                  result.aiNarrative.verdict === "good"
                    ? "border-[rgba(255,179,64,0.3)] bg-[rgba(255,179,64,0.06)]"
                    : result.aiNarrative.verdict === "bad"
                      ? "border-rose-900/50 bg-rose-950/10"
                      : "border-[#1a3050] bg-[#071829]",
                )}
              >
                {/* Header: verdict + recommendation */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      "capitalize",
                      result.aiNarrative.verdict === "good"
                        ? "bg-[#9a6818] text-[#EBF4F9] border-[rgba(255,179,64,0.3)]"
                        : result.aiNarrative.verdict === "bad"
                          ? "bg-rose-600 text-white border-rose-700"
                          : "bg-[#0a2040] text-[#BDC8D3] border-[#1a3050]",
                    )}
                  >
                    {result.aiNarrative.verdict}
                  </Badge>
                  <Badge
                    className={cn(
                      "capitalize",
                      result.aiNarrative.recommendation === "proceed"
                        ? "bg-[rgba(255,179,64,0.12)] text-[#FFB340] border-[rgba(255,179,64,0.3)]"
                        : result.aiNarrative.recommendation === "decline"
                          ? "bg-rose-950/20 text-rose-400 border-rose-900/50"
                          : "bg-[rgba(128,232,255,0.1)] text-[#80E8FF] border-[rgba(128,232,255,0.25)]",
                    )}
                  >
                    {result.aiNarrative.recommendation === "proceed"
                      ? "Proceed with trade"
                      : result.aiNarrative.recommendation === "decline"
                        ? "Decline trade"
                        : "Modify trade"}
                  </Badge>
                </div>

                {/* Summary */}
                <p className="text-sm text-[#EBF4F9]">{result.aiNarrative.summary}</p>

                {/* Per-team analysis */}
                {(result.aiNarrative.teamAAnalysis || result.aiNarrative.teamBAnalysis) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {result.aiNarrative.teamAAnalysis && (
                      <div className="rounded border border-[#1a3050] bg-[#0a2040] p-3">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#C7EEFF]">
                          {result.receivingTeamName || "Team A"}
                        </p>
                        <p className="text-xs text-[#BDC8D3]">{result.aiNarrative.teamAAnalysis}</p>
                      </div>
                    )}
                    {result.aiNarrative.teamBAnalysis && (
                      <div className="rounded border border-[rgba(255,179,64,0.2)] bg-[#0a2040] p-3">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#C5A07A]">
                          {result.givingTeamName || "Team B"}
                        </p>
                        <p className="text-xs text-[#BDC8D3]">{result.aiNarrative.teamBAnalysis}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Modifications */}
                {result.aiNarrative.modifications.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-[#BDC8D3]">Suggested modifications</p>
                    <ul className="space-y-1">
                      {result.aiNarrative.modifications.map((m, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[#BDC8D3]">
                          <span className="mt-0.5 shrink-0 text-[#8fa4b3]">•</span>
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Key risk / opportunity cost */}
                <div className="space-y-1">
                  {result.aiNarrative.keyRisk && (
                    <p className="text-xs text-[#8fa4b3]">
                      <span className="font-medium text-[#BDC8D3]">Key risk:</span> {result.aiNarrative.keyRisk}
                    </p>
                  )}
                  {result.aiNarrative.opportunityCost && (
                    <p className="text-xs text-[#8fa4b3]">
                      <span className="font-medium text-[#BDC8D3]">Opportunity cost:</span> {result.aiNarrative.opportunityCost}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PagePanel>
  );
}

function TradeKeeperTable({
  title,
  rows,
  variant,
}: {
  title: string;
  rows: TradePlayerRow[];
  variant: "baseline" | "hypothetical";
}) {
  return (
    <div className="rounded-lg border border-[#1a3050] overflow-hidden">
      <div
        className={cn(
          "px-3 py-2 text-xs font-semibold uppercase tracking-wide",
          variant === "baseline"
            ? "bg-[#0a2040] text-[#8fa4b3]"
            : "bg-[rgba(255,179,64,0.08)] text-[#FFB340]",
        )}
      >
        {title}
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-xs text-[#8fa4b3]">No recommended keepers.</p>
      ) : (
        <table className="w-full bg-[#071829] text-sm">
          <thead>
            <tr className="border-b border-[#1a3050] text-xs text-[#8fa4b3]">
              <th className="px-3 py-1.5 text-left font-normal">Player</th>
              <th className="px-3 py-1.5 text-right font-normal">Cost Rd</th>
              <th className="px-3 py-1.5 text-right font-normal">ADP Rd</th>
              <th className="px-3 py-1.5 text-right font-normal">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.playerId}
                className="border-b border-[#0a2040] last:border-0"
                style={r.isIncoming ? { backgroundColor: "rgba(255,179,64,0.08)" } : undefined}
              >
                <td className="px-3 py-1.5">
                  <span className="font-medium text-[#EBF4F9]">{r.playerName}</span>
                  <span className="ml-1.5 text-[10px] text-[#8fa4b3]">{r.position}</span>
                  {r.isIncoming && (
                    <Badge variant="success" className="ml-1.5 text-[9px] py-0">
                      incoming
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right text-[#BDC8D3]">
                  {r.keeperCostRound != null ? Math.round(r.keeperCostRound) : "—"}
                </td>
                <td className="px-3 py-1.5 text-right text-[#BDC8D3]">
                  {r.adpRound != null ? Math.round(r.adpRound) : "—"}
                </td>
                <td
                  className={cn(
                    "px-3 py-1.5 text-right font-medium",
                    (r.keeperValue ?? 0) > 0 ? "text-emerald-600" : "text-rose-500",
                  )}
                >
                  {r.keeperValue != null
                    ? `${r.keeperValue > 0 ? "+" : ""}${r.keeperValue.toFixed(1)}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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
  const [mobileScenario, setMobileScenario] = React.useState<string>("");

  React.useEffect(() => {
    setLocalNarrative(data.scenarioNarrative);
  }, [data.scenarioNarrative]);

  React.useEffect(() => {
    if (!mobileScenario && data.scenarioComparisons.length > 0) {
      setMobileScenario(data.scenarioComparisons[0]!.scenarioName);
    }
  }, [data.scenarioComparisons, mobileScenario]);

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
          {/* Mobile scenario picker — hidden on sm+ where the full table is visible */}
          {data.scenarioComparisons.length > 0 && (
            <div className="mb-3 sm:hidden">
              <select
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                value={mobileScenario}
                onChange={(e) => setMobileScenario(e.target.value)}
              >
                {data.scenarioComparisons.map((s) => (
                  <option key={s.scenarioName} value={s.scenarioName}>{s.scenarioName}</option>
                ))}
              </select>
            </div>
          )}
          <div className="max-h-[70vh] overflow-auto rounded-md border border-zinc-200">
            <table className="w-full border-collapse bg-white text-sm sm:min-w-[1180px]">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="sticky left-0 top-0 z-30 w-40 bg-zinc-50 px-3 py-3 text-left text-xs font-semibold uppercase text-zinc-500 shadow-[inset_0_-1px_0_#e4e4e7] dark:shadow-[inset_0_-1px_0_rgb(63,63,70)] sm:w-64">
                    Team
                  </th>
                  {data.scenarioComparisons.map((scenario) => (
                    <th
                      key={scenario.scenarioName}
                      className={cn(
                        "sticky top-0 z-20 w-[260px] bg-zinc-50 px-3 py-3 text-left text-xs font-semibold uppercase text-zinc-500 shadow-[inset_0_-1px_0_#e4e4e7] dark:shadow-[inset_0_-1px_0_rgb(63,63,70)]",
                        scenario.scenarioName !== mobileScenario && "hidden sm:table-cell",
                      )}
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
                        "sticky left-0 z-10 bg-white px-3 py-4 shadow-[inset_-1px_0_0_#e4e4e7] dark:shadow-[inset_-1px_0_0_rgb(63,63,70)]",
                        isCurrentUserTeam({ name: team.name, teamId: team.id, user: currentUser }) &&
                          "bg-emerald-50 dark:bg-emerald-950/30",
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
                            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-[#80E8FF] focus:ring-2 focus:ring-[rgba(128,232,255,0.12)] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
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
                        <td
                          key={`${scenario.scenarioName}-${team.id}`}
                          className={cn(
                            "px-3 py-4",
                            scenario.scenarioName !== mobileScenario && "hidden sm:table-cell",
                          )}
                        >
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
  const leagueId = data.source === "api" ? data.league?.id : null;
  const [draftHistories, setDraftHistories] = React.useState<TeamDraftHistory[]>([]);

  React.useEffect(() => {
    if (!leagueId) return;
    getLeagueDraftHistory(leagueId).then(setDraftHistories).catch(() => {});
  }, [leagueId]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-3">
        {data.outlooks.map((outlook) => (
          <OutlookCard
            currentUser={currentUser}
            disabled={isBusy}
            key={outlook.team}
            onExport={() => exportRecommendations("pdf", outlook.teamId)}
            onShare={
              leagueId && outlook.teamId
                ? () => downloadKeeperCard(leagueId, outlook.teamId!)
                : undefined
            }
            outlook={outlook}
          />
        ))}
      </div>
      {draftHistories.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold text-zinc-950">Historical Draft Tendencies</h2>
          <p className="mb-3 text-sm text-zinc-500">
            Based on past draft picks across seasons. Positive ADP tendency means the owner drafts
            value picks; negative means they tend to reach.
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase text-zinc-500">
                  <th className="px-4 py-2 text-left">Team</th>
                  <th className="px-4 py-2 text-left">Seasons</th>
                  <th className="px-4 py-2 text-left">Early-Round Preferences (R1-4)</th>
                  <th className="px-4 py-2 text-left">ADP Tendency</th>
                  <th className="px-4 py-2 text-left">Avg Keepers</th>
                </tr>
              </thead>
              <tbody>
                {draftHistories.map((h) => {
                  const topPos = Object.entries(h.earlyRoundPositions)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([pos, rate]) => `${pos} ${Math.round(rate * 100)}%`)
                    .join(", ");
                  const adpLabel =
                    h.adpTendency > 3 ? "Value" : h.adpTendency < -3 ? "Reach" : "Neutral";
                  const adpColor =
                    h.adpTendency > 3
                      ? "text-emerald-700"
                      : h.adpTendency < -3
                        ? "text-red-700"
                        : "text-zinc-500";
                  return (
                    <tr className="border-b border-zinc-100 last:border-0" key={h.teamId}>
                      <td className="px-4 py-2 font-medium text-zinc-950">
                        {h.teamName ?? h.ownerName ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-zinc-500">{h.seasonsWithData}</td>
                      <td className="px-4 py-2 text-zinc-600">{topPos || "—"}</td>
                      <td className={`px-4 py-2 font-medium ${adpColor}`}>
                        {adpLabel} ({h.adpTendency > 0 ? "+" : ""}
                        {h.adpTendency.toFixed(1)})
                      </td>
                      <td className="px-4 py-2 text-zinc-500">{h.keeperCountAvg.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
      { accessorKey: "round", header: "Round", meta: { className: "hidden sm:table-cell" } },
      { accessorKey: "pickInRound", header: "Pick In Round", meta: { className: "hidden sm:table-cell" } },
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
        meta: { className: "hidden sm:table-cell" },
        cell: ({ getValue }) => {
          const position = getValue<string>();
          return position ? <PositionBadge position={position} /> : null;
        },
      },
      {
        accessorKey: "keeperScore",
        header: "Score",
        meta: { className: "hidden md:table-cell" },
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

const POSITION_COLORS: Record<string, string> = {
  QB: "bg-amber-100 text-amber-800",
  RB: "bg-emerald-100 text-emerald-800",
  WR: "bg-sky-100 text-sky-800",
  TE: "bg-violet-100 text-violet-800",
  K: "bg-zinc-100 text-zinc-600",
  DST: "bg-zinc-100 text-zinc-600",
  DEF: "bg-zinc-100 text-zinc-600",
};

const POSITION_CELL_BG: Record<string, string> = {
  QB:  "bg-amber-50",
  RB:  "bg-emerald-50",
  WR:  "bg-sky-50",
  TE:  "bg-violet-50",
  K:   "bg-zinc-50",
  DST: "bg-zinc-50",
  DEF: "bg-zinc-50",
};

const KEEPER_CELL_STYLE: React.CSSProperties = {
  backgroundImage: "url('/metallic_background.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
};

const CHROME_TEXT_STYLE: React.CSSProperties = {
  background: "linear-gradient(180deg, #C7EEFF 0%, #DDEBF9 52%, #C7EEFF 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

const ROUND_BADGE_STYLE: React.CSSProperties = {
  background: "linear-gradient(180deg, #C7EEFF 0%, #DDEBF9 100%)",
  color: "#0C132C",
};

// ── Final Keepers Page ────────────────────────────────────────────────────────

function FinalKeepersPage() {
  const { activeLeagueId, data: dashData, isLeagueAdmin } = useDashboard();
  const [result, setResult] = React.useState<FinalKeepersResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState<string | null>(null); // team_id being saved
  const [finalizing, setFinalizing] = React.useState(false);
  const [commissionerFinalizing, setCommissionerFinalizing] = React.useState<string | null>(null);
  // Per-team draft state: teamId -> current keeper list being edited
  const [edits, setEdits] = React.useState<Record<string, FinalKeeperSelectionRow[]>>({});

  // Reveal date gating: non-admins cannot see the board until reveal date
  const keeperRevealDate = dashData.league?.keeperRevealDate ?? null;
  const keeperPickDeadline = dashData.league?.keeperPickDeadline ?? null;
  const revealDatePassed = keeperRevealDate
    ? new Date() >= new Date(keeperRevealDate + "T00:00:00")
    : true;
  const canViewBoard = isLeagueAdmin || revealDatePassed;
  const pastDeadline = keeperPickDeadline
    ? new Date() > new Date(keeperPickDeadline + "T23:59:59")
    : false;

  const load = React.useCallback(async () => {
    if (!activeLeagueId || !canViewBoard) return;
    setLoading(true);
    setError("");
    try {
      const data = await getFinalKeepers(activeLeagueId);
      setResult(data);
      // Seed edits from loaded data
      const initial: Record<string, FinalKeeperSelectionRow[]> = {};
      for (const t of data.teams) initial[t.teamId] = t.keepers;
      setEdits(initial);
    } catch {
      setError("Could not load final keeper selections.");
    } finally {
      setLoading(false);
    }
  }, [activeLeagueId, canViewBoard]);

  React.useEffect(() => { void load(); }, [load]);

  const handlePrefill = async () => {
    if (!activeLeagueId) return;
    setSaving("prefill");
    try {
      const prefill = await getFinalKeepersPrefill(activeLeagueId);
      setEdits((prev) => {
        const next = { ...prev };
        for (const t of prefill.teams) {
          next[t.teamId] = t.suggestedKeepers;
        }
        return next;
      });
    } catch {
      setError("Could not load recommendations.");
    } finally {
      setSaving(null);
    }
  };

  const handleSaveTeam = async (teamId: string) => {
    if (!activeLeagueId) return;
    setSaving(teamId);
    try {
      const keepers = edits[teamId] ?? [];
      const payload: FinalKeeperInput[] = keepers.map((k) => ({
        player_id: k.playerId,
        cost_pick: k.costPick,
        cost_round: k.costRound,
      }));
      const saved = await setTeamFinalKeepers(activeLeagueId, teamId, payload);
      setEdits((prev) => ({ ...prev, [teamId]: saved }));
      await load();
    } catch {
      setError("Save failed — check selections and try again.");
    } finally {
      setSaving(null);
    }
  };

  const handleFinalize = async () => {
    if (!activeLeagueId) return;
    setFinalizing(true);
    try {
      await finalizeKeepers(activeLeagueId);
      await load();
    } catch {
      setError("Finalize failed.");
    } finally {
      setFinalizing(false);
    }
  };

  const handleCommissionerFinalizeTeam = async (teamId: string) => {
    if (!activeLeagueId) return;
    setCommissionerFinalizing(teamId);
    try {
      await selfFinalizeTeamKeepers(activeLeagueId, teamId);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to finalize team.";
      setError(msg);
    } finally {
      setCommissionerFinalizing(null);
    }
  };

  const handleRemoveKeeper = (teamId: string, playerId: string) => {
    setEdits((prev) => ({
      ...prev,
      [teamId]: (prev[teamId] ?? []).filter((k) => k.playerId !== playerId),
    }));
  };

  // Non-admins before reveal date: show gating message
  if (!canViewBoard) {
    const revealDisplay = keeperRevealDate
      ? new Date(keeperRevealDate + "T00:00:00").toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "a date to be announced";
    return (
      <PagePanel title="Final Keepers" description="Confirmed keeper selections for the upcoming draft.">
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Lock className="size-8 text-zinc-300" />
          <p className="text-sm font-medium text-zinc-600">
            The keeper reveal is on {revealDisplay}.
          </p>
          <p className="text-sm text-zinc-400">
            Check back then to see all finalized keeper selections.
          </p>
        </div>
      </PagePanel>
    );
  }

  if (loading) {
    return (
      <PagePanel title="Final Keepers" description="Confirmed keeper selections for the upcoming draft.">
        <p className="text-sm text-zinc-500">Loading…</p>
      </PagePanel>
    );
  }

  if (error && !result) {
    return (
      <PagePanel title="Final Keepers" description="Confirmed keeper selections for the upcoming draft.">
        <p className="text-sm text-red-600">{error}</p>
      </PagePanel>
    );
  }

  const isFinalized = result?.isFinalized ?? false;
  const canEdit = isLeagueAdmin && !isFinalized;

  return (
    <PagePanel
      title="Final Keepers"
      description={
        isFinalized
          ? `Finalized${result?.finalizedAt ? ` on ${new Date(result.finalizedAt).toLocaleDateString()}` : ""} — keeper selections are locked.`
          : "Set and confirm each team's keeper selections before the draft."
      }
      action={
        canEdit ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={saving === "prefill"}
              onClick={handlePrefill}
              size="sm"
              variant="outline"
            >
              {saving === "prefill" ? "Loading…" : "Pre-fill from Recommendations"}
            </Button>
            <Button
              disabled={finalizing}
              onClick={handleFinalize}
              size="sm"
            >
              {finalizing ? "Finalizing…" : "Finalize & Lock"}
            </Button>
          </div>
        ) : undefined
      }
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {isFinalized && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Keeper selections are finalized and visible to all league members.
        </div>
      )}

      <div className="space-y-3">
        {(result?.teams ?? []).map((team: FinalKeeperTeam) => {
          const teamEdits = edits[team.teamId] ?? team.keepers;
          const isDirty =
            JSON.stringify(teamEdits.map((k) => k.playerId).sort()) !==
            JSON.stringify(team.keepers.map((k) => k.playerId).sort());

          return (
            <div key={team.teamId} className="rounded-md border border-zinc-200 bg-white">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  {team.draftSlot && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-600">
                      {team.draftSlot}
                    </span>
                  )}
                  <span className="font-medium text-zinc-900">{team.teamName}</span>
                  {team.ownerName && (
                    <span className="text-sm text-zinc-500">{team.ownerName}</span>
                  )}
                  {team.teamKeepersFinalized && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                      <CheckCircle2 className="size-3" />
                      Submitted
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Commissioner can finalize a team's keepers if they haven't submitted by deadline */}
                  {isLeagueAdmin && !isFinalized && !team.teamKeepersFinalized && pastDeadline && (
                    <Button
                      disabled={commissionerFinalizing === team.teamId}
                      onClick={() => handleCommissionerFinalizeTeam(team.teamId)}
                      size="sm"
                      variant="outline"
                      title="This team has not submitted their keepers — finalize on their behalf"
                    >
                      {commissionerFinalizing === team.teamId ? "Finalizing…" : "Finalize for Team"}
                    </Button>
                  )}
                  {canEdit && isDirty && (
                    <Button
                      disabled={saving === team.teamId}
                      onClick={() => handleSaveTeam(team.teamId)}
                      size="sm"
                      variant="outline"
                    >
                      {saving === team.teamId ? "Saving…" : "Save"}
                    </Button>
                  )}
                </div>
              </div>

              {teamEdits.length === 0 ? (
                <p className="px-4 pb-3 text-sm text-zinc-400">No keepers set.</p>
              ) : (
                <div className="border-t border-zinc-100 px-4 pb-3 pt-2">
                  <div className="flex flex-wrap gap-2">
                    {teamEdits.map((keeper: FinalKeeperSelectionRow) => (
                      <div
                        key={keeper.playerId}
                        className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 py-1 pl-2 pr-1 text-sm"
                      >
                        <span
                          className={cn(
                            "rounded px-1 py-0.5 text-xs font-medium",
                            POSITION_COLORS[keeper.position ?? ""] ?? "bg-zinc-100 text-zinc-700",
                          )}
                        >
                          {keeper.position}
                        </span>
                        <span className="font-medium">{keeper.playerName}</span>
                        {keeper.costRound != null && (
                          <span className="text-zinc-400">Rd {keeper.costRound}</span>
                        )}
                        {canEdit && (
                          <button
                            className="ml-1 rounded-full p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
                            onClick={() => handleRemoveKeeper(team.teamId, keeper.playerId)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {team.forfeitedPicks.length > 0 && (
                    <p className="mt-2 text-xs text-zinc-400">
                      Forfeits:{" "}
                      {team.forfeitedPicks
                        .map((p) => (p.round != null ? `Rd ${p.round}` : `Pick ${p.pick}`))
                        .join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* All forfeited picks summary */}
      {(result?.allForfeitedPicks ?? []).length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Forfeited Picks Summary</h3>
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs font-medium text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left">Round</th>
                  <th className="px-3 py-2 text-left">Overall Pick</th>
                  <th className="px-3 py-2 text-left">Team</th>
                  <th className="px-3 py-2 text-left">Player Kept</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(result?.allForfeitedPicks ?? []).map((fp, i) => {
                  const team = result?.teams.find((t) =>
                    t.keepers.some((k) => k.playerId === fp.playerId),
                  );
                  const keeper = team?.keepers.find((k) => k.playerId === fp.playerId);
                  return (
                    <tr key={i} className="hover:bg-zinc-50">
                      <td className="px-3 py-2">{fp.round ?? "—"}</td>
                      <td className="px-3 py-2">{fp.pick}</td>
                      <td className="px-3 py-2">{team?.teamName ?? "—"}</td>
                      <td className="px-3 py-2 font-medium">{keeper?.playerName ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PagePanel>
  );
}


function positionColor(position: string | null): string {
  return POSITION_COLORS[position ?? ""] ?? "bg-zinc-100 text-zinc-700";
}

function KeeperHistoryPage() {
  const { activeLeagueId } = useDashboard();
  const [history, setHistory] = React.useState<KeeperHistory | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [expandedTeamId, setExpandedTeamId] = React.useState<string | null>(null);
  const [expandedPlayerId, setExpandedPlayerId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!activeLeagueId) return;
    setLoading(true);
    setError("");
    getKeeperHistory(activeLeagueId)
      .then(setHistory)
      .catch(() => setError("Could not load keeper history."))
      .finally(() => setLoading(false));
  }, [activeLeagueId]);

  if (loading) {
    return (
      <PagePanel title="Keeper History" description="Multi-year keeper ROI tracking by season, team, and player.">
        <p className="text-sm text-zinc-500">Loading…</p>
      </PagePanel>
    );
  }

  if (error) {
    return (
      <PagePanel title="Keeper History" description="Multi-year keeper ROI tracking by season, team, and player.">
        <p className="text-sm text-red-600">{error}</p>
      </PagePanel>
    );
  }

  if (!history || (history.leagueSummary.length === 0 && history.teamHistory.length === 0)) {
    return (
      <PagePanel title="Keeper History" description="Multi-year keeper ROI tracking by season, team, and player.">
        <p className="text-sm text-zinc-500">
          No keeper outcome data yet. Ask your league commissioner to import Season Outcomes CSV in the
          Admin section.
        </p>
      </PagePanel>
    );
  }

  return (
    <PagePanel title="Keeper History" description="Multi-year keeper ROI tracking by season, team, and player.">
      <div className="space-y-6">
        {/* League Season Summary */}
        {history.leagueSummary.length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-semibold text-zinc-700">League Season Summary</h3>
            <div className="overflow-x-auto rounded-md border border-zinc-200">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Season</th>
                    <th className="px-3 py-2 text-right">Keepers</th>
                    <th className="px-3 py-2 text-right">Met ADP</th>
                    <th className="px-3 py-2 text-right">Busts</th>
                    <th className="px-3 py-2 text-right">Avg Surplus (rds)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {history.leagueSummary.map((s: LeagueKeeperSeasonSummary) => (
                    <tr key={s.seasonYear} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 font-medium">{s.seasonYear}</td>
                      <td className="px-3 py-2 text-right">{s.totalKeepers}</td>
                      <td className="px-3 py-2 text-right">
                        {s.metProjectionPct != null
                          ? `${Math.round(s.metProjectionPct * 100)}%`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {s.bustPct != null ? `${Math.round(s.bustPct * 100)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {s.avgSurplusRounds != null ? s.avgSurplusRounds.toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Team ROI */}
        {history.teamHistory.length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-semibold text-zinc-700">Team ROI</h3>
            <div className="space-y-2">
              {history.teamHistory.map((team: TeamKeeperHistory) => {
                const isExpanded = expandedTeamId === team.teamId;
                return (
                  <div key={team.teamId} className="rounded-md border border-zinc-200">
                    <button
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-50"
                      onClick={() => setExpandedTeamId(isExpanded ? null : team.teamId)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-zinc-900">{team.teamName}</span>
                        {team.ownerName && (
                          <span className="text-sm text-zinc-500">{team.ownerName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-zinc-600">
                        <span>{team.totalKeepers} keepers</span>
                        {team.metProjectionPct != null && (
                          <span className="text-emerald-600">
                            {Math.round(team.metProjectionPct * 100)}% hit
                          </span>
                        )}
                        {team.avgSurplusRounds != null && (
                          <span>
                            {team.avgSurplusRounds > 0 ? "+" : ""}
                            {team.avgSurplusRounds.toFixed(1)} rds surplus
                          </span>
                        )}
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 text-zinc-400 transition-transform",
                            isExpanded && "rotate-90",
                          )}
                        />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-zinc-100 px-4 py-3">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="text-zinc-500">
                              <tr>
                                <th className="pb-1 text-left">Season</th>
                                <th className="pb-1 text-left">Player</th>
                                <th className="pb-1 text-left">Pos</th>
                                <th className="pb-1 text-right">Cost (rd)</th>
                                <th className="pb-1 text-right">ADP (rd)</th>
                                <th className="pb-1 text-right">Surplus</th>
                                <th className="hidden pb-1 text-right sm:table-cell">Finish</th>
                                <th className="hidden pb-1 text-right sm:table-cell">Pts</th>
                                <th className="hidden pb-1 text-center sm:table-cell">Met ADP</th>
                                <th className="hidden pb-1 text-center sm:table-cell">Bust</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50">
                              {team.outcomes.map((o) => (
                                <tr key={o.outcomeId}>
                                  <td className="py-1 pr-2">{o.seasonYear}</td>
                                  <td className="py-1 pr-2 font-medium">{o.playerName}</td>
                                  <td className="py-1 pr-2">
                                    <span
                                      className={cn(
                                        "rounded px-1 py-0.5 text-xs font-medium",
                                        positionColor(o.position),
                                      )}
                                    >
                                      {o.position}
                                    </span>
                                  </td>
                                  <td className="py-1 pr-2 text-right">
                                    {o.keeperCostRound ?? "—"}
                                  </td>
                                  <td className="py-1 pr-2 text-right">
                                    {o.adpRoundAtKeep ?? "—"}
                                  </td>
                                  <td className="py-1 pr-2 text-right">
                                    {o.keeperValueAtKeep != null
                                      ? (o.keeperValueAtKeep > 0 ? "+" : "") +
                                        o.keeperValueAtKeep.toFixed(1)
                                      : "—"}
                                  </td>
                                  <td className="hidden py-1 pr-2 text-right sm:table-cell">{o.finishRank ?? "—"}</td>
                                  <td className="hidden py-1 pr-2 text-right sm:table-cell">
                                    {o.fantasyPoints != null ? o.fantasyPoints.toFixed(1) : "—"}
                                  </td>
                                  <td className="hidden py-1 pr-2 text-center sm:table-cell">
                                    {o.metAdpProjection == null
                                      ? "—"
                                      : o.metAdpProjection
                                        ? "✓"
                                        : "✗"}
                                  </td>
                                  <td className="hidden py-1 text-center sm:table-cell">
                                    {o.isBust ? (
                                      <span className="text-red-500">✗</span>
                                    ) : (
                                      <span className="text-zinc-300">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Player History */}
        {history.playerHistory.length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-semibold text-zinc-700">Player History</h3>
            <div className="space-y-2">
              {history.playerHistory.map((player: PlayerKeeperHistory) => {
                const isExpanded = expandedPlayerId === player.playerId;
                return (
                  <div key={player.playerId} className="rounded-md border border-zinc-200">
                    <button
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-50"
                      onClick={() => setExpandedPlayerId(isExpanded ? null : player.playerId)}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-xs font-medium",
                            positionColor(player.position),
                          )}
                        >
                          {player.position}
                        </span>
                        <span className="font-medium text-zinc-900">{player.playerName}</span>
                        {player.nflTeam && (
                          <span className="text-xs text-zinc-500">{player.nflTeam}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-zinc-600">
                        <span>×{player.timesKept}</span>
                        {player.metProjectionPct != null && (
                          <span className="text-emerald-600">
                            {Math.round(player.metProjectionPct * 100)}% hit
                          </span>
                        )}
                        {player.avgSurplusRounds != null && (
                          <span>
                            {player.avgSurplusRounds > 0 ? "+" : ""}
                            {player.avgSurplusRounds.toFixed(1)} rds avg
                          </span>
                        )}
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 text-zinc-400 transition-transform",
                            isExpanded && "rotate-90",
                          )}
                        />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-zinc-100 px-4 py-3">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="text-zinc-500">
                              <tr>
                                <th className="pb-1 text-left">Season</th>
                                <th className="pb-1 text-left">Team</th>
                                <th className="pb-1 text-right">Cost (rd)</th>
                                <th className="pb-1 text-right">ADP (rd)</th>
                                <th className="pb-1 text-right">Surplus</th>
                                <th className="pb-1 text-right">Finish</th>
                                <th className="pb-1 text-right">Pts</th>
                                <th className="pb-1 text-center">Hit</th>
                                <th className="pb-1 text-center">Bust</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50">
                              {player.outcomes.map((o) => (
                                <tr key={o.outcomeId}>
                                  <td className="py-1 pr-2">{o.seasonYear}</td>
                                  <td className="py-1 pr-2">{o.teamName}</td>
                                  <td className="py-1 pr-2 text-right">
                                    {o.keeperCostRound ?? "—"}
                                  </td>
                                  <td className="py-1 pr-2 text-right">
                                    {o.adpRoundAtKeep ?? "—"}
                                  </td>
                                  <td className="py-1 pr-2 text-right">
                                    {o.keeperValueAtKeep != null
                                      ? (o.keeperValueAtKeep > 0 ? "+" : "") +
                                        o.keeperValueAtKeep.toFixed(1)
                                      : "—"}
                                  </td>
                                  <td className="py-1 pr-2 text-right">{o.finishRank ?? "—"}</td>
                                  <td className="py-1 pr-2 text-right">
                                    {o.fantasyPoints != null ? o.fantasyPoints.toFixed(1) : "—"}
                                  </td>
                                  <td className="py-1 pr-2 text-center">
                                    {o.metAdpProjection == null
                                      ? "—"
                                      : o.metAdpProjection
                                        ? "✓"
                                        : "✗"}
                                  </td>
                                  <td className="py-1 text-center">
                                    {o.isBust ? (
                                      <span className="text-red-500">✗</span>
                                    ) : (
                                      <span className="text-zinc-300">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </PagePanel>
  );
}

// Module-level signal so MockDraftHistoryPage can ask MockDraftPage to open
// or rerun a session after navigating to the mock-draft view.
let pendingMockDraftAction: { type: "open" | "rerun"; sessionId: string } | null = null;

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
  const [draftHistories, setDraftHistories] = React.useState<TeamDraftHistory[]>([]);
  const [keeperSignals, setKeeperSignals] = React.useState<LeagueKeeperSignals | null>(null);
  const [activeSession, setActiveSession] = React.useState<MockDraftSession | null>(null);
  const [playerSearch, setPlayerSearch] = React.useState("");
  const [positionFilter, setPositionFilter] = React.useState("ALL");
  const [selectedPlayer, setSelectedPlayer] = React.useState<MockDraftAvailablePlayer | null>(null);
  const [timeRemaining, setTimeRemaining] = React.useState<number | null>(null);
  const [timerNotice, setTimerNotice] = React.useState("");
  const timerAlertSecondRef = React.useRef<number | null>(null);
  const [aiPickRec, setAiPickRec] = React.useState<MockDraftPickRecommendation | null>(null);
  const [isAiPickLoading, setIsAiPickLoading] = React.useState(false);
  const aiPickAbortRef = React.useRef<AbortController | null>(null);
  const userTurnAlertKeyRef = React.useRef<string | null>(null);
  const [autoScrollBoard, setAutoScrollBoard] = React.useState(true);
  const [isAutoAdvancingBots, setIsAutoAdvancingBots] = React.useState(false);
  const isAutoAdvancingBotsRef = React.useRef(false);
  const [draftSpeed, setDraftSpeed] = React.useState<MockDraftSpeed>("Medium");
  const [isDraftWorkspaceOpen, setIsDraftWorkspaceOpen] = React.useState(false);
  const [mobileDraftPanel, setMobileDraftPanel] = React.useState<"players" | "roster">("players");
  const [panelHeight, setPanelHeight] = React.useState(340);
  const panelDrag = React.useRef({ active: false, startY: 0, startH: 0 });
  const [isLoading, setIsLoading] = React.useState(false);
  const [watchedPlayerIds, setWatchedPlayerIds] = React.useState<Set<string>>(new Set());

  // Load watchlist for star indicators in the player list.
  React.useEffect(() => {
    if (!leagueId) return;
    getWatchlist(leagueId)
      .then((entries) => setWatchedPlayerIds(new Set(entries.map((e) => e.playerId))))
      .catch(() => {/* silent */});
  }, [leagueId]);

  // Lock body scroll while the draft workspace is open so iOS rubber-band
  // scrolling can't reveal the app background behind the fixed modal.
  React.useEffect(() => {
    if (!isDraftWorkspaceOpen) return;
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [isDraftWorkspaceOpen]);

  // Global pointer/touch listeners for panel resize drag.
  // Access panelDrag.current directly inside handlers — never cache it in a
  // local variable, because startPanelDrag mutates the same object in place
  // and a cached reference would stay stale.
  React.useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!panelDrag.current.active) return;
      if ("touches" in e) e.preventDefault();
      const clientY = "touches" in e ? e.touches[0]!.clientY : (e as MouseEvent).clientY;
      const delta = panelDrag.current.startY - clientY;
      const min = 160;
      const max = Math.round(window.innerHeight * 0.75);
      setPanelHeight(Math.max(min, Math.min(max, panelDrag.current.startH + delta)));
    };
    const onEnd = () => { panelDrag.current.active = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  const startPanelDrag = React.useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientY = "touches" in e ? e.touches[0]!.clientY : e.clientY;
    panelDrag.current.active = true;
    panelDrag.current.startY = clientY;
    panelDrag.current.startH = panelHeight;
  }, [panelHeight]);
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
      setDraftHistories([]);
      setKeeperSignals(null);
      return;
    }
    setIsLoading(true);
    try {
      const [ownerHistories, signals] = await Promise.allSettled([
        getLeagueDraftHistory(leagueId),
        getLeagueKeeperSignals(leagueId),
      ]);
      if (ownerHistories.status === "fulfilled") setDraftHistories(ownerHistories.value);
      if (signals.status === "fulfilled") setKeeperSignals(signals.value);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Loading draft context failed.");
    } finally {
      setIsLoading(false);
    }
  }, [leagueId]);

  React.useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  // Handle open/rerun actions arriving from MockDraftHistoryPage
  React.useEffect(() => {
    if (!pendingMockDraftAction) return;
    const action = pendingMockDraftAction;
    pendingMockDraftAction = null;
    setIsLoading(true);
    if (action.type === "open") {
      readMockDraft(action.sessionId)
        .then((session) => { setActiveSession(session); setIsDraftWorkspaceOpen(true); setErrorMessage(""); })
        .catch((err: unknown) => { setErrorMessage(err instanceof Error ? err.message : "Opening session failed."); })
        .finally(() => { setIsLoading(false); });
    } else {
      readMockDraft(action.sessionId)
        .then((session) => { prepareRerun(session); })
        .catch((err: unknown) => { setErrorMessage(err instanceof Error ? err.message : "Preparing rerun failed."); })
        .finally(() => { setIsLoading(false); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      aiPickAbortRef.current?.abort();
      aiPickAbortRef.current = null;
      setAiPickRec(null);
      setIsAiPickLoading(false);
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
        void confetti({
          particleCount: 60,
          spread: 55,
          origin: { y: 0.6 },
          colors: ["#10b981", "#34d399", "#6ee7b7", "#f9fafb"],
          scalar: 0.9,
          ticks: 180,
        });
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
    const rec = aiPickRecRef.current;
    const autoPickId = rec?.playerId ?? suggestedPickRef.current?.playerId ?? activeSession!.availablePlayers[0]?.playerId ?? null;
    const autoPickName = rec?.playerName ?? suggestedPickRef.current?.playerName ?? "a player";
    if (autoPickId) {
      setTimerNotice(`Time expired — AI picked ${autoPickName} for you.`);
      void draftPlayer(autoPickId);
    }
  }, [activeSession?.availablePlayers, activeSession?.status, draftPlayer, isUserTurn, timeRemaining]);

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

  // Fire an AI pick recommendation whenever it becomes the user's turn.
  // Cancels automatically when the turn advances or the user drafts first.
  React.useEffect(() => {
    aiPickAbortRef.current?.abort();
    aiPickAbortRef.current = null;
    setAiPickRec(null);
    setIsAiPickLoading(false);

    if (!isUserPickSlot || activeSession?.status !== "in_progress" || !activeSession.id) {
      return;
    }

    const controller = new AbortController();
    aiPickAbortRef.current = controller;
    setIsAiPickLoading(true);
    const sessionId = activeSession.id;

    void (async () => {
      try {
        const rec = await fetchMockDraftPickRecommendation(sessionId, controller.signal);
        if (!controller.signal.aborted) {
          setAiPickRec(rec);
          setIsAiPickLoading(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setIsAiPickLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [timerKey, isUserPickSlot, activeSession?.id, activeSession?.status]);

  const positionOptions = React.useMemo(
    () =>
      Array.from(new Set(activeSession?.availablePlayers.map((player) => player.position).filter(Boolean) ?? []))
        .sort((a, b) => a.localeCompare(b)),
    [activeSession?.availablePlayers],
  );
  const suggestedPick = React.useMemo(() => {
    if (!activeSession?.availablePlayers.length || !isUserPickSlot) return null;
    const players = activeSession.availablePlayers;
    const currentPick = activeSession.currentPick ?? 0;
    const rosterNeeds = activeSession.rosterNeeds;

    // Derive priority positions from unfilled starter slots (mirrors buildLiveStrategyAdvice logic)
    const baseNeeds = rosterNeeds.filter(
      (need) => need.remaining > 0 && !["BENCH", "FLEX", "SUPERFLEX", "K", "DST", "DEF"].includes(need.slot),
    );
    const flexNeed = rosterNeeds.find((need) => need.slot === "FLEX" && need.remaining > 0);
    const superflexNeed = rosterNeeds.find((need) => need.slot === "SUPERFLEX" && need.remaining > 0);
    let priorityPositions: string[] = baseNeeds.map((need) => need.slot);
    if (!priorityPositions.length && superflexNeed) {
      priorityPositions = ["QB", "RB", "WR"];
    } else if (!priorityPositions.length && flexNeed) {
      priorityPositions = ["RB", "WR", "TE"];
    }
    const prioritySet = new Set(priorityPositions.map((p) => (p === "DEF" ? "DST" : p)));

    const withAdp = players.filter((p) => p.adpPick !== null);
    const pool = withAdp.length ? withAdp : players;
    // ~1 round bonus for filling an open starter slot without fully overriding a large ADP value fall
    const NEED_BONUS = 12;
    return pool.slice().sort((a, b) => {
      const va = (a.adpPick !== null ? currentPick - a.adpPick : -999) + (prioritySet.size > 0 && prioritySet.has(a.position) ? NEED_BONUS : 0);
      const vb = (b.adpPick !== null ? currentPick - b.adpPick : -999) + (prioritySet.size > 0 && prioritySet.has(b.position) ? NEED_BONUS : 0);
      return vb - va;
    })[0] ?? null;
  }, [activeSession?.availablePlayers, activeSession?.currentPick, activeSession?.rosterNeeds, isUserPickSlot]);
  const suggestedPickRef = React.useRef(suggestedPick);
  React.useEffect(() => { suggestedPickRef.current = suggestedPick; }, [suggestedPick]);
  const aiPickRecRef = React.useRef(aiPickRec);
  React.useEffect(() => { aiPickRecRef.current = aiPickRec; }, [aiPickRec]);
  const filteredPlayers = React.useMemo(() => {
    const query = playerSearch.trim().toLowerCase();
    return (activeSession?.availablePlayers ?? [])
      .filter((player) => {
        if (positionFilter === "ALL") return true;
        if (positionFilter === "WATCHED") return watchedPlayerIds.has(player.playerId);
        return player.position === positionFilter;
      })
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
  }, [activeSession?.availablePlayers, playerSearch, positionFilter, watchedPlayerIds]);
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
      description="Set up and run a live draft simulation against AI bots."
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricStrip label="User Team" value={userTeam?.name ?? "Unassigned"} />
          <MetricStrip label="Selected Keepers" value={keeperCount.toString()} />
          <MetricStrip label="ADP Snapshot" value={data.activeSnapshot?.name ?? "Not loaded"} />
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

            {draftHistories.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-950">Owner Draft Tendencies</h3>
                    <p className="text-xs text-zinc-500">Based on historical draft data. Bots use this to mimic each owner&apos;s style.</p>
                  </div>
                  <Badge variant="info">{draftHistories.length} owners</Badge>
                </div>
                <div className="max-h-64 space-y-1.5 overflow-auto pr-1">
                  {draftHistories.map((h) => {
                    const topPos = Object.entries(h.earlyRoundPositions)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 3)
                      .map(([pos, rate]) => `${pos} ${Math.round(rate * 100)}%`)
                      .join(", ");
                    const adpLabel =
                      h.adpTendency > 3 ? "Value Drafter" : h.adpTendency < -3 ? "Reach Drafter" : "Neutral";
                    const adpColor =
                      h.adpTendency > 3
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : h.adpTendency < -3
                          ? "text-red-700 bg-red-50 border-red-200"
                          : "text-zinc-600 bg-zinc-50 border-zinc-200";
                    return (
                      <div
                        className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                        key={h.teamId}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-zinc-950">{h.teamName ?? h.ownerName ?? "Unknown"}</span>
                          <span className="ml-2 text-xs text-zinc-500">
                            {h.seasonsWithData} season{h.seasonsWithData !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="shrink-0 text-xs text-zinc-500">{topPos || "—"}</div>
                        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium ${adpColor}`}>
                          {adpLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {keeperSignals && keeperSignals.signals.some((s) => s.hasRunOptimizer) && (
              <OpponentIntelligencePanel myTeamId={keeperSignals.myTeamId} signals={keeperSignals.signals} />
            )}

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
            className="fixed inset-0 z-50 flex flex-col overscroll-none bg-white dark:bg-zinc-900"
            role="dialog"
          >
            {/* ── Header ── */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Mock Draft Room</h2>
                  <p className="text-xs text-zinc-500">
                    {activeSession.currentPick
                      ? `Pick ${activeSession.currentPick}: ${currentSlot?.teamName ?? "Current team"}`
                      : "Draft complete"}
                  </p>
                </div>
                {activeSession.pickTimerSeconds && timeRemaining !== null ? (
                  <DraftCountdownRing max={activeSession.pickTimerSeconds} value={timeRemaining} />
                ) : null}
                <Badge variant={activeSession.status === "in_progress" ? "success" : "default"}>
                  {activeSession.status.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  disabled={isBusy || isLoading || activeSession.status !== "setup"}
                  onClick={startActiveSession}
                  size="sm"
                >
                  <Play className="mr-1 size-3.5" aria-hidden="true" />
                  Start
                </Button>
                <Button
                  disabled={isBusy || isLoading || isAutoAdvancingBots || !isBotTurn}
                  onClick={advanceBotPick}
                  size="sm"
                  variant="outline"
                >
                  <Bot className="mr-1 size-3.5" aria-hidden="true" />
                  Bot
                </Button>
                <Button
                  disabled={isBusy || isLoading || activeSession.status !== "in_progress"}
                  onClick={pauseSession}
                  size="sm"
                  variant="outline"
                >
                  Pause
                </Button>
                <Button
                  disabled={isBusy || isLoading || activeSession.status !== "paused"}
                  onClick={resumeSession}
                  size="sm"
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
                  size="sm"
                  variant="outline"
                >
                  End
                </Button>
                <select
                  className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  value={draftSpeed}
                  onChange={(event) => setDraftSpeed(event.target.value as MockDraftSpeed)}
                >
                  {mockDraftSpeeds.map((speed) => (
                    <option key={speed} value={speed}>{speed}</option>
                  ))}
                </select>
                <Button onClick={() => setIsDraftWorkspaceOpen(false)} size="sm" variant="ghost">
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {/* ── Status strip ── */}
            {activeSession.status !== "setup" && (
              <div className="shrink-0 border-b border-zinc-100 bg-zinc-50 px-4 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                {activeSession.status === "paused"
                  ? "Draft paused."
                  : activeSession.status === "complete"
                    ? (activeSession.analysis?.summary ?? "Draft complete.")
                    : isUserTurn
                    ? "Your team is on the clock."
                    : isAutoAdvancingBots
                      ? "Bot pick is being generated."
                      : isBotTurn
                        ? `${currentSlot?.teamName ?? "A bot team"} is on the clock — bot pick running automatically.`
                        : "Draft is ready."}
                {lastBotPick?.reasoningSummary ? (
                  <span className="ml-2 text-zinc-400">{lastBotPick.reasoningSummary}</span>
                ) : null}
                {timerNotice ? (
                  <span className="ml-2 font-medium text-amber-700">{timerNotice}</span>
                ) : null}
              </div>
            )}

            {/* ── Upper scrollable zone: Draft Board + Strategy below ── */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Draft Board</h2>
                    <p className="text-xs text-zinc-500">Scroll down for strategy coach, targets, and round-by-round advice.</p>
                  </div>
                  <label className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    <input
                      checked={autoScrollBoard}
                      className="size-3.5 accent-[#FFB340]"
                      onChange={(event) => setAutoScrollBoard(event.target.checked)}
                      type="checkbox"
                    />
                    Auto-scroll
                  </label>
                </div>
                <MockDraftBoardPreview
                  autoScroll={autoScrollBoard}
                  className="h-[280px]"
                  session={activeSession}
                  currentUser={currentUser}
                />
              </div>

              <div className="space-y-5 px-4 pb-4">
                <MockDraftStrategyPanel
                  disabled={isBusy || isLoading}
                  onGenerate={generateStrategyPlan}
                  onStart={startActiveSession}
                  session={activeSession}
                />
                {activeSession.status === "complete" ? (
                  <MockDraftRecap
                    session={activeSession}
                    currentUser={currentUser}
                    onRerun={() => prepareRerun(activeSession)}
                  />
                ) : null}
              </div>
            </div>

            {/* ── Resizable bottom panel: Player list + Roster ── */}
            <div className="flex shrink-0 flex-col" style={{ height: panelHeight }}>

              {/* Drag handle */}
              <div
                aria-label="Drag to resize player panel"
                className="flex h-4 shrink-0 cursor-ns-resize touch-none select-none items-center justify-center border-t border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950/60"
                onMouseDown={startPanelDrag}
                onTouchStart={startPanelDrag}
                role="separator"
              >
                <span className="block h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              </div>

              {/* Content: tab strip + panels */}
              <div className="flex min-h-0 flex-1 flex-col sm:flex-row">

              {/* Mobile tab strip */}
              <div className="flex shrink-0 border-b border-zinc-100 dark:border-zinc-800 sm:hidden">
                <button
                  className={cn(
                    "flex-1 py-2 text-xs font-semibold transition-colors",
                    mobileDraftPanel === "players"
                      ? "border-b-2 border-emerald-600 text-emerald-700"
                      : "text-zinc-500",
                  )}
                  onClick={() => setMobileDraftPanel("players")}
                  type="button"
                >
                  Players
                </button>
                <button
                  className={cn(
                    "flex-1 py-2 text-xs font-semibold transition-colors",
                    mobileDraftPanel === "roster"
                      ? "border-b-2 border-emerald-600 text-emerald-700"
                      : "text-zinc-500",
                  )}
                  onClick={() => setMobileDraftPanel("roster")}
                  type="button"
                >
                  My Roster
                </button>
              </div>

              {/* Left: Available Players */}
              <div className={cn(
                "flex min-w-0 flex-1 flex-col overflow-hidden sm:border-r sm:border-zinc-200 sm:dark:border-zinc-800",
                mobileDraftPanel !== "players" && "hidden sm:flex",
              )}>

                {/* On the clock banner */}
                {isUserPickSlot && activeSession.status === "in_progress" && (
                  <div className="flex shrink-0 items-center gap-2 bg-emerald-600 px-4 py-2">
                    <span className="size-2 shrink-0 animate-pulse rounded-full bg-white" aria-hidden="true" />
                    <span className="text-xs font-bold tracking-wide text-white">
                      ON THE CLOCK — {currentSlot?.teamName ?? activeSession.userTeamName ?? "Your Team"}
                    </span>
                  </div>
                )}

                {/* Player panel header */}
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-950 dark:text-white">Available Players</span>
                    <Badge variant={isUserPickSlot ? "success" : "default"}>
                      {isUserPickSlot ? "Your pick" : "Locked"}
                    </Badge>
                  </div>
                  <span className="text-xs text-zinc-500">Timer: {timerLabel}</span>
                </div>

                {/* AI Pick Recommendation banner */}
                {isUserPickSlot && activeSession.status === "in_progress" && (isAiPickLoading || aiPickRec) && (
                  <div className="shrink-0 border-b border-[rgba(255,179,64,0.2)] bg-[rgba(255,179,64,0.06)]">
                    {isAiPickLoading && !aiPickRec ? (
                      <div className="flex items-center gap-2 px-3 py-2">
                        <div className="size-1.5 animate-pulse rounded-full bg-[#80E8FF]" />
                        <span className="text-xs text-[#8fa4b3]">Generating pick recommendation…</span>
                      </div>
                    ) : aiPickRec ? (
                      <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#FFB340]">
                              {aiPickRec.aiUsed ? "AI Rec" : "Best"}
                            </p>
                            <p className="truncate text-sm font-bold text-[#EBF4F9]">{aiPickRec.playerName}</p>
                            <PositionBadge position={aiPickRec.position} />
                            {aiPickRec.nflTeam && <span className="text-xs text-[#BDC8D3]">{aiPickRec.nflTeam}</span>}
                            {aiPickRec.adpPick !== null && (
                              <span className="shrink-0 text-xs text-[#8fa4b3]">
                                ADP {Math.round(aiPickRec.adpPick)}
                                {activeSession.currentPick && aiPickRec.adpPick < activeSession.currentPick
                                  ? ` · +${Math.round(activeSession.currentPick - aiPickRec.adpPick)}`
                                  : ""}
                              </span>
                            )}
                          </div>
                          {aiPickRec.aiUsed && (
                            <p className="text-[11px] leading-snug text-[#BDC8D3]">{aiPickRec.reasoning}</p>
                          )}
                        </div>
                        <Button
                          disabled={isBusy || isLoading || !isUserPickSlot || positionsAtLimit.has(aiPickRec.position)}
                          onClick={() => void draftPlayer(aiPickRec.playerId)}
                          size="sm"
                          className="shrink-0"
                        >
                          Draft
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Search + position filters */}
                <div className="shrink-0 space-y-1 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <Input
                    className="h-7 text-xs"
                    placeholder="Search players"
                    value={playerSearch}
                    onChange={(event) => setPlayerSearch(event.target.value)}
                  />
                  <div className="flex flex-wrap gap-1">
                    {["ALL", ...positionOptions].map((pos) => {
                      const isActive = positionFilter === pos;
                      const drafted = pos === "ALL" ? 0 : (rosterCounts[pos] ?? 0);
                      const atLimit = pos !== "ALL" && positionsAtLimit.has(pos);
                      return (
                        <button
                          key={pos}
                          onClick={() => setPositionFilter(pos)}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                            isActive
                              ? "border-zinc-700 bg-zinc-900 text-white dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900"
                              : atLimit
                                ? "border-rose-200 bg-rose-50 text-rose-500 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-400"
                                : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800",
                          )}
                        >
                          {pos}{pos !== "ALL" && drafted > 0 ? ` ·${drafted}` : ""}
                        </button>
                      );
                    })}
                    {watchedPlayerIds.size > 0 && (
                      <button
                        onClick={() => setPositionFilter(positionFilter === "WATCHED" ? "ALL" : "WATCHED")}
                        className={cn(
                          "flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                          positionFilter === "WATCHED"
                            ? "border-amber-600 bg-amber-500 text-white dark:border-amber-400 dark:bg-amber-500 dark:text-white"
                            : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50",
                        )}
                      >
                        <Star className="size-2.5 fill-current" aria-hidden="true" />
                        Watched
                      </button>
                    )}
                  </div>
                </div>

                {/* Player table */}
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-full min-w-[480px] text-left text-xs">
                    <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 text-[10px] uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                      <tr>
                        <th className="py-1.5 pl-2 pr-3">Player</th>
                        <th className="py-1.5 pr-2">ADP</th>
                        <th className="py-1.5 pr-2">Proj</th>
                        <th className="py-1.5 pr-2">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {filteredPlayers.map((player) => {
                        const value =
                          activeSession.currentPick && player.adpPick !== null
                            ? player.adpPick - activeSession.currentPick
                            : null;
                        const isWatched = watchedPlayerIds.has(player.playerId);
                        return (
                          <tr key={player.playerId}>
                            <td className="py-1 pl-2 pr-3">
                              <div className="flex items-center gap-1.5">
                                <Button
                                  disabled={isBusy || isLoading || !isUserPickSlot || positionsAtLimit.has(player.position)}
                                  onClick={() => void draftPlayer(player.playerId)}
                                  size="sm"
                                  className="h-6 px-2 text-[10px]"
                                  title={positionsAtLimit.has(player.position) ? `${player.position} draft limit reached` : undefined}
                                >
                                  Draft
                                </Button>
                                {isWatched && (
                                  <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" aria-label="Watched" />
                                )}
                                <PlayerCell
                                  imageUrl={player.imageUrl}
                                  name={player.playerName}
                                  nflTeam={player.nflTeam}
                                  position={player.position}
                                  onClick={() => setSelectedPlayer(player)}
                                />
                              </div>
                            </td>
                            <td className="py-1 pr-2 text-zinc-600">
                              {player.adpPick === null ? "-" : formatter.format(player.adpPick)}
                            </td>
                            <td className="py-1 pr-2 text-zinc-600">
                              {player.projection === null ? "-" : formatter.format(player.projection)}
                            </td>
                            <td className="py-1 pr-2 text-zinc-600">
                              {value === null ? "-" : formatter.format(value)}
                            </td>
                          </tr>
                        );
                      })}
                      {!filteredPlayers.length ? (
                        <tr>
                          <td className="py-4 pl-3 text-zinc-500" colSpan={4}>
                            No available players match the current filters.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: Your Roster */}
              <div className={cn(
                "flex shrink-0 flex-col overflow-hidden sm:w-64",
                mobileDraftPanel !== "roster" && "hidden sm:flex",
                mobileDraftPanel === "roster" && "flex flex-1",
              )}>
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <span className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{activeSession.userTeamName}</span>
                  <span className="shrink-0 text-[10px] text-zinc-500">
                    {Object.entries(rosterCounts)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([pos, count]) => `${pos}:${count}`)
                      .join(" ") || "—"}
                  </span>
                </div>
                <div className="shrink-0 grid grid-cols-3 gap-1 px-3 py-2">
                  {activeSession.rosterNeeds.map((need) => {
                    const isCapHit = need.remaining > 0 && positionsAtLimit.has(need.slot);
                    return (
                      <div
                        className={cn(
                          "rounded border px-1.5 py-1",
                          isCapHit
                            ? "border-rose-200 bg-rose-50"
                            : need.remaining > 0
                            ? "border-amber-200 bg-amber-50"
                            : "border-emerald-200 bg-emerald-50",
                        )}
                        key={need.slot}
                        title={isCapHit ? `${need.slot} draft limit reached` : undefined}
                      >
                        <p className="truncate text-[9px] font-semibold uppercase text-zinc-500">{need.slot}</p>
                        <p className={cn("text-xs font-semibold", isCapHit ? "text-rose-700" : "text-zinc-950")}>
                          {need.filled}/{need.target}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="min-h-0 flex-1 space-y-1 overflow-auto px-3 py-1">
                  {userRoster.map((pick) => (
                    <div
                      className="flex items-center justify-between gap-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                      key={pick.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-950 dark:text-white">{pick.playerName}</p>
                        <p className="text-zinc-500">Pick {pick.overallPick}</p>
                      </div>
                      <PositionBadge position={pick.position} />
                    </div>
                  ))}
                  {!userRoster.length ? (
                    <div className="rounded border border-dashed border-zinc-300 p-3 text-xs text-zinc-500 dark:border-zinc-700">
                      No drafted players yet.
                    </div>
                  ) : null}
                </div>
              </div>
              </div>{/* end content wrapper */}
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

      </div>
    </PagePanel>
  );
}

function MockDraftHistoryPage() {
  const { data, isBusy, setActiveView } = useDashboard();
  const leagueId = data.source === "api" ? data.league?.id : null;
  const [history, setHistory] = React.useState<MockDraftHistoryRow[]>([]);
  const [selectedComparisonIds, setSelectedComparisonIds] = React.useState<string[]>([]);
  const [comparisonSessions, setComparisonSessions] = React.useState<MockDraftSession[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    if (!leagueId) { setHistory([]); return; }
    setIsLoading(true);
    try {
      setHistory(await listMockDrafts(leagueId));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history.");
    } finally {
      setIsLoading(false);
    }
  }, [leagueId]);

  React.useEffect(() => { void load(); }, [load]);

  React.useEffect(() => {
    setSelectedComparisonIds((c) => c.filter((id) => history.some((r) => r.id === id)));
    setComparisonSessions((c) => c.filter((s) => history.some((r) => r.id === s.id)));
  }, [history]);

  const toggleComparison = React.useCallback((sessionId: string) => {
    setSelectedComparisonIds((c) =>
      c.includes(sessionId) ? c.filter((id) => id !== sessionId) : [...c, sessionId].slice(-4),
    );
  }, []);

  const loadComparison = React.useCallback(async () => {
    if (!selectedComparisonIds.length) { setComparisonSessions([]); return; }
    setIsLoading(true);
    try {
      setComparisonSessions(await Promise.all(selectedComparisonIds.map((id) => readMockDraft(id))));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Loading comparison failed.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedComparisonIds]);

  const handleOpen = React.useCallback((sessionId: string) => {
    pendingMockDraftAction = { type: "open", sessionId };
    setActiveView("mock-draft");
  }, [setActiveView]);

  const handleRerun = React.useCallback((sessionId: string) => {
    pendingMockDraftAction = { type: "rerun", sessionId };
    setActiveView("mock-draft");
  }, [setActiveView]);

  const handleDelete = React.useCallback(async (sessionId: string) => {
    if (!window.confirm("Delete this completed mock draft? This removes its saved recap and analysis.")) return;
    setIsLoading(true);
    try {
      await deleteMockDraft(sessionId);
      setHistory((c) => c.filter((r) => r.id !== sessionId));
      setSelectedComparisonIds((c) => c.filter((id) => id !== sessionId));
      setComparisonSessions((c) => c.filter((s) => s.id !== sessionId));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <PagePanel
      title="Mock Draft History"
      description="Completed mock draft sessions — open replays, rerun setups, or compare results."
      action={
        <Button disabled={isLoading || !leagueId} onClick={load} variant="outline">
          <RefreshCw className="mr-2 size-4" aria-hidden="true" />
          Refresh
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricStrip label="Completed Mocks" value={history.length.toString()} />
          <MetricStrip label="Selected to Compare" value={selectedComparisonIds.length.toString()} />
        </div>

        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div>
        ) : null}

        <section className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="size-4 text-zinc-500" aria-hidden="true" />
              <h2 className="text-base font-semibold text-zinc-950">Sessions</h2>
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
                onClick={() => { setSelectedComparisonIds([]); setComparisonSessions([]); }}
                size="sm"
                variant="ghost"
              >
                Clear
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm sm:min-w-[840px]">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-2 pr-4">Compare</th>
                  <th className="py-2 pr-4">Completed</th>
                  <th className="py-2 pr-4">Team</th>
                  <th className="hidden py-2 pr-4 sm:table-cell">Rounds</th>
                  <th className="hidden py-2 pr-4 sm:table-cell">Timer</th>
                  <th className="py-2 pr-4">Grade</th>
                  <th className="hidden py-2 pr-4 sm:table-cell">Summary</th>
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
                    <td className="hidden py-3 pr-4 text-zinc-700 sm:table-cell">{row.roundCount}</td>
                    <td className="hidden py-3 pr-4 text-zinc-700 sm:table-cell">
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
                    <td className="hidden max-w-[360px] truncate py-3 pr-4 text-zinc-600 sm:table-cell">{row.summary}</td>
                    <td className="py-3 pr-0">
                      <div className="flex justify-end gap-2">
                        <Button disabled={isBusy || isLoading} onClick={() => handleOpen(row.id)} size="sm" variant="outline">Open</Button>
                        <Button disabled={isBusy || isLoading} onClick={() => handleRerun(row.id)} size="sm" variant="outline">Rerun</Button>
                        <Button disabled={isBusy || isLoading} onClick={() => void handleDelete(row.id)} size="sm" variant="destructive">Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!history.length && !isLoading ? (
                  <tr>
                    <td className="py-5 text-zinc-500" colSpan={8}>No completed mock drafts yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {comparisonSessions.length ? <MockDraftComparison sessions={comparisonSessions} /> : null}
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
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
              AI plan fell back to deterministic guidance: {plan.error}
            </div>
          ) : null}

          {liveAdvice ? (
            <div className="rounded-md border border-sky-200 bg-sky-50 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-sky-950 dark:text-sky-200">
                  Live guidance: {liveAdvice.priority}
                </p>
                <Badge variant="info">Updates after picks</Badge>
              </div>
              <p className="mt-1 text-sm text-sky-900 dark:text-sky-300">{liveAdvice.detail}</p>
              {liveAdvice.targets.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {liveAdvice.targets.map((player) => (
                    <span
                      className="rounded-md border border-sky-200 bg-white px-2 py-1 text-xs text-sky-900 dark:border-sky-900/50 dark:bg-zinc-800 dark:text-sky-300"
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
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">
                  Round {currentRound}: {strategyText(currentRoundPlan.priority)}
                </p>
                <Badge variant="success">Current round</Badge>
              </div>
              <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-300">{strategyText(currentRoundPlan.notes)}</p>
              <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-400">
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

// ---------------------------------------------------------------------------
// Mock Draft Board — Sleeper-style grid (columns = rounds, rows = teams)
// ---------------------------------------------------------------------------

const MockPickCell = React.forwardRef<
  HTMLTableCellElement,
  { slot: MockDraftBoardSlot | undefined; isCurrentPick: boolean; isNew?: boolean }
>(function MockPickCell({ slot, isCurrentPick, isNew }, ref) {
  if (!slot) {
    return (
      <td className="min-w-[116px] border-r border-zinc-100 dark:border-[#1a2a4a] px-2 py-1.5 text-center text-zinc-300 dark:text-[#C7EEFF]/30 last:border-r-0">
        —
      </td>
    );
  }

  const isKeeper = slot.status === "Keeper";
  const isDrafted = slot.status === "Drafted";
  const isActive = isKeeper || isDrafted;

  return (
    <td
      ref={ref}
      className={cn(
        "min-w-[116px] border-r border-zinc-100 dark:border-[#1a2a4a] px-2 py-2 align-top last:border-r-0",
        !isActive && "bg-zinc-50/30 dark:bg-transparent",
        isCurrentPick && "outline outline-2 -outline-offset-2 outline-amber-400",
      )}
      style={isActive ? KEEPER_CELL_STYLE : undefined}
    >
      <div className={cn("space-y-0.5", isNew && "animate-pick-in")}>
        <div className="flex items-center justify-between gap-1">
          <span
            className="text-[10px] tabular-nums font-medium"
            style={isActive ? { color: "#1C4D93" } : CHROME_TEXT_STYLE}
          >
            #{slot.overallPick}
          </span>
          {isKeeper && <Lock className="h-2.5 w-2.5 shrink-0 text-[#C5A07A]" aria-label="Keeper" />}
        </div>
        {slot.pick ? (
          <>
            <p
              className="truncate text-[11px] font-semibold leading-tight text-[#1C4D93]"
              title={slot.pick.playerName}
            >
              {slot.pick.playerName}
            </p>
            <PositionBadge position={slot.pick.position} className="border-[#C5A07A] bg-[#0C132C] text-[#C5A07A] dark:border-[#C5A07A] dark:bg-[#0C132C] dark:text-[#C5A07A]" />
          </>
        ) : (
          <p className="text-[10px] italic" style={CHROME_TEXT_STYLE}>Open</p>
        )}
      </div>
    </td>
  );
});

function MockDraftBoardPreview({
  autoScroll,
  className,
  session,
  currentUser,
}: {
  autoScroll: boolean;
  className?: string;
  session: MockDraftSession;
  currentUser: AuthUser | null;
}) {
  const currentPickRef = React.useRef<HTMLTableCellElement | null>(null);
  const boardScrollRef = React.useRef<HTMLDivElement | null>(null);
  const prevBoardRef = React.useRef<MockDraftBoardSlot[]>([]);
  const [newPickNums, setNewPickNums] = React.useState<Set<number>>(new Set());

  React.useEffect(() => {
    const prev = prevBoardRef.current;
    const prevDraftedSet = new Set(
      prev.filter((s) => s.status === "Drafted").map((s) => s.overallPick),
    );
    const justDrafted = session.board
      .filter((s) => s.status === "Drafted" && !prevDraftedSet.has(s.overallPick))
      .map((s) => s.overallPick);
    prevBoardRef.current = session.board;
    if (justDrafted.length === 0) return;
    setNewPickNums(new Set(justDrafted));
    const timer = setTimeout(() => setNewPickNums(new Set()), 600);
    return () => clearTimeout(timer);
  }, [session.board]);

  const { teams, rounds, grid } = React.useMemo(() => {
    const roundSet = new Set(session.board.map((s) => s.round));
    const rounds = Array.from(roundSet).sort((a, b) => a - b);

    // Order teams by their round-1 draft position (pick slot 1..N)
    const teamsInOrder: { key: string; teamId: string | null; teamName: string }[] = [];
    const seenKeys = new Set<string>();
    const round1Slots = session.board
      .filter((s) => s.round === 1)
      .sort((a, b) => a.pickInRound - b.pickInRound);
    for (const slot of round1Slots) {
      const key = slot.teamId ?? slot.teamName;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        teamsInOrder.push({ key, teamId: slot.teamId, teamName: slot.teamName });
      }
    }

    // grid: team key → round → slot
    const grid = new Map<string, Map<number, MockDraftBoardSlot>>();
    for (const slot of session.board) {
      const key = slot.teamId ?? slot.teamName;
      if (!grid.has(key)) grid.set(key, new Map());
      grid.get(key)!.set(slot.round, slot);
    }

    return { teams: teamsInOrder, rounds, grid };
  }, [session.board]);

  React.useEffect(() => {
    if (!autoScroll || !session.currentPick) return;
    const container = boardScrollRef.current;
    const cell = currentPickRef.current;
    if (!container || !cell) return;
    const containerRect = container.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    container.scrollTo({
      behavior: "smooth",
      left: Math.max(
        0,
        container.scrollLeft + cellRect.left - containerRect.left - container.clientWidth / 2 + cell.clientWidth / 2,
      ),
      top: Math.max(
        0,
        container.scrollTop + cellRect.top - containerRect.top - container.clientHeight / 2 + cell.clientHeight / 2,
      ),
    });
  }, [autoScroll, session.currentPick]);

  return (
    <div ref={boardScrollRef} className={cn("overflow-auto rounded-lg border border-zinc-200 bg-white dark:border-[#1a2a4a] dark:bg-[#0C132C]", className ?? "max-h-[560px]")}>
      <table className="border-collapse text-xs">
        <thead className="sticky top-0 z-20">
          <tr className="border-b border-zinc-200 dark:border-[#1a2a4a] bg-zinc-50 dark:bg-[#0C132C]">
            <th className="sticky left-0 z-30 min-w-[112px] border-r border-zinc-200 dark:border-[#1a2a4a] bg-zinc-50 dark:bg-[#0C132C] px-3 py-2 text-left font-semibold text-zinc-600 dark:text-[#C7EEFF]">
              Team
            </th>
            {rounds.map((round) => (
              <th
                key={round}
                className="min-w-[116px] border-r border-zinc-100 dark:border-[#1a2a4a] px-2 py-2 text-center last:border-r-0"
              >
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={ROUND_BADGE_STYLE}>
                  R{round}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-[#1a2a4a]">
          {teams.map((team) => {
            const isUserTeam =
              team.teamId === currentUser?.teamId ||
              team.teamName === currentUser?.teamName ||
              team.teamName === session.userTeamName;
            return (
              <tr key={team.key} className={isUserTeam ? "bg-emerald-50/40 dark:bg-emerald-950/20" : "bg-white dark:bg-[#0C132C]"}>
                <td
                  className={cn(
                    "sticky left-0 z-10 min-w-[112px] border-r border-zinc-200 dark:border-[#1a2a4a] px-3 py-2 align-middle",
                    isUserTeam ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300" : "bg-white dark:bg-[#0C132C] text-zinc-800 dark:text-[#C7EEFF]",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {isUserTeam && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFB340]" />
                    )}
                    <span className="max-w-[92px] truncate text-[11px] font-medium">
                      {team.teamName}
                    </span>
                  </div>
                </td>
                {rounds.map((round) => {
                  const slot = grid.get(team.key)?.get(round);
                  const isCurrentPick = slot?.overallPick === session.currentPick;
                  return (
                    <MockPickCell
                      key={round}
                      slot={slot}
                      isCurrentPick={isCurrentPick}
                      isNew={slot !== undefined && newPickNums.has(slot.overallPick)}
                      ref={isCurrentPick ? currentPickRef : null}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OpponentIntelligencePanel({
  myTeamId,
  signals,
}: {
  myTeamId: string | null;
  signals: TeamKeeperSignal[];
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const opponentSignals = signals.filter(
    (s) => s.teamId !== myTeamId && s.hasRunOptimizer && s.probableKeepers.length > 0,
  );
  const mySignal = signals.find((s) => s.teamId === myTeamId);
  if (opponentSignals.length === 0) return null;

  const totalProbableKeepers = opponentSignals.reduce(
    (sum, s) => sum + s.probableKeepers.length,
    0,
  );
  const positionCounts: Record<string, number> = {};
  for (const sig of opponentSignals) {
    for (const pk of sig.probableKeepers) {
      positionCounts[pk.position] = (positionCounts[pk.position] ?? 0) + 1;
    }
  }
  const positionSummary = Object.entries(positionCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([pos, count]) => `${count} ${pos}`)
    .join(", ");

  return (
    <div className="mt-5">
      <button
        className="mb-2 flex w-full items-center justify-between text-left"
        onClick={() => setIsExpanded((v) => !v)}
        type="button"
      >
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">Opponent Intelligence</h3>
          <p className="text-xs text-zinc-500">
            Probable keeper choices based on optimizer results. {totalProbableKeepers} players
            likely off the board before the draft starts.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="warning">{opponentSignals.length} teams signaled</Badge>
          <Eye className="size-4 text-zinc-400" aria-hidden="true" />
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-2">
          {mySignal && mySignal.probableKeepers.length > 0 && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-xs font-semibold text-emerald-800">
                Your team: {mySignal.probableKeepers.map((pk) => pk.playerName).join(", ")}
              </p>
            </div>
          )}

          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="text-xs text-zinc-500">
              Position breakdown: <span className="font-medium text-zinc-700">{positionSummary || "—"}</span>
            </p>
          </div>

          <div className="max-h-64 space-y-1.5 overflow-auto pr-1">
            {opponentSignals.map((sig) => (
              <div
                className="rounded-md border border-zinc-200 bg-white px-3 py-2"
                key={sig.teamId}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-950">
                    {sig.teamName}
                    {sig.ownerName ? (
                      <span className="ml-1.5 text-xs font-normal text-zinc-500">
                        ({sig.ownerName})
                      </span>
                    ) : null}
                  </span>
                  <Badge variant="default">{sig.probableKeepers.length} keepers</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sig.probableKeepers.map((pk) => (
                    <span
                      className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-xs text-zinc-700"
                      key={pk.playerId}
                    >
                      <span
                        className={cn(
                          "font-semibold",
                          pk.position === "QB"
                            ? "text-violet-700"
                            : pk.position === "RB"
                              ? "text-emerald-700"
                              : pk.position === "WR"
                                ? "text-sky-700"
                                : pk.position === "TE"
                                  ? "text-amber-700"
                                  : "text-zinc-500",
                        )}
                      >
                        {pk.position}
                      </span>
                      {pk.playerName}
                      {pk.adpRound != null ? (
                        <span className="text-zinc-400">Rd {Math.round(pk.adpRound)}</span>
                      ) : null}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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

const NFL_TEAM_COLORS: Record<string, string> = {
  ARI: "bg-red-700", ATL: "bg-red-800", BAL: "bg-purple-900", BUF: "bg-blue-700",
  CAR: "bg-blue-600", CHI: "bg-blue-900", CIN: "bg-orange-600", CLE: "bg-orange-700",
  DAL: "bg-blue-800", DEN: "bg-orange-700", DET: "bg-blue-500", GB: "bg-green-700",
  HOU: "bg-blue-900", IND: "bg-blue-700", JAX: "bg-teal-600", KC: "bg-red-700",
  LAC: "bg-sky-600", LAR: "bg-blue-800", LV: "bg-zinc-800", MIA: "bg-teal-500",
  MIN: "bg-purple-800", NE: "bg-blue-900", NO: "bg-amber-700", NYG: "bg-blue-800",
  NYJ: "bg-green-700", PHI: "bg-emerald-700", PIT: "bg-yellow-600", SEA: "bg-green-800",
  SF: "bg-red-800", TB: "bg-red-700", TEN: "bg-sky-700", WAS: "bg-red-800",
};

// Sleeper DST player names → NFL team abbreviation (used as logo URL fallback when nflTeam is null)
const DST_NAME_TO_ABBR: Record<string, string> = {
  Cardinals: "ARI", Falcons: "ATL", Ravens: "BAL", Bills: "BUF",
  Panthers: "CAR", Bears: "CHI", Bengals: "CIN", Browns: "CLE",
  Cowboys: "DAL", Broncos: "DEN", Lions: "DET", Packers: "GB",
  Texans: "HOU", Colts: "IND", Jaguars: "JAX", Chiefs: "KC",
  Chargers: "LAC", Rams: "LAR", Raiders: "LV", Dolphins: "MIA",
  Vikings: "MIN", Patriots: "NE", Saints: "NO", Giants: "NYG",
  Jets: "NYJ", Eagles: "PHI", Steelers: "PIT", Seahawks: "SEA",
  "49ers": "SF", Buccaneers: "TB", Titans: "TEN", Commanders: "WAS",
};

function PlayerAvatar({
  imageUrl,
  playerName,
  nflTeam,
  position,
  size = "md",
}: {
  imageUrl: string | null | undefined;
  playerName: string;
  nflTeam: string | null | undefined;
  position?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const [imgError, setImgError] = React.useState(false);
  const [logoError, setLogoError] = React.useState(false);
  const sizeClasses = size === "xs" ? "size-8" : size === "sm" ? "size-10" : size === "lg" ? "size-20" : "size-14";
  const textSizeClass = size === "xs" ? "text-[10px]" : size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";
  const teamColor = (nflTeam && NFL_TEAM_COLORS[nflTeam]) ?? "bg-zinc-500";

  const isDst = position === "DST" || position === "DEF";
  const resolvedTeam = nflTeam || (isDst ? (DST_NAME_TO_ABBR[playerName] ?? null) : null);

  // DST players get a team logo — skip the individual-player thumb URL entirely
  if (isDst && resolvedTeam && !logoError) {
    return (
      <img
        alt={playerName}
        className={cn(sizeClasses, "shrink-0 rounded-lg object-contain bg-white p-0.5")}
        onError={() => setLogoError(true)}
        src={`https://a.espncdn.com/i/teamlogos/nfl/500/${resolvedTeam.toLowerCase()}.png`}
      />
    );
  }

  if (!isDst && imageUrl && !imgError) {
    return (
      <img
        alt={playerName}
        className={cn(sizeClasses, "shrink-0 rounded-full object-cover object-top")}
        onError={() => setImgError(true)}
        src={imageUrl}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        sizeClasses,
        teamColor,
        "shrink-0 rounded-full flex items-center justify-center",
      )}
    >
      <span className={cn(textSizeClass, "font-bold text-white/90 select-none")}>
        {nflTeam ?? "NFL"}
      </span>
    </div>
  );
}

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
          <div className="flex min-w-0 items-start gap-3">
            <PlayerAvatar
              imageUrl={player.imageUrl}
              playerName={player.playerName}
              nflTeam={player.nflTeam}
              position={player.position}
            />
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
          <div className="border-t border-zinc-200 px-4 pb-4 pt-3" aria-hidden="true">
            <div className="space-y-2">
              <div className="h-3.5 w-full animate-pulse rounded bg-zinc-200" />
              <div className="h-3.5 w-5/6 animate-pulse rounded bg-zinc-200" />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="h-3.5 w-3/4 animate-pulse rounded bg-zinc-200" />
                <div className="h-3.5 w-3/4 animate-pulse rounded bg-zinc-200" />
                <div className="h-3.5 w-4/5 animate-pulse rounded bg-zinc-200" />
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-zinc-200" />
              </div>
            </div>
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
        <table className="w-full text-left text-sm sm:min-w-[920px]">
          <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
            <tr>
              <th className="py-2 pr-4">Completed</th>
              <th className="py-2 pr-4">Grade</th>
              <th className="py-2 pr-4">Value</th>
              <th className="hidden py-2 pr-4 sm:table-cell">Roster</th>
              <th className="hidden py-2 pr-4 sm:table-cell">Balance</th>
              <th className="hidden py-2 pr-4 sm:table-cell">Finish</th>
              <th className="hidden py-2 pr-4 sm:table-cell">Timer</th>
              <th className="hidden py-2 pr-4 sm:table-cell">Bots</th>
              <th className="hidden py-2 pr-0 sm:table-cell">Overrides</th>
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
                  <td className="hidden py-3 pr-4 text-zinc-700 sm:table-cell">
                    {String(components?.roster_construction_score ?? "-")}
                  </td>
                  <td className="hidden py-3 pr-4 text-zinc-700 sm:table-cell">
                    {String(components?.positional_balance_score ?? "-")}
                  </td>
                  <td className="hidden py-3 pr-4 text-zinc-700 sm:table-cell">
                    {String(projected.projected_finish ?? "-")}
                  </td>
                  <td className="hidden py-3 pr-4 text-zinc-700 sm:table-cell">
                    {session.pickTimerSeconds ? `${session.pickTimerSeconds}s` : "No limit"}
                  </td>
                  <td className="hidden py-3 pr-4 text-zinc-700 sm:table-cell">
                    {String(session.botConfig.default_personality ?? "Balanced")} /{" "}
                    {String(session.botConfig.default_difficulty ?? "Medium")}
                  </td>
                  <td className="hidden py-3 pr-0 text-zinc-700 sm:table-cell">{countTeamBotOverrides(session.botConfig)}</td>
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
  const [boardView, setBoardView] = React.useState<"grid" | "list">("grid");
  const { teams, rounds, grid } = React.useMemo(() => {
    const roundSet = new Set(picks.map((p) => p.round));
    const rounds = Array.from(roundSet).sort((a, b) => a - b);

    // Order teams by their round-1 draft position
    const teamsInOrder: string[] = [];
    const seenTeams = new Set<string>();
    const round1Picks = picks
      .filter((p) => p.round === 1)
      .sort((a, b) => a.overallPick - b.overallPick);
    for (const pick of round1Picks) {
      if (!seenTeams.has(pick.team)) {
        seenTeams.add(pick.team);
        teamsInOrder.push(pick.team);
      }
    }
    for (const pick of picks) {
      if (!seenTeams.has(pick.team)) {
        seenTeams.add(pick.team);
        teamsInOrder.push(pick.team);
      }
    }

    // grid: team name → round → pick
    const grid = new Map<string, Map<number, DraftImpactPick>>();
    for (const pick of picks) {
      if (!grid.has(pick.team)) grid.set(pick.team, new Map());
      grid.get(pick.team)!.set(pick.round, pick);
    }

    return { teams: teamsInOrder, rounds, grid };
  }, [picks]);

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="flex rounded-md border border-zinc-200 dark:border-[#1a3050] text-[11px] font-medium overflow-hidden">
          <button
            className={cn("px-2 py-1 transition-colors", boardView === "grid" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#0a1f35]")}
            onClick={() => setBoardView("grid")}
            type="button"
          >
            Grid
          </button>
          <button
            className={cn("px-2 py-1 transition-colors border-l border-zinc-200 dark:border-[#1a3050]", boardView === "list" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#0a1f35]")}
            onClick={() => setBoardView("list")}
            type="button"
          >
            List
          </button>
        </div>
      </div>

      {boardView === "grid" ? (
        <div className="max-h-[560px] overflow-auto rounded-lg border border-zinc-200 dark:border-[#1a2a4a] bg-white dark:bg-[#0C132C]">
          <table className="border-collapse text-xs">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-zinc-200 dark:border-[#1a2a4a] bg-zinc-50 dark:bg-[#0C132C]">
                <th className="sticky left-0 z-30 min-w-[112px] border-r border-zinc-200 dark:border-[#1a2a4a] bg-zinc-50 dark:bg-[#0C132C] px-3 py-2 text-left font-semibold text-zinc-600 dark:text-[#C7EEFF]">
                  Team
                </th>
                {rounds.map((round) => (
                  <th
                    key={round}
                    className="min-w-[80px] border-r border-zinc-100 dark:border-[#1a2a4a] px-2 py-2 text-center last:border-r-0"
                  >
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={ROUND_BADGE_STYLE}>
                      R{round}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-[#1a2a4a]">
              {teams.map((team) => {
                const isUserTeam = isCurrentUserTeam({ name: team, user: currentUser });
                return (
                  <tr key={team} className={isUserTeam ? "bg-emerald-50/40 dark:bg-emerald-950/20" : "bg-white dark:bg-[#0C132C]"}>
                    <td
                      className={cn(
                        "sticky left-0 z-10 min-w-[112px] border-r border-zinc-200 dark:border-[#1a2a4a] px-3 py-2 align-middle",
                        isUserTeam ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300" : "bg-white dark:bg-[#0C132C] text-zinc-800 dark:text-[#C7EEFF]",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {isUserTeam && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFB340]" />
                        )}
                        <span className="max-w-[92px] truncate text-[11px] font-medium">{team}</span>
                      </div>
                    </td>
                    {rounds.map((round) => {
                      const pick = grid.get(team)?.get(round);
                      if (!pick) {
                        return (
                          <td key={round} className="min-w-[80px] border-r border-zinc-100 dark:border-[#1a2a4a] px-2 py-1.5 text-center text-zinc-300 dark:text-[#C7EEFF]/40 last:border-r-0">
                            —
                          </td>
                        );
                      }
                      const isForfeited = pick.status === "Forfeited";
                      return (
                        <td
                          key={round}
                          className={cn(
                            "min-w-[80px] border-r border-zinc-100 dark:border-[#1a2a4a] px-2 py-2 align-top last:border-r-0",
                            !isForfeited && "bg-white dark:bg-[#0C132C]",
                          )}
                          style={isForfeited ? KEEPER_CELL_STYLE : undefined}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className="text-[10px] tabular-nums font-medium"
                                style={isForfeited ? { color: "#1C4D93" } : CHROME_TEXT_STYLE}
                              >
                                #{pick.overallPick}
                              </span>
                              {isForfeited && <Lock className="h-2.5 w-2.5 shrink-0 text-[#C5A07A]" aria-label="Keeper" />}
                            </div>
                            {isForfeited ? (
                              <>
                                <p
                                  className="truncate text-[11px] font-semibold leading-tight text-[#1C4D93]"
                                  title={pick.keeperPlayer}
                                >
                                  {pick.keeperPlayer}
                                </p>
                                {pick.keeperPosition && <PositionBadge position={pick.keeperPosition} className="border-[#C5A07A] bg-[#0C132C] text-[#C5A07A] dark:border-[#C5A07A] dark:bg-[#0C132C] dark:text-[#C5A07A]" />}
                              </>
                            ) : (
                              <p className="text-[10px] italic" style={CHROME_TEXT_STYLE}>Open</p>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => {
            const roundPicks = picks
              .filter((p) => p.round === round)
              .sort((a, b) => a.overallPick - b.overallPick);
            const forfeitedCount = roundPicks.filter((p) => p.status === "Forfeited").length;
            return (
              <div key={round} className="rounded-lg border border-zinc-200 dark:border-[#1a2a4a] bg-white dark:bg-[#0C132C] overflow-hidden">
                <div className="border-b border-zinc-100 dark:border-[#1a2a4a] bg-zinc-50 dark:bg-[#0C132C] px-3 py-2">
                  <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={ROUND_BADGE_STYLE}>
                    Round {round}
                  </span>
                  <span className="ml-2 text-xs text-zinc-500 dark:text-[#C7EEFF]/60">
                    {forfeitedCount} forfeited · {roundPicks.length - forfeitedCount} open
                  </span>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-[#1a2a4a]">
                  {roundPicks.map((pick) => {
                    const isForfeited = pick.status === "Forfeited";
                    const isUserTeam = isCurrentUserTeam({ name: pick.team, user: currentUser });
                    return (
                      <div
                        key={pick.overallPick}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 text-xs",
                          !isForfeited && (isUserTeam ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""),
                        )}
                        style={isForfeited ? KEEPER_CELL_STYLE : undefined}
                      >
                        <span
                          className="w-8 shrink-0 font-semibold tabular-nums"
                          style={isForfeited ? { color: "#1C4D93" } : CHROME_TEXT_STYLE}
                        >
                          #{pick.overallPick}
                        </span>
                        <div className="min-w-0 flex-1">
                          {isForfeited ? (
                            <p className="truncate font-semibold text-[#1C4D93]">{pick.keeperPlayer ?? "—"}</p>
                          ) : (
                            <p className="truncate text-zinc-400 dark:text-[#C7EEFF]/60">Open pick</p>
                          )}
                          <p className="truncate text-[10px] text-zinc-500 dark:text-[#C7EEFF]/50">{pick.team}</p>
                        </div>
                        {isForfeited && pick.keeperPosition && (
                          <PositionBadge position={pick.keeperPosition} className="border-[#C5A07A] bg-[#0C132C] text-[#C5A07A] dark:border-[#C5A07A] dark:bg-[#0C132C] dark:text-[#C5A07A]" />
                        )}
                        {isForfeited && <Lock className="size-3 shrink-0 text-[#C5A07A]" aria-hidden="true" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConnectionBadge({ status }: { status: ApiStatus }) {
  const label: Record<ApiStatus, string> = {
    error: "API Error",
    live: "API Live",
    loading: "Loading",
    mock: "Mock",
    "no-league": "No League",
  };
  const variant = status === "live" ? "success" : status === "loading" ? "info" : "warning";
  return <Badge variant={variant}>{label[status]}</Badge>;
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

      <div className="flex flex-wrap gap-2">
        {teamResult.selectedKeepers.length ? (
          teamResult.selectedKeepers.map((keeper) => (
            <div key={`${keeper.player}-${keeper.position}`} className="flex items-center gap-1.5 text-sm">
              <PositionBadge position={keeper.position} />
              <span className="font-medium text-zinc-900">{keeper.player}</span>
            </div>
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
  draftFormat = "snake",
  finalizeButton,
  minimumKeeperValue = 1,
  onOverride,
  resetSignal,
  showOverrides = false,
  teamCount,
}: {
  data: KeeperRecommendation[];
  compact?: boolean;
  draftFormat?: string;
  finalizeButton?: React.ReactNode;
  minimumKeeperValue?: number;
  onOverride?: (
    teamId: string | undefined,
    playerId: string | undefined,
    overrideType: ManualOverrideType,
  ) => void;
  resetSignal?: number;
  showOverrides?: boolean;
  teamCount?: number;
}) {
  const isAuction = draftFormat === "auction";
  const { currentUser, data: workspaceData } = useDashboard();
  const leagueId = workspaceData.league?.id;
  const [loadingIds, setLoadingIds] = React.useState<Set<string>>(new Set());
  const [errorIds, setErrorIds] = React.useState<Set<string>>(new Set());
  const [localExplanations, setLocalExplanations] = React.useState<
    Record<string, KeeperExplanation>
  >({});
  const [selectedRec, setSelectedRec] = React.useState<KeeperRecommendation | null>(null);
  const [valueWindowCache, setValueWindowCache] = React.useState<Record<string, ValueWindowResult>>({});
  const [valueWindowLoading, setValueWindowLoading] = React.useState<Set<string>>(new Set());
  const [valueWindowErrors, setValueWindowErrors] = React.useState<Set<string>>(new Set());

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

  const handleFetchValueWindow = React.useCallback(
    async (rec: KeeperRecommendation) => {
      if (!leagueId || !rec.id) return;
      setValueWindowLoading((prev) => new Set(prev).add(rec.id!));
      setValueWindowErrors((prev) => {
        const next = new Set(prev);
        next.delete(rec.id!);
        return next;
      });
      try {
        const result = await getValueWindow(leagueId, rec.id);
        setValueWindowCache((prev) => ({ ...prev, [rec.id!]: result }));
      } catch {
        setValueWindowErrors((prev) => new Set(prev).add(rec.id!));
      } finally {
        setValueWindowLoading((prev) => {
          const next = new Set(prev);
          next.delete(rec.id!);
          return next;
        });
      }
    },
    [leagueId],
  );

  const columns = React.useMemo<ColumnDef<KeeperRecommendation>[]>(
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      { accessorKey: "scenario", header: "Scenario", meta: { className: "hidden sm:table-cell" } },
      {
        accessorKey: "player",
        header: "Player",
        cell: ({ row }) => {
          const rec = row.original;
          const maxSn = workspaceData.league?.maxConsecutiveKeeperSeasons ?? null;
          const sn = rec.consecutiveSeasons ?? null;
          const tenureBadgeVariant: "danger" | "warning" | "info" =
            sn != null && maxSn != null && sn >= maxSn
              ? "danger"
              : sn != null && maxSn != null && sn >= maxSn - 1
                ? "warning"
                : "info";
          return (
            <div className="flex items-center gap-1.5">
              <PlayerCell
                imageUrl={rec.imageUrl}
                name={rec.player}
                nflTeam={rec.nflTeam}
                position={rec.position}
                onClick={() => {
                  setSelectedRec(rec);
                  const hasExplanation = rec.id
                    ? !!(localExplanations[rec.id] ?? rec.aiExplanation)
                    : !!rec.aiExplanation;
                  if (!hasExplanation && rec.id && !loadingIds.has(rec.id) && !errorIds.has(rec.id)) {
                    handleGenerateExplanation(rec);
                  }
                  if (rec.id && !valueWindowCache[rec.id] && !valueWindowLoading.has(rec.id)) {
                    handleFetchValueWindow(rec);
                  }
                }}
              />
              {sn != null && (
                <Badge
                  className="shrink-0 text-[9px] py-0 px-1"
                  title={
                    maxSn != null
                      ? `${sn} of ${maxSn} consecutive seasons kept`
                      : `${sn} consecutive season${sn !== 1 ? "s" : ""} kept`
                  }
                  variant={tenureBadgeVariant}
                >
                  {maxSn != null ? `yr ${sn}/${maxSn}` : `yr ${sn}`}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "keeperCostPick",
        header: isAuction ? "Salary ($)" : "Cost Pick",
        cell: ({ row }) =>
          isAuction
            ? row.original.keeperCostPick != null
              ? `$${row.original.keeperCostPick}`
              : "—"
            : formatKeeperCost(row.original, teamCount),
      },
      {
        accessorKey: "adpPick",
        header: isAuction ? "Market ($)" : "ADP",
        cell: ({ row }) =>
          isAuction
            ? row.original.adpPick != null
              ? `$${row.original.adpPick}`
              : "—"
            : formatRecommendationAdp(row.original, teamCount),
      },
      {
        accessorKey: "keeperValue",
        header: isAuction ? "Surplus ($)" : "Value",
        cell: ({ row }) => {
          const value = row.original.keeperValue;
          const costRound = row.original.keeperCostRound;
          const tc = teamCount ?? 1;
          const flipRound =
            !isAuction && costRound != null
              ? Math.max(costRound - minimumKeeperValue / tc, 1)
              : null;
          return (
            <div className="leading-tight">
              <span className={cn("font-medium", value > 0 && "text-emerald-700")}>
                {isAuction && value != null ? `$${value}` : value}
              </span>
              {flipRound != null && (
                <div className="text-[10px] text-zinc-400">
                  flips Rd {flipRound % 1 === 0 ? flipRound : flipRound.toFixed(1)}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "keeperScore",
        header: "Score",
        meta: { className: "hidden sm:table-cell" },
        cell: ({ getValue }) => formatter.format(getValue<number>()),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusOverrideCell recommendation={row.original} onOverride={onOverride} />
        ),
      },
      {
        accessorKey: "manualOverride",
        id: "manualOverride",
        enableSorting: false,
        meta: { className: "hidden md:table-cell" },
        header: () => <ManualOverrideHeader />,
        cell: ({ row }) => (
          <ManualOverrideControls recommendation={row.original} onOverride={onOverride} />
        ),
      },
      { accessorKey: "reason", header: "Reason", meta: { className: "hidden md:table-cell" } },
    ],
    [
      currentUser,
      errorIds,
      handleGenerateExplanation,
      isAuction,
      loadingIds,
      localExplanations,
      minimumKeeperValue,
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
        leftToolbar={finalizeButton}
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
          valueWindow={modalRec.id ? (valueWindowCache[modalRec.id] ?? null) : null}
          isValueWindowLoading={modalRec.id ? valueWindowLoading.has(modalRec.id) : false}
          isValueWindowError={modalRec.id ? valueWindowErrors.has(modalRec.id) : false}
          onRetryValueWindow={() => handleFetchValueWindow(modalRec)}
        />
      )}
    </>
  );
}

function StatusOverrideCell({
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
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const canOverride = !!onOverride && !!recommendation.teamId && !!recommendation.playerId;
  const current = recommendation.manualOverride ?? "auto";

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className={cn(
          "flex items-center gap-1 rounded transition-colors",
          canOverride ? "hover:opacity-80 cursor-pointer" : "cursor-default",
        )}
        disabled={!canOverride}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <RecommendationBadge status={recommendation.status} />
        {canOverride && (
          <ChevronRight
            className={cn("size-3 shrink-0 text-zinc-400 transition-transform", open ? "rotate-90" : "rotate-0")}
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 rounded-md border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Override
          </p>
          <div className="flex items-center gap-1">
            <Button
              aria-label="Auto — let optimizer decide"
              className="h-8 w-8"
              onClick={() => { onOverride?.(recommendation.teamId, recommendation.playerId, "auto"); setOpen(false); }}
              size="icon"
              title="Auto"
              variant={current === "auto" ? "secondary" : "ghost"}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              aria-label="Force keep"
              className="h-8 w-8"
              onClick={() => { onOverride?.(recommendation.teamId, recommendation.playerId, "force_keep"); setOpen(false); }}
              size="icon"
              title="Force keep"
              variant={current === "force_keep" ? "secondary" : "ghost"}
            >
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              aria-label="Exclude"
              className="h-8 w-8"
              onClick={() => { onOverride?.(recommendation.teamId, recommendation.playerId, "exclude"); setOpen(false); }}
              size="icon"
              title="Exclude"
              variant={current === "exclude" ? "destructive" : "ghost"}
            >
              <Ban className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
          <div className="mt-1.5 flex gap-1 px-0.5 text-[9px] text-zinc-400">
            <span className="w-8 text-center">Auto</span>
            <span className="w-8 text-center">Keep</span>
            <span className="w-8 text-center">Excl</span>
          </div>
        </div>
      )}
    </div>
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
  valueWindow,
  isValueWindowLoading,
  isValueWindowError,
  onRetryValueWindow,
}: {
  rec: KeeperRecommendation;
  explanation: KeeperExplanation | null;
  isLoading: boolean;
  hasError: boolean;
  onClose: () => void;
  onRetry: () => void;
  valueWindow: ValueWindowResult | null;
  isValueWindowLoading: boolean;
  isValueWindowError: boolean;
  onRetryValueWindow: () => void;
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
          <div className="flex min-w-0 items-start gap-3">
            <PlayerAvatar
              imageUrl={rec.imageUrl}
              playerName={rec.player}
              nflTeam={rec.nflTeam}
              position={rec.position}
              size="sm"
            />
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
            <div className="space-y-2.5" aria-hidden="true">
              <div className="h-3.5 w-full animate-pulse rounded bg-zinc-200" />
              <div className="h-3.5 w-5/6 animate-pulse rounded bg-zinc-200" />
              <div className="h-3.5 w-4/5 animate-pulse rounded bg-zinc-200" />
              <div className="mt-4 h-3.5 w-1/3 animate-pulse rounded bg-zinc-200" />
              <div className="h-3.5 w-full animate-pulse rounded bg-zinc-200" />
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-zinc-200" />
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
        <ValueWindowSection
          valueWindow={valueWindow}
          isLoading={isValueWindowLoading}
          hasError={isValueWindowError}
          onRetry={onRetryValueWindow}
        />
      </div>
    </div>
  );
}

const YEAR_LABELS = ["This year", "Year 2", "Year 3", "Year 4"];

function ValueWindowSection({
  valueWindow,
  isLoading,
  hasError,
  onRetry,
}: {
  valueWindow: ValueWindowResult | null;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  const showTrigger = valueWindow !== null || isLoading || hasError;
  if (!showTrigger) return null;

  return (
    <div className="border-t border-zinc-100">
      <button
        className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="flex items-center gap-1.5">
          <BarChart2 className="size-3.5 text-zinc-400" aria-hidden="true" />
          Value Window
        </span>
        <ChevronRight
          className={cn("size-4 text-zinc-400 transition-transform", open && "rotate-90")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="px-5 pb-4 pt-1">
          {isLoading && (
            <div className="space-y-2" aria-hidden="true">
              <div className="h-3.5 w-full animate-pulse rounded bg-zinc-200" />
              <div className="h-3.5 w-5/6 animate-pulse rounded bg-zinc-200" />
              <div className="h-3.5 w-4/5 animate-pulse rounded bg-zinc-200" />
            </div>
          )}
          {hasError && !isLoading && (
            <div className="space-y-1.5">
              <p className="text-sm text-red-600">Failed to load value window.</p>
              <button className="text-sm text-zinc-600 underline" onClick={onRetry} type="button">
                Try again
              </button>
            </div>
          )}
          {!isLoading && !hasError && valueWindow && (
            <div className="space-y-3">
              {!valueWindow.hasAgeData && (
                <p className="text-xs text-amber-600">
                  Age data not available — projections assume flat ADP (cost escalation only).
                </p>
              )}
              <div className="space-y-1.5">
                {valueWindow.years.map((yr) => {
                  const label = YEAR_LABELS[yr.yearOffset] ?? `Year ${yr.yearOffset + 1}`;
                  const barWidth = Math.min(
                    100,
                    Math.max(0, (yr.projectedKeeperValue / 10) * 100),
                  );
                  return (
                    <div key={yr.yearOffset} className="flex items-center gap-2 text-xs">
                      <span className="w-[4.5rem] shrink-0 text-zinc-500">{label}</span>
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              yr.isValue ? "bg-[#FFB340]" : "bg-red-400",
                            )}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            "w-10 shrink-0 text-right font-medium tabular-nums",
                            yr.isValue ? "text-emerald-700" : "text-red-600",
                          )}
                        >
                          {yr.projectedKeeperValue > 0 ? "+" : ""}
                          {yr.projectedKeeperValue.toFixed(1)}
                        </span>
                      </div>
                      <span className="w-20 shrink-0 text-right text-zinc-400">
                        Rd {yr.keeperCostRound} / {yr.projectedAdpRound}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-zinc-500">
                {valueWindow.optimalKeepThroughYear !== null
                  ? `Optimal keep through ${YEAR_LABELS[valueWindow.optimalKeepThroughYear] ?? `Year ${valueWindow.optimalKeepThroughYear + 1}`}${valueWindow.currentAge ? ` (age ${valueWindow.currentAge})` : ""}.`
                  : "Not a value keeper — cost exceeds ADP projection in all windows."}
                {" "}Cost vs. ADP round; bar = rounds of surplus (cap 10).
              </p>
            </div>
          )}
        </div>
      )}
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
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="mt-1 text-base font-semibold leading-6 text-zinc-950 dark:text-zinc-50">{value}</p>
          {detail ? <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{detail}</p> : null}
        </div>
        <div className={cn("mt-1 size-2 shrink-0 rounded-full", accentClass)} />
      </CardContent>
    </Card>
  );
}

function MetricStrip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
      <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-950 dark:text-zinc-50">{value}</p>
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
    <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{title}</p>
      {items.length ? (
        items.map((item, index) => (
          <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800" key={`${item.team}-${item.title}-${index}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{item.title}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.team}</p>
              </div>
              <Badge variant={item.variant}>{item.note}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{item.detail}</p>
          </div>
        ))
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{emptyText}</p>
      )}
    </div>
  );
}

function WatchlistSection({ leagueId }: { leagueId: string | null }) {
  const [watchlist, setWatchlist] = React.useState<WatchlistEntry[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<WatchlistSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!leagueId) return;
    getWatchlist(leagueId)
      .then(setWatchlist)
      .catch(() => {/* silent */});
  }, [leagueId]);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!leagueId || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setIsSearching(true);
      searchWatchlistPlayers(leagueId, searchQuery.trim())
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setIsSearching(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [leagueId, searchQuery]);

  const watchedIds = React.useMemo(() => new Set(watchlist.map((w) => w.playerId)), [watchlist]);

  async function handleAdd(result: WatchlistSearchResult) {
    if (!leagueId) return;
    try {
      const entry = await addToWatchlist(leagueId, result.playerId);
      setWatchlist((prev) => {
        if (prev.some((w) => w.playerId === entry.playerId)) return prev;
        return [...prev, entry];
      });
    } catch {
      toast.error("Failed to add player to watchlist.");
    }
  }

  async function handleRemove(playerId: string) {
    if (!leagueId) return;
    try {
      await removeFromWatchlist(leagueId, playerId);
      setWatchlist((prev) => prev.filter((w) => w.playerId !== playerId));
    } catch {
      toast.error("Failed to remove player from watchlist.");
    }
  }

  if (!leagueId) return null;

  return (
    <div className="space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <Star className="size-4 text-amber-500" aria-hidden="true" />
        <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Player Watchlist</span>
        {watchlist.length > 0 && (
          <span className="ml-auto text-xs text-zinc-500">{watchlist.length} watched</span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
        <Input
          className="h-8 pl-7 text-sm"
          placeholder="Search players to watch…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            onClick={() => { setSearchQuery(""); setSearchResults([]); }}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Search results */}
      {(searchResults.length > 0 || isSearching) && (
        <div className="rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          {isSearching && (
            <p className="px-3 py-2 text-xs text-zinc-500">Searching…</p>
          )}
          {!isSearching && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
            <p className="px-3 py-2 text-xs text-zinc-500">No players found.</p>
          )}
          {searchResults.map((result) => {
            const isWatched = watchedIds.has(result.playerId);
            return (
              <div
                key={result.playerId}
                className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 last:border-0 dark:border-zinc-800"
              >
                <PlayerCell
                  imageUrl={result.imageUrl}
                  name={result.playerName}
                  nflTeam={result.nflTeam}
                  position={result.position}
                />
                {result.adpPick != null && (
                  <span className="ml-auto shrink-0 text-xs text-zinc-500">
                    ADP {Math.round(result.adpPick)}
                  </span>
                )}
                <Button
                  size="sm"
                  variant={isWatched ? "outline" : "default"}
                  className="h-6 shrink-0 px-2 text-[10px]"
                  onClick={() => isWatched ? handleRemove(result.playerId) : handleAdd(result)}
                >
                  {isWatched ? "Remove" : "Watch"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Watchlist */}
      {watchlist.length === 0 && !searchQuery ? (
        <p className="text-xs text-zinc-500">Search for players above to build your watchlist.</p>
      ) : watchlist.length > 0 ? (
        <div className="space-y-1">
          {watchlist.map((entry) => (
            <div
              key={entry.playerId}
              className="flex items-center gap-2 rounded-md border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" aria-hidden="true" />
              <PlayerCell
                imageUrl={entry.imageUrl}
                name={entry.playerName}
                nflTeam={entry.nflTeam}
                position={entry.position}
              />
              <button
                className="ml-auto shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                onClick={() => void handleRemove(entry.playerId)}
                title="Remove from watchlist"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
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
          className="block rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/20"
          href={item.link}
          key={`${item.link}-${item.publishedAt}`}
          rel="noreferrer"
          target="_blank"
        >
          <div className="flex items-center justify-between gap-2">
            <Badge variant="info">{item.source}</Badge>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatNewsDate(item.publishedAt)}</span>
          </div>
          <p className="mt-2 text-sm font-semibold leading-5 text-zinc-950 dark:text-zinc-50">{item.headline}</p>
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
        "rounded-md border border-zinc-200 bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900",
        isCurrentTeam && "border-[rgba(128,232,255,0.4)] bg-[rgba(128,232,255,0.06)] ring-1 ring-[rgba(128,232,255,0.15)] dark:border-[rgba(128,232,255,0.4)] dark:bg-[rgba(128,232,255,0.06)] dark:ring-[rgba(128,232,255,0.15)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <TeamNameMark
            className="text-sm font-semibold text-zinc-950 dark:text-zinc-50"
            name={team.name}
            teamId={team.id}
            user={currentUser}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{team.owner || "Owner not assigned"}</p>
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
        className="size-4 accent-[#FFB340]"
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
  onShare,
  outlook,
}: {
  currentUser: AuthUser | null;
  disabled?: boolean;
  onExport?: () => void;
  onShare?: () => Promise<void>;
  outlook: Outlook;
}) {
  const [sharing, setSharing] = React.useState(false);

  const isCurrentTeam = isCurrentUserTeam({
    name: outlook.team,
    teamId: outlook.teamId,
    user: currentUser,
  });

  async function handleShare() {
    if (!onShare) return;
    setSharing(true);
    try {
      await onShare();
    } finally {
      setSharing(false);
    }
  }

  return (
    <Card className={cn("transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md", isCurrentTeam && "border-[rgba(128,232,255,0.4)] bg-[rgba(128,232,255,0.06)] ring-1 ring-[rgba(128,232,255,0.15)]")}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="min-w-0">
            <TeamNameMark name={outlook.team} teamId={outlook.teamId} user={currentUser} />
          </CardTitle>
          <div className="flex items-center gap-2">
            {outlook.scenario ? <Badge>{outlook.scenario}</Badge> : null}
            <Badge variant="info">{outlook.stance}</Badge>
            <Button
              aria-label={`Download ${outlook.team} keeper report card`}
              disabled={disabled || !outlook.teamId || sharing}
              onClick={handleShare}
              size="icon"
              title="Download keeper report card (PNG)"
              variant="outline"
            >
              <Share2 className="size-4" aria-hidden="true" />
            </Button>
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
        isCurrentTeam && "rounded-md border border-[rgba(128,232,255,0.4)] bg-[rgba(128,232,255,0.08)] px-2 py-1 text-[#EBF4F9] dark:border-[rgba(128,232,255,0.4)] dark:bg-[rgba(128,232,255,0.08)] dark:text-[#EBF4F9]",
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
      <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-200">{value}</p>
    </div>
  );
}

function PositionBadge({ position, className }: { position: string; className?: string }) {
  const variantMap: Record<string, "qb" | "rb" | "wr" | "te" | "k" | "dst"> = {
    QB: "qb",
    RB: "rb",
    WR: "wr",
    TE: "te",
    K: "k",
    DST: "dst",
    DEF: "dst",
  };
  const variant = variantMap[position] ?? "default";
  return <Badge variant={variant as Parameters<typeof Badge>[0]["variant"]} className={className}>{position}</Badge>;
}

function DraftCountdownRing({ max, value }: { max: number; value: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const progress = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const offset = circumference * (1 - progress);
  const color = progress > 0.5 ? "#10b981" : progress > 0.25 ? "#f59e0b" : "#ef4444";
  return (
    <div
      aria-label={`${value} seconds remaining`}
      aria-live="polite"
      className="relative flex shrink-0 items-center justify-center"
      role="timer"
    >
      <svg className="size-12 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-zinc-200" />
        <circle
          cx="24" cy="24" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.4s" }}
        />
      </svg>
      <span className="absolute text-sm font-bold tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}

function PlayerCell({
  imageUrl,
  name,
  nflTeam,
  onClick,
  position,
}: {
  imageUrl?: string | null;
  name: string;
  nflTeam?: string | null;
  onClick?: () => void;
  position: string;
}) {
  const isDst = position === "DST" || position === "DEF";
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {(imageUrl || nflTeam || isDst) && (
        <PlayerAvatar imageUrl={imageUrl} nflTeam={nflTeam} playerName={name} position={position} size="xs" />
      )}
      <div className="min-w-0 leading-tight">
        {onClick ? (
          <button
            className="block truncate text-left text-sm font-semibold text-zinc-950 underline-offset-2 hover:text-emerald-700 hover:underline focus:outline-none"
            onClick={onClick}
            type="button"
          >
            {name}
          </button>
        ) : (
          <span className="block truncate text-sm font-semibold text-zinc-950">{name}</span>
        )}
        <div className="mt-0.5 flex items-center gap-1.5">
          <PositionBadge position={position} />
          {nflTeam && <span className="text-xs text-zinc-400">{nflTeam}</span>}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "Starter" ? "success" : status === "Bench" ? "info" : "warning";
  return <Badge variant={variant}>{status}</Badge>;
}

// ── Draft Board Page ──────────────────────────────────────────────────────────

function DraftBoardPage() {
  const { activeLeagueId, currentUser } = useDashboard();
  const [board, setBoard] = React.useState<DraftBoardResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [boardView, setBoardView] = React.useState<"grid" | "list">("grid");

  React.useEffect(() => {
    if (!activeLeagueId) return;
    setLoading(true);
    setError("");
    getDraftBoard(activeLeagueId)
      .then(setBoard)
      .catch(() => setError("Could not load draft board."))
      .finally(() => setLoading(false));
  }, [activeLeagueId]);

  if (loading) {
    return (
      <PagePanel title="Final Draft Board" description="Full snake-draft pick grid with forfeited keeper picks highlighted.">
        <p className="text-sm text-zinc-500">Loading…</p>
      </PagePanel>
    );
  }

  if (error) {
    return (
      <PagePanel title="Final Draft Board" description="Full snake-draft pick grid with forfeited keeper picks highlighted.">
        <p className="text-sm text-red-600">{error}</p>
      </PagePanel>
    );
  }

  if (!board) {
    return (
      <PagePanel title="Final Draft Board" description="Full snake-draft pick grid with forfeited keeper picks highlighted.">
        <p className="text-sm text-zinc-500">No draft data available.</p>
      </PagePanel>
    );
  }

  const allPicks = board.rounds.flatMap((r) => r.picks);
  const forfeitedPicks = allPicks.filter((p) => p.isForfeited);
  const openPicks = allPicks.filter((p) => !p.isForfeited);

  // Teams ordered by draft slot; rounds in order
  const teamsInOrder = [...board.teams].sort((a, b) => (a.draftSlot ?? 0) - (b.draftSlot ?? 0));
  const rounds = board.rounds.map((r) => r.round).sort((a, b) => a - b);

  // grid: draftSlot → round → pick
  const grid = new Map<number, Map<number, DraftBoardPick>>();
  for (const round of board.rounds) {
    for (const pick of round.picks) {
      if (!grid.has(pick.draftSlot)) grid.set(pick.draftSlot, new Map());
      grid.get(pick.draftSlot)!.set(round.round, pick);
    }
  }

  return (
    <PagePanel title="Final Draft Board" description="Full snake-draft pick grid with forfeited keeper picks highlighted.">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <MetricStrip label="Forfeited Picks" value={forfeitedPicks.length.toString()} />
          <MetricStrip label="Open Picks" value={openPicks.length.toString()} />
          <MetricStrip label="Teams" value={board.teamCount.toString()} />
          <MetricStrip label="Rounds" value={board.roundCount.toString()} />
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border border-[#C3D8EE]" style={KEEPER_CELL_STYLE} />
            Forfeited (keeper)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border border-zinc-200 dark:border-[#1a2a4a] bg-white dark:bg-[#0C132C]" />
            Open
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-emerald-100 dark:bg-emerald-950/60" />
            Your team
          </span>
          <span className="ml-auto flex items-center gap-2">
            <span>{board.draftType === "snake" ? "Snake draft" : board.draftType}</span>
            {board.isFinalized && (
              <span className="rounded bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                Keepers finalized
              </span>
            )}
            <div className="flex rounded-md border border-zinc-200 dark:border-[#1a3050] text-[11px] font-medium overflow-hidden">
              <button
                className={cn("px-2 py-1 transition-colors", boardView === "grid" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#0a1f35]")}
                onClick={() => setBoardView("grid")}
                type="button"
              >
                Grid
              </button>
              <button
                className={cn("px-2 py-1 transition-colors border-l border-zinc-200 dark:border-[#1a3050]", boardView === "list" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#0a1f35]")}
                onClick={() => setBoardView("list")}
                type="button"
              >
                List
              </button>
            </div>
          </span>
        </div>

        {boardView === "grid" ? (
          /* Grid: rows = teams (by draft slot), columns = rounds */
          <div className="max-h-[560px] overflow-auto rounded-lg border border-zinc-200 dark:border-[#1a2a4a] bg-white dark:bg-[#0C132C]">
            <table className="border-collapse text-xs">
              <thead className="sticky top-0 z-20">
                <tr className="border-b border-zinc-200 dark:border-[#1a2a4a] bg-zinc-50 dark:bg-[#0C132C]">
                  <th className="sticky left-0 z-30 min-w-[120px] border-r border-zinc-200 dark:border-[#1a2a4a] bg-zinc-50 dark:bg-[#0C132C] px-3 py-2 text-left font-semibold text-zinc-600 dark:text-[#C7EEFF]">
                    Team
                  </th>
                  {rounds.map((round) => (
                    <th
                      key={round}
                      className="min-w-[80px] border-r border-zinc-100 dark:border-[#1a2a4a] px-2 py-2 text-center last:border-r-0"
                    >
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={ROUND_BADGE_STYLE}>
                        R{round}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-[#1a2a4a]">
                {teamsInOrder.map((team) => {
                  const isUserTeam = isCurrentUserTeam({
                    name: team.teamName,
                    teamId: team.teamId,
                    user: currentUser,
                  });
                  const slot = team.draftSlot ?? 0;
                  return (
                    <tr key={team.teamId ?? team.teamName} className={isUserTeam ? "bg-emerald-50/40 dark:bg-emerald-950/20" : "bg-white dark:bg-[#0C132C]"}>
                      <td
                        className={cn(
                          "sticky left-0 z-10 min-w-[120px] border-r border-zinc-200 dark:border-[#1a2a4a] px-3 py-2 align-middle",
                          isUserTeam ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300" : "bg-white dark:bg-[#0C132C] text-zinc-800 dark:text-[#C7EEFF]",
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          {isUserTeam && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFB340]" />
                          )}
                          <div className="min-w-0">
                            <p className="max-w-[88px] truncate text-[11px] font-medium">{team.teamName}</p>
                            {team.ownerName && (
                              <p className="max-w-[88px] truncate text-[10px] text-zinc-400 dark:text-[#C7EEFF]/50">{team.ownerName}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      {rounds.map((round) => {
                        const pick = grid.get(slot)?.get(round);
                        if (!pick) {
                          return (
                            <td key={round} className="min-w-[80px] border-r border-zinc-100 dark:border-[#1a2a4a] px-2 py-1.5 text-center text-zinc-300 dark:text-[#C7EEFF]/40 last:border-r-0">
                              —
                            </td>
                          );
                        }
                        return <DraftPickCell key={round} pick={pick} />;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* List view: picks grouped by round — better for mobile */
          <div className="space-y-3">
            {rounds.map((round) => {
              const roundPicks = allPicks
                .filter((p) => p.round === round)
                .sort((a, b) => a.overallPick - b.overallPick);
              return (
                <div key={round} className="rounded-lg border border-zinc-200 dark:border-[#1a2a4a] bg-white dark:bg-[#0C132C] overflow-hidden">
                  <div className="border-b border-zinc-100 dark:border-[#1a2a4a] bg-zinc-50 dark:bg-[#0C132C] px-3 py-2">
                    <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={ROUND_BADGE_STYLE}>
                      Round {round}
                    </span>
                    <span className="ml-2 text-xs text-zinc-500 dark:text-[#C7EEFF]/60">
                      {roundPicks.filter((p) => p.isForfeited).length} forfeited · {roundPicks.filter((p) => !p.isForfeited).length} open
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-100 dark:divide-[#1a2a4a]">
                    {roundPicks.map((pick) => {
                      const isUserTeam = isCurrentUserTeam({
                        name: pick.teamName ?? "",
                        teamId: pick.teamId ?? "",
                        user: currentUser,
                      });
                      return (
                        <div
                          key={pick.overallPick}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 text-xs",
                            !pick.isForfeited && (isUserTeam ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""),
                          )}
                          style={pick.isForfeited ? KEEPER_CELL_STYLE : undefined}
                        >
                          <span
                            className="w-8 shrink-0 font-semibold tabular-nums"
                            style={pick.isForfeited ? { color: "#1C4D93" } : CHROME_TEXT_STYLE}
                          >
                            #{pick.overallPick}
                          </span>
                          <div className="min-w-0 flex-1">
                            {pick.isForfeited ? (
                              <p className="truncate font-semibold text-[#1C4D93]">
                                {pick.forfeitedPlayerName ?? "—"}
                              </p>
                            ) : (
                              <p className="truncate text-zinc-400 dark:text-[#C7EEFF]/60">Open pick</p>
                            )}
                            <p className="truncate text-[10px] text-zinc-500 dark:text-[#C7EEFF]/50">{pick.teamName ?? "—"}</p>
                          </div>
                          {pick.isForfeited && pick.forfeitedPlayerPosition && (
                            <PositionBadge position={pick.forfeitedPlayerPosition} className="border-[#C5A07A] bg-[#0C132C] text-[#C5A07A] dark:border-[#C5A07A] dark:bg-[#0C132C] dark:text-[#C5A07A]" />
                          )}
                          {pick.isForfeited && (
                            <Lock className="size-3 shrink-0 text-[#C5A07A]" aria-hidden="true" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Forfeited picks summary */}
        {forfeitedPicks.length > 0 && (
          <div className="rounded-lg border border-zinc-200 dark:border-[#1a2a4a] bg-white dark:bg-[#0C132C] p-4">
            <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-[#C7EEFF]">Forfeited Picks Summary</h3>
            <div className="space-y-1.5">
              {forfeitedPicks
                .sort((a, b) => a.overallPick - b.overallPick)
                .map((p) => (
                  <div
                    key={p.overallPick}
                    className="flex items-center gap-3 rounded-md border border-[#C3D8EE] px-3 py-2 text-xs"
                    style={KEEPER_CELL_STYLE}
                  >
                    <span className="font-semibold text-[#1C4D93]">#{p.overallPick}</span>
                    <span className="text-[#1C4D93]/60">Rd {p.round}</span>
                    <span className="font-medium text-[#1C4D93]">{p.teamName ?? "—"}</span>
                    <span className="flex-1 text-[#1C4D93]">{p.forfeitedPlayerName ?? "—"}</span>
                    {p.forfeitedPlayerPosition && (
                      <PositionBadge position={p.forfeitedPlayerPosition} className="border-[#C5A07A] bg-[#0C132C] text-[#C5A07A] dark:border-[#C5A07A] dark:bg-[#0C132C] dark:text-[#C5A07A]" />
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </PagePanel>
  );
}

function DraftPickCell({ pick }: { pick: DraftBoardPick }) {
  if (pick.isForfeited) {
    return (
      <td className="min-w-[80px] border-r border-zinc-100 dark:border-[#1a2a4a] px-2 py-2 align-top last:border-r-0" style={KEEPER_CELL_STYLE}>
        <div className="space-y-0.5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] tabular-nums font-medium text-[#1C4D93]">
              #{pick.overallPick}
            </span>
            <Lock className="h-2.5 w-2.5 shrink-0 text-[#C5A07A]" aria-label="Keeper" />
          </div>
          <p
            className="truncate text-[11px] font-semibold leading-tight text-[#1C4D93]"
            title={pick.forfeitedPlayerName ?? ""}
          >
            {pick.forfeitedPlayerName ?? "—"}
          </p>
          {pick.forfeitedPlayerPosition && (
            <PositionBadge position={pick.forfeitedPlayerPosition} className="border-[#C5A07A] bg-[#0C132C] text-[#C5A07A] dark:border-[#C5A07A] dark:bg-[#0C132C] dark:text-[#C5A07A]" />
          )}
        </div>
      </td>
    );
  }
  return (
    <td className="min-w-[80px] border-r border-zinc-100 dark:border-[#1a2a4a] px-2 py-1.5 text-center tabular-nums text-[10px] last:border-r-0">
      <span style={CHROME_TEXT_STYLE}>#{pick.overallPick}</span>
    </td>
  );
}

// ── Season Analysis Page ──────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<SeasonDecisionCategory, string> = {
  hit: "Hit",
  miss: "Miss",
  bust: "Bust",
  left_on_table: "Left on Table",
  dodged: "Dodged",
  below_adp: "Below ADP",
  unknown: "Unknown",
};

const CATEGORY_COLORS: Record<SeasonDecisionCategory, string> = {
  hit: "bg-emerald-100 text-emerald-800",
  miss: "bg-amber-100 text-amber-800",
  bust: "bg-red-100 text-red-800",
  left_on_table: "bg-sky-100 text-sky-800",
  dodged: "bg-zinc-100 text-zinc-700",
  below_adp: "bg-zinc-100 text-zinc-600",
  unknown: "bg-zinc-50 text-zinc-400",
};

function CategoryBadge({ category }: { category: SeasonDecisionCategory }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", CATEGORY_COLORS[category])}>
      {CATEGORY_LABEL[category]}
    </span>
  );
}

function SeasonAnalysisPage() {
  const { activeLeagueId } = useDashboard();
  const [result, setResult] = React.useState<SeasonAnalysisResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [expandedTeamId, setExpandedTeamId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!activeLeagueId) return;
    setLoading(true);
    setError("");
    getSeasonAnalysis(activeLeagueId)
      .then(setResult)
      .catch(() => setError("Could not load season analysis."))
      .finally(() => setLoading(false));
  }, [activeLeagueId]);

  if (loading) {
    return (
      <PagePanel title="Season Analysis" description="End-of-season review comparing keeper recommendations vs. actual selections vs. performance.">
        <p className="text-sm text-zinc-500">Loading…</p>
      </PagePanel>
    );
  }

  if (error) {
    return (
      <PagePanel title="Season Analysis" description="End-of-season review comparing keeper recommendations vs. actual selections vs. performance.">
        <p className="text-sm text-red-600">{error}</p>
      </PagePanel>
    );
  }

  if (!result || (!result.leagueSummary.hasOutcomes && !result.leagueSummary.hasFinalSelections)) {
    return (
      <PagePanel title="Season Analysis" description="End-of-season review comparing keeper recommendations vs. actual selections vs. performance.">
        <p className="text-sm text-zinc-500">
          No season outcome data yet. Import season outcomes via Commissioner Tools → League Data Imports to unlock this analysis.
        </p>
      </PagePanel>
    );
  }

  const s = result.leagueSummary;

  return (
    <PagePanel title="Season Analysis" description="End-of-season review comparing keeper recommendations vs. actual selections vs. performance.">
      <div className="space-y-6">
        {/* League Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStatCard label="Total Kept" value={s.totalKept} />
          <SummaryStatCard
            label="Hit Rate"
            value={s.hitRate != null ? `${Math.round(s.hitRate * 100)}%` : "—"}
            sub={`${s.hits} hits`}
            color="text-emerald-700"
          />
          <SummaryStatCard
            label="Bust Rate"
            value={s.bustRate != null ? `${Math.round(s.bustRate * 100)}%` : "—"}
            sub={`${s.busts} busts`}
            color="text-red-700"
          />
          <SummaryStatCard
            label="Left on Table"
            value={s.leftOnTableCount}
            sub={`${s.dodgedCount} dodged`}
            color="text-sky-700"
          />
          <SummaryStatCard label="Rec Followed" value={s.recFollowedCount} />
          <SummaryStatCard
            label="Rec Hit Rate"
            value={s.recHitRate != null ? `${Math.round(s.recHitRate * 100)}%` : "—"}
          />
          <SummaryStatCard
            label="Avg Opp Cost"
            value={s.avgOpportunityCostRounds != null ? `${s.avgOpportunityCostRounds} rds` : "—"}
            sub="rounds of value left"
          />
          <SummaryStatCard label="Season" value={result.seasonYear} />
        </div>

        {/* Per-Team Cards */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-700">Team Breakdown</h3>
          {result.teams.map((team) => (
            <TeamAnalysisCard
              key={team.teamId}
              team={team}
              expanded={expandedTeamId === team.teamId}
              onToggle={() =>
                setExpandedTeamId((prev) => (prev === team.teamId ? null : team.teamId))
              }
            />
          ))}
        </div>
      </div>
    </PagePanel>
  );
}

function SummaryStatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={cn("text-xl font-bold", color ?? "text-zinc-800")}>{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

function TeamAnalysisCard({
  team,
  expanded,
  onToggle,
}: {
  team: TeamSeasonAnalysis;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hitPct = team.keepersKept > 0 ? Math.round((team.hits / team.keepersKept) * 100) : null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <ChevronRight
            className={cn("h-4 w-4 text-zinc-400 transition-transform", expanded && "rotate-90")}
          />
          <div>
            <span className="font-medium text-zinc-800">{team.teamName}</span>
            {team.ownerName && (
              <span className="ml-2 text-xs text-zinc-500">{team.ownerName}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-500">
            <span className="font-medium text-emerald-700">{team.hits}</span> hits /{" "}
            <span className="font-medium text-red-600">{team.busts}</span> busts /{" "}
            <span className="font-medium text-sky-600">{team.leftOnTableCount}</span> LOT
          </span>
          {hitPct != null && (
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              {hitPct}% hit rate
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-100">
                <th className="py-1.5 text-left font-medium">Player</th>
                <th className="py-1.5 text-left font-medium">Pos</th>
                <th className="py-1.5 text-right font-medium">Kept?</th>
                <th className="py-1.5 text-right font-medium">Rec?</th>
                <th className="py-1.5 text-right font-medium">Cost Rd</th>
                <th className="py-1.5 text-right font-medium">ADP Rd</th>
                <th className="py-1.5 text-right font-medium">Rank</th>
                <th className="py-1.5 text-right font-medium">Pts</th>
                <th className="py-1.5 text-right font-medium">Category</th>
              </tr>
            </thead>
            <tbody>
              {team.decisions.map((d: SeasonDecision) => (
                <tr key={d.playerId} className="border-b border-zinc-50 hover:bg-zinc-50">
                  <td className="py-1.5 font-medium text-zinc-800">{d.playerName}</td>
                  <td className="py-1.5">
                    <span
                      className={cn(
                        "rounded px-1 py-0.5 font-medium",
                        POSITION_COLORS[d.position] ?? "bg-zinc-100 text-zinc-700",
                      )}
                    >
                      {d.position}
                    </span>
                  </td>
                  <td className="py-1.5 text-right">
                    {d.wasKept ? (
                      <span className="text-emerald-600">Yes</span>
                    ) : (
                      <span className="text-zinc-400">No</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right">
                    {d.isRecommended ? (
                      <span className="text-emerald-600">Yes</span>
                    ) : (
                      <span className="text-zinc-400">No</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right text-zinc-600">
                    {d.keeperCostRound != null ? `Rd ${d.keeperCostRound}` : "—"}
                  </td>
                  <td className="py-1.5 text-right text-zinc-600">
                    {d.adpRoundAtKeep != null ? `Rd ${d.adpRoundAtKeep}` : "—"}
                  </td>
                  <td className="py-1.5 text-right text-zinc-600">
                    {d.finishRank != null ? `#${d.finishRank}` : "—"}
                  </td>
                  <td className="py-1.5 text-right text-zinc-600">
                    {d.fantasyPoints != null ? d.fantasyPoints.toFixed(1) : "—"}
                  </td>
                  <td className="py-1.5 text-right">
                    <CategoryBadge category={d.category} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {team.avgOpportunityCostRounds != null && (
            <p className="mt-2 text-xs text-zinc-500">
              Avg opportunity cost: <strong>{team.avgOpportunityCostRounds} rounds</strong> of value
              left on table
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TrendBadge({ trend }: { trend: string }) {
  const variant = trend.startsWith("Up") ? "success" : trend.startsWith("Down") ? "danger" : "default";
  return <Badge variant={variant}>{trend}</Badge>;
}

// ---------------------------------------------------------------------------
// ADP Sparkline (item 10 — ADP Trend Mini-Charts)
// ---------------------------------------------------------------------------

function AdpSparkline({ history }: { history: AdpHistoryPoint[] }) {
  if (history.length < 2) {
    return <span className="text-xs text-zinc-400">—</span>;
  }

  const W = 56;
  const H = 20;
  const pad = 2;
  const picks = history.map((h) => h.pick);
  const minPick = Math.min(...picks);
  const maxPick = Math.max(...picks);
  const range = maxPick - minPick || 1;

  // Lower ADP pick number = higher on screen (better = visually up)
  const coords = history.map((h, i) => {
    const x = pad + (i / (history.length - 1)) * (W - 2 * pad);
    const y = H - pad - ((maxPick - h.pick) / range) * (H - 2 * pad);
    return { x, y };
  });
  const pointsStr = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  const first = picks[0];
  const last = picks[picks.length - 1];
  const delta = last - first; // negative = ADP improved (earlier pick), positive = declined

  const isRising = delta < -0.5;
  const isFalling = delta > 0.5;
  const strokeColor = isRising ? "#16a34a" : isFalling ? "#dc2626" : "#a1a1aa";
  const textColor = isRising ? "text-emerald-600" : isFalling ? "text-red-600" : "text-zinc-400";
  const sign = delta <= 0 ? "" : "+";
  const deltaLabel = Math.abs(delta) < 0.1 ? "=" : `${sign}${delta.toFixed(1)}`;
  const lastCoord = coords[coords.length - 1];

  const isTrending = Math.abs(delta) >= 10;

  return (
    <div className="flex items-center gap-1.5">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 overflow-visible">
        <polyline
          points={pointsStr}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={lastCoord.x.toFixed(1)} cy={lastCoord.y.toFixed(1)} r="2" fill={strokeColor} />
      </svg>
      {isTrending ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
            isRising
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
              : "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
          )}
        >
          {isRising ? "▲ Hot" : "▼ Cold"}
        </span>
      ) : (
        <span className={cn("text-xs font-medium tabular-nums", textColor)}>{deltaLabel}</span>
      )}
    </div>
  );
}

function RecommendationBadge({ status }: { status: KeeperRecommendation["status"] }) {
  if (status === "Excluded") {
    return (
      <Badge className="border-[#1a3050] bg-[#0a2040] text-[#8fa4b3] dark:border-[#1a3050] dark:bg-[#0a2040] dark:text-[#8fa4b3]">
        {status}
      </Badge>
    );
  }
  const variant = status === "Recommended" ? "success" : "info";
  return <Badge variant={variant}>{status}</Badge>;
}

// ---------------------------------------------------------------------------
// Keeper Value Scatter Plot
// ---------------------------------------------------------------------------

const SCATTER_POS_COLORS: Record<string, string> = {
  QB:  "#f59e0b",
  RB:  "#10b981",
  WR:  "#0ea5e9",
  TE:  "#8b5cf6",
  K:   "#a1a1aa",
  DST: "#a1a1aa",
  DEF: "#a1a1aa",
};

function scatterNiceStep(range: number): number {
  const rough = range / 7;
  const exp = Math.floor(Math.log10(Math.max(rough, 0.1)));
  const base = Math.pow(10, exp);
  for (const mult of [1, 2, 5, 10]) {
    if (range / (base * mult) <= 8) return base * mult;
  }
  return base * 10;
}

function KeeperScatterPlot({ recs }: { recs: KeeperRecommendation[] }) {
  // All hooks must be called unconditionally — early returns come after.
  const { currentUser } = useDashboard();
  const [tooltip, setTooltip] = React.useState<{
    x: number; y: number; rec: KeeperRecommendation;
  } | null>(null);

  const allVisible = React.useMemo(
    () => recs.filter((r) => r.status !== "Excluded" && r.keeperCostRound > 0),
    [recs],
  );

  const allTeams = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const rec of allVisible) {
      const key = rec.teamId ?? rec.team;
      if (!seen.has(key)) seen.set(key, rec.team);
    }
    return Array.from(seen.entries())
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allVisible]);

  const userTeamKey = currentUser?.teamId ?? currentUser?.teamName ?? null;
  const [selectedTeamKeys, setSelectedTeamKeys] = React.useState<Set<string>>(
    () => userTeamKey ? new Set([userTeamKey]) : new Set(allTeams.map((t) => t.key)),
  );

  const visible = React.useMemo(
    () =>
      selectedTeamKeys.size === 0
        ? allVisible
        : allVisible.filter((r) => selectedTeamKeys.has(r.teamId ?? r.team)),
    [allVisible, selectedTeamKeys],
  );

  // Early return only after all hooks have been called.
  if (allVisible.length === 0) return null;

  const toggleTeam = (key: string) =>
    setSelectedTeamKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  const W = 560;
  const H = 300;
  const PAD = { top: 20, right: 24, bottom: 44, left: 52 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const DOT_R = 10; // radius for recommended image circles

  // X: keeper cost round
  const rounds = visible.map((r) => r.keeperCostRound);
  const minRound = Math.max(1, Math.min(...rounds) - 0.6);
  const maxRound = Math.max(...rounds) + 0.6;
  const roundSpan = maxRound - minRound;
  const toX = (r: number) => ((r - minRound) / roundSpan) * plotW;

  // Y: keeper value — nice step targeting ~7 ticks
  const values = visible.map((r) => r.keeperValue);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const valStep = scatterNiceStep(rawMax - rawMin);
  const minVal = Math.floor(rawMin / valStep) * valStep;
  const maxVal = Math.ceil(rawMax / valStep) * valStep;
  const valSpan = maxVal - minVal || 1;
  const toY = (v: number) => plotH - ((v - minVal) / valSpan) * plotH;

  const roundTicks = Array.from(new Set(rounds.map((r) => Math.round(r)))).sort((a, b) => a - b);
  const xLabelStride = roundTicks.length > 10 ? 2 : 1;
  const valTicks: number[] = [];
  for (let v = minVal; v <= maxVal + valStep * 0.01; v += valStep) valTicks.push(Math.round(v));

  const zeroY = toY(0);
  const eligible = visible.filter((r) => r.status === "Eligible");
  const recommended = visible.filter((r) => r.status === "Recommended");

  const shortName = (player: string) => {
    const parts = player.trim().split(" ");
    const last = parts[parts.length - 1] ?? player;
    return last.length > 12 ? last.slice(0, 11) + "…" : last;
  };

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
        {(["QB", "RB", "WR", "TE", "K"] as const).map((pos) => (
          <span key={pos} className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-full" style={{ background: SCATTER_POS_COLORS[pos] }} />
            {pos}
          </span>
        ))}
        <span className="flex items-center gap-1 text-zinc-400">
          <span className="inline-block size-2.5 rounded-full border border-zinc-400" />
          Eligible
        </span>
      </div>

      {/* Chart + team selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        {/* Chart — full-width on mobile, 60% on sm+ */}
        <div className="relative w-full sm:w-[60%] sm:shrink-0">
          <svg
            width="100%"
          viewBox={`0 0 ${W} ${H}`}
          className="overflow-visible"
          onMouseLeave={() => setTooltip(null)}
          onClick={() => setTooltip(null)}
        >
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {/* clipPaths defined inside the transform group so coordinates match */}
            <defs>
              {recommended.map((rec, i) => (
                <clipPath key={i} id={`scat-clip-${i}`}>
                  <circle cx={toX(rec.keeperCostRound)} cy={toY(rec.keeperValue)} r={DOT_R} />
                </clipPath>
              ))}
            </defs>
            {/* Keep zone: full width above the zero line = positive value */}
            {zeroY > 0 && (
              <rect
                x={0} y={0}
                width={plotW}
                height={Math.min(zeroY, plotH)}
                fill="#10b981" fillOpacity={0.06}
              />
            )}

            {/* Zero-value dashed guide */}
            {zeroY >= 0 && zeroY <= plotH && (
              <line x1={0} y1={zeroY} x2={plotW} y2={zeroY}
                stroke="#d4d4d8" strokeWidth="1" strokeDasharray="4 3" />
            )}

            {/* Vertical round guides */}
            {roundTicks.map((r) => (
              <line key={r} x1={toX(r)} y1={0} x2={toX(r)} y2={plotH}
                stroke="#f4f4f5" strokeWidth="1" />
            ))}

            {/* Axes */}
            <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="#d4d4d8" strokeWidth="1" />
            <line x1={0} y1={0} x2={0} y2={plotH} stroke="#d4d4d8" strokeWidth="1" />

            {/* X-axis round labels */}
            {roundTicks.map((r, i) => (
              <g key={r} transform={`translate(${toX(r)},${plotH})`}>
                <line y2={4} stroke="#d4d4d8" strokeWidth="1" />
                {i % xLabelStride === 0 && (
                  <text y={15} textAnchor="middle" fontSize={10} fill="#a1a1aa">{r}</text>
                )}
              </g>
            ))}

            {/* Y-axis value ticks */}
            {valTicks.map((v) => (
              <text key={v} x={-8} y={toY(v) + 3.5} textAnchor="end" fontSize={10} fill="#a1a1aa">
                {v > 0 ? `+${v}` : v}
              </text>
            ))}

            {/* Axis labels */}
            <text x={plotW / 2} y={plotH + 38} textAnchor="middle" fontSize={11} fill="#71717a">
              Keeper Cost (round forfeited)
            </text>
            <text x={-plotH / 2} y={-40} textAnchor="middle" fontSize={11} fill="#71717a"
              transform="rotate(-90)">
              Value (rounds saved)
            </text>

            {/* Keep zone label — top-left */}
            <text x={6} y={13} fontSize={8} fill="#10b981" fillOpacity={0.7} fontWeight="700"
              letterSpacing="0.04em">
              KEEP ZONE
            </text>

            {/* Eligible dots — hollow rings, rendered under recommended */}
            {eligible.map((rec, i) => {
              const cx = toX(rec.keeperCostRound);
              const cy = toY(rec.keeperValue);
              const stroke = SCATTER_POS_COLORS[rec.position] ?? "#a1a1aa";
              const handleDotEvent = (e: React.MouseEvent | React.TouchEvent) => {
                const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement;
                const rect = svgEl.getBoundingClientRect();
                const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
                const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
                e.stopPropagation();
                setTooltip({ x: clientX - rect.left, y: clientY - rect.top, rec });
              };
              return (
                <circle key={`e-${i}`} cx={cx} cy={cy} r={6}
                  fill="transparent" stroke={stroke} strokeWidth={1.5}
                  className="cursor-pointer"
                  onMouseEnter={handleDotEvent}
                  onClick={handleDotEvent}
                />
              );
            })}

            {/* Recommended: image clipped to circle + position-color border + name label */}
            {recommended.map((rec, i) => {
              const cx = toX(rec.keeperCostRound);
              const cy = toY(rec.keeperValue);
              const posColor = SCATTER_POS_COLORS[rec.position] ?? "#a1a1aa";
              const name = shortName(rec.player);
              const isDst = rec.position === "DST" || rec.position === "DEF";
              const resolvedTeam = rec.nflTeam || (isDst ? (DST_NAME_TO_ABBR[rec.player] ?? null) : null);
              const dotImageUrl =
                isDst && resolvedTeam
                  ? `https://a.espncdn.com/i/teamlogos/nfl/500/${resolvedTeam.toLowerCase()}.png`
                  : rec.imageUrl;
              const handleDotEvent = (e: React.MouseEvent | React.TouchEvent) => {
                const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement;
                const rect = svgEl.getBoundingClientRect();
                const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
                const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
                e.stopPropagation();
                setTooltip({ x: clientX - rect.left, y: clientY - rect.top, rec });
              };
              return (
                <g key={`r-${i}`} className="cursor-pointer" onMouseEnter={handleDotEvent} onClick={handleDotEvent}>
                  {/* White backing so image has a clean base */}
                  <circle cx={cx} cy={cy} r={DOT_R} fill="white" />
                  {dotImageUrl ? (
                    <image
                      href={dotImageUrl}
                      x={cx - DOT_R} y={cy - DOT_R}
                      width={DOT_R * 2} height={DOT_R * 2}
                      clipPath={`url(#scat-clip-${i})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  ) : (
                    <circle cx={cx} cy={cy} r={DOT_R} fill={posColor} fillOpacity={0.18} />
                  )}
                  {/* Position-color border on top of image */}
                  <circle cx={cx} cy={cy} r={DOT_R}
                    fill="none" stroke={posColor} strokeWidth={2} />
                  {/* Name label above */}
                  <text
                    x={cx} y={cy - DOT_R - 4}
                    textAnchor="middle" fontSize={8.5} fontWeight="600"
                    fill={posColor} stroke="white" strokeWidth={3} paintOrder="stroke"
                  >
                    {name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

          {tooltip && (
            <div
              className="pointer-events-none absolute z-20 min-w-[148px] rounded-md border border-zinc-200 bg-white px-3 py-2 shadow-lg text-xs dark:border-zinc-700 dark:bg-zinc-900"
              style={
                tooltip.x > W * 0.55
                  ? { right: 0, top: tooltip.y - 10 }
                  : { left: tooltip.x + 12, top: tooltip.y - 10 }
              }
            >
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">{tooltip.rec.player}</p>
              <p className="text-zinc-500">{tooltip.rec.position} · {tooltip.rec.team}</p>
              <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                Cost <strong>Rd {tooltip.rec.keeperCostRound}</strong>
              </p>
              <p className="text-zinc-700 dark:text-zinc-300">
                ADP <strong>Pick {tooltip.rec.adpPick}</strong>
              </p>
              <p className="text-zinc-700 dark:text-zinc-300">
                Value{" "}
                <strong className={tooltip.rec.keeperValue > 0 ? "text-emerald-600" : "text-rose-500"}>
                  {tooltip.rec.keeperValue > 0 ? "+" : ""}{tooltip.rec.keeperValue} rds
                </strong>
              </p>
            </div>
          )}
        </div>

        {/* Team selector */}
        <div className="flex min-w-0 flex-col sm:flex-1">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Teams
            </p>
            <div className="flex gap-2 text-[11px] text-zinc-400">
              <button
                onClick={() => setSelectedTeamKeys(new Set(allTeams.map((t) => t.key)))}
                className="hover:text-zinc-600 dark:hover:text-zinc-200"
                type="button"
              >
                All
              </button>
              <span className="text-zinc-200 dark:text-zinc-600">|</span>
              {userTeamKey && (
                <button
                  onClick={() => setSelectedTeamKeys(new Set([userTeamKey]))}
                  className="hover:text-zinc-600 dark:hover:text-zinc-200"
                  type="button"
                >
                  My Team
                </button>
              )}
            </div>
          </div>
          {/* Mobile: wrap chips; Desktop: scrollable vertical list */}
          <div className="flex flex-wrap gap-1.5 sm:block sm:max-h-[220px] sm:overflow-y-auto sm:space-y-px sm:pr-1">
            {allTeams.map(({ key, name }) => {
              const isUserTeam = key === userTeamKey;
              const isChecked = selectedTeamKeys.size === 0 || selectedTeamKeys.has(key);
              return (
                <label
                  key={key}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs transition-colors sm:w-full sm:rounded sm:border-0 sm:px-2 sm:py-2 sm:text-sm",
                    isChecked
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200 sm:border-0 sm:bg-zinc-50 sm:text-zinc-900 sm:dark:bg-zinc-800 sm:dark:text-zinc-100"
                      : "border-zinc-200 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500 sm:border-0 sm:hover:bg-zinc-50 sm:dark:hover:bg-zinc-800",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleTeam(key)}
                    className="hidden accent-[#FFB340] sm:block"
                  />
                  {isUserTeam && (
                    <span className="size-1.5 shrink-0 rounded-full bg-[#FFB340]" />
                  )}
                  <span className={cn("truncate", isUserTeam && "font-semibold")}>
                    {name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Commissioner Tools Page (3.2)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// News Impact (4.1)
// ---------------------------------------------------------------------------

/**
 * Compact strip for the home dashboard — shows affected player names only.
 * Zero-footprint when there are no alerts or the fetch fails.
 */
function NewsImpactSummary({ leagueId }: { leagueId: string | null }) {
  const [alerts, setAlerts] = React.useState<NewsAlert[]>([]);

  React.useEffect(() => {
    if (!leagueId) return;
    getNewsAlerts(leagueId)
      .then(setAlerts)
      .catch(() => {/* non-critical */});
  }, [leagueId]);

  if (alerts.length === 0) return null;

  // Deduplicate by player so one player with multiple headlines shows once
  const uniquePlayers = Array.from(
    new Map(alerts.map((a) => [a.playerId, a])).values(),
  );

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-zinc-100">
        <Zap className="size-3.5 shrink-0 dark:text-amber-400" aria-hidden="true" />
        {uniquePlayers.length} keeper candidate{uniquePlayers.length !== 1 ? "s" : ""} in today&apos;s news
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {uniquePlayers.map((a) => (
          <span
            key={a.playerId}
            className={cn(
              "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
              a.isRecommended
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-zinc-100 text-zinc-600",
            )}
          >
            {a.playerName}
            <span className="ml-1 font-normal opacity-70">{a.position}</span>
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-amber-700 dark:text-zinc-400">
        Open Recommendations to see keeper value impact and flip rounds.
      </p>
    </div>
  );
}

/**
 * Full panel for the Recommendations page — expandable table with flip rounds
 * and headline links.
 */
function NewsImpactPanel({ leagueId }: { leagueId: string | null }) {
  const [alerts, setAlerts] = React.useState<NewsAlert[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!leagueId) return;
    setLoading(true);
    getNewsAlerts(leagueId)
      .then((data) => {
        setAlerts(data);
        if (data.length > 0) setExpanded(true);
      })
      .catch(() => {/* silently skip — news impact is non-critical */})
      .finally(() => setLoading(false));
  }, [leagueId]);

  if (loading || alerts.length === 0) return null;

  const metallicFrame: React.CSSProperties = {
    backgroundImage: "url('/metallic_background.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  return (
    <div className="rounded-md overflow-hidden" style={metallicFrame}>
      {/* Header sits directly on metallic surface */}
      <button
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        type="button"
      >
        <Zap className="size-4 shrink-0 text-[#C5A07A]" aria-hidden="true" />
        <span className="text-sm font-semibold text-[#0C132C]">
          {alerts.length} keeper candidate{alerts.length !== 1 ? "s" : ""} in today&apos;s news
        </span>
        <span className="ml-auto text-xs text-[#1C4D93]">{expanded ? "Hide" : "Show"}</span>
      </button>

      {expanded && (
        /* Content area: dark translucent overlay for table legibility */
        <div
          className="border-t border-[#C5A07A]/40 px-4 pb-4 pt-2"
          style={{ backgroundColor: "rgba(7, 18, 41, 0.93)" }}
        >
          <div className="overflow-x-auto rounded border border-[#C5A07A]/30">
            <table className="w-full text-sm">
              {/* Table header uses metallic surface */}
              <thead>
                <tr style={metallicFrame}>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#0C132C]">Player</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#0C132C]">Team</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-[#0C132C]">Status</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-[#0C132C]">Value</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-[#0C132C]">Flips at Rd</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#0C132C]">Headline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2a4a]">
                {alerts.map((alert, i) => (
                  <tr key={i} className="bg-[#071829]">
                    <td className="px-3 py-2 font-medium text-[#EBF4F9]">
                      {alert.playerName}
                      <span className="ml-1 text-xs text-[#8fa4b3]">
                        {alert.position}{alert.nflTeam ? ` · ${alert.nflTeam}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[#BDC8D3]">{alert.teamName}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
                          alert.isRecommended
                            ? "bg-emerald-900/40 text-emerald-300"
                            : "bg-[#0C132C] text-[#8fa4b3]",
                        )}
                      >
                        {alert.isRecommended ? "Keep" : "Pass"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {alert.currentKeeperValue != null ? (
                        <span
                          className={cn(
                            "font-medium",
                            alert.currentKeeperValue > 0 ? "text-emerald-400" : "text-[#8fa4b3]",
                          )}
                        >
                          {alert.currentKeeperValue > 0 ? "+" : ""}
                          {alert.currentKeeperValue}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-[#C7EEFF]">
                      {alert.flipAdpRound != null ? (
                        <span title="ADP round at which recommendation eligibility flips">
                          Rd {alert.flipAdpRound % 1 === 0 ? alert.flipAdpRound : alert.flipAdpRound.toFixed(1)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-xs px-3 py-2">
                      <a
                        href={alert.headlineLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#C5A07A] hover:underline"
                      >
                        {alert.headline}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-[#8fa4b3]">
            &quot;Flips at Rd&quot; is the ADP round at which a player crosses the keeper value threshold — news shifting ADP beyond that point would change their recommendation.
          </p>
        </div>
      )}
    </div>
  );
}

const CT_SECTIONS = [
  {
    id: "ct-league-setup",
    icon: SlidersHorizontal,
    label: "League Setup",
    description: "League basics, roster rules, key dates, and membership.",
  },
  {
    id: "ct-data-imports",
    icon: Download,
    label: "Data Imports",
    description: "Import historical draft data and rosters from external platforms or CSV.",
  },
  {
    id: "ct-keeper-rules",
    icon: ShieldCheck,
    label: "Keeper Rules & Compliance",
    description: "Tenure limits, consecutive-season records, and keeper eligibility checks.",
  },
  {
    id: "ct-season-actions",
    icon: CalendarDays,
    label: "Season Actions",
    description: "Publish keeper reveals, send reminder emails, and export league data.",
  },
  {
    id: "ct-danger-zone",
    icon: Trash2,
    label: "Danger Zone",
    description: "Irreversible actions that affect the entire league.",
  },
] as const;

function CommissionerTOC() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Contents</CardTitle>
      </CardHeader>
      <CardContent>
        <nav className="flex flex-wrap gap-2">
          {CT_SECTIONS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-600 dark:hover:bg-emerald-950 dark:hover:text-emerald-300"
              onClick={() => scrollTo(id)}
              type="button"
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
      </CardContent>
    </Card>
  );
}

function CommissionerSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5 scroll-mt-6" id={id}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{title}</h2>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function CommissionerToolsPage({
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
  const { activeLeagueId, data, refreshData } = useDashboard();
  const league = data.league;

  return (
    <div className="space-y-10">
      <CommissionerTOC />

      <CommissionerSection
        id="ct-league-setup"
        icon={SlidersHorizontal}
        title="League Setup"
        description="League basics, roster rules, key dates, and membership."
      >
        <LeagueManagementPanel />
        <DraftFormatPanel />
        <LeagueRosterSettingsPanel />
        <CommissionerDatesPanel league={league} leagueId={activeLeagueId} refreshData={refreshData} />
        <LeagueMembersPanel />
        <InviteUserPanel leagueId={activeLeagueId} />
      </CommissionerSection>

      <CommissionerSection
        id="ct-data-imports"
        icon={Download}
        title="Data Imports"
        description="Import historical draft data and rosters from external platforms or CSV."
      >
        <AdminDataImports
          draftCsvText={draftCsvText}
          rosterCsvText={rosterCsvText}
          setDraftCsvText={setDraftCsvText}
          setRosterCsvText={setRosterCsvText}
        />
      </CommissionerSection>

      <CommissionerSection
        id="ct-keeper-rules"
        icon={ShieldCheck}
        title="Keeper Rules & Compliance"
        description="Tenure limits, consecutive-season records, and keeper eligibility checks."
      >
        <KeeperRulesPanel />
        <KeeperTenurePanel />
        <ComplianceCheckerPanel leagueId={activeLeagueId} />
      </CommissionerSection>

      <CommissionerSection
        id="ct-season-actions"
        icon={CalendarDays}
        title="Season Actions"
        description="Publish keeper reveals, send reminder emails, message your league, and export league data."
      >
        <KeeperRevealPanel leagueId={activeLeagueId} league={league} />
        <ReminderEmailPanel leagueId={activeLeagueId} league={league} />
        <CommissionerEmailPanel leagueId={activeLeagueId} league={league} />
        <BulkExportPanel leagueId={activeLeagueId} league={league} />
      </CommissionerSection>

      <CommissionerSection
        id="ct-danger-zone"
        icon={Trash2}
        title="Danger Zone"
        description="Irreversible actions that affect the entire league."
      >
        <DeleteLeaguePanel />
      </CommissionerSection>
    </div>
  );
}

function CommissionerDatesPanel({
  league,
  leagueId,
  refreshData,
}: {
  league: WorkspaceData["league"];
  leagueId: string | null;
  refreshData: (leagueId?: string) => Promise<void>;
}) {
  const [keeperPickDeadline, setKeeperPickDeadline] = React.useState(league?.keeperPickDeadline ?? "");
  const [adpLockDate, setAdpLockDate] = React.useState(league?.adpLockDate ?? "");
  const [regularSeasonStartDate, setRegularSeasonStartDate] = React.useState(
    league?.regularSeasonStartDate ?? defaultRegularSeasonStartDate(league?.seasonYear),
  );
  const [draftDate, setDraftDate] = React.useState(league?.draftDate ?? "");
  const [revealDate, setRevealDate] = React.useState(league?.keeperRevealDate ?? "");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setKeeperPickDeadline(league?.keeperPickDeadline ?? "");
    setAdpLockDate(league?.adpLockDate ?? "");
    setRegularSeasonStartDate(
      league?.regularSeasonStartDate ?? defaultRegularSeasonStartDate(league?.seasonYear),
    );
    setDraftDate(league?.draftDate ?? "");
    setRevealDate(league?.keeperRevealDate ?? "");
  }, [
    league?.keeperPickDeadline,
    league?.adpLockDate,
    league?.regularSeasonStartDate,
    league?.seasonYear,
    league?.draftDate,
    league?.keeperRevealDate,
  ]);

  const handleKeeperDeadlineChange = (value: string) => {
    setKeeperPickDeadline(value);
    // Auto-fill ADP lock date to 7 days before keeper deadline when it hasn't been set
    if (value && !adpLockDate) {
      const deadline = new Date(value + "T00:00:00");
      deadline.setDate(deadline.getDate() - 7);
      setAdpLockDate(deadline.toISOString().slice(0, 10));
    }
  };

  const handleSave = async () => {
    if (!leagueId) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await updateLeagueCalendarSettings(leagueId, { keeperPickDeadline, adpLockDate, regularSeasonStartDate });
      await updateCommissionerSettings(leagueId, { draftDate, keeperRevealDate: revealDate });
      await refreshData(leagueId);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save league dates.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PagePanel
      title="League Dates"
      description="Set all key dates for this season. Keeper deadline and season start appear as countdowns in the header."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="keeper-pick-deadline">Keeper Pick Deadline</Label>
          <Input
            id="keeper-pick-deadline"
            type="date"
            value={keeperPickDeadline}
            onChange={(e) => handleKeeperDeadlineChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="adp-lock-date">ADP Lock Date</Label>
          <Input
            id="adp-lock-date"
            type="date"
            value={adpLockDate}
            onChange={(e) => setAdpLockDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="draft-date">Draft Date</Label>
          <Input
            id="draft-date"
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="reveal-date">Keeper Reveal Date</Label>
          <Input
            id="reveal-date"
            type="date"
            value={revealDate}
            onChange={(e) => setRevealDate(e.target.value)}
          />
          <p className="text-xs text-zinc-500">
            On this date all teams&apos; keepers become visible league-wide.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="regular-season-start-date">Regular Season Start</Label>
          <Input
            id="regular-season-start-date"
            type="date"
            value={regularSeasonStartDate}
            onChange={(e) => setRegularSeasonStartDate(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {saved && <p className="mt-2 text-sm text-emerald-600">Saved.</p>}
      <div className="mt-4">
        <Button onClick={handleSave} disabled={saving || !leagueId}>
          {saving ? "Saving…" : "Save Dates"}
        </Button>
      </div>
    </PagePanel>
  );
}

function ComplianceCheckerPanel({ leagueId }: { leagueId: string | null }) {
  const [result, setResult] = React.useState<ComplianceResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const runCheck = React.useCallback(() => {
    if (!leagueId) return;
    setLoading(true);
    setError("");
    getComplianceReport(leagueId)
      .then(setResult)
      .catch(() => setError("Could not run compliance check. Run the optimizer first."))
      .finally(() => setLoading(false));
  }, [leagueId]);

  React.useEffect(() => {
    runCheck();
  }, [runCheck]);

  const allPassBadge = result?.allPass ? (
    <Badge variant="success">All Teams Pass</Badge>
  ) : (
    <Badge variant="danger">Compliance Issues Found</Badge>
  );

  return (
    <PagePanel
      title="Keeper Rule Compliance"
      description="Per-team pass/fail check against max keepers, position limits, and cost validity."
      action={
        <Button variant="outline" size="sm" onClick={runCheck} disabled={loading}>
          <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      }
    >
      {loading && <p className="text-sm text-zinc-500">Checking…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && !loading && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">{allPassBadge}</div>
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase text-zinc-600">
                <tr>
                  <th className="px-3 py-2 text-left">Team</th>
                  <th className="px-3 py-2 text-center">Keepers</th>
                  <th className="px-3 py-2 text-center">Max Keepers</th>
                  <th className="px-3 py-2 text-center">Per Position</th>
                  <th className="px-3 py-2 text-center">QB Limit</th>
                  <th className="px-3 py-2 text-center">Cost Valid</th>
                  <th className="px-3 py-2 text-center">Overall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {result.teams.map((team) => (
                  <tr key={team.teamId} className={cn(!team.passes && "bg-red-50")}>
                    <td className="px-3 py-2 font-medium">{team.teamName}</td>
                    <td className="px-3 py-2 text-center">
                      {team.keeperCount}/{team.maxKeepersAllowed}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ComplianceBadge pass={team.maxKeepersPass} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ComplianceBadge pass={team.maxPerPositionPass} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ComplianceBadge pass={team.maxQbPass} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ComplianceBadge pass={team.costValidityPass} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ComplianceBadge pass={team.passes} bold />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.teams.some((t) => t.invalidCostPlayers.length > 0) && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <strong>Invalid costs:</strong>{" "}
              {result.teams
                .flatMap((t) => t.invalidCostPlayers.map((p) => `${t.teamName}: ${p}`))
                .join("; ")}
            </div>
          )}
        </div>
      )}
    </PagePanel>
  );
}

function ComplianceBadge({ pass, bold }: { pass: boolean; bold?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs",
        pass ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800",
        bold && "font-semibold",
      )}
    >
      {pass ? "Pass" : "Fail"}
    </span>
  );
}

function KeeperRevealPanel({
  leagueId,
  league,
}: {
  leagueId: string | null;
  league: WorkspaceData["league"];
}) {
  const [reveal, setReveal] = React.useState<KeeperRevealResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!leagueId) return;
    setLoading(true);
    getKeeperReveal(leagueId)
      .then(setReveal)
      .catch(() => setError("Could not load keeper reveal data."))
      .finally(() => setLoading(false));
  }, [leagueId]);

  const revealDateStr = league?.keeperRevealDate
    ? new Date(league.keeperRevealDate + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <PagePanel
      title="Keeper Reveal"
      description="Control when all teams' keeper selections become visible to each other."
    >
      <div className="space-y-4">
        {revealDateStr ? (
          <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800">
            <strong>Reveal date set:</strong> {revealDateStr}
            {reveal?.revealed && (
              <span className="ml-2 font-semibold text-emerald-700">(Revealed)</span>
            )}
            {!reveal?.revealed && (
              <span className="ml-2 text-zinc-500">(Not yet revealed)</span>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            No reveal date set. Set one in League Dates above to enable the reveal feature.
          </p>
        )}

        {loading && <p className="text-sm text-zinc-500">Loading reveal preview…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {reveal && !loading && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-700">
              {reveal.revealed
                ? "All keeper selections are now public."
                : "Before the reveal date, each team only sees their own keepers. Preview:"}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {reveal.teams.map((team) => (
                <div
                  key={team.teamId}
                  className={cn(
                    "rounded-md border p-3 text-sm",
                    team.hidden ? "border-zinc-200 bg-zinc-50" : "border-emerald-200 bg-emerald-50",
                  )}
                >
                  <div className="font-semibold text-zinc-900">{team.teamName}</div>
                  {team.hidden ? (
                    <div className="mt-1 text-xs text-zinc-400 italic">Hidden until reveal</div>
                  ) : team.keepers.length === 0 ? (
                    <div className="mt-1 text-xs text-zinc-400">No keepers finalized</div>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {team.keepers.map((k) => (
                        <li key={k.playerId} className="text-xs text-zinc-700">
                          {k.playerName}
                          {k.position && (
                            <span className="ml-1 text-zinc-400">({k.position})</span>
                          )}
                          {k.keeperCostRound && (
                            <span className="ml-1 text-zinc-400">R{k.keeperCostRound}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PagePanel>
  );
}

function InviteUserPanel({ leagueId }: { leagueId: string | null }) {
  const [email, setEmail] = React.useState("");
  const [ownerAlias, setOwnerAlias] = React.useState("");
  const [showAlias, setShowAlias] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [result, setResult] = React.useState<{ status: string; emailQueued: boolean; messageSent: boolean } | null>(null);
  const [error, setError] = React.useState("");

  const handleSend = async () => {
    if (!leagueId) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email address is required.");
      return;
    }
    setSending(true);
    setError("");
    setResult(null);
    try {
      const res = await sendLeagueInvite(leagueId, trimmedEmail, ownerAlias.trim() || undefined);
      if (res.status === "new_user" && !ownerAlias.trim()) {
        setShowAlias(true);
        setError("This email isn't registered yet. Enter an owner alias to address them in the invite email, then send again.");
        setSending(false);
        return;
      }
      setResult(res);
      setEmail("");
      setOwnerAlias("");
      setShowAlias(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send invite.");
    } finally {
      setSending(false);
    }
  };

  return (
    <PagePanel title="Invite Member" description="Send a league invite via email and in-app message.">
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setResult(null); setError(""); setShowAlias(false); setOwnerAlias(""); }}
            placeholder="owner@example.com"
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        {showAlias && (
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">
              Owner Alias
            </label>
            <input
              type="text"
              value={ownerAlias}
              onChange={(e) => setOwnerAlias(e.target.value)}
              placeholder="e.g. Big Mike"
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-zinc-500">
              How this person will be addressed in the invite email.
            </p>
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        {result && (
          <div className="rounded border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-400 space-y-0.5">
            {result.status === "existing_user" ? (
              <>
                <p className="font-semibold">Invite sent to existing member.</p>
                {result.emailQueued && <p>Email invite queued.</p>}
                {result.messageSent && <p>In-app message delivered.</p>}
              </>
            ) : (
              <>
                <p className="font-semibold">Invite sent to new user.</p>
                {result.emailQueued && <p>Registration invite email queued.</p>}
              </>
            )}
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={sending || !email.trim()}
          className="rounded bg-amber-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-black hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? "Sending…" : "Send Invite"}
        </button>
      </div>
    </PagePanel>
  );
}

const EMAIL_SCHEDULE_LABELS: Record<string, string> = {
  none: "No schedule (manual only)",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

function ReminderEmailPanel({
  leagueId,
  league,
}: {
  leagueId: string | null;
  league: WorkspaceData["league"];
}) {
  const [smtpStatus, setSmtpStatus] = React.useState<SmtpStatus | null>(null);
  const [emailSettings, setEmailSettings] = React.useState<EmailSettings | null>(null);
  const [members, setMembers] = React.useState<LeagueMembership[]>([]);
  const [memberSaving, setMemberSaving] = React.useState<Record<string, boolean>>({});
  const [settingsSaving, setSettingsSaving] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [dryRunResult, setDryRunResult] = React.useState<string[] | null>(null);
  const [sentCount, setSentCount] = React.useState<number | null>(null);
  const [error, setError] = React.useState("");
  const [settingsError, setSettingsError] = React.useState("");

  React.useEffect(() => {
    if (!leagueId) return;
    getSmtpStatus(leagueId)
      .then(setSmtpStatus)
      .catch(() => {/* smtp status is optional */});
    getEmailSettings(leagueId)
      .then(setEmailSettings)
      .catch(() => {/* settings optional */});
    getLeagueMemberships(leagueId)
      .then(setMembers)
      .catch(() => {});
  }, [leagueId]);

  const handleSettingChange = async (patch: Partial<{ emailEnabled: boolean; emailSchedule: string }>) => {
    if (!leagueId || !emailSettings) return;
    setSettingsSaving(true);
    setSettingsError("");
    try {
      const updated = await updateEmailSettings(leagueId, patch);
      setEmailSettings(updated);
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : "Failed to save email settings.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleDryRun = async () => {
    if (!leagueId) return;
    setSending(true);
    setError("");
    setDryRunResult(null);
    setSentCount(null);
    try {
      const result = await sendKeeperReminders(leagueId, true);
      setDryRunResult(result.recipients);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to preview recipients.");
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (!leagueId) return;
    setSending(true);
    setError("");
    setDryRunResult(null);
    setSentCount(null);
    try {
      const result = await sendKeeperReminders(leagueId, false);
      if (result.queued) {
        setSentCount(-1); // sentinel for "queued" state
        if (emailSettings) {
          setEmailSettings({ ...emailSettings, emailLastSent: new Date().toISOString() });
        }
      } else {
        setSentCount(result.sent);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send reminders.");
    } finally {
      setSending(false);
    }
  };

  const deadlineStr = league?.keeperPickDeadline
    ? new Date(league.keeperPickDeadline + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const lastSentStr = emailSettings?.emailLastSent
    ? new Date(emailSettings.emailLastSent).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Never";

  return (
    <PagePanel
      title="Keeper Deadline Reminders"
      description="Send personalized reminder emails with player news and AI strategy to league members."
    >
      <div className="space-y-5">
        {/* Deadline status */}
        {deadlineStr ? (
          <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            Deadline: <strong>{deadlineStr}</strong>
          </div>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No keeper deadline set. Add one in League Dates above first.
          </div>
        )}

        {/* SMTP status */}
        {smtpStatus !== null && (
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "inline-block size-2 rounded-full",
                smtpStatus.configured ? "bg-[#FFB340]" : "bg-zinc-400",
              )}
            />
            <span className={smtpStatus.configured ? "text-zinc-700" : "text-zinc-500"}>
              {smtpStatus.configured
                ? `SMTP configured (${smtpStatus.host}:${smtpStatus.port})`
                : "SMTP not configured — set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD env vars"}
            </span>
          </div>
        )}

        {/* Email Settings */}
        {emailSettings && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-4">
            <p className="text-sm font-semibold text-zinc-800">Email Schedule Settings</p>

            {/* Enabled toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-700">Automatic emails enabled</p>
                <p className="text-xs text-zinc-500">Allow scheduled sends based on the frequency below</p>
              </div>
              <button
                aria-pressed={emailSettings.emailEnabled}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none",
                  emailSettings.emailEnabled ? "bg-violet-600" : "bg-zinc-300",
                  settingsSaving && "opacity-50 pointer-events-none",
                )}
                onClick={() => void handleSettingChange({ emailEnabled: !emailSettings.emailEnabled })}
                type="button"
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block size-5 rounded-full bg-white shadow transform transition-transform",
                    emailSettings.emailEnabled ? "translate-x-5" : "translate-x-0",
                  )}
                />
              </button>
            </div>

            {/* Schedule frequency */}
            <div className="space-y-1.5">
              <Label className="text-sm text-zinc-700">Send frequency</Label>
              <select
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                disabled={settingsSaving}
                onChange={(e) => void handleSettingChange({ emailSchedule: e.target.value })}
                value={emailSettings.emailSchedule}
              >
                {Object.entries(EMAIL_SCHEDULE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Last sent */}
            <p className="text-xs text-zinc-400">Last sent: {lastSentStr}</p>
            {settingsError && <p className="text-sm text-red-600">{settingsError}</p>}
          </div>
        )}

        {/* Per-member email preferences */}
        {members.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-zinc-800">Member Email Preferences</p>
            <div className="rounded-lg border border-zinc-200 overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_80px_80px] gap-2 bg-zinc-50 px-3 py-2 border-b border-zinc-200">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Member</span>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide text-center">Opt In</span>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide text-center">Opt Out</span>
              </div>
              {/* Rows */}
              {members.map((m) => (
                <div key={m.id} className="grid grid-cols-[1fr_80px_80px] gap-2 items-center px-3 py-2.5 border-b border-zinc-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-zinc-800">{m.alias ?? m.email}</p>
                    {m.alias && <p className="text-xs text-zinc-400">{m.email}</p>}
                  </div>
                  <div className="flex justify-center">
                    <input
                      checked={!m.emailOptOut}
                      className="size-4 accent-violet-600 cursor-pointer disabled:cursor-not-allowed"
                      disabled={memberSaving[m.id]}
                      onChange={async () => {
                        if (!leagueId || m.emailOptOut === false) return;
                        setMemberSaving((s) => ({ ...s, [m.id]: true }));
                        try {
                          const result = await setMemberEmailOptOut(leagueId, m.id, false);
                          setMembers((prev) =>
                            prev.map((mb) => mb.id === m.id ? { ...mb, emailOptOut: result.emailOptOut } : mb)
                          );
                        } catch { /* ignore */ } finally {
                          setMemberSaving((s) => ({ ...s, [m.id]: false }));
                        }
                      }}
                      type="radio"
                      name={`email-pref-${m.id}`}
                    />
                  </div>
                  <div className="flex justify-center">
                    <input
                      checked={m.emailOptOut}
                      className="size-4 accent-violet-600 cursor-pointer disabled:cursor-not-allowed"
                      disabled={memberSaving[m.id]}
                      onChange={async () => {
                        if (!leagueId || m.emailOptOut === true) return;
                        setMemberSaving((s) => ({ ...s, [m.id]: true }));
                        try {
                          const result = await setMemberEmailOptOut(leagueId, m.id, true);
                          setMembers((prev) =>
                            prev.map((mb) => mb.id === m.id ? { ...mb, emailOptOut: result.emailOptOut } : mb)
                          );
                        } catch { /* ignore */ } finally {
                          setMemberSaving((s) => ({ ...s, [m.id]: false }));
                        }
                      }}
                      type="radio"
                      name={`email-pref-${m.id}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual send */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-zinc-800">Manual Send</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {dryRunResult !== null && (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <p className="font-medium text-zinc-700">
                Preview: {dryRunResult.length} recipient(s)
              </p>
              {dryRunResult.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-zinc-600">
                  {dryRunResult.map((emailAddr) => (
                    <li key={emailAddr}>{emailAddr}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {sentCount !== null && (
            <p className="text-sm text-emerald-700 font-medium">
              {sentCount === -1
                ? "Emails are being sent in the background."
                : `Reminders sent to ${sentCount} member(s).`}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDryRun} disabled={sending || !leagueId}>
              Preview Recipients
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !leagueId || !smtpStatus?.configured || !deadlineStr}
            >
              {sending ? "Sending…" : "Send Now"}
            </Button>
          </div>
          {!smtpStatus?.configured && (
            <p className="text-xs text-zinc-400">
              Email sending is disabled until SMTP is configured on the server.
            </p>
          )}
        </div>
      </div>
    </PagePanel>
  );
}

function CommissionerEmailPanel({
  leagueId,
  league,
}: {
  leagueId: string | null;
  league: WorkspaceData["league"];
}) {
  const [members, setMembers] = React.useState<LeagueMembership[]>([]);
  const [smtpStatus, setSmtpStatus] = React.useState<SmtpStatus | null>(null);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!leagueId) return;
    getSmtpStatus(leagueId)
      .then(setSmtpStatus)
      .catch(() => {});
    getLeagueMemberships(leagueId)
      .then((ms) => {
        setMembers(ms);
        setSelectedIds(new Set(ms.map((m) => m.id)));
      })
      .catch(() => {});
  }, [leagueId]);

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAllSelected(false);
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      setAllSelected(false);
    } else {
      setSelectedIds(new Set(members.map((m) => m.id)));
      setAllSelected(true);
    }
  };

  React.useEffect(() => {
    setAllSelected(members.length > 0 && selectedIds.size === members.length);
  }, [selectedIds, members]);

  const handleSend = async () => {
    if (!leagueId || !body.trim()) return;
    setSending(true);
    setError("");
    setSent(false);
    try {
      const recipientIds = allSelected ? undefined : Array.from(selectedIds);
      await sendCustomCommissionerEmail(leagueId, body, subject || undefined, recipientIds);
      setSent(true);
      setBody("");
      setSubject("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send email.");
    } finally {
      setSending(false);
    }
  };

  const defaultSubject = league?.name
    ? `A message from your commissioner — ${league.name}`
    : "A message from your commissioner";

  return (
    <PagePanel
      title="Send Message to League"
      description="Compose a custom email to all or selected league members using the same branded template."
    >
      <div className="space-y-5">
        {/* SMTP status */}
        {smtpStatus !== null && (
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "inline-block size-2 rounded-full",
                smtpStatus.configured ? "bg-[#FFB340]" : "bg-zinc-400",
              )}
            />
            <span className={smtpStatus.configured ? "text-zinc-700" : "text-zinc-500"}>
              {smtpStatus.configured
                ? `SMTP configured (${smtpStatus.host}:${smtpStatus.port})`
                : "SMTP not configured — set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD env vars"}
            </span>
          </div>
        )}

        {/* Subject */}
        <div className="space-y-1.5">
          <Label className="text-sm text-zinc-700">Subject</Label>
          <input
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder={defaultSubject}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <p className="text-xs text-zinc-400">Leave blank to use the default subject above.</p>
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <Label className="text-sm text-zinc-700">Message</Label>
          <textarea
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 min-h-[140px] resize-y"
            placeholder="Write your message to the league here…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        {/* Recipients */}
        {members.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-zinc-800">Recipients</p>
            <div className="rounded-lg border border-zinc-200 overflow-hidden">
              {/* Select all row */}
              <label className="flex items-center gap-3 px-3 py-2.5 bg-zinc-50 border-b border-zinc-200 cursor-pointer hover:bg-zinc-100">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="size-4 accent-violet-600 cursor-pointer"
                />
                <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                  All members ({members.length})
                </span>
              </label>
              {members.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-3 px-3 py-2.5 border-b border-zinc-100 last:border-0 cursor-pointer hover:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(m.id)}
                    onChange={() => toggleMember(m.id)}
                    className="size-4 accent-violet-600 cursor-pointer"
                  />
                  <div>
                    <p className="text-sm font-medium text-zinc-800">{m.alias ?? m.email}</p>
                    {m.alias && <p className="text-xs text-zinc-400">{m.email}</p>}
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-zinc-400">
              {selectedIds.size} of {members.length} member(s) selected. Members who have opted out of emails will be skipped automatically.
            </p>
          </div>
        )}

        {/* Feedback */}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {sent && (
          <p className="text-sm text-emerald-700 font-medium">
            Your message is being sent in the background.
          </p>
        )}

        {/* Send button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSend}
            disabled={sending || !leagueId || !body.trim() || selectedIds.size === 0 || !smtpStatus?.configured}
          >
            {sending ? "Sending…" : `Send to ${selectedIds.size} member(s)`}
          </Button>
        </div>
        {!smtpStatus?.configured && (
          <p className="text-xs text-zinc-400">
            Email sending is disabled until SMTP is configured on the server.
          </p>
        )}
      </div>
    </PagePanel>
  );
}

function BulkExportPanel({
  leagueId,
  league,
}: {
  leagueId: string | null;
  league: WorkspaceData["league"];
}) {
  const [downloading, setDownloading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  const handleDownload = async () => {
    if (!leagueId || !league) return;
    setDownloading(true);
    setError("");
    setDone(false);
    try {
      await downloadBulkExport(leagueId, league.name);
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch {
      setError("Failed to generate bulk export. Run the optimizer first to generate recommendations.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <PagePanel
      title="Bulk Export"
      description="Download a single ZIP file containing individual PDFs for every team plus the full Excel workbook."
    >
      <div className="space-y-3">
        <p className="text-sm text-zinc-600">
          The ZIP includes one PDF per team, an all-teams combined PDF, and a multi-sheet Excel
          workbook — ready to share with every team owner before draft day.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {done && <p className="text-sm text-emerald-700 font-medium">Download started.</p>}
        <Button onClick={handleDownload} disabled={downloading || !leagueId}>
          <Download className="mr-1.5 size-4" />
          {downloading ? "Building…" : "Download All Reports (ZIP)"}
        </Button>
      </div>
    </PagePanel>
  );
}
