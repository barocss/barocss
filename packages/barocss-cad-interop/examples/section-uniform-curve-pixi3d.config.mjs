import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
const data=new URL('./section-uniform-curve-pixi3d-data/',import.meta.url),requests=[];
const originals=new Set(['polynomial.actual-world.source0.css','polynomial.authored-request.json','polynomial.owned-section.json','polynomial.surface-uv.dimensionless-sidecar.json','polynomial.plane-uv.dimensionless-sidecar.json']);
const published=process.env.LOADER1142_COMPILED_BUNDLE;
export default defineConfig({root:fileURLToPath(new URL('../../../',import.meta.url)),server:{port:5252,strictPort:true},
 optimizeDeps:{include:['pixi.js','pixi3d/pixi7'],noDiscovery:true},plugins:[{name:'original-section-and-published-consumer',configureServer(server){
  server.middlewares.use((request,response,next)=>{const path=request.url?.split('?')[0];
   if(path==='/loader1142-request-log.json'){response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');response.end(JSON.stringify(requests));return;}
   const prefix='/packages/barocss-cad-interop/examples/section-uniform-curve-pixi3d-data/',file=path?.startsWith(prefix)?path.slice(prefix.length):null;
   if(originals.has(file)){const bytes=readFileSync(new URL(file,data));requests.push({sequence:requests.length+1,file,status:200,bytes:bytes.length});response.setHeader('Content-Type',file.endsWith('.css')?'text/plain; charset=utf-8':'application/json; charset=utf-8');response.setHeader('Content-Length',bytes.length);response.setHeader('Cache-Control','no-store');response.end(bytes);return;}
   if(published&&path==='/loader1142-published.mjs'){response.setHeader('Content-Type','text/javascript');response.end(readFileSync(published));return;}
   if(published&&path==='/packages/barocss-cad-interop/examples/section-uniform-curve-pixi3d.html'){response.setHeader('Content-Type','text/html');response.end(readFileSync(new URL('./section-uniform-curve-pixi3d.html',import.meta.url),'utf8').replace('<html lang="en">','<html lang="en" data-loader1142-mode="compiled">').replace('./section-uniform-curve-pixi3d.mjs','/loader1142-published.mjs'));return;}
   next();});}}]});
