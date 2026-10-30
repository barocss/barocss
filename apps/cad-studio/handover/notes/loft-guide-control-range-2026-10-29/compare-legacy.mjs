import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { loftSolid } from '../../../../../packages/barocss-cad/dist/features/loft.js';
const base = new URL('../../../../../packages/barocss-cad/dist/features/', import.meta.url);
const moduleURL = (text, file, replacements = {}) => `data:text/javascript;base64,${Buffer.from(text.replace(/from '([^']+)'/g, (_, path) => `from '${replacements[path] ?? new URL(path, new URL(file, base)).href}'`)).toString('base64')}`;
const oldGuide = moduleURL(readFileSync(new URL('./original-loft-nurbs-guide.mjs', import.meta.url), 'utf8'), 'loft-nurbs-guide.js');
const before = await import(moduleURL(readFileSync(new URL('./original-loft.mjs', import.meta.url), 'utf8'), 'loft.js', { './loft-nurbs-guide.js': oldGuide }));
const bits = x => { const b = Buffer.alloc(8); b.writeDoubleBE(x); return b.toString('hex'); };
function bitTree(v) { if (typeof v === 'number') return bits(v); if (Array.isArray(v)) return v.map(bitTree); if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, bitTree(x)])); return v; }
const square = w => [[0, 0], [w, 0], [w, w], [0, w]].map(start => ({ kind: 'line', start }));
const sections = [{ profile: square(1), z: 0 }, { profile: square(2), z: 1 }];
const cases = [];
for (let degree = 1; degree <= 5; degree++) {
  const n = 16, knots = [...Array(degree + 1).fill(0), ...Array.from({ length: n - degree - 1 }, (_, i) => (i + 1) / (n - degree)), ...Array(degree + 1).fill(1)];
  cases.push({ id: 'L', name: 'L', sections, guide: { kind: 'nurbs', degree, knots, controlPoints: Array.from({ length: n }, (_, i) => { const t = i / (n - 1); return [i && i < n - 1 ? Math.sin(t * 5) : 0, i && i < n - 1 ? Math.cos(t * 3) : 0, t * t]; }) } });
}
cases.push({ id: 'L', name: 'L', sections }, { id: 'L', name: 'L', sections: [...sections.slice(0, 1), { profile: square(1.5), z: 0.5 }, ...sections.slice(1)], smooth: true });
const frame = z => ({ origin: [0, 0, z], xAxis: [1, 0, 0], yAxis: [0, 1, 0] }), circle = [{ kind: 'arc', start: [1, 0], center: [0, 0], direction: 'ccw' }];
for (const [kind, controlPoints] of [['quadratic-bezier', [[1, 0, 0], [3, 0, 1.5], [1, 0, 3]]], ['cubic-bezier', [[1, 0, 0], [3, 0, 1], [2, 0, 2], [1, 0, 3]]]]) cases.push({ id: 'L', name: 'L', sections: [{ profile: circle, frame: frame(0) }, { profile: circle, frame: frame(3) }], guide: { kind, controlPoints } });
const records = [];
for (const [index, input] of cases.entries()) {
  const saved = structuredClone(input), old = before.loftSolid(structuredClone(input)), fresh = loftSolid(input);
  const a = bitTree({ brep: old.brep, mass: old.mass(7.85) }), b = bitTree({ brep: fresh.brep, mass: fresh.mass(7.85) });
  assert.deepEqual(b, a); assert.deepEqual(input, saved); records.push({ index, input, before: a, after: b });
}
writeFileSync(new URL('./legacy-preservation.json.gz', import.meta.url), gzipSync(JSON.stringify(records), { level: 9 }));
writeFileSync(new URL('./legacy-preservation.json', import.meta.url), JSON.stringify({ status: 'passed', cases: records.length, scope: 'Every actual BRep, name, coordinate, knot, weight and mass Number bit, including signed zero; original source snapshots, no source pins in suite', sha256: createHash('sha256').update(JSON.stringify(records)).digest('hex') }, null, 2) + '\n');
console.log(`SAME ${records.length} complete legacy BRep/name/mass bit trees`);
