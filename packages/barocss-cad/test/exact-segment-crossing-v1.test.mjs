import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyExactSegmentCrossingV1 as classify } from '../dist/exact-proof/exact-segment-crossing-v1.js';
const p = (x, y) => ({ x, y });
const relation = (a,b,c,d) => classify(a,b,c,d).relation;
test('exact proper crossing and disjoint classification are symmetric under reversals', () => {
  const a=p(0,0), b=p(4,4), c=p(0,4), d=p(4,0);
  for (const [x,y,u,v] of [[a,b,c,d],[b,a,c,d],[a,b,d,c],[c,d,a,b]]) {
    assert.equal(relation(x,y,u,v), 'proper-interior-crossing');
  }
  assert.equal(relation(p(0,0),p(3,0),p(0,1),p(3,1)),'disjoint');
  assert.equal(relation(p(0,0),p(1,1),p(2,0),p(3,1)),'disjoint');
  assert.equal(relation(p(0,0),p(1,0),p(0.5,-Number.MIN_VALUE),p(0.5,Number.MIN_VALUE)), 'proper-interior-crossing');
});
test('zero orientation explicitly refuses to certify tangency and collinear topology', () => {
  assert.equal(relation(p(0,0),p(1,0),p(1,0),p(1,1)), 'boundary-or-collinear');
  assert.equal(relation(p(0,0),p(2,0),p(1,0),p(3,0)), 'boundary-or-collinear');
  assert.equal(relation(p(0,0),p(1,0),p(3,0),p(4,0)), 'boundary-or-collinear');
});
test('strict invalid/refusal input does not evaluate host accessor', () => {
  assert.deepEqual(classify(p(0,0),p(-0,0),p(0,1),p(1,0)),
    {status:'unsupported',reason:'degenerate-segment'});
  assert.equal(classify(p(NaN,0),p(1,0),p(0,1),p(1,1)).reason,'non-finite-coordinate');
  assert.equal(classify(p(0,0),p(10001,0),p(0,1),p(1,1)).reason,'out-of-range-coordinate');
  let reads=0;
  const host={y:0};Object.defineProperty(host,'x',{enumerable:true,get(){reads++;return 0;}});
  assert.equal(classify(host,p(1,0),p(0,1),p(1,1)).reason,'invalid-input');
  assert.equal(reads,0);
});
