// Bounded source-authoring and actual React classifier tests; no Native evaluation or GPU.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../../..');
const engine=readFileSync(resolve(root,'packages/barocss-cad-editor/src/modeling-engine.ts'),'utf8');
const recipe=engine.match(/export function createCadEditorConstrainedPlateModel\(\): CadModelSnapshot \{([\s\S]*?)\n\}\n\n/);
assert.ok(recipe);
const calls=[];
const point=value=>{const i=calls.filter(c=>c.kind==='point').length;calls.push({kind:'point',value});return i;};
const constraints=kind=>(...pts)=>calls.push({kind,pts});
const model={parameter(name,value){calls.push({kind:'parameter',name,value});return {parameter:name};},
  sketch:{constrainedPolygon(fn){const s={point,fixed:constraints('fixed'),horizontal:constraints('horizontal'),vertical:constraints('vertical')};
    const output=fn(s);calls.push({kind:'profile',output});return {extrude(height){calls.push({kind:'extrude',height});return {node:1};}};}},
  build(outputs){calls.push({kind:'build',outputs});return {calls};}};
const output=new Function('cad',recipe[1])({model:()=>model});
const records=output.calls;
assert.deepEqual(records.filter(c=>c.kind==='parameter').map(c=>[c.name,c.value]),[['width',32],['height',24],['lockY',0]]);
assert.equal(Object.is(records.find(c=>c.kind==='point').value[0],-0),true);
assert.deepEqual(records.filter(c=>['fixed','horizontal','vertical'].includes(c.kind)).map(c=>c.kind+':'+c.pts.join(',')),
  ['fixed:0','fixed:2','horizontal:0,1','vertical:1,2','horizontal:2,3','vertical:3,0','fixed:1']);
assert.equal(records.find(c=>c.kind==='extrude').height,8);
let checks=4;
const ui=readFileSync(resolve(root,'packages/barocss-cad-editor/src/react/modeling-editor.tsx'),'utf8');
const fragment=ui.match(/ {2}const canonicalConstrained = ([\s\S]*?);\n {2}const constrainedPlateDrivers = ([\s\S]*?);\n {2}const circleModel/);
assert.ok(fragment,'Actual React classifier initializer');checks++;
const classifier=new Function('accepted','authored',`const canonicalConstrained = ${fragment[1]}; return ${fragment[2]};`);
const p=name=>({parameter:name});
const graph={parameters:{width:32,height:24,lockY:0},nodes:[
 {kind:'sketch',profile:'constrained-polygon',points:[[-0,0],[p('width'),p('lockY')],[p('width'),p('height')],[1,p('height')]],
  constraints:[{kind:'fixed',point:0},{kind:'fixed',point:2},{kind:'horizontal',points:[0,1]},{kind:'vertical',points:[1,2]},{kind:'horizontal',points:[2,3]},{kind:'vertical',points:[3,0]},{kind:'fixed',point:1}]},
 {kind:'extrude',sketch:0,height:8}],outputs:{part:{node:1,side:'solid'}}};
const accepted={source:'model',parameters:graph.parameters};
assert.equal(classifier(accepted,graph),true);checks++;
for(const mutate of [
 d=>d.parameters.lockY=1,d=>d.parameters.extra=2,d=>d.nodes[0].points[3][0]=2,
 d=>d.nodes[0].constraints.pop(),d=>d.nodes[0].constraints[2].kind='vertical',
 d=>d.nodes[1].height=9,d=>d.nodes[1].from=0,d=>d.outputs.other=d.outputs.part,
 d=>d.outputs.part.node=0
]){const v=structuredClone(graph);mutate(v);assert.equal(classifier({...accepted,parameters:v.parameters},v),false);checks++;}
assert.equal(classifier({...accepted,source:'legacy'},graph),false);checks++;
console.log(JSON.stringify({status:'PASS',checks,scope:'actual authored source and strict UI classification; no Native/GPU'}));
