
// Generate a large mock dataset
const DATA_SIZE = 10000;
const ITERATIONS = 100;

console.log(`Generating dataset of size ${DATA_SIZE}...`);
const data = Array.from({ length: DATA_SIZE }, (_, i) => ({
  brand: `Brand-${i}`,
  avg_score: Math.random() * 100,
}));

// Simulate the filtering (worst case: all items match)
const filteredData = [...data];

console.log(`Starting benchmark with ${ITERATIONS} iterations...`);

// --- Baseline: O(N^2) ---
const startBaseline = performance.now();
for (let iter = 0; iter < ITERATIONS; iter++) {
  // Simulate the render loop
  filteredData.forEach((item) => {
    // Current implementation: findIndex
    const realRank = data.findIndex(d => d.brand === item.brand) + 1;
    // (We do nothing with realRank here, just measuring the calculation cost)
  });
}
const endBaseline = performance.now();
const baselineTime = endBaseline - startBaseline;

console.log(`\nBaseline (findIndex) Total Time: ${baselineTime.toFixed(2)}ms`);
console.log(`Baseline Avg per iteration: ${(baselineTime / ITERATIONS).toFixed(2)}ms`);


// --- Optimized: O(N) ---
const startOptimized = performance.now();
for (let iter = 0; iter < ITERATIONS; iter++) {
  // Pre-calculate the map (simulating useMemo)
  const rankMap = new Map();
  data.forEach((item, index) => {
    rankMap.set(item.brand, index + 1);
  });

  // Simulate the render loop
  filteredData.forEach((item) => {
    // Optimized implementation: map lookup
    const realRank = rankMap.get(item.brand);
  });
}
const endOptimized = performance.now();
const optimizedTime = endOptimized - startOptimized;

console.log(`\nOptimized (Map lookup) Total Time: ${optimizedTime.toFixed(2)}ms`);
console.log(`Optimized Avg per iteration: ${(optimizedTime / ITERATIONS).toFixed(2)}ms`);

console.log(`\nSpeedup Factor: ${(baselineTime / optimizedTime).toFixed(2)}x`);
