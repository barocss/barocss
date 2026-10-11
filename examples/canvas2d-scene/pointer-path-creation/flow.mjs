// @ts-check
import {build} from 'esbuild';
import {mkdir,readFile,writeFile,copyFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
const mode=process.argv[2],out=resolve(process.argv[3]??'');if(!['--source','--emitted'].includes(mode)||!process.argv[3])throw Error('Usage: node flow.mjs --source|--emitted OUT');
const repo=fileURLToPath(new URL('../../../',import.meta.url)),here=fileURLToPath(new URL('.',import.meta.url)),profile=mode==='--source'?'src':'dist';
await mkdir(out,{recursive:true});const result=await build({entryPoints:[join(here,'main.mjs')],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:join(out,'main.js'),alias:{'@barocss/canvas2d':join(repo,'packages/barocss-canvas2d',profile,'index.'+(profile==='src'?'ts':'js')),'@barocss/canvas2d/document':join(repo,'packages/barocss-canvas2d',profile,'document.'+(profile==='src'?'ts':'js')),'@example/scene-history':join(here,'../scene-history.mjs')},metafile:true});
const html=(await readFile(join(here,'index.html'),'utf8')).replace('src="main.mjs"','src="main.js"');await writeFile(join(out,'index.html'),html);await copyFile(join(here,'style.css'),join(out,'style.css'));await writeFile(join(out,'build.json'),JSON.stringify({profile:mode,publicEntries:profile,history:'exact unchanged ../scene-history.mjs',metadata:result.metafile},null,2));console.log(JSON.stringify({profile:mode,out,bytes:(await stat(join(out,'main.js'))).size}));
