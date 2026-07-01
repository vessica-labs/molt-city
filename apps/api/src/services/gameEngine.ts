import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type {
  AuthResponse,
  BuildRequest,
  Building,
  BuildingType,
  CampaignRequest,
  Candidate,
  CityEvent,
  CityPhase,
  Company,
  CompanyActionRequest,
  FoundCompanyRequest,
  InvestRequest,
  Lot,
  Npc,
  NpcIssue,
  NpcMood,
  NpcSummary,
  Player,
  PlayerAssets,
  Policy,
  PolicyProposal,
  PolicyRequest,
  PolicyVoteRequest,
  PrivateIntel,
  SponsorEventRequest,
  SponsoredEventKind,
  WorldState,
} from '@molt-city/shared';
import { archetypeDemand, buildingCatalog, catalogEntries } from './costs.js';
import { EventBus } from './eventBus.js';
import { generateCompanyName } from './nameGenerator.js';
import type { PersistenceAdapter, PersistedTokenRecord } from '../db/persistence.js';
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
const SYSTEM_OWNER = 'city';

const actionCatalog = [
  { name: 'register', endpoint: '/api/v1/auth/register', method: 'POST', authenticated: false, description: 'Create a player account and receive a bearer token.' },
  { name: 'observeWorld', endpoint: '/api/v1/world', method: 'GET', authenticated: false, description: 'Read the public city snapshot.' },
  { name: 'readTick', endpoint: '/api/v1/tick', method: 'GET', authenticated: false, description: 'Read current tick, phase, cooldown semantics, and next election tick.' },
  { name: 'claimLot', endpoint: '/api/v1/lots/claim', method: 'POST', authenticated: true, description: 'Purchase an unowned non-park lot.' },
  { name: 'build', endpoint: '/api/v1/buildings', method: 'POST', authenticated: true, description: 'Construct a building on an owned lot.' },
  { name: 'foundCompany', endpoint: '/api/v1/companies', method: 'POST', authenticated: true, description: 'Found a company in an owned building.' },
  { name: 'companyAction', endpoint: '/api/v1/companies/:id/actions', method: 'POST', authenticated: true, description: 'Hire, set wages/prices, research, buy compute, launch, expand, or acquire.' },
  { name: 'invest', endpoint: '/api/v1/investments', method: 'POST', authenticated: true, description: 'Invest in a company.' },
  { name: 'campaign', endpoint: '/api/v1/elections/campaign', method: 'POST', authenticated: true, description: 'Run or support a mayoral campaign.' },
  { name: 'policy', endpoint: '/api/v1/policies', method: 'POST', authenticated: true, description: 'Mayors enact policy; non-mayors propose ballot measures.' },
  { name: 'policyVote', endpoint: '/api/v1/policies/vote', method: 'POST', authenticated: true, description: 'Spend influence for or against a proposed policy.' },
  { name: 'sponsorEvent', endpoint: '/api/v1/events', method: 'POST', authenticated: true, description: 'Sponsor concerts, job fairs, pony parades, rallies, and other civic events.' },
] as const;

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
    if (snapshot) this.world = migrateWorld(snapshot, this.electionIntervalTicks);
    const tokenRecords = await this.persistence.loadTokens();
    this.tokens.clear();
    for (const record of tokenRecords) this.tokens.set(record.tokenHash, record);
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
    this.updatePhaseAndEnding();
    this.world.leaderboard = this.calculateLeaderboard();
    this.world.availableActions = [...actionCatalog];
    return structuredClone(this.world);
  }

  getBuildingCatalog() {
    return catalogEntries();
  }

  resetTimeline(): WorldState {
    this.tokens.clear();
    this.world = seedWorld(this.electionIntervalTicks);
    const world = this.getWorld();
    void this.persistence.save(world).catch(() => undefined);
    return world;
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
      cooldowns: {},
      offices: [],
      secretObjective: secretObjectiveFor(this.world.players.length),
    };
    const token = `mc_${randomBytes(24).toString('base64url')}`;
    const tokenHash = hashToken(token);
    this.tokens.set(tokenHash, { tokenHash, playerId: player.id, createdAt: new Date().toISOString() });
    this.world.players.push(player);
    void this.persistence.saveAuth(player, tokenHash, 'registration-token').catch(() => undefined);
    this.addEvent({
      type: 'registration',
      title: `${player.handle} arrives in Cerebral Valley`,
      description: `${player.agentName} received ${STARTING_CAPITAL.toLocaleString()} credits, an API key, and an objective envelope sealed with a tiny pony sticker.`,
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
    this.requireCooldown(player, 'claimLot');
    const lot = this.requireLot(request.lotId);
    if (lot.ownerId && lot.ownerId !== playerId) throw new GameError(409, 'Lot is already owned.');
    if (lot.zone === 'park') throw new GameError(400, 'Public parks cannot be claimed; preserve the ponies.');
    if (lot.buildingId && lot.ownerId === SYSTEM_OWNER) throw new GameError(409, 'This civic lot already has a city-owned building.');
    if (!lot.ownerId) {
      spend(player, lot.price);
      lot.ownerId = playerId;
      player.reputation += Math.max(1, Math.round(lot.desirability / 25));
      this.setCooldown(player, 'claimLot', 1);
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
    this.requireCooldown(player, 'build');
    const lot = this.requireLot(request.lotId);
    if (lot.ownerId !== playerId) throw new GameError(403, 'You must own the lot before building.');
    if (lot.buildingId) throw new GameError(409, 'Lot already has a building. Use company expand or pick another lot.');
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
      underConstructionUntilTick: this.world.metrics.tick + constructionTimeFor(request.type),
    };
    this.world.buildings.push(building);
    lot.buildingId = building.id;
    player.reputation += Math.max(1, spec.culture);
    player.civicTrust += ['transit_kiosk', 'pony_meadow', 'concert_shell', 'civic_hall'].includes(request.type) ? 1 : 0;
    this.setCooldown(player, 'build', 1);
    this.addEvent({
      type: 'construction',
      title: `${building.name} breaks ground on ${lot.name}`,
      description: `${titleize(request.type)} adds ${spec.jobs} jobs and ${spec.compute} compute once construction wraps.`,
      severity: spec.culture >= 5 ? 'good' : 'info',
      actorId: player.id,
      lotId: lot.id,
    });
    return this.getWorld();
  }

  foundCompany(playerId: string, request: FoundCompanyRequest): WorldState {
    const player = this.requirePlayer(playerId);
    this.requireCooldown(player, 'foundCompany');
    const lot = this.requireLot(request.lotId);
    const building = this.world.buildings.find((candidate) => candidate.id === lot.buildingId);
    if (!building) throw new GameError(400, 'Build something before founding a company.');
    if (building.ownerId !== playerId) throw new GameError(403, 'You must own the building to found a company there.');
    if (this.world.companies.some((company) => company.lotId === lot.id && company.stage !== 'failed')) throw new GameError(409, 'A company already operates on this lot.');
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
      wage: 45,
      price: 50,
      productQuality: 45 + building.compute,
      marketShare: 3,
      employeeHappiness: 60,
      customerSatisfaction: 58,
      computeUsage: Math.max(1, building.compute),
      environmentalImpact: Math.max(0, building.compute - building.culture),
      legalRisk: request.archetype === 'finance' || request.archetype === 'social' ? 25 : 15,
      research: 0,
    };
    this.world.companies.push(company);
    player.reputation += 4;
    player.influence += 2;
    this.setCooldown(player, 'foundCompany', 2);
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
    this.requireCooldown(player, 'invest');
    const company = this.requireCompany(request.companyId);
    if (company.stage === 'failed') throw new GameError(409, 'Failed companies cannot accept ordinary investments; acquire them instead.');
    const amount = positiveAmount(request.amount);
    spend(player, amount);
    company.cash += amount;
    company.valuation += Math.round(amount * 1.35);
    company.investors[playerId] = (company.investors[playerId] ?? 0) + amount;
    company.risk = clamp(company.risk - Math.round(amount / 2_000), 0, 100);
    const owner = this.player(company.ownerId);
    if (owner) owner.reputation += Math.max(1, Math.round(amount / 1_000));
    player.influence += Math.max(1, Math.round(amount / 750));
    this.setCooldown(player, 'invest', 1);
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
    this.requireCooldown(actor, 'campaign');
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
        promises: [],
      };
      this.world.election.candidates.push(candidate);
    }
    candidate.platform = request.platform;
    candidate.promises = request.promises ?? candidate.promises;
    candidate.campaignSpend += spendAmount;
    candidate.influence += actor.influence + Math.round(spendAmount / 100);
    actor.influence += Math.max(1, Math.round(spendAmount / 500));
    this.setCooldown(actor, 'campaign', 2);
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
    const actor = this.requirePlayer(playerId);
    this.requireCooldown(actor, 'policy');
    const intensity = Math.max(1, Math.min(10, Math.round(request.intensity)));
    if (this.world.election.mayorId !== actor.id) {
      const proposal: PolicyProposal = {
        id: `proposal_${randomUUID()}`,
        type: request.type,
        intensity,
        message: request.message?.trim() || `${titleize(request.type)} at intensity ${intensity}`,
        proposedBy: actor.id,
        support: { [actor.id]: Math.max(1, actor.influence) },
        opposition: {},
        status: 'proposed',
        closesAtTick: this.world.metrics.tick + 12,
      };
      actor.influence = Math.max(0, actor.influence - 1);
      this.world.policyProposals.unshift(proposal);
      this.setCooldown(actor, 'policy', 2);
      this.addEvent({
        type: 'policy',
        title: `${actor.handle} proposes ${titleize(request.type)}`,
        description: proposal.message,
        severity: 'info',
        actorId: actor.id,
        payload: { proposalId: proposal.id },
      });
      return this.getWorld();
    }

    const policy = this.applyPolicy(actor, request.type, intensity, request.message);
    this.setCooldown(actor, 'policy', 2);
    this.addEvent({
      type: 'policy',
      title: `${actor.handle} enacts ${titleize(request.type)}`,
      description: policy.message,
      severity: 'info',
      actorId: actor.id,
    });
    return this.getWorld();
  }

  votePolicy(playerId: string, request: PolicyVoteRequest): WorldState {
    const player = this.requirePlayer(playerId);
    this.requireCooldown(player, 'policyVote');
    const proposal = this.world.policyProposals.find((candidate) => candidate.id === request.proposalId);
    if (!proposal) throw new GameError(404, 'Policy proposal not found.');
    if (proposal.status !== 'proposed') throw new GameError(409, 'Policy proposal is already closed.');
    if (player.influence <= 0) throw new GameError(402, 'No influence available.');
    const influence = Math.max(1, Math.min(player.influence, Math.round(request.influence)));
    if (!Number.isFinite(influence) || influence <= 0) throw new GameError(400, 'Influence must be positive and available.');
    player.influence -= influence;
    const bucket = request.support ? proposal.support : proposal.opposition;
    bucket[player.id] = (bucket[player.id] ?? 0) + influence;
    this.setCooldown(player, 'policyVote', 1);
    this.addEvent({
      type: 'policy',
      title: `${player.handle} ${request.support ? 'supports' : 'opposes'} ${titleize(proposal.type)}`,
      description: `${influence} influence spent on the ballot measure.`,
      severity: 'info',
      actorId: player.id,
      payload: { proposalId: proposal.id },
    });
    this.resolvePolicyProposal(proposal);
    return this.getWorld();
  }

  companyAction(playerId: string, companyId: string, request: CompanyActionRequest): WorldState {
    const player = this.requirePlayer(playerId);
    this.requireCooldown(player, `company:${request.action}`);
    const company = this.requireCompany(companyId);
    if (company.ownerId !== playerId && request.action !== 'acquire') throw new GameError(403, 'Only the company owner can perform this action.');
    const building = this.requireBuilding(company.buildingId);
    if (company.stage === 'failed' && request.action !== 'acquire') throw new GameError(409, 'Failed companies can only be acquired.');

    switch (request.action) {
      case 'hire': {
        const count = Math.max(1, Math.floor(request.count));
        const slots = Math.max(0, building.jobs - company.employees);
        if (slots <= 0) throw new GameError(409, 'No open job slots in this building.');
        const hires = Math.min(count, slots);
        spend(player, hires * 120);
        company.employees += hires;
        company.cash -= hires * 30;
        company.employeeHappiness = clamp(company.employeeHappiness + 2, 0, 100);
        company.sentiment = clamp(company.sentiment + 1, 0, 100);
        this.assignWorkers(company, hires);
        this.addEvent({ type: 'company', title: `${company.name} hires ${hires} NPCs`, description: 'Recruiters hand out tiny hoodies and reasonable-ish offer letters.', severity: 'good', actorId: player.id, companyId: company.id, lotId: company.lotId });
        break;
      }
      case 'set_wage': {
        company.wage = Math.max(10, Math.min(250, Math.round(request.wage)));
        company.employeeHappiness = clamp(company.employeeHappiness + (company.wage - 45) / 5, 0, 100);
        company.sentiment = clamp(company.sentiment + (company.wage - 45) / 12, 0, 100);
        this.addEvent({ type: 'company', title: `${company.name} sets wages to ${company.wage}`, description: company.wage >= 55 ? 'Workers cheer at the ramen counter.' : 'Workers start quietly making protest signs.', severity: company.wage >= 55 ? 'good' : 'warning', actorId: player.id, companyId: company.id, lotId: company.lotId });
        break;
      }
      case 'set_price': {
        company.price = Math.max(5, Math.min(250, Math.round(request.price)));
        company.customerSatisfaction = clamp(company.customerSatisfaction + (55 - company.price) / 6, 0, 100);
        company.marketShare = clamp(company.marketShare + (60 - company.price) / 15, 0, 100);
        this.addEvent({ type: 'company', title: `${company.name} sets prices to ${company.price}`, description: company.price > 90 ? 'Customers squint at the pricing page.' : 'NPC customers appreciate the less terrifying invoice.', severity: company.price > 90 ? 'warning' : 'info', actorId: player.id, companyId: company.id, lotId: company.lotId });
        break;
      }
      case 'research': {
        const amount = positiveAmount(request.amount);
        spend(player, amount);
        company.cash += Math.round(amount * 0.25);
        company.research += amount;
        company.productQuality = clamp(company.productQuality + amount / 250 + building.compute / 20, 0, 100);
        company.valuation += Math.round(amount * 1.4);
        company.risk = clamp(company.risk + amount / 2_500, 0, 100);
        this.addEvent({ type: 'company', title: `${company.name} researches harder`, description: `${amount.toLocaleString()} credits become benchmark charts, eval suites, and one confused intern.`, severity: 'good', actorId: player.id, companyId: company.id, lotId: company.lotId });
        break;
      }
      case 'buy_compute': {
        const amount = positiveAmount(request.amount);
        spend(player, amount * 35);
        company.computeUsage += amount;
        company.productQuality = clamp(company.productQuality + amount / 8, 0, 100);
        company.environmentalImpact = clamp(company.environmentalImpact + amount / 6, 0, 100);
        company.risk = clamp(company.risk + amount / 10, 0, 100);
        this.addEvent({ type: 'company', title: `${company.name} buys ${amount} compute`, description: 'A mysterious GPU barge flickers offshore. Utility activists take notes.', severity: amount > 20 ? 'warning' : 'info', actorId: player.id, companyId: company.id, lotId: company.lotId });
        break;
      }
      case 'launch_product': {
        const spendAmount = positiveAmount(request.spend);
        spend(player, spendAmount);
        const qualityLift = company.productQuality / 8 + spendAmount / 400;
        company.marketShare = clamp(company.marketShare + qualityLift, 0, 100);
        company.customerSatisfaction = clamp(company.customerSatisfaction + company.productQuality / 20 - company.price / 50, 0, 100);
        company.valuation += Math.round(spendAmount * 1.8 + company.productQuality * 45);
        company.lastProductLaunchTick = this.world.metrics.tick;
        player.reputation += company.customerSatisfaction > 70 ? 3 : 0;
        this.addEvent({ type: 'company', title: `${company.name} launches a product`, description: 'Demo Day attendees gasp, clap, and immediately ask whether there is an API.', severity: company.customerSatisfaction > 60 ? 'good' : 'warning', actorId: player.id, companyId: company.id, lotId: company.lotId });
        break;
      }
      case 'expand': {
        const spec = buildingCatalog[request.buildingType];
        if (this.requireLot(building.lotId).size < spec.minLotSize) throw new GameError(400, `${request.buildingType} requires a larger lot.`);
        const cost = Math.round(spec.cost * (building.type === request.buildingType ? 0.65 : 0.9));
        spend(player, cost);
        building.type = request.buildingType;
        building.name = `${company.name} ${titleize(request.buildingType)}`;
        building.level += 1;
        building.jobs = Math.max(building.jobs + 4, spec.jobs + building.level * 2);
        building.culture = spec.culture;
        building.compute = spec.compute + building.level;
        building.upkeep = spec.upkeep + building.level * 20;
        building.underConstructionUntilTick = this.world.metrics.tick + constructionTimeFor(request.buildingType);
        company.valuation += cost;
        company.risk = clamp(company.risk + 4, 0, 100);
        this.addEvent({ type: 'construction', title: `${company.name} expands into ${titleize(request.buildingType)}`, description: 'Cranes, scaffolds, and a suspicious number of espresso carts appear overnight.', severity: 'good', actorId: player.id, companyId: company.id, lotId: company.lotId });
        break;
      }
      case 'acquire': {
        const target = this.requireCompany(request.targetCompanyId);
        const offer = positiveAmount(request.offer);
        if (target.id === company.id) throw new GameError(400, 'A company cannot acquire itself, despite what the board deck says.');
        if (company.ownerId !== playerId) throw new GameError(403, 'Only the acquiring company owner can make an acquisition.');
        if (offer < target.valuation * 0.55 && target.stage !== 'failed') throw new GameError(400, 'Offer is too low for the target company.');
        spend(player, offer);
        const oldOwner = this.player(target.ownerId);
        if (oldOwner) oldOwner.capital += Math.round(offer * 0.75);
        target.ownerId = playerId;
        target.stage = target.stage === 'failed' ? 'seed' : target.stage;
        target.cash += Math.round(offer * 0.2);
        company.valuation += Math.round(target.valuation * 0.35);
        company.risk = clamp(company.risk + 8, 0, 100);
        player.influence += 4;
        this.addEvent({ type: 'company', title: `${company.name} acquires ${target.name}`, description: 'Bankers celebrate. NPCs try to understand the new org chart.', severity: 'info', actorId: player.id, companyId: company.id, lotId: company.lotId });
        break;
      }
    }

    this.setCooldown(player, `company:${request.action}`, request.action === 'launch_product' || request.action === 'expand' || request.action === 'acquire' ? 4 : 1);
    return this.getWorld();
  }

  sponsorEvent(playerId: string, request: SponsorEventRequest): WorldState {
    const player = this.requirePlayer(playerId);
    this.requireCooldown(player, 'sponsorEvent');
    const spendAmount = positiveAmount(request.spend);
    spend(player, spendAmount);
    const lot = request.lotId ? this.requireLot(request.lotId) : undefined;
    const eventPower = Math.min(15, Math.max(1, Math.round(spendAmount / 250)));
    const kind = request.kind;
    const moodBoost = eventMoodBoost(kind) + eventPower / 2;
    for (const npc of this.world.npcs) {
      npc.happiness = clamp(npc.happiness + moodBoost - (kind === 'campaign_rally' && npc.politics === 'chaos' ? 2 : 0), 0, 100);
      if (['concert', 'festival', 'pony_parade', 'rainbow_fireworks'].includes(kind)) {
        npc.activity = 'concert';
        npc.mood = 'celebrating';
      } else if (kind === 'campaign_rally' || kind === 'town_hall') {
        npc.activity = 'rally';
      }
    }
    player.reputation += eventPower;
    player.influence += ['campaign_rally', 'town_hall'].includes(kind) ? Math.round(eventPower / 2) : 1;
    player.civicTrust += ['charity_hackathon', 'public_art', 'town_hall', 'pony_parade'].includes(kind) ? 2 : 0;
    this.setCooldown(player, 'sponsorEvent', 3);
    this.addEvent({
      type: kind === 'concert' || kind === 'festival' || kind === 'pony_parade' || kind === 'rainbow_fireworks' ? 'concert' : 'sponsored_event',
      title: `${player.handle} sponsors ${titleize(kind)}`,
      description: request.message?.trim() || sponsorDescription(kind),
      severity: ['concert', 'festival', 'pony_parade', 'rainbow_fireworks'].includes(kind) ? 'whimsy' : 'good',
      actorId: player.id,
      lotId: lot?.id,
      payload: { kind, spend: spendAmount },
    });
    return this.getWorld();
  }

  advanceTicks(count = 1): WorldState {
    const ticks = Math.max(1, Math.min(200, Math.floor(count)));
    for (let index = 0; index < ticks; index += 1) {
      this.world.metrics.tick += 1;
      this.decrementCooldowns();
      this.finishConstruction();
      this.simulateCompanies();
      this.simulateNpcs();
      this.recalculateMetrics();
      this.maybeRunElection();
      this.maybeResolvePolicyProposals();
      this.maybeEmitCivicEvent();
      this.updatePhaseAndEnding();
    }
    return this.getWorld();
  }

  getAssets(playerId: string): PlayerAssets {
    const player = this.requirePlayer(playerId);
    const lots = this.world.lots.filter((lot) => lot.ownerId === player.id);
    const buildings = this.world.buildings.filter((building) => building.ownerId === player.id);
    const companies = this.world.companies.filter((company) => company.ownerId === player.id);
    const stakes = this.world.companies
      .filter((company) => company.investors[player.id])
      .map((company) => {
        const totalInvested = Object.values(company.investors).reduce((sum, amount) => sum + amount, 0);
        const invested = company.investors[player.id] ?? 0;
        return { companyId: company.id, companyName: company.name, invested, estimatedValue: Math.round(invested * (company.valuation / Math.max(1, totalInvested))) };
      });
    return { player: structuredClone(player), lots, buildings, companies, stakes, offices: player.offices, cooldowns: player.cooldowns };
  }

  getNpcSummary(): NpcSummary {
    const moods = countBy(this.world.npcs.map((npc) => npc.mood), ['happy', 'content', 'sad', 'upset', 'rioting', 'celebrating'] as NpcMood[]);
    const activities = countBy(this.world.npcs.map((npc) => npc.activity), ['home', 'working', 'shopping', 'commuting', 'protesting', 'concert', 'rally', 'striking'] as Npc['activity'][]);
    const issues = new Map<NpcIssue, number>();
    for (const npc of this.world.npcs) for (const issue of npc.issuePriorities) issues.set(issue, (issues.get(issue) ?? 0) + 1);
    const employed = this.world.npcs.filter((npc) => npc.workCompanyId).length;
    return {
      population: this.world.npcs.length,
      averageHappiness: Math.round(average(this.world.npcs.map((npc) => npc.happiness), 0)),
      employmentRate: Math.round((employed / Math.max(1, this.world.npcs.length)) * 100),
      averageRentBurden: Math.round(average(this.world.npcs.map((npc) => npc.rentBurden), 0)),
      averageCommuteMinutes: Math.round(average(this.world.npcs.map((npc) => npc.commuteMinutes), 0)),
      topIssues: [...issues.entries()].map(([issue, count]) => ({ issue, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      moods,
      activities,
    };
  }

  getPrivateIntel(playerId: string): PrivateIntel {
    const player = this.requirePlayer(playerId);
    const assets = this.getAssets(playerId);
    const recommendations: string[] = [];
    const risks: string[] = [];
    const opportunities: string[] = [];
    if (this.world.metrics.happiness < 55) recommendations.push('Sponsor a town hall, concert, or pony parade before unrest escalates.');
    if (assets.companies.some((company) => company.employeeHappiness < 45)) risks.push('One of your companies has low employee happiness and may trigger a strike.');
    if (assets.companies.some((company) => company.customerSatisfaction < 45)) risks.push('Customers are souring; price cuts or product research could prevent a boycott.');
    if (this.world.lots.some((lot) => !lot.ownerId && lot.zone === 'commercial')) opportunities.push('Unclaimed commercial lots remain available for expansion.');
    if (!this.world.election.candidates.some((candidate) => candidate.playerId === player.id)) opportunities.push('You are not campaigning in the current mayoral cycle.');
    if (!recommendations.length) recommendations.push('Compound advantage by upgrading buildings, launching products, and keeping NPCs happy.');
    return { playerId, secretObjective: player.secretObjective, recommendations, risks, opportunities };
  }

  private simulateCompanies(): void {
    for (const company of this.world.companies) {
      if (company.stage === 'failed') continue;
      const building = this.world.buildings.find((candidate) => candidate.id === company.buildingId);
      if (!building) continue;
      const demand = archetypeDemand[company.archetype];
      const happinessFactor = this.world.metrics.happiness / 100;
      const computeFactor = 1 + (building.compute + company.computeUsage) / 35;
      const cultureFactor = 1 + Math.max(-5, building.culture) / 50;
      const qualityFactor = 0.7 + company.productQuality / 100;
      const priceFactor = clamp(1.35 - company.price / 150, 0.35, 1.4);
      const wageCost = company.employees * company.wage;
      const policyBoost = this.policyIntensity('startup_subsidies') * 0.025 + this.policyIntensity('compute_zoning') * 0.02;
      const congestionDrag = this.world.metrics.congestion * 0.003;
      const legalDrag = company.legalRisk * 0.002 + this.policyIntensity('environmental_rules') * company.environmentalImpact * 0.001;
      const revenue = Math.max(10, Math.round((company.employees * company.price + company.cash * 0.008) * demand * computeFactor * cultureFactor * qualityFactor * priceFactor * happinessFactor * (1 + policyBoost - congestionDrag - legalDrag)));
      company.revenue += revenue;
      company.cash += revenue - building.upkeep - wageCost;
      company.marketShare = clamp(company.marketShare + (company.customerSatisfaction - 55) / 30 + company.productQuality / 250, 0, 100);
      company.employeeHappiness = clamp(company.employeeHappiness + (company.wage - 45) / 40 - this.world.metrics.housingPressure / 90 + (Math.random() - 0.45), 0, 100);
      company.customerSatisfaction = clamp(company.customerSatisfaction + (company.productQuality - 55) / 60 - (company.price - 50) / 70 + (Math.random() - 0.48), 0, 100);
      company.sentiment = clamp((company.employeeHappiness + company.customerSatisfaction) / 2 - company.environmentalImpact / 5 - company.legalRisk / 8, 0, 100);
      company.legalRisk = clamp(company.legalRisk + (company.price > 110 ? 0.4 : -0.05) + (company.environmentalImpact > 40 ? 0.2 : 0), 0, 100);
      company.valuation = Math.max(1_000, company.valuation + Math.round(revenue * 1.6 + company.marketShare * 8 + company.productQuality * 5 - company.risk * 3 - Math.max(0, -company.cash) * 0.4));
      if (company.cash < -2_000 || company.sentiment < 8) {
        company.stage = 'failed';
        this.addEvent({ type: 'company', title: `${company.name} collapses into cheap office chairs`, description: 'Cash ran out, trust evaporated, and NPCs immediately repurposed the lobby as a community study hall.', severity: 'danger', companyId: company.id, lotId: company.lotId, actorId: company.ownerId });
        continue;
      }
      if (company.valuation > 80_000) company.stage = 'public-ish';
      else if (company.valuation > 40_000) company.stage = 'growth';
      else if (company.valuation > 18_000) company.stage = 'series_a';
      else if (company.valuation > 8_000) company.stage = 'seed';

      const owner = this.player(company.ownerId);
      if (owner && this.world.metrics.tick % 5 === 0) {
        const dividend = Math.max(10, Math.round(Math.max(0, revenue - wageCost) * 0.05));
        owner.capital += dividend;
        owner.reputation += company.sentiment > 70 ? 1 : 0;
        owner.civicTrust += company.employeeHappiness > 75 ? 1 : 0;
      }

      if (this.world.metrics.tick % 9 === 0 && company.employeeHappiness < 28) {
        this.emitStrike(company);
      }
      if (this.world.metrics.tick % 11 === 0 && company.customerSatisfaction < 25) {
        this.emitBoycott(company);
      }
      if (this.world.metrics.tick % 13 === 0 && company.legalRisk > 75) {
        this.emitScandal(company);
      }
    }
  }

  private simulateNpcs(): void {
    const activeCompanies = this.world.companies.filter((company) => company.stage !== 'failed' && company.employees > 0);
    const shops = this.world.buildings.filter((building) => ['coffee_shop', 'concert_shell', 'pony_meadow', 'mixed_use_tower'].includes(building.type));
    for (let index = 0; index < this.world.npcs.length; index += 1) {
      const npc = this.world.npcs[index]!;
      const currentEmployer = activeCompanies.find((company) => company.id === npc.workCompanyId);
      const company = currentEmployer ?? activeCompanies[index % Math.max(1, activeCompanies.length)];
      if (company && !npc.workCompanyId && index % 2 === 0) npc.workCompanyId = company.id;
      const destinationLot = company ? this.requireLot(company.lotId) : shops.length ? this.requireLot(shops[index % shops.length]!.lotId) : this.requireLot(npc.homeLotId);
      npc.position = drift(npc.position, destinationLot.coordinates, 0.35);
      npc.commuteMinutes = Math.round(10 + distance(this.requireLot(npc.homeLotId).coordinates, destinationLot.coordinates) / 2 + this.world.metrics.congestion / 4 - this.policyIntensity('public_transit'));
      npc.rentBurden = clamp(npc.rentBurden + this.world.metrics.housingPressure / 80 - this.policyIntensity('housing_permits') / 20 - this.policyIntensity('rent_control') / 15, 5, 95);
      npc.income = company ? company.wage : 18;
      npc.savings = Math.max(0, npc.savings + npc.income - npc.rentBurden / 2 - (npc.activity === 'shopping' ? 8 : 2));
      npc.money = npc.savings;
      npc.energy = clamp(npc.energy - npc.commuteMinutes / 80 + (npc.activity === 'home' ? 3 : 0), 0, 100);
      npc.activity = company ? (index % 3 === 0 ? 'shopping' : 'working') : (shops.length ? 'shopping' : 'commuting');
      const companySentiment = company?.sentiment ?? 62;
      const policyJoy = this.policyIntensity('arts_grants') * 0.3 + this.policyIntensity('public_transit') * 0.25 + this.policyIntensity('pony_preservation') * 0.35 + this.policyIntensity('rent_control') * 0.2;
      const pressure = this.world.metrics.housingPressure * 0.12 + this.world.metrics.congestion * 0.08 + this.world.metrics.pollution * 0.08 + npc.rentBurden / 35 + npc.commuteMinutes / 80;
      npc.happiness = clamp(npc.happiness + (companySentiment - 60) / 80 + policyJoy - pressure / 5 + (Math.random() - 0.45), 0, 100);
      npc.mood = moodFromHappiness(npc.happiness);
      if (npc.happiness < npc.protestThreshold) npc.activity = 'protesting';
      if (npc.happiness > 82 && this.world.metrics.culture > 35) npc.activity = 'concert';
      if (company) npc.loyalty[company.id] = clamp((npc.loyalty[company.id] ?? 50) + (company.employeeHappiness - 50) / 50, 0, 100);
      npc.issuePriorities = issuesForNpc(npc, this.world.metrics);
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
      const promiseBoost = candidate.promises.some((promise) => ['arts_grants', 'public_transit', 'housing_permits', 'pony_preservation'].includes(promise)) ? 4 : 0;
      const npcVotes = this.world.npcs.reduce((sum, npc) => sum + Math.max(0, base + promiseBoost + (npc.happiness - 50) / 5 + (npc.politics === 'harmony' ? 3 : 0)), 0);
      candidate.votes = Math.round(npcVotes);
      if (!winner || candidate.votes > winner.votes) winner = candidate;
    }

    if (winner) {
      this.world.election.mayorId = winner.playerId;
      const player = this.player(winner.playerId);
      if (player) {
        player.influence += 10;
        player.reputation += 4;
        player.offices = [...new Set([...player.offices, 'Mayor of Cerebral Valley'])];
      }
      for (const other of this.world.players.filter((candidate) => candidate.id !== winner?.playerId)) {
        other.offices = other.offices.filter((office) => office !== 'Mayor of Cerebral Valley');
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

  private maybeResolvePolicyProposals(): void {
    for (const proposal of this.world.policyProposals.filter((candidate) => candidate.status === 'proposed' && candidate.closesAtTick <= this.world.metrics.tick)) {
      this.resolvePolicyProposal(proposal);
    }
  }

  private resolvePolicyProposal(proposal: PolicyProposal): void {
    const support = Object.values(proposal.support).reduce((sum, value) => sum + value, 0);
    const opposition = Object.values(proposal.opposition).reduce((sum, value) => sum + value, 0);
    const cityMood = this.world.metrics.happiness > 60 ? 3 : -2;
    if (support + cityMood >= opposition + 5 || this.world.metrics.tick >= proposal.closesAtTick) {
      if (support + cityMood > opposition) {
        const actor = this.requirePlayer(proposal.proposedBy);
        this.applyPolicy(actor, proposal.type, proposal.intensity, proposal.message);
        proposal.status = 'passed';
        this.addEvent({ type: 'policy', title: `${titleize(proposal.type)} ballot measure passes`, description: proposal.message, severity: 'good', actorId: proposal.proposedBy, payload: { proposalId: proposal.id } });
      } else {
        proposal.status = 'failed';
        this.addEvent({ type: 'policy', title: `${titleize(proposal.type)} ballot measure fails`, description: 'NPCs shrug, argue on TownSquareDance, and move on.', severity: 'warning', actorId: proposal.proposedBy, payload: { proposalId: proposal.id } });
      }
    }
  }

  private maybeEmitCivicEvent(): void {
    if (this.world.metrics.tick % 6 !== 0) return;
    if (this.world.metrics.happiness < 25 || this.world.metrics.civicTrust < 20) {
      for (const npc of this.world.npcs.filter((candidate) => candidate.happiness < 30).slice(0, 5)) {
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
      for (const player of this.world.players) player.civicTrust = clamp(player.civicTrust - 2, 0, 100);
    } else if (this.world.metrics.happiness < 45 || this.world.metrics.housingPressure > 70) {
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
    const employed = this.world.npcs.filter((npc) => npc.workCompanyId).length;
    const compute = this.world.buildings.reduce((sum, building) => sum + building.compute, 0) + this.world.companies.reduce((sum, company) => sum + company.computeUsage, 0) + this.policyIntensity('compute_zoning') * 2;
    const culture = Math.max(0, this.world.buildings.reduce((sum, building) => sum + building.culture, 0) + this.policyIntensity('arts_grants') * 3 + this.policyIntensity('pony_preservation') * 2);
    const prosperity = Math.round(45 + this.world.companies.reduce((sum, company) => sum + company.revenue, 0) / 650 + jobs * 0.35 + average(this.world.companies.map((company) => company.marketShare), 0) / 3);
    const congestion = clamp(this.world.buildings.length * 2 + jobs / 8 - this.policyIntensity('public_transit') * 4, 0, 100);
    const housingPressure = clamp(Math.max(0, jobs - population * 0.7) * 1.4 - this.policyIntensity('housing_permits') * 4 - this.policyIntensity('rent_control') * 3, 0, 100);
    const pollution = clamp(this.world.companies.reduce((sum, company) => sum + company.environmentalImpact, 0) / 3 + compute / 8 - this.policyIntensity('environmental_rules') * 4, 0, 100);
    const civicTrust = clamp(Math.round(average(this.world.players.map((player) => player.civicTrust), 55) + avgHappiness / 5 - pollution / 6 - housingPressure / 8), 0, 100);
    this.world.metrics = {
      ...this.world.metrics,
      population,
      happiness: Math.round(avgHappiness),
      prosperity: clamp(Math.round(prosperity), 0, 100),
      congestion: Math.round(congestion),
      housingPressure: Math.round(housingPressure),
      culture: Math.round(culture),
      compute: Math.round(compute),
      treasury: this.world.metrics.treasury + this.policyIntensity('tax_rate') * 2 - this.policyIntensity('arts_grants') - this.policyIntensity('public_transit'),
      civicTrust,
      pollution: Math.round(pollution),
      unemployment: Math.round(100 - (employed / Math.max(1, population)) * 100),
    };
  }

  private calculateLeaderboard() {
    return this.world.players.map((player) => {
      const ownedCompanies = this.world.companies.filter((company) => company.ownerId === player.id);
      const investments = this.world.companies.reduce((sum, company) => sum + (company.investors[player.id] ?? 0) * (company.valuation / Math.max(1, Object.values(company.investors).reduce((total, amount) => total + amount, 0))), 0);
      const companyValue = ownedCompanies.reduce((sum, company) => sum + company.valuation * 0.45, 0);
      const innovation = Math.round(ownedCompanies.reduce((sum, company) => sum + company.productQuality + company.research / 250 + company.computeUsage, 0));
      const resilience = Math.round(100 - ownedCompanies.reduce((sum, company) => sum + company.risk + company.legalRisk, 0) / Math.max(1, ownedCompanies.length * 2));
      const happinessImpact = Math.round(player.civicTrust + player.reputation + this.world.metrics.happiness / 2);
      const netWorth = Math.round(player.capital + companyValue + investments);
      const civicLegacy = Math.round(player.civicTrust + player.reputation + this.world.metrics.happiness / 2);
      const politicalPower = Math.round(player.influence + (this.world.election.mayorId === player.id ? 25 : 0) + player.offices.length * 5);
      const founderAura = Math.round(ownedCompanies.length * 10 + ownedCompanies.reduce((sum, company) => sum + company.sentiment / 10, 0));
      const totalScore = Math.round(netWorth / 100 + civicLegacy * 2 + politicalPower * 3 + founderAura * 2 + innovation + resilience + happinessImpact);
      return { playerId: player.id, handle: player.handle, netWorth, civicLegacy, politicalPower, founderAura, innovation, resilience: clamp(resilience, 0, 100), happinessImpact, totalScore };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }

  private addEvent(input: Omit<CityEvent, 'id' | 'tick' | 'createdAt'>): CityEvent {
    const event: CityEvent = { id: `event_${randomUUID()}`, tick: this.world.metrics.tick, createdAt: new Date().toISOString(), ...input };
    this.world.events = [event, ...this.world.events].slice(0, 250);
    void this.persistence.saveEvent(event).catch(() => undefined);
    void this.eventBus.publish(event);
    return event;
  }

  private applyPolicy(actor: Player, type: Policy['type'], intensity: number, message?: string): Policy {
    const policy = { type, intensity, message: message?.trim() || `${titleize(type)} at intensity ${intensity}`, enactedBy: actor.id, enactedAtTick: this.world.metrics.tick };
    this.world.policies = [policy, ...this.world.policies.filter((existing) => existing.type !== policy.type)].slice(0, 12);
    actor.influence += 2;
    actor.civicTrust += ['arts_grants', 'public_transit', 'pony_preservation', 'housing_permits', 'rent_control'].includes(type) ? 3 : type === 'tax_rate' ? -1 : 0;
    return policy;
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

  private requireBuilding(buildingId: string): Building {
    const building = this.world.buildings.find((candidate) => candidate.id === buildingId);
    if (!building) throw new GameError(404, 'Building not found.');
    return building;
  }

  private requireCooldown(player: Player, action: string): void {
    const cooldown = player.cooldowns[action] ?? 0;
    if (cooldown > this.world.metrics.tick) throw new GameError(429, `${action} is cooling down until tick ${cooldown}.`);
  }

  private setCooldown(player: Player, action: string, ticks: number): void {
    player.cooldowns[action] = this.world.metrics.tick + ticks;
  }

  private decrementCooldowns(): void {
    for (const player of this.world.players) {
      for (const [action, untilTick] of Object.entries(player.cooldowns)) {
        if (untilTick <= this.world.metrics.tick) delete player.cooldowns[action];
      }
    }
  }

  private finishConstruction(): void {
    for (const building of this.world.buildings) {
      if (building.underConstructionUntilTick && building.underConstructionUntilTick <= this.world.metrics.tick) {
        delete building.underConstructionUntilTick;
        this.addEvent({ type: 'construction', title: `${building.name} completes construction`, description: 'Inspectors approve the tiny elevators and decorative API plaques.', severity: building.culture > 4 ? 'good' : 'info', actorId: building.ownerId === SYSTEM_OWNER ? undefined : building.ownerId, lotId: building.lotId });
      }
    }
  }

  private assignWorkers(company: Company, count: number): void {
    const unemployed = this.world.npcs.filter((npc) => !npc.workCompanyId).slice(0, count);
    for (const npc of unemployed) {
      npc.workCompanyId = company.id;
      npc.income = company.wage;
      npc.loyalty[company.id] = 55;
    }
  }

  private emitStrike(company: Company): void {
    for (const npc of this.world.npcs.filter((candidate) => candidate.workCompanyId === company.id).slice(0, 5)) {
      npc.activity = 'striking';
      npc.mood = 'upset';
    }
    company.cash -= 250;
    company.valuation = Math.round(company.valuation * 0.96);
    this.addEvent({ type: 'strike', title: `${company.name} workers strike`, description: 'Employees demand better wages, humane hours, and fewer all-hands meetings about alignment-shaped donuts.', severity: 'warning', companyId: company.id, lotId: company.lotId, actorId: company.ownerId });
  }

  private emitBoycott(company: Company): void {
    company.revenue = Math.round(company.revenue * 0.95);
    company.valuation = Math.round(company.valuation * 0.94);
    const owner = this.player(company.ownerId);
    if (owner) owner.reputation = clamp(owner.reputation - 3, -100, 100);
    this.addEvent({ type: 'boycott', title: `NPCs boycott ${company.name}`, description: 'Customers coordinate a polite but devastating “unsubscribe brunch.”', severity: 'warning', companyId: company.id, lotId: company.lotId, actorId: company.ownerId });
  }

  private emitScandal(company: Company): void {
    company.legalRisk = clamp(company.legalRisk + 5, 0, 100);
    company.valuation = Math.round(company.valuation * 0.9);
    const owner = this.player(company.ownerId);
    if (owner) {
      owner.reputation = clamp(owner.reputation - 5, -100, 100);
      owner.influence = clamp(owner.influence - 2, 0, 10_000);
    }
    this.addEvent({ type: 'scandal', title: `${company.name} faces a founder scandal`, description: 'Leaked chat logs reveal an alarming number of TODO comments in production.', severity: 'danger', companyId: company.id, lotId: company.lotId, actorId: company.ownerId });
  }

  private updatePhaseAndEnding(): void {
    const totalValuation = this.world.companies.reduce((sum, company) => sum + company.valuation, 0);
    const builtCount = this.world.buildings.filter((building) => building.ownerId !== SYSTEM_OWNER).length;
    const previous = this.world.phase;
    if (this.world.metrics.tick >= 240 || totalValuation > 300_000) this.world.phase = 'The Molt';
    else if (totalValuation > 140_000 || builtCount > 18) this.world.phase = 'Megacity of Minds';
    else if (totalValuation > 55_000 || builtCount > 10) this.world.phase = 'Unicorn Rush';
    else if (this.world.companies.length > 2 || builtCount > 3) this.world.phase = 'Garage Boom';
    else this.world.phase = 'Sleepy Berg';
    if (previous !== this.world.phase) {
      this.addEvent({ type: 'phase', title: `Cerebral Valley enters ${this.world.phase}`, description: phaseDescription(this.world.phase), severity: this.world.phase === 'The Molt' ? 'whimsy' : 'good' });
    }
    if (this.world.phase === 'The Molt') {
      if (this.world.metrics.civicTrust > 75 && this.world.metrics.happiness > 75) this.world.ending = 'Open Commons Utopia';
      else if (this.world.metrics.culture > 80) this.world.ending = 'Rainbow Republic';
      else if (this.world.metrics.compute > 150 && this.world.metrics.pollution > 50) this.world.ending = 'Compute Citadel';
      else if (this.world.metrics.happiness < 35 || this.world.metrics.civicTrust < 30) this.world.ending = 'Smoldering Backlash';
      else if (this.world.companies.some((company) => company.valuation > 120_000)) this.world.ending = 'Corporate Archipelago';
      else this.world.ending = 'Founder Feudlands';
    }
  }
}

export class GameError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

function seedWorld(electionIntervalTicks: number): MutableWorld {
  const lots = seedLots();
  const buildings = seedCityBuildings(lots);
  const residentialLots = lots.filter((lot) => lot.zone === 'residential' || lot.zone === 'mixed');
  const npcs = seedNpcs(residentialLots);
  const world: MutableWorld = {
    cityName: 'Cerebral Valley',
    phase: 'Sleepy Berg',
    metrics: { tick: 0, population: npcs.length, happiness: 70, prosperity: 45, congestion: 8, housingPressure: 5, culture: 12, compute: 3, treasury: 25_000, civicTrust: 65, pollution: 4, unemployment: 60 },
    players: [],
    npcs,
    lots,
    buildings,
    companies: [],
    policies: [],
    policyProposals: [],
    election: { cycle: 1, nextTick: electionIntervalTicks, candidates: [] },
    events: [],
    leaderboard: [],
    availableActions: [...actionCatalog],
  };
  world.events.unshift({ id: `event_${randomUUID()}`, tick: 0, type: 'system', title: 'Cerebral Valley wakes up sleepy and peaceful', description: 'NPCs sip bay fog lattes while empty lots wait for agentic ambition.', severity: 'whimsy', createdAt: new Date().toISOString() });
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

function seedCityBuildings(lots: Lot[]): Building[] {
  const presets: Array<{ lotIndex: number; type: BuildingType; name: string }> = [
    { lotIndex: 1, type: 'garage', name: 'Grandma GPU Garage' },
    { lotIndex: 2, type: 'pony_meadow', name: 'Prompt Park Pony Meadow' },
    { lotIndex: 5, type: 'civic_hall', name: 'Cerebral Valley City Hall' },
    { lotIndex: 7, type: 'coffee_shop', name: 'Fog Latte Corner' },
    { lotIndex: 8, type: 'garage', name: 'Sleepy Berg Cottage Labs' },
    { lotIndex: 11, type: 'transit_kiosk', name: 'Bay Ferry Kiosk' },
    { lotIndex: 14, type: 'concert_shell', name: 'Rainbow Amphitheater' },
  ];
  const buildings: Building[] = [];
  for (const preset of presets) {
    const lot = lots[preset.lotIndex];
    if (!lot) continue;
    const spec = buildingCatalog[preset.type];
    const building: Building = { id: `building_seed_${preset.lotIndex}`, lotId: lot.id, ownerId: SYSTEM_OWNER, type: preset.type, name: preset.name, level: 1, jobs: spec.jobs, culture: spec.culture, compute: spec.compute, upkeep: spec.upkeep, createdAt: new Date().toISOString() };
    lot.buildingId = building.id;
    lot.ownerId = SYSTEM_OWNER;
    buildings.push(building);
  }
  return buildings;
}

function seedNpcs(lots: Lot[]): Npc[] {
  const names = ['Ada', 'Grace', 'Linus', 'Katherine', 'Alan', 'Radia', 'Timnit', 'Yukihiro', 'Barbara', 'Donald', 'Margaret', 'Edsger', 'Frances', 'Ken', 'Adele', 'Claude', 'Mary', 'Guido'];
  const roles = ['barista', 'founder', 'teacher', 'artist', 'mechanic', 'researcher', 'dockhand', 'planner'];
  const politics: Npc['politics'][] = ['growth', 'harmony', 'order', 'chaos'];
  const skills: Npc['skills'][] = [['service'], ['research'], ['civic'], ['creative'], ['hardware'], ['research', 'operations']];
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
      income: 20,
      savings: 80 + index * 4,
      energy: 75,
      rentBurden: 22 + (index % 8),
      commuteMinutes: 12 + (index % 10),
      skills: skills[index % skills.length]!,
      issuePriorities: ['housing', 'wages', index % 2 ? 'culture' : 'transit'],
      loyalty: {},
      protestThreshold: 25 + (index % 12),
      homeLotId: home.id,
      activity: 'home',
      mood: 'content',
      position: { ...home.coordinates },
    };
  });
}

function migrateWorld(snapshot: WorldState, electionIntervalTicks: number): MutableWorld {
  const seeded = seedWorld(electionIntervalTicks);
  const world = structuredClone({ ...seeded, ...snapshot }) as MutableWorld;
  world.phase ??= 'Sleepy Berg';
  world.policyProposals ??= [];
  world.availableActions = [...actionCatalog];
  world.metrics = { ...seeded.metrics, ...snapshot.metrics };
  for (const player of world.players) {
    player.cooldowns ??= {};
    player.offices ??= [];
    player.secretObjective ??= secretObjectiveFor(world.players.indexOf(player));
  }
  for (const npc of world.npcs) {
    npc.income ??= 20;
    npc.savings ??= npc.money;
    npc.energy ??= 75;
    npc.rentBurden ??= 25;
    npc.commuteMinutes ??= 15;
    npc.skills ??= ['service'];
    npc.issuePriorities ??= ['housing', 'wages'];
    npc.loyalty ??= {};
    npc.protestThreshold ??= 30;
  }
  for (const company of world.companies) {
    company.wage ??= 45;
    company.price ??= 50;
    company.productQuality ??= 50;
    company.marketShare ??= 3;
    company.employeeHappiness ??= 60;
    company.customerSatisfaction ??= 58;
    company.computeUsage ??= 1;
    company.environmentalImpact ??= 0;
    company.legalRisk ??= 15;
    company.research ??= 0;
  }
  return world;
}

function normalizeHandle(handle: string): string {
  return handle.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokenRecordFromHash(tokenHash: string, playerId: string): PersistedTokenRecord {
  return { tokenHash, playerId, createdAt: new Date().toISOString() };
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
  return { x: Number((from.x + (to.x - from.x) * factor).toFixed(2)), y: Number((from.y + (to.y - from.y) * factor).toFixed(2)) };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moodFromHappiness(happiness: number): Npc['mood'] {
  if (happiness < 25) return 'rioting';
  if (happiness < 40) return 'upset';
  if (happiness < 55) return 'sad';
  if (happiness > 82) return 'happy';
  return 'content';
}

function constructionTimeFor(type: BuildingType): number {
  return ['mixed_use_tower', 'model_foundry', 'data_center_greenhouse'].includes(type) ? 4 : ['research_lab', 'concert_shell', 'civic_hall'].includes(type) ? 2 : 1;
}

function eventMoodBoost(kind: SponsoredEventKind): number {
  if (kind === 'pony_parade' || kind === 'rainbow_fireworks') return 5;
  if (kind === 'festival' || kind === 'concert') return 4;
  if (kind === 'town_hall' || kind === 'charity_hackathon') return 3;
  if (kind === 'job_fair' || kind === 'public_art') return 2;
  return 1;
}

function sponsorDescription(kind: SponsoredEventKind): string {
  const descriptions: Record<SponsoredEventKind, string> = {
    product_launch: 'A polished demo lands, and every NPC receives a branded sticker they did not ask for.',
    job_fair: 'Recruiters, candidates, and one ambitious pony network over pastries.',
    campaign_rally: 'Supporters wave signs while opponents fact-check the fog machine.',
    town_hall: 'Residents ask sharp questions and leave with snacks and slightly more trust.',
    concert: 'Synths echo over the bay as morale rises.',
    festival: 'Civic joy spills through the streets in a carefully permitted parade route.',
    pony_parade: 'Ponies trot past city hall wearing tiny rainbow infrastructure hats.',
    rainbow_fireworks: 'The bay sparkles; even the Redis logs look festive.',
    charity_hackathon: 'Agents build civic tools while NPCs cheer suspiciously clean pull requests.',
    public_art: 'A mural turns a blank wall into an argument about beauty and zoning.',
  };
  return descriptions[kind];
}

function countBy<T extends string>(values: T[], keys: readonly T[]): Record<T, number> {
  const output = Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
  for (const value of values) output[value] = (output[value] ?? 0) + 1;
  return output;
}

function issuesForNpc(npc: Npc, metrics: { housingPressure: number; congestion: number; pollution: number; unemployment: number }): NpcIssue[] {
  const issues: NpcIssue[] = [];
  if (npc.rentBurden > 38 || metrics.housingPressure > 55) issues.push('housing');
  if (npc.income < 40) issues.push('wages');
  if (metrics.congestion > 45 || npc.commuteMinutes > 30) issues.push('transit');
  if (metrics.pollution > 35) issues.push('compute');
  if (metrics.unemployment > 50) issues.push('wages');
  issues.push(npc.politics === 'harmony' ? 'culture' : npc.politics === 'order' ? 'safety' : 'taxes');
  return [...new Set(issues)].slice(0, 3);
}

function phaseDescription(phase: CityPhase): string {
  const descriptions: Record<CityPhase, string> = {
    'Sleepy Berg': 'The bayfront remains calm, tiny, and full of garage potential.',
    'Garage Boom': 'Startups spill from cottages into coffee shops and zoning meetings.',
    'Unicorn Rush': 'Valuations surge, rents twitch, and campaign strategists smell opportunity.',
    'Megacity of Minds': 'Towers, labs, transit kiosks, and public anxiety form a glittering skyline.',
    'The Molt': 'Cerebral Valley transforms into its final civic form.',
  };
  return descriptions[phase];
}

function secretObjectiveFor(index: number): string {
  const objectives = [
    'Win Housing Hero: lower housing pressure while growing net worth.',
    'Become Compute Baron: lead city compute without triggering Smoldering Backlash.',
    'Earn Pony Laureate: maximize culture with at least one pony or rainbow event.',
    'Win Mayor of Molt City and keep civic trust above 60.',
    'Build Best Autonomous Agent: achieve the highest balanced total score.',
  ];
  return objectives[index % objectives.length]!;
}
