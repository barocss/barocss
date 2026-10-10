import { readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
const root=process.cwd(),examples=resolve(root,'packages/barocss-cad-interop/examples'),directory=resolve(examples,'multispan-trim-uv-three-data');
const names=new Set(['directed_exact','directed_joins','directed_cap_zero'].flatMap(key=>[key+'.authored-classification-request.json',key+'.owned-classification.json']));
for(const name of ['directed.actual-trim-model8.source0.css','directed.original-0.source0.css','directed.original-1.source0.css',...['bottom','rightLow','rightHigh','top','leftLow','leftHigh','sharedCut'].map(role=>'directed.'+role+'.dimensionless-uv.json')])names.add(name);
const alias=[];for(const suffix of ['cad','cad-interop']){const directory=resolve(root,'packages/barocss-'+suffix),manifest=JSON.parse(readFileSync(resolve(directory,'package.json'),'utf8'));for(const [key,value]of Object.entries(manifest.exports)){const name='@barocss/'+suffix+(key==='.'?'':key.slice(1));alias.push({find:new RegExp('^'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'),replacement:resolve(directory,value.import)});}}
const requests=[],bundle=process.env.LOADER1251_COMPILED_BUNDLE;
export default {root,resolve:{alias},server:{host:'127.0.0.1',port:5298,strictPort:true,fs:{allow:[root]}},optimizeDeps:{entries:['packages/barocss-cad-interop/examples/multispan-trim-uv-three.html'],include:['three'],noDiscovery:true},plugins:[{
 name:'literal-original-multispan-trim-uv',configureServer(server){server.middlewares.use((request,response,next)=>{
  const path=new URL(request.url,'http://localhost').pathname;
  if(path==='/loader1251-request-log.json'){response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');response.end(JSON.stringify(requests));return;}
  if(bundle&&path==='/loader1251-published.mjs'){response.setHeader('Content-Type','text/javascript');response.setHeader('Cache-Control','no-store');response.end(readFileSync(bundle));return;}
  if(path==='/packages/barocss-cad-interop/examples/multispan-trim-uv-three.html'){let html=readFileSync(resolve(examples,'multispan-trim-uv-three.html'),'utf8');if(bundle)html=html.replace('<html lang="en">','<html lang="en" data-loader1251-mode="compiled">').replace('./multispan-trim-uv-three.mjs','/loader1251-published.mjs');response.setHeader('Content-Type','text/html');response.setHeader('Cache-Control','no-store');response.end(html);return;}
  if(path.startsWith('/packages/barocss-cad-interop/examples/multispan-trim-uv-three-data/')){const file=basename(path);if(!names.has(file)){response.statusCode=404;response.end();return;}const bytes=readFileSync(resolve(directory,file));requests.push({sequence:requests.length+1,file,bytes:bytes.length,status:200});response.setHeader('Content-Type',file.endsWith('.css')?'text/plain; charset=utf-8':'application/json; charset=utf-8');response.setHeader('Content-Length',bytes.length);response.setHeader('Cache-Control','no-store');response.end(bytes);return;}
  next();
 });}
}]};
