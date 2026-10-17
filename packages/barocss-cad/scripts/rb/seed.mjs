// Writes the robustness seed corpus (robustness/corpus/): part documents across the feature families, the
// broken-mesh set, and STEP files exported from this kernel's own models (the helical thread among them).
// Deterministic. Run after build:library: node scripts/rb/seed.mjs (then node scripts/rb/run.mjs).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluateCadPart, exportStep, threadSolid } from '../../dist/index.js';

const root = resolve(import.meta.dirname, '../../robustness/corpus');
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const put = (dir, name, text) => { mkdirSync(join(root, dir), { recursive: true }); writeFileSync(join(root, dir, name), text); };
const compact = text => text.replace(/\[\s*(-?[\d.e+-]+(?:,\s*-?[\d.e+-]+)*)\s*\]/g, (_, list) => `[${list.split(/,\s*/).join(', ')}]`);
const part = (name, features) => put('parts', `${name}.json`, compact(JSON.stringify(D(features), null, 2)) + '\n');

const rect = (id, x0, y0, x1, y1) => ({ id, kind: 'sketch', profile: 'rectangle', min: [x0, y0], max: [x1, y1] });
const circle = (id, x, y, r) => ({ id, kind: 'sketch', profile: 'circle', center: [x, y], radius: r });
const extrude = (id, sketch, height, from) => ({ id, kind: 'extrude', sketch, height, ...(from === undefined ? {} : { from }) });

// Prismatic: holes, a cross hole meeting a vertical one (cylinders touching), countersinks.
// (Each hole on the one before: a feature on an earlier one branches the part into separate bodies.)
part('plate-holes', [rect('s', 0, 0, 40, 30), extrude('p', 's', 6), ...[[8, 8], [32, 8], [8, 22], [32, 22]].map(([x, y], k) => ({ id: `h${k}`, kind: 'hole', target: k ? `h${k - 1}` : 'p', center: [x, y], radius: 2 }))]);
part('plate-countersinks', [rect('s', 0, 0, 40, 20), extrude('p', 's', 8), { id: 'h0', kind: 'hole', target: 'p', center: [10, 10], radius: 2, countersink: 7 }, { id: 'h1', kind: 'hole', target: 'h0', center: [30, 10], radius: 2, countersink: 7 }]);
// Two holes on the same plate: two bodies with the same face names (a STEP of them repeats the names).
part('plate-two-branches', [rect('s', 0, 0, 40, 20), extrude('p', 's', 8), { id: 'h0', kind: 'hole', target: 'p', center: [10, 10], radius: 2 }, { id: 'h1', kind: 'hole', target: 'p', center: [30, 10], radius: 2 }]);
part('bar-cross-holes', [rect('s', 0, 0, 100, 40), extrude('p', 's', 12), { id: 'h0', kind: 'hole', target: 'p', center: [42, 6], radius: 2, axis: 'y' }, { id: 'h1', kind: 'hole', target: 'p', center: [43, 20], radius: 3 }]);
// Curved Booleans: cylinders through blocks, a block on a cylinder, intersections.
part('cylinder-block-union', [circle('c', 0, 0, 5), extrude('cy', 'c', 10), rect('b', -2, -2, 2, 2), extrude('bl', 'b', 6, 8), { id: 'u', kind: 'union', target: 'cy', tool: 'bl' }]);
part('cylinder-through-block', [rect('b', -10, -10, 10, 10), extrude('bl', 'b', 10), circle('c', 3, 0, 4), extrude('cy', 'c', 20, -5), { id: 'd', kind: 'difference', target: 'bl', tool: 'cy' }]);
part('two-cylinders-intersect', [circle('a', 0, 0, 6), extrude('ca', 'a', 12), circle('b', 4, 0, 6), extrude('cb', 'b', 12), { id: 'i', kind: 'intersect', target: 'ca', tool: 'cb' }]);
// Fillets and chamfers on all edges of a box (names from the box itself), and splits.
const box = [rect('s', 0, 0, 40, 30), extrude('e', 's', 10)], edges = evaluateCadPart(D(box)).outputs[0].brep.edges.map(e => e.name);
part('box-fillet-all', [...box, { id: 'f', kind: 'fillet', target: 'e', edges, radius: 2 }]);
part('box-chamfer-all', [...box, { id: 'f', kind: 'chamfer', target: 'e', edges, distance: 1.5 }]);
part('box-fillet-top', [...box, { id: 'f', kind: 'fillet', target: 'e', edges: edges.filter(n => /top/.test(n)), radius: 4 }]);
part('plate-split-mitre', [rect('s', 0, 0, 60, 20), extrude('p', 's', 10), { id: 'x', kind: 'split', target: 'p', normal: [1, 1, 0], at: 30 }]);
part('holed-plate-split', [...[rect('s', 0, 0, 40, 30), extrude('p', 's', 6)], { id: 'h', kind: 'hole', target: 'p', center: [20, 15], radius: 5 }, { id: 'x', kind: 'split', target: 'p', axis: 'x', at: 20 }]);
part('thread-bolt-m6', [{ id: 'b', kind: 'thread', diameter: 6, pitch: 1, length: 16, hex: { across: 10, height: 4 } }]);
part('thread-nut-m6', [{ id: 'n', kind: 'thread', diameter: 6, pitch: 1, hex: { across: 10, height: 5, internal: true } }]);
part('thread-bolt-m6-helical', [{ id: 'b', kind: 'thread', diameter: 6, pitch: 1, length: 16, hex: { across: 10, height: 4 }, form: 'helical' }]);
part('thread-nut-m6-helical', [{ id: 'n', kind: 'thread', diameter: 6, pitch: 1, hex: { across: 10, height: 5, internal: true }, form: 'helical' }]);
part('thread-rod-m10-helical', [{ id: 'r', kind: 'thread', diameter: 10, pitch: 1.5, length: 25, form: 'helical' }]);

// Meshes: a lumpy ring and its broken variants (open, flipped patch, non-manifold fin, degenerate triangles, two shells).
function ring(n, m) {
  const P = [], I = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const u = 2 * Math.PI * i / n, v = 2 * Math.PI * j / m, r = 4 * (1 + 0.15 * Math.sin(3 * u) * Math.cos(2 * v));
    P.push(...[(12 + r * Math.cos(v)) * Math.cos(u), (12 + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v)].map(x => Math.round(x * 1e6) / 1e6));
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = i * m + j, b = ((i + 1) % n) * m + j, c = ((i + 1) % n) * m + (j + 1) % m, d = i * m + (j + 1) % m; I.push(a, b, c, a, c, d); }
  return { positions: P, indices: I };
}
const R = ring(24, 16), mesh = (name, m, extra = []) => put('mesh', `${name}.json`, compact(JSON.stringify(D([{ id: 'm', kind: 'mesh', ...m }, ...extra]), null, 2)) + '\n');
mesh('ring', R);
mesh('ring-union-block', R, [rect('bs', 13, -3, 20, 3), extrude('b', 'bs', 12, -6), { id: 'u', kind: 'union', target: 'm', tool: 'b' }]);
mesh('ring-split', R, [{ id: 's', kind: 'split', target: 'm', axis: 'y', at: 0.5 }]);
mesh('broken-open', { positions: R.positions, indices: R.indices.slice(6) });
const flipped = [...R.indices]; for (let t = 30; t < 40; t++) [flipped[3 * t + 1], flipped[3 * t + 2]] = [flipped[3 * t + 2], flipped[3 * t + 1]];
mesh('broken-flipped', { positions: R.positions, indices: flipped });
const apex = R.positions.length / 3;
mesh('broken-fin', { positions: [...R.positions, R.positions[0] + 3, R.positions[1], R.positions[2] + 3], indices: [...R.indices, R.indices[0], R.indices[1], apex, R.indices[1], R.indices[0], apex] });
mesh('degenerate-extra', { positions: R.positions, indices: [...R.indices, R.indices[0], R.indices[0], R.indices[1]] });
const shift = R.positions.length / 3;
mesh('two-shells', { positions: [...R.positions, ...R.positions.map((x, i) => i % 3 === 2 ? x + 40 : x)], indices: [...R.indices, ...R.indices.map(i => i + shift)] });

// STEP files of this kernel's own models.
const step = (name, breps) => put('step', `${name}.step`, exportStep(breps, { name, timestamp: '2026-10-18T00:00:00' }));
step('helical-bolt-m8x30', [threadSolid({ id: 'b', diameter: 8, pitch: 1.25, length: 30, center: [0, 0], seat: 0, hex: { across: 13, height: 5.3 }, form: 'helical' })]);
step('helical-nut-m8', [threadSolid({ id: 'n', diameter: 8, pitch: 1.25, center: [0, 0], seat: 0, hex: { across: 13, height: 6.8, internal: true }, form: 'helical' })]);
for (const name of ['cylinder-block-union', 'cylinder-through-block', 'box-fillet-all', 'plate-countersinks', 'plate-two-branches']) {
  const doc = JSON.parse((await import('node:fs')).readFileSync(join(root, 'parts', `${name}.json`), 'utf8'));
  step(name, evaluateCadPart(doc).outputs.map(o => o.brep));
}
console.log('corpus written to', root);
