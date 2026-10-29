// Lightweight source/admission/transform controls only. No evaluateCadPart/evaluateDoc, Boolean operation or browser.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=process.argv[2], require=createRequire(root+'/packages/barocss-cad-model/package.json'), {build}=require('esbuild');
const tracked=execFileSync('git',['diff','--name-only','92256f0df'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
const files=[...new Set([...tracked,'packages/barocss-cad/test/rectangular-cut-pattern.test.mjs','packages/barocss-cad-model/test/api-rectangular-feature-pattern.test.ts','packages/barocss-cad-model/test/rectangular-feature-pattern-command.test.ts'])].sort();
const hash=f=>createHash('sha256').update(readFileSync(root+'/'+f)).digest('hex');
const hashes=Object.fromEntries(files.map(f=>[f,hash(f)]));
writeFileSync('/tmp/d333-review/source-hashes.json',JSON.stringify(hashes,null,2)+'\n');
const result=await build({stdin:{contents:`export { rectangularFeaturePatternProblem, rectangularPatternDocumentProblem } from './packages/barocss-cad-model/src/engine/doc.ts'; export { readStudioDoc } from './packages/barocss-cad-model/src/engine/migrate.ts'; export { rectangularFeaturePatternSpec } from './packages/barocss-cad/src/api/spec.ts'; export { transformBrep } from './packages/barocss-cad/src/brep/brep-transform.ts'; export { transformPrismatic } from './packages/barocss-cad/src/features/prismatic-solid.ts';`,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {rectangularFeaturePatternProblem:problem,rectangularPatternDocumentProblem:documentProblem,readStudioDoc,rectangularFeaturePatternSpec:spec,transformBrep,transformPrismatic}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const nodes=[{kind:'sketch',profile:'rectangle',min:[0,0],max:[60,40]},{kind:'extrude',sketch:0,height:10},{kind:'sketch',profile:'rectangle',min:[8,8],max:[12,12]},{kind:'extrude',sketch:2,height:10},{kind:'difference',parent:{node:1,side:'solid'},tool:{node:3,side:'solid'}}];
const good={kind:'rectangular-feature-pattern',parent:{node:4,side:'solid'},axis:'x',spacing:{parameter:'dx'},count:3,axis2:'y',spacing2:{parameter:'dy'},count2:2},params={dx:16,dy:16};
const doc={format:'barocss-cad-model',schema:3,units:'mm',parameters:params,nodes:[...nodes,good],outputs:{b5:{node:5,side:'solid'}}};
assert.equal(problem(good,nodes,params),null);assert.equal(documentProblem(doc),null);assert.ok('doc' in readStudioDoc(JSON.stringify(doc)));
for(const edit of [{axis:'q'},{axis2:'q'},{axis2:'x'},{count:33,count2:2},{count:0},{count2:0},{count2:1.5},{count2:Infinity},{spacing:0},{spacing2:0},{spacing2:-1},{spacing2:10001},{spacing2:{parameter:'missing'}},{count2:{parameter:'dy'}},{unexpected:true}]){
 const bad={...good,...edit};assert.ok(problem(bad,nodes,params),JSON.stringify(edit));assert.ok(documentProblem({...doc,nodes:[...nodes,bad]}));
}
for(const [count,count2] of [[1,1],[1,2],[3,1],[8,8]])assert.equal(problem({...good,count,count2},nodes,params),null);
const stale=[...nodes,{kind:'translate',parent:{node:4,side:'solid'},offset:[0,0,1]}];assert.ok(problem(good,stale,params));
assert.ok(problem(good,nodes.map((n,i)=>i===4?{...n,suppressed:true}:n),params));
const nested={...doc,nodes:[],instances:[{id:'part',doc:{...doc,nodes:[...nodes,{...good,count:33,count2:2}]}}]};assert.ok(documentProblem(nested));assert.ok('error' in readStudioDoc(JSON.stringify(nested)));
const pending={...doc,nodes:[],pendingParts:{p:{doc:{...doc,nodes:[...nodes,{...good,spacing2:0}]}}}};assert.ok(documentProblem(pending));
assert.ok(documentProblem({...doc,parameters:{...params,dy:0}}));
console.log('model_literal_parameter_saved_nested_stale_suppressed_and_budget_admission_controls PASS');
assert.equal(spec({axis:'x',spacing:16,count:1,axis2:'y',spacing2:16,count2:1}).command,'rectangular-feature-pattern');
for(const edit of [{axis:'q'},{axis2:'x'},{count:0},{count2:NaN},{count2:1.5},{spacing:0},{spacing2:-1}])assert.throws(()=>spec({axis:'x',spacing:16,count:3,axis2:'y',spacing2:16,count2:2,...edit}));
console.log('public_spec_axis_positive_spacing_and_safe_integer_controls PASS');
// Synthetic small representation fixtures exercise name mapping, not B-rep validity or volume.
const curve={degree:1,knots:[0,0,1,1],controlPoints:[[0,0,0],[1,0,0]]},surface={degreeU:1,degreeV:1,knotsU:[0,0,1,1],knotsV:[0,0,1,1],controlPoints:[[[0,0,0],[1,0,0]],[[0,1,0],[1,1,0]]]};
const brep={vertices:[{id:'v0',point:[0,0,0]}],edges:[{id:'e0',name:'tool.side0|other.top',curve}],faces:[{id:'f0',name:'tool.side0',surface,sense:'forward'}],loops:[],coedges:[],bodies:[],shells:[]},before=structuredClone(brep),map={matrix:[1,0,0,0,1,0,0,0,1],offset:[16,8,0]},suffix='@2,1';
assert.deepEqual(transformBrep(brep,map,suffix),transformBrep(brep,map,n=>n+suffix));assert.deepEqual(brep,before);
assert.equal(transformBrep(brep,map,n=>'renamed:'+n).faces[0].name,'renamed:tool.side0');
const points=[[0,0],[4,0],[4,4],[0,4]],outer=points.map((a,i)=>({kind:'line',a,b:points[(i+1)%4],tag:'tool.side'+i})),regions=[{outer,holes:[]}],solid={slabs:[{z0:0,z1:10,regions}],caps:[{z:0,regions,tag:'tool.bottom'},{z:10,regions,tag:'tool.top'}]},solidBefore=structuredClone(solid),pm={matrix:[1,0,0,1],offset:[16,8]};
assert.deepEqual(transformPrismatic(solid,{...pm,retag:suffix}),transformPrismatic(solid,{...pm,retag:n=>n+suffix}));assert.deepEqual(solid,solidBefore);
console.log('transform_suffix_callback_equivalence_and_input_immutability_controls PASS');
const changed=files.filter(f=>hashes[f]!==hash(f));writeFileSync('/tmp/d333-review/source-changes-during-controls.json',JSON.stringify(changed,null,2)+'\n');assert.deepEqual(changed,[]);
console.log('source_files_unchanged_during_controls PASS '+files.length);
