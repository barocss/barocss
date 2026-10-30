from pathlib import Path
import json
root=Path('/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b')
p=root/'apps/cad-studio/test/trimmed-surface-region-browser.mjs'
s=(root/'apps/cad-studio/test/trimmed-surface-split-browser.mjs').read_text().replace('D340','D341').replace('d340','d341').replace('trimmed-surface-split-browser.mjs','trimmed-surface-region-browser.mjs')
s=s.replace('represented binary64 cut','represented binary64 crop bounds').replace('Independent oracle receives actual original stored160 UV values and represented binary64 crop bounds; ideal240 is not substituted.','Independent rectangle oracle uses actual original stored160 UV, represented crop bounds and perpendicular-boundary switch levels; ideal guides are not substituted.')
a=s.index('const unsupportedCSS=');b=s.index('const generator=',a);s=s[:a]+s[b:]
a=s.index('for(const [file,source]of');b=s.index('const inspector=',a)
s=s[:a]+"const direct=importSource(emptyDirect(),${JSON.stringify(fixtureCSS)},'D341');assert.ok(direct.objects.every(o=>!o.trims));\nwriteFileSync(process.argv[2],JSON.stringify({...witness.doc,direct},null,2)+'\\\\n');`;\n"+s[b:]
a=s.index('const independentVerifier=');b=s.index('const doc =',a);s=s[:a]+'const independentVerifier='+json.dumps(Path('/tmp/d341-studio/rectangle-verifier.py').read_text())+';\n'+s[b:]
a=s.index('async function split(');b=s.index('async function refuse(',a)
s=s[:a]+r'''const crops={insideTwo:{u:[-.8,2.8],v:[3.7,5]},outsidePocket:{u:[-1.6,5],v:[1.4,3.7]},outsideHole:{u:[-1.6,5],v:[1.4,6.2]},retainedRectangle:{u:[.4,1.6],v:[3.8,4.6]}};
async function setCrop(crop){for(const[label,value]of [['u from',crop.u[0]],['u to',crop.u[1]],['v from',crop.v[0]],['v to',crop.v[1]]])await panel().getByLabel(label,{exact:true}).fill(String(value));}
async function region(trimmed,crop,label){
 phase=`actual Extract region ${label}`;await select('obj_1');await setCrop(crop);await panel().getByRole('button',{name:'Extract region',exact:true}).click();await changed(trimmed);
 const state=await doc(),added=state.direct.objects.filter(o=>!trimmed.direct.objects.some(old=>old.id===o.id));
 assert.deepEqual(byId(state,'obj_1'),{...byId(trimmed,'obj_1'),hidden:true},'Hidden original retains exact trims/source/name');assert.deepEqual(state.nodes,trimmed.nodes);
 assert.ok(added.length>0&&added.every(o=>!o.hidden&&o.trims?.length>0),'Every accepted component keeps an explicit mask');
 for(const object of trimmed.direct.objects.filter(o=>o.id!=='obj_1'))assert.deepEqual(byId(state,object.id),object,'Unrelated object unchanged');
 await snapshot(label);return {state,added};
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
 report.material.push(evidence);await writeFile(join(output,`${label}-material.json`),JSON.stringify(evidence,null,2));await persist();return evidence;
}
async function emptyOracle(trimmed,crop,label){
 const original=byId(trimmed,'obj_1').trims[0],input={uv:original.uv,domain:{u:[-2,6],v:[1,7]},crop,keep:original.keep,children:[]};
 await writeFile(join(output,`${label}-oracle-input.json`),JSON.stringify(input,null,2));const run=spawnSync('python3',[join(output,'rectangle-verifier.py')],{input:JSON.stringify(input),encoding:'utf8'});
 await writeFile(join(output,`${label}-oracle.stdout.json`),run.stdout??'');await writeFile(join(output,`${label}-oracle.stderr.txt`),run.stderr??'');assert.equal(run.status,0,run.stderr);const result=JSON.parse(run.stdout);assert.deepEqual(result.expectedExactRectangleComponents,[]);report.material.push({label,crop,empty:true,verified:result});
}
''' +s[b:]
s=s.replace("'packages/barocss-cad/src/nurbs/surfaces/trimmed-surface-parameter-split.ts'","'packages/barocss-cad/src/nurbs/surfaces/trimmed-surface-region.ts'")
s=s.replace("'packages/barocss-cad/src/nurbs/surfaces/surface-parameter-split.ts'","'packages/barocss-cad/src/nurbs/surfaces/surface-region.ts'")
a=s.index(" for(const name of ['oracle.py','oracle.json'])");b=s.index(' const buildInputs=[]',a)
s=s[:a]+" const planBytes=await readFile('/tmp/d341-plan/plan.md');await writeFile(join(output,'plan.md'),planBytes);report.independentSources=[{name:'plan.md',sha256:hash(planBytes)}];\n await writeFile(join(output,'rectangle-verifier.py'),independentVerifier);report.independentSources.push({name:'rectangle-verifier.py',sha256:hash(independentVerifier)});\n"+s[b:]
s=s.replace(",warpedFile=join(output,'warped-seed.bcad')",'').replace('[seedBundle,seedFile,warpedFile]','[seedBundle,seedFile]')
s=s.replace(",warped={file:warpedFile,doc:JSON.parse(await readFile(warpedFile,'utf8'))}",'')
a=s.index(" await freshOpen(seed,'01-inside-seed')");b=s.index(' assert.deepEqual(report.errors,[]);',a)
s=s[:a]+r''' await freshOpen(seed,'01-inside-seed');const inside=await trim('inside','02-inside-trim160'),insideResult=await region(inside,crops.insideTwo,'03-inside-two-components');await material(inside,insideResult,crops.insideTwo,'03-inside',2,[0,0]);report.profiles.push({keep:'inside',crop:crops.insideTwo,components:2});
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
''' +s[b:]
p.write_text(s)
