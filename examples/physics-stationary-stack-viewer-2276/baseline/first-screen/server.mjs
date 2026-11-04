import {createServer} from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {model,options} from '../../physics-stack-stationary-world-2276/model.mjs';
const scene=dirname(fileURLToPath(import.meta.url)),root=resolve(scene,'../../..');
const files=new Map();
for(const name of ['index.html','style.css','app.mjs','renderer.mjs'])files.set(name==='index.html'?'/':'/'+name,[name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript',await readFile(join(scene,name))]);
async function load(directory,prefix){for(const item of await readdir(directory,{withFileTypes:true})){if(item.isDirectory())await load(join(directory,item.name),prefix+item.name+'/');else if(/\.(js|mjs)$/.test(item.name))files.set(prefix+item.name,['text/javascript',await readFile(join(directory,item.name))]);}}
await load(join(root,'packages/barocss-physics/dist'),'/physics/');
files.set('/models',['application/json',Buffer.from(JSON.stringify({options,models:Object.fromEntries(['ALIGNED','OFFSET','YAW'].map(name=>[name,model(name)]))}))]);
files.set('/favicon.ico',['image/x-icon',Buffer.alloc(0)]);
const port=53043;
const server=createServer((request,response)=>{const entry=files.get(new URL(request.url,'http://127.0.0.1').pathname);if(request.method!=='GET'||!entry){response.writeHead(404).end();return;}
 response.writeHead(200,{'content-type':entry[0],'cache-control':'no-store','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'"}).end(entry[1]);});
await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok);});console.log('http://127.0.0.1:'+port);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>process.exit(0)));
