import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {build} from 'esbuild';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../..');
export default defineConfig({root:here,plugins:[tailwindcss(),{name:'legacy-native-source-routes',configureServer(server){server.middlewares.use(async(req,res,next)=>{if(req.url==='/')req.url='/gallery.html';const folder=req.url==='/cad.js'?'barocss-cad':req.url==='/gpu.js'?'barocss-gpu':null;if(!folder){next();return;}try{const result=await build({absWorkingDir:repo,entryPoints:['packages/'+folder+'/src/index.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','no-store');res.end(result.outputFiles[0].contents);}catch{res.statusCode=500;res.end('Native source is unavailable');}});}}],resolve:{alias:{'@':path.resolve(here,'src')}},server:{host:'127.0.0.1',port:52002,strictPort:true,fs:{allow:[repo]}},build:{rollupOptions:{input:path.join(here,'workspace.html')},outDir:'editor-dist',emptyOutDir:true}});
