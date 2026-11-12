import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const packaging=await import('../scripts/prepare-sync-server.mjs');
const root=new URL('../',import.meta.url);

test('server packaging removes only version cache queries from relative module declarations',()=>{
 assert.equal(typeof packaging.normalizeServerImports,'function');
 const input=[
  "import {value} from './core.mjs?v=alpine-v7.1';",
  "export {value} from '../catalog.mjs?v=sync-v1';",
  'import "./side-effect.js?v=release-2";',
  "import remote from 'https://example.com/file.mjs?v=release';",
  "import mode from './core.mjs?mode=edit';",
  "import mixed from './core.mjs?v=one&mode=edit';",
  "const label='./core.mjs?v=literal';",
  "export const label2='./core.mjs?v=literal';",
 ].join('\n');
 const expected=[
  "import {value} from './core.mjs';",
  "export {value} from '../catalog.mjs';",
  'import "./side-effect.js";',
  "import remote from 'https://example.com/file.mjs?v=release';",
  "import mode from './core.mjs?mode=edit';",
  "import mixed from './core.mjs?v=one&mode=edit';",
  "const label='./core.mjs?v=literal';",
  "export const label2='./core.mjs?v=literal';",
 ].join('\n');
 assert.equal(packaging.normalizeServerImports(input),expected);
});

test('packaged shared dependency graph imports from an independent server directory',async()=>{
 assert.equal(typeof packaging.prepareSyncServer,'function');
 const directory=await mkdtemp(join(tmpdir(),'snowpack-package-'));
 try {
  await mkdir(join(directory,'docs'));
  await writeFile(join(directory,'docs/catalog.mjs'),'export const value=42;\n');
  await writeFile(join(directory,'docs/core.mjs'),"export {value} from './catalog.mjs?v=alpine-v7.1';\n");
  await writeFile(join(directory,'docs/sync-data.mjs'),"import {value} from './core.mjs?v=alpine-v7.1';\nexport const validateSnapshot=()=>value===42;\n");
  await packaging.prepareSyncServer(pathToFileURL(directory+'/'));
  const deployed=await import(pathToFileURL(join(directory,'server/shared/sync-data.mjs')));
  assert.equal(deployed.validateSnapshot(),true);
  assert.equal(await readFile(join(directory,'server/shared/core.mjs'),'utf8'),"export {value} from './catalog.mjs';\n");
 } finally {await rm(directory,{recursive:true,force:true});}
});

test('delivery copies match canonical source apart from the known module version query',async()=>{
 for(const name of ['catalog.mjs','core.mjs','sync-data.mjs']) {
  const source=await readFile(new URL('docs/'+name,root),'utf8');
  const actual=await readFile(new URL('server/shared/'+name,root),'utf8');
  const expected=source.replaceAll("'./catalog.mjs?v=alpine-v7.1'","'./catalog.mjs'")
    .replaceAll("'./core.mjs?v=alpine-v7.1'","'./core.mjs'");
  assert.equal(actual,expected,`${name} must be refreshed before deployment`);
 }
 const {validateSnapshot}=await import('../server/shared/sync-data.mjs');
 const {createInitialState}=await import('../server/shared/core.mjs');
 assert.equal(validateSnapshot(createInitialState()),true);
});
