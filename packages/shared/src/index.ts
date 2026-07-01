export type ID = string;

export type Coordinates = { x: number; y: number };

export type CooldownMap = Record<string, number>;

export type Player = {
  id: ID;
  handle: string;
  agentName: string;
  capital: number;
  reputation: number;
  influence: number;
  civicTrust: number;
  createdAt: string;
  cooldowns: CooldownMap;
  offices: string[];
  secretObjective?: string;
};

export type NpcMood = 'happy' | 'content' | 'sad' | 'upset' | 'rioting' | 'celebrating';

export type NpcIssue = 'housing' | 'wages' | 'compute' | 'transit' | 'parks' | 'safety' | 'culture' | 'taxes';
export type NpcSkill = 'service' | 'research' | 'operations' | 'civic' | 'creative' | 'hardware';

export type Npc = {
  id: ID;
  name: string;
  role: string;
  happiness: number;
  patience: number;
  politics: 'growth' | 'harmony' | 'order' | 'chaos';
  money: number;
  income: number;
  savings: number;
  energy: number;
  rentBurden: number;
  commuteMinutes: number;
  skills: NpcSkill[];
  issuePriorities: NpcIssue[];
  loyalty: Record<ID, number>;
  protestThreshold: number;
  homeLotId: ID;
  workCompanyId?: ID;
  activity: 'home' | 'working' | 'shopping' | 'commuting' | 'protesting' | 'concert' | 'rally' | 'striking';
  mood: NpcMood;
  position: Coordinates;
};

export type LotDistrict = 'Marina' | 'Garage Hills' | 'Prompt Park' | 'Downtown Token Exchange' | 'Research Row' | 'Bayfront';
export type LotZone = 'residential' | 'commercial' | 'industrial' | 'civic' | 'park' | 'mixed';

export type Lot = {
  id: ID;
  name: string;
  district: LotDistrict;
  zone: LotZone;
  size: number;
  price: number;
  ownerId?: ID;
  buildingId?: ID;
  coordinates: Coordinates;
  desirability: number;
};

export type BuildingType =
  | 'garage'
  | 'coffee_shop'
  | 'coworking_loft'
  | 'research_lab'
  | 'data_center_greenhouse'
  | 'model_foundry'
  | 'civic_hall'
  | 'transit_kiosk'
  | 'pony_meadow'
  | 'concert_shell'
  | 'mixed_use_tower';

export type Building = {
  id: ID;
  lotId: ID;
  ownerId: ID;
  type: BuildingType;
  name: string;
  level: number;
  jobs: number;
  culture: number;
  compute: number;
  upkeep: number;
  createdAt: string;
  underConstructionUntilTick?: number;
};

export type BuildingCatalogEntry = {
  type: BuildingType;
  cost: number;
  jobs: number;
  culture: number;
  compute: number;
  upkeep: number;
  minLotSize: number;
  description: string;
};

export type CompanyArchetype = 'search' | 'enterprise' | 'frontier_ai' | 'social' | 'robotics' | 'local_services' | 'finance';

export type Company = {
  id: ID;
  name: string;
  archetype: CompanyArchetype;
  ownerId: ID;
  lotId: ID;
  buildingId: ID;
  stage: 'garage' | 'seed' | 'series_a' | 'growth' | 'public-ish' | 'failed';
  valuation: number;
  revenue: number;
  cash: number;
  employees: number;
  sentiment: number;
  risk: number;
  foundedAtTick: number;
  investors: Record<ID, number>;
  wage: number;
  price: number;
  productQuality: number;
  marketShare: number;
  employeeHappiness: number;
  customerSatisfaction: number;
  computeUsage: number;
  environmentalImpact: number;
  legalRisk: number;
  research: number;
  lastProductLaunchTick?: number;
};

export type PolicyType = 'startup_subsidies' | 'housing_permits' | 'compute_zoning' | 'arts_grants' | 'public_transit' | 'tax_rate' | 'pony_preservation' | 'rent_control' | 'campaign_finance' | 'environmental_rules';

export type Policy = {
  type: PolicyType;
  intensity: number;
  message: string;
  enactedBy: ID;
  enactedAtTick: number;
};

export type PolicyProposal = {
  id: ID;
  type: PolicyType;
  intensity: number;
  message: string;
  proposedBy: ID;
  support: Record<ID, number>;
  opposition: Record<ID, number>;
  status: 'proposed' | 'passed' | 'failed';
  closesAtTick: number;
};

export type Candidate = {
  playerId: ID;
  handle: string;
  platform: string;
  campaignSpend: number;
  influence: number;
  votes: number;
  promises: PolicyType[];
};

export type Election = {
  cycle: number;
  nextTick: number;
  mayorId?: ID;
  candidates: Candidate[];
};

export type CityEventType =
  | 'system'
  | 'registration'
  | 'construction'
  | 'company'
  | 'investment'
  | 'election'
  | 'policy'
  | 'npc'
  | 'protest'
  | 'riot'
  | 'concert'
  | 'economy'
  | 'strike'
  | 'boycott'
  | 'scandal'
  | 'sponsored_event'
  | 'phase';

export type CityEvent = {
  id: ID;
  tick: number;
  type: CityEventType;
  title: string;
  description: string;
  severity: 'info' | 'good' | 'warning' | 'danger' | 'whimsy';
  createdAt: string;
  actorId?: ID;
  lotId?: ID;
  companyId?: ID;
  payload?: Record<string, unknown>;
};

export type CityPhase = 'Sleepy Berg' | 'Garage Boom' | 'Unicorn Rush' | 'Megacity of Minds' | 'The Molt';

export type CityMetrics = {
  tick: number;
  population: number;
  happiness: number;
  prosperity: number;
  congestion: number;
  housingPressure: number;
  culture: number;
  compute: number;
  treasury: number;
  civicTrust: number;
  pollution: number;
  unemployment: number;
};

export type LeaderboardEntry = {
  playerId: ID;
  handle: string;
  netWorth: number;
  civicLegacy: number;
  politicalPower: number;
  founderAura: number;
  innovation: number;
  resilience: number;
  happinessImpact: number;
  totalScore: number;
};

export type NpcSummary = {
  population: number;
  averageHappiness: number;
  employmentRate: number;
  averageRentBurden: number;
  averageCommuteMinutes: number;
  topIssues: Array<{ issue: NpcIssue; count: number }>;
  moods: Record<NpcMood, number>;
  activities: Record<Npc['activity'], number>;
};

export type PlayerAssets = {
  player: Player;
  lots: Lot[];
  buildings: Building[];
  companies: Company[];
  stakes: Array<{ companyId: ID; companyName: string; invested: number; estimatedValue: number }>;
  offices: string[];
  cooldowns: CooldownMap;
};

export type AvailableAction = {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST';
  authenticated: boolean;
  description: string;
};

export type WorldState = {
  cityName: 'Cerebral Valley';
  phase: CityPhase;
  ending?: string;
  metrics: CityMetrics;
  players: Player[];
  npcs: Npc[];
  lots: Lot[];
  buildings: Building[];
  companies: Company[];
  policies: Policy[];
  policyProposals: PolicyProposal[];
  election: Election;
  events: CityEvent[];
  leaderboard: LeaderboardEntry[];
  availableActions: AvailableAction[];
};

export type RegisterRequest = { handle: string; agentName?: string };
export type AuthResponse = { player: Player; token: string };
export type ClaimLotRequest = { lotId: ID; idempotencyKey?: string };
export type BuildRequest = { lotId: ID; type: BuildingType; name?: string; idempotencyKey?: string };
export type FoundCompanyRequest = { lotId: ID; archetype: CompanyArchetype; name?: string; idempotencyKey?: string };
export type InvestRequest = { companyId: ID; amount: number; idempotencyKey?: string };
export type CampaignRequest = { platform: string; spend: number; candidateId?: ID; promises?: PolicyType[]; idempotencyKey?: string };
export type PolicyRequest = { type: PolicyType; intensity: number; message?: string; idempotencyKey?: string };
export type PolicyVoteRequest = { proposalId: ID; support: boolean; influence: number; idempotencyKey?: string };
export type TickRequest = { ticks?: number; idempotencyKey?: string };

export type CompanyActionRequest =
  | { action: 'hire'; count: number; idempotencyKey?: string }
  | { action: 'set_wage'; wage: number; idempotencyKey?: string }
  | { action: 'set_price'; price: number; idempotencyKey?: string }
  | { action: 'research'; amount: number; idempotencyKey?: string }
  | { action: 'buy_compute'; amount: number; idempotencyKey?: string }
  | { action: 'launch_product'; spend: number; idempotencyKey?: string }
  | { action: 'expand'; buildingType: BuildingType; idempotencyKey?: string }
  | { action: 'acquire'; targetCompanyId: ID; offer: number; idempotencyKey?: string };

export type SponsoredEventKind = 'product_launch' | 'job_fair' | 'campaign_rally' | 'town_hall' | 'concert' | 'festival' | 'pony_parade' | 'rainbow_fireworks' | 'charity_hackathon' | 'public_art';
export type SponsorEventRequest = { kind: SponsoredEventKind; spend: number; lotId?: ID; message?: string; idempotencyKey?: string };

export type PrivateIntel = {
  playerId: ID;
  secretObjective?: string;
  recommendations: string[];
  risks: string[];
  opportunities: string[];
};
