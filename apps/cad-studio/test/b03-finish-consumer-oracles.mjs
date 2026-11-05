// D543: current consumer supplement for the exact retained D533 finish branch.
// No product change. Root owns source freeze, native/Python/Studio execution and custody.
import {inspectorSource as retainedInspector,oracleSource as retainedOracle,seedJSON as originalSeedJSON,seedSHA256 as originalSeedSHA256} from './hole-chamfer-lifecycle-oracles.mjs';
export {originalSeedJSON,originalSeedSHA256};
export const originalSeedDoc=JSON.parse(originalSeedJSON);
export const seedPath='/tmp/barocss-d533-studio01/11-own-native-opfs-save.bcad';
export const seedBytes=1764;
export const seedSHA256='5ef280347fcc0f2d923d64b998b9646948bd0b7f3fa310c59851a2f9fbf3c9d9';
export const seedText="{\n  \"format\": \"barocss-cad-model\",\n  \"schema\": 3,\n  \"units\": \"mm\",\n  \"parameters\": {},\n  \"nodes\": [\n    {\n      \"kind\": \"sketch\",\n      \"profile\": \"rectangle\",\n      \"min\": [\n        -20,\n        -20\n      ],\n      \"max\": [\n        60,\n        20\n      ],\n      \"outline\": {\n        \"points\": [\n          [\n            -20,\n            -20\n          ],\n          [\n            60,\n            -20\n          ],\n          [\n            60,\n            20\n          ],\n          [\n            -20,\n            20\n          ]\n        ],\n        \"lengths\": {\n          \"0\": 80,\n          \"1\": 40\n        },\n        \"hv\": {\n          \"h\": [\n            0,\n            2\n          ],\n          \"v\": [\n            1,\n            3\n          ]\n        }\n      },\n      \"sideTags\": {\n        \"outer\": [\n          \"e1\",\n          \"e2\",\n          \"e3\",\n          \"e4\"\n        ]\n      },\n      \"id\": \"n0\"\n    },\n    {\n      \"kind\": \"extrude\",\n      \"sketch\": 0,\n      \"height\": 10,\n      \"id\": \"n1\"\n    },\n    {\n      \"kind\": \"chamfer\",\n      \"parent\": {\n        \"node\": 1,\n        \"side\": \"solid\"\n      },\n      \"edges\": [\n        \"n1.side[e1]|n1.top\"\n      ],\n      \"distance\": 2,\n      \"id\": \"n2\",\n      \"sigs\": {\n        \"n1.side[e1]|n1.top\": {\n          \"k\": \"line\",\n          \"p\": [\n            20,\n            -20,\n            10\n          ],\n          \"d\": [\n            1,\n            0,\n            0\n          ],\n          \"s\": 80\n        }\n      }\n    },\n    {\n      \"kind\": \"hole\",\n      \"parent\": {\n        \"node\": 2,\n        \"side\": \"solid\"\n      },\n      \"radius\": 2,\n      \"center\": [\n        20,\n        0\n      ],\n      \"face\": \"n1.top\",\n      \"id\": \"n3\"\n    }\n  ],\n  \"outputs\": {\n    \"b3\": {\n      \"node\": 3,\n      \"side\": \"solid\"\n    }\n  },\n  \"nextId\": 4\n}";
export const seedJSON="{\"format\":\"barocss-cad-model\",\"schema\":3,\"units\":\"mm\",\"parameters\":{},\"nodes\":[{\"kind\":\"sketch\",\"profile\":\"rectangle\",\"min\":[-20,-20],\"max\":[60,20],\"outline\":{\"points\":[[-20,-20],[60,-20],[60,20],[-20,20]],\"lengths\":{\"0\":80,\"1\":40},\"hv\":{\"h\":[0,2],\"v\":[1,3]}},\"sideTags\":{\"outer\":[\"e1\",\"e2\",\"e3\",\"e4\"]},\"id\":\"n0\"},{\"kind\":\"extrude\",\"sketch\":0,\"height\":10,\"id\":\"n1\"},{\"kind\":\"chamfer\",\"parent\":{\"node\":1,\"side\":\"solid\"},\"edges\":[\"n1.side[e1]|n1.top\"],\"distance\":2,\"id\":\"n2\",\"sigs\":{\"n1.side[e1]|n1.top\":{\"k\":\"line\",\"p\":[20,-20,10],\"d\":[1,0,0],\"s\":80}}},{\"kind\":\"hole\",\"parent\":{\"node\":2,\"side\":\"solid\"},\"radius\":2,\"center\":[20,0],\"face\":\"n1.top\",\"id\":\"n3\"}],\"outputs\":{\"b3\":{\"node\":3,\"side\":\"solid\"}},\"nextId\":4}";
export const seedDoc=JSON.parse(seedJSON);
const a=JSON.parse(seedJSON);a.nodes[2].distance=3;
export const states={
 A:{doc:a,documentJSON:JSON.stringify(a),documentSHA256:'390e7894f19c15d7730bcfe5a4b6b1ceac8ec6fb56951dd7a2cdc47968083db3',parameters:{chamferDistance:3,holeDiameter:4}},
 B:{doc:JSON.parse(seedJSON),documentJSON:seedJSON,documentSHA256:'d68a29d3b94a1a7af495658ff42306ba8d169b7a9006d39ed9af0dd57820c7cf',parameters:{chamferDistance:2,holeDiameter:4}},
};
export const builderFiles=['apps/cad-studio/test/b03-finish-consumer-oracles.mjs','apps/cad-studio/test/hole-chamfer-lifecycle-oracles.mjs'];
export const inventoryContract='Freeze builderFiles, exact original607B and actual saved1764B inputs, all resolved producer/compiler inputs, current Studio sources and exact expanded inspector/preflight/Python bytes through cleanup. No historical native reuse exception.';
// Re-export the exact strings; no observer, geometry, budget or Python alteration.
export const inspectorSource=retainedInspector;
export const oracleSource=retainedOracle;
export const oracleStatus='PASS_ONE_DECLARED_D533_HOLE_CHAMFER_STATE';
export const previewGuard={kind:'NEW_CHAMFER_PREVIEW_ONLY',parent:{node:3,side:'solid'},edge:'n1.side[e3]|n1.top',distance:1000,sourceClass:'A',required:['real current native/display back-top edge pointer','disabled Apply','actual refused preview','Cancel retains exact accepted A Doc/history/body'],notClaimed:'No committed invalid NodeEditor Apply or separately synthesized native guard'};
const cli='\nconst inputFile=';
if(!inspectorSource.includes(cli))throw Error('retained D533 inspector CLI boundary changed');
// ROOT ONLY: bundle this TS stdin with resolveDir apps/cad-studio, then
// node FRESH_EXTERNAL_BUNDLE.mjs /tmp/barocss-d543-control01
// Output: A/B-actual.bcad, A/B-native-before-assert.json, A/B-oracle-input.json,
// exact-original-saved-B.bcad and receipt.json. Run unchanged oracleSource separately.
export const preflightSource=inspectorSource.slice(0,inspectorSource.indexOf(cli))+String.raw`
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {editFields} from '../../packages/barocss-cad-model/src/app/editFields.ts';
const states:any=${JSON.stringify(states)},originalSeedDoc=${originalSeedJSON};
const source={path:${JSON.stringify(seedPath)},bytes:${seedBytes},sha256:${JSON.stringify(seedSHA256)},text:${JSON.stringify(seedText)}};
const output=resolve(process.argv[2]??'');assert.ok(output.startsWith('/tmp/barocss-d543-')&&!existsSync(output),'fresh owned D543 external output required');mkdirSync(output);
const save=(name:string,value:any)=>writeFileSync(join(output,name),typeof value==='string'?value:JSON.stringify(value,null,2));
const report:any={status:'RUNNING_CURRENT_D543_NATIVE_AB_ONLY',authority:'TWO_FRESH_CURRENT_NATIVE_CAPTURES_NO_HISTORICAL_NATIVE_REUSE',input:source.path,seedSHA256:source.sha256,rows:[],independentPython:'NOT_RUN',actualStudio:'NOT_RUN',previewGuard:'ACTUAL_UI_ONLY_NOT_RUN'};
const persist=()=>save('receipt.json',report);let phase='input';persist();
try{
 const bytes=readFileSync(source.path,'utf8');save('exact-original-saved-B.bcad',bytes);assert.equal(Buffer.byteLength(bytes),source.bytes);assert.equal(sha(bytes),source.sha256);assert.equal(bytes,source.text);const B=JSON.parse(bytes);assert.deepEqual(B,states.B.doc);assert.equal(sha(JSON.stringify(B)),states.B.documentSHA256);
 for(const label of ['B','A']){
  phase=label;let doc:any;
  if(label==='B')doc=JSON.parse(bytes);
  else{
   const before=JSON.stringify(B),field=editFields(B.nodes,2,B.parameters).find((f:any)=>f.key==='d');assert.ok(field&&field.kind==='number'&&field.label==='Distance','existing n2 Chamfer Distance owner');doc={...B,nodes:field.set(B.nodes,3)};save('A-public-field-candidate-before-assert.json',{field:{node:2,key:'d',label:'Distance',value:3},source:B,candidate:doc});assert.equal(JSON.stringify(B),before,'public setter must preserve actual saved source');
  }
  const expected=states[label],documentJSON=JSON.stringify(doc);save(label+'-actual.bcad',documentJSON);
  // inspect first retains raw whole Doc, compiled PartDoc and ALL original native
  // outputs/BRep bytes. Persist success or failure unchanged before assertions.
  const read=inspect(doc,{label,parameters:expected.parameters});const packet=JSON.stringify(read,null,2);save(label+'-native-before-assert.json',packet);
  const row:any={label,status:'CAPTURED_BEFORE_ASSERTIONS',parameters:expected.parameters,packet:label+'-native-before-assert.json',packetSHA256:sha(packet),documentSHA256:read.documentSHA256,outputs:read.outputs.map((o:any)=>({outputId:o.outputId,nativeBRepSHA256:o.nativeBRepSHA256}))};report.rows.push(row);persist();
  save(label+'-oracle-input.json',{doc,documentJSON,expectedDoc:expected.doc,seedDoc:originalSeedDoc,read,parameters:expected.parameters});
  assert.equal(documentJSON,expected.documentJSON,'exact selected A/B raw source only');assert.equal(sha(documentJSON),expected.documentSHA256);assert.equal(read.ok,true,JSON.stringify(read.error));assert.equal(read.status,'CAPTURED');assert.equal(read.inputUnchanged,true);assert.deepEqual(read.reader,{doc,notes:[]});assert.deepEqual(read.outputIds,['n3']);assert.equal(read.bodyKey,'b3');assert.equal(read.nativeBodyCount,1);assert.equal(read.outputs.length,1);assert.deepEqual(read.target,read.outputs[0]);assert.equal(read.documentJSON,documentJSON);assert.equal(read.documentSHA256,expected.documentSHA256);
  const raw=read.outputs[0];assert.equal(sha(raw.nativeBRepJSON),raw.nativeBRepSHA256);assert.deepEqual(JSON.parse(raw.nativeBRepJSON),raw.brep);assert.equal(raw.brep.bodies.length,1);assert.equal(raw.brep.bodies[0].kind,'solid');assert.equal(raw.brep.shells.length,1);assert.equal(raw.brep.shells[0].closed,true);
  for(const name of ['defaultCheck','strict','outputCheck']){const c=raw[name];assert.equal(c.valid,true,JSON.stringify(c));assert.deepEqual(c.issues,[]);assert.equal(c.topology.length,1);assert.equal(c.topology[0].genus,1);}
  assert.deepEqual(raw.massUnits,{density:1,densityUnit:'g/cm3',volume:'mm3',mass:'g',centroid:'mm',authority:'massPropertiesOf/brepMassProperties MMGS'});assert.equal(read.kernelChamfer.distance,expected.parameters.chamferDistance);assert.equal(read.kernelHole.radius,2);assert.deepEqual(read.kernelHole,{id:'n3',kind:'hole',target:'n2',center:[20,0],radius:2,face:'n1.top'});
  for(const m of [raw.massProperties,raw.brepMass])assert.ok(['closed-form','planar-exact','quadrature'].includes(m.method),'native nonmesh mass; independent physical checks remain separate');
  Object.assign(row,{status:'PASS_ONE_CURRENT_D543_NATIVE_CLASS_ONLY',strict:raw.strict,mass:raw.massProperties});persist();
 }
 report.status='PASS_CURRENT_D543_NATIVE_AB_ONLY';persist();console.log(JSON.stringify({status:report.status,output,rows:report.rows.map((r:any)=>({label:r.label,status:r.status,documentSHA256:r.documentSHA256}))}));
}catch(cause){report.status='FAIL_CURRENT_D543_NATIVE_ADMISSION';report.firstFailure={phase,...error(cause)};persist();console.log(JSON.stringify({status:report.status,output,firstFailure:report.firstFailure}));process.exitCode=1;}
`;
