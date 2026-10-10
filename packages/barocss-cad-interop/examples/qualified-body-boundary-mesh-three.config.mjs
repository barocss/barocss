import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../..');
const names=['main.mesh-request.json','main.mesh-result.json','edited.mesh-request.json','edited.mesh-result.json','single.mesh-request.json','single.mesh-result.json'];
const mode=process.env.LOADER1381_MODE??'source',output=process.env.LOADER1381_OUTPUT;
if(!['source','compiled'].includes(mode))throw new Error('LOADER1381_MODE must be source or compiled');
if(mode==='compiled'&&(!output||!output.startsWith('/')))throw new Error('Compiled output must be an absolute directory');
const ledger=[];
export default {root,configFile:false,optimizeDeps:{noDiscovery:true,entries:[resolve(here,'qualified-body-boundary-mesh-three.html')],include:['three']},server:{host:'127.0.0.1',port:mode==='source'?58181:58182,strictPort:true,hmr:false},plugins:[{name:'loader1381-literal-data',transformIndexHtml(html){let text=html.replace('data-loader1381-mode="source"','data-loader1381-mode="'+mode+'"');if(mode==='compiled')text=text.replace('./qualified-body-boundary-mesh-three.mjs','/loader1381-compiled.mjs');return text;},configureServer(server){server.middlewares.use((req,res,next)=>{
 const url=new URL(req.url??'/','http://127.0.0.1');
 if(url.pathname==='/loader1381-ledger'){const body=Buffer.from(JSON.stringify({requests:ledger}));res.writeHead(200,{'Content-Type':'application/json;charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'});res.end(body);return;}
 if(url.pathname==='/loader1381-compiled.mjs'&&mode==='compiled'){const body=readFileSync(resolve(output,'browser.bundle.mjs'));res.writeHead(200,{'Content-Type':'text/javascript;charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'});res.end(body);return;}
 if(url.pathname.startsWith('/loader1381-data/')){
  const name=url.pathname.slice('/loader1381-data/'.length),allowed=names.includes(name)&&['GET','HEAD'].includes(req.method);const row={index:ledger.length+1,file:name,method:req.method,status:allowed?200:404,bytes:0,finished:false,closed:false};ledger.push(row);res.on('finish',()=>{row.finished=true;});res.on('close',()=>{row.closed=true;});
  if(!allowed){res.writeHead(404,{'Content-Length':0,'Cache-Control':'no-store'});res.end();return;}
  const body=readFileSync(resolve(here,'qualified-body-boundary-mesh-three-data',name));row.contentLength=body.length;row.contentType='application/json;charset=utf-8';res.writeHead(200,{'Content-Type':row.contentType,'Content-Length':body.length,'Cache-Control':'no-store'});if(req.method==='HEAD')res.end();else{row.bytes=body.length;res.end(body);}return;
 }
 if(mode==='compiled'&&/^\/packages\/barocss-(cad|cad-interop)\/src\//.test(url.pathname)){res.writeHead(403,{'Content-Length':0});res.end();return;}next();
 });}}]};
