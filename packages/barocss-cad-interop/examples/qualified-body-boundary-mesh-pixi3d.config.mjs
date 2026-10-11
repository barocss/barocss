import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const here=dirname(fileURLToPath(import.meta.url));
const managed=resolve(here,'../../..');
const data=resolve(here,'qualified-body-boundary-mesh-pixi3d-data');
const parent='515aabfe4b848f9eb6e9e45ba94b1e21724bfce7';
const mode=process.env.BAROCSS_QUALIFIED_PIXI3D_MODE??'source';
const output=process.env.BAROCSS_QUALIFIED_PIXI3D_OUTPUT;
if(!['source','emitted'].includes(mode))throw new Error('Use BAROCSS_QUALIFIED_PIXI3D_MODE source or emitted');
if(mode==='emitted'&&!output)throw new Error('Emitted mode requires BAROCSS_QUALIFIED_PIXI3D_OUTPUT');
const bundle=output?resolve(output,'browser.bundle.mjs'):null;
const names=['main.mesh-request.json','main.mesh-result.json','edited.mesh-request.json','edited.mesh-result.json','single.mesh-request.json','single.mesh-result.json'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const persist=(name,value)=>{if(output&&existsSync(output))writeFileSync(resolve(output,name),JSON.stringify(value,null,2)+'\n');};
const requests=[];

export default {
  root:managed,configFile:false,
  optimizeDeps:{noDiscovery:true,entries:mode==='source'?[resolve(here,'qualified-body-boundary-mesh-pixi3d.html')]:[],include:mode==='source'?['pixi.js','pixi3d/pixi7']:[]},
  server:{host:'127.0.0.1',port:5274,strictPort:true,hmr:false,fs:{allow:[managed,...(output?[output]:[])]}},
  plugins:[{
    name:'qualified-pixi1383-public',enforce:'pre',
    async resolveId(specifier,importer){
      if(mode==='source'&&importer?.startsWith(here)&&/^(?:@barocss\/(?:cad|cad-interop)(?:\/|$)|pixi\.js$|pixi3d\/pixi7$)/.test(specifier))return this.resolve(specifier,resolve(managed,'packages/barocss-cad-interop/package.json'),{skipSelf:true});
      if(mode==='emitted'&&specifier.includes('/packages/barocss-')&&specifier.includes('/src/'))throw new Error('Own source fallback is forbidden in emitted mode');
    },
    configureServer(server){
      const graph=()=>{
        const modules=[...server.moduleGraph.urlToModuleMap.values()].map(value=>({url:value.url,id:value.id,file:value.file,importers:[...value.importers].map(row=>row.url),imports:[...value.importedModules].map(row=>row.url),transformSha256:value.transformResult?.code?hash(value.transformResult.code):null}));
        const own=[...new Set(modules.map(value=>value.file).filter(Boolean))].filter(file=>/\/packages\/barocss-(?:cad|cad-interop)\/(?:src|dist)\//.test(file));
        return{mode,parent,modules,ownSourceFiles:own.filter(file=>file.includes('/src/')),ownDistFiles:own.filter(file=>file.includes('/dist/')),compiledBundle:mode==='emitted'?bundle:null};
      };
      server.middlewares.use(async(req,res,next)=>{
        const url=new URL(req.url,'http://127.0.0.1');
        if(url.pathname==='/qualified-body-boundary-mesh-pixi3d.html'){
          try{
            const original=readFileSync(resolve(here,'qualified-body-boundary-mesh-pixi3d.html'),'utf8');
            const entry=mode==='source'?'/@fs'+resolve(here,'qualified-body-boundary-mesh-pixi3d.mjs'):'/qualified-pixi1383-published.mjs';
            const html=original.replace('./qualified-body-boundary-mesh-pixi3d.mjs',entry).replace('data-qualified-pixi1383-mode="source"','data-qualified-pixi1383-mode="'+mode+'"');
            res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(await server.transformIndexHtml(url.pathname,html));
          }catch(error){next(error);}return;
        }
        if(url.pathname==='/qualified-pixi1383-published.mjs'){
          if(mode!=='emitted'){res.statusCode=404;res.end('Published browser mode required');return;}
          const bytes=readFileSync(bundle);res.setHeader('Content-Type','application/javascript; charset=utf-8');res.setHeader('Content-Length',String(bytes.length));res.setHeader('Cache-Control','no-store');res.end(bytes);return;
        }
        if(url.pathname==='/qualified-pixi1383-ready'){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({serverReady:true,mode,parent,entry:'/qualified-body-boundary-mesh-pixi3d.html'}));return;}
        if(url.pathname==='/qualified-pixi1383-ledger'){const value={requests};persist('server-ledger.json',value);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value));return;}
        if(url.pathname==='/qualified-pixi1383-graph'){const value=graph();persist('server-graph.json',value);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value));return;}
        if(!url.pathname.startsWith('/qualified-pixi1383-data/')){next();return;}
        const name=url.pathname.slice('/qualified-pixi1383-data/'.length),allowed=names.includes(name)&&['GET','HEAD'].includes(req.method);
        const row={index:requests.length+1,file:name,method:req.method,status:allowed?200:404,bytes:0,sha256:null,finished:false,closed:false};requests.push(row);
        const save=()=>persist('server-ledger.json',{requests});res.on('finish',()=>{row.finished=true;save();});res.on('close',()=>{row.closed=true;save();});res.statusCode=row.status;res.setHeader('Cache-Control','no-store');
        if(!allowed){res.end('Unknown original input');return;}
        const bytes=readFileSync(resolve(data,name));row.bytes=bytes.length;row.sha256=hash(bytes);row.contentType='application/json; charset=utf-8';row.contentLength=bytes.length;
        res.setHeader('Content-Type',row.contentType);res.setHeader('Content-Length',String(bytes.length));res.end(req.method==='HEAD'?undefined:bytes);
      });
      server.httpServer?.on('close',()=>{persist('server-ledger.json',{requests});persist('server-graph.json',graph());});
    },
  }],
};
