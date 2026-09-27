import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { capture, syntheticProvider } from './capture.mjs';
import { schedule, maximumMicroUsd, approvalCheck } from './plan.mjs';
import { directProvider } from './provider.mjs';
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(),'barocss-447-test-'));
async function run(options={}) { const dir=temp(); try { return await capture({outputDir:dir,provider:syntheticProvider(),synthetic:true,...options}); } finally { fs.rmSync(dir,{recursive:true,force:true}); } }
test('balanced phased schedule and full-context arithmetic',()=>{
  assert.equal(schedule('pilot-a').length,24); assert.equal(schedule('pilot-b').length,72); assert.equal(schedule('study').length,360);
  assert.equal(maximumMicroUsd('pilot-a'),27137280); assert.equal(maximumMicroUsd('pilot-b'),81411840);
  assert.equal(new Set(schedule('pilot-a').map(x=>x.session)).size,6);
});
test('valid stub preserves every raw assistant turn in complete request history',async()=>{
 const rows=await run(); assert.equal(rows.length,24); assert.ok(rows.every(r=>r.synthetic&&r.status==='valid'));
 for(const session of new Set(rows.map(r=>r.session))){ const group=rows.filter(r=>r.session===session); assert.deepEqual(group.map(r=>r.request.messages.length),[1,3,5,7]);
   for(let i=1;i<4;i++) for(let j=0;j<i;j++) assert.equal(group[i].request.messages[j*2+1].content,group[j].text);
 }
});
for(const [mode,status] of [['invalid-json','parse'],['schema','schema'],['truncated','truncated']]) test(`${mode} first response retained; later cells stay in denominator`,async()=>{
 const rows=await run({provider:syntheticProvider(mode)}); assert.equal(rows.filter(r=>r.status===status).length,6); assert.equal(rows.filter(r=>r.status==='blocked-prior-failure').length,18); assert.ok(rows.filter(r=>r.status===status).every(r=>typeof r.raw==='string'));
});
for(const [mode,status] of [['missing-usage','accounting'],['transport','transport']]) test(`${mode} stops entire run without retry`,async()=>{
 const rows=await run({provider:syntheticProvider(mode)}); assert.equal(rows[0].status,status); assert.equal(rows.slice(1).filter(r=>r.status==='blocked-budget-or-accounting').length,23);
});
test('exhausted aggregate budget blocks before dispatch',async()=>{
 let calls=0; const p=syntheticProvider(); const rows=await run({budgetMicroUsd:0,provider:{...p,generate:async()=>{calls++;}}}); assert.equal(calls,0); assert.equal(rows[0].status,'budget'); assert.equal(rows.length,24);
});
test('context overflow keeps full request and does not generate or truncate',async()=>{
 let calls=0; const rows=await run({provider:{count:async()=>32769,generate:async()=>{calls++;}}}); assert.equal(calls,0); assert.equal(rows.filter(r=>r.status==='context').length,6); assert.ok(rows[0].request.system.length>0);
});
test('unknown live readiness cannot initiate a provider call',()=>{ assert.throws(()=>approvalCheck({},'pilot-a',false),/blocked/); });
test('direct provider maps token caps, has no retry, and preserves failed body',async()=>{
 let calls=0; const p=directProvider('synthetic-placeholder',async(url,opts)=>{calls++;assert.equal(url,'https://api.anthropic.com/v1/messages');assert.equal(opts.redirect,'error');return{ok:false,status:429,text:async()=>'{"error":"synthetic"}'};});
 await assert.rejects(()=>p.generate({max_tokens:4096}),e=>e.raw==='{"error":"synthetic"}'); assert.equal(calls,1);
});
test('model drift retains reservation and blocks remaining calls',async()=>{
 const p=syntheticProvider();const rows=await run({provider:{...p,generate:async(...a)=>({...await p.generate(...a),responseModel:'unexpected-model'})}});assert.equal(rows[0].status,'accounting');assert.equal(rows[0].responseModel,'unexpected-model');assert.equal(rows.slice(1).every(r=>r.status==='blocked-budget-or-accounting'),true);
});
