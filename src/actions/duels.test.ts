import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockCacheRead = mock();
mock.module('next/cache', () => ({
  unstable_cache: <Args extends unknown[], Result>(fn: (...args: Args) => Result) =>
    (...args: Args): Result => {
      mockCacheRead(...args);
      return fn(...args);
    },
}));

const mockRpc = mock();
const mockFrom = mock();
mock.module('@/lib/supabase', () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}));

const { fetchBatchFighterReviews } = await import('./duels');

const EBRO = 'ebro_s700_2024_s700';
const PORSCHE = 'porsche_911_2024_911-gt3';

describe('fetchBatchFighterReviews security', () => {
  beforeEach(() => {
    mockCacheRead.mockClear();
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReset();
  });

  const invalidInputs: Array<[string, unknown]> = [
    ['undefined', undefined],
    ['null', null],
    ['a string', EBRO],
    ['an array-like object', { 0: EBRO, length: 1 }],
    ['an excessive batch', [EBRO, PORSCHE, 'bmw_m3_2024_m3']],
    ['excessive duplicates', [EBRO, EBRO, EBRO]],
    ['a number', [EBRO, 42]],
    ['a null element', [EBRO, null]],
    ['an object element', [EBRO, {}]],
    ['a nested array', [EBRO, [PORSCHE]]],
    ['a sparse array', new Array(2)],
    ['an empty slug', [EBRO, '']],
    ['an overlong slug', [EBRO, `ebro_s700_2024_${'s'.repeat(242)}`]],
    ['a missing model', [EBRO, 'ebro_s700_2024']],
    ['an empty model', [EBRO, 'ebro_s700_2024_']],
    ['an empty brand', [EBRO, '_s700_2024_s700']],
    ['an empty family', [EBRO, 'ebro__2024_s700']],
    ['uppercase', [EBRO, 'Ebro_s700_2024_s700']],
    ['a query operator', [EBRO, 'ebro_s700_2024_s700,or(id.gt.0)']],
    ['a slash', [EBRO, 'ebro_s700_2024_s700/other']],
    ['whitespace', [EBRO, 'ebro_s700_2024_s700 ']],
    ['a trailing newline', [EBRO, 'ebro_s700_2024_s700\n']],
    ['trailing CRLF', [EBRO, 'ebro_s700_2024_s700\r\n']],
    ['a year suffix', [EBRO, 'ebro_s700_2024junk_s700']],
    ['a fractional year', [EBRO, 'ebro_s700_2024.5_s700']],
    ['an exponential year', [EBRO, 'ebro_s700_2e3_s700']],
    ['a short year', [EBRO, 'ebro_s700_24_s700']],
    ['a padded year', [EBRO, 'ebro_s700_02024_s700']],
    ['a year below the supported range', [EBRO, 'ebro_s700_1899_s700']],
    ['a year above the supported range', [EBRO, 'ebro_s700_2101_s700']],
  ];

  for (const [description, input] of invalidInputs) {
    it(`rejects ${description} before the cache or any Supabase call`, async () => {
      await expect(fetchBatchFighterReviews(input)).rejects.toThrow();
      expect(mockCacheRead).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockFrom).not.toHaveBeenCalled();
    });
  }

  it('preserves the empty batch as a no-op', async () => {
    expect(await fetchBatchFighterReviews([])).toEqual({});
    expect(mockCacheRead).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('deduplicates a valid batch before resolving vehicles', async () => {
    await fetchBatchFighterReviews([EBRO, EBRO]);
    expect(mockCacheRead).toHaveBeenCalledWith([EBRO]);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('uses the same sorted cache arguments for either duel order', async () => {
    await fetchBatchFighterReviews([PORSCHE, EBRO]);
    await fetchBatchFighterReviews([EBRO, PORSCHE]);
    expect(mockCacheRead.mock.calls).toEqual([[[EBRO, PORSCHE]], [[EBRO, PORSCHE]]]);
  });

  it('accepts the slug length and model-year boundaries and model underscores', async () => {
    const longestSlug = `ebro_s700_1900_${'s'.repeat(241)}`;
    expect(longestSlug.length).toBe(256);
    await fetchBatchFighterReviews([longestSlug, 'porsche_911_2100_911_gt3']);
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenCalledWith('get_full_context_by_slugs_v3', {
      p_marque_slug: 'porsche', p_famille_slug: '911', p_my: 2100, p_modele_slug: '911_gt3',
    });
  });

  it('loads a valid duel with family aliases and a strict MY filter', async () => {
    mockRpc.mockImplementation(async (_name: string, params: { p_marque_slug: string }) => ({
      data: [params.p_marque_slug === 'ebro'
        ? { real_marque: 'Ebro', real_famille: 'S700', real_modele: 'S700' }
        : { real_marque: 'Porsche', real_famille: '911', real_modele: '911 GT3' }],
      error: null,
    }));

    const alias = {
      canonical_marque: 'Chery', canonical_famille: 'Tiggo 7',
      canonical_modele: null, canonical_my: null,
      alias_marque: 'Ebro', alias_famille: 'S700', alias_modele: null,
    };
    const aliasOr = mock(async (filter: string) => ({
      data: filter.includes('Ebro') ? [alias] : [], error: null,
    }));
    const reviewRequests: Array<{ filter: string; eq: ReturnType<typeof mock> }> = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === 'model_aliases') {
        return { select: () => ({ or: aliasOr }) };
      }
      expect(table).toBe('reviews');
      const request = { filter: '', eq: mock() };
      reviewRequests.push(request);
      const chain = {
        select: () => chain,
        or: (filter: string) => { request.filter = filter; return chain; },
        eq: request.eq.mockImplementation(() => chain),
        order: async () => ({
          data: request.filter.includes('Ebro')
            ? [
              { Id: 1, Marque: 'Ebro', Famille: 'S700', Modele: 'S700', MY: 2024 },
              { Id: 2, Marque: 'Chery', Famille: 'Tiggo 7', Modele: 'Tiggo 7', MY: 2024 },
            ]
            : [{ Id: 3, Marque: 'Porsche', Famille: '911', Modele: '911 GT3', MY: 2024 }],
          error: null,
        }),
      };
      return chain;
    });

    const result = await fetchBatchFighterReviews([EBRO, PORSCHE]);

    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenCalledWith('get_full_context_by_slugs_v3', {
      p_marque_slug: 'ebro', p_famille_slug: 's700', p_my: 2024, p_modele_slug: 's700',
    });
    expect(result[EBRO]).toHaveLength(2);
    expect(result[PORSCHE]).toHaveLength(1);
    const ebroRequest = reviewRequests.find(request => request.filter.includes('Ebro'))!;
    expect(ebroRequest.filter).toContain('and(Marque.eq."Ebro",Famille.eq."S700",Modele.eq."S700")');
    expect(ebroRequest.filter).toContain('and(Marque.eq."Chery",Famille.eq."Tiggo 7")');
    for (const request of reviewRequests) {
      expect(request.eq).toHaveBeenCalledWith('MY', 2024);
    }
  });
});
