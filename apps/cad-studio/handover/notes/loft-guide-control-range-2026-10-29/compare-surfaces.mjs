import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { loftSolid, evaluateSurface, surfaceDomain } from '../../../../../packages/barocss-cad/dist/index.js';
const base = new URL('../../../../../packages/barocss-cad/dist/features/', import.meta.url);
const moduleURL = (text, file, replacements = {}) => `data:text/javascript;base64,${Buffer.from(text.replace(/from '([^']+)'/g, (_, path) => `from '${replacements[path] ?? new URL(path, new URL(file, base)).href}'`)).toString('base64')}`;
const oldGuide = moduleURL(readFileSync(new URL('./original-loft-nurbs-guide.mjs', import.meta.url), 'utf8'), 'loft-nurbs-guide.js');
const original = await import(moduleURL(readFileSync(new URL('./original-loft.mjs', import.meta.url), 'utf8'), 'loft.js', { './loft-nurbs-guide.js': oldGuide }));

// Independent homogeneous de Boor evaluation of the original coefficient table. This oracle does not
// call validateSurface or bypass any production admission: it runs only on preserved test evidence.
function deBoor(p, U, P, t) {
  let k = p; while (k < P.length - 1 && t >= U[k + 1]) k++;
  const d = []; for (let j = 0; j <= p; j++) d.push([...P[k - p + j]]);
  for (let r = 1; r <= p; r++) for (let j = p; j >= r; j--) {
    const i = k - p + j, a = (t - U[i]) / (U[i + p + 1 - r] - U[i]);
    for (let c = 0; c < d[j].length; c++) d[j][c] = (1 - a) * d[j - 1][c] + a * d[j][c];
  }
  return d[p];
}
function at(S, u, v) {
  const rows = [];
  for (let r = 0; r < S.controlPoints.length; r++) {
    const poles = [];
    for (let c = 0; c < S.controlPoints[r].length; c++) { const w = S.weights[r][c], p = S.controlPoints[r][c]; poles.push([w * p[0], w * p[1], w * p[2], w]); }
    rows.push(deBoor(S.degreeV, S.knotsV, poles, v));
  }
  const q = deBoor(S.degreeU, S.knotsU, rows, u); return [q[0] / q[3], q[1] / q[3], q[2] / q[3]];
}
const binary64 = n => { const b = Buffer.alloc(8); b.writeDoubleBE(n); return b.toString('hex'); };
function bitTree(v) { if (typeof v === 'number') return binary64(v); if (Array.isArray(v)) return v.map(bitTree); if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, bitTree(x)])); return v; }
function adjacent(t, step) { const b = Buffer.alloc(8); b.writeDoubleBE(t); b.writeBigUInt64BE(b.readBigUInt64BE() + BigInt(step)); return b.readDoubleBE(); }
function probes(knots) {
  const values = new Set(knots), distinct = [...values];
  for (let i = 0; i + 1 < distinct.length; i++) values.add(distinct[i] + (distinct[i + 1] - distinct[i]) / 2);
  for (const t of distinct) { if (t > 0) values.add(adjacent(t, -1)); if (t < 1) values.add(adjacent(t, 1)); }
  for (let i = 0; i <= 32; i++) values.add(i / 32);
  return [...values].sort((a, b) => a - b);
}
const polygon = w => [[0, 0], [w, 0], [w, w], [0, w]].map(start => ({ kind: 'line', start }));
const circle = r => [{ kind: 'arc', start: [r, 0], center: [0, 0], direction: 'ccw' }];
const inputs = [];
for (const degree of [1, 2, 3, 4, 5]) for (const count of [17, 64]) {
  const interior = count - degree - 1, unit = [...Array(degree + 1).fill(0), ...Array.from({ length: interior }, (_, i) => degree > 1 ? (Math.floor(i / degree) + 1) / (Math.ceil(interior / degree) + 1) : (i + 1) / (interior + 1)), ...Array(degree + 1).fill(1)];
  const guide = { kind: 'nurbs', degree, knots: unit.map(t => 2 + 3 * t), controlPoints: Array.from({ length: count }, (_, i) => { const t = i / (count - 1); return [i && i < count - 1 ? 0.2 * Math.sin(5 * t) : 0, i && i < count - 1 ? 0.1 * Math.cos(3 * t) : 0, t * t]; }) };
  inputs.push({ id: 'L', name: 'L', sections: [{ profile: polygon(1), z: 0 }, { profile: polygon(2), z: 1 }], guide });
}
for (const count of [17, 64]) {
  const degree = 3, knots = [...Array(4).fill(0), ...Array.from({ length: count - 4 }, (_, i) => (i + 1) / (count - 3)), ...Array(4).fill(1)];
  inputs.push({ id: 'L', name: 'L', sections: [{ profile: circle(1), z: 0 }, { profile: circle(2), z: 1 }], guide: { kind: 'nurbs', degree, knots, controlPoints: Array.from({ length: count }, (_, i) => { const t = i / (count - 1); return [1 + t + (i && i < count - 1 ? Math.sin(5 * t) : 0), i && i < count - 1 ? 0.3 * Math.cos(3 * t) : 0, t * t]; }) } });
}
const result = { status: 'running', lengthUnit: 'mm', tolerance: 1e-9, oracle: 'Independent homogeneous de Boor on original unvalidated coefficient tables; actual production child evaluateSurface; all original knots/midpoints/adjacent floats and grid', cases: [] }, coefficients = [];
for (const [index, input] of inputs.entries()) {
  const saved = structuredClone(input), before = original.loftSolid(structuredClone(input)), after = loftSolid(input);
  assert.deepEqual(bitTree(after.mass(7.85)), bitTree(before.mass(7.85))); assert.deepEqual(input, saved);
  const record = { index, degree: input.guide.degree, count: input.guide.controlPoints.length, rationalU: false, samples: 0, maximumDifference: 0, massBits: bitTree(after.mass(7.85)), patches: [] };
  const sourceFaces = before.brep.faces.filter(f => f.name.startsWith('L.side'));
  for (const parent of sourceFaces) {
    const source = parent.surface, values = probes(source.knotsV), children = after.brep.faces.filter(f => f.name.startsWith(parent.name + '#'));
    assert.ok(children.length >= 2); assert.deepEqual(children[0].surface.controlPoints[0][0], source.controlPoints[0][0]);
    if (source.weights.some(row => row[0] !== 1)) record.rationalU = true;
    for (const child of children) {
      const domain = surfaceDomain(child.surface).v;
      for (const u of [0, 0.1, 0.37, 0.5, 0.9, 1]) for (const v of values) if (v >= domain[0] && v <= domain[1]) {
        const expected = at(source, u, v), actual = evaluateSurface(child.surface, u, v);
        for (let c = 0; c < 3; c++) { const d = Math.abs(actual[c] - expected[c]); record.maximumDifference = Math.max(record.maximumDifference, d); assert.ok(d <= result.tolerance, `${index} ${child.name} (${u},${v}) ${d}`); }
        record.samples++;
      }
      record.patches.push({ name: child.name, domain, controls: child.surface.controlPoints[0].length });
    }
    coefficients.push({ case: index, source, children: children.map(f => f.surface) });
  }
  result.cases.push(record); console.log(`SAME source surface case${index} degree${record.degree} controls${record.count} rationalU=${record.rationalU} max=${record.maximumDifference}`);
}
result.status = 'passed'; writeFileSync(new URL('./surface-comparison.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
writeFileSync(new URL('./surface-coefficients.json.gz', import.meta.url), gzipSync(JSON.stringify(coefficients), { level: 9 }));
