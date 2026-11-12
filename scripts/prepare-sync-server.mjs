import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Browser cache versions are not filesystem paths. Vercel's dependency tracer
// must see the plain relative specifier to include each shared server module.
// Restrict this to static import/export declarations and a sole ?v= query;
// unrelated strings, remote URLs, and functional query parameters stay intact.
export function normalizeServerImports(source){
 return source.replace(/^(\s*(?:import|export)\s+(?:[^'";\r\n]*?\bfrom\s*)?)(['"])(\.{1,2}\/[^'"\r\n?#]+\.m?js)\?v=[A-Za-z0-9._~-]+\2/gm,
  (_match,declaration,quote,path)=>declaration+quote+path+quote);
}

export async function prepareSyncServer(root=new URL('../',import.meta.url)){
 await mkdir(new URL('server/shared/',root),{recursive:true});
 for(const name of ['core.mjs','catalog.mjs','sync-data.mjs']){
  const source=await readFile(new URL('docs/'+name,root),'utf8');
  await writeFile(new URL('server/shared/'+name,root),normalizeServerImports(source));
 }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await prepareSyncServer();
 console.log('Prepared server validation modules with traceable relative imports.');
}
