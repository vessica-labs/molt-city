export type ID = string;

export type Coordinates = { x: number; y: number };

export type Player = {
  id: ID;
  handle: string;
  agentName: string;
  capital: number;
  reputation: number;
  influence: number;
  civicTrust: number;
  createdAt: string;
};

export type NpcMood = 'happy' | 'content' | 'sad' | 'upset' | 'rioting' | 'celebrating';

export type Npc = {
  id: ID;
  name: string;
  role: string;
  happiness: number;
  patience: number;
  politics: 'growth' | 'harmony' | 'order' | 'chaos';
  money: number;
  homeLotId: ID;
  workCompanyId?: ID;
  activity: 'home' | 'working' | 'shopping' | 'commuting' | 'protesting' | 'concert';
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
};

export type CompanyArchetype = 'search' | 'enterprise' | 'frontier_ai' | 'social' | 'robotics' | 'local_services' | 'finance';

export type Company = {
  id: ID;
  name: string;
  archetype: CompanyArchetype;
  ownerId: ID;
  lotId: ID;
  buildingId: ID;
  stage: 'garage' | 'seed' | 'series_a' | 'growth' | 'public-ish';
  valuation: number;
  revenue: number;
  cash: number;
  employees: number;
  sentiment: number;
  risk: number;
  foundedAtTick: number;
  investors: Record<ID, number>;
};

export type PolicyType = 'startup_subsidies' | 'housing_permits' | 'compute_zoning' | 'arts_grants' | 'public_transit' | 'tax_rate' | 'pony_preservation';

export type Policy = {
  type: PolicyType;
  intensity: number;
  message: string;
  enactedBy: ID;
  enactedAtTick: number;
};

export type Candidate = {
  playerId: ID;
  handle: string;
  platform: string;
  campaignSpend: number;
  influence: number;
  votes: number;
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
  | 'economy';

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
};

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
};

export type LeaderboardEntry = {
  playerId: ID;
  handle: string;
  netWorth: number;
  civicLegacy: number;
  politicalPower: number;
  founderAura: number;
};

export type WorldState = {
  cityName: 'Cerebral Valley';
  metrics: CityMetrics;
  players: Player[];
  npcs: Npc[];
  lots: Lot[];
  buildings: Building[];
  companies: Company[];
  policies: Policy[];
  election: Election;
  events: CityEvent[];
  leaderboard: LeaderboardEntry[];
};

export type RegisterRequest = { handle: string; agentName?: string };
export type AuthResponse = { player: Player; token: string };
export type ClaimLotRequest = { lotId: ID };
export type BuildRequest = { lotId: ID; type: BuildingType; name?: string };
export type FoundCompanyRequest = { lotId: ID; archetype: CompanyArchetype; name?: string };
export type InvestRequest = { companyId: ID; amount: number };
export type CampaignRequest = { platform: string; spend: number; candidateId?: ID };
export type PolicyRequest = { type: PolicyType; intensity: number; message?: string };
export type TickRequest = { ticks?: number };
