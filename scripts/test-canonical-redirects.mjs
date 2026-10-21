// Real Next HTTP regression using the repository's four vehicle pages unchanged.
// Only data and the client UI are fixtures; no Supabase connection is used.
// Run: node scripts/test-canonical-redirects.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = await mkdtemp(join(tmpdir(), 'metacarscore-canonical-redirects-'));
const nextBin = join(root, 'node_modules/next/dist/bin/next');
let server;
let serverExit;
let logs = '';

async function write(path, content) {
  await mkdir(dirname(join(fixture, path)), { recursive: true });
  await writeFile(join(fixture, path), content);
}

async function copy(source, target = source) {
  await mkdir(dirname(join(fixture, target)), { recursive: true });
  await copyFile(join(root, source), join(fixture, target));
}

function runNext(args) {
  const child = spawn(process.execPath, [nextBin, ...args], {
    cwd: fixture,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', data => { logs = (logs + data).slice(-16000); });
  }
  return child;
}

try {
  await symlink(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir');
  await copy('package.json');
  await copy('tsconfig.json');
  await write('src/app/layout.tsx', `
    export default function Layout({ children }) {
      return <html lang="fr"><body>{children}</body></html>;
    }
  `);
  await write('src/app/page.tsx', 'export default function Home() { return <p>Ready</p>; }');
  await write('src/app/streaming/layout.tsx', `
    import { Suspense } from 'react';
    export default function Layout({ children }) {
      return <Suspense fallback={<p>Loading fixture</p>}>{children}</Suspense>;
    }
  `);
  await write('src/components/pages/GenericPageClient.tsx', `
    export default function Page({ marque, famille, my, modele }) {
      return <main>{[marque, famille, my, modele].filter(Boolean).join(' / ')}</main>;
    }
  `);
  await write('src/lib/queries.ts', `
    export async function getFullContext(params) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!['ebro', 'chery'].includes(params.p_marque_slug)) return null;
      const alias = params.p_marque_slug === 'ebro';
      return {
        real_marque: alias ? 'Ebro' : 'Chery',
        real_famille: alias ? 'S700' : 'Tiggo 7',
        real_modele: params.p_modele_slug === 'luxury' ? 'Luxury' : alias ? 'S700' : 'Tiggo 7',
        real_powertrain: 'Hybride essence',
        is_alias: alias,
        canonical_marque: 'Chery', canonical_famille: 'Tiggo 7',
        canonical_modele: params.p_modele_slug === 'luxury' ? null : 'Tiggo 7',
      };
    }
    export async function getReviews() {
      return [{ Score: 80, Testeur: 'Fixture', Test_date: '2024-01-01' }];
    }
    export async function getVehicleSeoStats() { return null; }
    export async function getModelAliases() { return []; }
  `);
  for (const path of ['src/lib/slugify.ts', 'src/lib/utils.ts', 'src/lib/media-source.ts', 'src/lib/seo-utils.ts', 'src/lib/constants.ts']) {
    await copy(path);
  }
  const routes = [
    '[marque]/[famille]',
    '[marque]/[famille]/[my]',
    '[marque]/[famille]/[my]/[modele]',
    '[marque]/[famille]/[my]/[modele]/[powertrain]',
  ];
  for (const route of routes) {
    await copy(`src/app/${route}/page.tsx`);
    await copy(`src/app/${route}/page.tsx`, `src/app/streaming/${route}/page.tsx`);
  }

  // Compile production Next routing/rendering, rather than mapping redirect errors
  // to synthetic HTTP responses. Type checking belongs to the application check.
  await write('next.config.mjs', 'export default { typescript: { ignoreBuildErrors: true } };\n');
  const build = runNext(['build', '--webpack']);
  const [buildCode] = await once(build, 'close');
  assert.equal(buildCode, 0, `Fixture build failed:\n${logs}`);

  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  server = runNext(['start', '--hostname', '127.0.0.1', '--port', String(port)]);
  serverExit = once(server, 'exit');
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Next exited:\n${logs}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1000) });
      await response.text();
      if (response.ok) { ready = true; break; }
    } catch { /* Server still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Next did not become ready:\n${logs}`);

  const suffixes = ['', '/2024', '/2024/s700', '/2024/s700/hybride-essence_204_3a'];
  const canonicalSuffixes = ['', '/2024', '/2024/tiggo-7', '/2024/tiggo-7/hybride-essence_204_3a'];
  for (let i = 0; i < suffixes.length; i++) {
    const alias = `/ebro/s700${suffixes[i]}`;
    const target = `/chery/tiggo-7${canonicalSuffixes[i]}`;
    const response = await fetch(origin + alias, { redirect: 'manual' });
    await response.text();
    assert.equal(response.status, 308, `${alias}: permanent HTTP status before streaming`);
    assert.equal(response.headers.get('location'), target, `${alias}: canonical Location`);
    const destination = await fetch(origin + alias);
    const html = await destination.text();
    assert.equal(destination.status, 200);
    assert.equal(destination.url, origin + target, 'Following the redirect reaches the canonical URL');
    assert.match(html, /<main>Chery/);
    const canonical = await fetch(origin + target, { redirect: 'manual' });
    await canonical.text();
    assert.equal(canonical.status, 200, 'Canonical pages must not redirect again');
    assert.equal(canonical.headers.get('location'), null);

    const streamed = await fetch(origin + '/streaming' + alias, { redirect: 'manual' });
    const streamedHtml = await streamed.text();
    assert.equal(streamed.status, 200, 'A flushed stream cannot change its HTTP status');
    assert.ok(streamedHtml.includes(`content="0;url=${target}"`),
      'Next emits an immediate meta refresh for the permanent redirect after streaming');
    console.log(`PASS: ${alias}: 308 + Location, navigation to canonical 200, streaming meta refresh`);
  }
  const fallback = await fetch(origin + '/ebro/s700/2024/luxury/hybride-essence_204_3a', { redirect: 'manual' });
  await fallback.text();
  assert.equal(fallback.status, 308);
  assert.equal(fallback.headers.get('location'), '/chery/tiggo-7/2024/luxury/hybride-essence_204_3a');
  for (const suffix of suffixes) {
    const missing = await fetch(origin + '/missing/s700' + suffix, { redirect: 'manual' });
    await missing.text();
    assert.equal(missing.status, 404, 'Missing context must remain a 404');
  }
  console.log('PASS: canonical model fallback and MY/powertrain preservation; missing context stays 404');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await serverExit;
  }
  await rm(fixture, { recursive: true, force: true });
}
