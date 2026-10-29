import test from 'node:test';
import assert from 'node:assert/strict';
import { directIGES, directOps, emptyDirect, geometryOf, importIGESFile, importSource, surfaceIntersection, type DirectGeometry } from '../src/engine/direct';
import { isRefusal } from '../src/engine/refusal';

// Exact authored metadata isolates trim ownership from the public projection producer below.
// S(u,v)=[20+5u,-11+5v,3], u=[-2,6], v=[1,7]. The hole is 10 by 10 mm.
const SOURCE = `@model d336 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[1,1,7,7]; control-points:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]]; weights:[[1,1],[1,1]]; }
 @curve #hole { type:nurbs; degree:1; knots:[0,0,1,2,3,4,4]; control-points:[[15,-1,3],[25,-1,3],[25,9,3],[15,9,3],[15,-1,3]]; weights:[1,1,1,1,1]; }
 @surface #wall { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:[[[20,-8,-2],[20,-8,8]],[[20,26,-2],[20,26,8]]]; weights:[[1,1],[1,1]]; }
}`;
const imported = importSource(emptyDirect(), SOURCE, 'D336');
const panel = imported.objects[0].id, hole = imported.objects[1].id, wall = imported.objects[2].id;
function fixture(keep: 'outside' | 'inside' = 'outside'): DirectGeometry {
  return { ...structuredClone(imported), objects: imported.objects.map(o => o.id === panel
    ? { ...o, trims: [{ keep, uv: [[-1, 2], [1, 2], [1, 4], [-1, 4]] }] }
    : { ...o, hidden: true }) };
}
function freezeDeep(value: unknown): void {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
}
const consumers: { name: string; code: 'DIRECT_VALUE' | 'DIRECT_INTERSECT' | 'IGES_EXPORT'; run: (d: DirectGeometry) => unknown }[] = [
  { name: 'Split surface', code: 'DIRECT_VALUE', run: d => directOps.splitSurface(d, panel, 'u', 2) },
  { name: 'Extract region', code: 'DIRECT_VALUE', run: d => directOps.surfaceRegion(d, panel, [-1, 3], [1.5, 5.5]) },
  { name: 'Extend surface', code: 'DIRECT_VALUE', run: d => directOps.extendSurface(d, panel, 'u-max', 5) },
  { name: 'Intersect surfaces', code: 'DIRECT_INTERSECT', run: d => surfaceIntersection(d, panel, wall) },
  { name: 'Export IGES', code: 'IGES_EXPORT', run: d => directIGES(d) },
];
function assertRefusals(d: DirectGeometry): void {
  const before = structuredClone(d);
  freezeDeep(d);
  for (const c of consumers) {
    assert.throws(() => c.run(d), e => {
      assert.ok(isRefusal(e, c.code), c.name);
      assert.match(e.message, /This operation does not preserve surface trims/);
      assert.ok(e.message.includes(c.name), e.message);
      assert.match(e.message, /Use Untrim first only if you want to remove the trims/);
      return true;
    });
    assert.deepEqual(d, before, `${c.name} must preserve every source and object field`);
  }
}

test('direct trims: five unsupported consumers refuse exact outside and inside loops without state changes', () => {
  assertRefusals(fixture('outside'));
  assertRefusals(fixture('inside'));
});

test('direct trims: malformed non-array containers cannot bypass the consumer guards', () => {
  for (const trims of [null, {}, 'invalid']) {
    const d = fixture();
    d.objects[0].trims = trims as unknown as NonNullable<typeof d.objects[0]['trims']>;
    assertRefusals(d);
    assert.throws(() => directOps.reverseSurface(d, panel, 'u'), e => isRefusal(e, 'DIRECT_VALUE'));
  }
});

test('direct trims: five unsupported consumers refuse the actual public Trim by curve result', () => {
  const projected = directOps.trimByCurve(structuredClone(imported), panel, hole, 'outside');
  assert.equal(projected.objects[0].trims?.[0].uv.length, 160);
  assertRefusals(projected);
});

test('direct trims: intersection checks both selected operands, including hidden sources', () => {
  const d = fixture(), before = structuredClone(d);
  freezeDeep(d);
  assert.throws(() => surfaceIntersection(d, wall, panel), e => isRefusal(e, 'DIRECT_INTERSECT'));
  assert.deepEqual(d, before);
  const second = structuredClone(imported);
  second.objects[2].trims = [{ keep: 'inside', uv: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] }];
  const saved = structuredClone(second);
  freezeDeep(second);
  assert.throws(() => surfaceIntersection(second, panel, wall), e => isRefusal(e, 'DIRECT_INTERSECT'));
  assert.deepEqual(second, saved);
});

test('direct trims: IGES refuses the whole visible set and ignores hidden trimmed surfaces', () => {
  const d = fixture();
  d.objects[1].hidden = false; // An ordinary visible curve must not enable a partial export.
  const before = structuredClone(d);
  assert.throws(() => directIGES(d), e => isRefusal(e, 'IGES_EXPORT'));
  assert.deepEqual(d, before);
  d.objects[0].hidden = true;
  const reread = importIGESFile(emptyDirect(), directIGES(d), 'curve');
  assert.equal(reread.curves, 1);
  assert.equal(reread.surfaces, 0);
});

test('direct trims: empty trims and explicit Untrim retain whole-surface operations and IGES reimport', () => {
  const trimmed = fixture(), before = structuredClone(trimmed);
  const whole = directOps.untrim(trimmed, panel);
  assert.deepEqual(trimmed, before);
  assert.equal(whole.objects[0].trims, undefined);
  const empty = structuredClone(whole);
  empty.objects[0].trims = [];
  for (const d of [whole, empty]) {
    const saved = structuredClone(d);
    freezeDeep(d);
    for (const c of consumers.slice(0, 3)) {
      const result = c.run(d) as DirectGeometry;
      assert.equal(result.objects[0].hidden, true, c.name);
      assert.ok(result.objects.length > d.objects.length, c.name);
    }
    const reversed = directOps.reverseSurface(d, panel, 'u');
    assert.equal(reversed.objects.at(-1)!.trims, undefined);
    assert.ok(surfaceIntersection(d, panel, wall).count > 0);
    const reread = importIGESFile(emptyDirect(), directIGES(d), 'panel');
    assert.equal(reread.surfaces, 1);
    assert.equal(reread.curves, 0);
    const g = geometryOf(reread.direct, reread.direct.objects[0]);
    assert.ok(g.kind === 'surface');
    assert.deepEqual(g.controlPoints, [[[10, -6, 3], [10, 24, 3]], [[50, -6, 3], [50, 24, 3]]]);
    assert.deepEqual(g.knotsU, [-2, -2, 6, 6]);
    assert.deepEqual(g.knotsV, [1, 1, 7, 7]);
    assert.deepEqual(d, saved);
  }
});

test('direct trims: existing pick and Extend value refusals retain precedence', () => {
  const d = fixture();
  assert.throws(() => directOps.reverseSurface(d, 'missing', 'u'), e => isRefusal(e, 'DIRECT_PICK'));
  assert.throws(() => directOps.splitSurface(d, hole, 'u', 2), e => isRefusal(e, 'DIRECT_PICK'));
  assert.throws(() => directOps.surfaceRegion(d, hole, [0, 1], [0, 1]), e => isRefusal(e, 'DIRECT_PICK'));
  assert.throws(() => directOps.extendSurface(d, panel, 'u-max', 0), /Extend by a positive distance/);
  assert.throws(() => surfaceIntersection(d, panel, 'missing'), e => isRefusal(e, 'DIRECT_PICK'));
  assert.throws(() => surfaceIntersection(d, panel, hole), e => isRefusal(e, 'DIRECT_PICK'));
});
