import { describe, expect, it } from 'vitest';
import { GameEngine } from '../services/gameEngine.js';

describe('GameEngine', () => {
  it('seeds a peaceful sleepy city without players', () => {
    const engine = new GameEngine({ tickIntervalMs: 0 });
    const world = engine.getWorld();
    expect(world.cityName).toBe('Cerebral Valley');
    expect(world.npcs.length).toBeGreaterThanOrEqual(16);
    expect(world.metrics.happiness).toBeGreaterThan(60);
    expect(world.lots.some((lot) => lot.district === 'Bayfront')).toBe(true);
  });

  it('lets an authenticated player build a garage company and earn revenue through ticks', () => {
    const engine = new GameEngine({ tickIntervalMs: 0 });
    const { player, token } = engine.registerPlayer({ handle: 'tester', agentName: 'Test Agent' });
    const lot = engine.getWorld().lots.find((candidate) => !candidate.ownerId && candidate.zone === 'commercial');
    expect(lot).toBeDefined();

    engine.authenticate(token);
    engine.claimLot(player.id, { lotId: lot!.id });
    engine.build(player.id, { lotId: lot!.id, type: 'garage' });
    const world = engine.foundCompany(player.id, { lotId: lot!.id, archetype: 'frontier_ai' });
    const company = world.companies[0];
    expect(company?.name).toMatch(/ClosedAI|Anthropomorphic|Cohere-ish|Mistrial/);

    const valuationBefore = company!.valuation;
    const afterTicks = engine.advanceTicks(6);
    expect(afterTicks.metrics.tick).toBe(6);
    expect(afterTicks.companies[0]!.valuation).toBeGreaterThan(valuationBefore);
    expect(afterTicks.events.some((event) => event.type === 'company')).toBe(true);
  });

  it('supports investment, campaigning, elections, and mayor policy', () => {
    const engine = new GameEngine({ tickIntervalMs: 0, electionIntervalTicks: 3 });
    const founder = engine.registerPlayer({ handle: 'founder' }).player;
    const backer = engine.registerPlayer({ handle: 'backer' }).player;
    const lot = engine.getWorld().lots.find((candidate) => !candidate.ownerId && candidate.zone === 'commercial')!;
    engine.claimLot(founder.id, { lotId: lot.id });
    engine.build(founder.id, { lotId: lot.id, type: 'garage' });
    let world = engine.foundCompany(founder.id, { lotId: lot.id, archetype: 'search' });
    const company = world.companies[0]!;

    world = engine.invest(backer.id, { companyId: company.id, amount: 1000 });
    expect(world.companies[0]!.investors[backer.id]).toBe(1000);

    engine.campaign(founder.id, { platform: 'Transit, ponies, and ramen.', spend: 1000 });
    world = engine.advanceTicks(3);
    expect(world.election.mayorId).toBe(founder.id);

    world = engine.enactPolicy(founder.id, { type: 'arts_grants', intensity: 7, message: 'Concerts for all.' });
    expect(world.policies[0]?.type).toBe('arts_grants');
  });
});

// Spec coverage for the richer autonomous-agent API surface.
describe('GameEngine expanded gameplay systems', () => {
  it('supports company operations, sponsored events, assets, NPC summary, and private intel', () => {
    const engine = new GameEngine({ tickIntervalMs: 0 });
    const { player } = engine.registerPlayer({ handle: 'operator' });
    const lot = engine.getWorld().lots.find((candidate) => !candidate.ownerId && candidate.zone !== 'park' && candidate.size >= 2)!;
    engine.claimLot(player.id, { lotId: lot.id });
    engine.build(player.id, { lotId: lot.id, type: 'coworking_loft' });
    let world = engine.foundCompany(player.id, { lotId: lot.id, archetype: 'enterprise' });
    const company = world.companies[0]!;

    world = engine.companyAction(player.id, company.id, { action: 'set_wage', wage: 70 });
    expect(world.companies[0]!.wage).toBe(70);
    world = engine.companyAction(player.id, company.id, { action: 'set_price', price: 40 });
    expect(world.companies[0]!.price).toBe(40);
    world = engine.companyAction(player.id, company.id, { action: 'research', amount: 500 });
    expect(world.companies[0]!.productQuality).toBeGreaterThan(45);
    world = engine.sponsorEvent(player.id, { kind: 'pony_parade', spend: 500 });
    expect(world.events[0]!.type).toMatch(/concert|sponsored_event/);

    const assets = engine.getAssets(player.id);
    expect(assets.companies[0]!.id).toBe(company.id);
    expect(engine.getNpcSummary().population).toBeGreaterThan(0);
    expect(engine.getPrivateIntel(player.id).recommendations.length).toBeGreaterThan(0);
  });

  it('lets non-mayors propose and vote on policy measures', () => {
    const engine = new GameEngine({ tickIntervalMs: 0 });
    const proposer = engine.registerPlayer({ handle: 'policy-agent' }).player;
    const supporter = engine.registerPlayer({ handle: 'support-agent' }).player;
    engine.campaign(supporter.id, { platform: 'Influence for transit.', spend: 1500 });
    const proposed = engine.enactPolicy(proposer.id, { type: 'public_transit', intensity: 6, message: 'Little trains for little citizens.' });
    const proposal = proposed.policyProposals[0]!;
    expect(proposal.status).toBe('proposed');
    const voted = engine.votePolicy(supporter.id, { proposalId: proposal.id, support: true, influence: 2 });
    expect(voted.policyProposals[0]!.support[supporter.id]).toBeGreaterThan(0);
  });
});
