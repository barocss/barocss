import test from 'node:test';
import assert from 'node:assert/strict';
import { cad, brepFromBody, checkBrep, assertValidBrep, buildBrep, lineCurve, BrepError } from '../dist/index.js';

const model = make => { const m = cad.model(); return make(m); };
const bodies = {
  cube: [() => model(m => m.build({ b: m.sketch.rectangle({ width: 20, height: 20 }).extrude(20) })), 'convex-planar', { V: 8, E: 12, F: 6, L: 6, S: 1, G: 0 }],
  hexPrism: [() => model(m => m.build({ b: m.sketch.polygon([[0, 0], [10, 0], [15, 8], [10, 16], [0, 16], [-5, 8]]).extrude(6) })), 'convex-planar', { V: 12, E: 18, F: 8, L: 8, S: 1, G: 0 }],
  holePlate: [() => model(m => m.build({ b: m.sketch.rectangle({ width: 64, height: 32 }).extrude(8).hole({ center: [32, 16], radius: 4 }) })), 'stored-rational-plate-hole', { V: 10, E: 15, F: 7, L: 9, S: 1, G: 1 }],
  cylinder: [() => model(m => m.build({ b: m.sketch.circle({ center: [0, 0], radius: 5 }).extrude(10) })), 'stored-rational-circle-prism', { V: 2, E: 3, F: 3, L: 3, S: 1, G: 0 }],
  lPrism: [() => model(m => m.build({ b: m.sketch.loop([[0, 0], [30, 0], [30, 10], [10, 10], [10, 25], [0, 25]].map(p => ({ kind: 'line', start: p }))).extrude(5) })), 'extruded-profile', { V: 12, E: 18, F: 8, L: 8, S: 1, G: 0 }],
  slot: [() => model(m => m.build({ b: m.sketch.loop([{ kind: 'line', start: [0, -6] }, { kind: 'arc', start: [40, -6], center: [40, 0], direction: 'ccw' }, { kind: 'line', start: [40, 6] }, { kind: 'arc', start: [0, 6], center: [0, 0], direction: 'ccw' }]).extrude(5) })), 'extruded-profile', { V: 8, E: 12, F: 6, L: 6, S: 1, G: 0 }],
  union: [() => model(m => { const a = m.sketch.rectangle({ width: 16, height: 16 }).extrude(16), b = m.sketch.rectangle({ min: [16, 0], max: [32, 8] }).extrude(16); return m.build({ b: a.union(b) }); }), 'orthogonal-cell', { V: 16, E: 28, F: 14, L: 14, S: 1, G: 0 }],
};
const brepOf = name => brepFromBody(bodies[name][0]().bodies.b);

test('every modeling body family converts to one valid B-rep with the right Euler–Poincaré counts', () => {
  for (const [name, [make, family, expected]] of Object.entries(bodies)) {
    const body = make().bodies.b; assert.equal(body.family, family, name);
    const brep = brepFromBody(body), report = assertValidBrep(brep), t = report.topology[0];
    assert.deepEqual({ V: t.vertices, E: t.edges, F: t.faces, L: t.loops, S: t.shells, G: t.genus }, expected, name);
    assert.equal(brep.source.family, family);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(brep)), name);
  }
  // The through-hole plate keeps its trims: 30 coedges, all with pcurves that lie on their edges.
  const plate = brepOf('holePlate');
  assert.equal(plate.coedges.filter(c => c.pcurve).length, 30);
  assert.equal(plate.loops.filter(l => l.kind === 'inner').length, 2);
});

const mutated = (name, mutate) => { const brep = structuredClone(brepOf(name)); mutate(brep); return checkBrep(brep); };
const issueKinds = r => [...new Set(r.issues.map(i => i.split(':')[0]))];

test('the checker catches broken topology, geometry and orientation', () => {
  assert.ok(issueKinds(mutated('cube', b => { b.coedges[0].next = b.coedges[2].id; })).includes('topology'), 'next pointer');
  const open = mutated('cube', b => { const f = b.faces.pop(); b.shells[0].faces = b.shells[0].faces.filter(x => x !== f.id); b.loops = b.loops.filter(l => l.face !== f.id); b.coedges = b.coedges.filter(c => !f.loops.includes(c.loop)); for (const c of b.coedges) if (!b.coedges.some(x => x.id === c.twin)) c.twin = null; });
  assert.ok(open.issues.some(i => /uses in a closed shell/.test(i)), 'open shell');
  assert.ok(issueKinds(mutated('cube', b => { b.vertices[0].point[0] += 1e-3; })).includes('geometry'), 'vertex moved');
  assert.ok(issueKinds(mutated('lPrism', b => { b.faces[0].sense = b.faces[0].sense === 'forward' ? 'reversed' : 'forward'; })).includes('orientation'), 'flipped face');
  assert.ok(issueKinds(mutated('holePlate', b => { const c = b.coedges.find(x => x.pcurve); c.pcurve.controlPoints[0][0] += 0.01; })).includes('geometry'), 'pcurve off');
  assert.ok(issueKinds(mutated('union', b => { b.coedges[3].twin = null; b.coedges[3].sense = 'forward'; })).length > 0, 'twin');
});

// Two unit cubes built straight through buildBrep; `shareCorner` glues them at one vertex.
function cubes(mode) {
  const shareCorner = mode === 'touching';
  const vertices = [], edges = new Map(), faces = (prefix, o) => {
    const id = i => (shareCorner && prefix === 'b' && i === 0) ? 'a6' : prefix + i;
    const p = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map(q => q.map((x, k) => x + o[k]));
    p.forEach((q, i) => { if (!vertices.some(v => v.id === id(i))) vertices.push({ id: id(i), point: q }); });
    const point = vid => vertices.find(v => v.id === vid).point;
    return [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]].map((q, fi) => {
      const [a, b, c, d] = q.map(id);
      const uses = [[a, b], [b, c], [c, d], [d, a]].map(([s, t]) => {
        const lo = s < t ? s : t, hi = s < t ? t : s, key = lo + '-' + hi;
        if (!edges.has(key)) edges.set(key, { id: key, curve: lineCurve(key, point(lo), point(hi)), vertices: [lo, hi] });
        return { edge: key, sense: s === lo ? 'forward' : 'reversed' };
      });
      return { id: prefix + 'f' + fi, surface: { kind: 'surface', id: prefix + 's' + fi, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[point(a), point(d)], [point(b), point(c)]], weights: [[1, 1], [1, 1]] }, sense: 'forward', loops: [{ kind: 'outer', uses }] };
    });
  };
  const all = [...faces('a', [0, 0, 0]), ...faces('b', shareCorner ? [1, 1, 1] : [3, 0, 0])];
  const shells = mode === 'two-shells' ? [{ id: 'sa', faces: all.slice(0, 6), closed: true }, { id: 'sb', faces: all.slice(6), closed: true }] : [{ id: 's', faces: all, closed: true }];
  return buildBrep({ source: { family: 'test', id: 'cubes' }, vertices, edges: [...edges.values()], bodies: [{ id: 'B', kind: 'solid', shells }] });
}

test('the builder links next/prev and twins; shells must be connected and manifold', () => {
  const two = checkBrep(cubes('two-shells'));
  assert.equal(two.valid, true, two.issues.join('\n'));
  assert.deepEqual(two.topology[0], { body: 'B', vertices: 16, edges: 24, faces: 12, loops: 12, shells: 2, genus: 0 });
  const one = checkBrep(cubes('one-shell'));
  assert.ok(one.issues.some(i => /shell B\/s is not connected \(2 components\)/.test(i)), one.issues.join('\n'));
  const touching = checkBrep(cubes('touching'));
  assert.ok(touching.issues.some(i => /vertex a6 is not manifold/.test(i)), touching.issues.join('\n'));
  assert.throws(() => assertValidBrep(cubes('touching')), e => e instanceof BrepError && e.code === 'TOPOLOGY' && e.report.valid === false);
});
