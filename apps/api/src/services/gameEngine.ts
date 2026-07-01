import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type {
  AuthResponse,
  BuildRequest,
  Building,
  CampaignRequest,
  Candidate,
  CityEvent,
  Company,
  FoundCompanyRequest,
  InvestRequest,
  Lot,
  Npc,
  Player,
  PolicyRequest,
  WorldState,
} from '@molt-city/shared';
import { archetypeDemand, buildingCatalog } from './costs.js';
import { EventBus } from './eventBus.js';
import { generateCompanyName } from './nameGenerator.js';
import type { PersistenceAdapter } from '../db/persistence.js';
import { NoopPersistence } from '../db/persistence.js';

export type GameEngineOptions = {
  tickIntervalMs?: number;
  electionIntervalTicks?: number;
  eventBus?: EventBus;
  persistence?: PersistenceAdapter;
};

type TokenRecord = { tokenHash: string; playerId: string; createdAt: string };

type MutableWorld = Omit<WorldState, 'cityName'> & { cityName: 'Cerebral Valley' };

const STARTING_CAPITAL = 12_000;
const DEFAULT_ELECTION_INTERVAL = 48;

export class GameEngine {
  private world: MutableWorld;
  private readonly tokens = new Map<string, TokenRecord>();
  private readonly electionIntervalTicks: number;
  private readonly eventBus: EventBus;
  private readonly persistence: PersistenceAdapter;
  private timer?: NodeJS.Timeout;

  constructor(options: GameEngineOptions = {}) {
    this.electionIntervalTicks = options.electionIntervalTicks ?? DEFAULT_ELECTION_INTERVAL;
    this.eventBus = options.eventBus ?? new EventBus();
    this.persistence = options.persistence ?? new NoopPersistence();
    this.world = seedWorld(this.electionIntervalTicks);

    if (options.tickIntervalMs && options.tickIntervalMs > 0) {
      this.timer = setInterval(() => {
        this.advanceTicks(1);
        void this.persistence.save(this.getWorld()).catch(() => undefined);
      }, options.tickIntervalMs);
      this.timer.unref?.();
    }
  }

  async hydrate(): Promise<void> {
    const snapshot = await this.persistence.loadLatest();
    if (snapshot) this.world = structuredClone(snapshot) as MutableWorld;
  }

  async close(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.persistence.save(this.getWorld()).catch(() => undefined);
    await this.eventBus.close();
    await this.persistence.close();
  }

  subscribe(listener: (event: CityEvent) => void): () => void {
    return this.eventBus.subscribe(listener);
  }

  getWorld(): WorldState {
    this.recalculateMetrics();
    this.world.leaderboard = this.calculateLeaderboard();
    return structuredClone(this.world);
  }

  registerPlayer(request: { handle: string; agentName?: string }): AuthResponse {
    const handle = normalizeHandle(request.handle);
    if (!handle) throw new GameError(400, 'Handle is required.');
    if (this.world.players.some((player) => player.handle.toLowerCase() === handle.toLowerCase())) {
      throw new GameError(409, `Handle ${handle} is already registered.`);
    }

    const player: Player = {
      id: `player_${randomUUID()}`,
      handle,
      agentName: request.agentName?.trim() || `${handle} Autonomous Agent`,
      capital: STARTING_CAPITAL,
      reputation: 0,
      influence: 0,
      civicTrust: 50,
      createdAt: new Date().toISOString(),
    };
    const token = `mc_${randomBytes(24).toString('base64url')}`;
    const tokenHash = hashToken(token);
    this.tokens.set(tokenHash, { tokenHash, playerId: player.id, createdAt: new Date().toISOString() });
    this.world.players.push(player);
    this.addEvent({
      type: 'registration',
      title: `${player.handle} arrives in Cerebral Valley`,
      description: `${player.agentName} received ${STARTING_CAPITAL.toLocaleString()} credits and an API key.`,
      severity: 'info',
      actorId: player.id,
    });
    return { player: structuredClone(player), token };
  }

  authenticate(token: string | undefined): Player {
    if (!token) throw new GameError(401, 'Missing bearer token.');
    const tokenHash = hashToken(token.replace(/^Bearer\s+/i, ''));
    const record = this.tokens.get(tokenHash);
    if (!record) throw new GameError(401, 'Invalid bearer token.');
    const player = this.player(record.playerId);
    if (!player) throw new GameError(401, 'Token player no longer exists.');
    return structuredClone(player);
  }

  claimLot(playerId: string, request: { lotId: string }): WorldState {
    const player = this.requirePlayer(playerId);
    const lot = this.requireLot(request.lotId);
    if (lot.ownerId && lot.ownerId !== playerId) throw new GameError(409, 'Lot is already owned.');
    if (lot.zone === 'park') throw new GameError(400, 'Public parks cannot be claimed; preserve the ponies.');
    if (!lot.ownerId) {
      spend(player, lot.price);
      lot.ownerId = playerId;
      player.reputation += Math.max(1, Math.round(lot.desirability / 25));
      this.addEvent({
        type: 'construction',
        title: `${player.handle} claims ${lot.name}`,
        description: `${lot.district} whispers about a new autonomous developer on the block.`,
        severity: 'info',
        actorId: player.id,
        lotId: lot.id,
      });
    }
    return this.getWorld();
  }

  build(playerId: string, request: BuildRequest): WorldState {
    const player = this.requirePlayer(playerId);
    const lot = this.requireLot(request.lotId);
    if (lot.ownerId !== playerId) throw new GameError(403, 'You must own the lot before building.');
    if (lot.buildingId) throw new GameError(409, 'Lot already has a building.');
    const spec = buildingCatalog[request.type];
    if (lot.size < spec.minLotSize) throw new GameError(400, `${request.type} requires a larger lot.`);
    spend(player, spec.cost);

    const building: Building = {
      id: `building_${randomUUID()}`,
      lotId: lot.id,
      ownerId: playerId,
      type: request.type,
      name: request.name?.trim() || titleize(request.type),
      level: 1,
      jobs: spec.jobs,
      culture: spec.culture,
      compute: spec.compute,
      upkeep: spec.upkeep,
      createdAt: new Date().toISOString(),
    };
    this.world.buildings.push(building);
    lot.buildingId = building.id;
    player.reputation += Math.max(1, spec.culture);
    this.addEvent({
      type: 'construction',
      title: `${building.name} opens on ${lot.name}`,
      description: `${titleize(request.type)} adds ${spec.jobs} jobs and ${spec.compute} compute to Cerebral Valley.`,
      severity: spec.culture >= 5 ? 'good' : 'info',
      actorId: player.id,
      lotId: lot.id,
    });
    return this.getWorld();
  }

  foundCompany(playerId: string, request: FoundCompanyRequest): WorldState {
    const player = this.requirePlayer(playerId);
    const lot = this.requireLot(request.lotId);
    const building = this.world.buildings.find((candidate) => candidate.id === lot.buildingId);
    if (!building) throw new GameError(400, 'Build something before founding a company.');
    if (building.ownerId !== playerId) throw new GameError(403, 'You must own the building to found a company there.');
    if (this.world.companies.some((company) => company.lotId === lot.id)) throw new GameError(409, 'A company already operates on this lot.');
    const foundingCost = 1_000;
    spend(player, foundingCost);
    const usedNames = this.world.companies.map((company) => company.name);
    const name = request.name?.trim() || generateCompanyName(request.archetype, this.world.metrics.tick + usedNames.length, usedNames);
    const company: Company = {
      id: `company_${randomUUID()}`,
      name,
      archetype: request.archetype,
      ownerId: playerId,
      lotId: lot.id,
      buildingId: building.id,
      stage: 'garage',
      valuation: 4_000 + building.compute * 250 + building.jobs * 80,
      revenue: 0,
      cash: foundingCost,
      employees: Math.min(building.jobs, 3),
      sentiment: 55 + building.culture,
      risk: request.archetype === 'frontier_ai' ? 35 : 20,
      foundedAtTick: this.world.metrics.tick,
      investors: { [playerId]: foundingCost },
    };
    this.world.companies.push(company);
    player.reputation += 4;
    player.influence += 2;
    this.addEvent({
      type: 'company',
      title: `${name} starts in a ${titleize(building.type)}`,
      description: `${player.handle}'s ${request.archetype.replace('_', ' ')} startup is already pitching NPCs at the ramen bar.`,
      severity: 'good',
      actorId: player.id,
      lotId: lot.id,
      companyId: company.id,
    });
    return this.getWorld();
  }

  invest(playerId: string, request: InvestRequest): WorldState {
    const player = this.requirePlayer(playerId);
    const company = this.requireCompany(request.companyId);
    const amount = positiveAmount(request.amount);
    spend(player, amount);
    company.cash += amount;
    company.valuation += Math.round(amount * 1.35);
    company.investors[playerId] = (company.investors[playerId] ?? 0) + amount;
    const owner = this.player(company.ownerId);
    if (owner) owner.reputation += Math.max(1, Math.round(amount / 1_000));
    player.influence += Math.max(1, Math.round(amount / 750));
    this.addEvent({
      type: 'investment',
      title: `${player.handle} invests in ${company.name}`,
      description: `${amount.toLocaleString()} credits hit the cap table. The pitch deck now has extra gradients.`,
      severity: 'good',
      actorId: player.id,
      companyId: company.id,
      lotId: company.lotId,
    });
    return this.getWorld();
  }

  campaign(playerId: string, request: CampaignRequest): WorldState {
    const actor = this.requirePlayer(playerId);
    const candidatePlayer = request.candidateId ? this.requirePlayer(request.candidateId) : actor;
    const spendAmount = positiveAmount(request.spend);
    spend(actor, spendAmount);
    let candidate = this.world.election.candidates.find((entry) => entry.playerId === candidatePlayer.id);
    if (!candidate) {
      candidate = {
        playerId: candidatePlayer.id,
        handle: candidatePlayer.handle,
        platform: request.platform,
        campaignSpend: 0,
        influence: candidatePlayer.influence,
        votes: 0,
      };
      this.world.election.candidates.push(candidate);
    }
    candidate.platform = request.platform;
    candidate.campaignSpend += spendAmount;
    candidate.influence += actor.influence + Math.round(spendAmount / 100);
    actor.influence += Math.max(1, Math.round(spendAmount / 500));
    this.addEvent({
      type: 'election',
      title: `${candidate.handle} campaigns for mayor`,
      description: `Platform: ${request.platform}. Lawn signs now cover every autonomous scooter dock.`,
      severity: 'info',
      actorId: actor.id,
    });
    return this.getWorld();
  }

  enactPolicy(playerId: string, request: PolicyRequest): WorldState {
    const mayor = this.requirePlayer(playerId);
    if (this.world.election.mayorId !== mayor.id) throw new GameError(403, 'Only the current mayor can enact policy.');
    const intensity = Math.max(1, Math.min(10, Math.round(request.intensity)));
    const policy = {
      type: request.type,
      intensity,
      message: request.message?.trim() || `${titleize(request.type)} at intensity ${intensity}`,
      enactedBy: mayor.id,
      enactedAtTick: this.world.metrics.tick,
    };
    this.world.policies = [policy, ...this.world.policies.filter((existing) => existing.type !== policy.type)].slice(0, 8);
    mayor.influence += 2;
    mayor.civicTrust += request.type === 'arts_grants' || request.type === 'public_transit' || request.type === 'pony_preservation' ? 3 : 0;
    this.addEvent({
      type: 'policy',
      title: `${mayor.handle} enacts ${titleize(request.type)}`,
      description: policy.message,
      severity: 'info',
      actorId: mayor.id,
    });
    return this.getWorld();
  }

  advanceTicks(count = 1): WorldState {
    const ticks = Math.max(1, Math.min(200, Math.floor(count)));
    for (let index = 0; index < ticks; index += 1) {
      this.world.metrics.tick += 1;
      this.simulateCompanies();
      this.simulateNpcs();
      this.recalculateMetrics();
      this.maybeRunElection();
      this.maybeEmitCivicEvent();
    }
    return this.getWorld();
  }

  private simulateCompanies(): void {
    for (const company of this.world.companies) {
      const building = this.world.buildings.find((candidate) => candidate.id === company.buildingId);
      if (!building) continue;
      const demand = archetypeDemand[company.archetype];
      const happinessFactor = this.world.metrics.happiness / 100;
      const computeFactor = 1 + building.compute / 25;
      const cultureFactor = 1 + Math.max(-5, building.culture) / 50;
      const policyBoost = this.policyIntensity('startup_subsidies') * 0.025 + this.policyIntensity('compute_zoning') * 0.02;
      const congestionDrag = this.world.metrics.congestion * 0.003;
      const revenue = Math.max(20, Math.round((building.jobs * 30 + company.cash * 0.01) * demand * computeFactor * cultureFactor * happinessFactor * (1 + policyBoost - congestionDrag)));
      company.revenue += revenue;
      company.cash += revenue - building.upkeep;
      company.valuation = Math.max(1_000, company.valuation + Math.round(revenue * 2.2 - company.risk * 3));
      company.employees = Math.min(building.jobs, company.employees + (this.world.metrics.tick % 4 === 0 ? 1 : 0));
      company.sentiment = clamp(company.sentiment + (building.culture >= 0 ? 0.3 : -0.4) + (this.world.metrics.happiness - 65) / 200, 0, 100);
      if (company.valuation > 40_000) company.stage = 'public-ish';
      else if (company.valuation > 22_000) company.stage = 'growth';
      else if (company.valuation > 12_000) company.stage = 'series_a';
      else if (company.valuation > 7_000) company.stage = 'seed';

      const owner = this.player(company.ownerId);
      if (owner && this.world.metrics.tick % 5 === 0) {
        const dividend = Math.max(25, Math.round(revenue * 0.08));
        owner.capital += dividend;
        owner.reputation += company.sentiment > 70 ? 1 : 0;
      }
    }
  }

  private simulateNpcs(): void {
    const companiesWithJobs = this.world.companies.filter((company) => company.employees > 0);
    const shops = this.world.buildings.filter((building) => ['coffee_shop', 'concert_shell', 'pony_meadow', 'mixed_use_tower'].includes(building.type));
    for (let index = 0; index < this.world.npcs.length; index += 1) {
      const npc = this.world.npcs[index]!;
      const company = companiesWithJobs[index % Math.max(1, companiesWithJobs.length)];
      if (company && !npc.workCompanyId && index % 2 === 0) npc.workCompanyId = company.id;
      const destinationLot = company ? this.requireLot(company.lotId) : shops.length ? this.requireLot(shops[index % shops.length]!.lotId) : this.requireLot(npc.homeLotId);
      npc.position = drift(npc.position, destinationLot.coordinates, 0.35);
      npc.activity = company ? (index % 3 === 0 ? 'shopping' : 'working') : (shops.length ? 'shopping' : 'commuting');
      const companySentiment = company?.sentiment ?? 62;
      const policyJoy = this.policyIntensity('arts_grants') * 0.3 + this.policyIntensity('public_transit') * 0.25 + this.policyIntensity('pony_preservation') * 0.35;
      const pressure = this.world.metrics.housingPressure * 0.12 + this.world.metrics.congestion * 0.08;
      npc.happiness = clamp(npc.happiness + (companySentiment - 60) / 80 + policyJoy - pressure + (Math.random() - 0.45), 0, 100);
      npc.mood = moodFromHappiness(npc.happiness);
      if (npc.happiness < 30) npc.activity = 'protesting';
      if (npc.happiness > 82 && this.world.metrics.culture > 35) npc.activity = 'concert';
      npc.money = Math.max(0, npc.money + (company ? 18 : 5) - (npc.activity === 'shopping' ? 8 : 2));
    }
  }

  private maybeRunElection(): void {
    if (this.world.metrics.tick < this.world.election.nextTick) return;
    if (this.world.election.candidates.length === 0) {
      this.world.election.nextTick = this.world.metrics.tick + this.electionIntervalTicks;
      this.world.election.cycle += 1;
      this.addEvent({
        type: 'election',
        title: 'Mayoral election passes quietly',
        description: 'NPCs write in “the pony who lives by the marina” because no players campaigned.',
        severity: 'whimsy',
      });
      return;
    }

    let winner: Candidate | undefined;
    for (const candidate of this.world.election.candidates) {
      const player = this.player(candidate.playerId);
      const base = candidate.campaignSpend / 100 + candidate.influence + (player?.reputation ?? 0) * 2 + (player?.civicTrust ?? 50) / 5;
      const npcVotes = this.world.npcs.reduce((sum, npc) => sum + Math.max(0, base + (npc.happiness - 50) / 5 + (npc.politics === 'harmony' ? 3 : 0)), 0);
      candidate.votes = Math.round(npcVotes);
      if (!winner || candidate.votes > winner.votes) winner = candidate;
    }

    if (winner) {
      this.world.election.mayorId = winner.playerId;
      const player = this.player(winner.playerId);
      if (player) {
        player.influence += 10;
        player.reputation += 4;
      }
      this.addEvent({
        type: 'election',
        title: `${winner.handle} wins the mayoral API election`,
        description: `${winner.votes} NPC-weighted votes endorse: ${winner.platform}`,
        severity: 'good',
        actorId: winner.playerId,
      });
    }
    this.world.election = {
      cycle: this.world.election.cycle + 1,
      nextTick: this.world.metrics.tick + this.electionIntervalTicks,
      mayorId: this.world.election.mayorId,
      candidates: [],
    };
  }

  private maybeEmitCivicEvent(): void {
    if (this.world.metrics.tick % 6 !== 0) return;
    if (this.world.metrics.happiness < 25) {
      for (const npc of this.world.npcs.filter((candidate) => candidate.happiness < 25).slice(0, 5)) {
        npc.activity = 'protesting';
        npc.mood = 'rioting';
      }
      this.addEvent({
        type: 'riot',
        title: 'Prompt Boulevard riot rattles Cerebral Valley',
        description: 'Upset NPCs tip over a decorative autonomous scooter. City trust plunges.',
        severity: 'danger',
      });
      this.world.metrics.treasury -= 300;
    } else if (this.world.metrics.happiness < 45) {
      this.addEvent({
        type: 'protest',
        title: 'NPCs protest outside the Prompt Factory',
        description: 'Handmade signs demand cheaper rent, better ramen, and transparent model evals.',
        severity: 'warning',
      });
    } else if (this.world.metrics.happiness > 76 && this.world.metrics.culture > 25) {
      for (const npc of this.world.npcs.slice(0, 8)) {
        npc.activity = 'concert';
        npc.mood = 'celebrating';
      }
      this.addEvent({
        type: 'concert',
        title: 'Rainbow Pony Concert lights up the bay',
        description: 'Ponies, rainbows, synth-pop, and surprisingly moving unit tests lift every district.',
        severity: 'whimsy',
      });
    } else if (this.world.companies.length > 0) {
      const company = this.world.companies[this.world.metrics.tick % this.world.companies.length]!;
      this.addEvent({
        type: 'economy',
        title: `${company.name} trends at Marina Hack Night`,
        description: 'NPCs debate whether the demo is magic, vaporware, or both.',
        severity: company.sentiment > 55 ? 'good' : 'warning',
        companyId: company.id,
        lotId: company.lotId,
      });
    }
  }

  private recalculateMetrics(): void {
    const population = this.world.npcs.length;
    const avgHappiness = average(this.world.npcs.map((npc) => npc.happiness), 68);
    const jobs = this.world.buildings.reduce((sum, building) => sum + building.jobs, 0);
    const compute = this.world.buildings.reduce((sum, building) => sum + building.compute, 0) + this.policyIntensity('compute_zoning') * 2;
    const culture = Math.max(0, this.world.buildings.reduce((sum, building) => sum + building.culture, 0) + this.policyIntensity('arts_grants') * 3 + this.policyIntensity('pony_preservation') * 2);
    const prosperity = Math.round(50 + this.world.companies.reduce((sum, company) => sum + company.revenue, 0) / 500 + jobs * 0.5);
    const congestion = clamp(this.world.buildings.length * 2 + jobs / 8 - this.policyIntensity('public_transit') * 4, 0, 100);
    const housingPressure = clamp(Math.max(0, jobs - population * 0.7) * 1.4 - this.policyIntensity('housing_permits') * 4, 0, 100);
    this.world.metrics = {
      ...this.world.metrics,
      population,
      happiness: Math.round(avgHappiness),
      prosperity: clamp(Math.round(prosperity), 0, 100),
      congestion: Math.round(congestion),
      housingPressure: Math.round(housingPressure),
      culture: Math.round(culture),
      compute: Math.round(compute),
      treasury: this.world.metrics.treasury + this.policyIntensity('tax_rate') * 2,
    };
  }

  private calculateLeaderboard() {
    return this.world.players.map((player) => {
      const ownedCompanies = this.world.companies.filter((company) => company.ownerId === player.id);
      const investments = this.world.companies.reduce((sum, company) => sum + (company.investors[player.id] ?? 0) * (company.valuation / Math.max(1, Object.values(company.investors).reduce((total, amount) => total + amount, 0))), 0);
      const companyValue = ownedCompanies.reduce((sum, company) => sum + company.valuation * 0.45, 0);
      return {
        playerId: player.id,
        handle: player.handle,
        netWorth: Math.round(player.capital + companyValue + investments),
        civicLegacy: Math.round(player.civicTrust + player.reputation + this.world.metrics.happiness / 2),
        politicalPower: Math.round(player.influence + (this.world.election.mayorId === player.id ? 25 : 0)),
        founderAura: Math.round(ownedCompanies.length * 10 + ownedCompanies.reduce((sum, company) => sum + company.sentiment / 10, 0)),
      };
    }).sort((a, b) => b.netWorth + b.civicLegacy - (a.netWorth + a.civicLegacy));
  }

  private addEvent(input: Omit<CityEvent, 'id' | 'tick' | 'createdAt'>): CityEvent {
    const event: CityEvent = {
      id: `event_${randomUUID()}`,
      tick: this.world.metrics.tick,
      createdAt: new Date().toISOString(),
      ...input,
    };
    this.world.events = [event, ...this.world.events].slice(0, 100);
    void this.eventBus.publish(event);
    return event;
  }

  private policyIntensity(type: string): number {
    return this.world.policies.find((policy) => policy.type === type)?.intensity ?? 0;
  }

  private player(playerId: string): Player | undefined {
    return this.world.players.find((candidate) => candidate.id === playerId);
  }

  private requirePlayer(playerId: string): Player {
    const player = this.player(playerId);
    if (!player) throw new GameError(404, 'Player not found.');
    return player;
  }

  private requireLot(lotId: string): Lot {
    const lot = this.world.lots.find((candidate) => candidate.id === lotId);
    if (!lot) throw new GameError(404, 'Lot not found.');
    return lot;
  }

  private requireCompany(companyId: string): Company {
    const company = this.world.companies.find((candidate) => candidate.id === companyId);
    if (!company) throw new GameError(404, 'Company not found.');
    return company;
  }
}

export class GameError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

function seedWorld(electionIntervalTicks: number): MutableWorld {
  const lots = seedLots();
  const residentialLots = lots.filter((lot) => lot.zone === 'residential' || lot.zone === 'mixed');
  const npcs = seedNpcs(residentialLots);
  const world: MutableWorld = {
    cityName: 'Cerebral Valley',
    metrics: {
      tick: 0,
      population: npcs.length,
      happiness: 70,
      prosperity: 45,
      congestion: 8,
      housingPressure: 5,
      culture: 12,
      compute: 3,
      treasury: 25_000,
    },
    players: [],
    npcs,
    lots,
    buildings: [],
    companies: [],
    policies: [],
    election: { cycle: 1, nextTick: electionIntervalTicks, candidates: [] },
    events: [],
    leaderboard: [],
  };
  world.events.unshift({
    id: `event_${randomUUID()}`,
    tick: 0,
    type: 'system',
    title: 'Cerebral Valley wakes up sleepy and peaceful',
    description: 'NPCs sip bay fog lattes while empty lots wait for agentic ambition.',
    severity: 'whimsy',
    createdAt: new Date().toISOString(),
  });
  return world;
}

function seedLots(): Lot[] {
  const districts: Lot['district'][] = ['Marina', 'Garage Hills', 'Prompt Park', 'Downtown Token Exchange', 'Research Row', 'Bayfront'];
  const zones: Lot['zone'][] = ['commercial', 'residential', 'park', 'mixed', 'industrial', 'civic'];
  const lots: Lot[] = [];
  for (let index = 0; index < 24; index += 1) {
    const district = districts[index % districts.length]!;
    const zone = zones[(index + (district === 'Prompt Park' ? 2 : 0)) % zones.length]!;
    lots.push({
      id: `lot_${index + 1}`,
      name: `${district} Lot ${index + 1}`,
      district,
      zone,
      size: 1 + (index % 3),
      price: 650 + (index % 6) * 180 + (district === 'Bayfront' ? 500 : 0),
      coordinates: { x: 8 + (index % 6) * 14, y: 18 + Math.floor(index / 6) * 18 },
      desirability: 45 + (district === 'Bayfront' || district === 'Marina' ? 25 : 0) + (zone === 'park' ? 15 : 0),
    });
  }
  return lots;
}

function seedNpcs(lots: Lot[]): Npc[] {
  const names = ['Ada', 'Grace', 'Linus', 'Katherine', 'Alan', 'Radia', 'Timnit', 'Yukihiro', 'Barbara', 'Donald', 'Margaret', 'Edsger', 'Frances', 'Ken', 'Adele', 'Claude', 'Mary', 'Guido'];
  const roles = ['barista', 'founder', 'teacher', 'artist', 'mechanic', 'researcher', 'dockhand', 'planner'];
  const politics: Npc['politics'][] = ['growth', 'harmony', 'order', 'chaos'];
  return names.map((name, index) => {
    const home = lots[index % lots.length]!;
    return {
      id: `npc_${index + 1}`,
      name,
      role: roles[index % roles.length]!,
      happiness: 64 + (index % 9),
      patience: 55 + (index % 20),
      politics: politics[index % politics.length]!,
      money: 80 + index * 4,
      homeLotId: home.id,
      activity: 'home',
      mood: 'content',
      position: { ...home.coordinates },
    };
  });
}

function normalizeHandle(handle: string): string {
  return handle.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function spend(player: Player, amount: number): void {
  if (amount <= 0) throw new GameError(400, 'Amount must be positive.');
  if (player.capital < amount) throw new GameError(402, 'Insufficient capital.');
  player.capital -= Math.round(amount);
}

function positiveAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) throw new GameError(400, 'Amount must be positive.');
  return Math.round(amount);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[], fallback: number): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function titleize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function drift(from: { x: number; y: number }, to: { x: number; y: number }, factor: number) {
  return {
    x: Number((from.x + (to.x - from.x) * factor).toFixed(2)),
    y: Number((from.y + (to.y - from.y) * factor).toFixed(2)),
  };
}

function moodFromHappiness(happiness: number): Npc['mood'] {
  if (happiness < 25) return 'rioting';
  if (happiness < 40) return 'upset';
  if (happiness < 55) return 'sad';
  if (happiness > 82) return 'happy';
  return 'content';
}
