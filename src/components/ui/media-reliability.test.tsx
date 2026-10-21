import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import ScoreBadge from './ScoreBadge';
import { getDistinctSourceCount } from '@/lib/utils';
import type { Review } from '@/lib/types';

describe('media reliability badge', () => {
  test('three case variants remain one source while three filtered reviews can show a score', () => {
    const reviews = ['TopGear', 'topgear', ' TOPGEAR '].map(Testeur => ({ Testeur }) as Review);
    const props = { score: 80, size: 'md' as const, sourceCount: getDistinctSourceCount(reviews), reviewCount: reviews.length };
    expect(renderToStaticMarkup(<ScoreBadge {...props} />)).toContain('--');
    const filtered = renderToStaticMarkup(<ScoreBadge {...props} isFiltered />);
    expect(filtered).toContain('>80<');
    expect(filtered).toContain('Filtré');
    expect(filtered).not.toContain('>--<');
  });
});
