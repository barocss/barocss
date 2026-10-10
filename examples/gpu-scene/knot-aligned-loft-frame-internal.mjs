import assert from 'node:assert/strict';

function curveCoefficients(curve) {
  return { degree: curve.degree, knots: curve.knots, controlPoints: curve.controlPoints, weights: curve.weights };
}

function boundCurve(context, reference) {
  assert.equal(context.sourceVersion, 0);
  assert.equal(context.sourceId, reference.sourceId);
  assert.equal(context.model.name, reference.modelName);
  assert.equal(context.model.version, 0);
  assert.equal(context.model.lengthUnit, 'mm');
  assert.equal(context.model.objects.findIndex(object => object.id === reference.curveId), reference.objectIndex);
  const curve = context.model.objects[reference.objectIndex];
  assert.equal(curve.kind, 'curve');
  assert.equal(curve.id, reference.curveId);
  return curve;
}

/** Private source-builder composition only; no external raw-result or rendering admission. */
export function prepareSourceLoftFrame(cad, gpu, request) {
  const native = cad.buildSourceKnotAlignedLoft(request);
  // This public whole validator reconstructs another complete builder call and returns REPORT.
  const validationReport = cad.validateSourceKnotAlignedLoft(native);
  assert.deepStrictEqual(validationReport, native.report);
  assert.equal(native.originalSources.length, 3);
  assert.equal(native.alignedSections.length, 3);
  assert.equal(native.bindings.sections.length, 3);
  assert.equal(native.loft.sourceVersion, 0);
  assert.equal(native.loft.model.version, 0);
  assert.equal(native.loft.model.lengthUnit, 'mm');
  assert.equal(native.loft.model.name, native.request.options.modelName);
  assert.equal(native.loft.model.objects.length, 4);
  assert.equal(native.loft.sections.length, 3);
  assert.deepStrictEqual(native.loft.parametersV, native.request.parametersV);

  const constructionCurves = native.bindings.sections.map((binding, index) => {
    assert.equal(binding.index, index);
    const original = native.originalSources[index], aligned = native.alignedSections[index];
    assert.equal(original.index, index);
    assert.equal(aligned.index, index);
    assert.equal(original.sourceId, native.request.assets[index].sourceId);
    assert.equal(original.source, native.request.assets[index].source);
    const originalCurve = boundCurve(original, binding.original);
    assert.equal(originalCurve.id, native.request.assets[index].curveId);
    assert.equal(aligned.sourceId, original.sourceId);
    const alignedCurve = boundCurve(aligned, binding.aligned);
    assert.equal(alignedCurve.id, originalCurve.id);
    assert.equal(binding.construction.sourceId, native.request.options.constructionSourceId);
    assert.equal(binding.construction.modelName, native.loft.model.name);
    assert.equal(binding.construction.objectIndex, index);
    assert.equal(binding.construction.curveId, native.request.options.constructionSectionIds[index]);
    const construction = native.loft.model.objects[binding.construction.objectIndex];
    assert.equal(construction.kind, 'curve');
    assert.equal(construction.id, binding.construction.curveId);
    assert.equal(construction.degree, 5, 'This MAIN consumer uses the actual degree-five selected profile');
    assert.equal(binding.coefficientsIdenticalToAligned, true);
    assert.deepStrictEqual(curveCoefficients(construction), curveCoefficients(alignedCurve));
    assert.deepStrictEqual(construction, native.loft.sections[index]);
    assert.equal(construction.degree, native.plan.degree);
    assert.deepStrictEqual(construction.knots, native.plan.knots);
    return construction;
  });

  const output = native.bindings.output;
  assert.equal(output.sourceId, native.request.options.constructionSourceId);
  assert.equal(output.modelName, native.loft.model.name);
  assert.equal(output.objectIndex, 3);
  assert.equal(output.surfaceId, native.request.options.surfaceId);
  const surface = native.loft.model.objects[output.objectIndex];
  assert.equal(surface.kind, 'surface');
  assert.equal(surface.id, output.surfaceId);
  assert.deepStrictEqual(surface, native.loft.surface);
  assert.equal(surface.degreeU, native.plan.degree);
  assert.equal(surface.degreeV, 1);
  assert.deepStrictEqual(surface.knotsU, native.plan.knots);
  for (let index = 0; index < constructionCurves.length; index++) {
    const curve = constructionCurves[index];
    assert.equal(surface.controlPoints.length, curve.controlPoints.length);
    for (let pole = 0; pole < curve.controlPoints.length; pole++) {
      assert.deepStrictEqual(surface.controlPoints[pole][index], curve.controlPoints[pole]);
      assert.equal(surface.weights[pole][index], curve.weights[pole]);
    }
  }

  const surfacePreview = cad.tessellateSurface(native.loft.surface, { countU: 9, countV: 9, revision: 0 });
  assert.equal(surfacePreview.packet.surfaceId, output.surfaceId);
  const curvePreviews = native.bindings.sections.map(binding => {
    const preview = gpu.prepareSelectedUniformCurvePreview({
      source: native.loft.source, curveId: binding.construction.curveId, count: 129,
    });
    assert.equal(preview.source, native.loft.source);
    assert.equal(preview.sourceVersion, 0);
    assert.equal(preview.model.name, binding.construction.modelName);
    assert.equal(preview.curveId, binding.construction.curveId);
    assert.equal(preview.count, 129);
    assert.deepStrictEqual(preview.model, native.loft.model);
    return preview;
  });
  const curveColors = [[1, .2, .1], [.2, 1, .1], [.8, .2, 1]];
  const entries = [{
    kind: 'surface', packet: surfacePreview.packet, color: [.2, .5, .8],
    ref: { modelId: output.modelName, geometryId: output.surfaceId },
  }, ...curvePreviews.map((sample, index) => ({
    kind: 'curve', sampleVersion: 3, sample, basis: 'authored-xyz-matches-rhyup',
    color: curveColors[index], ref: {
      modelId: native.bindings.sections[index].construction.modelName,
      geometryId: native.bindings.sections[index].construction.curveId,
    },
  }))];
  const prepared = gpu.preparePrimitiveSceneFrame({
    version: 0, scene: { version: 2, entries }, particles: null, materials: [],
    options: {
      mmToSceneUnit: .01, translate: [0, 0, 0], background: [.02, .04, .06],
      camera: { eye: [1, 1, 6], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100 },
      lighting: { ambientStrength: .35, directionalStrength: .65, direction: [0, 1, 0] },
    },
  });
  // Whole native result and validator report remain separate, mutable owned receipts.
  return { native, validationReport, surfacePreview, curvePreviews, prepared };
}
