import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { loftSolid, checkBrep, tessellateBrep } from '../../../../../packages/barocss-cad/dist/index.js';
const baseline = JSON.parse(readFileSync(new URL('./baseline-results.json', import.meta.url)));
const records = baseline.records.map(record => {
  const input = record.input, before = structuredClone(input), made = loftSolid(input), mass = made.mass(1), report = checkBrep(made.brep, { strict: true }), mesh = tessellateBrep(made.brep, { segmentsPerQuarter: 4 });
  assert.ok(report.valid); assert.ok(mesh.positions.every(Number.isFinite)); assert.ok(Math.abs(mass.volume - record.expected.volume) < 1e-9); assert.deepEqual(input, before);
  console.log(`${record.sectionCount} ${record.profile}: valid; volume=${mass.volume}; faces=${made.brep.faces.length}`);
  return { ...record, outcome: { returned: { brep: made.brep, mass, report, mesh: { vertices: mesh.positions.length / 3, triangles: mesh.indices.length / 3 } } } };
});
writeFileSync(new URL('./after-results.json', import.meta.url), JSON.stringify({ node: process.version, records }, null, 2) + '\n');
