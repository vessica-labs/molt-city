import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import type {
  BuildRequest,
  CampaignRequest,
  ClaimLotRequest,
  CompanyActionRequest,
  FoundCompanyRequest,
  InvestRequest,
  PolicyRequest,
  PolicyVoteRequest,
  RegisterRequest,
  SponsorEventRequest,
  TickRequest,
} from '@molt-city/shared';
import { createPersistence } from './db/persistence.js';
import { EventBus } from './services/eventBus.js';
import { GameEngine, GameError } from './services/gameEngine.js';
import { narrateCity } from './services/narrator.js';

export type BuildAppOptions = {
  tickIntervalMs?: number;
  electionIntervalTicks?: number;
  databaseUrl?: string;
  redisUrl?: string;
  corsOrigin?: string;
};

type AuthedRequest<TBody = unknown, TParams = Record<string, string>> = FastifyRequest & { body: TBody; params: TParams; playerId?: string };
type IdempotentBody = { idempotencyKey?: string } | undefined;

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env.NODE_ENV === 'test' ? false : true });
  const eventBus = new EventBus(options.redisUrl ?? process.env.REDIS_URL);
  const persistence = createPersistence(options.databaseUrl ?? process.env.DATABASE_URL);
  const engine = new GameEngine({
    tickIntervalMs: options.tickIntervalMs ?? Number(process.env.SIM_TICK_INTERVAL_MS ?? 2_000),
    electionIntervalTicks: options.electionIntervalTicks,
    eventBus,
    persistence,
  });
  await engine.hydrate();

  const idempotencyCache = new Map<string, { expiresAt: number; payload: unknown }>();
  const rateWindows = new Map<string, { resetAt: number; count: number }>();

  app.addHook('onClose', async () => {
    await engine.close();
  });

  await app.register(cors, { origin: options.corsOrigin ?? process.env.CORS_ORIGIN ?? true });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Molt City API',
        description: 'API-first autonomous-agent game API for Cerebral Valley. Mutating endpoints accept an Idempotency-Key header or idempotencyKey JSON field. Authenticated requests are soft-limited to 180 requests/minute/player.',
        version: '1.0.0',
      },
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
      tags: [
        { name: 'auth', description: 'Player registration, profile, assets, and private intelligence' },
        { name: 'world', description: 'Observation endpoints' },
        { name: 'actions', description: 'Authenticated gameplay actions' },
        { name: 'stream', description: 'Event fan-out' },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    if (error instanceof GameError) return reply.status(error.statusCode).send({ message: error.message, statusCode: error.statusCode });
    const statusCode = typeof error.statusCode === 'number' ? error.statusCode : 500;
    return reply.status(statusCode).send({ message: error.message, statusCode });
  });

  const requireAuth = async (request: FastifyRequest, _reply: FastifyReply) => {
    const header = request.headers.authorization;
    const player = engine.authenticate(header);
    const window = rateWindows.get(player.id) ?? { resetAt: Date.now() + 60_000, count: 0 };
    if (Date.now() > window.resetAt) {
      window.resetAt = Date.now() + 60_000;
      window.count = 0;
    }
    window.count += 1;
    rateWindows.set(player.id, window);
    if (window.count > 180) throw new GameError(429, 'Rate limit exceeded: 180 authenticated requests per minute.');
    (request as FastifyRequest & { playerId: string }).playerId = player.id;
  };

  function withIdempotency<TBody extends IdempotentBody, TParams = unknown>(
    handler: (request: AuthedRequest<TBody, TParams>) => unknown,
  ) {
    return async (request: AuthedRequest<TBody, TParams>) => {
      const headerKey = request.headers['idempotency-key'];
      const bodyKey = (request.body as IdempotentBody)?.idempotencyKey;
      const idempotencyKey = typeof headerKey === 'string' ? headerKey : bodyKey;
      if (!idempotencyKey) return handler(request);
      const cacheKey = `${request.playerId}:${request.method}:${request.url}:${idempotencyKey}`;
      const cached = idempotencyCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.payload;
      const payload = handler(request);
      idempotencyCache.set(cacheKey, { expiresAt: Date.now() + 10 * 60_000, payload });
      return payload;
    };
  }

  app.get('/health', {
    schema: { tags: ['world'], response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } } },
  }, async () => ({ ok: true }));

  app.post<{ Body: RegisterRequest }>('/api/v1/auth/register', {
    schema: {
      tags: ['auth'],
      body: { type: 'object', required: ['handle'], properties: { handle: { type: 'string' }, agentName: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, async (request) => engine.registerPlayer(request.body));

  app.get('/api/v1/world', { schema: { tags: ['world'] } }, async () => engine.getWorld());
  app.get('/api/v1/tick', { schema: { tags: ['world'] } }, async () => {
    const world = engine.getWorld();
    return { tick: world.metrics.tick, phase: world.phase, ending: world.ending, nextElectionTick: world.election.nextTick, availableActions: world.availableActions, timing: { cooldownsUseTicks: true, maxManualTickAdvance: 200 } };
  });
  app.get('/api/v1/lots', { schema: { tags: ['world'] } }, async () => engine.getWorld().lots);
  app.get('/api/v1/buildings/catalog', { schema: { tags: ['world'] } }, async () => engine.getBuildingCatalog());
  app.get('/api/v1/companies', { schema: { tags: ['world'] } }, async () => engine.getWorld().companies);
  app.get('/api/v1/elections', { schema: { tags: ['world'] } }, async () => engine.getWorld().election);
  app.get('/api/v1/policies', { schema: { tags: ['world'] } }, async () => {
    const world = engine.getWorld();
    return { active: world.policies, proposals: world.policyProposals };
  });
  app.get('/api/v1/events', { schema: { tags: ['world'] } }, async () => engine.getWorld().events);
  app.get('/api/v1/logs', { schema: { tags: ['world'] } }, async () => engine.getWorld().events);
  app.get('/api/v1/scores', { schema: { tags: ['world'] } }, async () => engine.getWorld().leaderboard);
  app.get('/api/v1/npcs/summary', { schema: { tags: ['world'] } }, async () => engine.getNpcSummary());

  app.get('/api/v1/me', { preHandler: requireAuth, schema: { tags: ['auth'], security: [{ bearerAuth: [] }] } }, async (request) => {
    const authed = request as AuthedRequest;
    return engine.getWorld().players.find((player) => player.id === authed.playerId);
  });
  app.get('/api/v1/me/assets', { preHandler: requireAuth, schema: { tags: ['auth'], security: [{ bearerAuth: [] }] } }, async (request) => engine.getAssets((request as AuthedRequest).playerId!));
  app.get('/api/v1/intel', { preHandler: requireAuth, schema: { tags: ['auth'], security: [{ bearerAuth: [] }] } }, async (request) => engine.getPrivateIntel((request as AuthedRequest).playerId!));

  app.post<{ Body: ClaimLotRequest }>('/api/v1/lots/claim', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, withIdempotency((request) => engine.claimLot(request.playerId!, request.body)));
  app.post<{ Body: BuildRequest }>('/api/v1/buildings', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, withIdempotency((request) => engine.build(request.playerId!, request.body)));
  app.post<{ Body: FoundCompanyRequest }>('/api/v1/companies', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, withIdempotency((request) => engine.foundCompany(request.playerId!, request.body)));
  app.post<{ Body: CompanyActionRequest; Params: { companyId: string } }>('/api/v1/companies/:companyId/actions', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, withIdempotency((request) => engine.companyAction(request.playerId!, request.params.companyId, request.body)));
  app.post<{ Body: InvestRequest }>('/api/v1/investments', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, withIdempotency((request) => engine.invest(request.playerId!, request.body)));
  app.post<{ Body: CampaignRequest }>('/api/v1/elections/campaign', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, withIdempotency((request) => engine.campaign(request.playerId!, request.body)));
  app.post<{ Body: PolicyRequest }>('/api/v1/policies', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, withIdempotency((request) => engine.enactPolicy(request.playerId!, request.body)));
  app.post<{ Body: PolicyVoteRequest }>('/api/v1/policies/vote', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, withIdempotency((request) => engine.votePolicy(request.playerId!, request.body)));
  app.post<{ Body: SponsorEventRequest }>('/api/v1/events', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, withIdempotency((request) => engine.sponsorEvent(request.playerId!, request.body)));
  app.post<{ Body: TickRequest }>('/api/v1/tick', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, withIdempotency((request) => engine.advanceTicks(request.body?.ticks)));

  app.get('/api/v1/narration', { schema: { tags: ['world'] } }, async () => ({ bulletin: await narrateCity(engine.getWorld().events) }));

  app.get('/api/v1/stream', { schema: { tags: ['stream'] } }, async (_request, reply) => {
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'access-control-allow-origin': '*',
    });
    reply.raw.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    const unsubscribe = engine.subscribe((event) => {
      reply.raw.write(`event: city\ndata: ${JSON.stringify(event)}\n\n`);
    });
    reply.raw.on('close', unsubscribe);
  });

  return app;
}
