import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSurface } from '@barocss/cad';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { emptyDoc } from '../src/engine/doc';
import { directIGES, directOps, emptyDirect, geometryOf, importSource, type DirectGeometry } from '../src/engine/direct';
import { isRefusal } from '../src/engine/refusal';
import type { TrimLoop } from '../src/engine/trim';

const SOURCE = `@model d337 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[1,1,7,7]; control-points:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]]; weights:[[1,1],[1,1]]; }
 @curve #hole { type:nurbs; degree:1; knots:[0,0,1,2,3,4,4]; control-points:[[15,-1,3],[25,-1,3],[25,9,3],[15,9,3],[15,-1,3]]; weights:[1,1,1,1,1]; }
}`;
const RECTANGLE: [number, number][] = [[-1, 2], [1, 2], [1, 4], [-1, 4]];
const CONCAVE: [number, number][] = [[-1, 2], [2, 2], [2, 3], [0.4, 3], [0.4, 4.6], [-1, 4.6]];
function fixture(keep: TrimLoop['keep'], uv = RECTANGLE): DirectGeometry {
  const d = importSource(emptyDirect(), SOURCE, 'D337');
  d.objects[0].trims = [{ keep, uv: uv.map(p => [...p]) }];
  d.objects[1].hidden = true;
  return d;
}
function freezeDeep(value: unknown): void {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
}
function worldLoop(d: DirectGeometry, index: number): number[][] {
  const o = d.objects[index], s = geometryOf(d, o);
  assert.ok(s.kind === 'surface');
  return o.trims![0].uv.map(([u, v]) => [...evaluateSurface(s, u, v)]);
}
function area(points: readonly (readonly number[])[]): number {
  return Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
}
function inside(points: readonly (readonly number[])[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const p = points[i], q = points[j];
    if ((p[1] > y) !== (q[1] > y) && x < (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]) + p[0]) hit = !hit;
  }
  return hit;
}
function assertWorld(d: DirectGeometry, expected: readonly (readonly number[])[], expectedArea: number): void {
  const actual = worldLoop(d, d.objects.length - 1);
  assert.equal(actual.length, expected.length);
  actual.forEach((p, i) => p.forEach((v, k) => assert.ok(Math.abs(v - expected[i][k]) <= 1e-7, `vertex ${i}, component ${k}: ${v}`)));
  assert.ok(Math.abs(area(actual) - expectedArea) <= 1e-7);
  assert.equal(inside(actual, 20, 4), true);
  assert.equal(inside(actual, 45, 20), false);
}

for (const axis of ['u', 'v'] as const) for (const keep of ['inside', 'outside'] as const) {
  test(`trim Reverse ${axis}/${keep}: nonunit fractional concave loop retains world material and source ownership`, () => {
    const d = fixture(keep, CONCAVE), before = structuredClone(d), source = d.objects[0];
    freezeDeep(d);
    const out = directOps.reverseSurface(d, source.id, axis), made = out.objects.at(-1)!;
    assert.deepEqual(d, before);
    assert.deepEqual(out.objects[0], { ...before.objects[0], hidden: true });
    assert.equal(out.sources[source.source], SOURCE);
    assert.equal(made.name, `${source.name} · ${axis} reversed`);
    assert.notEqual(made.id, source.id);
    assert.notEqual(made.source, source.source);
    assert.notEqual(made.trims, source.trims);
    assert.notEqual(made.trims![0], source.trims![0]);
    assert.notEqual(made.trims![0].uv, source.trims![0].uv);
    assert.equal(made.trims![0].keep, keep);
    made.trims![0].uv.forEach((p, i) => {
      assert.notEqual(p, source.trims![0].uv[i]);
      const selected = axis === 'u' ? 0 : 1, other = 1 - selected;
      assert.ok(Object.is(p[other], CONCAVE[i][other]), 'the other chart coordinate is unchanged');
      assert.ok(Math.abs(p[selected] - ((axis === 'u' ? 4 : 8) - CONCAVE[i][selected])) < 1e-14);
    });
    const expected = CONCAVE.map(([u, v]) => [20 + 5 * u, -11 + 5 * v, 3]);
    assertWorld(out, expected, 131);
    const twice = directOps.reverseSurface(out, made.id, axis);
    assertWorld(twice, expected, 131);
    assert.equal(twice.objects.at(-1)!.trims![0].keep, keep);
    assert.throws(() => directOps.splitSurface(out, made.id, 'u', 2), e => isRefusal(e, 'DIRECT_VALUE'));
    assert.throws(() => directIGES(out), e => isRefusal(e, 'IGES_EXPORT'));
    made.trims![0].uv[0][0] = 0;
    assert.deepEqual(d, before, 'editing the published sidecar cannot mutate the original');
  });

  test(`trim Reverse ${axis}/${keep}: the public 160-point producer remains admitted`, () => {
    const raw = importSource(emptyDirect(), SOURCE, 'public'), panel = raw.objects[0].id;
    const d = directOps.trimByCurve(raw, panel, raw.objects[1].id, keep);
    assert.equal(d.objects[0].trims![0].uv.length, 160);
    const before = structuredClone(d), expected = worldLoop(d, 0);
    freezeDeep(d);
    const out = directOps.reverseSurface(d, panel, axis);
    assertWorld(out, expected, area(expected));
    assert.equal(out.objects.at(-1)!.trims![0].keep, keep);
    assert.deepEqual(d, before);
  });
}

test('trim Reverse: native Save/Open retains accepted UV, source bytes, IDs, flags and names', async () => {
  const d = fixture('inside', CONCAVE), out = directOps.reverseSurface(d, d.objects[0].id, 'u');
  const doc = { ...emptyDoc(), direct: out }, bytes = encodeStudioFile(doc);
  const read = await readStudioFile(bytes);
  assert.ok(!('error' in read), 'error' in read ? read.error : '');
  assert.deepEqual(read.doc.direct, out);
  assert.deepEqual(encodeStudioFile(read.doc), bytes, 'this accepted document reencodes identically');
  const recovered = read.doc.direct!, made = recovered.objects.at(-1)!;
  assert.ok(geometryOf(recovered, made).kind === 'surface');
  assertWorld(recovered, CONCAVE.map(([u, v]) => [20 + 5 * u, -11 + 5 * v, 3]), 131);
  assert.notEqual(recovered.objects[0].trims![0].uv, made.trims![0].uv);
});

test('trim Reverse: unsupported supports and trim profiles refuse atomically; a valid retry works', () => {
  const cases: DirectGeometry[] = [];
  const nonaffine = fixture('outside');
  nonaffine.sources[nonaffine.objects[0].source] = SOURCE.replace('[50,24,3]', '[50,24,4]');
  cases.push(nonaffine);
  const rational = fixture('outside');
  rational.sources[rational.objects[0].source] = SOURCE.replace('weights:[[1,1],[1,1]]', 'weights:[[1,1],[1,2]]');
  cases.push(rational);
  const badLoops: unknown[] = [
    [{ keep: 'outside', uv: RECTANGLE }, { keep: 'outside', uv: RECTANGLE }],
    [{ keep: 'invalid', uv: RECTANGLE }],
    [{ keep: 'outside', uv: [[-1, 2], [1, 2]] }],
    [{ keep: 'outside', uv: [[-1, 2], [1, 4], [-1, 4], [1, 2]] }],
    [{ keep: 'outside', uv: [[-1, 2], [1, 2], [1, 2], [-1, 4]] }],
    [{ keep: 'outside', uv: [[-3, 2], [1, 2], [1, 4]] }],
    [{ keep: 'outside', uv: [[NaN, 2], [1, 2], [1, 4]] }],
    [{ keep: 'outside', uv: Array.from({ length: 161 }, (_, i) => [-1 + Math.cos(i * 2 * Math.PI / 161), 3 + Math.sin(i * 2 * Math.PI / 161)]) }],
  ];
  for (const loops of badLoops) { const d = fixture('outside'); d.objects[0].trims = loops as TrimLoop[]; cases.push(d); }
  for (const d of cases) {
    const before = structuredClone(d);
    freezeDeep(d);
    for (const axis of ['u', 'v'] as const) assert.throws(() => directOps.reverseSurface(d, d.objects[0].id, axis), e => isRefusal(e, 'DIRECT_VALUE'));
    assert.deepEqual(d, before);
  }
  const valid = fixture('outside');
  assert.equal(directOps.reverseSurface(valid, valid.objects[0].id, 'v').objects.length, valid.objects.length + 1);
});

test('trim Reverse: duplicate selected object IDs refuse without changing the document', () => {
  const d = fixture('outside');
  d.objects.push({ ...d.objects[0], name: 'Duplicate selected ID' });
  const before = structuredClone(d);
  freezeDeep(d);
  assert.throws(() => directOps.reverseSurface(d, d.objects[0].id, 'u'), e => isRefusal(e, 'DIRECT_PICK'));
  assert.deepEqual(d, before);
});
