import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createWorkflowHost, BASELINE_ROOT } from './serve.mjs';
import { exerciseOrders, exerciseProjects } from './exercise.mjs';
import { recordCapture, verifyArtifacts } from './evidence.mjs';
import { digest } from '../store.mjs';
const hashes=(root)=>Object.fromEntries(fs.readdirSync(root,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>{const file=path.join(e.parentPath,e.name);return[path.relative(root,file),digest(fs.readFileSync(file))];}));
test('composite Orders and Projects perform relational operations, preserve state and retain actual immutable captures',async()=>{
  const baselineBefore=hashes(BASELINE_ROOT),baselineResponse=await(await fetch('http://127.0.0.1:5175/api/index')).json();assert.equal(baselineResponse.samples.length,13);
  const root=fs.mkdtempSync('/Users/user/.barocss-ai/v3/private-498-browser-');fs.chmodSync(root,0o700);
  const candidateSha=execFileSync('git',['-C',fileURLToPath(new URL('../../../',import.meta.url)),'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const browser=await createRequire(import.meta.url)('playwright-core').chromium.launch({headless:true});let app;
  try{
    app=await createWorkflowHost();assert.notEqual(app.url,'http://127.0.0.1:5175');
    for(const width of[1200,390]){
      const page=await browser.newPage({viewport:{width,height:900}}),errors=[],external=[];
      try{
        page.on('pageerror',error=>errors.push(error.message));
        await page.addInitScript(()=>{window.CSP_EVENTS=[];document.addEventListener('securitypolicyviolation',e=>window.CSP_EVENTS.push(e.violatedDirective));});
        await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==app.url){external.push('external');return route.abort();}return route.continue();});
        await page.goto(app.url);
        const capture=(name,trace)=>recordCapture({page,root,name:`${name}-${width}`,trace,candidateSha,browserVersion:browser.version(),errors,external});
        await exerciseOrders(page,capture);await exerciseProjects(page,capture);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        await assert.rejects(capture('orders-normal',[]),/Immutable/);
        await page.evaluate(()=>{window.foreignWorkflowRuntime=new BaroCSS.BrowserRuntime({nonce:document.querySelector('meta[name="barocss-nonce"]').content,constructable:false,styleId:'foreign-workflow'});});
        await page.evaluate(()=>window.WORKFLOW.dispose());assert.equal(await page.locator('[data-node-id]').count(),0);assert.equal(await page.evaluate(()=>window.foreignWorkflowRuntime.getStats().isDestroyed),false);
        await page.evaluate(()=>window.WORKFLOW.mount());await page.waitForFunction(()=>window.WORKFLOW.snapshot()?.context);assert.equal(await page.evaluate(()=>window.WORKFLOW.snapshot().state.view),'orders');
        await page.evaluate(()=>{window.WORKFLOW.dispose();window.foreignWorkflowRuntime.destroy();});
        assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(await page.evaluate(()=>window.CSP_EVENTS),[]);
      }finally{await page.close();}
    }
    const index=verifyArtifacts(root);assert.equal(index.captures.length,18);
    assert.equal((await fetch(app.url+'/etc/passwd')).status,404);assert.equal((await fetch(app.url+'/api/context',{method:'POST'})).status,403);
    assert.deepEqual(hashes(BASELINE_ROOT),baselineBefore);assert.equal((await(await fetch('http://127.0.0.1:5175/api/index')).json()).samples.length,13);
    if(process.env.WORKFLOW_RESULT_ROOT){fs.mkdirSync(process.env.WORKFLOW_RESULT_ROOT,{recursive:true,mode:0o700});const destination=path.join(process.env.WORKFLOW_RESULT_ROOT,path.basename(root));fs.cpSync(root,destination,{recursive:true,errorOnExist:true,force:false});fs.chmodSync(destination,0o700);assert.equal(verifyArtifacts(destination).captures.length,18);}
    const image=path.join(root,index.captures[0].name+'.png'),bytes=fs.readFileSync(image);fs.unlinkSync(image);assert.throws(()=>verifyArtifacts(root));fs.writeFileSync(image,bytes,{mode:0o600});assert.equal(verifyArtifacts(root).captures.length,18);fs.appendFileSync(image,'corrupt');assert.throws(()=>verifyArtifacts(root),/corrupt/);
  }finally{await browser.close();await app?.close();fs.rmSync(root,{recursive:true,force:true});}
});
