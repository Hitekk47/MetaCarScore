
import { performance } from 'perf_hooks';
import sitemap from '../src/app/sitemap';

async function runBenchmark() {
  console.log('Starting benchmark...');
  const start = performance.now();
  const initialMemory = process.memoryUsage().heapUsed;

  const result = await sitemap();

  const end = performance.now();
  const finalMemory = process.memoryUsage().heapUsed;

  console.log(`Time: ${(end - start).toFixed(2)}ms`);
  // This is a rough estimate
  console.log(`Memory Used (heap delta): ${((finalMemory - initialMemory) / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total URLs generated: ${result.length}`);
}

runBenchmark();
