import assert from 'node:assert/strict';

function selectedSurface(model, index, surfaceId) {
  assert.equal(model.version, 0);
  assert.equal(model.lengthUnit, 'mm');
  assert.equal(model.objects.findIndex(object => object.id === surfaceId), index);
  const surface = model.objects[index];
  assert.equal(surface.kind, 'surface');
  assert.equal(surface.id, surfaceId);
  return surface;
}

/** Sequential native source/display composition only; no raw-result codec or renderer. */
export function prepareSurfaceElevationFrame(cad, gpu, elevation, options) {
  // Public whole validation reconstructs one elevation and returns REPORT, not native authority.
  const validationReport = cad.validateSourceSurfaceAxisDegreeElevation(elevation);
  assert.deepStrictEqual(validationReport, elevation.report);
  assert.notStrictEqual(validationReport, elevation.report);
  assert(options !== null && typeof options === 'object', 'An explicit stage is required');
  const { stage, edit } = options;
  assert(['original', 'elevated', 'edited'].includes(stage), 'Unsupported Surface frame stage');
  assert(stage === 'edited' ? edit !== undefined && edit !== null : edit === undefined,
    'Only the edited stage admits a separate native edit');
  assert.equal(elevation.request.sourceVersion, 0);
  assert.equal(elevation.request.surfaceId, 'main_surface');
  assert.equal(elevation.request.axis, 'u');
  assert.equal(elevation.request.targetDegree, 5);
  assert.equal(elevation.request.maximumObservations, 1024);
  const index = elevation.provenance.selectedObjectIndex;
  assert.equal(index, 1);
  assert.equal(elevation.report.selectedObjectIndex, index);
  assert.equal(elevation.originalModel.name, 'original_surface_degree_model');
  assert.equal(elevation.model.name, elevation.originalModel.name);
  assert.equal(elevation.report.modelName, elevation.model.name);
  assert.equal(elevation.report.surfaceId, elevation.request.surfaceId);
  assert.equal(elevation.originalModel.objects.length, 3);
  assert.equal(elevation.model.objects.length, 3);
  assert.deepStrictEqual(selectedSurface(elevation.originalModel, index, elevation.request.surfaceId),
    elevation.originalSurface);
  assert.deepStrictEqual(selectedSurface(elevation.model, index, elevation.request.surfaceId), elevation.surface);
  assert.equal(elevation.originalSurface.degreeU, 4);
  assert.equal(elevation.originalSurface.degreeV, 4);
  assert.equal(elevation.surface.degreeU, 5);
  assert.equal(elevation.surface.degreeV, 4);
  assert.deepStrictEqual(elevation.report.domain, { u: [-0, 3], v: [-2, 2] });
  assert.deepStrictEqual(elevation.model.objects[0], elevation.originalModel.objects[0]);
  assert.deepStrictEqual(elevation.model.objects[2], elevation.originalModel.objects[2]);
  assert.equal(elevation.model.objects[0].kind, 'curve');
  assert.equal(elevation.model.objects[0].id, 'surface_elevation_strip_0');
  assert.equal(elevation.model.objects[2].kind, 'surface');
  assert.equal(elevation.model.objects[2].id, 'unrelated_surface');

  let editValidationReport = null;
  let model = stage === 'original' ? elevation.originalModel : elevation.model;
  let surface = stage === 'original' ? elevation.originalSurface : elevation.surface;
  if (stage === 'edited') {
    editValidationReport = cad.validateSourceSurfaceControlNetWideEdit(edit);
    assert.deepStrictEqual(editValidationReport, edit.report);
    assert.notStrictEqual(editValidationReport, edit.report);
    assert.equal(edit.request.source, elevation.source);
    assert.equal(edit.request.sourceVersion, 0);
    assert.equal(edit.request.surfaceId, elevation.surface.id);
    assert.deepStrictEqual(edit.originalModel, elevation.model);
    assert.equal(edit.report.selectedObjectIndex, index);
    assert.equal(edit.model.name, elevation.model.name);
    assert.equal(edit.model.objects.length, elevation.model.objects.length);
    assert.deepStrictEqual(selectedSurface(edit.model, index, elevation.surface.id), edit.surface);
    assert.equal(edit.surface.degreeU, elevation.surface.degreeU);
    assert.equal(edit.surface.degreeV, elevation.surface.degreeV);
    assert.deepStrictEqual(edit.surface.knotsU, elevation.surface.knotsU);
    assert.deepStrictEqual(edit.surface.knotsV, elevation.surface.knotsV);
    assert.deepStrictEqual(edit.surface.weights, elevation.surface.weights);
    assert.deepStrictEqual(edit.model.objects[0], elevation.model.objects[0]);
    assert.deepStrictEqual(edit.model.objects[2], elevation.model.objects[2]);
    model = edit.model;
    surface = edit.surface;
  }
  const revision = stage === 'original' ? 0 : stage === 'elevated' ? 1 : 2;
  const surfacePreview = cad.tessellateSurface(surface, { countU: 9, countV: 9, revision });
  assert.equal(surfacePreview.packet.surfaceId, surface.id);
  assert.equal(surfacePreview.packet.revision, revision);
  // This example declares authored XYZ to match right-handed Y-up; no axis conversion occurs.
  const prepared = gpu.preparePrimitiveSceneFrame({
    version: 0,
    scene: { version: 2, entries: [{
      kind: 'surface', packet: surfacePreview.packet, color: [.2, .5, .8],
      ref: { modelId: model.name, geometryId: surface.id },
    }] },
    particles: null,
    materials: [],
    options: {
      mmToSceneUnit: .01, translate: [0, 0, 0], background: [.02, .04, .06],
      camera: { eye: [1, 1, 6], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100 },
      lighting: { ambientStrength: .35, directionalStrength: .65, direction: [0, 1, 0] },
    },
  });
  assert.equal(prepared.primitives.length, 1);
  assert.equal(prepared.bufferBytes, 2712);
  // Caller native data and independently mutable reports are retained without freezing or replacement.
  return { native: elevation, nativeEdit: edit ?? null, validationReport, editValidationReport, surfacePreview, prepared };
}
