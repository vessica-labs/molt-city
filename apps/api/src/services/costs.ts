import type { BuildingType } from '@molt-city/shared';

export const buildingCatalog: Record<BuildingType, { cost: number; jobs: number; culture: number; compute: number; upkeep: number; minLotSize: number }> = {
  garage: { cost: 900, jobs: 3, culture: 1, compute: 1, upkeep: 25, minLotSize: 1 },
  coffee_shop: { cost: 700, jobs: 5, culture: 4, compute: 0, upkeep: 20, minLotSize: 1 },
  coworking_loft: { cost: 1800, jobs: 12, culture: 3, compute: 2, upkeep: 60, minLotSize: 2 },
  research_lab: { cost: 3200, jobs: 18, culture: 1, compute: 7, upkeep: 120, minLotSize: 2 },
  data_center_greenhouse: { cost: 5200, jobs: 14, culture: -1, compute: 20, upkeep: 210, minLotSize: 3 },
  model_foundry: { cost: 7400, jobs: 28, culture: 0, compute: 16, upkeep: 260, minLotSize: 3 },
  civic_hall: { cost: 2500, jobs: 8, culture: 5, compute: 1, upkeep: 80, minLotSize: 2 },
  transit_kiosk: { cost: 1200, jobs: 4, culture: 2, compute: 0, upkeep: 45, minLotSize: 1 },
  pony_meadow: { cost: 1000, jobs: 2, culture: 8, compute: 0, upkeep: 35, minLotSize: 1 },
  concert_shell: { cost: 2800, jobs: 10, culture: 12, compute: 1, upkeep: 90, minLotSize: 2 },
  mixed_use_tower: { cost: 6500, jobs: 32, culture: 4, compute: 4, upkeep: 200, minLotSize: 3 },
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
