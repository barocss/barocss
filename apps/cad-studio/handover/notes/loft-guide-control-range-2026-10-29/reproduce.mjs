import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { loftSolid, checkBrep, tessellateBrep, evaluateSurface, evaluateCadPart, massPropertiesOf, checkOutput } from '../../../../../packages/barocss-cad/dist/index.js';
const square = width => [[0, 0], [width, 0], [width, width], [0, width]].map(start => ({ kind: 'line', start }));
const outcome = action => { try { return { returned: action() }; } catch (e) { return { threw: { name: e.name, code: e.code, message: e.message, details: e.details } }; } };
const result = { baseline: 'bb92da70b99114fb4e2b04149b52a3db05283804', node: process.version, reusedFullBuild: true, cases: [] };
for (const count of [16, 17, 64]) for (const taper of [false, true]) {
  const degree = 3, knots = [...Array(4).fill(0), ...Array.from({ length: count - degree - 1 }, (_, i) => (i + 1) / (count - degree)), ...Array(4).fill(1)];
  const guide = { kind: 'nurbs', degree, knots, controlPoints: Array.from({ length: count }, (_, i) => [0, 0, i / (count - 1)]) };
  const input = { id: 'L', name: 'L', sections: [{ profile: square(1), z: 0 }, { profile: square(taper ? 2 : 1), z: 1 }], guide };
  const name = `cubic-${count}-${taper ? 'taper' : 'prism'}`, saved = structuredClone(input), made = loftSolid(input), brep = made.brep;
  const expected = taper ? { volume: 7 / 3, centroid: [45 / 56, 45 / 56, 17 / 28], inertia: [[4927 / 6720, -97 / 2240, -97 / 1120], [-97 / 2240, 4927 / 6720, -97 / 1120], [-97 / 1120, -97 / 1120, 3763 / 3360]].map(row => row.map(x => x / 1000)) } : { volume: 1, centroid: [0.5, 0.5, 0.5], inertia: [[1 / 6000, 0, 0], [0, 1 / 6000, 0], [0, 0, 1 / 6000]] };
  const checked = outcome(() => checkBrep(brep, { strict: true })), side = brep.faces.find(f => f.name === 'L.side1').surface;
  const record = { name, input, expected, maximumSurfacePoles: Math.max(...brep.faces.map(f => f.surface.controlPoints[0].length)), mass: outcome(() => made.mass(1)), strictCheck: checked, nativeSidePoint: outcome(() => evaluateSurface(side, 0.5, 0.5)), tessellation: outcome(() => { const m = tessellateBrep(brep, { segmentsPerQuarter: 8 }); return { positions: m.positions.length, indices: m.indices.length }; }), inputUnchanged: JSON.stringify(input) === JSON.stringify(saved) };
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 'a', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [1, 1] }, { id: 'b', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [taper ? 2 : 1, taper ? 2 : 1] }, { id: 'L', kind: 'loft', sections: [{ sketch: 'a', z: 0 }, { sketch: 'b', z: 1 }], guide }] };
  record.part = outcome(() => { const output = evaluateCadPart(doc).outputs.at(-1); return { check: checkOutput(output), mass: massPropertiesOf(output) }; });
  writeFileSync(new URL(`./${name}.brep.json.gz`, import.meta.url), gzipSync(JSON.stringify(brep), { level: 9 }));
  result.cases.push(record); writeFileSync(new URL('./baseline-results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ name, maximumSurfacePoles: record.maximumSurfacePoles, strictValid: checked.returned?.valid, checkError: checked.threw?.message, firstIssue: checked.returned?.issues[0], mass: record.mass.returned?.volume, pointError: record.nativeSidePoint.threw?.message, tessellationError: record.tessellation.threw?.message }));
}
