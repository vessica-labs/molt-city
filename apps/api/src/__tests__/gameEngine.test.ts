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
