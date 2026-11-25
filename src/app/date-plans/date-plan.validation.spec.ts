import { describe, expect, it } from 'vitest';
import { validatePlan } from './date-plan.validation';
import type { PlanInput } from './date-plan';
import { daLatItinerary } from './itineraries/da-lat-itinerary';
const input: PlanInput = {
  title: 'Coffee together',
  date: '2026-12-01',
  location: 'Cafe',
  note: 'Window seat',
};

describe('Date plan validation', () => {
  it('accepts the complete supplied itinerary without truncating it', () => {
    const imported = validatePlan(daLatItinerary.input);
    expect(imported.note).toBe(daLatItinerary.input.note);
    expect(imported.note).toContain('Checklist trước chuyến đi');
    expect(imported.note).toContain('5.550.000–7.180.000');
    expect(imported.date).toBe('');
  });
  it('rejects notes above the supported itinerary limit', () => {
    expect(() => validatePlan({ ...input, note: 'x'.repeat(20_001) })).toThrow();
  });
  it('trims text while allowing an unscheduled plan', () => {
    expect(validatePlan({ title: ' Coffee ', date: '', location: ' ', note: ' hello ' })).toEqual({
      title: 'Coffee',
      date: '',
      location: '',
      note: 'hello',
    });
  });
  it.each(['', '   ', 'a'.repeat(101)])('rejects an empty or oversized title', (title) => {
    expect(() => validatePlan({ ...input, title })).toThrow();
  });
  it.each(['2026-02-30', '2026-13-01', 'tomorrow'])('rejects an invalid date: %s', (date) => {
    expect(() => validatePlan({ ...input, date })).toThrow();
  });
});
