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

async function snapshot() {
  const { rows } = await db.query(`
    SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS definition,
           p.proowner, p.proacl::text, p.prosecdef, p.proconfig,
           p.provolatile, p.proisstrict, p.proparallel
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
  await db.exec(regressionSql.slice(0, firstAssertion));
  for (const { proname } of before) {
    const { rows: [{ explicit_null, omitted }] } = await db.query(`
      SELECT (SELECT count(*) FROM public.${proname}(limit_val => NULL)) AS explicit_null,
             (SELECT count(*) FROM public.${proname}()) AS omitted
    `);
    assert.equal(explicit_null, 125, `${proname}: reproduce the original NULL bypass`);
    assert.equal(omitted, proname.startsWith('get_trending_models') ? 15 : 100);
  }
  await db.exec('ROLLBACK;');
  console.log('PASS: original NULL bypass reproduced on all 15 RPCs (125 rows versus defaults 100/15)');
  await db.exec(await readFile(resolve(root, 'supabase/migrations', migrationName), 'utf8'));
  const after = await snapshot();
  assert.equal(after.length, before.length);
  for (let index = 0; index < before.length; index++) {
    const oldFunction = before[index];
    const newFunction = after[index];
    const cap = oldFunction.proname.startsWith('get_trending_models') ? 15 : 100;
    const normalize = text => text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
    assert.equal(
      normalize(newFunction.definition),
      normalize(oldFunction.definition).replace(/limit\s+limit_val/gi,
        `LIMIT LEAST(GREATEST(COALESCE(limit_val, ${cap}), 0), ${cap})`),
      `${oldFunction.proname}: only the LIMIT expression may change`,
    );
    const withoutDefinition = properties => Object.fromEntries(
      Object.entries(properties).filter(([key]) => key !== 'definition'),
    );
    assert.deepEqual(withoutDefinition(newFunction), withoutDefinition(oldFunction),
      `${oldFunction.proname}: identity, ACL and security properties must be preserved`);
  }
  console.log('PASS: 15 RPC definitions, identities, ACLs and security properties preserved');
  await db.exec(regressionSql);
  console.log('PASS: 15 RPCs × 3 roles × 10 limit cases; family aliases and separate MY groups');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  if (error.detail) console.error(error.detail);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally {
  await db.close();
}
