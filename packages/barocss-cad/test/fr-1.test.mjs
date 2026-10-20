import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateCadPart, faceGeometry, loadCadLibrary, instantiateLibraryPart } from '../dist/index.js';

// FR1 (D123): structural sections and a straight member. Oracles, none of them the section module's: each kind's area by
// the textbook decomposition written here (rectangles, quarter-disk spandrels, slots, bores); its centroid by Green's
// theorem over the section's loop (lines and arcs integrated exactly here); the T-slot section against the tslot-20
// library part built by its own 3D Booleans; the member's placement by its B-rep's box and faces. Section sizes are test
// values (no catalogue).
const D = (features, parameters = {}) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters, features });
const run = (features, parameters) => evaluateCadPart(D(features, parameters));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol * Math.max(1, Math.abs(want)), `${what}: ${got} vs ${want} (${Math.abs(got - want)})`);
const SP = 1 - Math.PI / 4;
const member = (section, start, end, more = {}) => ({ id: 'm', kind: 'frame-member', section, start, end, ...more });

// ---- the oracles' areas --------------------------------------------------------------------------------------------------
const rectTubeArea = (b, h, t, ro, ri = Math.max(0, ro - t)) => b * h - (4 - Math.PI) * ro * ro - ((b - 2 * t) * (h - 2 * t) - (4 - Math.PI) * ri * ri);
const roundTubeArea = (d, t) => Math.PI / 4 * (d * d - (d - 2 * t) * (d - 2 * t));
const angleArea = (a, b, t, r1, r2) => t * (a + b - t) + SP * (r1 * r1 - 2 * r2 * r2);
const channelArea = (h, b, tw, tf, r) => h * tw + 2 * (b - tw) * tf + 2 * SP * r * r;
/** A 20-class slot: the opening wo × ds and two 45° wings (each (wu − wo)²/8). */
const tslotArea = (a, cells, slots, wo, wu, ds, bore) => cells * a * a - slots * (wo * ds + (wu - wo) * (wu - wo) / 4) - cells * Math.PI * bore * bore / 4;

/**
 * Green's theorem over a loop of lines and arcs (each segment to the next start), one 1-form each for every segment:
 * A = ∮(x dy − y dx)/2, ∫∫x dA = ∮x²/2 dy, ∫∫y dA = ∮−y²/2 dx — in closed form on lines and on arcs (x = cx + r cos θ,
 * y = cy + r sin θ).
 */
function green(loop) {
  let A = 0, Mx = 0, My = 0;
  for (let i = 0; i < loop.length; i++) {
    const s = loop[i], e = loop[(i + 1) % loop.length].start;
    if (s.kind === 'line') {
      const [x0, y0] = s.start, [x1, y1] = e;
      A += (x0 * y1 - x1 * y0) / 2;
      Mx += (y1 - y0) * (x0 * x0 + x0 * x1 + x1 * x1) / 6; My -= (x1 - x0) * (y0 * y0 + y0 * y1 + y1 * y1) / 6;
      continue;
    }
    const [cx, cy] = s.center, r = Math.hypot(s.start[0] - cx, s.start[1] - cy), a0 = Math.atan2(s.start[1] - cy, s.start[0] - cx);
    let sw = loop.length === 1 ? 2 * Math.PI : Math.atan2(e[1] - cy, e[0] - cx) - a0;
    if (loop.length > 1) { if (s.direction === 'ccw' && sw <= 0) sw += 2 * Math.PI; if (s.direction === 'cw' && sw >= 0) sw -= 2 * Math.PI; }
    const a1 = a0 + sw;
    const fA = t => (cx * r * Math.sin(t) - cy * r * Math.cos(t) + r * r * t) / 2;
    const fx = t => (cx * cx * r * Math.sin(t) + 2 * cx * r * r * (t / 2 + Math.sin(2 * t) / 4) + r ** 3 * (Math.sin(t) - Math.sin(t) ** 3 / 3)) / 2;
    const fy = t => (-cy * cy * r * Math.cos(t) + 2 * cy * r * r * (t / 2 - Math.sin(2 * t) / 4) + r ** 3 * (-Math.cos(t) + Math.cos(t) ** 3 / 3)) / 2;
    A += fA(a1) - fA(a0); Mx += fx(a1) - fx(a0); My += fy(a1) - fy(a0);
  }
  return { A, Mx, My };
}
/** A section's area and centroid by Green over its loops (holes subtracted, whatever their winding). */
function greenSection(outer, holes = []) {
  const o = green(outer), sg = Math.sign(o.A);
  let A = sg * o.A, Mx = sg * o.Mx, My = sg * o.My;
  for (const h of holes) { const g = green(h), s = Math.sign(g.A); A -= s * g.A; Mx -= s * g.Mx; My -= s * g.My; }
  return { A, c: [Mx / A, My / A] };
}

// ---- the sections as test loops (written here, not taken from the module) ------------------------------------------------
function roundedRect(hx, hy, r) {
  if (r === 0) return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(start => ({ kind: 'line', start }));
  return [
    { kind: 'line', start: [-hx + r, -hy] }, { kind: 'arc', start: [hx - r, -hy], center: [hx - r, -hy + r], direction: 'ccw' },
    { kind: 'line', start: [hx, -hy + r] }, { kind: 'arc', start: [hx, hy - r], center: [hx - r, hy - r], direction: 'ccw' },
    { kind: 'line', start: [hx - r, hy] }, { kind: 'arc', start: [-hx + r, hy], center: [-hx + r, hy - r], direction: 'ccw' },
    { kind: 'line', start: [-hx, hy - r] }, { kind: 'arc', start: [-hx, -hy + r], center: [-hx + r, -hy + r], direction: 'ccw' },
  ];
}
const angleLoop = (a, b, t, r1, r2) => [
  { kind: 'line', start: [0, 0] }, { kind: 'line', start: [a, 0] }, { kind: 'arc', start: [a, t - r2], center: [a - r2, t - r2], direction: 'ccw' },
  { kind: 'line', start: [a - r2, t] }, { kind: 'arc', start: [t + r1, t], center: [t + r1, t + r1], direction: 'cw' },
  { kind: 'line', start: [t, t + r1] }, { kind: 'arc', start: [t, b - r2], center: [t - r2, b - r2], direction: 'ccw' },
  { kind: 'line', start: [t - r2, b] }, { kind: 'line', start: [0, b] },
];
const channelLoop = (h, b, tw, tf, r) => [
  { kind: 'line', start: [0, 0] }, { kind: 'line', start: [b, 0] }, { kind: 'line', start: [b, tf] },
  { kind: 'arc', start: [tw + r, tf], center: [tw + r, tf + r], direction: 'cw' }, { kind: 'line', start: [tw, tf + r] },
  { kind: 'arc', start: [tw, h - tf - r], center: [tw + r, h - tf - r], direction: 'cw' }, { kind: 'line', start: [tw + r, h - tf] },
  { kind: 'line', start: [b, h - tf] }, { kind: 'line', start: [b, h] }, { kind: 'line', start: [0, h] },
];

const SLOT = { opening: 6.2, lip: 1.8, undercut: 11, depth: 6.1, bore: 4.2 };
const CASES = [
  ['rect-tube 40×40×3 ro 6', { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 6 }, rectTubeArea(40, 40, 3, 6), greenSection(roundedRect(20, 20, 6), [roundedRect(17, 17, 3)]).c],
  ['rect-tube 60×30×2.5 ro 0', { kind: 'rect-tube', width: 60, height: 30, wall: 2.5, outerRadius: 0 }, rectTubeArea(60, 30, 2.5, 0), [0, 0]],
  ['rect-tube 50×30×4 ro 2 ri 1', { kind: 'rect-tube', width: 50, height: 30, wall: 4, outerRadius: 2, innerRadius: 1 }, rectTubeArea(50, 30, 4, 2, 1), greenSection(roundedRect(25, 15, 2), [roundedRect(21, 11, 1)]).c],
  ['round-tube 33.7×2.6', { kind: 'round-tube', diameter: 33.7, wall: 2.6 }, roundTubeArea(33.7, 2.6), [0, 0]],
  ['angle 50×30×5 r1 6 r2 3', { kind: 'angle', legX: 50, legY: 30, thickness: 5, rootRadius: 6, toeRadius: 3 }, angleArea(50, 30, 5, 6, 3), greenSection(angleLoop(50, 30, 5, 6, 3)).c],
  ['angle 40×40×4 sharp', { kind: 'angle', legX: 40, legY: 40, thickness: 4, rootRadius: 0, toeRadius: 0 }, angleArea(40, 40, 4, 0, 0), greenSection(angleLoop(40, 40, 4, 0, 0)).c],
  ['channel 80×40×5/8 r 7', { kind: 'channel', height: 80, width: 40, web: 5, flange: 8, rootRadius: 7 }, channelArea(80, 40, 5, 8, 7), greenSection(channelLoop(80, 40, 5, 8, 7)).c],
  ['tslot 20, 4 slots', { kind: 'tslot', size: 20, cells: 1, openSlots: 4, ...SLOT }, tslotArea(20, 1, 4, 6.2, 11, 6.1, 4.2), [0, 0]],
  ['tslot 20×40', { kind: 'tslot', size: 20, cells: 2, ...SLOT }, tslotArea(20, 2, 6, 6.2, 11, 6.1, 4.2), [10, 0]],
];

test('FR1 sections: each kind along an oblique 3D line — V = A·L by the textbook area (1e-12), its exact mass, valid, one body; the report\'s area and centroid by Green\'s theorem', () => {
  const p0 = [10, -20, 5], p1 = [310, 140, 205], L = Math.hypot(...sub(p1, p0));
  for (const [name, section, A, c] of CASES) {
    const o = run([member(section, p0, p1)]).output('m'), mp = o.massProperties(7850);
    near(mp.volumeMM3, A * L, 1e-12, `${name} volume`); near(o.member.areaMM2, A, 1e-12, `${name} area`);
    assert.equal(mp.method, 'closed-form', name); assert.equal(o.bodyCount, 1, name); assert.ok(o.validate().valid, name);
    near(o.member.centroid[0], c[0], 1e-12, `${name} centroid x`); near(o.member.centroid[1], c[1], 1e-12, `${name} centroid y`);
    // Anchored at its centroid (the default): the body's centre of mass is the line's midpoint.
    mp.centroidMM.forEach((x, k) => near(x, (p0[k] + p1[k]) / 2, 1e-12, `${name} centre of mass`));
    near(o.member.lengthMM, L, 1e-15, name);
  }
});

test('FR1 the T-slot section against the tslot-20 library part (its own 3D Booleans): the same volume at the same length, 20×20 with 1–4 slots and 20×40', () => {
  const lib = loadCadLibrary(JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../apps/cad-studio/src/library/builtin/tslot-20.json'), 'utf8')));
  for (const [cells, open] of [[1, 1], [1, 2], [1, 3], [1, 4], [2, 6]]) {
    const inst = instantiateLibraryPart(lib, 'profile', { params: { cells, openSlots: Math.min(open, 4), L: 250 } });
    const want = evaluateCadPart(D(inst.features)).outputs.filter(o => inst.outputs.includes(o.feature)).reduce((s, o) => s + o.massProperties(1).volumeMM3, 0);
    const m = run([member({ kind: 'tslot', size: 20, cells, ...(cells === 1 ? { openSlots: open } : {}), ...SLOT }, [0, 0, 0], [0, 0, 250], { anchor: 'origin' })]).output('m');
    near(m.massProperties(1).volumeMM3, want, 1e-12, `cells ${cells}, ${open} slots`);
    near(m.member.areaMM2 * 250, want, 1e-12, `cells ${cells}, ${open} slots, area`);
  }
});

test('FR1 placement: the anchor\'s point on the line, the section moved by the offset; the section\'s y follows up made square to the line; roll turns it; a line along up falls back to +X (reported)', () => {
  const s = { kind: 'rect-tube', width: 60, height: 30, wall: 3, outerRadius: 0 };
  // Along +X, up +Z: the section's y is +Z and its x is y × u = +Y. Anchored top-right on the line: the body below and behind it.
  const bounds = o => { const v = o.brep.vertices.map(x => x.point); return [0, 1, 2].map(k => [Math.min(...v.map(p => p[k])), Math.max(...v.map(p => p[k]))]); };
  let o = run([member(s, [0, 0, 0], [500, 0, 0], { anchor: 'top-right' })]).output('m');
  assert.deepEqual(bounds(o), [[0, 500], [-60, 0], [-30, 0]]);
  assert.deepEqual([o.member.xAxis, o.member.yAxis, o.member.axis], [[0, 1, 0], [0, 0, 1], [1, 0, 0]]);
  // Bottom-left, moved by (5, −2): the box corner at (5, −2) from the line (the section's x is +Y, its y +Z).
  o = run([member(s, [0, 0, 0], [500, 0, 0], { anchor: 'bottom-left', offset: [5, -2] })]).output('m');
  assert.deepEqual(bounds(o), [[0, 500], [5, 65], [-2, 28]]);
  // Roll 90°: x turns to +Z, y to −Y (exact for quarter turns).
  o = run([member(s, [0, 0, 0], [500, 0, 0], { roll: 90 })]).output('m');
  assert.deepEqual(bounds(o), [[0, 500], [-15, 15], [-30, 30]]); assert.deepEqual(o.member.xAxis, [0, 0, 1]);
  // Roll 30°: the wide sides' normals are ±y of the report, which is turned 30° from +Z about +X.
  o = run([member(s, [0, 0, 0], [500, 0, 0], { roll: 30 })]).output('m');
  near(o.member.yAxis[2], Math.cos(Math.PI / 6), 1e-15, 'roll 30 y·z'); near(o.member.yAxis[1], -Math.sin(Math.PI / 6), 1e-15, 'roll 30 y·y');
  const wide = o.brep.faces.filter(f => f.name === 'm.top' || f.name === 'm.bottom').map(f => faceGeometry(f).n);
  for (const n of wide) near(Math.abs(dot(n, o.member.yAxis)), 1, 1e-15, 'wide side normal');
  // A vertical member: up is along it, so +X gives the section's y (x = y × u = −Y); the report says so.
  o = run([member(s, [0, 0, 0], [0, 0, 300])]).output('m');
  assert.deepEqual(o.member.upFallback, [1, 0, 0]); assert.deepEqual(o.member.yAxis, [1, 0, 0]); assert.deepEqual(o.member.xAxis, [0, -1, 0]);
  assert.equal(o.representation, 'upright');
  // The centroidal line: through the centroid, parallel to the member (an angle anchored at its heel).
  const ang = { kind: 'angle', legX: 50, legY: 30, thickness: 5, rootRadius: 6, toeRadius: 3 }, c = greenSection(angleLoop(50, 30, 5, 6, 3)).c;
  o = run([member(ang, [0, 0, 0], [0, 400, 0], { anchor: 'origin' })]).output('m');
  const x = o.member.xAxis, y = o.member.yAxis;
  [0, 1, 2].forEach(k => near(o.member.centroidLine.start[k], c[0] * x[k] + c[1] * y[k], 1e-12, 'centroid line'));
  o.massProperties(1).centroidMM.forEach((v, k) => near(v, (o.member.centroidLine.start[k] + o.member.centroidLine.end[k]) / 2, 1e-12, 'centre of mass on the centroidal line'));
});

test('FR1 faces by the section\'s roles and the ends; a sketch section (holes allowed) by its sides; dimensions by parameter', () => {
  const names = o => [...new Set(o.brep.faces.map(f => f.name.replace(/#\d+$/, '')))].sort();
  assert.deepEqual(names(run([member({ kind: 'channel', height: 80, width: 40, web: 5, flange: 8, rootRadius: 7 }, [0, 0, 0], [0, 0, 100])]).output('m')),
    ['m.back', 'm.bottom', 'm.end', 'm.inside.bottom', 'm.inside.top', 'm.root.bottom', 'm.root.top', 'm.start', 'm.tip.bottom', 'm.tip.top', 'm.top', 'm.web']);
  assert.deepEqual(names(run([member({ kind: 'round-tube', diameter: 30, wall: 2 }, [0, 0, 0], [100, 0, 0])]).output('m')), ['m.bore', 'm.end', 'm.outside', 'm.start']);
  // A sketch: a 30 × 20 plate with a Ø8 hole, anchored at its centroid: A·L, the line through the centroid.
  const sk = { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20], holes: [[{ kind: 'arc', start: [14, 10], center: [10, 10], direction: 'ccw' }]] };
  const o = run([sk, { ...member({ kind: 'sketch', sketch: 's' }, [0, 0, 0], [0, 250, 0]) }]).output('m'), A = 600 - 16 * Math.PI, cx = (600 * 15 - 16 * Math.PI * 10) / A;
  near(o.massProperties(1).volumeMM3, A * 250, 1e-12, 'sketch section'); near(o.member.centroid[0], cx, 1e-12, 'sketch centroid'); near(o.member.centroid[1], 10, 1e-12, 'sketch centroid y');
  assert.ok(names(o).includes('m.start') && names(o).includes('m.end') && names(o).some(n => /^m\.side\d$/.test(n)), names(o).join(' '));
  // Parameters: the tube's wall and the line's end.
  const s = run([member({ kind: 'rect-tube', width: 40, height: 40, wall: { parameter: 't' }, outerRadius: { parameter: 'ro' } }, [0, 0, 0], [{ parameter: 'L' }, 0, 0])], { t: 3, ro: 6, L: 300 });
  near(s.output('m').massProperties(1).volumeMM3, rectTubeArea(40, 40, 3, 6) * 300, 1e-12, 'by parameter');
  const s2 = s.withParameters({ t: 2, ro: 4, L: 450 });
  near(s2.output('m').massProperties(1).volumeMM3, rectTubeArea(40, 40, 2, 4) * 450, 1e-12, 'parameters changed');
});

test('FR1 refusals by name: SECTION_DIMENSIONS for each kind, SEGMENT_ZERO_LENGTH; a T-slot without its open slots, an unknown kind, a bad anchor', () => {
  const refuse = (section, re, more = {}, end = [100, 0, 0]) => assert.throws(() => run([member(section, [0, 0, 0], end, more)]), e => e.code !== undefined && re.test(e.message), `${JSON.stringify(section)} ${re}`);
  const dims = /\[SECTION_DIMENSIONS\]/;
  refuse({ kind: 'rect-tube', width: 40, height: 40, wall: 20, outerRadius: 0 }, dims);
  refuse({ kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 20 }, dims);
  refuse({ kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 2 }, /no concentric bore radius: give innerRadius/);
  refuse({ kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 2, innerRadius: 4 }, /past the outer/);
  refuse({ kind: 'round-tube', diameter: 20, wall: 10 }, dims);
  refuse({ kind: 'angle', legX: 50, legY: 30, thickness: 5, rootRadius: 6, toeRadius: 5 }, /toe radius 5 must be under the thickness 5/);
  refuse({ kind: 'angle', legX: 12, legY: 30, thickness: 5, rootRadius: 6, toeRadius: 3 }, dims);
  refuse({ kind: 'channel', height: 30, width: 40, web: 5, flange: 8, rootRadius: 7 }, /no flat web/);
  refuse({ kind: 'channel', height: 80, width: 10, web: 5, flange: 8, rootRadius: 7 }, dims);
  refuse({ kind: 'tslot', size: 20, cells: 1, openSlots: 4, ...SLOT, depth: 9 }, /reaches the core bore/);
  refuse({ kind: 'tslot', size: 20, cells: 1, openSlots: 4, ...SLOT, undercut: 13 }, /meet their neighbours/);
  refuse({ kind: 'tslot', size: 20, cells: 1, openSlots: 4, ...SLOT, depth: 4 }, /no straight part/);
  refuse({ kind: 'tslot', size: 20, cells: 1, ...SLOT }, /openSlots \(0 to 4/);
  refuse({ kind: 'rect-tube', width: -40, height: 40, wall: 3, outerRadius: 0 }, /width must be positive/);
  refuse({ kind: 'i-beam', height: 100 }, /section\.kind must be/);
  refuse({ kind: 'round-tube', diameter: 30, wall: 2 }, /\[SEGMENT_ZERO_LENGTH\]/, {}, [0, 0, 1e-9]);
  refuse({ kind: 'round-tube', diameter: 30, wall: 2 }, /anchor must be one of/, { anchor: 'middle' });
});
