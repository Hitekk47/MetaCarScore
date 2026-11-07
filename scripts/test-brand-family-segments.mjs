// Runs PostgreSQL in memory. Never reads hosted Supabase credentials or mutates live data.
// npm install --cache work/npm-cache --prefix work/tools --no-save --package-lock=false @electric-sql/pglite
// node scripts/test-brand-family-segments.mjs --pglite-module work/tools/node_modules/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const moduleFlag = process.argv.indexOf('--pglite-module');
const moduleName = moduleFlag === -1 ? '@electric-sql/pglite'
  : pathToFileURL(resolve(process.argv[moduleFlag + 1])).href;
const { PGlite } = await import(moduleName);
const { unaccent } = await import(moduleFlag === -1 ? '@electric-sql/pglite/contrib/unaccent'
  : new URL('./contrib/unaccent.js', moduleName).href);
const db = new PGlite({ extensions: { unaccent } });
const migrationName = '20261107000000_brand_family_segments.sql';

async function snapshot() {
  const { rows } = await db.query(`
    SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS definition,
      p.proowner, p.prosecdef, p.proconfig,
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
      // The tested SQL uses neither Supabase Vault/realtime nor their extensions.
      sql = sql.replace(/^CREATE EXTENSION(?![^;]*"unaccent")[^;]*;\s*$/gm, '');
      sql = sql.replace(/^ALTER PUBLICATION[^;]*;\s*$/gm, '');
    }
    await db.exec(sql);
  }
  const before = await snapshot();
  await db.exec(await readFile(resolve(root, 'supabase/migrations', migrationName), 'utf8'));
  const after = await snapshot();
  assert.deepEqual(after.filter(fn => fn.proname !== 'get_families_by_brand_v3'), before,
    'All existing functions, including v2, must preserve identity, definition, owner, ACL and security');
  const v2 = after.find(fn => fn.proname === 'get_families_by_brand_v2');
  const v3 = after.find(fn => fn.proname === 'get_families_by_brand_v3');
  for (const property of ['proowner', 'prosecdef', 'proconfig', 'effective_acl']) {
    assert.deepEqual(v3[property], v2[property], `v3 must match v2 ${property}`);
  }
  await db.exec(await readFile(resolve(root, 'supabase/tests/brand_family_segments.sql'), 'utf8'));
  console.log('PASS: additive v3 migration preserves legacy functions and effective ACLs');
  console.log('PASS: real SQL across all API roles: multiple segments, exact/fallback MY, aliases, counts and missing/unknown segments');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  if (error.detail) console.error(error.detail);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally {
  await db.close();
}
