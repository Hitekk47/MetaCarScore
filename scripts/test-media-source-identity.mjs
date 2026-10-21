// Isolated PostgreSQL regression. No hosted Supabase connection or credentials.
// npm install --cache work/npm-cache --prefix work/tools --no-save --package-lock=false @electric-sql/pglite
// node scripts/test-media-source-identity.mjs --pglite-module work/tools/node_modules/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const moduleFlag = process.argv.indexOf('--pglite-module');
const moduleName = moduleFlag === -1 ? '@electric-sql/pglite'
  : pathToFileURL(resolve(process.argv[moduleFlag + 1])).href;
const { PGlite } = await import(moduleName);
const { unaccent } = await import(moduleFlag === -1 ? '@electric-sql/pglite/contrib/unaccent'
  : new URL('./contrib/unaccent.js', moduleName).href);
const db = new PGlite({ extensions: { unaccent } });
const migrationName = '20261021000000_uniform_media_source_identity.sql';
const successors = new Map([
  ['get_model_ranking_v7', 'get_model_ranking_v8'],
  ['get_break_ranking_v5', 'get_break_ranking_v6'],
  ['get_convertible_ranking_v5', 'get_convertible_ranking_v6'],
  ['get_trending_models_v4', 'get_trending_models_v5'],
  ['get_brand_ranking_v8', 'get_brand_ranking_v9'],
  ['get_vehicle_seo_stats_v5', 'get_vehicle_seo_stats_v6'],
  ['get_sitemap_groups_filtered_v3', 'get_sitemap_groups_filtered_v4'],
  ['get_sitemap_canonical_routes_v2', 'get_sitemap_canonical_routes_v3'],
]);

async function snapshot() {
  const { rows } = await db.query(`
    SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS definition,
           p.proowner, p.prosecdef, p.proconfig, p.provolatile, p.proisstrict, p.proparallel,
           (SELECT jsonb_agg(jsonb_build_array(a.grantor, a.grantee, a.privilege_type, a.is_grantable)
                             ORDER BY a.grantor, a.grantee, a.privilege_type, a.is_grantable)
            FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a) AS effective_acl
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' ORDER BY p.oid
  `);
  return rows;
}

try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  for (const name of (await readdir(resolve(root, 'supabase/migrations'))).sort()
    .filter(name => name.endsWith('.sql') && name < migrationName)) {
    let sql = await readFile(resolve(root, 'supabase/migrations', name), 'utf8');
    if (name === '20260827171821_remote_schema.sql') {
      // PGlite has no Supabase Vault/realtime service; neither is used here.
      sql = sql.replace(/^CREATE EXTENSION(?![^;]*"unaccent")[^;]*;\s*$/gm, '');
      sql = sql.replace(/^ALTER PUBLICATION[^;]*;\s*$/gm, '');
    }
    await db.exec(sql);
  }
  const before = await snapshot();
  await db.exec(await readFile(resolve(root, 'supabase/migrations', migrationName), 'utf8'));
  const after = await snapshot();
  const newNames = new Set([...successors.values(), 'normalize_media_source']);
  assert.equal(after.length, before.length + newNames.size);
  assert.deepEqual(after.filter(fn => !newNames.has(fn.proname)), before,
    'Every legacy definition, identity, owner, ACL and security property must stay unchanged');
  const properties = fn => Object.fromEntries(Object.entries(fn)
    .filter(([key]) => !['oid', 'proname', 'definition'].includes(key)));
  for (const [oldName, newName] of successors) {
    const oldFn = before.find(fn => fn.proname === oldName);
    const newFn = after.find(fn => fn.proname === newName);
    assert.ok(newFn, newName);
    assert.equal(newFn.definition, oldFn.definition.replaceAll(oldName, newName)
      .replace(/TRIM\(((?:\w+\.)?"Testeur")\)/g, 'public.normalize_media_source($1)'),
    newName + ': only version name and media identity may change');
    assert.deepEqual(properties(newFn), properties(oldFn), newName + ': preserve effective ACL and security');
  }
  console.log('PASS: eight new RPC versions; every legacy function and its effective ACL unchanged');

  // Compare the actual UI helper to PostgreSQL, without recopying its algorithm.
  const helper = await readFile(resolve(root, 'src/lib/media-source.ts'), 'utf8');
  const { outputText } = ts.transpileModule(helper, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  const { getMediaSourceKey } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
  const whitespace = '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';
  const names = [null, '', whitespace, 'TopGear', ' TOPGEAR ', 'ÉCHAPPEMENT', 'Echappement',
    "L'Argus", 'L’Argus', 'Auto  Express', 'Auto Express', '__proto__', ...[...whitespace].map(w => w + 'TopGear' + w)];
  for (const name of names) {
    const { rows: [{ source }] } = await db.query('SELECT public.normalize_media_source($1) AS source', [name]);
    assert.equal(source, getMediaSourceKey(name), 'SQL/UI media identity: ' + JSON.stringify(name));
  }
  console.log('PASS: SQL/UI parity for case, accents, punctuation, all String.trim whitespace and absent names');
  await db.exec(await readFile(resolve(root, 'supabase/tests/media_source_identity.sql'), 'utf8'));
  console.log('PASS: eight RPCs × three roles: case variants, blanks, review averages, aliases, SEO ranks and sitemap');

  // Reuse the established limit/MY/alias regression against the successor RPCs.
  let limits = await readFile(resolve(root, 'supabase/tests/ranking_limits.sql'), 'utf8');
  for (const [oldName, newName] of successors) limits = limits.replaceAll(oldName, newName);
  await db.exec(limits);
  console.log('PASS: successor ranking limits (100/15), aliases and separate MY groups');

  // Validate the separately authorized sitemap cleanup after the Q2 regression.
  const retiredSitemapNames = new Set([
    'get_sitemap_groups_filtered',
    'get_sitemap_groups_filtered_v2',
    'get_sitemap_groups_filtered_v3',
    'get_sitemap_canonical_routes',
    'get_sitemap_canonical_routes_v2',
    'get_sitemap_canonical_routes_v3',
  ]);
  const cleanup = await readFile(resolve(root,
    'supabase/migrations/20261021190000_remove_unused_sitemap_rpcs.sql'), 'utf8');
  const beforeCleanup = await snapshot();
  assert.equal(beforeCleanup.filter(fn => retiredSitemapNames.has(fn.proname)).length, 6);

  // A remaining SQL consumer must block the cleanup, never be removed by CASCADE.
  await db.exec('BEGIN; CREATE VIEW public.sitemap_dependency_fixture AS SELECT * FROM public.get_sitemap_groups_filtered_v3();');
  await assert.rejects(db.exec(cleanup), error => error.code === '2BP01');
  await db.exec('ROLLBACK;');
  assert.deepEqual(await snapshot(), beforeCleanup,
    'A dependency-blocked cleanup must leave every function intact');
  console.log('PASS: cleanup refuses a dependent view and rolls back without changing functions');

  await db.exec(cleanup);
  assert.deepEqual(await snapshot(), beforeCleanup.filter(fn => !retiredSitemapNames.has(fn.proname)),
    'Remove only six unused sitemap RPCs; preserve every retained identity, definition and effective ACL');
  await db.exec('SET row_security TO on;');
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await db.exec(`SET ROLE ${role}; SELECT * FROM public.get_sitemap_groups_filtered_v4(); RESET ROLE;`);
  }
  console.log('PASS: six unused sitemap RPCs removed; active v4 and every retained function/ACL unchanged');
} catch (error) {
  console.error('FAIL: ' + error.message);
  if (error.detail) console.error(error.detail);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally {
  await db.close();
}
