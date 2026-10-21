import { beforeEach, describe, expect, mock, test } from 'bun:test';

let rows: { Marque: string; Famille: string; MY: number; Testeur: string }[];
type QueryName = 'reviews' | 'aliases' | 'models';
let errors: Partial<Record<QueryName, { message: string }>>;
const rpc = mock(async () => ({ data: [], error: errors.models ?? null }));
mock.module('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: async () => ({
        data: table === 'reviews' ? rows : [],
        error: errors[table === 'reviews' ? 'reviews' : 'aliases'] ?? null,
      }),
    }),
    rpc,
  },
}));
const { default: sitemap } = await import('./sitemap');

describe('sitemap', () => {
  beforeEach(() => {
    rows = [];
    errors = {};
    rpc.mockClear();
  });

  test('requires three identified media for family and MY routes', async () => {
    for (const [Famille, sources] of [
      ['Case variants', ['TopGear', 'topgear', ' TOPGEAR ']],
      ['Missing source', ['TopGear', 'AutoExpress', '', '  ', '\t\n']],
      ['Reliable', [' TopGear ', 'topgear', 'AutoExpress', "L’Argus"]],
    ] as const) {
      for (const Testeur of sources) rows.push({ Marque: 'Fixture', Famille, MY: 2025, Testeur });
    }
    const urls = (await sitemap()).map(route => route.url);
    expect(urls).toContain('https://metacarscore.com/fixture');
    expect(urls).toContain('https://metacarscore.com/fixture/reliable');
    expect(urls).toContain('https://metacarscore.com/fixture/reliable/2025');
    for (const path of ['case-variants', 'missing-source']) {
      expect(urls).not.toContain('https://metacarscore.com/fixture/' + path);
      expect(urls).not.toContain('https://metacarscore.com/fixture/' + path + '/2025');
    }
    expect(rpc).toHaveBeenCalledWith('get_sitemap_groups_filtered_v4');
  });

  test.each<QueryName>(['reviews', 'aliases', 'models'])(
    'rejects instead of returning a partial sitemap when %s fails',
    async (name) => {
      rows = ['First', 'Second', 'Third'].map(Testeur => ({
        Marque: 'Fixture', Famille: 'Reliable', MY: 2025, Testeur,
      }));
      errors[name] = { message: 'Private upstream error details' };

      await expect(sitemap()).rejects.toThrow(`Failed to fetch ${name} for sitemap`);
    },
  );

  test('allows successful empty results', async () => {
    const urls = (await sitemap()).map(route => route.url);
    expect(urls).toContain('https://metacarscore.com');
    expect(urls).toContain('https://metacarscore.com/marques');
  });
});
