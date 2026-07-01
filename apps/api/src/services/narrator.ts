import type { CityEvent } from '@molt-city/shared';

export async function narrateCity(events: CityEvent[], apiKey = process.env.OPENAI_API_KEY): Promise<string> {
  const fallback = summarize(events);
  if (!apiKey) return fallback;

  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: process.env.OPENAI_NARRATOR_MODEL ?? 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: 'Write one short, playful city-sim news bulletin for Cerebral Valley. Keep it under 70 words.',
        },
        {
          role: 'user',
          content: events.slice(0, 8).map((event) => `${event.tick}: ${event.title} - ${event.description}`).join('\n'),
        },
      ],
    });
    return response.output_text.trim() || fallback;
  } catch {
    return fallback;
  }
}

function summarize(events: CityEvent[]): string {
  const latest = events[0];
  if (!latest) return 'Cerebral Valley is calm. NPCs sip fog lattes and wait for the next API call.';
  return `${latest.title}: ${latest.description}`;
}
