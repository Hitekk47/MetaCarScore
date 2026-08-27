import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { supabase } from '@/lib/supabase';
import { getReviews } from './queries';

mock.module('@/lib/supabase', () => {
  const mockFrom = mock();
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

describe('getReviews with aliases', () => {
  beforeEach(() => {
    (supabase.from as any).mockClear?.();
  });

  it('should fetch unified reviews for canonical vehicle and its alias', async () => {
    let capturedOrQuery = '';

    const mockAliasChain = {
      select: mock(() => mockAliasChain),
      or: mock(() =>
        Promise.resolve({
          data: [
            {
              canonical_marque: 'Chery',
              canonical_famille: 'Tiggo 7',
              canonical_modele: null,
              canonical_my: null,
              alias_marque: 'Ebro',
              alias_famille: 'S700',
              alias_modele: null,
            },
          ],
          error: null,
        })
      ),
    };

    const mockReviewsChain: any = {
      select: mock(() => mockReviewsChain),
      or: mock((orStr: string) => {
        capturedOrQuery = orStr;
        return mockReviewsChain;
      }),
      eq: mock(() => mockReviewsChain),
      ilike: mock(() => mockReviewsChain),
      order: mock(() =>
        Promise.resolve({
          data: [
            { Id: 1, Marque: 'Chery', Famille: 'Tiggo 7', Note: 80 },
            { Id: 2, Marque: 'Ebro', Famille: 'S700', Note: 85 },
          ],
          error: null,
        })
      ),
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'model_aliases') return mockAliasChain;
      if (table === 'reviews') return mockReviewsChain;
      return {};
    });

    const reviews = await getReviews({ marque: 'Chery', famille: 'Tiggo 7' });

    expect(reviews).toHaveLength(2);
    expect(capturedOrQuery).toContain('Marque.eq."Chery",Famille.eq."Tiggo 7"');
    expect(capturedOrQuery).toContain('Marque.eq."Ebro",Famille.eq."S700"');
  });

  it('should support bidirectional alias lookup when querying by alias brand', async () => {
    let capturedOrQuery = '';

    const mockAliasChain = {
      select: mock(() => mockAliasChain),
      or: mock(() =>
        Promise.resolve({
          data: [
            {
              canonical_marque: 'Chery',
              canonical_famille: 'Tiggo 7',
              canonical_modele: null,
              canonical_my: null,
              alias_marque: 'Ebro',
              alias_famille: 'S700',
              alias_modele: null,
            },
          ],
          error: null,
        })
      ),
    };

    const mockReviewsChain: any = {
      select: mock(() => mockReviewsChain),
      or: mock((orStr: string) => {
        capturedOrQuery = orStr;
        return mockReviewsChain;
      }),
      eq: mock(() => mockReviewsChain),
      ilike: mock(() => mockReviewsChain),
      order: mock(() =>
        Promise.resolve({
          data: [
            { Id: 1, Marque: 'Chery', Famille: 'Tiggo 7' },
            { Id: 2, Marque: 'Ebro', Famille: 'S700' },
          ],
          error: null,
        })
      ),
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'model_aliases') return mockAliasChain;
      if (table === 'reviews') return mockReviewsChain;
      return {};
    });

    const reviews = await getReviews({ marque: 'Ebro', famille: 'S700' });

    expect(reviews).toHaveLength(2);
    expect(capturedOrQuery).toContain('Marque.eq."Ebro",Famille.eq."S700"');
    expect(capturedOrQuery).toContain('Marque.eq."Chery",Famille.eq."Tiggo 7"');
  });

  it('should filter out aliases with non-matching canonical_my', async () => {
    let capturedOrQuery = '';

    const mockAliasChain = {
      select: mock(() => mockAliasChain),
      or: mock(() =>
        Promise.resolve({
          data: [
            {
              canonical_marque: 'BrandA',
              canonical_famille: 'FamA',
              canonical_modele: null,
              canonical_my: 2023,
              alias_marque: 'BrandB',
              alias_famille: 'FamB',
              alias_modele: null,
            },
          ],
          error: null,
        })
      ),
    };

    const mockReviewsChain: any = {
      select: mock(() => mockReviewsChain),
      or: mock((orStr: string) => {
        capturedOrQuery = orStr;
        return mockReviewsChain;
      }),
      eq: mock((_key: string, _val: any) => mockReviewsChain),
      ilike: mock(() => mockReviewsChain),
      order: mock(() =>
        Promise.resolve({
          data: [{ Id: 1, Marque: 'BrandA', Famille: 'FamA', MY: 2024 }],
          error: null,
        })
      ),
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'model_aliases') return mockAliasChain;
      if (table === 'reviews') return mockReviewsChain;
      return {};
    });

    const reviews = await getReviews({ marque: 'BrandA', famille: 'FamA', my: 2024 });

    expect(reviews).toHaveLength(1);
    expect(capturedOrQuery).toBe('and(Marque.eq."BrandA",Famille.eq."FamA")');
    expect(capturedOrQuery).not.toContain('BrandB');
  });
});
