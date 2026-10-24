// Writes the R2 conformance cases (conformance/r2/*.json): each input part document with the outputs this
// kernel produces, where no closed form exists. Closed-form expectations are written as such. Run after
// build:library: node scripts/conformance-gen.mjs. Review the diff: a changed value is a changed contract.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluateCadPart, checkBrep, massPropertiesOf, surfaceAreaOf } from '../dist/index.js';

const out = resolve(import.meta.dirname, '../conformance/r2');
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const base = name => name.replace(/#\d+$/, '');

/** A torus of n × m quads, lumpy (closed, consistently wound). Positions rounded to 1e-6 mm, as the studio keeps them. */
function torus(n, m) {
  const P = [], I = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const u = 2 * Math.PI * i / n, v = 2 * Math.PI * j / m, r = 4 * (1 + 0.15 * Math.sin(3 * u) * Math.cos(2 * v));
    P.push(...[(12 + r * Math.cos(v)) * Math.cos(u), (12 + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v)].map(x => Math.round(x * 1e6) / 1e6));
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const a = i * m + j, b = ((i + 1) % n) * m + j, c = ((i + 1) % n) * m + (j + 1) % m, d = i * m + (j + 1) % m;
    I.push(a, b, c, a, c, d);
  }
  return { positions: P, indices: I };
}
const bilinear = (p00, p01, p10, p11) => ({ degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[p00, p01], [p10, p11]], weights: [[1, 1], [1, 1]] });

/** Expected outputs measured on this kernel (volume to relTol, centroid to absTol). */
function measured(doc, relTol, absTol, names) {
  const outputs = evaluateCadPart(doc).outputs.map(o => {
    const m = massPropertiesOf(o), topo = checkBrep(o.brep).topology;
    const row = { volumeMM3: { value: +m.volume.toPrecision(12), relTol }, centroidMM: { value: m.centroid.map(x => +x.toFixed(9)), absTol }, bodies: o.bodyCount, topology: topo.map(t => ({ shells: t.shells, genus: t.genus })) };
    if (names === 'list') row.faceNames = [...new Set(o.brep.faces.map(f => base(f.name ?? f.id)))].sort();
    else if (names) row.faceNamePattern = names;
    return row;
  });
  return { outputs };
}
function refused(doc) {
  try { evaluateCadPart(doc); } catch (e) { return { error: { code: e.code, messageIncludes: e.message.replace(/^.*?: /, '').slice(0, 40) } }; }
  throw new Error('expected a refusal');
}
// (Arrays of numbers on one line each: a mesh's thousands of coordinates stay readable as data.)
const compact = text => text.replace(/\[\s*(-?[\d.e+-]+(?:,\s*-?[\d.e+-]+)*)\s*\]/g, (_, list) => `[${list.split(/,\s*/).join(', ')}]`);
const write = c => writeFileSync(join(out, `${c.id.replace(/^r2-/, '')}.json`), compact(JSON.stringify(c, null, 2)) + '\n');

const ring = torus(24, 16), ringDoc = f => D([{ id: 'm', kind: 'mesh', ...ring }, ...f]);
const block = [{ id: 'bs', kind: 'sketch', profile: 'rectangle', min: [13, -3], max: [20, 3] }, { id: 'b', kind: 'extrude', sketch: 'bs', height: 12, from: -6 }];
write({ id: 'r2-mesh-union-box', step: 'R2', decisions: ['D9'], about: 'A closed 768-triangle mesh ring united with a block through its wall (polyhedral Boolean).',
  input: { partDocument: ringDoc([...block, { id: 'u', kind: 'union', target: 'm', tool: 'b' }]) }, expect: measured(ringDoc([...block, { id: 'u', kind: 'union', target: 'm', tool: 'b' }]), 1e-9, 1e-7, null),
  oracle: 'this kernel (exact rational predicates); the ring volume itself is the divergence-theorem sum of its triangles' });
write({ id: 'r2-mesh-split-y', step: 'R2', decisions: ['D9'], about: 'The mesh ring split across Y = 0.5 into two bodies whose volumes add to the ring\'s.',
  input: { partDocument: ringDoc([{ id: 's', kind: 'split', target: 'm', axis: 'y', at: 0.5 }]) }, expect: measured(ringDoc([{ id: 's', kind: 'split', target: 'm', axis: 'y', at: 0.5 }]), 1e-9, 1e-7, null),
  oracle: 'this kernel; the two volumes sum to the ring volume to 1e-12' });
const hole = { positions: ring.positions, indices: ring.indices.slice(6) };
write({ id: 'r2-mesh-open-refused', step: 'R2', decisions: ['D3'], about: 'A mesh with one quad missing is refused as not closed (no repair).',
  input: { partDocument: D([{ id: 'm', kind: 'mesh', ...hole }]) }, expect: refused(D([{ id: 'm', kind: 'mesh', ...hole }])), oracle: 'contract: open meshes are refused with GEOMETRY' });
const c = (x, y, z) => [x, y, z];
const cube = [bilinear(c(0, 0, 0), c(0, 10, 0), c(10, 0, 0), c(10, 10, 0)), bilinear(c(0, 0, 10), c(10, 0, 10), c(0, 10, 10), c(10, 10, 10)), bilinear(c(0, 0, 0), c(10, 0, 0), c(0, 0, 10), c(10, 0, 10)),
  bilinear(c(0, 10, 0), c(0, 10, 10), c(10, 10, 0), c(10, 10, 10)), bilinear(c(0, 0, 0), c(0, 0, 10), c(0, 10, 0), c(0, 10, 10)), bilinear(c(10, 0, 0), c(10, 10, 0), c(10, 0, 10), c(10, 10, 10))];
const sewDoc = D([{ id: 's', kind: 'sew', surfaces: cube }]);
write({ id: 'r2-sewn-cube', step: 'R2', decisions: ['D14'], about: 'Six bilinear patches, some facing in, sewn into a closed 10 mm cube facing out.',
  input: { partDocument: sewDoc }, expect: { outputs: [{ volumeMM3: { value: 1000, relTol: 1e-12 }, centroidMM: { value: [5, 5, 5], absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 0 }], faceNames: measured(sewDoc, 0, 0, 'list').outputs[0].faceNames }] }, oracle: 'closed form' });
const disc = [{ id: 'cs', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }, { id: 'c', kind: 'extrude', sketch: 'cs', height: 10 }, { id: 'ts', kind: 'sketch', profile: 'rectangle', min: [-2, -2], max: [2, 2] }, { id: 't', kind: 'extrude', sketch: 'ts', height: 6, from: 8 }, { id: 'u', kind: 'union', target: 'c', tool: 't' }];
const v = 250 * Math.PI + 64, cz = (250 * Math.PI * 5 + 64 * 12) / v;
write({ id: 'r2-cylinder-block-union', step: 'R2', decisions: ['D10'], about: 'A Ø10 × 10 cylinder with a 4 × 4 block rising through its top: volume 250π + 64.',
  input: { partDocument: D(disc) }, expect: { outputs: [{ volumeMM3: { value: v, relTol: 1e-8 }, centroidMM: { value: [0, 0, cz], absTol: 1e-6 }, bodies: 1, topology: [{ shells: 1, genus: 0 }], faceNames: measured(D(disc), 0, 0, 'list').outputs[0].faceNames }] }, oracle: 'closed form' });
const bolt = D([{ id: 'b', kind: 'thread', diameter: 8, pitch: 1.25, length: 24, hex: { across: 13, height: 5.3 } }]);
write({ id: 'r2-thread-bolt-m8', step: 'R2', decisions: ['D8'], about: 'The default (faceted) M8 × 24 hex bolt: one closed body.',
  input: { partDocument: bolt }, expect: measured(bolt, 1e-9, 1e-6, null), oracle: 'this kernel (faceted helix; the ISO-profile volume is 2e-3 away by design)' });

// RB1: the broken-mesh refusals the robustness taxonomy counts as acceptable (typed GEOMETRY errors).
const rb1 = resolve(import.meta.dirname, '../conformance/rb1');
mkdirSync(rb1, { recursive: true });
const writeRb1 = c => writeFileSync(join(rb1, `${c.id.replace(/^rb1-/, '')}.json`), compact(JSON.stringify(c, null, 2)) + '\n');
const flippedIdx = [...ring.indices]; for (let t = 30; t < 40; t++) [flippedIdx[3 * t + 1], flippedIdx[3 * t + 2]] = [flippedIdx[3 * t + 2], flippedIdx[3 * t + 1]];
const apex = ring.positions.length / 3, shift = apex;
for (const [name, about, m] of [
  ['mesh-flipped-refused', 'A mesh with ten triangles wound the wrong way is refused (no repair).', { positions: ring.positions, indices: flippedIdx }],
  ['mesh-fin-refused', 'A mesh with an extra triangle pair on one of its edges (non-manifold) is refused.', { positions: [...ring.positions, ring.positions[0] + 3, ring.positions[1], ring.positions[2] + 3], indices: [...ring.indices, ring.indices[0], ring.indices[1], apex, ring.indices[1], ring.indices[0], apex] }],
  ['mesh-two-shells-refused', 'A mesh of two separate closed shells is refused as one body.', { positions: [...ring.positions, ...ring.positions.map((x, i) => i % 3 === 2 ? x + 40 : x)], indices: [...ring.indices, ...ring.indices.map(i => i + shift)] }],
]) {
  const doc = D([{ id: 'm', kind: 'mesh', ...m }]);
  writeRb1({ id: `rb1-${name}`, step: 'RB1', decisions: ['D17'], about, input: { partDocument: doc }, expect: refused(doc), oracle: 'contract: broken meshes are refused with GEOMETRY, never repaired silently' });
}
// D16: the thread form. A document without one (written before helical became the default) stays faceted.
const threadDoc = form => D([{ id: 'b', kind: 'thread', diameter: 8, pitch: 1.25, length: 20, hex: { across: 13, height: 5.3 }, ...(form ? { form } : {}) }]);
writeRb1({ id: 'rb1-thread-legacy-faceted', step: 'RB1', decisions: ['D16'], about: 'A thread written before the helical default (no form) builds faceted: its faces stay .facetK.',
  input: { partDocument: threadDoc() }, expect: measured(threadDoc(), 1e-9, 1e-6, '^b\\.facet\\d+$'), oracle: 'this kernel (faceted helix, flat facets)' });
writeRb1({ id: 'rb1-thread-helical', step: 'RB1', decisions: ['D16'], about: 'A helical M8 × 20 hex bolt: B-spline thread faces and named head, seat, end and hex faces.',
  input: { partDocument: threadDoc('helical') }, expect: measured(threadDoc('helical'), 1e-9, 1e-6, 'list'), oracle: 'this kernel (half-turn B-spline faces; within 3e-4 of the ISO-profile volume)' });
// RB2: strict L0 validity and watertight tessellations (a helical rod, a nut, a fillet along the top edges).
const rb2 = resolve(import.meta.dirname, '../conformance/rb2');
mkdirSync(rb2, { recursive: true });
const writeRb2 = c => writeFileSync(join(rb2, `${c.id.replace(/^rb2-/, '')}.json`), compact(JSON.stringify(c, null, 2)) + '\n');
const watertight = (doc, relTol, absTol, names) => { const e = measured(doc, relTol, absTol, names); e.outputs.forEach(o => { o.tessellation = { segmentsPerQuarter: 8, watertight: true }; }); return e; };
const rod = D([{ id: 'r', kind: 'thread', diameter: 10, pitch: 1.5, length: 25, form: 'helical' }]);
writeRb2({ id: 'rb2-helical-rod-watertight', step: 'RB2', decisions: ['D18', 'D19'], about: 'A helical M10 rod: strictly valid, and its tessellation watertight to the bit at every corner.',
  input: { partDocument: rod }, expect: watertight(rod, 1e-9, 1e-6, 'list'), oracle: 'this kernel; watertightness is exact (shared corner points)' });
const nut = D([{ id: 'n', kind: 'thread', diameter: 8, pitch: 1.25, hex: { across: 13, height: 6.8, internal: true }, form: 'helical' }]);
writeRb2({ id: 'rb2-helical-nut-watertight', step: 'RB2', decisions: ['D18', 'D19'], about: 'A helical M8 nut: strictly valid, its tessellation watertight.',
  input: { partDocument: nut }, expect: watertight(nut, 1e-9, 1e-6, 'list'), oracle: 'this kernel' });
const filletTop = D([{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }]);
const topEdges = evaluateCadPart(filletTop).outputs[0].brep.edges.map(e => e.name).filter(n => /top/.test(n)), filleted = D([...filletTop.features, { id: 'f', kind: 'fillet', target: 'e', edges: topEdges, radius: 4 }]);
{
  // Closed form: each straight run loses (1 − π/4) r² a unit length; each mitred top corner keeps an eighth
  // of the bicylinder (2r³/3 of its r³ cube).
  const r = 4, volume = 12000 - (1 - Math.PI / 4) * r * r * (2 * (40 - 2 * r) + 2 * (30 - 2 * r)) - 4 * r ** 3 / 3, e = watertight(filleted, 1e-9, 1e-6, 'list');
  e.outputs[0].volumeMM3 = { value: volume, relTol: 1e-7 };
  writeRb2({ id: 'rb2-fillet-top-edges', step: 'RB2', decisions: ['D18', 'D23'], about: 'A box with its four top edges filleted (radius 4): strictly valid (edges on their surfaces), watertight, its volume the closed form.',
    input: { partDocument: filleted }, expect: e, oracle: 'closed form for the volume (straight runs and bicylinder corners); this kernel for the centroid' });
}
// RB3: surface area (closed forms where there are) and STEP round trips, two bodies with repeated names among them.
const rb3 = resolve(import.meta.dirname, '../conformance/rb3');
mkdirSync(rb3, { recursive: true });
const writeRb3 = c => writeFileSync(join(rb3, `${c.id.replace(/^rb3-/, '')}.json`), compact(JSON.stringify(c, null, 2)) + '\n');
const pi = Math.PI, slab = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }];
const holedBox = D([...slab, { id: 'h', kind: 'hole', target: 'e', center: [20, 15], radius: 5 }]);
writeRb3({ id: 'rb3-holed-box', step: 'RB3', decisions: ['D20'], about: 'A 40 × 30 × 10 block with a Ø10 hole through its middle: volume 12000 − 250π, area 3800 + 50π, centroid at its middle; the STEP round trip keeps them.',
  input: { partDocument: holedBox }, expect: { outputs: [{ volumeMM3: { value: 12000 - 250 * pi, relTol: 1e-12 }, centroidMM: { value: [20, 15, 5], absTol: 1e-9 }, areaMM2: { value: 3800 + 50 * pi, relTol: 1e-12 }, bodies: 1, topology: [{ shells: 1, genus: 1 }], faceNames: measured(holedBox, 0, 0, 'list').outputs[0].faceNames }], stepRoundTrip: { relTol: 1e-9 } }, oracle: 'closed form' });
const cylinder = D([{ id: 's', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }, { id: 'c', kind: 'extrude', sketch: 's', height: 10 }]);
writeRb3({ id: 'rb3-cylinder', step: 'RB3', decisions: ['D20'], about: 'A Ø10 × 10 cylinder: volume 250π, area 150π, centroid on its axis halfway up; the STEP round trip keeps them.',
  input: { partDocument: cylinder }, expect: { outputs: [{ volumeMM3: { value: 250 * pi, relTol: 1e-12 }, centroidMM: { value: [0, 0, 5], absTol: 1e-9 }, areaMM2: { value: 150 * pi, relTol: 1e-12 }, bodies: 1, topology: [{ shells: 1, genus: 0 }], faceNames: measured(cylinder, 0, 0, 'list').outputs[0].faceNames }], stepRoundTrip: { relTol: 1e-9 } }, oracle: 'closed form' });
const helicalBolt = D([{ id: 'b', kind: 'thread', diameter: 8, pitch: 1.25, length: 20, hex: { across: 13, height: 5.3 }, form: 'helical' }]);
const hb = measured(helicalBolt, 1e-9, 1e-6, 'list'); hb.outputs[0].areaMM2 = { value: +surfaceAreaOf(evaluateCadPart(helicalBolt).outputs[0]).toPrecision(12), relTol: 1e-9 };
writeRb3({ id: 'rb3-helical-bolt-roundtrip', step: 'RB3', decisions: ['D20', 'D16'], about: 'A helical M8 × 20 bolt: its area over the exact B-spline faces, kept with its volume through STEP.',
  input: { partDocument: helicalBolt }, expect: { ...hb, stepRoundTrip: { relTol: 1e-6 } }, oracle: 'this kernel (area by tensor Gauss over whole patches)' });
const branches = D([...slab, { id: 'h0', kind: 'hole', target: 'e', center: [10, 10], radius: 2 }, { id: 'h1', kind: 'hole', target: 'e', center: [30, 10], radius: 2 }]);
writeRb3({ id: 'rb3-two-bodies-one-step', step: 'RB3', decisions: ['D20'], about: 'Two holes on one block branch it into two bodies with the same face names; one STEP of both reads back valid, names numbered.',
  input: { partDocument: branches }, expect: { ...measured(branches, 1e-9, 1e-7, null), stepRoundTrip: { relTol: 1e-9 } }, oracle: 'this kernel; each volume is 12000 − 40π (closed form) to 1e-9' });
// After RB3: every edge of a box filleted (corner balls), against the rounded box's closed form.
{
  const r = 3, A = 40 - 2 * r, B = 30 - 2 * r, C = 10 - 2 * r, edges = evaluateCadPart(D(slab)).outputs[0].brep.edges.map(e => e.name), doc = D([...slab, { id: 'f', kind: 'fillet', target: 'e', edges, radius: r }]);
  const volume = A * B * C + 2 * r * (A * B + B * C + A * C) + pi * r * r * (A + B + C) + 4 / 3 * pi * r ** 3, area = 2 * (A * B + B * C + A * C) + 2 * pi * r * (A + B + C) + 4 * pi * r * r;
  writeRb3({ id: 'rb3-fillet-all-edges', step: 'RB3', decisions: ['D22'], about: 'A 40 × 30 × 10 block with every edge filleted at r = 3: the rounded box (corner balls), strictly valid and watertight.',
    input: { partDocument: doc }, expect: { outputs: [{ volumeMM3: { value: volume, relTol: 5e-5 }, centroidMM: { value: [20, 15, 5], absTol: 5e-4 }, areaMM2: { value: area, relTol: 5e-5 }, bodies: 1, topology: [{ shells: 1, genus: 0 }], faceNames: measured(doc, 0, 0, 'list').outputs[0].faceNames, tessellation: { segmentsPerQuarter: 8, watertight: true } }], stepRoundTrip: { relTol: 1e-6 } },
    oracle: 'closed form (inner box + slabs + quarter-cylinders + ball); the tolerance is the quadrature over the trimmed corner patches, which hold their ball\'s pole (geometry exact to 1e-9)' });
}
console.log('written to', out, 'and', rb1, 'and', rb2, 'and', rb3);
