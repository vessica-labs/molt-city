import type {
  AuthResponse,
  BuildRequest,
  CampaignRequest,
  ClaimLotRequest,
  Company,
  FoundCompanyRequest,
  InvestRequest,
  Lot,
  PolicyRequest,
  RegisterRequest,
  TickRequest,
  WorldState,
} from '@molt-city/shared';

export class MoltCityApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: unknown,
  ) {
    super(message);
  }
}

export type MoltCityClientOptions = {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
};

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

  async register(request: RegisterRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    this.token = response.token;
    return response;
  }

  async world(): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/world');
  }

  async lots(): Promise<Lot[]> {
    return this.request<Lot[]>('/api/v1/lots');
  }

  async companies(): Promise<Company[]> {
    return this.request<Company[]>('/api/v1/companies');
  }

  async claimLot(request: ClaimLotRequest): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/lots/claim', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async build(request: BuildRequest): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/buildings', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async foundCompany(request: FoundCompanyRequest): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/companies', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async invest(request: InvestRequest): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/investments', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async campaign(request: CampaignRequest): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/elections/campaign', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async enactPolicy(request: PolicyRequest): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/policies', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async tick(request: TickRequest = {}): Promise<WorldState> {
    return this.request<WorldState>('/api/v1/tick', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    if (this.token) headers.set('authorization', `Bearer ${this.token}`);

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : undefined;

    if (!response.ok) {
      throw new MoltCityApiError(payload?.message ?? response.statusText, response.status, payload);
    }

    return payload as T;
  }
}
