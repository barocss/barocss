import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { brepMassProperties, checkBrep, importStep, stepValidationProperties, CadNumericPolicy, type Brep } from '@barocss/cad';
import { cylinderPart, withNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc, exportStudioStep, partBreps } from '../src/engine/evaluate';
import { offsetFaceCommand } from '../src/app/profileCommands';
import type { Ctx } from '../src/app/commands';
import { wholePatchTest } from '../../barocss-cad/src/brep/brep-mass-quadrature';

type Rational = { n: bigint; d: bigint };
type Reference = { volume: Rational; centroid: Rational[]; nodeCount: number };
// Shared independent test arithmetic imports no product code. Dynamic URL keeps this JS helper outside TS source.
const oracleUrl = resolve(import.meta.dirname, '../../barocss-cad/test/helpers/native-quadrature-oracle.mjs');
const oracle = await import(oracleUrl) as {
  nativeCylinderNodes(brep: Brep): Reference;
  assertNearRational(actual: number, expected: Rational, tolerance: number, label: string): void;
};
const timestamp = '2026-10-30T00:00:00';
function native(doc: StudioDoc): Brep { const bodies = partBreps(doc); assert.equal(bodies.length, 1); return bodies[0].brep; }
function levels(brep: Brep): number[] { return [Math.min(...brep.vertices.map(v => v.point[2])), Math.max(...brep.vertices.map(v => v.point[2]))]; }
function source(): StudioDoc { return withNode(cylinderPart(3, 5.00009), { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [.1234567, -.2345678, .3456789] }); }
function thin(doc: StudioDoc): StudioDoc {
  const evaluated = evaluateDoc(doc, 0); assert.ok(evaluated.ok, JSON.stringify(evaluated)); assert.equal(evaluated.bodies.length, 1);
  const face = evaluated.bodies[0].mesh.faces.findIndex(f => f.kind === 'plane' && f.normal[2] === 1); assert.ok(face >= 0);
  const ctx: Ctx = { doc, bodies: evaluated.bodies, selection: { faces: [{ body: 0, face }], edges: [], bodies: [] } };
  const before = structuredClone(ctx.selection), result = offsetFaceCommand.build!(ctx, { d: -5.00009 });
  assert.deepEqual(ctx.selection, before); assert.deepEqual(result.nodes.slice(0, doc.nodes.length), doc.nodes);
  assert.equal(result.nodes.at(-1)?.kind, 'difference'); return result;
}
function verifyStep(doc: StudioDoc, expectedLevels: number[]) {
  const before = structuredClone(doc), brep = native(doc), nativeBefore = structuredClone(brep), check = checkBrep(brep, { strict: true });
  assert.equal(check.valid, true); assert.equal(brep.bodies.length, 1); assert.equal(brep.bodies[0].kind, 'solid'); assert.equal(brep.shells.length, 1); assert.equal(brep.shells[0].closed, true);
  assert.deepEqual(levels(brep), expectedLevels); assert.equal(brep.faces.length, 4);
  const reference = oracle.nativeCylinderNodes(brep), guide = Math.PI * 9 * (expectedLevels[1] - expectedLevels[0]); assert.equal(reference.nodeCount, 572);
  // This is exactly the Model function called by the actual engine.step worker. It supplies BReps, not upright mass.
  const written = exportStudioStep(doc, { name: 'D344 target-only native cylinder', timestamp });
  assert.ok(written.text.includes("SI_UNIT(.MILLI.,.METRE.)"));
  assert.match(written.text, /VOLUME_UNIT\(\)/); assert.match(written.text, /AREA_UNIT\(\)/); assert.ok(written.text.includes(`source revision ${written.source}`));
  const properties = stepValidationProperties(written.text); assert.ok(properties.volume !== undefined); assert.ok(properties.area !== undefined); assert.ok(properties.centroid); assert.ok(properties.box);
  oracle.assertNearRational(properties.volume, reference.volume, 1e-11 * guide, 'STEP native stored-node volume');
  assert.ok(Math.abs(properties.volume / guide - 1) < 1e-11, 'Rounded circle volume guide is separate from the independent native-node reference');
  for (let axis = 0; axis < 3; axis++) oracle.assertNearRational(properties.centroid[axis], reference.centroid[axis], 1e-7, `STEP centroid ${axis}`);
  assert.ok(properties.centroid[2] >= expectedLevels[0] && properties.centroid[2] <= expectedLevels[1]);
  // Metadata bounds include sampled extrema; an outward D0 rounding step is not an authored cap plane.
  const box = properties.box;
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(Number.isFinite(box.min[axis]) && Number.isFinite(box.max[axis]) && box.min[axis] <= box.max[axis]);
    for (const vertex of brep.vertices) assert.ok(box.min[axis] <= vertex.point[axis] && vertex.point[axis] <= box.max[axis]);
  }
  assert.ok(box.min[2] <= expectedLevels[0] && box.max[2] >= expectedLevels[1]);
  assert.ok(expectedLevels[0] - box.min[2] <= CadNumericPolicy.linearTolerance);
  assert.ok(box.max[2] - expectedLevels[1] <= CadNumericPolicy.linearTolerance);
  const raw = brepMassProperties(brep, 1); assert.equal(raw.method, 'quadrature');
  assert.equal(properties.volume, raw.volume, 'STEP default metadata uses native BRep volume, without upright mass override');
  // Keep the physical residue. A refusal or collapsed readback is a failure, not a larger replacement fixture.
  const back = importStep(written.text); assert.equal(checkBrep(back, { strict: true }).valid, true);
  assert.equal(back.bodies.length, 1); assert.equal(back.bodies[0].kind, 'solid'); assert.equal(back.shells.length, 1); assert.equal(back.shells[0].closed, true);
  assert.deepEqual(levels(back), expectedLevels, 'STEP preserves both exact native cap levels');
  assert.equal(back.faces.length, brep.faces.length); assert.deepEqual(back.faces.map(f => f.name).sort(), brep.faces.map(f => f.name).sort());
  // Imported support patches may use a distinct trimmed/fallback route. Observe it without using it as the export oracle.
  const importedMass = brepMassProperties(back, 1), importedWhole = wholePatchTest(back);
  const importedProvider = { mass: importedMass, wholePatchFaces: back.faces.filter(importedWhole).map(f => f.name),
    relativeVolumeDifferenceToRoundedCircleGuide: importedMass.volume / guide - 1,
    scope: 'Separate imported-geometry provider observation; no claim that D344 repairs every trimmed/fallback mass route' };
  assert.deepEqual(doc, before); assert.deepEqual(brep, nativeBefore);
  return { source: written.source, properties, nativeMass: raw, importedProvider, nativeLevels: levels(brep), readbackLevels: levels(back), nativeFaces: brep.faces.length, readbackFaces: back.faces.length, referenceNodes: reference.nodeCount, scope: 'Target-only default STEP metadata and strict native readback; no material mass or UI-pixel claim' };
}

test('native quadrature STEP: actual Offset residue writes independent native metadata and preserves four-ULP cap levels', t => {
  const original = source(), before = structuredClone(original), accepted = thin(original);
  const result = verifyStep(accepted, [.3456789, .34567890000000023]); assert.deepEqual(original, before);
  t.diagnostic(JSON.stringify(result));
});

test('native quadrature STEP: ordinary translated target keeps default geometric units and metadata', t => {
  const doc = source(), brep = native(doc); t.diagnostic(JSON.stringify(verifyStep(doc, levels(brep))));
});
