// Root executes four private function calls over already paid FREE27. Zero World calls.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {closeSync,openSync,readFileSync,readSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'../..'),paid=join(import.meta.dirname,'evidence/private-04');
function pin(path){
 const hash=createHash('sha256'),buffer=Buffer.alloc(65536),fd=openSync(path,'r');let bytes=0;
 try{let n;while((n=readSync(fd,buffer,0,buffer.length,null))){hash.update(buffer.subarray(0,n));bytes+=n;}}
 finally{closeSync(fd);}return {bytes,sha256:hash.digest('hex')};
}
// IMMUTABLE_PINS_BEGIN
const pins={
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/native-phase-request.json": {
    "bytes": 82054,
    "sha256": "725282a91a31e47b6a67c5f01dccdd672319db888d630841a688eae8c605f5a1"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/native-private-output.json": {
    "bytes": 77239,
    "sha256": "cead2a62297efba0fee55891d30559ca8e3a74be233a1af89b46be3971252a1a"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/capsule-contact.js": {
    "bytes": 5708,
    "sha256": "7519483aec208b282ae23bb6985868af199b19d00d3d00564b3a5438d2113ad1"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/collision.js": {
    "bytes": 15257,
    "sha256": "a42979046e9f32c9fe16323617975b4d3a80aa71f44a74330208b0003c491457"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/contact-contribution.js": {
    "bytes": 3983,
    "sha256": "ef2eea7731343f2584baea3280515163ca23602cd3219049ea5d0296e7bce57e"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/contact-tangent.js": {
    "bytes": 2713,
    "sha256": "d5a3e6a0a2fef8000b219df53569c571a6d75b6a854b5266dd84fda3c58df9d0"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/internal-types.js": {
    "bytes": 43,
    "sha256": "b105d9550d9a3a0dccc02de4bf06d3191f7ce2a0b9241ee9031c14a54dff9b6e"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/limits.js": {
    "bytes": 416,
    "sha256": "15e4c3baf2645fa8aa040fcd4de7c5d14685e7a6ce1b6c45cffda01c47e08219"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/math.js": {
    "bytes": 2114,
    "sha256": "d82024b2458cf6ffdacef3ce57e0e1b802888bc39168ee032202536d4bdaa028"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/package.json": {
    "bytes": 1602,
    "sha256": "7ef765dcf000a0b45dd74495e60243e16516506e730afa024fc7f32b11222330"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/persistent-box-contact.js": {
    "bytes": 3933,
    "sha256": "38d7204fc639296ce5919d33b6f20290fc26dd0d61a6e94e65962e091262931b"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/contact-types.js": {
    "bytes": 11,
    "sha256": "8e609bb71c20b858c77f0e9f90bb1319db8477b13f9f965f1a1e18524bf50881"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/edge-contact.js": {
    "bytes": 3306,
    "sha256": "cd35a636c99773c087204ead2e3f797b9b803624d6883d1906b8d4bff2af0c34"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/face-contact.js": {
    "bytes": 6143,
    "sha256": "f00894e179c5317e77367991e6a30b1858ddf637282ccce40318b36873d20349"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/frictionless-island.js": {
    "bytes": 17494,
    "sha256": "9e64c47fdeef3826aa44699571fb16d2eccdde700b8ccda1feea31a781e7748f"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-apply.js": {
    "bytes": 3288,
    "sha256": "7f8d7bc1a0540ae85de4684a571ce70f08efd536f34bb67ad111cced690377d7"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-core.mjs": {
    "bytes": 6177,
    "sha256": "75941f67d5359c3734a68c93dd571313bdcab030a170205dee6e22d592119a46"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-exact.mjs": {
    "bytes": 7675,
    "sha256": "258732a572bd6b2d1606db97cd2b637bfd252ce5fb59ee31cb30b0e9d298cd32"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-input.mjs": {
    "bytes": 5935,
    "sha256": "294a5ace022a05ca93cf269c2c9f3faa7f22f9715bc8f59a2956b2cb04078027"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-linear.mjs": {
    "bytes": 6168,
    "sha256": "f12c0243c18178a138b79faaac29b14e61714a42376c6c88c2b8757eef82b280"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-phase.js": {
    "bytes": 5612,
    "sha256": "e82291e4014b98666367fe33bdf7e996f3b3c544c881dc5967b1b06ad6311c32"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-rows.js": {
    "bytes": 7852,
    "sha256": "9810df91101ff635dcfe9c0610a4cc35d4b88dd340ce9cef67406ee5afcaffe9"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-solver.d.mts": {
    "bytes": 947,
    "sha256": "c1c5c954b0664b3e75ff800d8b9fee7c237a44c6c72d64020428e377cc1a81e4"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-solver.mjs": {
    "bytes": 9940,
    "sha256": "84e32cae07dbdd295e46af04691f0bf37815d77e73e2b5edfb75b0739e104432"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-types.js": {
    "bytes": 11,
    "sha256": "8e609bb71c20b858c77f0e9f90bb1319db8477b13f9f965f1a1e18524bf50881"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/geometry.js": {
    "bytes": 2057,
    "sha256": "225329ca8c8359cd1e3278e7bb40951087841182cc07e1581e48f1cea691e43f"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/normal-solver.js": {
    "bytes": 15421,
    "sha256": "d672f4a7f41179fc9aefb767d0e92ed580cf346c9bd17ac8cc75b75aefba9570"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/sat-feature.js": {
    "bytes": 5108,
    "sha256": "75558bcb2392da27b81e8f0ae17cbb446ceccb191e4ec536280140da9bde7359"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/signed-sat.js": {
    "bytes": 6746,
    "sha256": "0c6d102bb26183d6f0789615bb66d9b44afedc52774dd575603308ebf859547c"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/strict-line.js": {
    "bytes": 19275,
    "sha256": "2314ce1450bc4d54148895c3498a511b793fd34e37aba03295f03501adcf51b3"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/witness.js": {
    "bytes": 1043,
    "sha256": "efd1289164059156211e7a382d69a6382e88dd0253f3e3c58a082268d20c3aa9"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/world-types.js": {
    "bytes": 11,
    "sha256": "8e609bb71c20b858c77f0e9f90bb1319db8477b13f9f965f1a1e18524bf50881"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/types.js": {
    "bytes": 418,
    "sha256": "65a4905c6bda0d4e7a5fc7ea105a1362c8cae1345070b5d17fd524a8790e1f8b"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/validation.js": {
    "bytes": 14590,
    "sha256": "7a16fbadf07097048276364818d8851d77f980fe84a30dc79529eadcb2fabe2c"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-source.mjs": {
    "bytes": 137040,
    "sha256": "2e7281017f620efbc87d1b9abbf016c21681a8a485cdb56e98af51ee71673496"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/result.json": {
    "bytes": 5531,
    "sha256": "e05735091669a51303a81f94f2e264312527c5fde6edd3ce9ae2cf2031401a62"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/source-phase-request.json": {
    "bytes": 82054,
    "sha256": "725282a91a31e47b6a67c5f01dccdd672319db888d630841a688eae8c605f5a1"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/source-private-output.json": {
    "bytes": 77239,
    "sha256": "cead2a62297efba0fee55891d30559ca8e3a74be233a1af89b46be3971252a1a"
  }
};
// IMMUTABLE_PINS_END
function authenticate(){for(const [name,expected]of Object.entries(pins))assert.deepEqual(pin(join(root,name)),expected,name);}
function words(value){
 const buffers=[];let nodes=0;
 function visit(x,depth){
  assert.ok(++nodes<=262144&&depth<=32);
  if(typeof x==='number'){
   assert.ok(Number.isFinite(x)&&buffers.length<65536);
   const b=Buffer.alloc(8);b.writeDoubleLE(x);buffers.push(b);return;
  }
  if(Array.isArray(x)){for(const v of x)visit(v,depth+1);return;}
  if(x&&typeof x==='object')for(const key of Object.keys(x))visit(x[key],depth+1);
 }
 visit(value,0);return Buffer.concat(buffers);
}
function restore(packet){
 const b=Buffer.from(packet.numericWordsF64leHex,'hex');assert.ok(b.length<=512*1024);let at=0;
 function visit(x){
  if(typeof x==='number'){assert.ok(at+8<=b.length);const n=b.readDoubleLE(at);at+=8;assert.ok(Number.isFinite(n)&&n===x);return n;}
  if(Array.isArray(x))return x.map(visit);
  if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,visit(v)]));
  return x;
 }
 const result=visit(packet.data);assert.equal(at,b.length);return result;
}
authenticate();
const receipt=JSON.parse(readFileSync(join(paid,'result.json'),'utf8'));
assert.equal(receipt.status,'PRIVATE_FREE27_SOURCE_NATIVE_PHASE_CONFIRMED');
let calls=0,reference=null;const graphs=[];
for(const graph of ['source','native']){
 const request=restore(JSON.parse(readFileSync(join(paid,graph+'-phase-request.json'),'utf8')));
 const expected=restore(JSON.parse(readFileSync(join(paid,graph+'-private-output.json'),'utf8'))).result;
 const modulePath=graph==='source'?join(paid,'private-source.mjs'):join(paid,'private-native/stack/frictionless-island.js');
 const api=await import(pathToFileURL(modulePath));const outputs=[];
 for(let n=0;n<2;n++){
  const input={freeBodies:structuredClone(request.freeBodies),pairs:structuredClone(request.pairs),context:structuredClone(request.context)};
  const before=structuredClone(input),beforeWords=words(input);
  calls++;
  const actual=api.prepareFrictionlessIsland(input.freeBodies,input.pairs,input.context);
  assert.deepEqual(input,before);assert.deepEqual(words(input),beforeWords);
  assert.deepEqual(actual,expected);assert.deepEqual(words(actual),words(expected));
  if(n)assert.deepEqual(actual,outputs[0]);
  if(reference){assert.deepEqual(actual,reference);assert.deepEqual(words(actual),words(reference));}
  else reference=actual;
  outputs.push(actual);
 }
 const outputWords=words(outputs[0]);
 graphs.push({graph,candidateCalls:2,inputRetained:true,completeJSONEqualPaid:true,allNumericWordsEqualPaid:true,
  numericWords:outputWords.length/8,wordSHA256:createHash('sha256').update(outputWords).digest('hex')});
}
assert.equal(calls,4);authenticate();
const line=JSON.stringify({status:'PRIVATE_DETERMINISM_CONFIRMED_NOT_WORLD_ACCEPTED',candidateCalls:calls,
 worldCalls:0,acceptedWorldSteps:0,compilerCalls:0,captureOrReplayCalls:0,graphs})+'\n';
assert.ok(Buffer.byteLength(line)<=65536);process.stdout.write(line);
