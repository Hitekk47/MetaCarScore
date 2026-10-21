// Run with: node scripts/test-query-cache.mjs
// Uses Next's real React Server Component renderer and the actual queries.ts.
// Only Supabase is replaced: this checks request memoization, not deployed SQL.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (!process.argv.includes('--rsc-worker')) {
  const child = spawnSync(process.execPath, [
    '--conditions=react-server', fileURLToPath(import.meta.url), '--rsc-worker',
  ], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
  if (child.error) throw child.error;
  process.exit(child.status ?? 1);
}

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToReadableStream } = require('next/dist/compiled/react-server-dom-webpack/server.node');
const ts = require('typescript');
const calls = [];
let responseMode = 'success';
const supabase = {
  async rpc(name, params) {
    const call = { name, params: JSON.parse(JSON.stringify(params)), number: calls.length + 1 };
    calls.push(call);
    // Keep requests in flight long enough to exercise concurrent callers.
    await new Promise(resolve => setImmediate(resolve));
    if (responseMode === 'error') return { data: null, error: { message: 'fixture failure' } };
    if (responseMode === 'empty') return { data: name === 'get_full_context_by_slugs_v3' ? [] : null, error: null };
    const value = { fixtureCall: call.number, ...call.params };
    return { data: name === 'get_full_context_by_slugs_v3' ? [value] : value, error: null };
  },
};

// Erase TypeScript in memory; execute the repository implementation, not a copy.
async function loadTypescript(relativePath, dependencies) {
  const filename = fileURLToPath(new URL(relativePath, import.meta.url));
  const source = await readFile(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const compiled = { exports: {} };
  const localRequire = name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected runtime dependency: ${name}`);
    return dependencies[name];
  };
  new Function('require', 'exports', 'module', outputText)(localRequire, compiled.exports, compiled);
  return compiled.exports;
}

const validation = await loadTypescript('../src/lib/validation.ts', {});
const { getFullContext, getVehicleSeoStats } = await loadTypescript('../src/lib/queries.ts', {
  react: React,
  '@/lib/supabase': { supabase },
  './validation': validation,
});

async function renderRequest(run) {
  const errors = [];
  let result;
  async function ServerComponent() {
    result = await run();
    return null;
  }
  const stream = await renderToReadableStream(React.createElement(ServerComponent), {}, {
    onError: error => { errors.push(error); },
  });
  await new Response(stream).arrayBuffer();
  if (errors.length) throw errors[0];
  return result;
}

const context = {
  p_marque_slug: 'chery', p_famille_slug: 'tiggo-7', p_my: 2024,
  p_modele_slug: 'tiggo-7-pro', p_powertrain_slug: 'essence-147ch-automatique',
};
const seo = { p_marque: 'Chery', p_famille: 'Tiggo 7', p_my: 2024, p_modele: 'Tiggo 7 Pro' };

async function verifyMemoization(name, rpcName, query, params, variants) {
  const initialCount = calls.length;
  const first = await renderRequest(async () => {
    // Metadata and page construct different objects, potentially in another key order.
    const reversed = Object.fromEntries(Object.entries(params).reverse());
    const values = await Promise.all([query({ ...params }), query(reversed)]);
    assert.equal(calls.length - initialCount, 1, `${name}: equal values must issue one RPC`);
    assert.equal(calls.at(-1).name, rpcName, `${name}: preserve the RPC version`);
    assert.strictEqual(values[0], values[1], `${name}: concurrent callers share the resolved value`);
    assert.deepEqual(calls.at(-1).params, params, `${name}: preserve the public object's RPC body`);
    return values[0];
  });

  const next = await renderRequest(() => query({ ...params }));
  assert.equal(calls.length - initialCount, 2, `${name}: a new request must fetch fresh data`);
  assert.notEqual(first.fixtureCall, next.fixtureCall);

  const beforeVariants = calls.length;
  await renderRequest(async () => {
    const inputs = [params, ...variants];
    const pairs = await Promise.all(inputs.map(async input => {
      const pair = await Promise.all([query({ ...input }), query({ ...input })]);
      assert.strictEqual(pair[0], pair[1]);
      return pair[0];
    }));
    assert.equal(calls.length - beforeVariants, inputs.length, `${name}: distinct dimensions stay separate`);
    assert.equal(new Set(pairs.map(value => value.fixtureCall)).size, inputs.length);
    assert.deepEqual(calls.slice(beforeVariants).map(call => call.params), inputs);
  });
  console.log(`PASS: ${name}: equal objects, concurrent callers, all dimensions and request isolation`);
}

await verifyMemoization('getFullContext', 'get_full_context_by_slugs_v3', getFullContext, context, [
  { ...context, p_marque_slug: 'other-brand' },
  { ...context, p_famille_slug: 'other-family' },
  { ...context, p_my: 2025 },
  { ...context, p_modele_slug: 'other-model' },
  { ...context, p_powertrain_slug: 'hybride-204ch-automatique' },
]);
await verifyMemoization('getVehicleSeoStats', 'get_vehicle_seo_stats_v6', getVehicleSeoStats, seo, [
  { ...seo, p_marque: 'Other Brand' },
  { ...seo, p_famille: 'Other Family' },
  { ...seo, p_my: 2025 },
  { ...seo, p_modele: 'Other Model' },
]);

await renderRequest(async () => {
  const before = calls.length;
  await Promise.all([
    getFullContext({}),
    getFullContext({ p_marque_slug: undefined, p_my: undefined }),
    getFullContext({ p_marque_slug: '' }),
    getFullContext({ p_my: 0 }),
    getVehicleSeoStats({ p_marque: 'Chery', p_famille: 'Tiggo 7' }),
    getVehicleSeoStats({ p_marque: 'Chery', p_famille: 'Tiggo 7', p_my: undefined, p_modele: undefined }),
    getVehicleSeoStats({ p_marque: 'Chery', p_famille: 'Tiggo 7', p_my: 0 }),
    getVehicleSeoStats({ p_marque: 'Chery', p_famille: 'Tiggo 7', p_modele: '' }),
  ]);
  assert.equal(calls.length - before, 6, 'Omitted/undefined are equivalent; empty strings and zero stay distinct');
});
console.log('PASS: omitted/undefined options dedupe without collapsing empty strings or zero');

const originalConsoleError = console.error;
const loggedErrors = [];
try {
  console.error = (...args) => loggedErrors.push(args);
  responseMode = 'error';
  const before = calls.length;
  await renderRequest(async () => {
    const values = await Promise.all([
      getFullContext({ ...context }), getFullContext({ ...context }),
      getVehicleSeoStats({ ...seo }), getVehicleSeoStats({ ...seo }),
    ]);
    assert.deepEqual(values, [null, null, null, null]);
  });
  assert.equal(calls.length - before, 2, 'Error results dedupe within the request');
  assert.equal(loggedErrors.length, 0, 'Handled RPC errors must not be logged');
} finally {
  console.error = originalConsoleError;
  responseMode = 'success';
}
await renderRequest(async () => {
  assert.ok(await getFullContext({ ...context }), 'Error must not persist into the next request');
  assert.ok(await getVehicleSeoStats({ ...seo }), 'Error must not persist into the next request');
});
responseMode = 'empty';
await renderRequest(async () => {
  assert.equal(await getFullContext({ ...context }), null);
  assert.equal(await getVehicleSeoStats({ ...seo }), null);
});
console.log('PASS: errors and empty data keep their null result; failures do not persist across requests');
