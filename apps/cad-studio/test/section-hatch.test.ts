// G19.3: the hatch on the cut as lines (WebGL2's caps, the exact section's cut faces on either renderer): the lines in the
// plane's axes as the viewer's cap shader draws them, cut against the triangles on a plane facing the side cut away —
// their spacing, angle and total length against the closed form; the angle by body; the spacing by the scene's size.
import test from 'node:test';
import assert from 'node:assert/strict';
import { capHatchAxes } from '@barocss/gpu/viewer';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { rectanglePart } from '@barocss/cad-model/engine/doc';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { axisPlane, clipMeshPlane, hatchSegments, hatchSpacing, sectionHatch, sectionSplits, axisSection } from '../src/viewport/sectionView';

const box = () => { const r = evaluateDoc(rectanglePart(20, 12, 8), 1); assert.ok(r.ok); return r.bodies[0]; };
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Each segment: its two ends and its length. */
function segments(s: Float32Array) {
  const out: { a: Vec3; b: Vec3; length: number }[] = [];
  for (let i = 0; i < s.length; i += 6) { const a: Vec3 = [s[i], s[i + 1], s[i + 2]], b: Vec3 = [s[i + 3], s[i + 4], s[i + 5]]; out.push({ a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) }); }
  return out;
}
const total = (s: Float32Array) => segments(s).reduce((l, x) => l + x.length, 0);

test('G19.3 the plane\'s hatch axes: an axis plane\'s the next axes in turn, a plane and its flip alike, orthonormal in the plane', () => {
  // (−0 as 0.)
  const axes = (n: number[]) => { const { u, v } = capHatchAxes(n); return { u: u.map(x => x + 0), v: v.map(x => x + 0) }; };
  assert.deepEqual(axes([0, 0, 1]), { u: [1, 0, 0], v: [0, 1, 0] });
  assert.deepEqual(axes([1, 0, 0]), { u: [0, 1, 0], v: [0, 0, 1] });
  assert.deepEqual(axes([0, 1, 0]), { u: [0, 0, 1], v: [1, 0, 0] });
  assert.deepEqual(axes([0, -1, 0]), { u: [0, 0, 1], v: [1, 0, 0] });
  for (const n of [[0.3, 0.9, -0.3], [-0.6, 0.2, 0.77], [0.577, 0.577, 0.577]]) {
    const l = Math.hypot(...n), q = n.map(x => x / l), { u, v } = capHatchAxes(q), f = capHatchAxes(q.map(x => -x));
    for (const w of [u, v]) { assert.ok(Math.abs(Math.hypot(...w) - 1) < 1e-12); assert.ok(Math.abs(dot(w, q)) < 1e-12); }
    assert.ok(Math.abs(dot(u, v)) < 1e-12);
    assert.ok(u.every((x, k) => Math.abs(x - f.u[k]) < 1e-12) && v.every((x, k) => Math.abs(x - f.v[k]) < 1e-12), 'flipped alike');
  }
});

test('G19.3 hatch segments on a clipped cap: at the angle and spacing, on the plane, within the cap, the length the closed form gives', () => {
  const m = box().mesh, p = axisPlane('y', 5, 'positive'), c = clipMeshPlane(m, p, 'cap')!;
  // (y ≥ 5: the cap 20 × 8 on y = 5; its axes u = z, v = x. At 0° the lines run along z, 2 apart across x: x = 2 … 20.)
  const s = hatchSegments(c, [p], 0, 2), segs = segments(s);
  assert.ok(Math.abs(total(s) - 80) < 1e-4, `${total(s)}`);
  for (const { a, b } of segs) {
    for (const q of [a, b]) { assert.ok(Math.abs(q[1] - 5) < 1e-5); assert.ok(q[0] > -1e-5 && q[0] < 20 + 1e-5 && q[2] > -1e-5 && q[2] < 8 + 1e-5); assert.ok(Math.abs(q[0] / 2 - Math.round(q[0] / 2)) < 1e-5, `x ${q[0]}`); }
    assert.ok(Math.abs(a[0] - b[0]) < 1e-5, 'along z');
  }
  // At 45°: lines along (u + v)/√2 = (x + z)/√2, the area over the spacing within a line's length.
  const d = hatchSegments(c, [p], 45, 1), dl = total(d);
  assert.ok(Math.abs(dl - 160) < 8 * Math.SQRT2, `${dl}`);
  for (const { a, b, length } of segments(d)) {
    if (length < 1e-6) continue;
    const t = [(b[0] - a[0]) / length, (b[1] - a[1]) / length, (b[2] - a[2]) / length];
    assert.ok(Math.abs(Math.abs(dot(t, [Math.SQRT1_2, 0, Math.SQRT1_2])) - 1) < 1e-4, `direction ${t}`);
    // (Through the origin: (x − z)/√2 a whole number of spacings; across = cos·v − sin·u = (x − z)/√2.)
    const h = (a[0] - a[2]) * Math.SQRT1_2; assert.ok(Math.abs(h - Math.round(h)) < 1e-4);
  }
  // Nothing on the body's own faces (none on a section plane facing away), nothing for a plane that cuts nothing.
  assert.equal(hatchSegments(m, [p], 45, 1).length, 0);
  // An oblique plane: every end on it, a whole number of spacings across.
  const SQ = Math.SQRT1_2, o = { normal: [SQ, SQ, 0] as Vec3, offset: 16 * SQ }, oc = clipMeshPlane(m, o, 'cap')!, os = hatchSegments(oc, [o], 30, 0.5);
  const { u, v } = capHatchAxes(o.normal), across = u.map((x, k) => Math.cos(Math.PI / 6) * v[k] - Math.sin(Math.PI / 6) * x);
  assert.ok(Math.abs(total(os) - 12 * Math.SQRT2 * 8 / 0.5) < 12 * Math.SQRT2, `${total(os)}`);
  for (const { a } of segments(os)) { assert.ok(Math.abs(dot(o.normal, a) - o.offset) < 1e-4); const h = dot(a, across) / 0.5; assert.ok(Math.abs(h - Math.round(h)) < 1e-3); }
});

test('G19.3 the exact section\'s cut face hatched as the clipped cap; each body at its angle in turn; the spacing by the scene\'s size', () => {
  const doc = rectanglePart(20, 12, 8), r = evaluateDoc(doc, 1); assert.ok(r.ok);
  const s = axisSection({ axis: 'y', at: 5, keep: 'positive' }), split = sectionSplits(doc, r.bodies, s), e = evaluateDoc(split.doc, 1); assert.ok(e.ok);
  const kept = e.bodies.filter(b => split.kept.includes(b.key));
  assert.equal(kept.length, 1);
  assert.ok(Math.abs(total(hatchSegments(kept[0].mesh, s.planes, 0, 2)) - 80) < 1e-3);
  // Two bodies: 45° and 135°.
  const c = clipMeshPlane(box().mesh, s.planes[0], 'cap')!, both = sectionHatch([{ ...kept[0], mesh: c }, { ...kept[0], mesh: c }], s.planes, 1);
  assert.deepEqual(both.map(h => h.body), [0, 1]);
  const dir = (f: Float32Array) => { const [x] = segments(f).filter(q => q.length > 1); return [(x.b[0] - x.a[0]) / x.length, (x.b[2] - x.a[2]) / x.length]; };
  const [d0, d1] = [dir(both[0].segments), dir(both[1].segments)];
  // (u = z, v = x: 45° along (x + z)/√2, 135° along (x − z)/√2 — as (x, z).)
  assert.ok(Math.abs(Math.abs(d0[0] * SQ2 + d0[1] * SQ2) - 1) < 1e-4, `${d0}`);
  assert.ok(Math.abs(Math.abs(d1[0] * SQ2 - d1[1] * SQ2) - 1) < 1e-4, `${d1}`);
  assert.equal(hatchSpacing({ min: [0, 0, 0], max: [20, 12, 8] }), 0.5);
  assert.equal(hatchSpacing({ min: [0, 0, 0], max: [100, 100, 100] }), 2);
  assert.equal(hatchSpacing({ min: [0, 0, 0], max: [600, 0, 0] }), 10);
  assert.equal(hatchSpacing(null), 0.5);
});
const SQ2 = Math.SQRT1_2;
