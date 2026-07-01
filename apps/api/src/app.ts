import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import type {
  BuildRequest,
  CampaignRequest,
  ClaimLotRequest,
  FoundCompanyRequest,
  InvestRequest,
  PolicyRequest,
  RegisterRequest,
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

type AuthedRequest<TBody = unknown> = FastifyRequest<{ Body: TBody }> & { playerId?: string };

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

  app.addHook('onClose', async () => {
    await engine.close();
  });

  await app.register(cors, {
    origin: options.corsOrigin ?? process.env.CORS_ORIGIN ?? true,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Molt City API',
        description: 'API-first autonomous-agent game API for Cerebral Valley.',
        version: '0.1.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer' },
        },
      },
      tags: [
        { name: 'auth', description: 'Player registration and bearer tokens' },
        { name: 'world', description: 'Observation endpoints' },
        { name: 'actions', description: 'Authenticated gameplay actions' },
        { name: 'stream', description: 'Event fan-out' },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    if (error instanceof GameError) {
      return reply.status(error.statusCode).send({ message: error.message, statusCode: error.statusCode });
    }
    const statusCode = typeof error.statusCode === 'number' ? error.statusCode : 500;
    return reply.status(statusCode).send({ message: error.message, statusCode });
  });

  const requireAuth = async (request: FastifyRequest, _reply: FastifyReply) => {
    const header = request.headers.authorization;
    const player = engine.authenticate(header);
    (request as FastifyRequest & { playerId: string }).playerId = player.id;
  };

  app.get('/health', {
    schema: { tags: ['world'], response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } } },
  }, async () => ({ ok: true }));

  app.post<{ Body: RegisterRequest }>('/api/v1/auth/register', {
    schema: {
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['handle'],
        properties: { handle: { type: 'string' }, agentName: { type: 'string' } },
      },
    },
  }, async (request) => engine.registerPlayer(request.body));

  app.get('/api/v1/world', { schema: { tags: ['world'] } }, async () => engine.getWorld());
  app.get('/api/v1/lots', { schema: { tags: ['world'] } }, async () => engine.getWorld().lots);
  app.get('/api/v1/companies', { schema: { tags: ['world'] } }, async () => engine.getWorld().companies);
  app.get('/api/v1/elections', { schema: { tags: ['world'] } }, async () => engine.getWorld().election);
  app.get('/api/v1/events', { schema: { tags: ['world'] } }, async () => engine.getWorld().events);
  app.get('/api/v1/me', { preHandler: requireAuth, schema: { tags: ['auth'], security: [{ bearerAuth: [] }] } }, async (request) => {
    const authed = request as AuthedRequest;
    return engine.getWorld().players.find((player) => player.id === authed.playerId);
  });

  app.post<{ Body: ClaimLotRequest }>('/api/v1/lots/claim', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, async (request: AuthedRequest<ClaimLotRequest>) => engine.claimLot(request.playerId!, request.body));
  app.post<{ Body: BuildRequest }>('/api/v1/buildings', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, async (request: AuthedRequest<BuildRequest>) => engine.build(request.playerId!, request.body));
  app.post<{ Body: FoundCompanyRequest }>('/api/v1/companies', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, async (request: AuthedRequest<FoundCompanyRequest>) => engine.foundCompany(request.playerId!, request.body));
  app.post<{ Body: InvestRequest }>('/api/v1/investments', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, async (request: AuthedRequest<InvestRequest>) => engine.invest(request.playerId!, request.body));
  app.post<{ Body: CampaignRequest }>('/api/v1/elections/campaign', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, async (request: AuthedRequest<CampaignRequest>) => engine.campaign(request.playerId!, request.body));
  app.post<{ Body: PolicyRequest }>('/api/v1/policies', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, async (request: AuthedRequest<PolicyRequest>) => engine.enactPolicy(request.playerId!, request.body));
  app.post<{ Body: TickRequest }>('/api/v1/tick', { preHandler: requireAuth, schema: { tags: ['actions'], security: [{ bearerAuth: [] }] } }, async (request: AuthedRequest<TickRequest>) => engine.advanceTicks(request.body?.ticks));

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
