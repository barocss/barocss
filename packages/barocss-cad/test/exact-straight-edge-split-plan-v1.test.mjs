import assert from 'node:assert/strict';
import test from 'node:test';
import { planExactStraightEdgeCrossingSplitV1 as plan } from '../dist/exact-straight-edge-split-plan-v1.js';
const p=(x,y)=>({x,y});
const rat=(numerator,denominator='1')=>({numerator,denominator});
test('exact split plan keeps four parent segments and rational crossing without rounding',()=>{
 const result=plan('edgeA',p(0,0),p(4,4),'edgeB',p(0,4),p(4,0));
 assert.equal(result.status,'exact');
 assert.deepEqual(result.intersectionMM,{x:rat('2'),y:rat('2')});
 assert.deepEqual(result.subedges.map(s=>[s.parentEdgeId,s.startParameter,s.endParameter]),[
  ['edgeA',rat('0'),rat('1','2')],['edgeA',rat('1','2'),rat('1')],
  ['edgeB',rat('0'),rat('1','2')],['edgeB',rat('1','2'),rat('1')]]);
 assert.deepEqual(result.subedges[0].startMM,{x:rat('0'),y:rat('0')});
 assert.deepEqual(result.subedges[0].endMM,result.intersectionMM);
 assert.deepEqual(result.subedges[3].endMM,{x:rat('4'),y:rat('0')});
});
test('represented dyadic endpoints and subnormals are rational, not rounded',()=>{
 const r=plan('edgeA',p(0,0),p(.5,.5),'edgeB',p(0,.5),p(.5,0));
 assert.equal(r.status,'exact');
 assert.deepEqual(r.intersectionMM,{x:rat('1','4'),y:rat('1','4')});
 assert.deepEqual(r.subedges[0].endMM,r.subedges[1].startMM);
 const tiny=plan('edgeA',p(-1,0),p(1,0),'edgeB',p(0,-Number.MIN_VALUE),p(0,Number.MIN_VALUE));
 assert.equal(tiny.status,'exact');
 assert.deepEqual(tiny.intersectionMM,{x:rat('0'),y:rat('0')});
 assert.equal(tiny.subedges[2].startMM.y.numerator,'-1');
});
test('refuses duplicate/hostile IDs and boundary or degenerate segments',()=>{
 assert.deepEqual(plan('edgeA',p(0,0),p(2,2),'edgeA',p(0,2),p(2,0)),{status:'unsupported',reason:'invalid-edge-ids'});
 assert.deepEqual(plan('__proto__',p(0,0),p(2,2),'edgeB',p(0,2),p(2,0)),{status:'unsupported',reason:'invalid-edge-ids'});
 assert.deepEqual(plan('edgeA',p(0,0),p(1,0),'edgeB',p(1,0),p(1,1)),{status:'refused',reason:'not-proper-interior-crossing'});
 assert.deepEqual(plan('edgeA',p(0,0),p(0,0),'edgeB',p(0,1),p(1,0)),{status:'unsupported',reason:'degenerate-segment'});
});

test('reversing original edge orientation retains exact vertex and reverses subedge endpoints',()=>{
 const forward=plan('edgeA',p(0,0),p(4,4),'edgeB',p(0,4),p(4,0));
 const reverse=plan('edgeA',p(4,4),p(0,0),'edgeB',p(0,4),p(4,0));
 assert.equal(forward.status,'exact');
 assert.equal(reverse.status,'exact');
 assert.deepEqual(reverse.intersectionMM,forward.intersectionMM);
 assert.deepEqual(reverse.subedges[0].startMM,forward.subedges[1].endMM);
 assert.deepEqual(reverse.subedges[0].endMM,forward.subedges[1].startMM);
 assert.deepEqual(reverse.subedges[1].startMM,forward.subedges[0].endMM);
 assert.deepEqual(reverse.subedges[1].endMM,forward.subedges[0].startMM);
 assert.deepEqual(reverse.subedges[2],forward.subedges[2]);
 assert.deepEqual(reverse.subedges[3],forward.subedges[3]);
});

test('C8: caller points are read once; a shifting Proxy cannot split one point and report another', () => {
  let reads = 0;
  const target = { x: 0, y: 0 };
  // Descriptors (what admission validates) say x = 0 once, then 5; plain reads always say 5.
  const shifting = new Proxy(target, {
    getOwnPropertyDescriptor(t, key) { const d = Reflect.getOwnPropertyDescriptor(t, key); if (key === 'x') { reads++; return { ...d, value: reads === 1 ? 0 : 5 }; } return d; },
    get(t, key, r) { return key === 'x' ? 5 : Reflect.get(t, key, r); },
  });
  const result = plan('e1', shifting, { x: 10, y: 10 }, 'e2', { x: 0, y: 10 }, { x: 10, y: 0 });
  assert.equal(result.status, 'exact');
  assert.equal(reads, 1);
  // The first subedge starts at the point the crossing was computed from.
  assert.deepEqual(result.subedges[0].startMM.x, { numerator: '0', denominator: '1' });
});
