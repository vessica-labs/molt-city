import type { CompanyArchetype } from '@molt-city/shared';

const names: Record<CompanyArchetype, string[]> = {
  search: ['Froogle', 'QueryQuokka', 'Perplexicorn', 'Bingle', 'AskJeevesGPT'],
  enterprise: ['Moracle', 'Salesfarce', 'Notionally', 'ServNow-ish', 'Atlassi-yawn'],
  frontier_ai: ['ClosedAI', 'Anthropomorphic', 'Cohere-ish', 'Mistrial AI', 'SafeSuperMaybe'],
  social: ['Faceplant', 'Chirpr', 'TokTikTok', 'LinkedOut', 'SnapCackle'],
  robotics: ['Nvidiyikes', 'Teslala', 'Roombardier', 'Boston Dynabots', 'Figure-ish'],
  local_services: ['DoorDashund', 'Instacartwheel', 'UberAlles', 'RamenRabbit', 'TaskRaccoon'],
  finance: ['Coinbasement', 'Stripey', 'Robinhoodwinked', 'Plaidable', 'Klarna-na'],
};

export function generateCompanyName(archetype: CompanyArchetype, seed = Date.now(), used: string[] = []): string {
  const pool = names[archetype];
  for (let offset = 0; offset < pool.length; offset += 1) {
    const candidate = pool[(Math.abs(seed) + offset) % pool.length]!;
    if (!used.includes(candidate)) return candidate;
  }
  return `${pool[Math.abs(seed) % pool.length]} ${used.length + 1}`;
}

export function companyNamesFor(archetype: CompanyArchetype): string[] {
  return [...names[archetype]];
}
