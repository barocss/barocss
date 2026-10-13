import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const dir = process.env.BARO_CAD_WORLD_FIXTURE_DIR;
assert.ok(dir, 'BARO_CAD_WORLD_FIXTURE_DIR is required');
const pins = {
  'main-result.json': [562166,'aa3cbfac04cccd9ef03e89020fc434393115f61cc5c6b6bcd8288b8f4f8e34dd'],
  'edited-result.json': [567898,'22a569a7c56e7f5591472a8470583565988eb5eee3fc8e164835c6484cd41e02'],
  'main-request.json': [526647,'1f9454ff027a5578fbed68ba71511ba2d71f42eb593dc72c07fde22bcb31b276'],
  'edited-request.json': [532808,'3495cea768c5c27b0455fbcdf142e66706d198385897b5eb5084b38f54601f2c'],
};
const data = {};
for (const [name,[size,hash]] of Object.entries(pins)) {
  const raw = await readFile(resolve(dir,name));
  assert.equal(raw.byteLength,size,`${name}: bytes`);
  assert.equal(createHash('sha256').update(raw).digest('hex'),hash,`${name}: hash`);
  data[name] = JSON.parse(raw.toString('utf8'));
}
const at = (tree,path) => path.reduce((value,key)=>value[key],tree);
const zeroPaths = [
  ['a',0,0,0,0],['a',0,2,0,0,2],['a',1,0,0,0,2],['a',1,1,0,0],
  ['b',0,0,0,0],['b',0,2,0,0,2],['b',1,0,0,0,2],['b',1,1,0,0],
].map(([side,model,object,...coords])=>['body','request',side,'request','section','originalModels',model,'objects',object,'controlPoints',...coords]);
zeroPaths.push(['queries',9,'pointMM',1],['queries',9,'pointMM',2]);
for (const prefix of ['main','edited']) {
  const result = data[`${prefix}-result.json`], request = data[`${prefix}-request.json`];
  assert.deepStrictEqual(Object.keys(result).sort(),['request','classifications','proof','report'].sort());
  assert.deepStrictEqual(result.request,request,`${prefix}: request association`);
  assert.equal(result.request.queries.length,16);
  for(const path of zeroPaths) assert.ok(Object.is(at(request,path),-0),`${prefix}: signed zero ${path.join('.')}`);
  const expected = prefix==='main' ? {inside:1,outside:5,boundary:10}:{inside:3,outside:3,boundary:10};
  for (const [key,count] of Object.entries(expected)) assert.equal(result.classifications.filter(x=>x.status===key).length,count);
}
console.log('PASS: four original byte pins, request associations, 20 signed zeros, 32 classifications');
