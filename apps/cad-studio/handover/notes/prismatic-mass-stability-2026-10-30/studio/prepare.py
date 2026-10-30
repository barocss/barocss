from pathlib import Path
import json
root=Path('/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b')
s=(root/'apps/cad-studio/test/offset-face-native-browser.mjs').read_text().replace('D342','D343').replace('d342','d343').replace('offset-face-native-browser.mjs','prismatic-mass-stability-browser.mjs')
a=s.index('const generator=');b=s.index('const inspector=',a)
s=s[:a]+r'''const generator=`import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
import {part,Location} from '../../packages/barocss-cad-model/src/api/index.ts';
const source=part('D343 translated cylinder').cylinder({r:3,h:5.00009}).moved(Location.at([.1234567,-.2345678,.3456789])).box({w:12,d:7,h:5,x:80,y:-3,z:1});
assert.equal(source.bodies().length,2);writeFileSync(process.argv[2],JSON.stringify(source.doc,null,2));`;
''' +s[b:]
a=s.index('const inspector=');b=s.index('const independentOracle=',a)
s=s[:a]+r'''const inspector=`import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
import {partBreps,evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {partSnapshot,bodyKeyOf} from '../../packages/barocss-cad-model/src/engine/part.ts';
import {brepMassProperties,massPropertiesOf,checkBrep} from '../../packages/barocss-cad/src/index.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc),p=part('D343 native and provider read',doc),view=evaluateDoc(doc,0),snapshot=partSnapshot(doc);assert.equal(view.ok,true,JSON.stringify(view));
function quadrature(brep){try{return brepMassProperties(brep,1);}catch(e){return {error:e instanceof Error?e.message:String(e)};}}
const bodies=partBreps(doc).map(({key,brep})=>{const displayed=view.bodies.find(b=>b.key===key),output=snapshot.outputs.find(o=>bodyKeyOf(o.id,doc.nodes)===key);assert.ok(output);return {key,ref:displayed.ref??null,brep,check:checkBrep(brep,{strict:true}),kernelRepresentation:output.representation,kernelMass:massPropertiesOf(output,1),nativeQuadrature:quadrature(brep),
 modelMass:{volume:displayed.volume,centroid:displayed.centroid},publicMass:p.body(key).mass({density:1}),publicNames:p.body(key).select().faces().names().sort(),nativeNames:brep.faces.map(f=>f.name),
 structure:{nativeSolidCount:brep.bodies.filter(b=>b.kind==='solid').length,nativeShellCount:brep.shells.length,nativeClosedShellCount:brep.shells.filter(s=>s.closed).length},
 displayBodyIndex:view.bodies.findIndex(b=>b.key===key),displayFaces:displayed.mesh.faces.map((f,index)=>({index,name:f.name,kind:f.kind,normal:f.normal,centroid:f.centroid}))};});assert.equal(JSON.stringify(doc),before,'Provider queries cannot change authored document');console.log(JSON.stringify({bodies}));`;
''' +s[b:]
a=s.index('const independentOracle=');b=s.index('const doc =',a);s=s[:a]+'const independentOracle='+json.dumps(Path('/tmp/d343-studio/mass-oracle.py').read_text())+';\n'+s[b:]
s=s.replace("b.mass.volume", "b.kernelMass.volume").replace("b.mass.centroid", "b.kernelMass.centroid").replace("witness.mass.volume", "witness.kernelMass.volume").replace("witness.mass.centroid", "witness.kernelMass.centroid")
s=s.replace("assert.ok(b.publicFaces.every(f=>f.area>0));",'')
s=s.replace("const input={original,actual,distance}","const input={original,actual,distance}")
s=s.replace("box-oracle.py", "mass-oracle.py").replace('async function boxGeometry(', 'async function massProof(')
a=s.index('async function editDistance(');b=s.index('const inputs=',a);s=s[:a]+s[b:]
s=s.replace("'packages/barocss-cad-model/src/sketch/plane.ts','packages/barocss-cad/dist/index.js'", "'packages/barocss-cad-model/src/sketch/plane.ts','packages/barocss-cad/src/brep/solid-mass.ts','packages/barocss-cad/dist/index.js'")
s=s.replace("[['/tmp/d343-plan/plan.md','plan.md'],['/tmp/d343-probe/receipt.md','baseline-receipt.md']]", "[['/tmp/d343-plan/plan.md','plan.md'],['/tmp/d343-kernel/receipt.md','kernel-receipt.md'],['/tmp/d342-nearfull/receipt.md','historical-consumer-receipt.md']]")
s=s.replace(",draftFile=join(output,'draft.bcad'),cylinderFile=join(output,'cylinder.bcad')",'').replace('[seedBundle,seedFile,draftFile,cylinderFile]','[seedBundle,seedFile]')
s=s.replace(",draft={file:draftFile,doc:JSON.parse(await readFile(draftFile,'utf8'))},cylinder={file:cylinderFile,doc:JSON.parse(await readFile(cylinderFile,'utf8'))}",'')
a=s.index(" await freshOpen(seed,'01-translated-fractional-seed')");b=s.index(' assert.deepEqual(report.errors,[]);',a)
s=s[:a]+r''' await freshOpen(seed,'01-translated-cylinder-source');const original=await readNative('01-original');await pickTop(original,'02-original-top');const distance=-5.00009;await openOffset(distance);assert.equal(await hud().getByLabel('Offset',{exact:true}).inputValue(),'-5.00009');await acceptedPreview(seed.doc,'03-captured-inward-preview');
 const accepted=await applyOffset(seed.doc,'04-captured-inward-applied');assert.equal(accepted.nodes.at(-1).kind,'difference');const thin=await readNative('04-captured-thin');await massProof(original,thin,distance,'04-captured-thin');await isoSnapshot('04-thin-ui-presence-only');report.profiles.push({kind:'captured-upright-translated-cylinder',radius:3,sourceHeight:5.00009,distance,visualScope:'UI accepted state/renderer presence only; Float32 pixels cannot prove positive normal interval'});
 await undo(seed.doc,'05-undo-exact-source');await redo(accepted,'06-redo-exact-thin-recipe');const redone=await readNative('06-redone-thin');await massProof(original,redone,distance,'06-redone-thin');assert.deepEqual(redone.nativeNames,thin.nativeNames);assert.deepEqual(redone.publicNames,thin.publicNames);
 const saved=await save('captured-thin');await freshOpen(saved,'07-thin-fresh-open');const reopened=await readNative('07-reopened-thin');await massProof(original,reopened,distance,'07-reopened-thin');assert.deepEqual(reopened.nativeNames,thin.nativeNames);assert.deepEqual(reopened.publicNames,thin.publicNames);assert.deepEqual((await doc()).nodes.slice(0,seed.doc.nodes.length),seed.doc.nodes);await isoSnapshot('08-reopened-thin-ui-presence-only');
 await freshOpen(seed,'09-visible-control-source');const controlOriginal=await readNative('09-visible-original');await pickTop(controlOriginal,'10-control-top');await openOffset(2);await acceptedPreview(seed.doc,'11-visible-control-preview');await applyOffset(seed.doc,'12-visible-control-applied');const control=await readNative('12-visible-control');await massProof(controlOriginal,control,2,'12-visible-control');await isoSnapshot('13-visible-control-iso');report.profiles.push({kind:'ordinary-visible-translated-cylinder',radius:3,sourceHeight:5.00009,distance:2});
''' +s[b:]
s=s.replace("const editor=()=>page.locator('.node-editor');\n",'')
s=s.replace("'Independent Fraction oracle uses original native endpoints plus represented distance; display mass/bounds are separate evidence.'", "'Independent Fraction interval/midpoint uses original native endpoints plus represented distance. Kernel/Model/public/Studio mass are asserted; native B-rep quadrature is recorded separately.'")
s=s.replace("'Signed other caps, repeated command closure and generic drafted/curved continuation are separate focused-test scopes.'", "'Z-upright provider only. X/Y and generic transformed providers are separate; no global central-inertia or exact pi claim.'")
s=s.replace("'Integer cylinder is an existing support control with rounded analytic pi, not exact rational circle mass or a generic curved certificate.'", "'Tiny Float32 bounds and pixels cannot resolve the normal interval. Screenshot review proves UI presence only.'")
(root/'apps/cad-studio/test/prismatic-mass-stability-browser.mjs').write_text(s)
