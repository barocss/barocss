import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAxisRectangleExtrusion, cad, parseStoredPlateHoleSolid,
  serializeStoredPlateHoleSolid, tessellateOwnPlateCircularHole,
} from '../dist/index.js';
import { qualifyKnownSolid } from '../dist/features/known-solid-qualification.js';
import { mountingPlate } from './modeling-hole-fixture.mjs';

const request = { bodyId: 'qualified_body', profile: { kind: 'rectangle', id: 'qualified_profile', origin: [4, -3], width: 7, height: 5 }, distance: 6 };

test('known Solid qualification delegates to a real axis-box native proof', () => {
  const result = buildAxisRectangleExtrusion(request);
  const certified = qualifyKnownSolid({ family: 'exact-axis-box-solid-v0', source: result.shell });
  assert.equal(certified.status, 'certified');
  assert.equal(certified.family, 'exact-axis-box-solid-v0');
  assert.equal(certified.method, 'exact-safe-integer');
  assert.equal(certified.nativeReport.valid, true);
  assert.equal(certified.nativeReport.volumeMM3, 210);
  assert.equal(certified.nativeReport.areaMM2, 214);
});

test('known Solid qualification refuses missing, invalid and unknown native sources', () => {
  for (const request of [null, 0, 'box', {}, { family: 'unsupported', source: {} }]) {
    const answer = qualifyKnownSolid(request);
    assert.equal(answer.status, 'refused');
    assert.equal(answer.family, 'unsupported');
  }
  const invalid = qualifyKnownSolid({ family: 'exact-axis-box-solid-v0', source: {} });
  assert.equal(invalid.status, 'refused');
  assert.equal(invalid.family, 'exact-axis-box-solid-v0');
  assert.equal(typeof invalid.code, 'string');
  assert.equal(typeof invalid.detail, 'string');
});

test('known Solid qualification admits the actual stored-rational plate hole after file reopen', () => {
  const authored = mountingPlate(cad).build();
  const reopened = cad.load(authored.save());
  const source = reopened.bodies.plate.native;
  const answer = qualifyKnownSolid({ family: 'restricted-stored-rational-plate-hole-solid', source: source.bundle });
  assert.equal(answer.status, 'certified');
  assert.equal(answer.kind, 'solid');
  assert.equal(answer.method, 'stored-rational-family-proof');
  assert.equal(answer.nativeReport.solid, true);
  assert.equal(answer.nativeReport.topologyCertified, true);
  assert.equal(answer.nativeReport.embeddedStoredGeometryCertified, true);
  assert.deepEqual([
    answer.nativeReport.faceCount, answer.nativeReport.vertexCount,
    answer.nativeReport.edgeCount, answer.nativeReport.loopCount,
  ], [7, 10, 15, 9]);

  const nativeFile = serializeStoredPlateHoleSolid(source);
  const nativeReopened = parseStoredPlateHoleSolid(nativeFile);
  const nativeAnswer = qualifyKnownSolid({ family: 'restricted-stored-rational-plate-hole-solid', source: nativeReopened.bundle });
  assert.equal(nativeAnswer.status, 'certified');
  assert.deepEqual(nativeAnswer.nativeReport, answer.nativeReport);
});

test('known Solid qualification refuses broken plate-hole orientation and directed loop', () => {
  const bundle = mountingPlate(cad).build().bodies.plate.native.bundle;
  const reversedCap = structuredClone(bundle);
  reversedCap.faces.find(face => face.role === 'top-cap').orientation = 'reverse';
  const brokenLoop = structuredClone(bundle);
  const inner = brokenLoop.topology.loops.find(loop => loop.role === 'inner');
  inner.uses[0].sense = inner.uses[0].sense === 'forward' ? 'reverse' : 'forward';

  for (const source of [reversedCap, brokenLoop]) {
    const answer = qualifyKnownSolid({ family: 'restricted-stored-rational-plate-hole-solid', source });
    assert.equal(answer.status, 'refused');
    assert.equal(answer.family, 'restricted-stored-rational-plate-hole-solid');
    assert.equal(typeof answer.code, 'string');
    assert.equal(typeof answer.detail, 'string');
    assert.equal(Object.hasOwn(answer, 'nativeReport'), false);
  }
});

test('sampled plate-hole preview alone is not a qualified Solid', () => {
  const bundle = mountingPlate(cad).build().bodies.plate.native.bundle;
  const preview = tessellateOwnPlateCircularHole(bundle, {
    context: {
      documentId: 'known_solid', bodyId: bundle.request.bodyId,
      documentRevision: 'one', kernelResultRevision: 'one',
      topologyRevision: 'one', taskToken: 'preview',
    },
    segmentsPerQuarter: 4,
  });
  assert.equal(preview.report.solid, false);
  const answer = qualifyKnownSolid({ family: 'restricted-stored-rational-plate-hole-solid', source: preview });
  assert.equal(answer.status, 'refused');
  assert.equal(Object.hasOwn(answer, 'nativeReport'), false);
});
