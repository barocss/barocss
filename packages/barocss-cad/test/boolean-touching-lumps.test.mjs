import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, tessellateBrep, checkBrep } from '../dist/index.js';
import { oracle } from '../scripts/rb/fuzz-oracle.mjs';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const leaf = (kind, dims, rot, move) => ({ leaf: { kind, ...dims, rot: rot.map(([axis, deg]) => ({ axis, deg })), move } });
/** Each body of an output: its face-name prefixes (the features its faces come from) and its mesh volume; strict validity; watertight body by body. */
function lumps(o) {
  const b = o.brep, mesh = tessellateBrep(b, { segmentsPerQuarter: 16 }), P = mesh.positionsMM, shellBody = new Map(b.shells.map(s => [s.id, s.body]));
  assert.equal(checkBrep(b, { strict: true }).valid, true, checkBrep(b, { strict: true }).issues[0]);
  return b.bodies.map(body => {
    const faces = new Set(b.faces.filter(f => shellBody.get(f.shell) === body.id).map(f => f.id)), uses = new Map();
    let volume = 0;
    for (const f of mesh.faces) if (faces.has(f.faceId)) for (let t = f.indexOffset; t < f.indexOffset + f.indexCount; t += 3) {
      const [a, c, d] = [0, 1, 2].map(k => mesh.indices[t + k]), p = i => [P[3 * i], P[3 * i + 1], P[3 * i + 2]], [x, y, z] = [p(a), p(c), p(d)];
      volume += (x[0] * (y[1] * z[2] - y[2] * z[1]) - x[1] * (y[0] * z[2] - y[2] * z[0]) + x[2] * (y[0] * z[1] - y[1] * z[0])) / 6;
      for (const [i, j] of [[a, c], [c, d], [d, a]]) { const ka = p(i).join(), kb = p(j).join(), e = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`; uses.set(e, (uses.get(e) ?? 0) + 1); }
    }
    assert.ok([...uses.values()].every(n => n === 2), `${body.id}: watertight`);
    return { id: body.id, from: [...new Set(b.faces.filter(f => faces.has(f.id)).map(f => (f.name ?? '').split('.')[0]))].sort().join(','), volume };
  });
}

test('Booleans: lumps touching along a line are separate bodies, numbered as lumps apart are (D204)', () => {
  // L4 fuzz 50: an open shelled box ∪ a cylinder touching its side along a ruling — refused before. Either way round,
  // the same two bodies; the tool's lump first, as for lumps apart; their volumes sum to the ray oracle's.
  const shell = leaf('hbox', { w: 7, d: 4, h: 4, t: 0.5, open: true }, [['x', 90], ['y', 270]], [0, -2, 1]), can = leaf('cyl', { r: 2, h: 7 }, [], [2, -2, 2]);
  const ways = [{ op: 'union', a: shell, b: can }, { op: 'union', a: can, b: shell }].map(tree => {
    const { document, root } = documentOf(tree), o = evaluateCadPart(document).outputs.find(x => x.id === root);
    assert.equal(o.bodyCount, 2);
    return { tree, o, lumps: lumps(o) };
  });
  // (documentOf numbers the operands n1, n2 in order: the tool is n2 both ways.)
  for (const w of ways) assert.deepEqual(w.lumps.map(l => [l.id, l.from.split(',')[0]]), [['n0_body0', 'n2b'], ['n0_body1', 'n1b']]);
  const by = w => Object.fromEntries(w.lumps.map(l => [l.from.includes('f') ? 'shell' : 'can', l.volume]));
  const [x, y] = ways.map(by);
  for (const k of ['shell', 'can']) assert.ok(Math.abs(x[k] - y[k]) <= 1e-9 * x[k], `${k}: ${x[k]} vs ${y[k]}`);
  const q = oracle(ways[0].tree, 192, 6), V = ways[0].o.massProperties(1).volumeMM3;
  assert.ok(Math.abs(V - q.volumeMM3) <= 3 * q.e + 1e-6, `${V} vs the oracle ${q.volumeMM3} ± ${q.e}`);
});

test('Booleans: upright lumps touching along an edge or at a point are separate bodies, not refused (D204)', () => {
  const box = (id, min, max, z0, h) => [{ id: `${id}s`, kind: 'sketch', profile: 'rectangle', min, max, plane: { origin: [0, 0, z0], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id, kind: 'extrude', sketch: `${id}s`, height: h }];
  const cases = [
    // Two copies of a 5 × 4 × 2 box turned 120° about a corner on the axis: they share that corner's edge. 40 + 40.
    ['pattern corner on the axis', D([...box('b', [0, 0], [5, 4], 0, 2), { id: 'p', kind: 'circular-pattern', target: 'b', axis: 'z', angleDegrees: 120, count: 2, pivot: [0, 0, 0] }]), 'p', 80],
    // A box and a cylinder r 2 tangent to its side along a line (L4 fuzz 92): 2 × 3 × 4 + π · 4 · 8.
    ['cylinder along a side', D([...box('b', [0, -2], [2, 1], -2, 4), { id: 'cs', kind: 'sketch', profile: 'circle', center: [-2, -2], radius: 2, plane: { origin: [0, 0, -5], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'c', kind: 'extrude', sketch: 'cs', height: 8 }, { id: 'u', kind: 'union', target: 'b', tool: 'c' }]), 'u', 24 + 32 * Math.PI],
    // Two boxes meeting at a corner: 10 × 10 × 5 twice.
    ['corner to corner', D([...box('a', [0, 0], [10, 10], 0, 5), ...box('b', [10, 10], [20, 20], 5, 5), { id: 'u', kind: 'union', target: 'a', tool: 'b' }]), 'u', 1000],
  ];
  for (const [name, doc, out, exact] of cases) {
    const o = evaluateCadPart(doc).output(out), l = lumps(o), V = o.massProperties(1).volumeMM3;
    assert.equal(o.bodyCount, 2, name);
    assert.ok(Math.abs(V - exact) <= 1e-9 * exact, `${name}: ${V} vs ${exact}`);
    assert.ok(Math.abs(l[0].volume + l[1].volume - exact) <= 1e-2 * exact, `${name}: mesh ${l[0].volume} + ${l[1].volume}`);
  }
});
