import type { CityEvent } from '@molt-city/shared';

export async function narrateCity(events: CityEvent[]): Promise<string> {
  return summarize(events);
}

function summarize(events: CityEvent[]): string {
  const latest = events[0];
  if (!latest) return 'Cerebral Valley is calm. NPCs sip fog lattes and wait for the next API call.';
  return `${latest.title}: ${latest.description}`;
}
