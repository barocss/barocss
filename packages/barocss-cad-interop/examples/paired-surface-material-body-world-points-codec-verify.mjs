import assert from 'node:assert/strict';
import {
  PAIRED_SURFACE_MATERIAL_BODY_WORLD_POINTS_LIMITS as limits,
  BaroCadPairedSurfaceMaterialBodyWorldPointsReadError as ReadError,
  parsePairedSurfaceMaterialBodyWorldPointsJson as parse,
  copyPairedSurfaceMaterialBodyWorldPointsOwnData as copy,
} from '../dist/paired-surface-material-body-world-points-result-json.js';

function refuse(run, code, expected) {
  assert.throws(run, error => error instanceof ReadError &&
    error.code === code && (!expected || error.message.includes(expected)));
}
assert.equal(limits.utf8Bytes, 16777216);
assert.equal(limits.utf16Units, 16777216);
assert.equal(limits.values, 4194304);
refuse(() => parse('{"a":1,"\\u0061":2}'), 'JSON', 'Duplicate decoded JSON key');
refuse(() => parse('{"x":"\\ud800"}'), 'JSON', 'Unpaired Unicode surrogate refused');
refuse(() => parse('{"x":1e9999}'), 'JSON', 'Nonfinite JSON number refused');
refuse(() => parse('{"x":'), 'JSON');
refuse(() => parse('{"x":1} 0'), 'JSON');
const decoded = parse('{"a":-0,"b":[-0,1,2],"c":"ok"}');
assert.equal(Object.is(decoded.value.a, -0), true);
assert.equal(Object.is(decoded.value.b[0], -0), true);
assert.equal(decoded.metrics.negativeZeroNumbers, 2);
const duplicated = copy(decoded.value);
assert.notStrictEqual(duplicated.value, decoded.value);
assert.notStrictEqual(duplicated.value.b, decoded.value.b);
assert.equal(Object.is(duplicated.value.a, -0), true);
assert.equal(Object.is(duplicated.value.b[0], -0), true);
const shared = {value:1};
const aliased = copy({a:shared,b:shared});
assert.notStrictEqual(aliased.value.a, aliased.value.b);
assert.equal(aliased.metrics.aliasOccurrences, 1);
let getterCalls = 0;
const getter = Object.defineProperty({}, 'x', {enumerable:true, get(){getterCalls++;return 1;}});
refuse(() => copy(getter), 'OWNED', 'Getter or hidden own data refused');
assert.equal(getterCalls, 0);
refuse(() => copy({[Symbol('bad')]:1}), 'OWNED', 'Symbolic own keys refused');
const cycle = {};cycle.self = cycle;
refuse(() => copy(cycle), 'OWNED', 'Own ancestor cycle refused');
refuse(() => copy([,1]), 'OWNED', 'Sparse or extra-field own array refused');
const chunks = {chunks:Array.from({length:512},()=>Array(8192).fill(0))};
refuse(() => copy(chunks), 'BUDGET', 'Owned occurrence/depth budget exceeded');
console.log('World XYZ codec fixture-independent checks PASS');
