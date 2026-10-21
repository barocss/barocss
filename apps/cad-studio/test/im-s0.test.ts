import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSurfaceD1, surfaceDomain, faceGeometry, rayHit, triangleBvh, type Brep } from '@barocss/cad';
import { evaluatePart, partBreps, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { wallThickness } from '@barocss/cad-model/chat/analysis';

// IM S0 (O76): what the injection-moulding track can measure today, exactly, without a kernel-core change — each probe
// against a closed form or a constructed case. The kernel's B-rep faces are NURBS (an exact cone, cylinder, torus …);
// their exact normal at a display-mesh vertex comes from projecting the vertex onto the surface (Newton on
// evaluateSurfaceD2) — the parameterised tessellation is not exported. Visibility along ±d by rays through the studio's
// own triangle BVH (AM4, print/orient.ts); walls by the studio's ray thickness. The findings are in O76.

type V = [number, number, number];
const sub = (a: readonly number[], b: readonly number[]): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: readonly number[], b: readonly number[]): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: readonly number[]): V => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
type Surf = Parameters<typeof evaluateSurfaceD1>[0];

/** A point's foot on a NURBS surface: (u, v) from a grid, then Gauss–Newton on the distance; its outward unit normal. */
/** The first derivatives at (u, v); at an exact C0 knot (a circle's quadrant joins, G1 in space) just off it, inside. */
function d1(s: Surf, u: number, v: number, D: { u: [number, number]; v: [number, number] }) {
  try { return evaluateSurfaceD1(s, u, v); } catch { /* on a knot */ }
  for (const [eu, ev] of [[1e-11, 0], [-1e-11, 0], [0, 1e-11], [0, -1e-11], [1e-11, 1e-11], [-1e-11, -1e-11], [1e-11, -1e-11], [-1e-11, 1e-11]]) {
    const uu = Math.min(D.u[1], Math.max(D.u[0], u + eu * (D.u[1] - D.u[0]))), vv = Math.min(D.v[1], Math.max(D.v[0], v + ev * (D.v[1] - D.v[0])));
    try { return evaluateSurfaceD1(s, uu, vv); } catch { /* the next */ }
  }
  throw new Error(`no derivative near (${u}, ${v})`);
}
function footOn(s: Surf, sense: 'forward' | 'reversed', p: readonly number[]): { uv: [number, number]; gap: number; n: V } {
  const D = surfaceDomain(s);
  let best: [number, number] = [D.u[0], D.v[0]], bd = Infinity;
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) {
    const u = D.u[0] + (D.u[1] - D.u[0]) * i / 24, v = D.v[0] + (D.v[1] - D.v[0]) * j / 24, q = d1(s, u, v, D).point, d = Math.hypot(...sub(q, p));
    if (d < bd) { bd = d; best = [u, v]; }
  }
  let [u, v] = best;
  for (let it = 0; it < 30; it++) {
    const e = d1(s, u, v, D), r = sub(e.point, p);
    // (Gauss–Newton on |r|²/2: [Su·Su, Su·Sv; Su·Sv, Sv·Sv] Δ = −[r·Su, r·Sv] — first derivatives only, so a C1 knot is fine.)
    const a = dot(e.du, e.du), b = dot(e.du, e.dv), c = dot(e.dv, e.dv), gu = dot(r, e.du), gv = dot(r, e.dv), det = a * c - b * b;
    if (!(Math.abs(det) > 1e-300)) break;
    const du = -(c * gu - b * gv) / det, dv = -(a * gv - b * gu) / det;
    u = Math.min(D.u[1], Math.max(D.u[0], u + du)); v = Math.min(D.v[1], Math.max(D.v[0], v + dv));
    if (Math.abs(du) + Math.abs(dv) < 1e-15) break;
  }
  const e = d1(s, u, v, D), n = unit(cross(e.du, e.dv));
  return { uv: [u, v], gap: Math.hypot(...sub(e.point, p)), n: sense === 'forward' ? n : [-n[0], -n[1], -n[2]] };
}
/**
 * The draft (degrees) at each vertex of a display face, from the exact surface: asin(n·d), 0 a vertical wall. The display
 * mesh joins the pieces of one face (x#1, x#2) into one: each vertex is projected onto every piece, the nearest kept.
 */
function drafts(brep: Brep, body: BodyResult, name: string, d: V): { deg: number[]; gap: number; meshDeg: number[] } {
  const pieces = brep.faces.filter(x => (x.name ?? x.id).replace(/#\d+$/, '') === name), mine = new Set(body.mesh.faces.filter(x => x.name === name).map(x => x.index)), m = body.mesh, deg: number[] = [], meshDeg: number[] = [];
  assert.ok(pieces.length && mine.size, `no face ${name}`);
  let gap = 0;
  for (let i = 0; i < m.faceOfVertex.length; i++) if (mine.has(m.faceOfVertex[i])) {
    const p = [m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2]];
    const r = pieces.map(f => footOn(f.surface as Surf, f.sense, p)).sort((x, y) => x.gap - y.gap)[0];
    gap = Math.max(gap, r.gap); deg.push(Math.asin(dot(r.n, d)) * 180 / Math.PI);
    meshDeg.push(Math.asin(dot(unit([m.normals[3 * i], m.normals[3 * i + 1], m.normals[3 * i + 2]]), d)) * 180 / Math.PI);
  }
  return { deg, gap, meshDeg };
}
const ev = (doc: StudioDoc) => { const r = evaluatePart(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return { bodies: r.bodies, breps: partBreps(doc) }; };

test('IM S0 P1: a drafted cylinder (a cone, 3°) — the exact normal at every mesh vertex gives its draft to 1e-9; the mesh normal is off by up to its chord', () => {
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 20 });
  doc = withNode(doc, { kind: 'extrude', sketch: 0, height: 30, draft: 3 });
  const { bodies, breps } = ev(doc), brep = breps[0].brep, body = bodies[0];
  const side = brep.faces.filter(f => faceGeometry(f).kind === 'other');
  assert.ok(side.length >= 1, 'the cone is a general face to faceGeometry');
  let worst = 0, meshWorst = 0, gap = 0, n = 0;
  for (const name of new Set(side.map(f => (f.name ?? f.id).replace(/#\d+$/, '')))) {
    // (Drafted "into the material away from the sketch plane": the side leans in, its outward normal tilted up by 3°.)
    const r = drafts(brep, body, name, [0, 0, 1]);
    for (const a of r.deg) { worst = Math.max(worst, Math.abs(a - 3)); n++; }
    for (const a of r.meshDeg) meshWorst = Math.max(meshWorst, Math.abs(a - 3));
    gap = Math.max(gap, r.gap);
  }
  assert.ok(n > 20 && worst <= 1e-9, `${n} vertices, worst ${worst}°`);
  assert.ok(gap <= 1e-5, `the mesh vertices lie on the surface to its single precision: ${gap}`);
  console.log(`P1: ${n} vertices, exact draft 3° to ${worst.toExponential(2)}°, the display normal off by ${meshWorst.toFixed(4)}°, vertices ${gap.toExponential(2)} mm off the surface`);
});

test('IM S0 P2: a cylinder lying across the pull — the exact cylinder (faceGeometry) and n·d = cos φ: it straddles, steep at its two isoclines', () => {
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } } as never);
  doc = withNode(doc, { kind: 'extrude', sketch: 0, height: 40 });
  const { bodies, breps } = ev(doc), brep = breps[0].brep, body = bodies[0];
  const cyl = brep.faces.find(f => faceGeometry(f).kind === 'cylinder')!, g = faceGeometry(cyl) as { kind: 'cylinder'; c: V; a: V; r: number };
  assert.ok(Math.abs(Math.abs(g.a[0]) - 1) <= 1e-12 && Math.abs(g.r - 10) <= 1e-12);
  // (Every vertex: the exact normal the radial direction from the axis, so n·d its z over r — both signs on one face.)
  const base = (cyl.name ?? cyl.id).replace(/#\d+$/, ''), r = drafts(brep, body, base, [0, 0, 1]), m = body.mesh, mine = new Set(m.faces.filter(x => x.name === base).map(x => x.index));
  let k = 0, worst = 0;
  for (let i = 0; i < m.faceOfVertex.length; i++) if (mine.has(m.faceOfVertex[i])) { worst = Math.max(worst, Math.abs(Math.sin(r.deg[k] * Math.PI / 180) - m.positions[3 * i + 2] / 10)); k++; }
  assert.ok(worst <= 1e-6, `n·d against z/r: ${worst} (the vertex itself single precision)`);
  assert.ok(Math.min(...r.deg) < -89 && Math.max(...r.deg) > 89, 'it straddles: both sides of the isocline n·d = 0');
});

test('IM S0 P3: undercuts by ±d visibility — a side hole across the pull is hidden from both +z and −z; a hole along it is seen', async () => {
  const { dispatchTool } = await import('@barocss/cad-model/chat/tools');
  const evaluate = async (d: StudioDoc) => evaluatePart(d, 1);
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as Parameters<typeof dispatchTool>[0];
  for (const [tool, args] of [['run_command', { command: 'box', values: { w: 40, d: 30, h: 20, x: 0, y: 0, z: 0 } }], ['run_command', { command: 'hole', values: { d: 6, x: 6, y: 6 }, faces: ['n1.top'] }],
    ['run_command', { command: 'hole', values: { d: 6, x: 20, y: 10 }, faces: [{ normal: [0, -1, 0], pick: 'max' }] }]] as [string, Record<string, unknown>][]) {
    const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, r.content); s = r.state;
  }
  const body = s.bodies[0], bvh = triangleBvh(body.mesh.positions, body.mesh.indices), m = body.mesh;
  // (Each triangle's centre moved 0.01 mm off it along its own normal, into the open side, then a ray along d: a vertex on a
  // face's rim lies on the next face too, and its ray grazes it.)
  const seen = (face: number, d: V) => {
    let any = 0, all = 0;
    for (let t = 0; t < m.indices.length; t += 3) {
      if (m.faceOfVertex[m.indices[t]] !== face) continue;
      const P = [0, 1, 2].map(j => [0, 1, 2].map(k => m.positions[3 * m.indices[t + j] + k])), n = unit(cross(sub(P[1], P[0]), sub(P[2], P[0])));
      const c = [0, 1, 2].map(k => (P[0][k] + P[1][k] + P[2][k]) / 3 + 0.01 * n[k]);
      all++; if (rayHit(bvh, c, d) === Infinity) any++;
    }
    return { any, all };
  };
  const cyls = m.faces.filter(f => f.exact?.kind === 'cylinder');
  const axisOf = (f: (typeof cyls)[number]) => (f.exact as { a: V }).a, along = cyls.filter(f => Math.abs(Math.abs(axisOf(f)[2]) - 1) < 1e-9), across = cyls.filter(f => Math.abs(Math.abs(axisOf(f)[1]) - 1) < 1e-9);
  assert.ok(along.length && across.length, cyls.map(f => f.name).join(' '));
  const sum = (fs: typeof cyls, d: V) => fs.map(f => seen(f.index, d)).reduce((x, y) => ({ any: x.any + y.any, all: x.all + y.all }), { any: 0, all: 0 });
  const a = [sum(along, [0, 0, 1]), sum(along, [0, 0, -1])], b = [sum(across, [0, 0, 1]), sum(across, [0, 0, -1])];
  console.log(`P3: the vertical hole's triangles clear +z ${a[0].any}/${a[0].all}, −z ${a[1].any}/${a[1].all}; the side hole's +z ${b[0].any}/${b[0].all}, −z ${b[1].any}/${b[1].all}`);
  // (A vertex on a hole's wall sees out along the hole only if its ray runs inside the bore: the vertical one's do.)
  assert.ok(a[0].any === a[0].all && a[1].any === a[1].all, 'the vertical hole: seen from both ends');
  assert.ok(b[0].any === 0 && b[1].any === 0, 'the side hole: hidden from both — an undercut');
});

test('IM S0 P4: a shelled box, wall t — the studio\'s ray thickness gives t to the mesh\'s single precision', () => {
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] });
  doc = withNode(doc, { kind: 'extrude', sketch: 0, height: 25 });
  doc = withNode(doc, { kind: 'shell', parent: { node: 1, side: 'solid' }, thickness: 1.8, open: ['n1.top'] });
  const { bodies } = ev(doc), w = wallThickness(bodies[0]) as { thinnest_mm: number };
  console.log('P4:', JSON.stringify(w).slice(0, 300));
  assert.ok(Math.abs(w.thinnest_mm - 1.8) <= 1e-4, String(w.thinnest_mm));
});
