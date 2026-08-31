import { describe, it, expect, mock, beforeEach } from 'bun:test';

mock.module('react', () => ({
  cache: <T>(fn: T): T => fn,
}));

const mockRpc = mock();
const mockFrom = mock();

mock.module('@/lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
}));

describe('getFamilies with get_families_by_brand_v2', () => {
  beforeEach(() => {
    mockRpc.mockClear();
  });

  it('calls get_families_by_brand_v2 and returns consolidated brand families with alias metadata', async () => {
    mockRpc.mockImplementation((fnName: string, params: any) => {
      if (fnName === 'get_families_by_brand_v2') {
        return Promise.resolve({
          data: [
            {
              Famille: 'S700',
              review_count: 8,
              is_alias: true,
              canonical_marque: 'Chery',
              canonical_famille: 'Tiggo 7',
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { getFamilies } = await import('./queries');
    const families = await getFamilies('Ebro');

    expect(mockRpc).toHaveBeenCalledWith('get_families_by_brand_v2', { brand_name: 'Ebro' });
    expect(families).toHaveLength(1);
    expect(families[0].Famille).toBe('S700');
    expect(families[0].review_count).toBe(8);
    expect(families[0].is_alias).toBe(true);
    expect(families[0].canonical_marque).toBe('Chery');
    expect(families[0].canonical_famille).toBe('Tiggo 7');
  });
});

describe('getReviews with aliases', () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it('should fetch unified reviews for canonical vehicle and its alias', async () => {
    const { getReviews } = await import('./queries');

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

    mockFrom.mockImplementation((table: string) => {
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
    const { getReviews } = await import('./queries');

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

    mockFrom.mockImplementation((table: string) => {
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
    const { getReviews } = await import('./queries');

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

    mockFrom.mockImplementation((table: string) => {
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

describe('getModelAliases', () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it('should fetch aliases for given marque and famille bidirectionally', async () => {
    const { getModelAliases } = await import('./queries');

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

    mockFrom.mockImplementation((table: string) => {
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
    const { getModelAliases } = await import('./queries');

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

    mockFrom.mockImplementation((table: string) => {
      if (table === 'model_aliases') return mockAliasChain;
      return {};
    });

    const aliases = await getModelAliases({ marque: 'Chery', famille: 'Tiggo 7', my: 2024 });

    expect(aliases).toHaveLength(0);
  });
});
