import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {readbackPng} from './png.mjs';

// Ephemeral source verification host, not an editor route or a native evaluator.
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const initialFile=process.env.BAROCSS_NATIVE_FACE_INITIAL,rebuiltFile=process.env.BAROCSS_NATIVE_FACE_REBUILT;
const metadataFile=process.env.BAROCSS_NATIVE_FACE_METADATA,output=process.env.BAROCSS_NATIVE_FACE_EVIDENCE;
assert(initialFile&&rebuiltFile&&metadataFile&&output,'Actual recorded own-CAD initial/rebuilt DTOs, metadata and unique evidence output are required');
const initial=await readFile(initialFile),rebuilt=await readFile(rebuiltFile),metadata=await readFile(metadataFile);
for(const bytes of [initial,rebuilt,metadata])assert(bytes.length<=2097152,'Recorded native input exceeds2MiB');
assert.equal(JSON.parse(initial).format,'barocss-native-face-mesh');assert.equal(JSON.parse(rebuilt).format,'barocss-native-face-mesh');
const entry='packages/barocss-gpu/src/index.ts';
const bundle=await build({absWorkingDir:repo,entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',metafile:true,logLevel:'silent'});
const sourceInputs=Object.keys(bundle.metafile.inputs);assert(sourceInputs.every(p=>p.startsWith('packages/barocss-gpu/src/')&&!p.includes('/dist/')));
const html='<!doctype html><html><meta charset="utf-8"><title>Own CAD → GPU bridge verification</title><h1>Own native plate / circular hole</h1><p>Ephemeral source smoke. No project editing or native kernel rerun.</p><button id="run">Run recorded native flow</button><output id="status">Ready</output><canvas id="preview" width="800" height="600"></canvas><script type="module" src="/flow.mjs"></script></html>';
const files=new Map([['/',Buffer.from(html)],['/initial.json',initial],['/rebuilt.json',rebuilt],['/metadata.json',metadata],['/gpu.js',bundle.outputFiles[0].contents],['/flow.mjs',await readFile(path.join(repo,'examples/cad-preview/kernel-face-preview-flow.mjs'))],['/screen-ray.mjs',await readFile(path.join(repo,'examples/cad-preview/screen-ray.mjs'))]]);
let complete;const finished=new Promise(resolve=>{complete=resolve;});let delivered=false;
const server=createServer(async(req,res)=>{
  const fail=()=>{res.writeHead(404);res.end('Not found');};
  if(!/^(127\.0\.0\.1|localhost):[0-9]+$/.test(req.headers.host??'')||!req.url||req.url.includes('?'))return fail();
  if(req.method==='POST'&&req.url==='/result'){
    if(delivered||req.headers.origin!=='http://'+req.headers.host)return fail();
    const parts=[];let length=0;
    try{for await(const part of req){length+=part.length;if(length>16000000)throw Error('Evidence payload limit');parts.push(part);}const result=JSON.parse(Buffer.concat(parts).toString());delivered=true;complete(result);res.writeHead(200);res.end('Recorded');}catch{res.writeHead(400);res.end('Invalid evidence');complete({ok:false,error:'Invalid evidence payload'});}return;
  }
  if(req.method!=='GET'||!files.has(req.url))return fail();
  res.writeHead(200,{'content-type':req.url.endsWith('.json')?'application/json':req.url==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'none'; img-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});res.end(files.get(req.url));
});
await mkdir(output,{recursive:true});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const url='http://127.0.0.1:'+server.address().port+'/';
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
await writeFile(path.join(output,'host.json'),JSON.stringify({head,url,initialFile,rebuiltFile,metadataFile,initialSHA256:sha(initial),rebuiltSHA256:sha(rebuilt),metadataSHA256:sha(metadata),sourceInputs,nativeEvaluationRerun:false},null,2)+'\n');
console.log('Source GPU flow ready: '+url);console.log('Open with the controlled browser and click Run recorded native flow.');
const timer=setTimeout(()=>complete({ok:false,error:'Controlled browser flow did not complete within5minutes'}),300000);
try{
  const result=await finished;clearTimeout(timer);
  for(const frame of result.frames??[]){const rgba=Buffer.from(frame.rgbaBase64,'base64');assert.equal(rgba.length,frame.width*frame.height*4);assert(['initial-cut','selected-face','rebuilt-width100'].includes(frame.name));await writeFile(path.join(output,frame.name+'.png'),readbackPng(rgba,frame.width,frame.height));frame.rgbaSHA256=sha(rgba);delete frame.rgbaBase64;}
  const receipt={head,...result,sourceInputs,nativeEvaluationRerun:false,broaderValidation:'deferred'};
  await writeFile(path.join(output,'result.json'),JSON.stringify(receipt,null,2)+'\n');assert.equal(result.ok,true,result.error);assert.equal(result.backend.glError,0);assert.deepEqual(result.errors,[]);
  console.log('Own native face DTO/source/upload/pixel/qualified-face/rebuild/stale/refusal flow passed.');
}finally{clearTimeout(timer);await new Promise(resolve=>server.close(resolve));}
