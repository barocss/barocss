// D341: root must freeze all source writers before generation or browser execution.
// D341_SOURCE_FROZEN=1 PW_DIR=/absolute/playwright CHROME=/absolute/chrome \
//   node test/trimmed-surface-region-browser.mjs /absolute/artifacts
// One Chrome WebGPU process; serial contexts. Public UI mutates; hooks only observe.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';
import {createServer} from 'vite';
assert.equal(process.env.D341_SOURCE_FROZEN,'1','Root must freeze all writers before D341 execution');
assert.ok(process.env.PW_DIR&&process.env.CHROME&&process.argv[2],'PW_DIR, CHROME and artifact directory required');
const app=resolve(import.meta.dirname,'..'),repo=resolve(app,'../..'),output=resolve(process.argv[2]);await mkdir(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={status:'RUNNING',qualification:'NUMERIC_AND_UI_FLOW_ONLY',visualReview:'ROOT_MUST_VIEW_SCREENSHOTS',profiles:[],states:[],material:[],refusals:[],errors:[],consoleErrors:[],changes:[],downloads:[],files:[],cleanup:[],
 limits:['Surface material area and centroid are distinct from closed-solid mass.',
 'Independent rectangle oracle uses actual original stored160 UV, represented crop bounds and perpendicular-boundary switch levels; ideal guides are not substituted.',
 'Child evaluator comparisons are local trim-vertex observations only. Whole-child coefficient/Jacobian certificates require separate native tests.',
 'Numeric/UI success does not prove visual quality. Root must inspect screenshots for missing regions or overlap.',
 'One original affine support and one stored simple loop only; no repeated-operation or generic curved trim acceptance.']};
let phase='public seed preparation',server,browser,context,page,inspectorBundle;
const persist=()=>writeFile(join(output,'receipt.json'),JSON.stringify({...report,phase},null,2));
const fixtureCSS=`@model d341 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[1,1,7,7]; control-points:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]]; weights:[[1,1],[1,1]]; }
 @curve #u-loop { type:nurbs; degree:1; knots:[0,0,1,2,3,4,5,6,7,8,8]; control-points:[[15,-1,3],[35,-1,3],[35,15,3],[29,15,3],[29,5,3],[21,5,3],[21,15,3],[15,15,3],[15,-1,3]]; weights:[1,1,1,1,1,1,1,1,1]; }
}`;
const generator=`import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
import {emptyDirect,importSource} from '../../packages/barocss-cad-model/src/engine/direct.ts';
const witness=part('D341 witness').box({w:12,d:7,h:5,x:80,y:-3,z:1});
const direct=importSource(emptyDirect(),${JSON.stringify(fixtureCSS)},'D341');assert.ok(direct.objects.every(o=>!o.trims));
writeFileSync(process.argv[2],JSON.stringify({...witness.doc,direct},null,2));`;
const inspector=`import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
import {compileCadModel,surfaceEvaluator} from '../../packages/barocss-cad/src/index.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),p=part('D341 witness read',doc);
assert.equal(p.bodies().length,1);const key=p.bodies()[0],mass=p.body(key).mass({density:1});
const objects=doc.direct.objects.filter(o=>o.trims?.length&&!o.hidden).map(o=>{
 const compiled=compileCadModel(doc.direct.sources[o.source],{sourceVersion:0});assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));
 const surface=compiled.model.objects.find(s=>s.id===o.geometry);assert.equal(surface?.kind,'surface');
 const evaluate=surfaceEvaluator(surface),domain={u:[surface.knotsU[surface.degreeU],surface.knotsU[surface.knotsU.length-surface.degreeU-1]],v:[surface.knotsV[surface.degreeV],surface.knotsV[surface.knotsV.length-surface.degreeV-1]]};
 const observations=o.trims.flatMap(loop=>loop.uv.map(([u,v])=>({uv:[u,v],actualWorld:evaluate(u,v),authorityWorld:[20+5*u,-11+5*v,3]})));
 return {...o,domain,surface,observations};
});console.log(JSON.stringify({witness:{key,mass,names:p.body(key).select().faces().names().sort()},objects}));`;
const independentVerifier="\"\"\"Independent exact rectangle slab oracle and stored-output Green verifier.\nNo CAD, clipping, arrangement, or production rational imports.\n\"\"\"\nimport json,sys\nfrom fractions import Fraction as F\n\ndef q(v):return F.from_float(v) if isinstance(v,float) else F(v)\ndef encoded(x):return {'numerator':str(x.numerator),'denominator':str(x.denominator),'value':float(x)}\ndef rectangle_components(poly,domain,crop,keep):\n # Sweep v. Perpendicular u boundary switch levels make clamped endpoints fixed per slab.\n pts=[(p[1],p[0]) for p in poly];td=crop['v'];od=crop['u'];levels=set([*td,*(p[0] for p in pts)])\n for a,b in zip(pts,pts[1:]+pts[:1]):\n  if a[0]==b[0] or a[1]==b[1]:continue\n  for boundary in od:\n   t=a[0]+(boundary-a[1])*(b[0]-a[0])/(b[1]-a[1])\n   if min(a[0],b[0])<=t<=max(a[0],b[0]):levels.add(t)\n levels=sorted(t for t in levels if td[0]<=t<=td[1]);nodes=[];parents=[];previous=[]\n def root(i):\n  while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]\n  return i\n def value(line,t):return line[0]*t+line[1]\n def integral(a,b,cs):return sum(c*(b**(i+1)-a**(i+1))/F(i+1) for i,c in enumerate(cs))\n for lo,hi in zip(levels,levels[1:]):\n  if lo==hi:continue\n  mid=(lo+hi)/2;cross=[]\n  for a,b in zip(pts,pts[1:]+pts[:1]):\n   if min(a[0],b[0])<mid<max(a[0],b[0]):\n    m=(b[1]-a[1])/(b[0]-a[0]);cross.append((m,a[1]-m*a[0]))\n  cross.sort(key=lambda line:value(line,mid));assert len(cross)%2==0\n  ins=list(zip(cross[::2],cross[1::2]))\n  if keep=='inside':intervals=ins\n  else:\n   intervals=[];left=(F(0),domain['u'][0])\n   for a,b in ins:intervals.append((left,a));left=b\n   intervals.append((left,(F(0),domain['u'][1])))\n  current=[]\n  for left,right in intervals:\n   left=max([left,(F(0),od[0])],key=lambda line:value(line,mid));right=min([right,(F(0),od[1])],key=lambda line:value(line,mid))\n   if value(right,mid)<=value(left,mid):continue\n   da,db=right[0]-left[0],right[1]-left[1]\n   area=integral(lo,hi,[db,da]);mv=integral(lo,hi,[F(0),db,da])\n   mu=integral(lo,hi,[(right[1]**2-left[1]**2)/2,right[0]*right[1]-left[0]*left[1],(right[0]**2-left[0]**2)/2])\n   i=len(nodes);nodes.append((area,mu,mv));parents.append(i)\n   for j,ol,orr,oh in previous:\n    if oh==lo and min(value(right,lo),value(orr,lo))-max(value(left,lo),value(ol,lo))>0:parents[root(i)]=root(j)\n   current.append((i,left,right,hi))\n  previous=current\n sums={}\n for i,node in enumerate(nodes):\n  r=root(i);sums[r]=tuple(x+y for x,y in zip(sums.get(r,(F(0),F(0),F(0))),node))\n return [{'area':25*a,'centroid':[20+5*mu/a,-11+5*mv/a,F(3)]} for a,mu,mv in sums.values()],len(levels)\ndef ring_moments(uv):\n p=[tuple(map(q,v)) for v in uv];a=mx=my=F(0)\n for (x,y),(xx,yy) in zip(p,p[1:]+p[:1]):\n  cross=x*yy-xx*y;a+=cross;mx+=(x+xx)*cross;my+=(y+yy)*cross\n assert a!=0,'No zero-area output ring'\n return abs(a)/2,mx/(3*a),my/(3*a)\ndef inside(uv,point):\n x,y=map(q,point);p=[tuple(map(q,v)) for v in uv];hit=False\n for (a,b),(c,d) in zip(p,p[1:]+p[:1]):\n  if (b>y)!=(d>y) and x<a+(y-b)*(c-a)/(d-b):hit=not hit\n return hit\ndef kept(loops,point):return all(inside(loop['uv'],point)==(loop['keep']=='inside') for loop in loops)\nif __name__=='__main__':\n data=json.load(sys.stdin);poly=[tuple(map(q,p)) for p in data['uv']];domain={k:list(map(q,v)) for k,v in data['domain'].items()};crop={k:list(map(q,v)) for k,v in data['crop'].items()}\n expected,slabLevels=rectangle_components(poly,domain,crop,data['keep']);actual=[];tol=q(1e-7)\n for child in data['children']:\n  loops=child['trims'];assert loops and loops[0]['keep']=='inside';assert all(l['keep']=='outside' for l in loops[1:])\n  area=mu=mv=F(0)\n  for i,loop in enumerate(loops):\n   a,u,v=ring_moments(loop['uv']);sign=1 if i==0 else -1;area+=sign*a;mu+=sign*a*u;mv+=sign*a*v\n  assert area>0,'Every emitted component has positive material'\n  actual.append({'id':child['id'],'area':25*area,'centroid':[20+5*mu/area,-11+5*mv/area,F(3)]})\n assert len(expected)==len(actual),('component count',len(expected),len(actual))\n for a,b in zip(sorted(actual,key=lambda x:tuple(x['centroid'])),sorted(expected,key=lambda x:tuple(x['centroid']))):\n  assert abs(a['area']-b['area'])<=tol,('area',float(a['area']),float(b['area']))\n  assert all(abs(x-y)<=tol for x,y in zip(a['centroid'],b['centroid'])),('centroid',a['id'])\n probes=[]\n for x,y in [[18,11.25],[32,11.25],[25,6.25],[25,11.25],[25,3],[13,-3],[44,19],[23,9],[18.5,10.75],[31.5,10.75],[42,2],[18,10],[25,10]]:\n  uv=[(q(x)-20)/5,(q(y)+11)/5];inCrop=all(crop[k][0]<uv[i]<crop[k][1] for i,k in enumerate(['u','v']));expect=inCrop and (inside(data['uv'],uv)==(data['keep']=='inside'))\n  owners=[c['id'] for c in data['children'] if kept(c['trims'],uv)]\n  assert len(owners)<=1,('Overlapping components',x,y,owners)\n  assert bool(owners)==expect,('Lost material or bridge/crop leakage',x,y,owners,expect)\n  probes.append({'world':[x,y,3],'inCrop':inCrop,'expectedMaterial':expect,'owners':owners})\n def item(a):return {**({'id':a['id']} if 'id' in a else {}),'areaWorld':encoded(a['area']),'centroidWorld':[encoded(x) for x in a['centroid']]}\n print(json.dumps({'status':'PASS','expectedExactRectangleComponents':[item(a) for a in expected],'actualStoredComponents':[item(a) for a in actual],'slabLevelsIncludingPerpendicularBoundarySwitches':slabLevels,'probes':probes,'tolerance':1e-7,'scope':'Independent exact Fraction rectangle sweep and stored Green moments/ray parity; no CAD or production predicates'},indent=2))\n";
const doc = () => page.evaluate(()=>window.__studioDoc);
const panel = () => page.getByRole('complementary',{name:'Direct geometry',exact:true});
const byId = (state,id) => state.direct.objects.find(o=>o.id===id);
function close(actual,expected,label) { assert.ok(Math.abs(actual-expected)<=1e-7,`${label}: ${actual} vs ${expected}`); }
async function ready(expectedCount=null) {
 await page.waitForFunction(count=>{const s=window.__studioBodies?.();return window.__studioFresh===true&&s?.fresh&&s.massReady&&(count===null||s.bodies.length===count);},expectedCount,{timeout:60000});
}
async function same(expected) {
 await page.waitForFunction(value=>JSON.stringify(window.__studioDoc)===value,JSON.stringify(expected),{timeout:60000});
 await ready(); assert.deepEqual(await doc(),expected);
}
async function changed(before) {
 await page.waitForFunction(value=>JSON.stringify(window.__studioDoc)!==value,JSON.stringify(before),{timeout:60000}); await ready();
}
async function snapshot(label) {
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const state=await page.evaluate(label=>({label,doc:window.__studioDoc,bodies:window.__studioBodies?.(),shown:window.__studioSection?.(),selection:window.__studioSelection,
  directSelection:[...document.querySelectorAll('.ol.direct.sel')].map(x=>x.textContent),hud:document.querySelector('.hud')?.textContent??null,hudStatus:document.querySelector('.hud .status')?.textContent??null,
  editor:document.querySelector('.node-editor')?.textContent??null,feedback:[...document.querySelectorAll('.toast')].map(x=>x.textContent)}),label);
 report.states.push(state); await writeFile(join(output,`${label}.json`),JSON.stringify(state,null,2));
 await writeFile(join(output,`${label}.html`),await page.content()); await page.screenshot({path:join(output,`${label}.png`),fullPage:true}); await persist(); return state;
}
async function freshPage() {
 if(context) {await context.close(); report.cleanup.push('CONTEXT_CLOSED');}
 context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1}); page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.stack??String(e)));
 page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 page.on('download',d=>report.downloads.push({phase,suggestedFilename:d.suggestedFilename()})); page.on('dialog',d=>d.accept());
 await page.goto(server.resolvedUrls.local[0]); await page.waitForSelector('.viewport[data-renderer="webgpu"]',{timeout:30000}); await ready();
}
async function freshOpen(saved,label) {
 phase=`fresh Open ${label}`; await freshPage(); await page.setInputFiles('input[aria-label="Model file"]',saved.file); await same(saved.doc); return snapshot(label);
}
async function select(id,shift=false) {
 const object=byId(await doc(),id); assert.ok(object&&!object.hidden);
 const escaped=object.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const row=page.locator('.ol.direct').filter({hasText:new RegExp(`${escaped}$`)}); assert.equal(await row.count(),1);
 await row.click({modifiers:shift?['Shift']:[]}); await panel().waitFor();
}
async function save(label) {
 phase=`native Save ${label}`; await ready(); const before=await doc();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save',exact:true}).click()]);
 const file=join(output,`${label}.bcad`); await download.saveAs(file); const bytes=await readFile(file); assert.deepEqual(JSON.parse(bytes),before);
 report.files.push({file,sha256:hash(bytes),semanticEquality:true,byteIdentityClaim:false}); return {file,doc:before};
}
async function undo(expected,label) {phase=label; await page.keyboard.press('Meta+z'); await same(expected); return snapshot(label);}
async function redo(expected,label) {phase=label; await page.keyboard.press('Meta+Shift+z'); await same(expected); return snapshot(label);}
async function dismissNotice(){const toast=page.locator('.toast[role="alert"]');if(await toast.count())await toast.getByRole('button',{name:'Dismiss',exact:true}).click();await toast.waitFor({state:'hidden'});}
async function trim(keep,label){
 phase=`actual Trim ${keep}`;await select('obj_1');await select('obj_2',true);await panel().getByLabel('Trim keeps',{exact:true}).selectOption(keep);
 const before=await doc();await panel().getByRole('button',{name:'Trim by the curve',exact:true}).click();await changed(before);const state=await doc();
 assert.equal(byId(state,'obj_1').trims.length,1);assert.equal(byId(state,'obj_1').trims[0].uv.length,160);assert.equal(byId(state,'obj_1').trims[0].keep,keep);assert.deepEqual(state.nodes,before.nodes);await snapshot(label);return state;
}
const crops={insideTwo:{u:[-.8,2.8],v:[3.7,5]},outsidePocket:{u:[-1.6,5],v:[1.4,3.7]},outsideHole:{u:[-1.6,5],v:[1.4,6.2]},retainedRectangle:{u:[.4,1.6],v:[3.8,4.6]}};
async function setCrop(crop){for(const[label,value]of [['u from',crop.u[0]],['u to',crop.u[1]],['v from',crop.v[0]],['v to',crop.v[1]]])await panel().getByLabel(label,{exact:true}).fill(String(value));}
async function region(trimmed,crop,label){
 phase=`actual Extract region ${label}`;await select('obj_1');await setCrop(crop);await panel().getByRole('button',{name:'Extract region',exact:true}).click();await changed(trimmed);
 const state=await doc(),added=state.direct.objects.filter(o=>!trimmed.direct.objects.some(old=>old.id===o.id));
 assert.deepEqual(byId(state,'obj_1'),{...byId(trimmed,'obj_1'),hidden:true},'Hidden original retains exact trims/source/name');assert.deepEqual(state.nodes,trimmed.nodes);
 assert.ok(added.length>0&&added.every(o=>!o.hidden&&o.trims?.length>0),'Every accepted component keeps an explicit mask');
 for(const object of trimmed.direct.objects.filter(o=>o.id!=='obj_1'))assert.deepEqual(byId(state,object.id),object,'Unrelated object unchanged');
 await snapshot(label);return {state,added};
}
async function rendererMaterialProbes(label,crop,verified){
 phase=`renderer material probes ${label}`;
 const profile=Object.keys(crops).find(key=>JSON.stringify(crops[key])===JSON.stringify(crop));
 const checks={insideTwo:[[[18.5,10.75,3],true],[[31.5,10.75,3],true]],
  outsidePocket:[[[42,2,3],true],[[25,6.25,3],true]],
  outsideHole:[[[42,2,3],true],[[18,10,3],false]],retainedRectangle:[[[25,10,3],true]]}[profile];
 assert.ok(checks,`Renderer probes specified for ${label}`);
 for(const[point,positive]of checks){
  const independent=verified.probes.find(probe=>probe.world.every((v,i)=>v===point[i]));assert.ok(independent,'Independent stored-mask classification exists for renderer probe');
  assert.equal(independent.expectedMaterial,positive,'Probe agrees with independently classified cropped original material');assert.equal(independent.owners.length,positive?1:0,'Positive probe belongs to exactly one actual stored result mask');
  const expected=independent.owners[0]??null,record={label,profile,point,positive,expected,independentMaskOwners:independent.owners,
   route:'Existing read-only __studioDirectAt renderer draw/pick path; sampled points only, not full coverage or certified mesh'};
  report.rendererMaterialProbes??=[];report.rendererMaterialProbes.push(record);
  try{await page.waitForFunction(({point,expected})=>typeof window.__studioDirectAt==='function'&&window.__studioDirectAt(point)===expected,{point,expected},{timeout:30000});}
  finally{const observed=await page.evaluate(point=>({available:typeof window.__studioDirectAt==='function',actual:window.__studioDirectAt?.(point)??null}),point);record.hookAvailable=observed.available;record.actual=observed.actual;record.pass=record.hookAvailable&&record.actual===expected;await persist();}
  assert.equal(record.actual,expected,`Actual renderer material pick ${label} at ${point}`);
 }
}
async function material(trimmed,result,crop,label,count,holes=null){
 const file=join(output,`${label}-native-read.bcad`);await writeFile(file,JSON.stringify(result.state));
 const run=spawnSync(process.execPath,[inspectorBundle,file],{encoding:'utf8',maxBuffer:16*1024*1024});await writeFile(join(output,`${label}-native.stderr.txt`),run.stderr??'');assert.equal(run.status,0,run.stderr);
 const observed=JSON.parse(run.stdout),w=observed.witness;close(w.mass.volume,420,'Witness volume');w.mass.centroid.forEach((v,i)=>close(v,[86,.5,3.5][i],'Witness centroid'));report.witness??={key:w.key,names:w.names};assert.deepEqual({key:w.key,names:w.names},report.witness);
 const children=result.added.map(o=>{const actual=observed.objects.find(x=>x.id===o.id);assert.ok(actual);return actual;});assert.equal(children.length,count);
 assert.equal(new Set(children.map(c=>c.source)).size,1,'All components share native region source');assert.equal(new Set(children.map(c=>c.geometry)).size,1,'All components reference the one final native region support');
 if(holes!==null)assert.deepEqual(children.map(c=>c.trims.length-1),holes,'Component holes use outside masks after their inside outer');
 let maxVertexError=0,vertices=0;
 for(const child of children){
  for(const axis of ['u','v'])child.domain[axis].forEach((v,i)=>close(v,crop[axis][i],`Native cropped ${axis} bound`));
  assert.match(child.name,/ · region [0-9]+$/);
  for(const sample of child.observations){vertices++;for(let i=0;i<3;i++){const e=Math.abs(sample.actualWorld[i]-sample.authorityWorld[i]);maxVertexError=Math.max(maxVertexError,e);assert.ok(e<=1e-7,'Actual final support / original authority at stored trim vertices');}}
 }
 const original=byId(trimmed,'obj_1').trims[0],input={uv:original.uv,domain:{u:[-2,6],v:[1,7]},crop,keep:original.keep,children:children.map(c=>({id:c.id,trims:c.trims}))};
 await writeFile(join(output,`${label}-oracle-input.json`),JSON.stringify(input,null,2));const oracle=spawnSync('python3',[join(output,'rectangle-verifier.py')],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:16*1024*1024});
 await writeFile(join(output,`${label}-oracle.stdout.json`),oracle.stdout??'');await writeFile(join(output,`${label}-oracle.stderr.txt`),oracle.stderr??'');assert.equal(oracle.status,0,oracle.stderr);
 const verified=JSON.parse(oracle.stdout),evidence={label,crop,count,verified,localNativeObservations:{vertices,maxCoordinateError:maxVertexError,tolerance:1e-7,scope:'Local stored trim-vertex observations; not whole-support coefficient or regularity proof'},children:children.map(c=>({id:c.id,name:c.name,source:c.source,geometry:c.geometry,domain:c.domain,trims:c.trims}))};
 report.material.push(evidence);await writeFile(join(output,`${label}-material.json`),JSON.stringify(evidence,null,2));await persist();
 await rendererMaterialProbes(label,crop,verified);return evidence;
}
async function emptyOracle(trimmed,crop,label){
 const original=byId(trimmed,'obj_1').trims[0],input={uv:original.uv,domain:{u:[-2,6],v:[1,7]},crop,keep:original.keep,children:[]};
 await writeFile(join(output,`${label}-oracle-input.json`),JSON.stringify(input,null,2));const run=spawnSync('python3',[join(output,'rectangle-verifier.py')],{input:JSON.stringify(input),encoding:'utf8'});
 await writeFile(join(output,`${label}-oracle.stdout.json`),run.stdout??'');await writeFile(join(output,`${label}-oracle.stderr.txt`),run.stderr??'');assert.equal(run.status,0,run.stderr);const result=JSON.parse(run.stdout);assert.deepEqual(result.expectedExactRectangleComponents,[]);report.material.push({label,crop,empty:true,verified:result});
}
async function refuse(label,action,pattern){
 phase=`refusal ${label}`;await dismissNotice();const before=await doc(),selection=await page.locator('.ol.direct.sel').allTextContents(),downloads=report.downloads.length;
 await action();await page.locator('.toast[role="alert"]').waitFor();const notice=await page.locator('.toast[role="alert"]').textContent();assert.match(notice,pattern);await same(before);
 assert.deepEqual(await page.locator('.ol.direct.sel').allTextContents(),selection);assert.equal(report.downloads.length,downloads);
 report.refusals.push({label,notice,documentUnchanged:true,selectionUnchanged:true,noDownload:true});await snapshot(`guard-${label}`);
}
const inputs=['apps/cad-studio/test/trimmed-surface-region-browser.mjs','apps/cad-studio/src/App.tsx','apps/cad-studio/src/ui/DirectPanel.tsx','apps/cad-studio/src/ui/DirectInspector.tsx','apps/cad-studio/vite.config.ts',
 'packages/barocss-cad-model/src/engine/direct.ts','packages/barocss-cad-model/src/engine/trim.ts','packages/barocss-cad/src/index.ts','packages/barocss-cad/src/nurbs/surfaces/trimmed-surface-region.ts',
 'packages/barocss-cad/src/nurbs/surfaces/trimmed-surface-parameter-split.ts','packages/barocss-cad/src/nurbs/surfaces/trimmed-surface-split-binding.ts','packages/barocss-cad/src/nurbs/surfaces/trimmed-surface-split-topology.ts','packages/barocss-cad/src/nurbs/surfaces/trimmed-surface-split-common.ts',
 'packages/barocss-cad/src/nurbs/surfaces/surface-region.ts','packages/barocss-cad/src/brep/planar-arrangement.ts','packages/barocss-cad/dist/index.js'];
async function capsule(label,files){const names=[...new Set(files.map(file=>relative(repo,resolve(repo,file))))].sort();assert.ok(names.length<=4096);const hashes={};for(const file of names)hashes[file]=hash(await readFile(resolve(repo,file)));await writeFile(join(output,`source-${label}.json`),JSON.stringify({count:names.length,hashes},null,2));return hashes;}
let frozenFiles=inputs;
try{
 report.sourceBefore=await capsule('before-generation',inputs);report.sourceBeforeCount=Object.keys(report.sourceBefore).length;
 const planBytes=await readFile('/tmp/d341-plan/plan.md');await writeFile(join(output,'plan.md'),planBytes);report.independentSources=[{name:'plan.md',sha256:hash(planBytes)}];
 await writeFile(join(output,'rectangle-verifier.py'),independentVerifier);report.independentSources.push({name:'rectangle-verifier.py',sha256:hash(independentVerifier)});
 const buildInputs=[];async function compile(label,contents){const sourcefile=`d341-${label}.ts`,virtual=resolve(app,sourcefile);const built=await build({stdin:{contents,resolveDir:app,sourcefile,loader:'ts'},bundle:true,platform:'node',format:'esm',target:'node22',write:false,metafile:true});
  await writeFile(join(output,`${label}.ts`),contents);await writeFile(join(output,`${label}-metafile.json`),JSON.stringify(built.metafile,null,2));
  // Virtual stdin is excluded from disk capsules; its exact saved contents and hash remain evidence.
  buildInputs.push(...Object.keys(built.metafile.inputs).map(file=>resolve(file)).filter(file=>file!==virtual));const file=join(output,`${label}.mjs`);await writeFile(file,built.outputFiles[0].contents);report.generatorSources??=[];report.generatorSources.push({label,sha256:hash(contents),virtualInputExcluded:virtual});return file;}
 const seedBundle=await compile('seed-generator',generator);inspectorBundle=await compile('native-inspector',inspector);const seedFile=join(output,'seed.bcad');
 const run=spawnSync(process.execPath,[seedBundle,seedFile],{encoding:'utf8'});await writeFile(join(output,'seed.stdout.txt'),run.stdout??'');await writeFile(join(output,'seed.stderr.txt'),run.stderr??'');assert.equal(run.status,0,run.stderr);
 const seed={file:seedFile,doc:JSON.parse(await readFile(seedFile,'utf8'))};
 frozenFiles=[...inputs,...buildInputs];report.sourceFrozen=await capsule('frozen-before-browser',frozenFiles);report.sourceFrozenCount=Object.keys(report.sourceFrozen).length;for(const[file,digest]of Object.entries(report.sourceBefore))assert.equal(report.sourceFrozen[file],digest,`Source changed during generation: ${file}`);
 phase='actual Studio start';server=await createServer({root:app,configFile:join(app,'vite.config.ts'),server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});server.watcher.on('all',(event,file)=>{if(['change','add','unlink'].includes(event))report.changes.push({event,file});});await server.listen();
 const {chromium}=createRequire(join(process.env.PW_DIR,'package.json'))('playwright');browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--enable-unsafe-webgpu']});report.chromeProcessesLaunched=1;
 await freshOpen(seed,'01-inside-seed');const inside=await trim('inside','02-inside-trim160'),insideResult=await region(inside,crops.insideTwo,'03-inside-two-components');await material(inside,insideResult,crops.insideTwo,'03-inside',2,[0,0]);report.profiles.push({keep:'inside',crop:crops.insideTwo,components:2});
 await undo(inside,'04-undo-exact-original');await redo(insideResult.state,'05-redo-exact-components');
 const saved=await save('inside-two-regions');await freshOpen(saved,'06-inside-fresh-open');await material(inside,{state:await doc(),added:insideResult.added},crops.insideTwo,'06-inside-reopen',2,[0,0]);
 const component=insideResult.added[0];await select(component.id);const beforeRename=await doc(),renamedName=`${component.name} · editable`;await panel().getByLabel('Object name',{exact:true}).fill(renamedName);await panel().getByLabel('Object name',{exact:true}).press('Enter');await changed(beforeRename);const renamed=await doc();assert.deepEqual(byId(renamed,component.id),{...byId(beforeRename,component.id),name:renamedName});await snapshot('07-component-renamed');
 const renamedSaved=await save('inside-renamed');await freshOpen(renamedSaved,'08-renamed-fresh-open');await select(component.id);assert.equal(await panel().getByLabel('Object name',{exact:true}).inputValue(),renamedName);await snapshot('09-renamed-reeditable');
 // One real rename provides the prior Undo item for all three retained trim guards.
 const guardBase=await doc();await panel().getByLabel('Object name',{exact:true}).fill(`${renamedName} guard`);await panel().getByLabel('Object name',{exact:true}).press('Enter');await changed(guardBase);const guardEdited=await doc();
 await refuse('component-iges',()=>page.getByRole('button',{name:'Export IGES',exact:true}).click(),/trim/i);
 await refuse('component-thicken',()=>panel().getByRole('button',{name:'Thicken into a body',exact:true}).click(),/trim|whole surface/i);await select(insideResult.added[1].id,true);
 await refuse('component-sew',()=>panel().getByRole('button',{name:'Sew into a body',exact:true}).click(),/trim|whole surface/i);await dismissNotice();await undo(guardBase,'10-three-guards-no-undo');await redo(guardEdited,'11-guard-rename-redo');
 await freshOpen(seed,'12-outside-pocket-seed');const pocket=await trim('outside','13-outside-pocket-trim160'),pocketResult=await region(pocket,crops.outsidePocket,'14-outside-pocket-two-components');await material(pocket,pocketResult,crops.outsidePocket,'14-outside-pocket',2,[0,0]);report.profiles.push({keep:'outside',crop:crops.outsidePocket,components:2});
 const pocketSaved=await save('outside-pocket');await freshOpen(pocketSaved,'15-outside-pocket-reopen');await material(pocket,{state:await doc(),added:pocketResult.added},crops.outsidePocket,'15-outside-pocket-reopen',2,[0,0]);
 await freshOpen(seed,'16-outside-hole-seed');const hole=await trim('outside','17-outside-hole-trim160'),holeResult=await region(hole,crops.outsideHole,'18-outside-one-component-with-hole');await material(hole,holeResult,crops.outsideHole,'18-outside-hole',1,[1]);report.profiles.push({keep:'outside',crop:crops.outsideHole,components:1,holes:1});
 const holeSaved=await save('outside-hole');await freshOpen(holeSaved,'19-outside-hole-reopen');await material(hole,{state:await doc(),added:holeResult.added},crops.outsideHole,'19-outside-hole-reopen',1,[1]);
 await freshOpen(seed,'20-retained-rectangle-seed');const retained=await trim('outside','21-retained-rectangle-trim160'),retainedResult=await region(retained,crops.retainedRectangle,'22-outside-full-retained-explicit-mask');await material(retained,retainedResult,crops.retainedRectangle,'22-retained-rectangle',1,[0]);report.profiles.push({keep:'outside',crop:crops.retainedRectangle,components:1,explicitMask:true});
 const retainedSaved=await save('retained-rectangle');await freshOpen(retainedSaved,'23-retained-rectangle-reopen');await material(retained,{state:await doc(),added:retainedResult.added},crops.retainedRectangle,'23-retained-reopen',1,[0]);
 await select(retainedResult.added[0].id);await refuse('retained-rectangle-thicken',()=>panel().getByRole('button',{name:'Thicken into a body',exact:true}).click(),/trim|whole surface/i);
 await freshOpen(seed,'24-empty-inside-seed');const empty=await trim('inside','25-empty-inside-trim160');await emptyOracle(empty,crops.retainedRectangle,'25-empty-independent-oracle');await select('obj_1');await setCrop(crops.retainedRectangle);
 await refuse('empty-region',()=>panel().getByRole('button',{name:'Extract region',exact:true}).click(),/DOMAIN.*positive|positive.*material|no.*material/i);assert.equal(byId(await doc(),'obj_1').hidden,undefined);assert.equal((await doc()).direct.objects.length,empty.direct.objects.length);
 await undo(seed.doc,'26-empty-no-undo-entry');await redo(empty,'27-empty-redo-original-trim');await dismissNotice();report.profiles.push({keep:'inside',crop:crops.retainedRectangle,emptyRefusal:true});
 const retry=await region(empty,crops.insideTwo,'28-valid-retry-two-components');await material(empty,retry,crops.insideTwo,'28-valid-retry',2,[0,0]);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.changes,[]);report.sourceAfter=await capsule('after-browser',frozenFiles);report.sourceAfterCount=Object.keys(report.sourceAfter).length;assert.deepEqual(report.sourceAfter,report.sourceFrozen);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack??String(error);process.exitCode=1;if(page)try{await snapshot('failure');}catch(e){report.captureFailure=e.stack??String(e);}}
finally{for(const[resource,label]of[[context,'CONTEXT'],[browser,'BROWSER'],[server,'SERVER']]){if(!resource)continue;try{await resource.close();report.cleanup.push(`${label}_CLOSED`);}catch(e){report.cleanup.push({label,error:e.stack??String(e)});report.status='FAIL';process.exitCode=1;}}
 try{report.sourceAfterCleanup=await capsule('after-cleanup',frozenFiles);report.sourceAfterCleanupCount=Object.keys(report.sourceAfterCleanup).length;if(report.sourceFrozen)assert.deepEqual(report.sourceAfterCleanup,report.sourceFrozen);}catch(e){report.sourceCapsuleFailure=e.stack??String(e);report.status='FAIL';process.exitCode=1;}
 await persist();console.log(JSON.stringify({status:report.status,qualification:report.qualification,visualReview:report.visualReview,phase,failure:report.failure,output}));}
