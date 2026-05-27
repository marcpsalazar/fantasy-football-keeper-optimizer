export type Team = {
  id: string;
  userId?: string;
  name: string;
  owner: string;
  draftSlot: number;
  keepers: number;
  projectedScore: number;
  remainingTop100Picks: number;
};

export type DraftPick = {
  team: string;
  round: number;
  overallPick: number;
  player: string;
  position: string;
  keeperCost: string;
};

export type FinalRosterEntry = {
  team: string;
  player: string;
  position: string;
  rosterStatus: string;
  acquiredVia: string;
};

export type ADPEntry = {
  player: string;
  position: string;
  adpPick: number;
  adpRound: number;
  source: string;
  trend: string;
};

export type KeeperExplanation = {
  short_reason: string;
  value_explanation: string;
  risk_note: string;
  opportunity_cost: string;
  decision: "strong keep" | "lean keep" | "toss-up" | "avoid";
};

export type KeeperRecommendation = {
  id?: string;
  teamId?: string;
  playerId?: string;
  team: string;
  player: string;
  position: string;
  scenario?: string;
  keeperCostPick: number;
  keeperCostRound: number;
  adpPick: number;
  adpRound: number;
  adpSourceNote?: string;
  keeperValue: number;
  keeperScore: number;
  status: "Recommended" | "Eligible" | "Excluded";
  manualOverride?: "auto" | "force_keep" | "exclude";
  reason: string;
  aiExplanation?: KeeperExplanation | null;
};

export type Outlook = {
  teamId?: string;
  team: string;
  scenario?: string;
  stance: string;
  recommendedKeepers: string[];
  lostPicks: string;
  draftCapital: string;
  risk: string;
};

export type ScenarioKeeper = {
  playerId?: string;
  player: string;
  position: string;
  keeperCostPick?: number;
  keeperCostRound?: number;
  keeperValue?: number;
  keeperScore: number;
  reason?: string;
};

export type ScenarioTeamResult = {
  teamId?: string;
  team: string;
  totalKeeperScore: number;
  picksForfeited: string[];
  selectedKeepers: ScenarioKeeper[];
  strategicNotes: string;
};

export type ScenarioComparison = {
  scenarioName: "Pure Value" | "Balanced" | "Superflex Heavy" | "Win Now" | "Rebuild";
  description: string;
  totalKeeperScore: number;
  strategicNotes: string;
  teams: ScenarioTeamResult[];
};

export type ScenarioNarrativeTradeoff = {
  scenario: string;
  benefit: string;
  cost: string;
};

export type ScenarioNarrative = {
  summary: string;
  best_fit: string;
  tradeoffs: ScenarioNarrativeTradeoff[];
  decision_notes: string[];
};

export const teams: Team[] = [
  {
    id: "team-1",
    name: "SWEEP THE LEG JOHNNY",
    owner: "Johnny Lawrence",
    draftSlot: 1,
    keepers: 3,
    projectedScore: 142.6,
    remainingTop100Picks: 6,
  },
  {
    id: "team-2",
    name: "COBRA KAI NEVER DIES",
    owner: "John Kreese",
    draftSlot: 2,
    keepers: 4,
    projectedScore: 156.2,
    remainingTop100Picks: 5,
  },
  {
    id: "team-3",
    name: "MIYAGI DO",
    owner: "Daniel LaRusso",
    draftSlot: 7,
    keepers: 2,
    projectedScore: 119.4,
    remainingTop100Picks: 8,
  },
  {
    id: "team-4",
    name: "EAGLE FANG",
    owner: "Miguel Diaz",
    draftSlot: 11,
    keepers: 1,
    projectedScore: 91.8,
    remainingTop100Picks: 9,
  },
];

export const draftResults: DraftPick[] = [
  {
    team: "SWEEP THE LEG JOHNNY",
    round: 1,
    overallPick: 1,
    player: "Ja'Marr Chase",
    position: "WR",
    keeperCost: "1.01",
  },
  {
    team: "COBRA KAI NEVER DIES",
    round: 2,
    overallPick: 23,
    player: "Bijan Robinson",
    position: "RB",
    keeperCost: "2.11",
  },
  {
    team: "SWEEP THE LEG JOHNNY",
    round: 5,
    overallPick: 49,
    player: "Jalen Hurts",
    position: "QB",
    keeperCost: "5.01",
  },
  {
    team: "MIYAGI DO",
    round: 10,
    overallPick: 114,
    player: "Trey McBride",
    position: "TE",
    keeperCost: "10.06",
  },
  {
    team: "EAGLE FANG",
    round: 12,
    overallPick: 138,
    player: "Rashee Rice",
    position: "WR",
    keeperCost: "12.06",
  },
];

export const finalRosters: FinalRosterEntry[] = [
  {
    team: "SWEEP THE LEG JOHNNY",
    player: "Ja'Marr Chase",
    position: "WR",
    rosterStatus: "Starter",
    acquiredVia: "Drafted",
  },
  {
    team: "SWEEP THE LEG JOHNNY",
    player: "Jalen Hurts",
    position: "QB",
    rosterStatus: "Starter",
    acquiredVia: "Drafted",
  },
  {
    team: "COBRA KAI NEVER DIES",
    player: "Bijan Robinson",
    position: "RB",
    rosterStatus: "Starter",
    acquiredVia: "Drafted",
  },
  {
    team: "MIYAGI DO",
    player: "Trey McBride",
    position: "TE",
    rosterStatus: "Starter",
    acquiredVia: "Trade",
  },
  {
    team: "EAGLE FANG",
    player: "Rashee Rice",
    position: "WR",
    rosterStatus: "Bench",
    acquiredVia: "Waivers",
  },
];

export const adpEntries: ADPEntry[] = [
  {
    player: "Ja'Marr Chase",
    position: "WR",
    adpPick: 5,
    adpRound: 1,
    source: "DraftSharks Superflex",
    trend: "Flat",
  },
  {
    player: "Jalen Hurts",
    position: "QB",
    adpPick: 18,
    adpRound: 2,
    source: "DraftSharks Superflex",
    trend: "Up 3",
  },
  {
    player: "Bijan Robinson",
    position: "RB",
    adpPick: 4,
    adpRound: 1,
    source: "DraftSharks Superflex",
    trend: "Flat",
  },
  {
    player: "Trey McBride",
    position: "TE",
    adpPick: 34,
    adpRound: 3,
    source: "DraftSharks Superflex",
    trend: "Down 2",
  },
  {
    player: "Rashee Rice",
    position: "WR",
    adpPick: 75,
    adpRound: 7,
    source: "DraftSharks Superflex",
    trend: "Up 8",
  },
];

export const keeperRecommendations: KeeperRecommendation[] = [
  {
    team: "SWEEP THE LEG JOHNNY",
    player: "Jalen Hurts",
    position: "QB",
    keeperCostPick: 49,
    keeperCostRound: 5,
    adpPick: 18,
    adpRound: 2,
    keeperValue: 31,
    keeperScore: 75.4,
    status: "Recommended",
    reason: "Superflex QB value",
  },
  {
    team: "COBRA KAI NEVER DIES",
    player: "Bijan Robinson",
    position: "RB",
    keeperCostPick: 23,
    keeperCostRound: 2,
    adpPick: 4,
    adpRound: 1,
    keeperValue: 19,
    keeperScore: 37.2,
    status: "Recommended",
    reason: "Elite anchor",
  },
  {
    team: "MIYAGI DO",
    player: "Trey McBride",
    position: "TE",
    keeperCostPick: 34,
    keeperCostRound: 3,
    adpPick: 34,
    adpRound: 3,
    keeperValue: 0,
    keeperScore: 14.8,
    status: "Eligible",
    reason: "Low opportunity cost",
  },
  {
    team: "EAGLE FANG",
    player: "Rashee Rice",
    position: "WR",
    keeperCostPick: 75,
    keeperCostRound: 7,
    adpPick: 75,
    adpRound: 7,
    keeperValue: 0,
    keeperScore: 8.1,
    status: "Excluded",
    reason: "Below score floor",
  },
  {
    team: "SWEEP THE LEG JOHNNY",
    player: "Ja'Marr Chase",
    position: "WR",
    keeperCostPick: 1,
    keeperCostRound: 1,
    adpPick: 5,
    adpRound: 1,
    keeperValue: -4,
    keeperScore: 12.5,
    status: "Excluded",
    reason: "Premium pick cost",
  },
];

export const outlooks: Outlook[] = [
  {
    team: "SWEEP THE LEG JOHNNY",
    stance: "Aggressive Keep",
    recommendedKeepers: ["Jalen Hurts", "Ja'Marr Chase", "Rashee Rice"],
    lostPicks: "1.01, 5.01, 12.06",
    draftCapital: "Strong middle rounds",
    risk: "This plan gives up a first-round pick, so the keeper quality has to justify the lost early-board flexibility.",
  },
  {
    team: "COBRA KAI NEVER DIES",
    stance: "Aggressive Keep",
    recommendedKeepers: ["Bijan Robinson", "Justin Jefferson", "Breece Hall", "Sam LaPorta"],
    lostPicks: "1.02, 2.11, 4.02, 8.11",
    draftCapital: "Thin top-50 pool",
    risk: "Using four keeper slots narrows the early draft path, so there is less room to fix roster weaknesses later.",
  },
  {
    team: "MIYAGI DO",
    stance: "Flexible Build",
    recommendedKeepers: ["Trey McBride", "Garrett Wilson"],
    lostPicks: "3.07, 10.06",
    draftCapital: "Best top-100 access",
    risk: "The keeper cost is manageable, but the roster still depends on the draft to add impact RB depth.",
  },
];

export const scenarioComparisons: ScenarioComparison[] = [
  {
    scenarioName: "Pure Value",
    description: "Raw keeper value with minimal scarcity or talent bonuses.",
    totalKeeperScore: 136.2,
    strategicNotes: "Best at protecting draft capital and avoiding expensive name-value keepers.",
    teams: [
      {
        team: "SWEEP THE LEG JOHNNY",
        totalKeeperScore: 58.1,
        picksForfeited: ["5.01", "12.06"],
        selectedKeepers: [
          { player: "Jalen Hurts", position: "QB", keeperScore: 43.9 },
          { player: "Rashee Rice", position: "WR", keeperScore: 14.2 },
        ],
        strategicNotes: "Skips Chase at 1.01 and preserves the premium pick.",
      },
      {
        team: "COBRA KAI NEVER DIES",
        totalKeeperScore: 46.7,
        picksForfeited: ["2.11", "8.11"],
        selectedKeepers: [
          { player: "Bijan Robinson", position: "RB", keeperScore: 29.4 },
          { player: "Sam LaPorta", position: "TE", keeperScore: 17.3 },
        ],
        strategicNotes: "Keeps two efficient values and leaves early-round optionality.",
      },
      {
        team: "MIYAGI DO",
        totalKeeperScore: 31.4,
        picksForfeited: ["10.06"],
        selectedKeepers: [{ player: "Trey McBride", position: "TE", keeperScore: 31.4 }],
        strategicNotes: "One clean value keeper; draft volume stays intact.",
      },
      {
        team: "EAGLE FANG",
        totalKeeperScore: 0,
        picksForfeited: [],
        selectedKeepers: [],
        strategicNotes: "No surplus keeper clears the value floor.",
      },
    ],
  },
  {
    scenarioName: "Balanced",
    description: "Default blend of value, talent, starter status, and positional context.",
    totalKeeperScore: 173.7,
    strategicNotes: "Best baseline for comparing player quality against pick cost.",
    teams: [
      {
        team: "SWEEP THE LEG JOHNNY",
        totalKeeperScore: 87.9,
        picksForfeited: ["5.01", "12.06", "1.01"],
        selectedKeepers: [
          { player: "Jalen Hurts", position: "QB", keeperScore: 75.4 },
          { player: "Rashee Rice", position: "WR", keeperScore: 8.1 },
          { player: "Ja'Marr Chase", position: "WR", keeperScore: 4.4 },
        ],
        strategicNotes: "Strong total ceiling, but Chase still burns a premium pick.",
      },
      {
        team: "COBRA KAI NEVER DIES",
        totalKeeperScore: 62.4,
        picksForfeited: ["2.11", "1.02"],
        selectedKeepers: [
          { player: "Bijan Robinson", position: "RB", keeperScore: 37.2 },
          { player: "Justin Jefferson", position: "WR", keeperScore: 25.2 },
        ],
        strategicNotes: "Balanced keeps two elite anchors while avoiding a fourth keeper squeeze.",
      },
      {
        team: "MIYAGI DO",
        totalKeeperScore: 23.4,
        picksForfeited: ["10.06", "3.07"],
        selectedKeepers: [
          { player: "Trey McBride", position: "TE", keeperScore: 14.8 },
          { player: "Garrett Wilson", position: "WR", keeperScore: 8.6 },
        ],
        strategicNotes: "Two keepers without sacrificing much early draft control.",
      },
      {
        team: "EAGLE FANG",
        totalKeeperScore: 0,
        picksForfeited: [],
        selectedKeepers: [],
        strategicNotes: "Wait for the draft pool rather than keeping replacement-level value.",
      },
    ],
  },
  {
    scenarioName: "Superflex Heavy",
    description: "Raises quarterback weight and scarcity bonuses.",
    totalKeeperScore: 191.5,
    strategicNotes: "Best when the room aggressively pushes QB prices.",
    teams: [
      {
        team: "SWEEP THE LEG JOHNNY",
        totalKeeperScore: 104.6,
        picksForfeited: ["5.01", "1.01"],
        selectedKeepers: [
          { player: "Jalen Hurts", position: "QB", keeperScore: 96.1 },
          { player: "Ja'Marr Chase", position: "WR", keeperScore: 8.5 },
        ],
        strategicNotes: "Hurts becomes the clear anchor; still consider skipping Chase if QB runs cool.",
      },
      {
        team: "COBRA KAI NEVER DIES",
        totalKeeperScore: 58.1,
        picksForfeited: ["2.11", "7.02"],
        selectedKeepers: [
          { player: "Bijan Robinson", position: "RB", keeperScore: 35.5 },
          { player: "Jordan Love", position: "QB", keeperScore: 22.6 },
        ],
        strategicNotes: "Adds QB leverage without overcommitting all four slots.",
      },
      {
        team: "MIYAGI DO",
        totalKeeperScore: 28.8,
        picksForfeited: ["10.06", "9.07"],
        selectedKeepers: [
          { player: "Trey McBride", position: "TE", keeperScore: 15.1 },
          { player: "Anthony Richardson", position: "QB", keeperScore: 13.7 },
        ],
        strategicNotes: "Volatile QB upside replaces a safer WR keeper.",
      },
      {
        team: "EAGLE FANG",
        totalKeeperScore: 0,
        picksForfeited: [],
        selectedKeepers: [],
        strategicNotes: "No QB keeper worth forcing.",
      },
    ],
  },
  {
    scenarioName: "Win Now",
    description: "Accepts lower value for elite weekly ceiling and starter status.",
    totalKeeperScore: 211.3,
    strategicNotes: "Best for contenders willing to trade draft flexibility for lineup power.",
    teams: [
      {
        team: "SWEEP THE LEG JOHNNY",
        totalKeeperScore: 111.2,
        picksForfeited: ["1.01", "5.01", "12.06"],
        selectedKeepers: [
          { player: "Ja'Marr Chase", position: "WR", keeperScore: 30.6 },
          { player: "Jalen Hurts", position: "QB", keeperScore: 72.4 },
          { player: "Rashee Rice", position: "WR", keeperScore: 8.2 },
        ],
        strategicNotes: "Locks in weekly ceiling but starts the draft without 1.01.",
      },
      {
        team: "COBRA KAI NEVER DIES",
        totalKeeperScore: 74.5,
        picksForfeited: ["1.02", "2.11", "4.02", "8.11"],
        selectedKeepers: [
          { player: "Justin Jefferson", position: "WR", keeperScore: 29.9 },
          { player: "Bijan Robinson", position: "RB", keeperScore: 34.8 },
          { player: "Sam LaPorta", position: "TE", keeperScore: 9.8 },
        ],
        strategicNotes: "Contender profile; premium picks are mostly converted into starters.",
      },
      {
        team: "MIYAGI DO",
        totalKeeperScore: 25.6,
        picksForfeited: ["3.07", "10.06"],
        selectedKeepers: [
          { player: "Garrett Wilson", position: "WR", keeperScore: 10.2 },
          { player: "Trey McBride", position: "TE", keeperScore: 15.4 },
        ],
        strategicNotes: "Solid floor, but still needs early RB investment.",
      },
      {
        team: "EAGLE FANG",
        totalKeeperScore: 0,
        picksForfeited: [],
        selectedKeepers: [],
        strategicNotes: "No win-now anchor worth spending a keeper slot.",
      },
    ],
  },
  {
    scenarioName: "Rebuild",
    description: "Keeps only strong values and protects early draft volume.",
    totalKeeperScore: 94.8,
    strategicNotes: "Best for teams that need picks more than marginal keeper continuity.",
    teams: [
      {
        team: "SWEEP THE LEG JOHNNY",
        totalKeeperScore: 65.2,
        picksForfeited: ["5.01"],
        selectedKeepers: [{ player: "Jalen Hurts", position: "QB", keeperScore: 65.2 }],
        strategicNotes: "One cornerstone keeper and maximum draft flexibility.",
      },
      {
        team: "COBRA KAI NEVER DIES",
        totalKeeperScore: 21.7,
        picksForfeited: ["2.11"],
        selectedKeepers: [{ player: "Bijan Robinson", position: "RB", keeperScore: 21.7 }],
        strategicNotes: "Keeps the cleanest value while reopening early-round choices.",
      },
      {
        team: "MIYAGI DO",
        totalKeeperScore: 7.9,
        picksForfeited: ["10.06"],
        selectedKeepers: [{ player: "Trey McBride", position: "TE", keeperScore: 7.9 }],
        strategicNotes: "Cheap tight end value fits a pick-preservation plan.",
      },
      {
        team: "EAGLE FANG",
        totalKeeperScore: 0,
        picksForfeited: [],
        selectedKeepers: [],
        strategicNotes: "Full reset; use all picks in the live draft.",
      },
    ],
  },
];

export const adpCsvPreview =
  "player,position,adp_pick,source,snapshot_date\nJa'Marr Chase,WR,5,DraftSharks Superflex,2026-04-30\nJalen Hurts,QB,18,DraftSharks Superflex,2026-04-30\nBijan Robinson,RB,4,DraftSharks Superflex,2026-04-30";

export const draftCsvPreview =
  "team,round,overall_pick,player,position\nSWEEP THE LEG JOHNNY,1,1,Ja'Marr Chase,WR\nSWEEP THE LEG JOHNNY,5,49,Jalen Hurts,QB\nCOBRA KAI NEVER DIES,2,23,Bijan Robinson,RB";

export const finalRosterCsvPreview =
  "team,player,position,roster_status\nSWEEP THE LEG JOHNNY,Ja'Marr Chase,WR,Starter\nSWEEP THE LEG JOHNNY,Jalen Hurts,QB,Starter\nCOBRA KAI NEVER DIES,Bijan Robinson,RB,Starter";
