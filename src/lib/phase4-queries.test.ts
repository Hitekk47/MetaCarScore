import { describe, it, expect, mock, beforeEach } from 'bun:test';

mock.module('react', () => ({
  cache: <T>(fn: T): T => fn,
}));

const mockRpc = mock();
mock.module('@/lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

describe('queries.ts RPC wrappers (Phase 4)', () => {
  beforeEach(() => {
    mockRpc.mockClear();
  });

  it('getFamilies should call get_families_by_brand_v2 with brand_name', async () => {
    mockRpc.mockImplementation((fnName: string, params: any) => {
      if (fnName === 'get_families_by_brand_v2') {
        return Promise.resolve({
          data: [
            { famille: 'Jaecoo 7', review_count: 12, is_alias: false, canonical_marque: null, canonical_famille: null },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { getFamilies } = await import('./queries');
    const families = await getFamilies('Jaecoo');

    expect(mockRpc).toHaveBeenCalledWith('get_families_by_brand_v2', { brand_name: 'Jaecoo' });
    expect(families).toHaveLength(1);
    expect(families[0].famille).toBe('Jaecoo 7');
  });

  it('getVehicleSeoStats should call get_vehicle_seo_stats_v2 with params', async () => {
    mockRpc.mockImplementation((fnName: string, params: any) => {
      if (fnName === 'get_vehicle_seo_stats_v2') {
        return Promise.resolve({
          data: {
            review_count: 5,
            metacarscore: 82,
            is_reliable: true,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { getVehicleSeoStats } = await import('./queries');
    const stats = await getVehicleSeoStats({ p_marque: 'Chery', p_famille: 'Tiggo 7' });

    expect(mockRpc).toHaveBeenCalledWith('get_vehicle_seo_stats_v2', { p_marque: 'Chery', p_famille: 'Tiggo 7' });
    expect(stats?.metacarscore).toBe(82);
  });
});
