import { MoltCityApiError, MoltCityClient } from '@molt-city/client';
import type {
  BuildingCatalogEntry,
  BuildingType,
  Company,
  CompanyArchetype,
  Lot,
  PlayerAssets,
  PolicyType,
  SponsoredEventKind,
  WorldState,
} from '@molt-city/shared';

type BotPersona = {
  handle: string;
  agentName: string;
  archetype: CompanyArchetype;
  preferredZones: Lot['zone'][];
  buildingPlan: BuildingType[];
  civicBias: 'growth' | 'harmony' | 'order' | 'culture' | 'chaos';
  riskTolerance: number;
};

type Bot = BotPersona & {
  client: MoltCityClient;
  playerId: string;
};

type BotDecision = {
  label: string;
  run: () => Promise<WorldState>;
};

const baseUrl = process.env.MOLT_CITY_API_URL ?? 'http://localhost:3000';
const playerCount = readIntEnv('MOLT_CITY_SIM_PLAYERS', 10);
const roundDelayMs = readIntEnv('MOLT_CITY_SIM_ROUND_MS', 2_500);
const ticksPerRound = readIntEnv('MOLT_CITY_SIM_TICKS_PER_ROUND', 1);
const configuredRunId = process.env.MOLT_CITY_SIM_RUN_ID;
let activeRunId = configuredRunId ?? timestampRunId();
const shouldAdvanceTicks = process.env.MOLT_CITY_SIM_ADVANCE_TICKS !== 'false';

const buildingCatalog: BuildingCatalogEntry[] = [
  { type: 'garage', cost: 900, jobs: 3, culture: 1, compute: 1, upkeep: 25, minLotSize: 1, description: 'Tiny founder cave where suspiciously ambitious demos begin.' },
  { type: 'coffee_shop', cost: 700, jobs: 5, culture: 4, compute: 0, upkeep: 20, minLotSize: 1, description: 'Local caffeine node that boosts culture and NPC foot traffic.' },
  { type: 'coworking_loft', cost: 1_800, jobs: 12, culture: 3, compute: 2, upkeep: 60, minLotSize: 2, description: 'Flexible desks, glass rooms, whiteboards, and subscription kombucha.' },
  { type: 'research_lab', cost: 3_200, jobs: 18, culture: 1, compute: 7, upkeep: 120, minLotSize: 2, description: 'Serious model tinkering facility with mild existential ambiance.' },
  { type: 'data_center_greenhouse', cost: 5_200, jobs: 14, culture: -1, compute: 20, upkeep: 210, minLotSize: 3, description: 'Compute-rich greenhouse that grows GPUs and neighborhood arguments.' },
  { type: 'model_foundry', cost: 7_400, jobs: 28, culture: 0, compute: 16, upkeep: 260, minLotSize: 3, description: 'Industrial-scale model forge for teams with big burn and bigger dreams.' },
  { type: 'civic_hall', cost: 2_500, jobs: 8, culture: 5, compute: 1, upkeep: 80, minLotSize: 2, description: 'Public institution that improves trust and political influence.' },
  { type: 'transit_kiosk', cost: 1_200, jobs: 4, culture: 2, compute: 0, upkeep: 45, minLotSize: 1, description: 'Cute mobility hub that softens congestion and commute pain.' },
  { type: 'pony_meadow', cost: 1_000, jobs: 2, culture: 8, compute: 0, upkeep: 35, minLotSize: 1, description: 'Wholesome civic pasture. Do not automate the ponies.' },
  { type: 'concert_shell', cost: 2_800, jobs: 10, culture: 12, compute: 1, upkeep: 90, minLotSize: 2, description: 'Bayfront music venue for morale operations and rainbow synth nights.' },
  { type: 'mixed_use_tower', cost: 6_500, jobs: 32, culture: 4, compute: 4, upkeep: 200, minLotSize: 3, description: 'Dense housing, offices, restaurants, and inevitable elevator discourse.' },
];

const personas: BotPersona[] = [
  { handle: 'permit-pusher', agentName: 'Permit Pusher', archetype: 'enterprise', preferredZones: ['commercial', 'mixed', 'civic'], buildingPlan: ['coworking_loft', 'mixed_use_tower', 'civic_hall'], civicBias: 'growth', riskTolerance: 45 },
  { handle: 'pony-union', agentName: 'Pony Union Steward', archetype: 'local_services', preferredZones: ['park', 'civic', 'residential'], buildingPlan: ['pony_meadow', 'coffee_shop', 'concert_shell'], civicBias: 'harmony', riskTolerance: 20 },
  { handle: 'gpu-barge', agentName: 'GPU Barge Captain', archetype: 'frontier_ai', preferredZones: ['industrial', 'mixed', 'commercial'], buildingPlan: ['research_lab', 'data_center_greenhouse', 'model_foundry'], civicBias: 'growth', riskTolerance: 78 },
  { handle: 'transit-maxi', agentName: 'Transit Maximalist', archetype: 'local_services', preferredZones: ['civic', 'mixed', 'commercial'], buildingPlan: ['transit_kiosk', 'mixed_use_tower', 'coffee_shop'], civicBias: 'order', riskTolerance: 30 },
  { handle: 'ramen-social', agentName: 'Ramen Social Graph', archetype: 'social', preferredZones: ['commercial', 'residential', 'mixed'], buildingPlan: ['coffee_shop', 'coworking_loft', 'concert_shell'], civicBias: 'culture', riskTolerance: 58 },
  { handle: 'quant-civic', agentName: 'Quantified Civic Fund', archetype: 'finance', preferredZones: ['commercial', 'mixed', 'industrial'], buildingPlan: ['coworking_loft', 'mixed_use_tower', 'research_lab'], civicBias: 'order', riskTolerance: 52 },
  { handle: 'robot-sidewalk', agentName: 'Sidewalk Robotics', archetype: 'robotics', preferredZones: ['industrial', 'commercial', 'mixed'], buildingPlan: ['garage', 'model_foundry', 'research_lab'], civicBias: 'growth', riskTolerance: 66 },
  { handle: 'search-cafe', agentName: 'Search Cafe Syndicate', archetype: 'search', preferredZones: ['commercial', 'mixed', 'residential'], buildingPlan: ['coffee_shop', 'coworking_loft', 'research_lab'], civicBias: 'culture', riskTolerance: 40 },
  { handle: 'rent-sentinel', agentName: 'Rent Sentinel', archetype: 'enterprise', preferredZones: ['residential', 'mixed', 'civic'], buildingPlan: ['mixed_use_tower', 'civic_hall', 'transit_kiosk'], civicBias: 'harmony', riskTolerance: 25 },
  { handle: 'chaos-demo-day', agentName: 'Chaos Demo Day', archetype: 'frontier_ai', preferredZones: ['industrial', 'commercial', 'mixed'], buildingPlan: ['garage', 'research_lab', 'data_center_greenhouse'], civicBias: 'chaos', riskTolerance: 90 },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log(`[sim] connecting to ${baseUrl}`);
  let bots: Bot[] = [];
  let world: WorldState | undefined;
  let round = 0;

  while (true) {
    try {
      if (!world || shouldReconnectBots(bots, world)) {
        if (bots.length && !configuredRunId) activeRunId = timestampRunId();
        bots = await connectBots();
        world = await bots[0]?.client.world();
        if (!world) throw new Error('No simulator bots were registered.');
        round = 0;
      }

      round += 1;
      console.log(`[sim] round ${round} tick=${world.metrics.tick} phase="${world.phase}" players=${world.players.length} companies=${world.companies.length}`);

      for (const bot of bots) {
        world = await bot.client.world();
        if (shouldReconnectBots(bots, world)) throw new SimulatorReconnect('registered bot cohort disappeared from world');
        const assets = await bot.client.assets();
        const decision = chooseDecision(bot, world, assets);
        if (!decision) {
          console.log(`[sim] ${bot.handle}: observes`);
          continue;
        }
        world = await runDecision(bot, decision, world);
        await sleep(100);
      }

      if (shouldAdvanceTicks && bots[0]) {
        world = await runDecision(bots[0], {
          label: `advances ${ticksPerRound} tick${ticksPerRound === 1 ? '' : 's'}`,
          run: () => bots[0]!.client.tick({ ticks: ticksPerRound, idempotencyKey: key(bots[0]!, 'tick', round) }),
        }, world);
      }

      printScoreboard(world);
      await sleep(roundDelayMs);
    } catch (error) {
      if (isRecoverableSimulatorError(error)) {
        console.log(`[sim] reconnecting players (${error instanceof Error ? error.message : String(error)})`);
        if (!configuredRunId) activeRunId = timestampRunId();
        bots = [];
        world = undefined;
        await sleep(1_000);
        await waitForApi();
        continue;
      }
      throw error;
    }
  }
}

async function connectBots(): Promise<Bot[]> {
  await waitForApi();
  const bots = await registerBots(personas.slice(0, playerCount));
  console.log(`[sim] ${bots.length} players online for run ${activeRunId}`);
  return bots;
}

async function waitForApi() {
  const client = new MoltCityClient({ baseUrl });
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    try {
      await client.world();
      return;
    } catch {
      await sleep(800);
    }
  }
  throw new Error(`API did not respond at ${baseUrl} within 30s`);
}

async function registerBots(botPersonas: BotPersona[]): Promise<Bot[]> {
  const bots: Bot[] = [];
  for (const persona of botPersonas) {
    const client = new MoltCityClient({ baseUrl });
    const handle = `${persona.handle}-${activeRunId}`;
    const auth = await client.register({ handle, agentName: persona.agentName });
    bots.push({ ...persona, handle: auth.player.handle, playerId: auth.player.id, client });
    console.log(`[sim] registered ${auth.player.handle}`);
  }
  return bots;
}

function chooseDecision(bot: Bot, world: WorldState, assets: PlayerAssets): BotDecision | undefined {
  const player = assets.player;
  const catalog = affordableCatalog(world, player.capital);
  const ownedLotsWithoutBuildings = assets.lots.filter((lot) => !lot.buildingId);
  const ownedBuildingsWithoutCompanies = assets.buildings.filter((building) => !assets.companies.some((company) => company.buildingId === building.id));
  const activeCompanies = assets.companies.filter((company) => company.stage !== 'failed');
  const needsCivicHelp = world.metrics.happiness < 45 || world.metrics.civicTrust < 45;

  if (canAct(player.cooldowns.claimLot) && assets.lots.length < 2) {
    const lot = chooseLot(bot, world.lots, player.capital);
    if (lot) return { label: `claims ${lot.name}`, run: () => bot.client.claimLot({ lotId: lot.id, idempotencyKey: key(bot, 'claim', world.metrics.tick) }) };
  }

  if (canAct(player.cooldowns.build) && ownedLotsWithoutBuildings.length && catalog.length) {
    const lot = chooseOwnedBuildLot(ownedLotsWithoutBuildings, catalog, bot);
    const buildingType = lot ? chooseBuilding(bot, lot, catalog) : undefined;
    if (lot && buildingType) {
      return {
        label: `builds ${titleize(buildingType)} on ${lot.name}`,
        run: () => bot.client.build({ lotId: lot.id, type: buildingType, name: `${bot.agentName} ${titleize(buildingType)}`, idempotencyKey: key(bot, 'build', world.metrics.tick) }),
      };
    }
  }

  if (canAct(player.cooldowns.foundCompany) && ownedBuildingsWithoutCompanies.length && player.capital >= 1_000) {
    const building = ownedBuildingsWithoutCompanies.sort((a, b) => b.compute + b.jobs - (a.compute + a.jobs))[0];
    if (building) {
      return {
        label: `founds a ${bot.archetype.replace('_', ' ')} company`,
        run: () => bot.client.foundCompany({ lotId: building.lotId, archetype: bot.archetype, name: companyName(bot, world), idempotencyKey: key(bot, 'found', world.metrics.tick) }),
      };
    }
  }

  const company = chooseCompanyToOperate(bot, activeCompanies);
  if (company) {
    const action = chooseCompanyAction(bot, company, assets, world);
    if (action) return action;
  }

  if (canAct(player.cooldowns.sponsorEvent) && (needsCivicHelp || bot.civicBias === 'culture') && player.capital > 1_200) {
    const kind = chooseSponsoredEvent(bot, world);
    const lot = chooseEventLot(world, bot);
    return {
      label: `sponsors ${titleize(kind)}`,
      run: () => bot.client.sponsorEvent({
        kind,
        spend: bot.civicBias === 'chaos' ? 450 : 650,
        lotId: lot?.id,
        message: `${bot.agentName} tries to bend city mood with ${titleize(kind).toLowerCase()}.`,
        idempotencyKey: key(bot, 'event', world.metrics.tick),
      }),
    };
  }

  if (canAct(player.cooldowns.campaign) && shouldCampaign(bot, world, assets)) {
    return {
      label: 'campaigns for mayor',
      run: () => bot.client.campaign({
        platform: platformFor(bot, world),
        spend: Math.min(850, Math.max(200, Math.floor(player.capital * 0.08))),
        promises: promisesFor(bot),
        idempotencyKey: key(bot, 'campaign', world.metrics.tick),
      }),
    };
  }

  const proposal = world.policyProposals.find((candidate) => candidate.status === 'proposed' && candidate.proposedBy !== player.id);
  if (canAct(player.cooldowns.policyVote) && proposal && player.influence > 0) {
    return {
      label: `${supportsPolicy(bot, proposal.type) ? 'supports' : 'opposes'} ${titleize(proposal.type)}`,
      run: () => bot.client.votePolicy({
        proposalId: proposal.id,
        support: supportsPolicy(bot, proposal.type),
        influence: Math.min(player.influence, 3),
        idempotencyKey: key(bot, 'vote', world.metrics.tick),
      }),
    };
  }

  if (canAct(player.cooldowns.policy) && player.influence > 2 && world.policyProposals.length < 3 && world.metrics.tick % 7 === 0) {
    const type = policyFor(bot, world);
    return {
      label: `proposes ${titleize(type)}`,
      run: () => bot.client.enactPolicy({
        type,
        intensity: bot.civicBias === 'chaos' ? 8 : 5,
        message: `${bot.agentName} argues ${titleize(type).toLowerCase()} is the next API primitive.`,
        idempotencyKey: key(bot, 'policy', world.metrics.tick),
      }),
    };
  }

  if (canAct(player.cooldowns.invest) && player.capital > 1_000) {
    const target = world.companies
      .filter((candidate) => candidate.ownerId !== player.id && candidate.stage !== 'failed')
      .sort((a, b) => scoreCompanyForInvestment(b) - scoreCompanyForInvestment(a))[0];
    if (target) {
      return {
        label: `invests in ${target.name}`,
        run: () => bot.client.invest({ companyId: target.id, amount: 500, idempotencyKey: key(bot, 'invest', world.metrics.tick) }),
      };
    }
  }

  return undefined;
}

function chooseCompanyAction(bot: Bot, company: Company, assets: PlayerAssets, world: WorldState): BotDecision | undefined {
  const player = assets.player;
  const building = assets.buildings.find((candidate) => candidate.id === company.buildingId);
  if (!building) return undefined;

  if (canAct(player.cooldowns['company:set_wage']) && company.employeeHappiness < 52 && company.wage < 75) {
    const wage = bot.civicBias === 'harmony' ? 72 : 62;
    return { label: `raises wages at ${company.name}`, run: () => bot.client.companyAction(company.id, { action: 'set_wage', wage, idempotencyKey: key(bot, 'wage', world.metrics.tick) }) };
  }

  if (canAct(player.cooldowns['company:set_price']) && company.customerSatisfaction < 48 && company.price > 30) {
    return { label: `cuts prices at ${company.name}`, run: () => bot.client.companyAction(company.id, { action: 'set_price', price: 35, idempotencyKey: key(bot, 'price', world.metrics.tick) }) };
  }

  if (canAct(player.cooldowns['company:hire']) && company.employees < building.jobs && player.capital > 500) {
    return { label: `hires NPCs at ${company.name}`, run: () => bot.client.companyAction(company.id, { action: 'hire', count: Math.min(3, building.jobs - company.employees), idempotencyKey: key(bot, 'hire', world.metrics.tick) }) };
  }

  if (canAct(player.cooldowns['company:research']) && company.productQuality < 76 && player.capital > 900) {
    return { label: `researches at ${company.name}`, run: () => bot.client.companyAction(company.id, { action: 'research', amount: bot.riskTolerance > 70 ? 850 : 500, idempotencyKey: key(bot, 'research', world.metrics.tick) }) };
  }

  if (canAct(player.cooldowns['company:buy_compute']) && ['frontier_ai', 'search', 'robotics'].includes(company.archetype) && company.computeUsage < 14 && player.capital > 1_200) {
    return { label: `buys compute for ${company.name}`, run: () => bot.client.companyAction(company.id, { action: 'buy_compute', amount: bot.riskTolerance > 70 ? 10 : 5, idempotencyKey: key(bot, 'compute', world.metrics.tick) }) };
  }

  if (canAct(player.cooldowns['company:launch_product']) && company.productQuality > 58 && player.capital > 1_400 && world.metrics.tick - (company.lastProductLaunchTick ?? 0) > 4) {
    return { label: `launches product at ${company.name}`, run: () => bot.client.companyAction(company.id, { action: 'launch_product', spend: bot.riskTolerance > 65 ? 1_100 : 700, idempotencyKey: key(bot, 'launch', world.metrics.tick) }) };
  }

  if (canAct(player.cooldowns['company:expand']) && company.valuation > 10_000 && player.capital > 3_500) {
    const nextBuilding = bot.buildingPlan.find((type) => type !== building.type) ?? 'mixed_use_tower';
    return { label: `expands ${company.name}`, run: () => bot.client.companyAction(company.id, { action: 'expand', buildingType: nextBuilding, idempotencyKey: key(bot, 'expand', world.metrics.tick) }) };
  }

  return undefined;
}

async function runDecision(bot: Bot, decision: BotDecision, currentWorld: WorldState): Promise<WorldState> {
  try {
    const world = await decision.run();
    console.log(`[sim] ${bot.handle}: ${decision.label}`);
    return world;
  } catch (error) {
    if (error instanceof MoltCityApiError) {
      console.log(`[sim] ${bot.handle}: skipped ${decision.label} (${error.status} ${error.message})`);
      return currentWorld;
    }
    console.log(`[sim] ${bot.handle}: errored ${decision.label} (${error instanceof Error ? error.message : String(error)})`);
    return currentWorld;
  }
}

function chooseLot(bot: Bot, lots: Lot[], capital: number): Lot | undefined {
  const candidates = lots
    .filter((lot) => !lot.ownerId && lot.zone !== 'park' && lot.price <= capital * 0.72)
    .sort((a, b) => lotScore(bot, b) - lotScore(bot, a));
  return candidates[0];
}

function chooseOwnedBuildLot(lots: Lot[], catalog: BuildingCatalogEntry[], bot: Bot): Lot | undefined {
  return lots
    .filter((lot) => bot.buildingPlan.some((type) => catalog.some((entry) => entry.type === type && entry.minLotSize <= lot.size)))
    .sort((a, b) => lotScore(bot, b) - lotScore(bot, a))[0];
}

function chooseBuilding(bot: Bot, lot: Lot, catalog: BuildingCatalogEntry[]): BuildingType | undefined {
  const planned = bot.buildingPlan.find((type) => catalog.some((entry) => entry.type === type && entry.minLotSize <= lot.size));
  if (planned) return planned;
  return catalog.filter((entry) => entry.minLotSize <= lot.size).sort((a, b) => b.jobs + b.compute - (a.jobs + a.compute))[0]?.type;
}

function affordableCatalog(world: WorldState, capital: number): BuildingCatalogEntry[] {
  void world;
  return buildingCatalog.filter((entry) => entry.cost <= capital * 0.76);
}

function chooseCompanyToOperate(bot: Bot, companies: Company[]): Company | undefined {
  return companies.sort((a, b) => companyNeedScore(bot, b) - companyNeedScore(bot, a))[0];
}

function chooseSponsoredEvent(bot: Bot, world: WorldState): SponsoredEventKind {
  if (world.metrics.happiness < 35) return bot.civicBias === 'chaos' ? 'campaign_rally' : 'pony_parade';
  if (world.metrics.civicTrust < 45) return 'town_hall';
  if (bot.civicBias === 'culture') return 'concert';
  if (bot.civicBias === 'harmony') return 'charity_hackathon';
  return bot.riskTolerance > 70 ? 'product_launch' : 'job_fair';
}

function chooseEventLot(world: WorldState, bot: Bot): Lot | undefined {
  return world.lots.find((lot) => lot.ownerId && bot.preferredZones.includes(lot.zone)) ?? world.lots.find((lot) => lot.ownerId);
}

function shouldCampaign(bot: Bot, world: WorldState, assets: PlayerAssets): boolean {
  const alreadyRunning = world.election.candidates.some((candidate) => candidate.playerId === assets.player.id);
  if (alreadyRunning) return false;
  const ticksUntilElection = world.election.nextTick - world.metrics.tick;
  return assets.player.capital > 600 && (ticksUntilElection < 18 || bot.civicBias === 'order' || bot.civicBias === 'chaos');
}

function platformFor(bot: Bot, world: WorldState): string {
  if (bot.civicBias === 'harmony') return 'More housing, happier NPCs, protected ponies, and humane wages.';
  if (bot.civicBias === 'order') return 'Transit reliability, civic trust, safety, and boringly competent APIs.';
  if (bot.civicBias === 'culture') return 'Concerts, public art, cafes, and a city where NPCs have third places.';
  if (bot.civicBias === 'chaos') return `Move fast, launch often, and let the market debug tick ${world.metrics.tick}.`;
  return 'Startup density, faster permits, more compute, and enough housing to keep builders nearby.';
}

function promisesFor(bot: Bot): PolicyType[] {
  if (bot.civicBias === 'harmony') return ['housing_permits', 'rent_control', 'pony_preservation'];
  if (bot.civicBias === 'order') return ['public_transit', 'campaign_finance', 'environmental_rules'];
  if (bot.civicBias === 'culture') return ['arts_grants', 'public_transit', 'pony_preservation'];
  if (bot.civicBias === 'chaos') return ['startup_subsidies', 'compute_zoning', 'tax_rate'];
  return ['startup_subsidies', 'housing_permits', 'compute_zoning'];
}

function policyFor(bot: Bot, world: WorldState): PolicyType {
  if (world.metrics.housingPressure > 55) return bot.civicBias === 'harmony' ? 'rent_control' : 'housing_permits';
  if (world.metrics.congestion > 45) return 'public_transit';
  if (world.metrics.pollution > 30) return bot.civicBias === 'chaos' ? 'compute_zoning' : 'environmental_rules';
  return promisesFor(bot)[0] ?? 'startup_subsidies';
}

function supportsPolicy(bot: Bot, type: PolicyType): boolean {
  if (bot.civicBias === 'chaos') return ['startup_subsidies', 'compute_zoning', 'tax_rate'].includes(type);
  if (bot.civicBias === 'growth') return ['startup_subsidies', 'housing_permits', 'compute_zoning', 'public_transit'].includes(type);
  if (bot.civicBias === 'harmony') return ['housing_permits', 'arts_grants', 'public_transit', 'pony_preservation', 'rent_control'].includes(type);
  if (bot.civicBias === 'culture') return ['arts_grants', 'public_transit', 'pony_preservation', 'campaign_finance'].includes(type);
  return !['tax_rate'].includes(type);
}

function lotScore(bot: Bot, lot: Lot): number {
  const zone = bot.preferredZones.includes(lot.zone) ? 40 : 0;
  return zone + lot.desirability + lot.size * 12 - lot.price / 300;
}

function companyNeedScore(bot: Bot, company: Company): number {
  return (100 - company.employeeHappiness) + (100 - company.customerSatisfaction) + (bot.riskTolerance - company.risk) / 5 + company.valuation / 10_000;
}

function scoreCompanyForInvestment(company: Company): number {
  return company.valuation / 500 + company.productQuality + company.customerSatisfaction + company.employeeHappiness - company.risk;
}

function companyName(bot: Bot, world: WorldState): string {
  const suffixes = ['Labs', 'Works', 'Systems', 'Studio', 'Exchange', 'Collective', 'Dynamics'];
  const suffix = suffixes[(world.metrics.tick + bot.handle.length) % suffixes.length] ?? 'Labs';
  return `${bot.agentName} ${suffix}`;
}

function canAct(value: number | undefined): boolean {
  return !value || value <= 0;
}

function key(bot: Bot, action: string, tick: number) {
  return `${activeRunId}:${bot.playerId}:${action}:${tick}:${Date.now()}`;
}

function titleize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function timestampRunId() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function shouldReconnectBots(bots: Bot[], world: WorldState): boolean {
  if (bots.length === 0) return true;
  const worldPlayerIds = new Set(world.players.map((player) => player.id));
  return bots.some((bot) => !worldPlayerIds.has(bot.playerId));
}

function isRecoverableSimulatorError(error: unknown): boolean {
  if (error instanceof SimulatorReconnect) return true;
  if (error instanceof MoltCityApiError) return error.status === 401 || error.status === 404 || error.status === 409;
  return error instanceof TypeError && error.message.toLowerCase().includes('fetch failed');
}

class SimulatorReconnect extends Error {}

function printScoreboard(world: WorldState) {
  const leaders = world.leaderboard.slice(0, 5).map((entry) => `${entry.handle}:${entry.totalScore}`).join(' | ');
  console.log(`[sim] city happiness=${world.metrics.happiness} trust=${world.metrics.civicTrust} prosperity=${world.metrics.prosperity} leaders=${leaders || 'none yet'}`);
}

process.once('SIGINT', () => {
  console.log('\n[sim] stopping');
  process.exit(0);
});

main().catch((error) => {
  console.error(`[sim] fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
