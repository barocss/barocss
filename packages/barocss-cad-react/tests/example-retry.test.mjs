/** Real ReactDOM/jsdom and actual App/Part/ModelHost. Only the Viewer sink and EnginePort are controlled. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('../',import.meta.url));
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
globalThis.window=dom.window;globalThis.document=dom.window.document;
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const{createRoot}=await import('react-dom/client');
const h=React.createElement;
const failure={title:'Worker stopped',hint:'Explicit retry is available.',detail:'Controlled settled Worker failure'};
const result=revision=>({ok:true,revision,wallTime:0,bodies:[{key:'b1',volume:1,mass:1,mesh:{positions:new Float64Array([0,0,0]),normals:new Float32Array([0,0,1]),indices:new Uint32Array(),bounds:{min:[0,0,0],max:[1,1,1]}}}]});
async function flush(){await new Promise(resolve=>setImmediate(resolve));}
async function fixture(t,{profile=false,restart=true,startupError=null}={}){
 const temp=await mkdtemp(join(tmpdir(),'cad-react-example-retry-'));t.after(()=>rm(temp,{recursive:true,force:true}));
 const outfile=join(temp,'app.mjs');
 await build({entryPoints:[join(root,profile?'examples/ProfileApp.tsx':'examples/App.tsx')],outfile,bundle:true,format:'esm',platform:'node',target:'es2022',logLevel:'silent',loader:{'.css':'empty'},plugins:[{
  name:'actual-example-controlled-viewer',setup(builder){
   builder.onResolve({filter:/^@barocss\/cad-model\/(.+)$/},args=>({path:resolve(root,'../barocss-cad-model/src',args.path.slice('@barocss/cad-model/'.length)+'.ts')}));
   builder.onResolve({filter:/^react(?:\/.*)?$/},args=>({path:require.resolve(args.path),external:true}));
   builder.onResolve({filter:/^\.\.\/src\/viewer\.js$/},()=>({path:'controlled-existing-viewer',namespace:'test'}));
   builder.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const ExistingViewerHost={create:canvas=>globalThis.__cadExampleRetrySink.create(canvas)};',loader:'js'}));
  }
 }]});
 const api=await import(pathToFileURL(outfile).href),App=profile?api.ProfileApp:api.App;
 const intervals=new Map();let nextInterval=1;const set=window.setInterval,clear=window.clearInterval;
 window.setInterval=fn=>{const id=nextInterval++;intervals.set(id,fn);return id;};window.clearInterval=id=>intervals.delete(id);
 const requests=[],failures=new Set(),hosts=[];let restarts=0,sinks=0,disposed=0,host=null,failed=false;
 const engine={evaluate(doc,revision){requests.push({doc,revision});return Promise.resolve(failed?null:result(revision));},restart(){throw new Error('Borrowed engine restart must be explicitly provided by its caller');},dispose(){},onFailure(fn){failures.add(fn);return()=>failures.delete(fn);},onMasses(){return()=>{};}};
 globalThis.__cadExampleRetrySink={create:async()=>{sinks++;if(startupError)throw startupError;return{show:async()=>{},snapshot:()=>({}),dispose(){disposed++;}};}};
 const onHost=value=>{host=value;hosts.push(value);},onRestart=()=>{restarts++;if(restart instanceof Error)throw restart;if(restart)failed=false;return restart;};
 const container=document.createElement('div');document.body.append(container);const reactRoot=createRoot(container);
 t.after(async()=>{await React.act(async()=>reactRoot.unmount());container.remove();window.setInterval=set;window.clearInterval=clear;delete globalThis.__cadExampleRetrySink;});
 const poll=()=>{for(const fn of intervals.values())fn();};
 await React.act(async()=>{reactRoot.render(h(App,{engine,massPolicy:{merge:b=>b},onHost,...(restart===null?{}:{onRestart})}));for(let i=0;i<8;i++)await flush();poll();});
 if(!startupError)assert.equal(host?.read().status,'ready');
 return{container,requests,hosts,get host(){return host;},get restarts(){return restarts;},get sinks(){return sinks;},get disposed(){return disposed;},
  repair(){failed=false;},
  async fail(){await React.act(async()=>{failed=true;for(const fn of failures)fn(failure);poll();});},
  async value(value){await React.act(async()=>{const input=container.querySelector('input[type="number"]');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new window.Event('input',{bubbles:true}));for(let i=0;i<8;i++)await flush();poll();});await React.act(async()=>{await flush();poll();});},
  async retry(){const button=[...container.querySelectorAll('button')].find(b=>b.textContent==='Retry');assert.ok(button,'actual ExampleShell Retry control must be visible');await React.act(async()=>{button.click();for(let i=0;i<8;i++)await flush();poll();});await React.act(async()=>{await flush();poll();});},
 };
}
for(const profile of [false,true])for(const nondefault of [false,true]){
 test(`${profile?'Profile':'Bracket'} explicit Retry preserves ${nondefault?'nondefault':'unchanged default'} props, Part IDs and host`,async t=>{
  const f=await fixture(t,{profile});const expected=profile?(nondefault?8:6):(nondefault?100:80);
  if(nondefault)await f.value(expected);
  const input=f.container.querySelector('input[type="number"]');assert.equal(input.value,String(expected));
  const host=f.host,before=host.read(),requests=f.requests.length;
  await f.fail();assert.equal(host.read().status,'failed');assert.equal(f.restarts,0);
  assert.equal(f.container.querySelector('[aria-label="Model status"]').textContent,'Error');
  assert.match(f.container.querySelector('[role="alert"]')?.textContent??'',/Controlled settled Worker failure/);
  await f.retry();assert.equal(f.restarts,1);assert.equal(f.host,host);assert.equal(f.sinks,1);assert.equal(f.disposed,0);
  assert.equal(f.requests.length,requests+1);assert.equal(host.read().status,'ready');assert.equal(input.value,String(expected));
  assert.equal(f.container.querySelector('[aria-label="Model status"]').textContent,'Ready');assert.equal(f.container.querySelector('[role="alert"]'),null);
  assert.equal(host.read().documentJSON,before.documentJSON);assert.equal(host.read().fingerprint,before.fingerprint);
  assert.deepEqual(f.requests.at(-1).doc.nodes.map(node=>node.id),JSON.parse(before.documentJSON).nodes.map(node=>node.id));
  assert.equal(f.hosts.length,1,'Retry must not remount or reconnect the existing host');
 });
}
for(const restart of [false,new Error('Controlled restart exception')]){
 test(`explicit Retry ${restart===false?'refusal':'exception'} preserves failed state without a new submit or Reset`,async t=>{
  const f=await fixture(t,{restart});await f.value(100);const before=f.host.read().documentJSON,count=f.requests.length;
  await f.fail();await f.retry();assert.equal(f.restarts,1);assert.equal(f.host.read().status,'failed');
  assert.equal(f.requests.length,count);assert.equal(f.host.read().documentJSON,before);assert.equal(f.container.querySelector('input').value,'100');
  assert.match(f.container.querySelector('[role="alert"]').textContent,restart===false?/Worker restart failed/:/Controlled restart exception/);
  assert.equal(f.container.querySelector('[aria-label="Model status"]').textContent,'Error');assert.equal(f.sinks,1);
 });
}
test('a borrowed generic engine without a caller restart callback remains failed and exposes no Retry',async t=>{
 const f=await fixture(t,{restart:null});await f.fail();assert.equal(f.host.read().status,'failed');
 assert.ok(![...f.container.querySelectorAll('button')].some(button=>button.textContent==='Retry'));assert.equal(f.restarts,0);assert.equal(f.requests.length,1);
});

test('Viewer startup failure keeps its diagnostic and never offers Worker Retry without a connected host',async t=>{
 const f=await fixture(t,{startupError:new Error('Controlled Viewer startup failure')});
 assert.equal(f.host,null);assert.equal(f.requests.length,0);assert.equal(f.restarts,0);
 assert.match(f.container.querySelector('[role="alert"]').textContent,/Controlled Viewer startup failure/);
 assert.equal(f.container.querySelector('[aria-label="Model status"]').textContent,'Error');
 assert.ok(![...f.container.querySelectorAll('button')].some(button=>button.textContent==='Retry'));
});

test('Inspector restart failure clears after a later caller repair and current parameter edit succeeds',async t=>{
 const f=await fixture(t,{restart:false});await f.value(100);const host=f.host,count=f.requests.length;
 await f.fail();await f.retry();assert.match(f.container.querySelector('[role="alert"]').textContent,/Worker restart failed/);
 assert.equal(f.requests.length,count);f.repair();await f.value(80);
 assert.equal(f.host,host);assert.equal(f.requests.length,count+1);assert.equal(host.read().status,'ready');
 assert.equal(f.container.querySelector('[aria-label="Model status"]').textContent,'Ready');assert.equal(f.container.querySelector('[role="alert"]'),null);
});
