import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node pure-quantity-functions-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json')), esbuild = require('esbuild');
const entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({ absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
assert.equal(bundle.outputFiles.length, 1);
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
for (const leaf of ['model-compiler.ts', 'source-ast.ts', 'expression-parser.ts', 'function-quantity-semantics.ts', 'semantic-model.ts', 'parameter-semantics.ts', 'lower-model.ts']) assert.ok(inputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(!inputs.some(path => path.includes('/packages/barocss-cad/dist/')));
assert.ok(inputs.filter(path => path.includes('/packages/barocss-cad/')).every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { compileCadModel: compile, evaluateCurve, evaluateCurveD1, evaluateSurface, evaluateSurfaceD1 } = api;
assert.equal(typeof compile, 'function'); assert.equal(api.compileCadStages, undefined); assert.equal(api.resolveCadFunctionParameters, undefined); assert.equal(api.settleCadFunctionSuccess, undefined);
const newTypes = ['CadCallArgument', 'CadCallExpression', 'CadFormalArgument', 'CadFunctionAst', 'CadModelIR3', 'CadFunctionQuantity', 'CadResolvedFunction', 'CadFunctionCallReceipt', 'CadFunctionWork'];
const files = new Map(), retained = [], cases = [], failures = [];
const additionalWork = { source3CompileCalls: 0, source3ColdReopens: 0, oldDialectCompileCalls: 0, refusalCompileCalls: 0, publicMainCompileCalls: 0, curveD0Calls: 0, curveD1Calls: 0, surfaceD0Calls: 0, surfaceD1Calls: 0, rationalOperations: 0 };
const clone = value => structuredClone(value);
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : nativeJSON(value)).digest('hex');
const size = text => ({ utf16: text.length, utf8: Buffer.byteLength(text) });
function saveText(name, text) { const path = resolve(output, name); writeFileSync(path, text); files.set(path, readFileSync(path)); assert.equal(readFileSync(path, 'utf8'), text); return path; }
function saveJSON(name, value, limit = 16777216) { const text = nativeJSON(value) + '\n'; assert.ok(text.length <= limit && Buffer.byteLength(text) <= limit, name); const path = saveText(name + '.json', text); assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), value); return path; }
function retention() { for (const [path, bytes] of files) assert.deepEqual(readFileSync(path), bytes, path); for (const [value, before] of retained) assert.equal(nativeJSON(value), before); }
function ownOracle(value) {
  let count = 0, maxDepth = 0; const seen = new WeakSet();
  function visit(item, depth) {
    count++; maxDepth = Math.max(maxDepth, depth);
    if (item && typeof item === 'object') { assert.ok(!seen.has(item), 'Every successful result occurrence is independently owned'); seen.add(item); assert.ok(Object.keys(item).length <= (Array.isArray(item) ? 65536 : 64)); Object.values(item).forEach(child => visit(child, depth + 1)); }
  }
  visit(value, 0); assert.ok(count <= 4194304 && maxDepth <= 128); return { count, maxDepth };
}
function sourceRange(text, range) {
  assert.deepEqual(Object.keys(range).sort(), ['start', 'end', 'line', 'column', 'endLine', 'endColumn'].sort());
  assert.ok(Number.isInteger(range.start) && Number.isInteger(range.end) && range.start >= 0 && range.end >= range.start && range.end <= text.length);
  const position = offset => { const prefix = text.slice(0, offset); return { line: prefix.split('\n').length, column: offset - prefix.lastIndexOf('\n') }; };
  const start = position(range.start), end = position(range.end); assert.equal(range.line, start.line); assert.equal(range.column, start.column); assert.equal(range.endLine, end.line); assert.equal(range.endColumn, end.column);
  return text.slice(range.start, range.end);
}
function walkRanges(text, value) {
  if (!value || typeof value !== 'object') return;
  if (!Array.isArray(value) && Object.hasOwn(value, 'start') && Object.hasOwn(value, 'end') && Object.hasOwn(value, 'endColumn')) sourceRange(text, value);
  else Object.values(value).forEach(child => walkRanges(text, child));
}
const mainSource = [
  '/* 설계 π: preserve complete original Source, CRLF and odd literals. */',
  '@model quantity_functions {',
  'version: 3; length-unit: mm;',
  '@function #scaleLength(value: length, factor: scalar = 2): length { return: $value * $factor; }',
  '@function #half(value: length): length { return: scaleLength(value: $value, factor: .5); }',
  '@parameter #width { type: length; value: 10 cm; }',
  '@parameter #height { type: length; value: scaleLength(value: half(value: $width)); }',
  '@parameter #depth { type: length; value: scaleLength(factor: .25, value: $width); }',
  '@curve #untouched_curve { type:nurbs; degree:2; knots:[-2.000,-2,-2,3,3.0,3]; control-points:[[-0,2,1],[3,4,2],[6,2,1]]; weights:[1,2,1]; }',
  '@curve #profile { type:nurbs; degree:1; knots:[0,0,1,1]; control-points:[[0,0,0],[$width,0,0]]; weights:[1,1]; }',
  '@extrude #wall { curve:#profile; vector:[0,$depth,$height]; }',
  '@surface #untouched_surface { type:nurbs; degree-u:1; degree-v:1; knots-u:[0.000,0,1,1.00]; knots-v:[-1,-1,2,2]; control-points:[[[2,3,-0],[2,5,1]],[[4,3,2],[4,5,4]]]; weights:[[1,2],[3,4]]; }',
  '/* Keep Ω and every unrelated original coefficient. */', '}', ''
].join('\r\n');
const siblingCurve = { kind: 'curve', id: 'untouched_curve', degree: 2, knots: [-2, -2, -2, 3, 3, 3], controlPoints: [[-0, 2, 1], [3, 4, 2], [6, 2, 1]], weights: [1, 2, 1] };
const siblingSurface = { kind: 'surface', id: 'untouched_surface', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [-1, -1, 2, 2], controlPoints: [[[2, 3, -0], [2, 5, 1]], [[4, 3, 2], [4, 5, 4]]], weights: [[1, 2], [3, 4]] };
const quantity = (kind, value) => ({ kind, unit: kind === 'length' ? 'mm' : '1', value });
function expectedModel(w) {
  return { name: 'quantity_functions', version: 0, lengthUnit: 'mm', objects: [clone(siblingCurve),
    { kind: 'curve', id: 'profile', degree: 1, knots: [0, 0, 1, 1], controlPoints: [[0, 0, 0], [w, 0, 0]], weights: [1, 1] },
    { kind: 'surface', id: 'wall', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[0, 0, 0], [0, w / 4, w]], [[w, 0, 0], [w, w / 4, w]]], weights: [[1, 1], [1, 1]] }, clone(siblingSurface)] };
}
function expressionCost(expr, functions, depth = 0) {
  const total = { expressionEvaluations: 1, callEntries: 0, maximumCallDepth: depth, defaults: 0, bindings: 0 };
  const add = child => { total.expressionEvaluations += child.expressionEvaluations; total.callEntries += child.callEntries; total.maximumCallDepth = Math.max(total.maximumCallDepth, child.maximumCallDepth); total.defaults += child.defaults; total.bindings += child.bindings; };
  if (expr.kind === 'unary') add(expressionCost(expr.operand, functions, depth));
  else if (expr.kind === 'binary') { add(expressionCost(expr.left, functions, depth)); add(expressionCost(expr.right, functions, depth)); }
  else if (expr.kind === 'group') add(expressionCost(expr.expression, functions, depth));
  else if (expr.kind === 'call') {
    for (const argument of expr.arguments) add(expressionCost(argument.value, functions, depth));
    const fn = functions.get(expr.functionId); assert.ok(fn && depth < 8); total.callEntries++; total.maximumCallDepth = Math.max(total.maximumCallDepth, depth + 1); total.bindings += fn.arguments.length;
    for (const formal of fn.arguments) if (!expr.arguments.some(arg => arg.name === formal.name)) { assert.ok(formal.defaultExpression); total.defaults++; add(expressionCost(formal.defaultExpression, functions, depth + 1)); }
    add(expressionCost(fn.fields[0].value, functions, depth + 1));
  } else assert.ok(['number', 'parameter-reference'].includes(expr.kind), expr.kind);
  return total;
}
function expansionOracle(ast) {
  const functions = new Map(ast.declarations.filter(d => d.kind === 'function').map(d => [d.id, d]));
  const result = { expressionEvaluations: 0, callEntries: 0, maximumCallDepth: 0, defaults: 0, bindings: 0 };
  function leaf(value) {
    if (value.kind === 'array') value.items.forEach(leaf);
    else if (!['identifier', 'reference'].includes(value.kind)) { const cost = expressionCost(value, functions); for (const key of ['expressionEvaluations', 'callEntries', 'defaults', 'bindings']) result[key] += cost[key]; result.maximumCallDepth = Math.max(result.maximumCallDepth, cost.maximumCallDepth); }
  }
  for (const declaration of ast.declarations) if (declaration.kind !== 'function') for (const field of declaration.fields) if (field.name !== 'type') leaf(field.value);
  return result;
}
function receiptOracle(result, text, w) {
  assert.deepEqual(Object.keys(result).sort(), ['ok', 'ast', 'ir', 'model', 'constructions', 'diagnostics'].sort()); assert.equal(result.ok, true); assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ast.kind, 'model'); assert.equal(result.ast.name, 'quantity_functions'); walkRanges(text, result.ast); walkRanges(text, result.ir);
  const astFunctions = result.ast.declarations.filter(d => d.kind === 'function'); assert.deepEqual(astFunctions.map(f => f.id), ['scaleLength', 'half']);
  const byId = new Map(astFunctions.map(f => [f.id, f]));
  const callNodes = new Map();
  function collectCalls(value) { if (!value || typeof value !== 'object') return; if (value.kind === 'call') callNodes.set(value.range.start + ':' + value.range.end, value); Object.values(value).forEach(collectCalls); }
  collectCalls(result.ast);
  for (const fn of astFunctions) { assert.equal(fn.returnKind, 'length'); assert.equal(fn.fields.length, 1); assert.equal(fn.fields[0].name, 'return'); assert.ok(sourceRange(text, fn.range).startsWith('@function')); fn.arguments.forEach(formal => { assert.equal(formal.kind, 'formal-argument'); assert.equal(sourceRange(text, formal.nameRange), formal.name); assert.equal(sourceRange(text, formal.typeRange), formal.quantityKind); }); }
  const ir = result.ir; assert.equal(ir.schema, 'barocss-cad-ir'); assert.equal(ir.schemaVersion, 3); assert.equal(ir.sourceVersion, 3); assert.equal(ir.lengthUnit, 'mm');
  assert.deepEqual(ir.parameters.map(p => [p.id, p.quantityKind, p.value, p.unit]), [['width', 'length', w, 'mm'], ['height', 'length', w, 'mm'], ['depth', 'length', w / 4, 'mm']]);
  assert.deepEqual(ir.nodes.map(n => [n.kind, n.id]), [['curve', 'untouched_curve'], ['curve', 'profile'], ['extrude', 'wall'], ['surface', 'untouched_surface']]);
  assert.equal(ir.functions.length, 2);
  for (const fn of ir.functions) { assert.deepEqual(Object.keys(fn).sort(), ['id', 'declaration', 'returnKind', 'arguments'].sort()); assert.deepEqual(fn.declaration, byId.get(fn.id)); assert.equal(fn.returnKind, 'length'); assert.deepEqual(fn.arguments, byId.get(fn.id).arguments.map(a => ({ name: a.name, quantityKind: a.quantityKind, defaultQuantity: a.defaultExpression ? quantity('scalar', 2) : null }))); }
  assert.equal(ir.calls.length, 4); assert.deepEqual(ir.calls.map(c => [c.frameId, c.functionId, c.parentFrameId, c.depth]), [[0, 'half', null, 1], [1, 'scaleLength', 0, 2], [2, 'scaleLength', null, 1], [3, 'scaleLength', null, 1]]);
  const expectedResults = [w / 2, w / 2, w, w / 4], expectedBindings = [[quantity('length', w)], [quantity('length', w), quantity('scalar', .5)], [quantity('length', w / 2), quantity('scalar', 2)], [quantity('length', w), quantity('scalar', .25)]];
  ir.calls.forEach((call, i) => {
    assert.deepEqual(Object.keys(call).sort(), ['frameId', 'parentFrameId', 'functionId', 'depth', 'callSpan', 'definitionSpan', 'owner', 'bindings', 'result'].sort());
    const fn = byId.get(call.functionId); assert.deepEqual(call.definitionSpan, fn.range); assert.deepEqual(call.result, quantity('length', expectedResults[i]));
    assert.deepEqual(call.owner, { objectId: i === 3 ? 'depth' : 'height', field: 'value', indices: [] });
    assert.deepEqual(call.bindings.map(b => b.formalName), fn.arguments.map(a => a.name)); assert.deepEqual(call.bindings.map(b => b.quantity), expectedBindings[i]);
    const callNode = callNodes.get(call.callSpan.start + ':' + call.callSpan.end); assert.ok(callNode); assert.equal(callNode.functionId, call.functionId);
    call.bindings.forEach((binding, j) => { assert.deepEqual(binding.formalSpan, fn.arguments[j].range); const isDefault = i === 2 && j === 1; assert.equal(binding.origin, isDefault ? 'default' : 'explicit'); if (isDefault) { assert.equal(binding.argumentSpan, null); assert.deepEqual(binding.defaultSpan, fn.arguments[j].defaultExpression.range); } else { assert.equal(binding.defaultSpan, null); const argument = callNode.arguments.find(a => a.name === binding.formalName); assert.ok(argument); assert.deepEqual(binding.argumentSpan, argument.range); assert.ok(sourceRange(text, binding.argumentSpan).length > 0); } });
    assert.ok(sourceRange(text, call.callSpan).startsWith(call.functionId + '('));
  });
  const roots = result.ast.declarations.filter(d => d.kind === 'parameter'), widthRoot = roots.find(d => d.id === 'width');
  assert.equal(sourceRange(text, widthRoot.fields.find(f => f.name === 'value').value.range), w / 10 + ' cm');
  const depthCall = roots.find(d => d.id === 'depth').fields.find(f => f.name === 'value').value; assert.equal(depthCall.kind, 'call'); assert.deepEqual(depthCall.arguments.map(a => a.name), ['factor', 'value']);
  assert.deepEqual(ir.calls[3].bindings.map(b => b.formalName), ['value', 'factor']);
  const cost = expansionOracle(result.ast); assert.equal(cost.callEntries, 4); assert.equal(cost.bindings, 7); assert.equal(cost.defaults, 1); assert.equal(cost.maximumCallDepth, 2);
  assert.deepEqual(ir.work.preflight, { callEntries: cost.callEntries, expressionEvaluations: cost.expressionEvaluations, maximumCallDepth: cost.maximumCallDepth });
  assert.deepEqual(ir.work.actual, { callEntries: 4, defaultAdmissionEvaluations: 1, defaultRuntimeEvaluations: 1, expressionEvaluations: cost.expressionEvaluations, maximumCallDepth: 2 });
  assert.deepEqual(Object.keys(ir.work).sort(), ['limits', 'preflight', 'actual', 'fileSizes', 'ownValues'].sort());
  assert.equal(ir.work.limits.maximumFunctions, 8); assert.equal(ir.work.limits.maximumArguments, 4); assert.equal(ir.work.limits.maximumCallEntries, 256); assert.equal(ir.work.limits.maximumExpressionEvaluations, 65536); assert.equal(ir.work.limits.maximumSuccessUTF8, 16777216); assert.equal(ir.work.limits.maximumOwnValues, 4194304);
  const own = ownOracle(result); assert.equal(ir.work.ownValues, own.count); assert.deepEqual(ir.work.fileSizes, { success: size(nativeJSON(result) + '\n') });
  assert.deepEqual(result.model, expectedModel(w)); assert.equal(result.constructions.length, 1); assert.equal(result.constructions[0].inputId, 'profile'); assert.equal(result.constructions[0].outputId, 'wall'); assert.deepEqual(result.constructions[0].vector, [0, w / 4, w]);
  const widthRefs = ir.dependencies.filter(d => d.toId === 'width'); assert.ok(widthRefs.some(d => d.fromId === 'height')); assert.ok(widthRefs.some(d => d.fromId === 'depth')); assert.ok(widthRefs.some(d => d.fromId === 'profile'));
  assert.ok(!ir.dependencies.some(d => ['value', 'factor'].includes(d.toId)), 'Formal references are not fictitious global dependencies');
  for (const binding of ir.bindings) { assert.ok(Array.isArray(binding.indices)); assert.ok(Number.isFinite(binding.value)); assert.ok(['length', 'scalar'].includes(binding.quantityKind)); assert.ok(sourceRange(text, binding.span).length > 0); }
  assert.ok(Object.is(result.model.objects[0].controlPoints[0][0], -0)); assert.ok(Object.is(result.model.objects[3].controlPoints[0][0][2], -0));
  return { cost, own, work: clone(ir.work), wholeModelExact: true, callFramesDistinct: true, typedDefaultsAndArgumentOrderChecked: true };
}
function nativeObservations(result, w) {
  const curve = result.model.objects[1], surface = result.model.objects[2], rows = [];
  for (const t of [0, .5, 1]) { additionalWork.curveD0Calls++; const d0 = evaluateCurve(curve, t); additionalWork.curveD1Calls++; const d1 = evaluateCurveD1(curve, t); assert.deepEqual(d0, [w * t, 0, 0]); assert.deepEqual(d1, { point: d0, derivative: [w, 0, 0] }); rows.push({ kind: 'curve', t, d0, d1 }); }
  for (const u of [0, 1]) for (const v of [0, 1]) { additionalWork.surfaceD0Calls++; const d0 = evaluateSurface(surface, u, v); additionalWork.surfaceD1Calls++; const d1 = evaluateSurfaceD1(surface, u, v); assert.deepEqual(d0, [w * u, w / 4 * v, w * v]); assert.deepEqual(d1, { point: d0, du: [w, 0, 0], dv: [0, w / 4, w] }); rows.push({ kind: 'surface', u, v, d0, d1 }); }
  return rows;
}
function compileState(name, source, w) {
  const before = source; additionalWork.source3CompileCalls++; const result = compile(source, { sourceVersion: 3 }); assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); assert.equal(source, before);
  const oracle = receiptOracle(result, source, w), sourcePath = saveText(name + '.source3.css', source), resultPath = saveJSON(name + '-success', result);
  saveJSON(name + '-oracle', oracle); saveJSON(name + '-native-observations', nativeObservations(result, w));
  const manifest = { sourceVersion: 3, sourceFile: name + '.source3.css', encoding: 'utf-8', sha256: hash(source) }, manifestPath = saveJSON(name + '-source-manifest', manifest);
  const reopenedManifest = JSON.parse(readFileSync(manifestPath, 'utf8')), reopenedSource = readFileSync(sourcePath, 'utf8'); assert.equal(hash(reopenedSource), reopenedManifest.sha256); assert.equal(reopenedSource, source);
  additionalWork.source3ColdReopens++; const cold = compile(reopenedSource, { sourceVersion: reopenedManifest.sourceVersion }); assert.deepEqual(cold, result); ownOracle(cold); assert.notStrictEqual(cold, result); assert.notStrictEqual(cold.ir.calls[0], result.ir.calls[0]);
  saveJSON(name + '-cold-success', cold); retained.push([result, nativeJSON(result)], [cold, nativeJSON(cold)]);
  cases.push({ name, w, sourcePath, manifestPath, resultPath, sourceHash: hash(source), work: clone(result.ir.work), coldWholeEquality: true, directNativeCalls: { curveD0: 3, curveD1: 3, surfaceD0: 4, surfaceD1: 4 } }); return { source: reopenedSource, result: cold };
}
function editWidth(current, cm) {
  const declaration = current.result.ast.declarations.find(d => d.kind === 'parameter' && d.id === 'width'), range = declaration.fields.find(f => f.name === 'value').value.range;
  const original = sourceRange(current.source, range), replacement = cm + ' cm'; assert.notEqual(original, replacement);
  const source = current.source.slice(0, range.start) + replacement + current.source.slice(range.end);
  assert.equal(source.slice(0, range.start), current.source.slice(0, range.start)); assert.equal(source.slice(range.start + replacement.length), current.source.slice(range.end));
  return { source, patch: { startUTF16: range.start, endUTF16: range.end, originalText: original, replacementText: replacement, outsideBytesPreserved: true } };
}
saveJSON('source-api-metafile', bundle.metafile); saveJSON('source-api-inputs', { entry, inputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version });
const original = compileState('main-width10cm', mainSource, 100), edited12 = editWidth(original, 12); saveJSON('width10-to12-literal-patch', edited12.patch);
const second = compileState('main-width12cm', edited12.source, 120), edited8 = editWidth(second, 8); saveJSON('width12-to8-literal-patch', edited8.patch);
const final = compileState('main-width8cm', edited8.source, 80); assert.deepEqual(final.result.model.objects[0], original.result.model.objects[0]); assert.deepEqual(final.result.model.objects[3], original.result.model.objects[3]);

function reject(name, source, expected, options = { sourceVersion: 3 }) {
  additionalWork.refusalCompileCalls++; const result = compile(source, options);
  assert.equal(result.ok, false, name); assert.deepEqual(Object.keys(result).sort(), ['ok', 'diagnostics'].sort()); assert.ok(result.diagnostics.length > 0);
  const codes = result.diagnostics.map(d => d.code); if (expected) assert.ok(codes.some(code => (Array.isArray(expected) ? expected : [expected]).includes(code)), name + ': ' + codes.join(','));
  for (const d of result.diagnostics) { assert.equal(d.severity, 'error'); assert.equal(typeof d.message, 'string'); if (source.length <= 262144) sourceRange(source, d.range); if (d.code.startsWith('FUNCTION_')) assert.ok(typeof d.objectId === 'string' && d.objectId.length > 0); assert.equal(Object.hasOwn(d, 'callTrace'), false); }
  failures.push({ name, diagnostics: result.diagnostics, sourceHash: hash(source), sourceSizes: size(source), noPartialModel: true }); retention(); return result;
}
function changed(name, from, to, expected) { const source = mainSource.replace(from, to); assert.notEqual(source, mainSource, name); saveText('refused-' + name + '.source3.css', source); return reject(name, source, expected); }
changed('unknown-function', 'half(value: $width)', 'unknown(value: $width)', 'FUNCTION_REFERENCE');
changed('missing-argument', 'half(value: $width)', 'half()', 'FUNCTION_ARGUMENT');
changed('unknown-argument', 'half(value: $width)', 'half(other: $width)', 'FUNCTION_ARGUMENT');
changed('duplicate-argument', 'half(value: $width)', 'half(value: $width, value: $width)', 'FUNCTION_ARGUMENT');
changed('positional-argument', 'half(value: $width)', 'half($width)', ['SYNTAX', 'FUNCTION_ARGUMENT']);
changed('formal-kind', 'half(value: $width)', 'half(value: 2)', ['FUNCTION_TYPE', 'UNIT']);
changed('return-kind', 'return: $value * $factor;', 'return: $factor;', 'FUNCTION_TYPE');
changed('global-capture', 'return: $value * $factor;', 'return: $width;', 'FUNCTION_CAPTURE');
changed('geometry-capture', 'return: $value * $factor;', 'return: $profile;', 'FUNCTION_CAPTURE');
changed('default-reference', 'factor: scalar = 2', 'factor: scalar = $value', 'FUNCTION_CAPTURE');
changed('default-call', 'factor: scalar = 2', 'factor: scalar = scaleLength(value: 1 mm)', ['FUNCTION_CAPTURE', 'FUNCTION_TYPE']);
changed('default-type', 'factor: scalar = 2', 'factor: scalar = 2 mm', 'FUNCTION_TYPE');
changed('direct-recursion', 'return: $value * $factor;', 'return: scaleLength(value: $value);', 'FUNCTION_RECURSION');
changed('indirect-recursion', 'return: $value * $factor;', 'return: half(value: $value);', 'FUNCTION_RECURSION');
changed('argument-parameter-cycle', 'value: 10 cm;', 'value: $height;', 'CYCLE');
changed('division-negative-zero', 'return: $value * $factor;', 'return: $value / -0;', 'DIVISION_ZERO');
changed('division-positive-zero', 'return: $value * $factor;', 'return: $value / 0;', 'DIVISION_ZERO');
changed('runtime-magnitude', 'return: $value * $factor;', 'return: $value * 1000000000000;', 'VALUE');
changed('default-admission-division', 'factor: scalar = 2', 'factor: scalar = 1 / 0', 'DIVISION_ZERO');
const scalarSource = mainSource.replace('@function #half', '@function #identity(value: scalar): scalar { return: $value; }\r\n@function #half').replace('[$width,0,0]', '[identity(value: 2),0,0]');
saveText('refused-scalar-call-is-not-mm.source3.css', scalarSource); reject('scalar-call-is-not-mm', scalarSource, 'UNIT');
const forwardSource = mainSource.replace('@function #scaleLength(value: length, factor: scalar = 2): length { return: $value * $factor; }\r\n@function #half(value: length): length { return: scaleLength(value: $value, factor: .5); }', '@function #half(value: length): length { return: scaleLength(value: $value, factor: .5); }\r\n@function #scaleLength(value: length, factor: scalar = 2): length { return: $value * $factor; }');
assert.notEqual(forwardSource, mainSource); additionalWork.source3CompileCalls++; const forward = compile(forwardSource, { sourceVersion: 3 }); assert.equal(forward.ok, true, JSON.stringify(forward.diagnostics)); assert.deepEqual(forward.model, expectedModel(100)); saveJSON('forward-function-reference', { source: forwardSource, result: forward });
const expansionFunctions = Array.from({ length: 7 }, (_, i) => '@function #f' + i + '(value: length): length { return: ' + (i === 0 ? '$value' : 'f' + (i - 1) + '(value: $value) + f' + (i - 1) + '(value: $value)') + '; }').join('\r\n');
const expansionSource = '@model expansion {version:3;length-unit:mm;\r\n' + expansionFunctions + '\r\n' + ['a', 'b', 'c'].map(id => '@parameter #' + id + ' {type:length;value:f6(value:1 mm);}').join('\r\n') + '\r\n@curve #line {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[0,0,0],[$a,0,0]];weights:[1,1];}\r\n}\r\n';
saveText('refused-acyclic381.source3.css', expansionSource); const expansionFailure = reject('acyclic381-call-preflight', expansionSource, 'LIMIT'); assert.match(expansionFailure.diagnostics[0].message, /before numerical evaluation/); saveJSON('acyclic381-independent-plan', { functions: 7, depth: 7, entriesPerRoot: 127, rootCount: 3, totalEntries: 381, maximumAdmittedEntries: 256, rootReturnMM: 64, nativeGeometrySafeIfEvaluated: true, actualPreflightDiagnosticRetained: true, noNumericOrLoweringAcceptanceClaim: true });
reject('raw-source-cap', ' '.repeat(262145), 'LIMIT');
let getterCalls = 0; const getterOptions = {}; Object.defineProperty(getterOptions, 'sourceVersion', { enumerable: true, get() { getterCalls++; return 3; } }); reject('public-options-getter-zero', mainSource, 'OPTIONS', getterOptions); assert.equal(getterCalls, 0);
reject('unsupported-source-version', mainSource, 'OPTIONS', { sourceVersion: 4 });

const oldCurve = '@curve #line {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[0,0,0],[100,0,0]];weights:[1,1];}';
const oldSources = [
  '@model legacy {version:0;length-unit:mm;' + oldCurve + '}',
  '@model legacy {version:1;length-unit:mm;' + oldCurve + '@extrude #wall {curve:#line;vector:[0,0,50];}}',
  '@model legacy {version:2;length-unit:mm;@parameter #width {type:length;value:10 cm;}@parameter #height {type:length;value:$width/2;}' + oldCurve.replace('[100,0,0]', '[$width,0,0]') + '@extrude #wall {curve:#line;vector:[0,0,$height];}}'
];
for (const [version, source] of oldSources.entries()) {
  additionalWork.oldDialectCompileCalls++; const result = compile(source, { sourceVersion: version }); assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); assert.equal(result.ir.schemaVersion, version === 2 ? 2 : 1); assert.equal(result.model.version, 0); for (const field of ['functions', 'calls', 'work']) assert.equal(Object.hasOwn(result.ir, field), false);
  assert.deepEqual(result.model.objects[0], { kind: 'curve', id: 'line', degree: 1, knots: [0, 0, 1, 1], controlPoints: [[0, 0, 0], [100, 0, 0]], weights: [1, 1] });
  if (version > 0) assert.deepEqual(result.model.objects[1], { kind: 'surface', id: 'wall', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[0, 0, 0], [0, 0, 50]], [[100, 0, 0], [100, 0, 50]]], weights: [[1, 1], [1, 1]] });
  saveJSON('legacy-source' + version, { source, result });
  reject('old-dialect' + version + '-function-refusal', source.replace('length-unit:mm;', 'length-unit:mm;@function #f(x:scalar):scalar{return:$x;}'), 'KIND', { sourceVersion: version });
}
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types), publicAPI = await import(pathToFileURL(runtimePath).href);
assert.equal(typeof publicAPI.compileCadModel, 'function'); assert.equal(publicAPI.compileCadStages, undefined); assert.equal(publicAPI.resolveCadFunctionParameters, undefined);
additionalWork.publicMainCompileCalls++; const publicMain = publicAPI.compileCadModel(mainSource, { sourceVersion: 3 }); assert.deepEqual(publicMain, original.result); ownOracle(publicMain);
const declarationPaths = ['index.d.ts', 'model-compiler.d.ts', 'expression-parser.d.ts', 'source-ast.d.ts', 'semantic-model.d.ts', 'function-quantity-semantics.d.ts'].map(name => resolve(packageRoot, 'dist', name));
const declarations = declarationPaths.map(path => readFileSync(path, 'utf8')).join('\n');
for (const name of newTypes) { assert.ok(declarations.includes(name), name); assert.ok(readFileSync(declarationPath, 'utf8').includes(name), 'Public type ' + name); }
const emittedArtifacts = ['index.js', 'index.d.ts', 'model-compiler.js', 'expression-parser.js', 'source-ast.js', 'semantic-model.js', 'parameter-semantics.js', 'function-quantity-semantics.js', 'function-quantity-semantics.d.ts'].map(name => { const path = resolve(packageRoot, 'dist', name), bytes = readFileSync(path); return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }; });
saveJSON('public-compiler-consumer', { runtimePath, declarationPath, source3UsesSameCompiler: true, newTypes, privateEvaluatorNotPublic: true, emittedArtifacts, mainWholeReplay: 1, noNewDocumentCodec: true });
retention();
const summary = { schema: 'barocss-pure-quantity-functions-demo', version: 0, nativeParent: 'fe946c36d33afcfdd9ef595cbd879b8d004f48a6', cases, failures, additionalWork, getterCalls, completeOriginalSourceRetained: true, wholeNativeModelsAndSiblingBitsChecked: true, sourceEdits: '10cm→12cm→8cm in original literal ranges', typedFunctionFrames: 'three scale calls plus one half; seven formal bindings; admissionDefault1/runtimeDefault1/depth2', validSuccessEnvelopeOverflowTested: false, source0DirectDocumentUnchanged: true, noEditorOrSolidClaim: true, noNumericalKernelCampaign: true };
saveJSON('summary', summary); console.log(nativeJSON(summary));
