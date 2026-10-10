import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),packageRoot=resolve(here,'..'),managed=resolve(packageRoot,'../..');
const names=['main.mesh-request.json','main.mesh-result.json','edited.mesh-request.json','edited.mesh-result.json','single.mesh-request.json','single.mesh-result.json'];
const html='qualified-body-boundary-mesh-babylon.html',entry='./qualified-body-boundary-mesh-babylon.mjs';
export function createQualifiedBodyBoundaryMeshBabylonConfig({mode=process.env.LOADER1382_MODE??'source',output=process.env.LOADER1382_OUTPUT,port=mode==='source'?58183:58184}={}){
 if(!['source','compiled','emitted'].includes(mode))throw new Error('LOADER1382_MODE must be source, compiled or emitted');
 const compiled=mode!=='source',requests=[];if(compiled&&!output)throw new Error('LOADER1382_OUTPUT must name the published browser bundle directory');
 return{root:here,configFile:false,optimizeDeps:{noDiscovery:true,entries:[resolve(here,html)],exclude:['@babylonjs/core']},server:{host:'127.0.0.1',port:Number(port),strictPort:true,hmr:false,fs:{allow:[managed,...(output?[resolve(output)]:[])]}},plugins:[{
  name:'loader1382-ordinary-own-package-resolution',
  async resolveId(source,importer){if(!compiled&&importer?.startsWith(here)&&/^@(?:barocss\/(?:cad|cad-interop)|babylonjs\/core)(?:\/|$)/.test(source))return this.resolve(source,resolve(packageRoot,'package.json'),{skipSelf:true});},
  configureServer(server){server.middlewares.use((req,res,next)=>{
   const url=new URL(req.url??'/','http://127.0.0.1');
   if(url.pathname==='/loader1382-ledger'){const body=Buffer.from(JSON.stringify({requests}));res.writeHead(200,{'Content-Type':'application/json;charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'});res.end(body);return;}
   if(url.pathname==='/'||url.pathname==='/'+html||url.pathname==='/packages/barocss-cad-interop/examples/'+html){let text=readFileSync(resolve(here,html),'utf8').replace('data-loader1382-mode="source"','data-loader1382-mode="'+(compiled?'compiled':'source')+'"');text=text.replace('src="'+entry+'"','src="'+(compiled?'/loader1382-published.mjs':'/qualified-body-boundary-mesh-babylon.mjs')+'"');const body=Buffer.from(text);res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'});res.end(body);return;}
   if(compiled&&url.pathname==='/loader1382-published.mjs'){const body=readFileSync(resolve(output,'browser.bundle.mjs'));res.writeHead(200,{'Content-Type':'text/javascript;charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'});res.end(body);return;}
   if(!url.pathname.startsWith('/loader1382-data/')){next();return;}
   const name=url.pathname.slice('/loader1382-data/'.length),allowed=names.includes(name)&&['GET','HEAD'].includes(req.method),row={index:requests.length+1,file:name,method:req.method,status:allowed?200:404,bytes:0,finished:false,closed:false};requests.push(row);res.on('finish',()=>{row.finished=true;});res.on('close',()=>{row.closed=true;});
   if(!allowed){res.writeHead(404,{'Content-Length':0,'Cache-Control':'no-store'});res.end();return;}
   const body=readFileSync(resolve(here,'qualified-body-boundary-mesh-babylon-data',name));row.contentLength=body.length;row.contentType='application/json;charset=utf-8';res.writeHead(200,{'Content-Type':row.contentType,'Content-Length':body.length,'Cache-Control':'no-store'});if(req.method==='HEAD')res.end();else{row.bytes=body.length;res.end(body);}
  });}
 }]};
}
export default createQualifiedBodyBoundaryMeshBabylonConfig();
