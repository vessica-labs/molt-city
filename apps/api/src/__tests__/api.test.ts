import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('Fastify API', () => {
  it('registers players, protects actions, and exposes OpenAPI docs', async () => {
    const app = await buildApp({ tickIntervalMs: 0 });

    const unauth = await app.inject({ method: 'POST', url: '/api/v1/buildings', payload: {} });
    expect(unauth.statusCode).toBe(401);

    const auth = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { handle: 'api-agent', agentName: 'API Test Agent' },
    });
    expect(auth.statusCode).toBe(200);
    const body = auth.json();
    expect(body.token).toBeTypeOf('string');

    const world = await app.inject({ method: 'GET', url: '/api/v1/world' });
    const lot = world.json().lots.find((candidate: any) => !candidate.ownerId && candidate.zone === 'commercial');

    const claim = await app.inject({
      method: 'POST',
      url: '/api/v1/lots/claim',
      headers: { authorization: `Bearer ${body.token}` },
      payload: { lotId: lot.id },
    });
    expect(claim.statusCode).toBe(200);

    const docs = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(docs.statusCode).toBe(200);
    expect(docs.json().info.title).toContain('Molt City');

    await app.close();
  });
});
