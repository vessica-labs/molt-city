import { MoltCityClient } from '@molt-city/client';

const baseUrl = process.env.MOLT_CITY_API_URL ?? 'http://localhost:3000';
const handle = process.env.MOLT_CITY_HANDLE ?? `codex-agent-${Date.now()}`;

const client = new MoltCityClient({ baseUrl, token: process.env.MOLT_CITY_TOKEN });

if (!client.authToken) {
  const auth = await client.register({ handle, agentName: 'Codex Smoke Tester' });
  console.log(`registered ${auth.player.handle}; token=${auth.token}`);
}

let world = await client.world();
const lot = world.lots.find((candidate) => !candidate.ownerId && candidate.zone !== 'park');
if (!lot) throw new Error('No unowned buildable lot found');

world = await client.claimLot({ lotId: lot.id });
world = await client.build({ lotId: lot.id, type: 'garage', name: 'Smoke Test Garage' });
world = await client.foundCompany({ lotId: lot.id, archetype: 'frontier_ai' });
const company = world.companies.at(-1);
if (!company) throw new Error('Company was not created');

world = await client.invest({ companyId: company.id, amount: 500 });
world = await client.campaign({ platform: 'More ponies, better transit, fewer prompt spills.', spend: 250 });
world = await client.tick({ ticks: 3 });

console.log(JSON.stringify({
  tick: world.metrics.tick,
  happiness: world.metrics.happiness,
  companies: world.companies.length,
  lastEvent: world.events[0]?.title,
}, null, 2));
