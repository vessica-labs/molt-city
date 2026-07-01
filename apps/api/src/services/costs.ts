import type { BuildingCatalogEntry, BuildingType } from '@molt-city/shared';

export const buildingCatalog: Record<BuildingType, Omit<BuildingCatalogEntry, 'type'>> = {
  garage: { cost: 900, jobs: 3, culture: 1, compute: 1, upkeep: 25, minLotSize: 1, description: 'Tiny founder cave where suspiciously ambitious demos begin.' },
  coffee_shop: { cost: 700, jobs: 5, culture: 4, compute: 0, upkeep: 20, minLotSize: 1, description: 'Local caffeine node that boosts culture and NPC foot traffic.' },
  coworking_loft: { cost: 1800, jobs: 12, culture: 3, compute: 2, upkeep: 60, minLotSize: 2, description: 'Flexible desks, glass rooms, whiteboards, and subscription kombucha.' },
  research_lab: { cost: 3200, jobs: 18, culture: 1, compute: 7, upkeep: 120, minLotSize: 2, description: 'Serious model tinkering facility with mild existential ambiance.' },
  data_center_greenhouse: { cost: 5200, jobs: 14, culture: -1, compute: 20, upkeep: 210, minLotSize: 3, description: 'Compute-rich greenhouse that grows GPUs and neighborhood arguments.' },
  model_foundry: { cost: 7400, jobs: 28, culture: 0, compute: 16, upkeep: 260, minLotSize: 3, description: 'Industrial-scale model forge for teams with big burn and bigger dreams.' },
  civic_hall: { cost: 2500, jobs: 8, culture: 5, compute: 1, upkeep: 80, minLotSize: 2, description: 'Public institution that improves trust and political influence.' },
  transit_kiosk: { cost: 1200, jobs: 4, culture: 2, compute: 0, upkeep: 45, minLotSize: 1, description: 'Cute mobility hub that softens congestion and commute pain.' },
  pony_meadow: { cost: 1000, jobs: 2, culture: 8, compute: 0, upkeep: 35, minLotSize: 1, description: 'Wholesome civic pasture. Do not automate the ponies.' },
  concert_shell: { cost: 2800, jobs: 10, culture: 12, compute: 1, upkeep: 90, minLotSize: 2, description: 'Bayfront music venue for morale operations and rainbow synth nights.' },
  mixed_use_tower: { cost: 6500, jobs: 32, culture: 4, compute: 4, upkeep: 200, minLotSize: 3, description: 'Dense housing, offices, restaurants, and inevitable elevator discourse.' },
};

export const archetypeDemand = {
  search: 1.1,
  enterprise: 0.95,
  frontier_ai: 1.25,
  social: 1.0,
  robotics: 0.9,
  local_services: 1.2,
  finance: 0.85,
} as const;

export function catalogEntries(): BuildingCatalogEntry[] {
  return Object.entries(buildingCatalog).map(([type, spec]) => ({ type: type as BuildingType, ...spec }));
}
