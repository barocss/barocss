import {readFileSync} from 'node:fs';
import {resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
const examples=fileURLToPath(new URL('.',import.meta.url)),repo=resolve(examples,'../../..');
const mode=process.env.BAROCSS_LOADER1238_MODE??'source',compiledDir=process.env.BAROCSS_LOADER1238_COMPILED_DIR;
if(!['source','compiled'].includes(mode))throw new Error('BAROCSS_LOADER1238_MODE must be source or compiled');
if(mode==='compiled'&&!compiledDir)throw new Error('BAROCSS_LOADER1238_COMPILED_DIR is required');
const names=new Set(["warped_four.full-original-request.json", "warped_four.owned-result.json", "warped_four.actual-world.source0.css", "warped_four.surface-uv.dimensionless-only.json", "warped_four.plane-uv.dimensionless-only.json", "nonuniform_u.full-original-request.json", "nonuniform_u.owned-result.json", "nonuniform_u.actual-world.source0.css", "nonuniform_u.surface-uv.dimensionless-only.json", "nonuniform_u.plane-uv.dimensionless-only.json", "warped_source.original.source0.css", "plane_source.original.source0.css", "shifted_source.original.source0.css", "shift_plane_source.original.source0.css"]),requests=[],aliases=[];
const exact=name=>new RegExp('^'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');
if(mode==='source')for(const packageName of ['barocss-cad','barocss-cad-interop']){
 const directory=resolve(repo,'packages',packageName),manifest=JSON.parse(readFileSync(resolve(directory,'package.json'),'utf8'));
 for(const [key,entry]of Object.entries(manifest.exports)){const target=typeof entry==='string'?entry:entry.import;if(typeof target==='string')aliases.push({find:exact(manifest.name+(key==='.'?'':key.slice(1))),replacement:resolve(directory,target)});}
}
for(const name of ['pixi.js','pixi3d/pixi7']){
 const directory=resolve(repo,'node_modules',name==='pixi.js'?'pixi.js':'pixi3d'),manifest=JSON.parse(readFileSync(resolve(directory,'package.json'),'utf8'));
 const target=name==='pixi.js'?manifest.module:manifest.exports['./pixi7'].import.default;
 aliases.push({find:exact(name),replacement:resolve(directory,target)});
}
export default{root:examples,resolve:{alias:aliases},server:{host:'127.0.0.1',port:5297,strictPort:true,fs:{allow:[repo]}},optimizeDeps:{entries:[resolve(examples,'multispan-section-pixi3d.html')],include:['pixi.js','pixi3d/pixi7'],noDiscovery:true},plugins:[{name:'original-multispan-files-and-mode',configureServer(server){server.middlewares.use((request,response,next)=>{
 const path=new URL(request.url,'http://localhost').pathname;let bytes,type;
 if(path==='/__loader1238_requests'){bytes=Buffer.from(JSON.stringify(requests));type='application/json; charset=utf-8';}
 else if(path==='/multispan-section-pixi3d.html'){
  let html=readFileSync(resolve(examples,'multispan-section-pixi3d.html'),'utf8');
  if(mode==='compiled')html=html.replace('./multispan-section-pixi3d.mjs','/browser.bundle.mjs');
  bytes=Buffer.from(html);type='text/html; charset=utf-8';
 }else if(mode==='compiled'&&path==='/browser.bundle.mjs'){bytes=readFileSync(resolve(compiledDir,'browser.bundle.mjs'));type='text/javascript; charset=utf-8';}
 else if(path.startsWith('/multispan-section-pixi3d-data/')){
  const file=decodeURIComponent(path.slice('/multispan-section-pixi3d-data/'.length));if(file!==basename(file)||!names.has(file)){response.statusCode=404;response.end();return;}
  bytes=readFileSync(resolve(examples,'multispan-section-pixi3d-data',file));type=file.endsWith('.css')?'text/plain; charset=utf-8':'application/json; charset=utf-8';requests.push({sequence:requests.length+1,file,bytes:bytes.length,status:200});
 }else return next();
 response.setHeader('Content-Type',type);response.setHeader('Content-Length',bytes.length);response.setHeader('Cache-Control','no-store');response.end(bytes);
});}}]};
