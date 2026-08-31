import { describe, it, expect, mock, beforeEach } from 'bun:test';

const mockFrom = mock();
const mockRpc = mock();

mock.module('react', () => ({
  cache: (fn: any) => fn,
  default: {
    cache: (fn: any) => fn,
  },
}));

mock.module('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

import { getReviews, getFamilies, getVehicleSeoStats, getModelAliases } from './queries';

describe('getReviews with aliases', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockRpc.mockClear();
  });

  it('should fetch unified reviews for canonical vehicle and its alias', async () => {
    const { supabase } = await import('@/lib/supabase');

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
    const { supabase } = await import('@/lib/supabase');

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
    const { supabase } = await import('@/lib/supabase');

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

describe('Phase 4 RPC query wrappers', () => {
  beforeEach(() => {
    mockRpc.mockClear();
  });

  it('getFamilies should call get_families_by_brand_v2', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ famille: 'Tiggo 7', review_count: 10, is_alias: false, canonical_marque: 'Chery', canonical_famille: 'Tiggo 7' }],
      error: null,
    });

    const res = await getFamilies('Chery');
    expect(mockRpc).toHaveBeenCalledWith('get_families_by_brand_v2', { brand_name: 'Chery' });
    expect(res).toHaveLength(1);
    expect(res[0].famille).toBe('Tiggo 7');
  });

  it('getVehicleSeoStats should call get_vehicle_seo_stats_v2', async () => {
    const params = { p_marque: 'Porsche', p_famille: '911', p_my: 2025, p_modele: '911 GT3' };
    mockRpc.mockResolvedValueOnce({
      data: { review_count: 5, metacarscore: 92 },
      error: null,
    });

    const res = await getVehicleSeoStats(params);
    expect(mockRpc).toHaveBeenCalledWith('get_vehicle_seo_stats_v2', params);
    expect(res).toEqual({ review_count: 5, metacarscore: 92 } as any);
  });
});

describe('getModelAliases', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockRpc.mockClear();
  });

  it('should fetch aliases for given marque and famille bidirectionally', async () => {
    const { supabase } = await import('@/lib/supabase');

    let capturedOrQuery = '';

    const mockAliasChain = {
      select: mock(() => mockAliasChain),
      or: mock((orStr: string) => {
        capturedOrQuery = orStr;
        return Promise.resolve({
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
        });
      }),
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'model_aliases') return mockAliasChain;
      return {};
    });

    const aliases = await getModelAliases({ marque: 'Chery', famille: 'Tiggo 7' });

    expect(aliases).toHaveLength(1);
    expect(aliases[0].alias_marque).toBe('Ebro');
    expect(capturedOrQuery).toContain('canonical_marque.eq."Chery"');
    expect(capturedOrQuery).toContain('alias_marque.eq."Chery"');
  });

  it('should filter aliases by MY if specified', async () => {
    const { supabase } = await import('@/lib/supabase');

    const mockAliasChain = {
      select: mock(() => mockAliasChain),
      or: mock(() =>
        Promise.resolve({
          data: [
            {
              canonical_marque: 'Chery',
              canonical_famille: 'Tiggo 7',
              canonical_modele: null,
              canonical_my: 2023,
              alias_marque: 'Ebro',
              alias_famille: 'S700',
              alias_modele: null,
            },
          ],
          error: null,
        })
      ),
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'model_aliases') return mockAliasChain;
      return {};
    });

    const aliases = await getModelAliases({ marque: 'Chery', famille: 'Tiggo 7', my: 2024 });

    expect(aliases).toHaveLength(0);
  });
});
