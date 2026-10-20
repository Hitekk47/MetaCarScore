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
const successors = new Map([
  ['get_model_ranking_v6', 'get_model_ranking_v7'],
  ['get_break_ranking_v4', 'get_break_ranking_v5'],
  ['get_convertible_ranking_v4', 'get_convertible_ranking_v5'],
  ['get_trending_models_v3', 'get_trending_models_v4'],
]);

async function snapshot() {
  const { rows } = await db.query(`
    SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS definition,
           p.proowner, p.proacl::text, p.prosecdef, p.proconfig,
           p.provolatile, p.proisstrict, p.proparallel,
           (SELECT jsonb_agg(jsonb_build_array(a.grantor, a.grantee, a.privilege_type, a.is_grantable)
                             ORDER BY a.grantor, a.grantee, a.privilege_type, a.is_grantable)
            FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a) AS effective_acl
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND 'limit_val' = ANY(p.proargnames)
    ORDER BY p.proname
  `);
  return rows;
}

try {
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
  const before = await snapshot();
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
  const after = await snapshot();
  assert.equal(after.length, before.length + successors.size,
    'The migration must add exactly four new endpoints');
  const newNames = new Set(successors.values());
  assert.deepEqual(after.filter(fn => !newNames.has(fn.proname)), before,
    'All 15 legacy definitions, identities, owners, ACLs and security properties must remain unchanged');
  const normalize = text => text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
  const comparableProperties = properties => Object.fromEntries(
    Object.entries(properties).filter(([key]) => !['oid', 'proname', 'definition', 'proacl'].includes(key)),
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
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  if (error.detail) console.error(error.detail);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally {
  await db.close();
}
