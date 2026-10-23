import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node source-knot-recipe-loft-graph-demo.mjs --source <output-directory>');
assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]);
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({ absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
const cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['source-knot-recipe-loft-graph.ts', 'source-curve-knot-insertion.ts', 'source-knot-aligned-loft.ts', 'piecewise-rational-loft.ts', 'source-curve-control-polygon.ts', 'index.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {
  evaluateSourceKnotRecipeLoftGraph: evaluate, updateSourceKnotRecipeLoftGraph: update,
  validateSourceKnotRecipeLoftGraph: validate, validateSourceKnotRecipeLoftGraphUpdate: validateUpdate,
  serializeSourceKnotRecipeLoftGraph: serialize, parseSourceKnotRecipeLoftGraph: parse,
  SourceKnotRecipeLoftGraphError: GraphError, SourceKnotRecipeLoftGraphDiagnosticCode: codes,
  compileCadModel, evaluateCurve, evaluateSurface, evaluateSurfaceD1
} = api;
const runtimeNames = ['evaluateSourceKnotRecipeLoftGraph', 'updateSourceKnotRecipeLoftGraph', 'validateSourceKnotRecipeLoftGraph', 'validateSourceKnotRecipeLoftGraphUpdate', 'serializeSourceKnotRecipeLoftGraph', 'parseSourceKnotRecipeLoftGraph', 'SourceKnotRecipeLoftGraphError', 'SourceKnotRecipeLoftGraphDiagnosticCode'];
const typeNames = ['SourceKnotRecipeLoftGraphV0', 'SourceKnotRecipeLoftGraphOptions', 'SourceKnotRecipeLoftGraphEdits', 'SourceKnotRecipeLoftGraphResult', 'SourceKnotRecipeLoftGraphReport', 'SourceKnotRecipeLoftGraphTransaction', 'SourceKnotRecipeLoftGraphTransactionReport', 'SourceKnotRecipeLoftGraphUpdateResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
for (const name of ['INPUT', 'VERSION', 'IDENTITY', 'REVISION', 'BUDGET', 'OWNED', 'CODEC']) assert.equal(codes[name], name);
const files = new Map(), retained = [], accepted = [], cases = [], updates = [], failures = [];
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
function jsonFile(name, value, maximum = 16777216) {
  const file = resolve(output, name + '.json'), text = nativeJSON(value) + '\n';
  assert.ok(text.length <= maximum && Buffer.byteLength(text) <= maximum, name + ' file size');
  writeFileSync(file, text); files.set(file, readFileSync(file));
  const reopened = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(reopened, value);
  return { file, reopened };
}
function sourceFile(name, source, model) {
  const file = resolve(output, name + '.source0.css');
  assert.ok(source.length <= 262144 && Buffer.byteLength(source) <= 262144, name + ' source size');
  writeFileSync(file, source); files.set(file, readFileSync(file));
  const cold = compileCadModel(readFileSync(file, 'utf8'), { sourceVersion: 0 });
  assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, model);
  return file;
}
function ownership(inputs, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  function collect(value) {
    if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); Object.values(value).forEach(collect); }
  }
  function visit(value) {
    if (value && typeof value === 'object') {
      assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated result occurrence');
      seen.add(value); Object.values(value).forEach(visit);
    }
  }
  inputs.forEach(collect); visit(result);
}
function decimal(value) {
  if (Object.is(value, -0)) return '-0';
  const text = String(value); if (!text.includes('e')) return text;
  const [mantissa, exponentText] = text.split('e'), negative = mantissa.startsWith('-');
  const raw = negative ? mantissa.slice(1) : mantissa, [whole, fraction = ''] = raw.split('.');
  const digits = whole + fraction, place = whole.length + Number(exponentText);
  const expanded = place <= 0 ? '0.' + '0'.repeat(-place) + digits : place >= digits.length ? digits + '0'.repeat(place - digits.length) : digits.slice(0, place) + '.' + digits.slice(place);
  return (negative ? '-' : '') + expanded;
}

const graphOptions = { maximumSourceEdits: 3, maximumRefinementInsertions: 3, maximumLoftSections: 3, maximumProducerEvaluations: 7 };
const size = value => { const text = typeof value === 'string' ? value : nativeJSON(value) + '\n'; return { utf16: text.length, utf8: Buffer.byteLength(text) }; };
const clone = value => structuredClone(value);
function mixedSource(c, label) {
  const list = values => '[ ' + values.map(decimal).join(' , ') + ' ]';
  return '/* original ' + label + ' π; preserve CRLF */\r\n@model original_graph_model { version:0; length-unit:mm;\r\n' +
    '@curve #unused_curve {type:nurbs;degree:1;knots:[-0,/* sibling comment */-0,+1.000,1];control-points:[[-0,-0,-0],[+2.000,3,4]];weights:[1.000,1];}\r\n' +
    '@curve #section_profile {type:nurbs;degree:+5.000; /* outside arrays */ weights:' + list(c.weights) + ';\r\ncontrol-points:[\r\n' + c.controlPoints.map(list).join(' ,\r\n') + '\r\n];knots:' + list(c.knots) + ';}\r\n' +
    '@surface #unused_surface {type:nurbs;degree-u:1;degree-v:1;knots-u:[-0,-0,1,1];knots-v:[0,0,1,1];control-points:[[[-0,-0,0],[0,1,0]],[[1,0,0],[1,1,0]]];weights:[[1,1],[1,1]];}\r\n/* untouched Ω ending */\r\n}\r\n';
}
function originalCurve(j, count = 8) {
  const weightLists = [Array.from({ length: 8 }, (_, i) => i % 2 ? 3 : 1), [2, 1, 4, 1, 2, 1, 4, 1], [.5, 2, .75, 3, .5, 2, .75, 3]];
  return {
    kind: 'curve', id: 'section_profile', degree: 5,
    knots: [...Array(6).fill(-3), ...(count === 8 ? [-1, 2] : Array.from({ length: 10 }, (_, i) => -2.5 + .5 * i)), ...Array(6).fill(5)],
    controlPoints: Array.from({ length: count }, (_, i) => count === 8 ? [2 * i + j, 4 * j + (i % 2 ? -1 : 1) * (i + 1) / (2 ** j), 3 * j + i * i / (4 * 2 ** j)] : [i, 3 * j + i / 8, j + i % 3]),
    weights: count === 8 ? weightLists[j] : Array.from({ length: count }, (_, i) => 1 + i / 16 + j / 8)
  };
}
function document(id = 'main_graph', capacity = false) {
  const curves = [originalCurve(0, capacity ? 16 : 8), originalCurve(1, capacity ? 16 : 8), originalCurve(2, capacity ? 16 : 8)];
  const assets = [1, 2, 0].map(j => ({ sourceId: 'source_' + 'abc'[j], sourceVersion: 0, source: mixedSource(curves[j], 'abc'[j]), curveId: 'section_profile' }));
  return {
    format: 'barocss-source-knot-recipe-loft-graph', version: 0, id, revision: 0,
    lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion', assets,
    sourceEdits: [
      { id: 'edit_a', kind: 'source-curve-edit', sourceId: 'source_a', edits: { poleEdits: [{ index: 2, xMM: 4.125, yMM: -0 }] } },
      { id: 'edit_c', kind: 'source-curve-edit', sourceId: 'source_c', edits: { poleEdits: [{ index: 4, yMM: curves[2].controlPoints[4][1] }] } },
      { id: 'edit_b', kind: 'source-curve-edit', sourceId: 'source_b', edits: { poleEdits: [{ index: 3, zMM: 4.375 }] } }
    ],
    refinement: { id: 'shared_refinement', kind: 'shared-original-curve-knot', knot: capacity ? 2.5 : .5, suppressed: capacity },
    terminal: {
      id: 'dependent_loft', kind: 'source-knot-aligned-loft', sections: ['edit_c', 'edit_b', 'edit_a'], parametersV: [-2, .5, 4],
      options: { evaluationId: 'terminal_evaluation', constructionSourceId: 'constructed_source', modelName: 'constructed_model', surfaceId: 'constructed_surface', constructionSectionIds: ['copy_first', 'copy_middle', 'copy_last'], maximumSections: 3, maximumAlignedUPoles: 16, maximumInsertionCalls: 28 }
    }
  };
}
function applyPatches(source, candidate, patches) {
  let applied = source, last = 0, shift = 0;
  for (const patch of patches) {
    assert.ok(patch.startUTF16 >= last && patch.endUTF16 > patch.startUTF16);
    assert.equal(source.slice(patch.startUTF16, patch.endUTF16), patch.originalText);
    const a = source.slice(last, patch.startUTF16), b = candidate.slice(last + shift, patch.startUTF16 + shift);
    assert.equal(a, b); assert.deepEqual(Buffer.from(a), Buffer.from(b));
    assert.equal(candidate.slice(patch.startUTF16 + shift, patch.startUTF16 + shift + patch.replacementText.length), patch.replacementText);
    shift += patch.replacementText.length - (patch.endUTF16 - patch.startUTF16); last = patch.endUTF16;
  }
  assert.equal(source.slice(last), candidate.slice(last + shift));
  for (const patch of patches.slice().reverse()) applied = applied.slice(0, patch.startUTF16) + patch.replacementText + applied.slice(patch.endUTF16);
  assert.equal(applied, candidate);
}
function emptyCounts() {
  return { sourceEditCallCount: 0, refinementInsertionCallCount: 0, terminalBuildCallCount: 0, nestedLoftBuildCallCount: 0, sourceCompilationCount: 0, nativeCurveValidationCount: 0, nativeSurfaceValidationCount: 0, curveDomainQueryCount: 0, surfaceDomainQueryCount: 0, curveD0Count: 0, curveD1AttemptCount: 0, surfaceD0Count: 0, surfaceD1AttemptCount: 0, curveD1EvaluatedCount: 0, curveD1RefusedCount: 0, surfaceD1EvaluatedCount: 0, surfaceD1RefusedCount: 0, basisEvaluationCount: 0, decimalEmissionCount: 0 };
}
function providerCounts(scalars, refinements, terminal) {
  const value = emptyCounts();
  for (const s of scalars) {
    const c = s.report.directCounts; value.sourceEditCallCount++;
    value.sourceCompilationCount += c.originalCompileCount + c.candidateCompileCount;
    value.nativeCurveValidationCount += c.nativeCurveValidationCount; value.curveDomainQueryCount += c.domainQueryCount;
    value.curveD0Count += c.curvePointEvaluationCount; value.curveD1AttemptCount += c.curveDerivativeEvaluationCount;
    value.curveD1EvaluatedCount += c.derivativeSuccessCount; value.curveD1RefusedCount += c.derivativeRefusalCount; value.decimalEmissionCount += c.decimalEmissionCount;
  }
  for (const r of refinements.filter(Boolean)) {
    const c = r.report.directCounts; value.refinementInsertionCallCount++;
    value.sourceCompilationCount += c.originalCompileCount + c.candidateCompileCount;
    value.nativeCurveValidationCount += c.nativeCurveValidationCount; value.curveDomainQueryCount += c.domainQueryCount;
    value.curveD0Count += c.curveD0Count; value.curveD1AttemptCount += c.curveD1AttemptCount;
    value.curveD1EvaluatedCount += c.curveD1EvaluatedCount; value.curveD1RefusedCount += c.curveD1RefusedCount; value.decimalEmissionCount += c.decimalEmissionCount;
  }
  if (terminal) {
    const root = terminal.report.directCounts, nested = terminal.loft.report.directCounts;
    assert.equal(root.sourceInsertionCallCount, 0); assert.equal(terminal.insertions.length, 0);
    value.terminalBuildCallCount++; value.nestedLoftBuildCallCount++;
    value.sourceCompilationCount += root.originalCompileCount + nested.sourceCompilationCount;
    value.nativeCurveValidationCount += root.nativeCurveValidationCount + nested.curveValidationCount;
    value.nativeSurfaceValidationCount += nested.surfaceValidationCount;
    value.curveDomainQueryCount += root.domainQueryCount + nested.curveDomainQueryCount; value.surfaceDomainQueryCount += nested.surfaceDomainQueryCount;
    value.curveD0Count += nested.curvePointEvaluationCount; value.surfaceD0Count += nested.surfacePointEvaluationCount;
    value.surfaceD1AttemptCount += nested.surfaceDerivativeEvaluationCount; value.surfaceD1EvaluatedCount += nested.derivativeSuccessCount; value.surfaceD1RefusedCount += nested.derivativeRefusalCount;
    value.basisEvaluationCount += nested.basisEvaluationCount; value.decimalEmissionCount += nested.decimalEmissionCount;
  }
  return value;
}
function stateOracle(result) {
  const { document: doc, sourceEdits: scalars, refinement: refinements, terminal } = result;
  assert.deepEqual(Object.keys(result).sort(), ['document', 'options', 'sourceEdits', 'refinement', 'terminal', 'bindings', 'report'].sort());
  assert.equal(scalars.length, 3); assert.equal(refinements.length, 3); assert.deepEqual(result.options, graphOptions);
  const scalarByNode = new Map();
  for (const [i, node] of doc.sourceEdits.entries()) {
    const asset = doc.assets.find(a => a.sourceId === node.sourceId), scalar = scalars[i];
    const cold = compileCadModel(asset.source, { sourceVersion: 0 }); assert.equal(cold.ok, true); assert.deepEqual(cold.model, scalar.originalModel);
    assert.deepEqual(scalar.request, { source: asset.source, sourceVersion: 0, curveId: asset.curveId, edits: node.edits });
    assert.equal(scalar.curve.id, asset.curveId); applyPatches(asset.source, scalar.source, scalar.patches);
    const expected = clone(cold.model), index = expected.objects.findIndex(o => o.id === asset.curveId); expected.objects[index] = clone(scalar.curve);
    const candidate = compileCadModel(scalar.source, { sourceVersion: 0 }); assert.equal(candidate.ok, true); assert.deepEqual(candidate.model, expected); assert.deepEqual(candidate.model, scalar.model);
    assert.deepEqual(scalar.curve.knots, cold.model.objects[index].knots);
    scalarByNode.set(node.id, { scalar, node, asset, scalarIndex: i });
  }
  const current = doc.terminal.sections.map((nodeId, terminalIndex) => {
    const { scalar, node, asset } = scalarByNode.get(nodeId), refinement = refinements[terminalIndex];
    if (doc.refinement.suppressed) assert.equal(refinement, null);
    else {
      assert.deepEqual(refinement.request, { source: scalar.source, sourceVersion: 0, curveId: asset.curveId, knot: doc.refinement.knot, maximumObservations: 128 });
      assert.deepEqual(refinement.originalModel, scalar.model); assert.deepEqual(refinement.originalCurve, scalar.curve);
      assert.equal(refinement.curve.id, asset.curveId); assert.equal(refinement.provenance.patches.length, 3);
      applyPatches(scalar.source, refinement.source, refinement.provenance.patches);
      const cold = compileCadModel(refinement.source, { sourceVersion: 0 }); assert.equal(cold.ok, true); assert.deepEqual(cold.model, refinement.model);
      const expected = clone(scalar.model); expected.objects[refinement.report.selectedObjectIndex] = clone(refinement.curve); assert.deepEqual(cold.model, expected);
      assert.equal(refinement.curve.controlPoints.length, scalar.curve.controlPoints.length + 1);
    }
    return { nodeId, asset, scalar, source: refinement?.source ?? scalar.source, curve: refinement?.curve ?? scalar.curve, model: refinement?.model ?? scalar.model, terminalIndex };
  });
  assert.deepEqual(terminal.request, { assets: current.map(c => ({ sourceId: c.asset.sourceId, sourceVersion: 0, source: c.source, curveId: c.asset.curveId })), parametersV: doc.terminal.parametersV, options: doc.terminal.options });
  assert.equal(terminal.insertions.length, 0); assert.equal(terminal.plan.insertionCount, 0);
  assert.equal(terminal.report.insertionCount, 0); assert.equal(terminal.report.directCounts.sourceInsertionCallCount, 0);
  assert.ok(terminal.plan.sections.every(s => s.missingKnots.length === 0));
  for (const c of current) {
    const j = c.terminalIndex, copy = { ...clone(c.curve), id: doc.terminal.options.constructionSectionIds[j] };
    assert.deepEqual(terminal.loft.sections[j], copy);
    assert.deepEqual(terminal.originalSources[j], { index: j, sourceId: c.asset.sourceId, sourceVersion: 0, source: c.source, model: c.model });
    assert.deepEqual(terminal.alignedSections[j], terminal.originalSources[j]);
    for (let i = 0; i < copy.controlPoints.length; i++) { assert.deepEqual(terminal.loft.surface.controlPoints[i][j], copy.controlPoints[i]); assert.ok(Object.is(terminal.loft.surface.weights[i][j], copy.weights[i])); }
  }
  const binding = result.bindings;
  assert.equal(binding.graphId, doc.id); assert.equal(binding.revision, doc.revision);
  assert.deepEqual(binding.sources, doc.sourceEdits.map(node => {
    const { scalar, asset } = scalarByNode.get(node.id), c = current.find(c => c.nodeId === node.id);
    const index = c.model.objects.findIndex(o => o.id === asset.curveId);
    return { nodeId: node.id, sourceId: asset.sourceId, curveId: asset.curveId, modelName: c.model.name, objectIndex: index, status: doc.refinement.suppressed ? 'scalar' : 'refined', scalarObjectIndex: scalar.report.selectedObjectIndex, terminalSectionIndex: c.terminalIndex };
  }));
  assert.deepEqual(binding.refinement, { nodeId: doc.refinement.id, status: doc.refinement.suppressed ? 'bypassed' : 'active', inputNodeIds: doc.terminal.sections });
  assert.deepEqual(binding.terminal, { nodeId: doc.terminal.id, sourceId: doc.terminal.options.constructionSourceId, modelName: terminal.loft.model.name, surfaceId: terminal.loft.surface.id, sectionNodeIds: doc.terminal.sections, constructionSectionIds: doc.terminal.options.constructionSectionIds, sections: terminal.bindings.sections, output: terminal.bindings.output });
  const report = result.report;
  assert.deepEqual(report.sourceIds, doc.sourceEdits.map(n => n.sourceId)); assert.deepEqual(report.sourceModelNames, scalars.map(s => s.model.name));
  assert.deepEqual(report.nodeOrder, [...doc.sourceEdits.map(n => n.id), doc.refinement.id, doc.terminal.id]);
  assert.deepEqual(report.dependencies, [...doc.sourceEdits.map(n => ({ nodeId: n.id, dependencyNodeIds: [] })), { nodeId: doc.refinement.id, dependencyNodeIds: doc.terminal.sections }, { nodeId: doc.terminal.id, dependencyNodeIds: [doc.refinement.id] }]);
  assert.deepEqual(report.sectionNodeIds, doc.terminal.sections); assert.equal(report.refinementStatus, doc.refinement.suppressed ? 'bypassed' : 'active');
  assert.equal(report.scalarUPoleCount, scalars[0].curve.controlPoints.length); assert.equal(report.outputUPoleCount, current[0].curve.controlPoints.length);
  assert.deepEqual(report.receiptCounts, { sourceEditReceiptCount: 3, refinementReceiptCount: doc.refinement.suppressed ? 0 : 3, terminalReceiptCount: 1, terminalAlignmentInsertionCount: 0, nestedLoftReceiptCount: 1 });
  assert.deepEqual(report.retainedProviderCounts, providerCounts(scalars, refinements, terminal));
  assert.deepEqual(report.fileSizes, { authored: size(doc), request: size({ document: doc, options: result.options }), result: size(result) });
  assert.equal(report.workScope, 'retained-receipts-not-selective-constructor-call-counts');
  for (const flag of ['expressionGraph', 'sharedSourceGraph', 'smoothLoft', 'G1', 'G2', 'topologyCertified', 'solid', 'globalBinary64ErrorCertified', 'manufacturing', 'editorDisplay', 'persistentTopologyBinding', 'publication']) assert.equal(report.quality[flag], false);
  const cold = compileCadModel(terminal.loft.source, { sourceVersion: 0 }); assert.equal(cold.ok, true); assert.deepEqual(cold.model, terminal.loft.model);
  for (const observation of terminal.loft.report.pointObservations) assert.deepEqual(evaluateSurface(terminal.loft.surface, observation.u, observation.v), observation.surfacePointMM);
  let d1Evaluated = 0, d1Refused = 0;
  for (const observation of terminal.loft.report.derivativeObservations) {
    let actual;
    try { actual = { kind: 'evaluated', result: evaluateSurfaceD1(terminal.loft.surface, observation.u, observation.v) }; d1Evaluated++; }
    catch (error) { assert.ok(error instanceof Error); actual = { kind: 'refused', message: error.message.slice(0, 512) }; d1Refused++; }
    assert.deepEqual(observation.result, actual);
  }
  assert.equal(d1Evaluated, terminal.loft.report.directCounts.derivativeSuccessCount); assert.equal(d1Refused, terminal.loft.report.directCounts.derivativeRefusalCount);
  return { assetOrder: doc.assets.map(a => a.sourceId), scalarOrder: doc.sourceEdits.map(n => n.id), terminalOrder: doc.terminal.sections, repeatedOriginalModelsAndCurves: true, terminalZeroAlignment: true, exactIdOnlyCopies: true, currentUnrefinedSourcesUsed: true, nativeTerminalD1: { evaluated: d1Evaluated, refused: d1Refused }, providerCounts: report.retainedProviderCounts, authority: 'source/recipe/dependency/cache/native-observation; no new kernel Fraction proof' };
}
function saveState(name, result) {
  const proof = stateOracle(result);
  const saved = jsonFile(name + '.result', result); jsonFile(name + '.independent-oracle', proof);
  const authoredFile = resolve(output, name + '.authored.json');
  const text = nativeJSON(result.document) + '\n'; assert.ok(text.length <= 2097152 && Buffer.byteLength(text) <= 2097152);
  writeFileSync(authoredFile, text); files.set(authoredFile, readFileSync(authoredFile)); assert.deepEqual(JSON.parse(text), result.document);
  for (const [i, asset] of result.document.assets.entries()) { const cold = compileCadModel(asset.source, { sourceVersion: 0 }); assert.equal(cold.ok, true); sourceFile(name + '.original-' + i, asset.source, cold.model); }
  for (const [i, s] of result.sourceEdits.entries()) sourceFile(name + '.scalar-' + i, s.source, s.model);
  for (const [i, r] of result.refinement.entries()) if (r) sourceFile(name + '.refinement-' + i, r.source, r.model);
  sourceFile(name + '.terminal-construction', result.terminal.loft.source, result.terminal.loft.model);
  accepted.push({ result, beforeResult: clone(result) });
  cases.push({ name, revision: result.document.revision, resultFile: saved.file, authoredFile, refinementStatus: result.report.refinementStatus, outputUPoles: result.report.outputUPoleCount, receiptCounts: result.report.receiptCounts, retainedProviderCounts: result.report.retainedProviderCounts, fileSizes: result.report.fileSizes });
  return result;
}

function semanticEqual(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => semanticEqual(v, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && semanticEqual(a[k], b[k]));
  return Object.is(a, b);
}
function transactionOracle(previous, edits, wrapper) {
  const next = wrapper.result, doc = next.document, tx = wrapper.transaction, report = tx.report;
  assert.deepEqual(Object.keys(wrapper).sort(), ['result', 'transaction'].sort()); assert.deepEqual(Object.keys(tx).sort(), ['request', 'report'].sort());
  assert.deepEqual(tx.request, { previousDocument: previous.document, options: previous.options, edits });
  assert.equal(doc.revision, previous.document.revision + 1); assert.equal(doc.id, previous.document.id);
  assert.deepEqual(doc.assets, previous.document.assets); assert.deepEqual(doc.terminal, previous.document.terminal);
  const changed = doc.sourceEdits.filter((node, i) => !semanticEqual(node.edits, previous.document.sourceEdits[i].edits)).map(n => n.id);
  const effects = doc.sourceEdits.filter((node, i) => next.sourceEdits[i].source !== previous.sourceEdits[i].source).map(n => n.id);
  const recipeChanged = !Object.is(doc.refinement.knot, previous.document.refinement.knot);
  const suppressionChanged = doc.refinement.suppressed !== previous.document.refinement.suppressed;
  const resumed = previous.document.refinement.suppressed && !doc.refinement.suppressed;
  const rebuilt = doc.refinement.suppressed ? [] : doc.terminal.sections.filter(id => recipeChanged || resumed || effects.includes(id));
  const reusedSource = doc.sourceEdits.filter(n => !changed.includes(n.id)).map(n => n.id);
  const reusedRefinement = doc.refinement.suppressed ? [] : doc.terminal.sections.filter(id => !rebuilt.includes(id));
  const terminalChanged = !semanticEqual(next.terminal.request, previous.terminal.request);
  assert.deepEqual(report.changedSourceNodeIds, changed); assert.deepEqual(report.sourceEffectNodeIds, effects);
  assert.deepEqual(report.rebuiltRefinementNodeIds, rebuilt); assert.deepEqual(report.reusedSourceNodeIds, reusedSource);
  assert.deepEqual(report.reusedRefinementNodeIds, reusedRefinement);
  assert.equal(report.recipeChanged, recipeChanged); assert.equal(report.suppressionChanged, suppressionChanged); assert.equal(report.resumed, resumed);
  assert.equal(report.terminalAction, terminalChanged ? 'rebuilt' : 'retained');
  assert.equal(report.noOp, changed.length === 0 && !recipeChanged && !suppressionChanged);
  assert.deepEqual(report.directCounts, { sourceEditCallCount: changed.length, refinementInsertionCallCount: rebuilt.length, terminalBuildCallCount: terminalChanged ? 1 : 0, oldGraphCallCount: 0, rootCurveD0Count: 0, rootCurveD1Count: 0, rootSurfaceD0Count: 0, rootSurfaceD1Count: 0 });
  const changedScalars = doc.sourceEdits.flatMap((node, i) => changed.includes(node.id) ? [next.sourceEdits[i]] : []);
  const changedRefiners = doc.terminal.sections.flatMap((id, i) => rebuilt.includes(id) ? [next.refinement[i]] : []);
  assert.deepEqual(report.changedProviderCounts, providerCounts(changedScalars, changedRefiners, terminalChanged ? next.terminal : null));
  assert.deepEqual(report.validationCounts, { previousGraphRebuildCount: 1, providers: providerCounts(previous.sourceEdits, previous.refinement, previous.terminal) });
  for (const id of reusedSource) {
    const i = doc.sourceEdits.findIndex(n => n.id === id); assert.deepEqual(next.sourceEdits[i], previous.sourceEdits[i]);
  }
  for (const id of reusedRefinement) {
    const i = doc.terminal.sections.indexOf(id); assert.deepEqual(next.refinement[i], previous.refinement[i]);
  }
  if (!terminalChanged) assert.deepEqual(next.terminal, previous.terminal);
  assert.equal(next.bindings.revision, doc.revision); assert.equal(previous.bindings.revision, previous.document.revision);
  assert.equal(report.atomic, true); assert.equal(report.unchangedNativeReceiptsCopied, true);
  assert.deepEqual(report.fileSizes.update, size(wrapper));
  assert.equal(report.workScope, 'actual-selective-work-with-prior-cold-validation-reported-separately');
  return { changed, effects, rebuilt, reusedSource, reusedRefinement, terminalChanged, newWork: report.directCounts, validationWork: report.validationCounts.providers, changedProviderWork: report.changedProviderCounts };
}
function fresh(name, doc) {
  const before = clone(doc), result = evaluate(doc, graphOptions); assert.deepEqual(doc, before); ownership([doc, graphOptions], result);
  retained.push({ value: doc, before }); return saveState(name, result);
}
function selective(name, previous, edits, expected) {
  const before = clone(previous), editsBefore = clone(edits), wrapper = update(previous, edits);
  assert.deepEqual(previous, before); assert.deepEqual(edits, editsBefore); ownership([previous, edits], wrapper);
  const proof = transactionOracle(previous, edits, wrapper);
  assert.deepEqual(evaluate(wrapper.result.document, graphOptions), wrapper.result, 'Updated current state equals a fresh authored cold construction');
  proof.additionalCurrentColdRebuildCount = 1;
  assert.deepEqual([wrapper.transaction.report.directCounts.sourceEditCallCount, wrapper.transaction.report.directCounts.refinementInsertionCallCount, wrapper.transaction.report.directCounts.terminalBuildCallCount], expected);
  saveState(name, wrapper.result); const saved = jsonFile(name + '.update', wrapper, 33554432); jsonFile(name + '.transaction-oracle', proof);
  updates.push({ name, revision: wrapper.result.document.revision, wrapperFile: saved.file, previousDocument: clone(previous.document), edits: clone(edits), directCounts: wrapper.transaction.report.directCounts, validationCounts: wrapper.transaction.report.validationCounts, changedProviderCounts: wrapper.transaction.report.changedProviderCounts });
  retained.push({ value: edits, before: editsBefore }); return wrapper;
}
jsonFile('source-api.inputs', { entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version });
jsonFile('source-api.metafile', bundle.metafile);
const mainDoc = document(), baseline = fresh('main-revision0', mainDoc);
assert.deepEqual(mainDoc.assets.map(a => a.sourceId), ['source_b', 'source_c', 'source_a']);
assert.deepEqual(mainDoc.sourceEdits.map(n => n.id), ['edit_a', 'edit_c', 'edit_b']);
assert.deepEqual(mainDoc.terminal.sections, ['edit_c', 'edit_b', 'edit_a']);
assert.equal(new Set(mainDoc.assets.map(a => a.curveId)).size, 1);
assert.equal(new Set(baseline.sourceEdits.map(s => s.originalModel.name)).size, 1);
assert.ok(Object.is(mainDoc.sourceEdits[0].edits.poleEdits[0].yMM, -0));
assert.equal(baseline.refinement.filter(Boolean).length, 3); assert.equal(baseline.report.outputUPoleCount, 9);
assert.deepEqual(baseline.refinement.map(r => r.report.directCounts.observationCount), [9, 9, 9]);
assert.equal(baseline.report.retainedProviderCounts.sourceCompilationCount, 16);
assert.deepEqual(validate(baseline), baseline.report);
const revision1 = selective('main-revision1-replace-knot', baseline, { expectedRevision: 0, revision: 1, nodeEdits: [], refinementKnot: 1.25, refinementSuppressed: null }, [0, 3, 1]);
for (const r of revision1.result.refinement) { assert.equal(r.originalCurve.controlPoints.length, 8); assert.equal(r.curve.controlPoints.length, 9); assert.ok(r.curve.knots.includes(1.25)); assert.ok(!r.curve.knots.some(k => k === .5)); assert.equal(r.report.directCounts.observationCount, 10); }
const revision2 = selective('main-revision2-suppress', revision1.result, { expectedRevision: 1, revision: 2, nodeEdits: [], refinementKnot: null, refinementSuppressed: true }, [0, 0, 1]);
assert.deepEqual(revision2.result.refinement, [null, null, null]); assert.equal(revision2.result.report.outputUPoleCount, 8);
assert.equal(revision2.result.report.retainedProviderCounts.sourceCompilationCount, 10);
const revision3 = selective('main-revision3-resume', revision2.result, { expectedRevision: 2, revision: 3, nodeEdits: [], refinementKnot: null, refinementSuppressed: false }, [0, 3, 1]);
assert.equal(revision3.result.report.outputUPoleCount, 9);
const authoredText = serialize(revision3.result.document, graphOptions);
assert.equal(authoredText, nativeJSON(revision3.result.document) + '\n');
const coldPath = resolve(output, 'authored-save-open-revision3.json'); writeFileSync(coldPath, authoredText); files.set(coldPath, readFileSync(coldPath));
const coldOpen = parse(readFileSync(coldPath, 'utf8'), graphOptions); assert.deepEqual(coldOpen, revision3.result);
assert.ok(Object.is(coldOpen.document.sourceEdits[0].edits.poleEdits[0].yMM, -0));
jsonFile('authored-save-open-proof', { coldPath, storesOriginalSourcesAndLiteralRecipes: true, excludesDerivedCaches: true, fullColdResultBitEqual: true, refinementKnot: coldOpen.document.refinement.knot, terminalAlignmentCount: coldOpen.terminal.report.insertionCount });
const middleNode = coldOpen.document.terminal.sections[1]; assert.equal(middleNode, 'edit_b');
assert.equal(coldOpen.document.sourceEdits.findIndex(n => n.id === middleNode), 2);
assert.equal(coldOpen.document.assets.findIndex(a => a.sourceId === 'source_b'), 0);
const middleEdits = { expectedRevision: 3, revision: 4, nodeEdits: [{ nodeId: middleNode, edits: { poleEdits: [{ index: 3, zMM: 4.625 }] } }], refinementKnot: null, refinementSuppressed: null };
const revision4 = selective('main-revision4-middle-original-edit', coldOpen, middleEdits, [1, 1, 1]);
assert.deepEqual(revision4.transaction.report.changedSourceNodeIds, ['edit_b']); assert.deepEqual(revision4.transaction.report.rebuiltRefinementNodeIds, ['edit_b']);
assert.equal(revision4.transaction.report.validationCounts.providers.sourceCompilationCount + revision4.transaction.report.changedProviderCounts.sourceCompilationCount, 24);
const beforePoint = evaluateSurface(coldOpen.terminal.loft.surface, 1, .5), afterPoint = evaluateSurface(revision4.result.terminal.loft.surface, 1, .5);
assert.ok(Math.hypot(...afterPoint.map((v, i) => v - beforePoint[i])) > 0);
assert.deepEqual(validateUpdate(revision4), revision4.transaction.report);
const revision5 = selective('main-revision5-same-recipe-noop', revision4.result, { expectedRevision: 4, revision: 5, nodeEdits: [], refinementKnot: 1.25, refinementSuppressed: null }, [0, 0, 0]);
assert.equal(revision5.transaction.report.noOp, true); assert.equal(revision5.result.bindings.revision, 5); assert.deepEqual(revision5.result.terminal, revision4.result.terminal);
const revision6 = selective('main-revision6-changed-intent-same-source', revision5.result, { expectedRevision: 5, revision: 6, nodeEdits: [{ nodeId: 'edit_c', edits: { poleEdits: [{ index: 4, zMM: 7 }] } }], refinementKnot: null, refinementSuppressed: null }, [1, 0, 0]);
assert.equal(revision6.transaction.report.noOp, false); assert.deepEqual(revision6.transaction.report.changedSourceNodeIds, ['edit_c']); assert.deepEqual(revision6.transaction.report.sourceEffectNodeIds, []);
const cIndex = revision6.result.document.sourceEdits.findIndex(n => n.id === 'edit_c'); assert.equal(cIndex, 1);
assert.equal(revision6.result.sourceEdits[cIndex].source, revision5.result.sourceEdits[cIndex].source);
assert.equal(revision6.result.sourceEdits[cIndex].report.noOp, true);
const latestText = serialize(revision6.result.document, graphOptions); assert.deepEqual(parse(latestText, graphOptions), revision6.result);
jsonFile('changed-intent-same-source-cache-proof', { newWriterCount: 1, newRefinementCount: 0, newTerminalCount: 0, node: 'edit_c', actualSourceBytesUnchanged: true, authoredRecipeChanged: true, currentRevision: 6, fullColdResultBitEqual: true });
const capacityDoc = document('bypass_capacity_graph', true), capacity = fresh('bypass-native16', capacityDoc);
assert.equal(capacity.report.scalarUPoleCount, 16); assert.equal(capacity.report.outputUPoleCount, 16); assert.deepEqual(capacity.refinement, [null, null, null]);
function intact() {
  for (const row of retained) assert.deepEqual(row.value, row.before);
  for (const row of accepted) assert.deepEqual(row.result, row.beforeResult);
  for (const [file, bytes] of files) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, allowed) {
  const allowedCodes = Array.isArray(allowed) ? allowed : [allowed];
  assert.throws(action, error => {
    assert.ok(error instanceof GraphError); assert.ok(allowedCodes.includes(error.code), name + ': ' + error.code); assert.ok(error.message.length <= 1024);
    failures.push({ name, code: error.code, message: error.message, causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null, causeMessage: error.cause?.message ?? null });
    intact(); return true;
  });
}
reject('bypass16-resume17-capacity', () => update(capacity, { expectedRevision: 0, revision: 1, nodeEdits: [], refinementKnot: null, refinementSuppressed: false }), 'BUDGET');
reject('stale-revision', () => update(revision6.result, { expectedRevision: 5, revision: 7, nodeEdits: [], refinementKnot: 1.25, refinementSuppressed: null }), 'REVISION');
reject('skipped-revision', () => update(revision6.result, { expectedRevision: 6, revision: 8, nodeEdits: [], refinementKnot: 1.25, refinementSuppressed: null }), 'REVISION');
reject('empty-update', () => update(revision6.result, { expectedRevision: 6, revision: 7, nodeEdits: [], refinementKnot: null, refinementSuppressed: null }), 'INPUT');
reject('invalid-suppression', () => update(revision6.result, { expectedRevision: 6, revision: 7, nodeEdits: [], refinementKnot: null, refinementSuppressed: 'yes' }), 'INPUT');
reject('endpoint-knot-update', () => update(revision6.result, { expectedRevision: 6, revision: 7, nodeEdits: [], refinementKnot: 5, refinementSuppressed: null }), 'REQUEST');
reject('outside-knot-update', () => update(revision6.result, { expectedRevision: 6, revision: 7, nodeEdits: [], refinementKnot: -4, refinementSuppressed: null }), 'REQUEST');
reject('invalid-original-index-even-if-refined-index8-exists', () => update(revision6.result, { expectedRevision: 6, revision: 7, nodeEdits: [{ nodeId: 'edit_b', edits: { poleEdits: [{ index: 8, xMM: 0 }] } }], refinementKnot: null, refinementSuppressed: null }), 'INPUT');
reject('actual-native-weight-refusal', () => update(revision6.result, { expectedRevision: 6, revision: 7, nodeEdits: [{ nodeId: 'edit_b', edits: { poleEdits: [{ index: 3, weight: 0 }] } }], refinementKnot: null, refinementSuppressed: null }), ['NATIVE', 'SOURCE']);
const badReference = clone(mainDoc); badReference.terminal.sections[1] = 'missing_node'; reject('unknown-terminal-section-reference', () => evaluate(badReference, graphOptions), 'REFERENCE');
const badSource = clone(mainDoc); badSource.sourceEdits[1].sourceId = badSource.sourceEdits[0].sourceId; reject('two-nodes-cannot-use-one-asset', () => evaluate(badSource, graphOptions), ['REFERENCE', 'IDENTITY']);
const duplicateRole = clone(mainDoc); duplicateRole.refinement.id = duplicateRole.sourceEdits[0].id; reject('duplicate-logical-role', () => evaluate(duplicateRole, graphOptions), 'IDENTITY');
const badCopy = clone(mainDoc); badCopy.terminal.options.constructionSectionIds[1] = badCopy.terminal.options.constructionSectionIds[0]; reject('duplicate-terminal-construction-id', () => evaluate(badCopy, graphOptions), 'IDENTITY');
const malformedSource = clone(mainDoc); malformedSource.assets[0].source += ' broken '; reject('actual-source-compile-refusal', () => evaluate(malformedSource, graphOptions), 'SOURCE');
const wrongVersion = clone(mainDoc); wrongVersion.version = 1; reject('wrong-new-version', () => evaluate(wrongVersion, graphOptions), 'VERSION');
const oldFormat = clone(mainDoc); oldFormat.format = 'barocss-nurbs-source-loft-feature-graph'; reject('old-format-not-new-graph', () => evaluate(oldFormat, graphOptions), 'VERSION');
const zeroRevision = clone(mainDoc); zeroRevision.revision = -0; reject('revision-negative-zero', () => evaluate(zeroRevision, graphOptions), 'REVISION');
for (const [field, value] of [['maximumSourceEdits', 2], ['maximumRefinementInsertions', 2], ['maximumLoftSections', 2], ['maximumProducerEvaluations', 6]]) reject('fixed-options-' + field, () => evaluate(mainDoc, { ...graphOptions, [field]: value }), 'BUDGET');
const dormantInvalid = clone(mainDoc); dormantInvalid.refinement.suppressed = true; dormantInvalid.refinement.knot = 5; reject('invalid-dormant-numeric-recipe', () => evaluate(dormantInvalid, graphOptions), 'REQUEST');
const differingBasis = clone(mainDoc), different = originalCurve(0); different.knots = [...Array(6).fill(-3), -1, 2.5, ...Array(6).fill(5)]; differingBasis.assets.find(a => a.sourceId === 'source_a').source = mixedSource(different, 'different-basis');
for (const asset of differingBasis.assets) assert.equal(compileCadModel(asset.source, { sourceVersion: 0 }).ok, true);
reject('actual-common-basis-mismatch', () => evaluate(differingBasis, graphOptions), 'BASIS');
const zeroDonor = clone(mainDoc);
for (const asset of zeroDonor.assets) { const j = 'abc'.indexOf(asset.sourceId.at(-1)), c = originalCurve(j); c.knots = [...Array(6).fill(-3), -0, 2, ...Array(6).fill(5)]; asset.source = mixedSource(c, 'negative-zero-donor'); assert.equal(compileCadModel(asset.source, { sourceVersion: 0 }).ok, true); }
zeroDonor.refinement.knot = +0; reject('opposite-existing-zero-knot', () => evaluate(zeroDonor, graphOptions), 'REQUEST');
const commentDoc = clone(mainDoc), commentAsset = commentDoc.assets.find(a => a.sourceId === 'source_b');
const commentAST = compileCadModel(commentAsset.source, { sourceVersion: 0 }); assert.equal(commentAST.ok, true);
const selected = commentAST.ast.declarations.find(d => d.kind === 'curve' && d.id === commentAsset.curveId), arrayStart = selected.fields.find(f => f.name === 'control-points').value.range.start;
commentAsset.source = commentAsset.source.slice(0, arrayStart + 1) + '/* protected structural array */' + commentAsset.source.slice(arrayStart + 1);
assert.equal(compileCadModel(commentAsset.source, { sourceVersion: 0 }).ok, true);
reject('protected-array-active-insertion', () => evaluate(commentDoc, graphOptions), 'TARGET');
commentDoc.id = 'comment_bypass_graph'; commentDoc.refinement.suppressed = true;
const commentBypass = fresh('same-source-comment-bypass', commentDoc); assert.deepEqual(commentBypass.refinement, [null, null, null]);
let getterCalls = 0;
const getterDoc = clone(mainDoc); Object.defineProperty(getterDoc.assets[0], 'source', { enumerable: true, get() { getterCalls++; return mainDoc.assets[0].source; } });
reject('authored-source-getter', () => evaluate(getterDoc, graphOptions), 'INPUT'); assert.equal(getterCalls, 0);
const sparse = clone(mainDoc); delete sparse.assets[1]; reject('sparse-assets', () => evaluate(sparse, graphOptions), 'INPUT');
const cyclic = clone(mainDoc); cyclic.cycle = cyclic; reject('cyclic-document', () => evaluate(cyclic, graphOptions), 'INPUT');
const hidden = clone(mainDoc); Object.defineProperty(hidden, 'cache', { value: 1 }); reject('hidden-document-field', () => evaluate(hidden, graphOptions), 'INPUT');
const symbol = clone(mainDoc); symbol[Symbol('cache')] = 1; reject('symbol-document-field', () => evaluate(symbol, graphOptions), 'INPUT');
const foreign = clone(mainDoc); Object.setPrototypeOf(foreign, Date.prototype); reject('foreign-document', () => evaluate(foreign, graphOptions), 'INPUT');
const nonfinite = clone(mainDoc); nonfinite.refinement.knot = Infinity; reject('nonfinite-recipe', () => evaluate(nonfinite, graphOptions), 'INPUT');
const encodedFormat = '"' + String.fromCharCode(92) + 'u0066ormat":';
const duplicateDecodedKey = authoredText.replace('"format":', encodedFormat + nativeJSON(revision3.result.document.format) + ',"format":');
reject('strict-codec-duplicate-decoded-key', () => parse(duplicateDecodedKey, graphOptions), 'CODEC');
reject('strict-codec-malformed-json', () => parse(authoredText.slice(0, -3), graphOptions), 'CODEC');
reject('strict-codec-malformed-unicode', () => parse('{"format":"' + String.fromCharCode(0xd800) + '"}', graphOptions), 'CODEC');
reject('authored-codec-refuses-derived-cache', () => parse(nativeJSON({ ...mainDoc, cache: true }) + '\n', graphOptions), 'INPUT');
for (const [name, mutate] of [
  ['authored-source', r => { r.document.assets[0].source += ' '; }],
  ['scalar-recipe', r => { r.document.sourceEdits[0].edits.poleEdits[0].xMM += .125; }],
  ['shared-recipe', r => { r.document.refinement.knot += .125; }],
  ['scalar-patch', r => { r.sourceEdits[0].patches[0].replacementText += '0'; }],
  ['scalar-source', r => { r.sourceEdits[0].source += ' '; }],
  ['refinement-upstream-source', r => { r.refinement[0].request.source += ' '; }],
  ['refinement-native', r => { r.refinement[0].curve.weights[2] += .125; }],
  ['terminal-copy-binding', r => { r.terminal.bindings.sections[0].construction.curveId += '_wrong'; }],
  ['terminal-source', r => { r.terminal.loft.source += ' '; }],
  ['terminal-curve', r => { r.terminal.loft.surface.controlPoints[2][0][0] += .125; }],
  ['root-binding-revision', r => { r.bindings.revision++; }],
  ['retained-provider-count', r => { r.report.retainedProviderCounts.refinementInsertionCallCount++; }],
  ['retained-receipt-count', r => { r.report.receiptCounts.terminalAlignmentInsertionCount++; }],
  ['file-size', r => { r.report.fileSizes.result.utf8++; }],
  ['false-smoothness', r => { r.report.quality.smoothLoft = true; }]
]) { const changed = clone(revision4.result), before = nativeJSON(changed); mutate(changed); assert.notEqual(nativeJSON(changed), before, name); reject('owned-current-' + name, () => validate(changed), 'OWNED'); }
for (const [name, mutate] of [
  ['baseline-document', w => { w.transaction.request.previousDocument.revision++; }],
  ['update-recipe', w => { w.transaction.request.edits.nodeEdits[0].edits.poleEdits[0].zMM += .125; }],
  ['new-producer-count', w => { w.transaction.report.directCounts.refinementInsertionCallCount++; }],
  ['validation-count', w => { w.transaction.report.validationCounts.previousGraphRebuildCount++; }],
  ['affected-set', w => { w.transaction.report.sourceEffectNodeIds.push('edit_a'); }],
  ['reuse-order', w => { w.transaction.report.reusedRefinementNodeIds.reverse(); }],
  ['next-current-binding', w => { w.result.bindings.sources[0].terminalSectionIndex++; }],
  ['transaction-size', w => { w.transaction.report.fileSizes.update.utf8++; }]
]) { const changed = clone(revision4), before = nativeJSON(changed); mutate(changed); assert.notEqual(nativeJSON(changed), before, name); reject('owned-update-' + name, () => validateUpdate(changed), 'OWNED'); }
let previous = revision6.result;
reject('atomic-replacement-retains-previous', () => { previous = update(revision6.result, { expectedRevision: 5, revision: 7, nodeEdits: [], refinementKnot: null, refinementSuppressed: true }).result; }, 'REVISION');
assert.strictEqual(previous, revision6.result); jsonFile('atomic-retention', { callerObjectsPreviousGeometryAndFilesRetained: true, getterCalls, noPartialGraph: true });
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types), leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/source-wide/source-knot-recipe-loft-graph.d.ts');
const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.SourceKnotRecipeLoftGraphDiagnosticCode, codes);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./source-knot-recipe-loft-graph.js'));
for (const name of [...runtimeNames, ...typeNames]) assert.ok(readFileSync(leafDeclarationPath, 'utf8').includes(name), name);
const savedMain = JSON.parse(readFileSync(cases[0].resultFile, 'utf8'));
assert.deepEqual(publicAPI.evaluateSourceKnotRecipeLoftGraph(savedMain.document, savedMain.options), savedMain);
assert.deepEqual(publicAPI.validateSourceKnotRecipeLoftGraph(savedMain), savedMain.report);
assert.equal(publicAPI.serializeSourceKnotRecipeLoftGraph(revision3.result.document, graphOptions), authoredText);
assert.deepEqual(publicAPI.parseSourceKnotRecipeLoftGraph(authoredText, graphOptions), revision3.result);
assert.deepEqual(publicAPI.updateSourceKnotRecipeLoftGraph(coldOpen, middleEdits), revision4);
assert.deepEqual(publicAPI.validateSourceKnotRecipeLoftGraphUpdate(revision4), revision4.transaction.report);
const emittedArtifacts = ['index.js', 'index.d.ts', 'source-knot-recipe-loft-graph.js', 'source-knot-recipe-loft-graph.d.ts'].map(name => {
  const path = resolve(packageRoot, 'dist', name); assert.ok(existsSync(path)); const bytes = readFileSync(path); return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
const compiledConsumer = { runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 16, currentMainEvaluateOwnedReplay: 1, realMiddleUpdateAndCodecReplay: true, emittedArtifacts };
jsonFile('compiled-consumer', compiledConsumer); intact();
const summary = { sourceMode: true, cases, updates, failures, compiledConsumer, getterCalls, lifecycleRevisions: [0, 1, 2, 3, 4, 5, 6], distinctArrayOrders: { assets: ['source_b', 'source_c', 'source_a'], scalars: ['edit_a', 'edit_c', 'edit_b'], terminal: ['edit_c', 'edit_b', 'edit_a'] }, repeatedOriginalModelCurveNames: true, sourceEffectCacheControl: { changedWriter: 1, refinement: 0, terminal: 0 }, terminalAlignmentAlwaysZero: true, noKernelFractionReproof: true, workScope: 'Current reports retain producer receipts; selective transaction and prior cold validation counts are separate. Codec/oracle/owned/public replays are additional actual work.', scope: 'Persisted literal structural knot recipe and actual selective Loft lifecycle; no old graph/reader/editor compatibility, expression graph, shared-source DAG, reorder, smoothness/G1G2, topology/Body/Solid/global error/manufacturing/publication acceptance.' };
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
