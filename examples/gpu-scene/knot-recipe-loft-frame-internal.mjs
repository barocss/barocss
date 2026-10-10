import assert from 'node:assert/strict';

const coefficients = curve => ({
  degree: curve.degree, knots: curve.knots, controlPoints: curve.controlPoints, weights: curve.weights,
});

function selectedCurve(model, index, curveId) {
  assert.equal(model.version, 0);
  assert.equal(model.lengthUnit, 'mm');
  assert.equal(model.objects.findIndex(object => object.id === curveId), index);
  const curve = model.objects[index];
  assert.equal(curve.kind, 'curve');
  assert.equal(curve.id, curveId);
  return curve;
}

/** Whole authored-graph CPU composition; neither a raw-result reader nor a renderer. */
export function prepareRecipeLoftFrame(cad, gpu, current) {
  // One public whole validation reconstructs the graph and returns REPORT only.
  const validationReport = cad.validateSourceKnotRecipeLoftGraph(current);
  assert.deepStrictEqual(validationReport, current.report);
  assert.notStrictEqual(validationReport, current.report);
  const document = current.document, terminal = current.terminal;
  assert.equal(document.format, 'barocss-source-knot-recipe-loft-graph');
  assert.equal(document.version, 0);
  assert.equal(document.lengthUnit, 'mm');
  assert.equal(document.sourceFrame, 'authored-xyz-no-axis-conversion');
  assert.equal(current.bindings.graphId, document.id);
  assert.equal(current.bindings.revision, document.revision);
  assert.equal(document.assets.length, 3);
  assert.equal(document.sourceEdits.length, 3);
  assert.equal(current.sourceEdits.length, 3);
  assert.equal(current.refinement.length, 3);
  assert.equal(current.bindings.sources.length, 3);
  assert.equal(document.refinement.suppressed, false, 'This consumer retains the active MAIN recipe');
  assert.equal(current.bindings.refinement.nodeId, document.refinement.id);
  assert.equal(current.bindings.refinement.status, 'active');
  assert.deepStrictEqual(current.bindings.refinement.inputNodeIds, document.terminal.sections);
  assert.equal(current.bindings.terminal.nodeId, document.terminal.id);
  assert.deepStrictEqual(current.bindings.terminal.sectionNodeIds, document.terminal.sections);
  assert.deepStrictEqual(current.bindings.terminal.constructionSectionIds,
    document.terminal.options.constructionSectionIds);
  assert.deepStrictEqual(current.bindings.terminal.sections, terminal.bindings.sections);
  assert.deepStrictEqual(current.bindings.terminal.output, terminal.bindings.output);
  assert.equal(terminal.report.insertionCount, 0);
  assert.equal(terminal.report.directCounts.sourceInsertionCallCount, 0);
  assert.equal(terminal.plan.insertionCount, 0);
  assert.equal(terminal.insertions.length, 0);
  assert.equal(terminal.loft.sourceVersion, 0);
  assert.equal(terminal.loft.model.name, document.terminal.options.modelName);
  assert.equal(terminal.loft.model.objects.length, 4);
  assert.equal(terminal.loft.sections.length, 3);
  assert.deepStrictEqual(terminal.request.parametersV, document.terminal.parametersV);
  assert.deepStrictEqual(terminal.loft.parametersV, document.terminal.parametersV);

  const assets = new Map(document.assets.map(asset => [asset.sourceId, asset]));
  const nodes = new Map(document.sourceEdits.map((node, index) => [node.id, {
    node, scalar: current.sourceEdits[index],
  }]));
  const bindings = new Map(current.bindings.sources.map(binding => [binding.nodeId, binding]));
  assert.equal(assets.size, 3);
  assert.equal(nodes.size, 3);
  assert.equal(bindings.size, 3);
  const constructionCurves = document.terminal.sections.map((nodeId, sectionIndex) => {
    const { node, scalar } = nodes.get(nodeId), binding = bindings.get(nodeId);
    const asset = assets.get(node.sourceId), refined = current.refinement[sectionIndex];
    assert.equal(binding.sourceId, asset.sourceId);
    assert.equal(binding.curveId, asset.curveId);
    assert.equal(binding.terminalSectionIndex, sectionIndex);
    assert.equal(binding.scalarObjectIndex, scalar.report.selectedObjectIndex);
    assert.equal(binding.status, 'refined');
    assert.equal(asset.sourceVersion, 0);
    assert.deepStrictEqual(scalar.request, {
      source: asset.source, sourceVersion: 0, curveId: asset.curveId, edits: node.edits,
    });
    selectedCurve(scalar.originalModel, binding.scalarObjectIndex, asset.curveId);
    assert.deepStrictEqual(selectedCurve(scalar.model, binding.scalarObjectIndex, asset.curveId), scalar.curve);
    assert.notEqual(refined, null);
    assert.deepStrictEqual(refined.request, {
      source: scalar.source, sourceVersion: 0, curveId: asset.curveId,
      knot: document.refinement.knot, maximumObservations: 128,
    });
    assert.deepStrictEqual(refined.originalModel, scalar.model);
    assert.deepStrictEqual(refined.originalCurve, scalar.curve);
    assert.equal(binding.modelName, refined.model.name);
    assert.equal(binding.objectIndex, refined.provenance.selectedObjectIndex);
    assert.deepStrictEqual(selectedCurve(refined.model, binding.objectIndex, binding.curveId), refined.curve);

    const original = terminal.originalSources[sectionIndex], aligned = terminal.alignedSections[sectionIndex];
    assert.equal(original.index, sectionIndex);
    assert.equal(original.sourceId, asset.sourceId);
    assert.equal(original.sourceVersion, 0);
    assert.equal(original.source, refined.source);
    assert.deepStrictEqual(original.model, refined.model);
    assert.deepStrictEqual(terminal.request.assets[sectionIndex], {
      sourceId: asset.sourceId, sourceVersion: 0, source: refined.source, curveId: asset.curveId,
    });
    assert.deepStrictEqual(aligned, original);
    const section = terminal.bindings.sections[sectionIndex];
    assert.equal(section.index, sectionIndex);
    const reference = { sourceId: asset.sourceId, modelName: refined.model.name,
      curveId: asset.curveId, objectIndex: binding.objectIndex };
    assert.deepStrictEqual(section.original, reference);
    assert.deepStrictEqual(section.aligned, reference);
    assert.equal(section.coefficientsIdenticalToAligned, true);
    assert.deepStrictEqual(section.construction, {
      sourceId: document.terminal.options.constructionSourceId,
      modelName: terminal.loft.model.name,
      curveId: document.terminal.options.constructionSectionIds[sectionIndex], objectIndex: sectionIndex,
    });
    const construction = selectedCurve(terminal.loft.model, sectionIndex, section.construction.curveId);
    assert.equal(construction.degree, 5);
    assert.deepStrictEqual(coefficients(construction), coefficients(refined.curve));
    assert.deepStrictEqual(construction, terminal.loft.sections[sectionIndex]);
    return construction;
  });

  const output = terminal.bindings.output;
  assert.deepStrictEqual(output, {
    sourceId: document.terminal.options.constructionSourceId, modelName: terminal.loft.model.name,
    surfaceId: document.terminal.options.surfaceId, objectIndex: 3,
  });
  assert.equal(current.bindings.terminal.sourceId, output.sourceId);
  assert.equal(current.bindings.terminal.modelName, output.modelName);
  assert.equal(current.bindings.terminal.surfaceId, output.surfaceId);
  const surface = terminal.loft.model.objects[3];
  assert.equal(surface.kind, 'surface');
  assert.equal(surface.id, output.surfaceId);
  assert.deepStrictEqual(surface, terminal.loft.surface);
  assert.equal(surface.degreeU, 5);
  assert.equal(surface.degreeV, 1);
  assert.deepStrictEqual(surface.knotsU, terminal.plan.knots);
  for (const [index, curve] of constructionCurves.entries()) {
    assert.equal(surface.controlPoints.length, curve.controlPoints.length);
    for (let pole = 0; pole < curve.controlPoints.length; pole++) {
      assert.deepStrictEqual(surface.controlPoints[pole][index], curve.controlPoints[pole]);
      assert.equal(surface.weights[pole][index], curve.weights[pole]);
    }
  }

  const surfacePreview = cad.tessellateSurface(surface, {
    countU: 9, countV: 9, revision: document.revision,
  });
  const curvePreviews = constructionCurves.map(curve => {
    const preview = gpu.prepareSelectedUniformCurvePreview({ source: terminal.loft.source, curveId: curve.id, count: 129 });
    assert.equal(preview.source, terminal.loft.source);
    assert.equal(preview.curveId, curve.id);
    assert.deepStrictEqual(preview.model, terminal.loft.model);
    return preview;
  });
  const curveColors = [[1, .2, .1], [.2, 1, .1], [.8, .2, 1]];
  const entries = [{ kind: 'surface', packet: surfacePreview.packet, color: [.2, .5, .8],
    ref: { modelId: output.modelName, geometryId: output.surfaceId } },
  ...curvePreviews.map((sample, index) => ({
    kind: 'curve', sampleVersion: 3, sample, basis: 'authored-xyz-matches-rhyup', color: curveColors[index],
    ref: { modelId: output.modelName, geometryId: constructionCurves[index].id },
  }))];
  const prepared = gpu.preparePrimitiveSceneFrame({ version: 0, scene: { version: 2, entries },
    particles: null, materials: [], options: {
      mmToSceneUnit: .01, translate: [0, 0, 0], background: [.02, .04, .06],
      camera: { eye: [1, 1, 6], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100 },
      lighting: { ambientStrength: .35, directionalStrength: .65, direction: [0, 1, 0] },
    } });
  assert.equal(prepared.primitives.length, 4);
  assert.equal(prepared.bufferBytes, 7356);
  // Do not freeze or replace the caller's whole graph or its separate native report.
  return { native: current, validationReport, surfacePreview, curvePreviews, prepared };
}
