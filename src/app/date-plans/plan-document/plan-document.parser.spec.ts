import { describe, expect, it } from 'vitest';
import { inlineText, parsePlanDocument } from './plan-document.parser';
import { daLatItinerary } from '../itineraries/da-lat-itinerary';

describe('Plan document reader', () => {
  it('preserves itinerary tables, budget and every preparation item', () => {
    const blocks = parsePlanDocument(daLatItinerary.input.note);
    expect(blocks.filter((block) => block.kind === 'table')).toHaveLength(5);
    expect(blocks.find((block) => block.kind === 'checklist')?.items).toHaveLength(9);
    expect(blocks.some((block) => block.text.includes('Ngày 3'))).toBe(true);
    const budget = blocks.filter((block) => block.kind === 'table').at(-1)!;
    expect(budget.rows.at(-1)?.[1]).toBe('**5.550.000–7.180.000**');
  });
  it('formats emphasis without treating content as HTML', () => {
    expect(inlineText('A **bold** and *soft* <img src=x>')).toEqual([
      { text: 'A ', style: 'plain' },
      { text: 'bold', style: 'bold' },
      { text: ' and ', style: 'plain' },
      { text: 'soft', style: 'italic' },
      { text: ' <img src=x>', style: 'plain' },
    ]);
  });
  it('keeps table headers and data while dropping separator rows', () => {
    const [table] = parsePlanDocument('| Time | Plan |\n| --- | --- |\n| 04:00 | Clouds |');
    expect(table.headers).toEqual(['Time', 'Plan']);
    expect(table.rows).toEqual([['04:00', 'Clouds']]);
  });
});
