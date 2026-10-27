import test from 'node:test';
import assert from 'node:assert/strict';
import { compressionSpring, evaluateCadPart, hookedSpring, massPropertiesOf, outputOf, tessellateBrep } from '@barocss/cad';
import type { BodyResult } from '../src/engine/evaluate';
import { emptyDoc, starterDoc } from '../src/engine/doc';
import { springsSource } from '../src/drawing/elementTables';
import { sectionOf } from '../src/drawing/section';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
// Isolated consumer fixture: only key and element are read. Reports below come from the real local kernel.
const body = (key: string, report: ReturnType<typeof compressionSpring>['report'] | ReturnType<typeof hookedSpring>['report']) => ({ key, element: { kind: 'spring', report } }) as BodyResult;

test('R7 local kernel boundary: 10 mm cube at density 2.7 gives 1000 mm³, 2.7 g and 45 g·mm²; tessellation uses positions', () => {
  const snapshot = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }] });
  const output = outputOf(snapshot, 'e'), mass = massPropertiesOf(output, 2.7);
  near(mass.volume, 1000); near(mass.mass, 2.7); mass.centroid.forEach(v => near(v, 5));
  mass.inertia.forEach((row, i) => row.forEach((v, j) => near(v, i === j ? 45 : 0)));
  const mesh = tessellateBrep(output.brep, { segmentsPerQuarter: 4 });
  assert.ok(mesh.positions.length > 0 && [...mesh.positions].every(Number.isFinite));
  assert.ok(!('positionsMM' in mesh));
  for (let k = 0; k < 3; k++) { const values = [...mesh.positions].filter((_, i) => i % 3 === k); near(Math.min(...values), 0); near(Math.max(...values), 10); }
});

test('R7 drawing compression table: unchanged lengths and k = 80000·2⁴/(8·20³·8) = 2.5 N/mm', () => {
  const { report } = compressionSpring({ wireDiameter: 2, meanDiameter: 20, activeCoils: 8, pitch: 5, ends: 'open', shearModulus: 80000 });
  const table = springsSource({ doc: emptyDoc(), bodies: [body('compression', report)] }); assert.ok(!('error' in table));
  assert.deepEqual(table.rows[0].slice(0, 6), ['compression', 'compression', 2, 20, 22, 8]);
  near(table.rows[0][12] as number, 2.5);
  assert.equal(table.columns[2].unit, 'mm'); assert.equal(table.columns[12].unit, 'N/mm');
  assert.ok(table.notes?.some(n => n === 'compression: G 80000 MPa'));
});

test('R7 drawing torsion table: Ed⁴/(64Dn)·π/180 is displayed in N·mm/degree; no per-radian twin', () => {
  const E = 200000, d = 2, D = 20, n = 5.25;
  const { report } = hookedSpring({ type: 'torsion', wireDiameter: d, meanDiameter: D, activeCoils: n, legLengths: [15, 25], youngsModulus: E, moment: 500 });
  const expected = E * d ** 4 / (64 * D * n) * Math.PI / 180;
  near(report.dimensions.torsionalRate!, expected);
  assert.ok(!('torsionalRateNmmPerRad' in report.dimensions) && !('torsionalRateNmmPerDeg' in report.dimensions));
  const table = springsSource({ doc: emptyDoc(), bodies: [body('torsion', report)] }); assert.ok(!('error' in table));
  assert.equal(table.rows[0][12], null, 'torsional stiffness is not a linear N/mm rate');
  assert.ok(table.notes?.includes(`torsion: torsional rate ${+expected.toPrecision(4)} N·mm/°`));
  assert.ok(table.notes?.some(n => n === 'torsion: E 200000 MPa'));
  assert.ok(table.notes?.every(n => !n.includes('/rad')));
});

test('R7 section free-function and mesh consumers retain the starter plate cut at Z 4', () => {
  const section = sectionOf(starterDoc(), -4, 'y-', 'top', undefined, undefined, true);
  assert.ok(section.ok, section.ok ? '' : section.error); if (!section.ok) return;
  assert.deepEqual(section.projection.min, [0, 0]); assert.deepEqual(section.projection.max, [64, 32]);
  assert.equal(section.rings.length, 2, 'rectangle and diameter 8 hole');
  const arcs = section.projection.edges.flatMap(e => e.pieces).filter(p => p.curve.kind === 'arc');
  assert.ok(arcs.length);
  for (const p of arcs) if (p.curve.kind === 'arc') { near(p.curve.center[0], 32); near(p.curve.center[1], 16); near(Math.hypot(...p.curve.u), 4); }
});
