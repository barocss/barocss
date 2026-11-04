// Reusable local preview. No paid receipt, expected trajectory, or verification badge.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,join,dirname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {makeCases} from './cases.mjs';
const major=Number(process.versions.node.split('.')[0]);
assert.ok(major>=22,'Node.js22 or newer is required.');
assert.equal(process.argv.length,2,'Usage: node examples/physics-sample-gallery-2276/dev.mjs');
const here=import.meta.dirname,root=resolve(here,'../..'),dist=join(root,'packages/barocss-physics/dist'),entry=join(dist,'index.js'),out=join(root,'output/physics-gallery-dev'),origin='http://127.0.0.1:53050';
try{assert.ok((await stat(entry)).isFile());}catch{throw Error('Missing packages/barocss-physics/dist/index.js. Run `pnpm --filter @barocss/physics build:library`, then start this preview again. The preview does not build Physics or install dependencies.');}
const {build}=await import('esbuild'),{ownedPackages}=await import(pathToFileURL(join(root,'examples/physics-lab/owned-packages.mjs')));
const inside=(base,p)=>p===base||p.startsWith(base+sep);
const bundle=await build({absWorkingDir:root,entryPoints:[join(here,'scene/app.mjs'),join(here,'scene/worker.mjs')],outdir:out,outExtension:{'.js':'.mjs'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',metafile:true,logLevel:'silent',plugins:[{name:'current-compiled-physics-only',setup(api){api.onResolve({filter:/^@barocss\/physics(?:\/.*)?$/},args=>{assert.equal(args.path,'@barocss/physics','Preview uses the public Physics root only.');return{path:entry};});}},ownedPackages(root)]});
assert.ok(bundle.outputFiles.reduce((n,f)=>n+f.contents.length,0)<=16*1024*1024,'16MiB preview bundle bound');
for(const name of Object.keys(bundle.metafile.inputs)){const p=resolve(root,name);assert.ok(inside(root,p),'Preview input must stay in this checkout.');if(inside(join(root,'packages/barocss-physics'),p))assert.ok(inside(dist,p)&&p.endsWith('.js'),'Physics must use current dist JS; no source fallback.');}
await mkdir(out,{recursive:true});const files=new Map();
for(const file of bundle.outputFiles){const name=file.path.split(sep).at(-1);await writeFile(join(out,name),file.contents);files.set('/'+name,['text/javascript',Buffer.from(file.contents)]);}
for(const name of ['index.html','style.css']){const bytes=await readFile(join(here,'scene',name));assert.ok(bytes.length<=1024*1024,'1MiB static asset bound');await writeFile(join(out,name),bytes);files.set(name==='index.html'?'/':'/'+name,[name.endsWith('html')?'text/html':'text/css',bytes]);}
const models=makeCases();assert.equal(models.length,6);assert.ok(models.every(c=>c.steps>=1&&c.steps<=128&&c.commands.length===c.steps));const modelBytes=Buffer.from(JSON.stringify(Object.fromEntries(models.map(c=>[c.caseId,c]))));assert.ok(modelBytes.length<=1024*1024,'1MiB authored model bound');files.set('/models',['application/json',modelBytes]);files.set('/favicon.ico',['image/x-icon',Buffer.alloc(0)]);
const server=createServer((req,res)=>{if(req.headers.host!=='127.0.0.1:53050'){res.writeHead(403).end();return;}const path=new URL(req.url,origin).pathname,file=files.get(path);if(req.method!=='GET'||!file){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':file[0],'cache-control':'no-store','content-security-policy':"default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'"}).end(file[1]);});
await new Promise((yes,no)=>{server.once('error',no);server.listen(53050,'127.0.0.1',yes);});
console.log('Physics gallery developer preview: '+origin+' (current compiled Physics; no verification claim)');
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>process.exit(0)));
