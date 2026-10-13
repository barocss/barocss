// Exact top-entry authoring call shape and actual modeling-editor initializer, no native evaluations.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../..');
const calls = [];
const record = (kind, detail) => {const index = calls.length;calls.push({kind,...detail});return index;};
const handle = node => ({node,cut(other){return handle(record('difference',{parent:node,tool:other.node}));}});
globalThis.__topPocketStub = {model(){return {
 parameter(name,value){record('parameter',{name,value});return {parameter:name};},
 dimension:{
   add(left,right){record('add',{left,right});return {op:'add',left,right};},
   scale(value,factor){record('scale',{value,factor});return {op:'scale',value,factor};},
 },
 sketch:{rectangle(profile){const node=record('rectangle',profile);return {extrude(height,options){return handle(record('extrude',{sketch:node,height,...options}));}};}},
 build(outputs){return {calls:structuredClone(calls),outputs:Object.fromEntries(Object.entries(outputs).map(([name,obj])=>[name,obj.node]))};},
};}};
// Execute the actual production recipe body with public-authoring recording stubs.
const engine=readFileSync(resolve(root,'packages/barocss-cad-editor/src/modeling-engine.ts'),'utf8');
const recipe=engine.match(/export function createCadEditorTopPocketModel\(\): CadModelSnapshot \{([\s\S]*?)\n\}\n\n/);
assert.ok(recipe,'Production top-entry pocket recipe is present');
const buildRecipe=new Function('cad',recipe[1]);
const result=buildRecipe(globalThis.__topPocketStub);

assert.deepEqual(Object.keys(result.outputs),['plate','tool','part']);
assert.equal(result.calls.filter(row=>row.kind==='parameter').map(row=>row.name).join(','),'depth,toolY,toolSpanY');
assert.equal(result.calls.filter(row=>row.kind==='extrude').length,2);
const tool=result.calls.find(row=>row.kind==='extrude' && typeof row.height==='object');
assert.deepEqual(tool.from,{op:'add',left:8,right:{op:'scale',value:{parameter:'depth'},factor:-1}});
assert.equal(result.calls.filter(row=>row.kind==='difference').length,1);
let checks=5;
// Read the *actual initializer*, not a duplicated approximation.
const ui=readFileSync(resolve(root,'packages/barocss-cad-editor/src/react/modeling-editor.tsx'),'utf8');
const fragment=ui.match(/ {2}const topPocketDrivers = ([\s\S]*?);\n {2}const pocketDrivers/);
assert.ok(fragment,'Top-pocket initializer is available');
const classify=new Function('differenceModel','accepted','authored',`return ${fragment[1]}`);
const parsed={
 parameters:{depth:4,toolY:8,toolSpanY:8},
 nodes:[
  {kind:'sketch',profile:'rectangle',min:[0,0],max:[32,24]},
  {kind:'extrude',sketch:0,height:8},
  {kind:'sketch',profile:'rectangle',min:[8,{parameter:'toolY'}],max:[24,{op:'add',left:{parameter:'toolY'},right:{parameter:'toolSpanY'}}]},
  {kind:'extrude',sketch:2,height:{parameter:'depth'},from:{op:'add',left:8,right:{op:'scale',value:{parameter:'depth'},factor:-1}}},
  {kind:'difference',parent:{node:1,side:'solid'},tool:{node:3,side:'solid'}},
 ],
 outputs:{part:{node:4,side:'solid'},plate:{node:1,side:'solid'},tool:{node:3,side:'solid'}},
};
const accepted={source:'model',parameters:parsed.parameters};
assert.equal(classify(true,accepted,parsed),true);checks++;
for(const mutate of [
 d=>d.nodes[3].from=0,
 d=>d.nodes[3].from.right.factor=1,
 d=>d.nodes[3].from.left=7,
 d=>d.nodes[3].height.parameter='toolY',
 d=>d.nodes[1].from=0,
 d=>d.nodes[2].max[0]=25,
 d=>d.nodes[4].parent.node=3,
 d=>d.outputs={part:d.outputs.part},
 d=>d.parameters={...d.parameters,toolX:8},
]){const changed=structuredClone(parsed);mutate(changed);assert.equal(classify(true,{...accepted,parameters:changed.parameters},changed),false);checks++;}
assert.equal(classify(false,accepted,parsed),false);checks++;
console.log(JSON.stringify({status:'PASS',checks,scope:'public authoring trace and actual UI initializer; no native or GPU evaluation'}));
