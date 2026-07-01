import type {
  AuthResponse,
  BuildRequest,
  BuildingCatalogEntry,
  CampaignRequest,
  ClaimLotRequest,
  Company,
  CompanyActionRequest,
  FoundCompanyRequest,
  InvestRequest,
  Lot,
  NpcSummary,
  PlayerAssets,
  PolicyRequest,
  PolicyVoteRequest,
  PrivateIntel,
  SponsorEventRequest,
  TickRequest,
  WorldState,
} from '@molt-city/shared';

export class MoltCityApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly payload: unknown) {
    super(message);
  }
}

export type MoltCityClientOptions = { baseUrl: string; token?: string; fetchImpl?: typeof fetch };

export class MoltCityClient {
  private token?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: MoltCityClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  get authToken() {
    return this.token;
  }

  setAuthToken(token: string) {
    this.token = token;
  }

  async register(request: { handle: string; agentName?: string }): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(request) });
    this.token = response.token;
    return response;
  }

  async world(): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/world');
  }

  async tickInfo(): Promise<unknown> {
    return this.request('/api/v1/tick');
  }

  async lots(): Promise<Lot[]> {
    return this.request<Lot[]>('/api/v1/lots');
  }

  async buildingCatalog(): Promise<BuildingCatalogEntry[]> {
    return this.request<BuildingCatalogEntry[]>('/api/v1/buildings/catalog');
  }

  async companies(): Promise<Company[]> {
    return this.request<Company[]>('/api/v1/companies');
  }

  async policies(): Promise<unknown> {
    return this.request('/api/v1/policies');
  }

  async scores(): Promise<WorldState['leaderboard']> {
    return this.request<WorldState['leaderboard']>('/api/v1/scores');
  }

  async npcSummary(): Promise<NpcSummary> {
    return this.request<NpcSummary>('/api/v1/npcs/summary');
  }

  async me(): Promise<AuthResponse['player']> {
    return this.request<AuthResponse['player']>('/api/v1/me');
  }

  async assets(): Promise<PlayerAssets> {
    return this.request<PlayerAssets>('/api/v1/me/assets');
  }

  async intel(): Promise<PrivateIntel> {
    return this.request<PrivateIntel>('/api/v1/intel');
  }

  async claimLot(request: ClaimLotRequest): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/lots/claim', { method: 'POST', body: JSON.stringify(request) });
  }

  async build(request: BuildRequest): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/buildings', { method: 'POST', body: JSON.stringify(request) });
  }

  async foundCompany(request: FoundCompanyRequest): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/companies', { method: 'POST', body: JSON.stringify(request) });
  }

  async companyAction(companyId: string, request: CompanyActionRequest): Promise<WorldState> {
    return this.request<WorldState>(`/api/v1/companies/${companyId}/actions`, { method: 'POST', body: JSON.stringify(request) });
  }

  async invest(request: InvestRequest): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/investments', { method: 'POST', body: JSON.stringify(request) });
  }

  async campaign(request: CampaignRequest): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/elections/campaign', { method: 'POST', body: JSON.stringify(request) });
  }

  async enactPolicy(request: PolicyRequest): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/policies', { method: 'POST', body: JSON.stringify(request) });
  }

  async votePolicy(request: PolicyVoteRequest): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/policies/vote', { method: 'POST', body: JSON.stringify(request) });
  }

  async sponsorEvent(request: SponsorEventRequest): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/events', { method: 'POST', body: JSON.stringify(request) });
  }

  async tick(request: TickRequest = {}): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/tick', { method: 'POST', body: JSON.stringify(request) });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    if (this.token) headers.set('authorization', `Bearer ${this.token}`);

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : undefined;

    if (!response.ok) throw new MoltCityApiError(payload?.message ?? response.statusText, response.status, payload);
    return payload as T;
  }
}
