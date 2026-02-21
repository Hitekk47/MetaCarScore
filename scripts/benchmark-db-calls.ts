const LATENCY_MS = 50;

class DBBenchmark {
  queryCount = 0;

  async select(table: string) {
    await new Promise(resolve => setTimeout(resolve, LATENCY_MS));
    this.queryCount++;
    return { data: [{ mock: 'data' }], error: null };
  }

  async rpc(functionName: string, params: any) {
    await new Promise(resolve => setTimeout(resolve, LATENCY_MS));
    this.queryCount++;
    return { data: [{ mock: 'context' }], error: null };
  }
}

// --- BASELINE SCENARIO ---
async function runBaseline() {
  const db = new DBBenchmark();
  const start = performance.now();

  // 1. generateMetadata
  // Simulates: supabase.from('reviews').select(...)
  await db.select('reviews');

  // 2. Page Component
  // Simulates: supabase.rpc('get_full_context_by_slugs', ...)
  await db.rpc('get_full_context_by_slugs', {});

  // Simulates: supabase.from('reviews').select(...)
  await db.select('reviews');

  const end = performance.now();
  return {
    name: 'Baseline',
    time: end - start,
    queries: db.queryCount
  };
}

// --- OPTIMIZED SCENARIO ---
// Mocking React.cache behavior
const cache = new Map<string, Promise<any>>();

function cachedFn<T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  keyGenerator: (...args: Args) => string
) {
  return async (...args: Args): Promise<T> => {
    const key = keyGenerator(...args);
    if (cache.has(key)) return cache.get(key)!;
    const promise = fn(...args);
    cache.set(key, promise);
    return promise;
  };
}

async function runOptimized() {
  const db = new DBBenchmark();
  cache.clear(); // New request context

  // Define cached functions linked to this DB instance
  const getFullContext = cachedFn(
    (params) => db.rpc('get_full_context_by_slugs', params),
    (params) => JSON.stringify(params)
  );

  const getReviews = async () => db.select('reviews');

  const start = performance.now();

  // 1. generateMetadata (Calls cached context)
  await getFullContext({});

  // 2. Page Component (Calls cached context + reviews)
  await getFullContext({}); // Should be instant and 0 queries (cache hit)
  await getReviews();

  const end = performance.now();
  return {
    name: 'Optimized',
    time: end - start,
    queries: db.queryCount
  };
}

async function main() {
  console.log('Running Benchmark: Database Call Simulation');
  console.log(`Simulated Latency: ${LATENCY_MS}ms per call\n`);

  const baseline = await runBaseline();
  console.log(`[${baseline.name}]`);
  console.log(`  Time: ${baseline.time.toFixed(2)}ms`);
  console.log(`  Queries: ${baseline.queries}`);

  const optimized = await runOptimized();
  console.log(`[${optimized.name}]`);
  console.log(`  Time: ${optimized.time.toFixed(2)}ms`);
  console.log(`  Queries: ${optimized.queries}`);

  console.log('\n--- IMPROVEMENT ---');
  console.log(`Time Reduction: ${(baseline.time - optimized.time).toFixed(2)}ms`);
  console.log(`Query Reduction: ${baseline.queries - optimized.queries}`);
}

main();
