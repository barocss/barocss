import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {ownedPackages} from '../../physics-lab/owned-packages.mjs';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../..'),home=resolve(here,'..'),sha=b=>createHash('sha256').update(b).digest('hex');
export async function buildScene(){
 const signBuild=resolve(home,'build/sign-02'),providerFiles=JSON.parse(await readFile(resolve(signBuild,'provider-pins.json'),'utf8')),receipt=JSON.parse(await readFile(resolve(signBuild,'result.json'),'utf8'));
 if(receipt.status!=='PASS_BUILD'||receipt.WorldCalls!==0)throw Error('Expected qualified sign-02 build receipt');
 for(const [name,pin]of Object.entries(providerFiles)){const path=await realpath(resolve(root,name));if(!path.startsWith(root+'/'))throw Error('Provider escaped owned checkout');const bytes=await readFile(path);if(bytes.length!==pin.bytes||sha(bytes)!==pin.sha256)throw Error('sign-02 provider drift: '+name);}
 const sourceBundle=await realpath(resolve(signBuild,'source.mjs'));
 const signSource={name:'qualified-sign-02-physics',setup(build){build.onResolve({filter:/^@barocss\/physics(?:\/replay)?$/},()=>({path:sourceBundle}));}};
 const result=await build({absWorkingDir:root,entryPoints:[resolve(here,'app.mjs')],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',metafile:true,plugins:[signSource,ownedPackages(root)]});
 const inputs={};for(const name of Object.keys(result.metafile.inputs)){const p=await realpath(resolve(root,name));if(!p.startsWith(root+'/'))throw new Error('Scene input escaped owned checkout');const b=await readFile(p);inputs[name]={bytes:b.length,sha256:sha(b)};}
 for(const name of ['index.html','style.css','server.mjs','../../physics-lab/owned-packages.mjs','../build/sign-02/provider-pins.json','../build/sign-02/result.json']){const path=resolve(here,name),b=await readFile(path);inputs[path.slice(root.length+1)]={bytes:b.length,sha256:sha(b)};}
 const output=resolve(home,'output/scene');await mkdir(output,{recursive:true});const bytes=result.outputFiles[0].contents;if(bytes.length>16*1024*1024)throw new Error('Scene bundle exceeded16MiB');
 await writeFile(resolve(output,'app.mjs'),bytes);await writeFile(resolve(output,'inputs.json'),JSON.stringify({inputs,bundleBytes:bytes.length,bundleSHA256:sha(bytes)},null,2)+'\n');return bytes;
}
export async function startScene(port=52980){
 const bundle=await buildScene(),files=new Map([['/',['text/html; charset=utf-8',await readFile(resolve(here,'index.html'))]],['/app.mjs',['text/javascript; charset=utf-8',bundle]],['/style.css',['text/css; charset=utf-8',await readFile(resolve(here,'style.css'))]],['/favicon.ico',['image/x-icon',Buffer.alloc(0)]]]);
 const server=createServer((req,res)=>{const file=files.get(new URL(req.url,'http://127.0.0.1').pathname);if(req.method!=='GET'||!file){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'content-type':file[0],'cache-control':'no-store','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(file[1]);});
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',ok);});return{server,url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise((ok,fail)=>server.close(e=>e?fail(e):ok()))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.includes('--build')){await buildScene();console.log(await readFile(resolve(home,'output/scene/inputs.json'),'utf8'));}else{const port=Number(process.env.BOX_SLAB_PORT??52980);if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid local port');const running=await startScene(port);console.log('Box slab boundaries: '+running.url);for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await running.close();process.exit(0);});}
}
