import { describe, expect, it } from 'vitest';
import { generateCompanyName } from '../services/nameGenerator.js';

describe('generateCompanyName', () => {
  it('returns playful riff names for known archetypes', () => {
    const names = new Set(Array.from({ length: 12 }, (_, index) => generateCompanyName('frontier_ai', index)));
    expect(names.has('ClosedAI')).toBe(true);
    expect([...names].some((name) => name.includes('Anthropomorphic'))).toBe(true);
  });

  it('avoids already used names', () => {
    expect(generateCompanyName('search', 0, ['Froogle'])).not.toBe('Froogle');
  });
});
