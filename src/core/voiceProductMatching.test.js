import { resolveStrictEightySixMatch } from './menuIntelligence';
import { findPrepMatch } from './smartPrep';

describe('86Voice product and prep matching', () => {
  test('86 command resolves a unique inventory product from a short spoken product word', () => {
    const items = [
      { id: 'inv-eggs', name: 'Large Shell Eggs 15 DZ', category: 'Dairy' },
      { id: 'inv-bacon', name: 'Bacon Slab', category: 'Meat' }
    ];
    const resolved = resolveStrictEightySixMatch('eggs', items, []);
    expect(resolved.status).toBe('strong');
    expect(resolved.item?.id).toBe('inv-eggs');
  });

  test('86 command asks for review when the spoken product matches multiple inventory items', () => {
    const items = [
      { id: 'inv-shell-eggs', name: 'Shell Eggs' },
      { id: 'inv-liquid-eggs', name: 'Liquid Eggs' }
    ];
    const resolved = resolveStrictEightySixMatch('eggs', items, []);
    expect(resolved.status).toBe('review');
    expect(resolved.candidates.length).toBeGreaterThanOrEqual(2);
  });

  test('prep voice command updates an existing fuzzy prep row instead of creating a duplicate', () => {
    const match = findPrepMatch([
      { id: 'prep-ranch', date: '2026-07-27', text: 'Fill Ranch Bottles', station: 'Prep Table' }
    ], { itemText: 'ranch', sourceSegment: 'prep two ranch' }, '2026-07-27');
    expect(match?.id).toBe('prep-ranch');
  });
});
