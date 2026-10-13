import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {
  parseBaroCadPairedSurfaceMaterialBodyWorldPointsResult as parse,
  readBaroCadPairedSurfaceMaterialBodyWorldPointsResult as read,
  BaroCadPairedSurfaceMaterialBodyWorldPointsReadError as ReadError,
} from '../dist/paired-surface-material-body-world-points-result.js';

const dataFile = name => fileURLToPath(new URL('./paired-surface-material-body-world-points-result-data/' + name, import.meta.url));
const fixturePins = Object.freeze({
  'main-result.json': {bytes:562166,sha256:'aa3cbfac04cccd9ef03e89020fc434393115f61cc5c6b6bcd8288b8f4f8e34dd'},
  'edited-result.json': {bytes:567898,sha256:'22a569a7c56e7f5591472a8470583565988eb5eee3fc8e164835c6484cd41e02'},
  'main-request.json': {bytes:526647,sha256:'1f9454ff027a5578fbed68ba71511ba2d71f42eb593dc72c07fde22bcb31b276'},
  'edited-request.json': {bytes:532808,sha256:'3495cea768c5c27b0455fbcdf142e66706d198385897b5eb5084b38f54601f2c'},
});
async function pinnedBytes(name) {
  const bytes = await readFile(dataFile(name));
  const pin = fixturePins[name];
  assert.equal(bytes.length, pin.bytes, name + ' byte count');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256, name + ' SHA-256');
  return bytes;
}
const refuse = (run, code) => assert.throws(run, error => error instanceof ReadError && error.code === code);
const own = (a, b) => {
  assert.notStrictEqual(a, b);
  assert.deepEqual(a, b);
};
const negativeZeroPaths = [
  ['request','queries',9,'pointMM',1],
  ['request','queries',9,'pointMM',2],
];

refuse(() => parse({}), 'INPUT');
refuse(() => read([]), 'INPUT');
refuse(() => parse('{"a":1,"\\u0061":2}'), 'JSON');
refuse(() => parse('{"x":"\\ud800"}'), 'JSON');
refuse(() => parse('{"x":1e9999}'), 'JSON');
refuse(() => read({request:{},classifications:[],proof:{}}), 'SCHEMA');
refuse(() => read({request:{},classifications:[],proof:{},report:{schema:'wrong',version:0}}), 'SCHEMA');
refuse(() => read({request:{},classifications:[],proof:{},report:{schema:'barocss-paired-surface-material-body-world-points',version:1}}), 'SCHEMA');
const getter = Object.defineProperty({}, 'a', {enumerable:true, get(){throw Error('getter called');}});
refuse(() => read(getter), 'OWNED');
const symbol = {[Symbol('secret')]:1};
refuse(() => read(symbol), 'OWNED');
const cycle = {}; cycle.self = cycle;
refuse(() => read(cycle), 'OWNED');


// Keep caller input rejection independent of fixture availability.
const chunks = {chunks:Array.from({length:512},()=>Array(8192).fill(0))};
refuse(() => read(chunks), 'BUDGET');
refuse(() => parse('{"request":{},"classifications":[],"proof":{},"report":{"schema":"wrong","version":0}}'), 'SCHEMA');

for (const name of Object.keys(fixturePins)) await pinnedBytes(name);

for (const name of ['main-result.json','edited-result.json']) {
  const text = (await pinnedBytes(name)).toString('utf8');
  const parsed = parse(text);
  const owned = read(parsed.native);
  assert.equal(parsed.sourceText, text);
  assert.equal(owned.sourceText, null);
  assert.equal(parsed.profile.nativeSchema, 'barocss-paired-surface-material-body-world-points');
  assert.equal(Object.isFrozen(parsed.profile), true);
  assert.equal(Object.isFrozen(parsed.profile.limits), true);
  assert.equal(Object.isFrozen(parsed.profile.capabilities), true);
  own(parsed.native, owned.native);
  own(parsed.validationReport, owned.validationReport);
  assert.notStrictEqual(parsed.native, parsed.validationReport);
  for (const path of negativeZeroPaths) {
    const at = (root) => path.reduce((current, key) => current[key], root);
    assert.equal(Object.is(at(parsed.native), -0), true, name + ':' + path.join('.'));
    assert.equal(Object.is(at(owned.native), -0), true, name + ':' + path.join('.'));
  }
  // The native validator must reject changes to any authoritative saved stage,
  // qualified boundary reference, or certificate without rewriting the request.
  if (name === 'main-result.json') {
    const mutations = [
      packet => { packet.proof.queries[0].x[0].sign = 0; },
      packet => { packet.classifications[2].boundaryFaces[0].parentField = 'request.other'; },
      packet => { packet.report.quality.genericBoolean = true; },
    ];
    for (const mutate of mutations) {
      const packet = structuredClone(parsed.native);
      mutate(packet);
      refuse(() => read(packet), 'NATIVE');
    }
  }
  assert.equal(parsed.native.request.queries.length, 16);
  assert.equal(parsed.native.report.quality.exactWorldRegionMembershipCertified, true);
  console.log(name + ': parse/read PASS');
}
console.log('World XYZ reader bounded smoke verification PASS');
