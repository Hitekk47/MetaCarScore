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

describe('Phase 4 Queries and RPCs', () => {
  beforeEach(() => {
    mockRpc.mockClear();
  });

  it('getVehicleSeoStats calls get_vehicle_seo_stats_v2', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_vehicle_seo_stats_v2') {
        return Promise.resolve({
          data: {
            review_count: 8,
            metacarscore: 85,
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
    expect(stats?.metacarscore).toBe(85);
  });

  it('getBrandContext calls find_brand_by_slug_v2', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'find_brand_by_slug_v2') {
        return Promise.resolve({
          data: [{ Marque: 'Chery' }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { getBrandContext } = await import('./queries');
    const brandCtx = await getBrandContext('chery');

    expect(mockRpc).toHaveBeenCalledWith('find_brand_by_slug_v2', { slug_input: 'chery' });
    expect(brandCtx?.Marque).toBe('Chery');
  });
});
