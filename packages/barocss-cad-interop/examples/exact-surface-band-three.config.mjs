import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {ORIGINAL_PINS} from './exact-surface-band-three-fixture.mjs';

export const AUTHOR=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
export const PARENT='a20ee1e378cffb4acfccb78cd7c1c0b59380680e';
export const DONOR=resolve(AUTHOR,'packages/barocss-cad-interop/examples/exact-surface-band-three-data');
export const CODE=resolve(AUTHOR,'packages/barocss-cad-interop/examples');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function createTargetServer({output,manifest,port}){
 const ledger=[],routes=new Map();
 for(const pin of manifest.originalPins)routes.set('/data/'+pin.file,{file:resolve(DONOR,pin.file),pin,mime:pin.file.endsWith('.css')?'text/plain; charset=utf-8':'application/json; charset=utf-8'});
 routes.set('/bundle.mjs',{file:resolve(output,'browser.bundle.mjs'),pin:manifest.bundle,mime:'text/javascript; charset=utf-8'});
 routes.set('/target.html',{file:resolve(CODE,'exact-surface-band-three.html'),pin:manifest.html,mime:'text/html; charset=utf-8'});
 routes.set('/source-graph.json',{file:resolve(output,'source-graph.json'),pin:manifest.sourceGraph,mime:'application/json; charset=utf-8'});
 const flush=()=>writeFileSync(resolve(output,'server-ledger.json'),JSON.stringify(ledger,null,2)+'\n');
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:'+port),row={index:ledger.length+1,method:req.method,path:url.pathname,query:url.search,status:null,responseBytes:0,requestBytes:0,closed:false};ledger.push(row);
  res.on('close',()=>{row.closed=true;flush();});
  function send(status,bytes,mime){row.status=status;row.responseBytes=bytes.length;row.mime=mime;res.writeHead(status,{'content-type':mime,'content-length':String(bytes.length),'cache-control':'no-store'});res.end(bytes);flush();}
  try{
   if(req.method==='GET'&&url.pathname==='/ready')return send(200,Buffer.from(JSON.stringify({serverReady:true,parent:PARENT,pid:process.pid,url:'http://127.0.0.1:'+port+'/target.html',autorun:false})),'application/json');
   if(req.method==='GET'&&url.pathname==='/manifest.json')return send(200,Buffer.from(JSON.stringify(manifest)),'application/json');
   if(req.method==='GET'&&url.pathname==='/ledger')return send(200,Buffer.from(JSON.stringify(ledger)),'application/json');
   if(req.method==='GET'&&url.pathname==='/favicon.ico')return send(204,Buffer.alloc(0),'image/x-icon');
   if(req.method==='GET'&&routes.has(url.pathname)){
    const route=routes.get(url.pathname),bytes=readFileSync(route.file);assert.equal(bytes.length,route.pin.bytes);assert.equal(hash(bytes),route.pin.sha256);row.sha256=route.pin.sha256;return send(200,bytes,route.mime);
   }
   if(req.method==='POST'&&url.pathname==='/evidence'){
    const name=url.searchParams.get('name');assert.ok(/^(evidence|partial|run-failure|raw-error-[0-9]+|phase-(main|rev|edited|cold-edited|cleanup1|cleanup2))\.(json|png)$/.test(name??''));
    const pieces=[];let total=0;for await(const piece of req){total+=piece.length;assert.ok(total<=64*1024*1024,'Trusted evidence POST is bounded at64MiB, not a native input allowance');pieces.push(piece);}row.requestBytes=total;
    const bytes=Buffer.concat(pieces),file=resolve(output,name);assert.equal(existsSync(file),false,'Preserve first evidence bytes');writeFileSync(file,bytes,{flag:'wx'});row.savedFile=name;row.savedSHA=hash(bytes);return send(201,Buffer.from(JSON.stringify({saved:name,bytes:bytes.length,sha256:row.savedSHA})),'application/json');
   }
   send(404,Buffer.from('Not allowlisted'),'text/plain');
  }catch(error){if(!res.headersSent)send(500,Buffer.from(JSON.stringify({name:error.name,message:error.message})),'application/json');else res.destroy(error);row.error={name:error.name,message:error.message};flush();}
 });
 return{server,ledger,flush};
}

export async function runServer(){
 assert.equal(Number(process.versions.node.split('.')[0]),22);const args=process.argv.slice(2);assert.equal(args.length,6);assert.equal(args[0],'--mode');assert.ok(['source','emitted'].includes(args[1]));assert.equal(args[2],'--output');assert.equal(args[4],'--port');assert.ok(args[3].startsWith('/'));const mode=args[1],output=resolve(args[3]),port=Number(args[5]);assert.equal(port,mode==='source'?15443:15444);
 const manifest=JSON.parse(readFileSync(resolve(output,'tooling-manifest.json'),'utf8'));assert.equal(manifest.mode,mode);assert.equal(manifest.parent,PARENT);assert.deepEqual(manifest.originalPins,ORIGINAL_PINS);assert.equal(manifest.threeVersion,'0.186.1');
 if(mode==='source')for(const suffix of ['cad','cad-interop'])assert.equal(existsSync(resolve(AUTHOR,'packages/barocss-'+suffix+'/dist')),false,'Source server before own builds');
 const host=createTargetServer({output,manifest:{...manifest,port,autorun:false},port}),ownFiles=['exact-surface-band-three.html','exact-surface-band-three.mjs','exact-surface-band-three.config.mjs','exact-surface-band-three-fixture.mjs','exact-surface-band-three-checkpoint.mjs','exact-surface-band-three-observer.mjs','exact-surface-band-three-verify.mjs'],before=ownFiles.map(file=>{const bytes=readFileSync(resolve(CODE,file));return{file,bytes:bytes.length,sha256:hash(bytes)};});
 writeFileSync(resolve(output,'server-command.json'),JSON.stringify({argv:process.argv,node:process.version,mode,parent:PARENT,pid:process.pid,port},null,2)+'\n',{flag:'wx'});let timer,stopReason=null;
 try{await new Promise((ok,no)=>{host.server.once('error',no);host.server.listen(port,'127.0.0.1',ok);});writeFileSync(resolve(output,'server-ready.json'),JSON.stringify({serverReady:true,mode,parent:PARENT,pid:process.pid,port,url:'http://127.0.0.1:'+port+'/target.html',browserAutorun:false},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({serverReady:true,mode,pid:process.pid,port,url:'http://127.0.0.1:'+port+'/target.html'}));
  await new Promise((ok,no)=>{const stop=reason=>{if(stopReason!==null)return;stopReason=reason;host.server.close(value=>value?no(value):ok());};process.once('SIGTERM',()=>stop('SIGTERM'));process.once('SIGINT',()=>stop('SIGINT'));timer=setTimeout(()=>stop('watchdog'),300000);});clearTimeout(timer);host.flush();const after=ownFiles.map(file=>{const bytes=readFileSync(resolve(CODE,file));return{file,bytes:bytes.length,sha256:hash(bytes)};});assert.deepEqual(after,before);writeFileSync(resolve(output,'server-closed.json'),JSON.stringify({closed:true,pid:process.pid,mode,parent:PARENT,stopReason,codePins:after,publicFunctionsRequireSeparateBrowserEvidence:true},null,2)+'\n',{flag:'wx'});
 }catch(value){clearTimeout(timer);host.server.close();writeFileSync(resolve(output,'server-first-failure.json'),JSON.stringify({name:value?.name??null,message:value?.message??String(value),stack:value?.stack??null},null,2)+'\n',{flag:'wx'});throw value;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await runServer();
