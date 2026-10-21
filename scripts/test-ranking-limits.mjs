// Isolated PostgreSQL regression runner. No Supabase URL or credentials are read.
// Install the test engine outside application dependencies:
//   npm install --prefix work/tools --no-save --package-lock=false @electric-sql/pglite
//   node scripts/test-ranking-limits.mjs --pglite-module work/tools/node_modules/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const moduleFlag = process.argv.indexOf('--pglite-module');
const moduleName = moduleFlag === -1
  ? '@electric-sql/pglite'
  : pathToFileURL(resolve(process.argv[moduleFlag + 1])).href;
const { PGlite } = await import(moduleName);
const { unaccent } = await import(moduleFlag === -1
  ? '@electric-sql/pglite/contrib/unaccent'
  : new URL('./contrib/unaccent.js', moduleName).href);
const db = new PGlite({ extensions: { unaccent } }); // Memory only: every invocation starts empty.
const migrationName = '20261020000000_bound_public_ranking_limits.sql';
const cleanupMigrationName = '20261021200000_drop_unused_public_functions.sql';
const sqlHelpers = new Set(['slugify_text', 'normalize_media_source']);
const activeCalls = new Map([
  ['find_brand_by_slug_v2', "SELECT * FROM public.find_brand_by_slug_v2('limitfixture')"],
  ['get_full_context_by_slugs_v3', `SELECT * FROM public.get_full_context_by_slugs_v3(
    'limitfixture', 'family-1', 2024, 'model-sw-cabriolet-1', 'electrique')`],
  ['get_families_by_brand_v2', "SELECT * FROM public.get_families_by_brand_v2('LimitFixture')"],
  ['search_cars_v14', "SELECT * FROM public.search_cars_v14('LimitFixture')"],
  ['get_model_ranking_v8', 'SELECT * FROM public.get_model_ranking_v8()'],
  ['get_break_ranking_v6', 'SELECT * FROM public.get_break_ranking_v6()'],
  ['get_convertible_ranking_v6', 'SELECT * FROM public.get_convertible_ranking_v6()'],
  ['get_brand_ranking_v9', 'SELECT * FROM public.get_brand_ranking_v9()'],
  ['get_homepage_stats', 'SELECT * FROM public.get_homepage_stats()'],
  ['get_trending_models_v5', 'SELECT * FROM public.get_trending_models_v5()'],
  ['get_vehicle_seo_stats_v6', `SELECT * FROM public.get_vehicle_seo_stats_v6(
    'LimitFixture', 'Family 1', 2024, 'Model SW Cabriolet 1')`],
  ['get_sitemap_groups_filtered_v4', 'SELECT * FROM public.get_sitemap_groups_filtered_v4()'],
  // Not called by JS: this helper is used inside the brand/context RPC bodies.
  ['slugify_text', "SELECT public.slugify_text('Électrique & SW +') AS slug"],
  ['normalize_media_source', "SELECT public.normalize_media_source('  TopGear  ') AS source"],
]);
const successors = new Map([
  ['get_model_ranking_v6', 'get_model_ranking_v7'],
  ['get_break_ranking_v4', 'get_break_ranking_v5'],
  ['get_convertible_ranking_v4', 'get_convertible_ranking_v5'],
  ['get_trending_models_v3', 'get_trending_models_v4'],
]);

async function snapshot() {
  const { rows } = await db.query(`
    SELECT p.oid, p.proname, p.oid::regprocedure::text AS signature,
           oidvectortypes(p.proargtypes) AS arg_types,
           ('limit_val' = ANY(p.proargnames)) IS TRUE AS has_limit,
           EXISTS (SELECT 1 FROM pg_depend d
                   WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid
                     AND d.deptype = 'e') AS extension_owned,
           pg_get_functiondef(p.oid) AS definition,
           p.proowner, p.proacl::text, p.prosecdef, p.proconfig,
           p.provolatile, p.proisstrict, p.proparallel,
           (SELECT jsonb_agg(jsonb_build_array(a.grantor, a.grantee, a.privilege_type, a.is_grantable)
                             ORDER BY a.grantor, a.grantee, a.privilege_type, a.is_grantable)
            FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a) AS effective_acl
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    ORDER BY p.proname, p.oid
  `);
  return rows;
}

async function assertApplicationInventory() {
  const calledNames = new Set();
  for (const name of await readdir(resolve(root, 'src'), { recursive: true })) {
    if (!/\.(ts|tsx)$/.test(name) || /\.(test|spec)\./.test(name)) continue;
    const source = await readFile(resolve(root, 'src', name), 'utf8');
    // Direct RPC calls plus the rankings component's default/prop-based calls.
    const patterns = [
      /\.rpc\(\s*['"](\w+)['"]/g,
      /customRpcName\s*=\s*['"](\w+)['"]/g,
      /customRpcName\s*\|\|\s*['"](\w+)['"]/g,
    ];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) calledNames.add(match[1]);
    }
  }
  assert.deepEqual([...calledNames].sort(), [...activeCalls.keys()].filter(name => !sqlHelpers.has(name)).sort(),
    'The retained RPC inventory must match application calls, including dynamic rankings');
}

try {
  await assertApplicationInventory();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
  `);
  const names = (await readdir(resolve(root, 'supabase/migrations'))).sort();
  for (const name of names.filter(name => name.endsWith('.sql') && name < migrationName)) {
    let sql = await readFile(resolve(root, 'supabase/migrations', name), 'utf8');
    if (name === '20260827171821_remote_schema.sql') {
      // PGlite has no Supabase Vault/realtime service. None of these extensions
      // or the publication is used by the ranking functions under test.
      sql = sql.replace(/^CREATE EXTENSION(?![^;]*"unaccent")[^;]*;\s*$/gm, '');
      sql = sql.replace(/^ALTER PUBLICATION[^;]*;\s*$/gm, '');
    }
    await db.exec(sql);
  }
  await db.exec('SET search_path TO public; SET row_security TO on;');
  const before = (await snapshot()).filter(fn => fn.has_limit);
  assert.equal(before.length, 15, 'Inventory must include all current and legacy limit_val RPCs');
  const { rows: [{ version }] } = await db.query('SELECT version()');
  console.log(version);
  const regressionSql = await readFile(resolve(root, 'supabase/tests/ranking_limits.sql'), 'utf8');
  const firstAssertion = regressionSql.indexOf('DO $$');
  assert.ok(firstAssertion > 0, 'The SQL suite must start with its shared fixtures');
  const fixturesSql = regressionSql.slice(0, firstAssertion);
  async function assertLegacyBehavior(functions) {
    await db.exec(fixturesSql);
    for (const { proname } of functions) {
      const { rows: [{ explicit_null, omitted }] } = await db.query(`
        SELECT (SELECT count(*) FROM public.${proname}(limit_val => NULL)) AS explicit_null,
               (SELECT count(*) FROM public.${proname}()) AS omitted
      `);
      assert.equal(explicit_null, 125, `${proname}: legacy NULL behavior must remain available`);
      assert.equal(omitted, proname.startsWith('get_trending_models') ? 15 : 100);
    }
    await db.exec('ROLLBACK;');
  }
  await assertLegacyBehavior(before);
  console.log('PASS: original NULL bypass reproduced on all 15 legacy RPCs (125 rows versus defaults 100/15)');
  await db.exec(await readFile(resolve(root, 'supabase/migrations', migrationName), 'utf8'));
  const after = (await snapshot()).filter(fn => fn.has_limit);
  assert.equal(after.length, before.length + successors.size,
    'The migration must add exactly four new endpoints');
  const newNames = new Set(successors.values());
  assert.deepEqual(after.filter(fn => !newNames.has(fn.proname)), before,
    'All 15 legacy definitions, identities, owners, ACLs and security properties must remain unchanged');
  const normalize = text => text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
  const comparableProperties = properties => Object.fromEntries(
    Object.entries(properties).filter(([key]) => !['oid', 'proname', 'signature', 'definition', 'proacl'].includes(key)),
  );
  for (const [oldName, newName] of successors) {
    const oldFunction = before.find(fn => fn.proname === oldName);
    const newFunction = after.find(fn => fn.proname === newName);
    assert.ok(newFunction, `${newName}: successor endpoint must exist`);
    assert.notEqual(newFunction.oid, oldFunction.oid, `${newName}: must be a new function object`);
    const cap = oldName.startsWith('get_trending_models') ? 15 : 100;
    assert.equal(
      normalize(newFunction.definition),
      normalize(oldFunction.definition).replace(oldName, newName).replace(/limit\s+limit_val/gi,
        `LIMIT LEAST(GREATEST(COALESCE(limit_val, ${cap}), 0), ${cap})`),
      `${newName}: only the version name and LIMIT expression may differ from its predecessor`,
    );
    assert.deepEqual(comparableProperties(newFunction), comparableProperties(oldFunction),
      `${newName}: owner, effective ACL and security properties must match its predecessor`);
  }
  console.log('PASS: four successor endpoints added; all 15 legacy endpoints and ACLs strictly unchanged');
  await assertLegacyBehavior(before);
  console.log('PASS: legacy endpoints remain callable with their previous NULL behavior after migration');
  await db.exec(regressionSql);
  console.log('PASS: 4 new RPCs × 3 roles × 10 limit cases; family aliases and separate MY groups');

  // Test #88's historical rollout above, then replay every later migration so
  // this runner also validates the current schema rather than stopping at #88.
  for (const name of names.filter(name => name.endsWith('.sql') && name > migrationName && name < cleanupMigrationName)) {
    await db.exec(await readFile(resolve(root, 'supabase/migrations', name), 'utf8'));
  }
  const beforeCleanup = await snapshot();
  assert.equal(beforeCleanup.filter(fn => !fn.extension_owned).length, 49,
    'Review the Q4 inventory when adding a project function');
  const retired = beforeCleanup.filter(fn => !fn.extension_owned && !activeCalls.has(fn.proname));
  assert.equal(retired.length, 35, 'Q4 must retire all 35 remaining unused project functions');
  async function activeResults() {
    await db.exec(fixturesSql);
    const results = [];
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await db.exec(`SET LOCAL ROLE ${role};`);
      for (const [name, sql] of activeCalls) {
        const { rows } = await db.query(sql);
        assert.ok(rows.length > 0, `${name} as ${role}: fixture must exercise a nonempty result`);
        if (name === 'slugify_text') assert.equal(rows[0].slug, 'electrique-and-sw-plus');
        if (name === 'normalize_media_source') assert.equal(rows[0].source, 'topgear');
        if (name === 'get_full_context_by_slugs_v3') {
          assert.equal(rows[0].real_marque, 'LimitFixture');
          assert.equal(rows[0].real_modele, 'Model SW Cabriolet 1');
          assert.equal(rows[0].real_powertrain, 'Electrique');
        }
        if (name === 'get_vehicle_seo_stats_v6') {
          assert.equal(rows[0][name].review_count, 3);
          assert.equal(rows[0][name].is_reliable, true);
        }
        results.push({ role, name, rows });
      }
      await db.exec('RESET ROLE;');
    }
    await db.exec('ROLLBACK;');
    return results;
  }
  const resultsBefore = await activeResults();
  assert.ok(names.includes(cleanupMigrationName), 'The Q4 cleanup migration must exist');
  const cleanupSql = await readFile(resolve(root, 'supabase/migrations', cleanupMigrationName), 'utf8');
  await db.exec('BEGIN; CREATE VIEW public.ranking_dependency_fixture AS SELECT * FROM public.get_model_ranking_v7();');
  await assert.rejects(db.exec(cleanupSql), error => error.code === '2BP01');
  await db.exec('ROLLBACK;');
  assert.deepEqual(await snapshot(), beforeCleanup,
    'A dependency-blocked cleanup must leave every function intact');
  console.log('PASS: a dependent view blocks the entire cleanup without cascading or partial removal');
  for (const name of names.filter(name => name.endsWith('.sql') && name >= cleanupMigrationName)) {
    await db.exec(await readFile(resolve(root, 'supabase/migrations', name), 'utf8'));
  }
  assert.deepEqual(await snapshot(), beforeCleanup.filter(fn => !retired.includes(fn)),
    'Only the 35 retired functions may change; retained functions and extension functions must be identical');
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await db.exec(`SET ROLE ${role};`);
    for (const fn of retired) {
      const args = fn.arg_types ? fn.arg_types.split(', ').map(type => `NULL::${type}`).join(', ') : '';
      await assert.rejects(db.query(`SELECT * FROM public.${fn.proname}(${args})`),
        error => error.code === '42883', `${fn.signature} as ${role}: must no longer resolve`);
    }
    await db.exec('RESET ROLE;');
  }
  console.log('PASS: 35 retired signatures no longer resolve for any of the 3 API roles');
  assert.deepEqual(await activeResults(), resultsBefore,
    'All 12 application RPCs and both SQL helpers must return the same results after cleanup for each role');
  console.log('PASS: 12 active RPCs + 2 SQL helpers: identical OIDs, definitions, owners, ACLs, security and results');
  let currentRegressionSql = regressionSql;
  for (const [oldName, newName] of [
    ['get_model_ranking_v7', 'get_model_ranking_v8'],
    ['get_break_ranking_v5', 'get_break_ranking_v6'],
    ['get_convertible_ranking_v5', 'get_convertible_ranking_v6'],
    ['get_trending_models_v4', 'get_trending_models_v5'],
  ]) currentRegressionSql = currentRegressionSql.replaceAll(oldName, newName);
  await db.exec(currentRegressionSql);
  console.log('PASS: current schema still enforces all ranking bounds and alias/MY regressions');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  if (error.detail) console.error(error.detail);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally {
  await db.close();
}
