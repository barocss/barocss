import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../..');
const assets=['surface-net-editor.mjs','revolve-workspace.mjs','editor-object-tools.mjs','editor-interaction.mjs','editor-shell.mjs','editor-shell.css','editor-bootstrap.mjs','driven-circle-feature-workspace.mjs','circle-feature-display.mjs','circle-feature-workspace.mjs','circle-prism-workspace.mjs','circle-face-workspace.mjs','rectangle-feature-display.mjs','rectangle-feature-workspace.mjs','screen-ray.mjs','cutout-workspace.mjs','native-topology-preview.mjs','polygon-workspace.mjs','cad-edge-overlay.mjs','gallery.mjs','app.mjs','pipeline.mjs','fixtures.mjs','inspector.mjs','parameters.mjs','orbit.mjs','primitives.mjs','project.mjs','history.mjs','box-preview.mjs','body-workspace.mjs','body-workspace.css','style.css','gallery.css'];
const files=new Map(assets.map(name=>['/'+name,path.join(here,name)]));files.set('/',path.join(here,'gallery.html'));files.set('/workspace.html',path.join(here,'index.html'));
const gpuHere=path.join(repo,'examples/gpu-scene');for(const[name,file]of [['/scene.html','index.html'],['/app.js','app.js'],['/scene.css','style.css'],['/mesh.html','mesh.html'],['/mesh.js','mesh.js'],['/mesh-fixtures.js','mesh-fixtures.mjs'],['/mesh.css','mesh-style.css']])files.set(name,path.join(gpuHere,file));
export const sourceCsp="default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
export async function startSourceServer(port=0,{gpuScene=false}={}){
 const records=[];
 const server=createServer(async(req,res)=>{
  if(!/^(?:127\.0\.0\.1|localhost)(?::[0-9]+)?$/.test(req.headers.host??'')||req.method!=='GET'||!req.url||req.url.includes('?')){res.writeHead(404);res.end('Not found');return;}
  try{
   const packageName=req.url==='/cad.js'?'barocss-cad':req.url==='/gpu.js'?'barocss-gpu':null;let bytes,type,entry;
   if(packageName){const folder=path.join(repo,'packages',packageName),manifest=JSON.parse(await readFile(path.join(folder,'package.json'),'utf8'));entry=path.resolve(folder,manifest.exports['.'].import);if(entry!==path.join(folder,'src/index.ts'))throw Error('Local package entry must point to original src/index.ts');const result=await build({absWorkingDir:repo,entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',metafile:true,logLevel:'silent'});const inputs=Object.keys(result.metafile.inputs);if(inputs.some(file=>!/^packages\/barocss-(?:cad|gpu)\/src\//.test(file)||file.includes('/dist/')))throw Error('Unexpected package source input');bytes=result.outputFiles[0].contents;type='text/javascript; charset=utf-8';records.push({route:req.url,entry:path.relative(repo,entry),inputs});}
   else{const file=gpuScene&&req.url==='/'?files.get('/scene.html'):files.get(req.url);if(!file){res.writeHead(404);res.end('Not found');return;}bytes=await readFile(file);type=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8';}
   res.writeHead(200,{'content-type':type,'content-security-policy':sourceCsp,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...(entry?{'x-barocss-source-entry':path.relative(repo,entry)}:{})});res.end(bytes);
  }catch(error){res.writeHead(500);res.end('Source development request failed.');records.push({route:req.url,error:error.message});}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});return{server,url:'http://127.0.0.1:'+server.address().port,records,close:()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const running=await startSourceServer(Number(process.env.PORT??51208));console.log('BaroCSS source editor: '+running.url+'/workspace.html');for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await running.close();process.exit(0);});}
