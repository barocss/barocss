import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
assert.deepEqual(args.slice(0, 1), ['--source']);
assert.equal(args.length, 2, 'Usage: node iges-import-demo.mjs --source <output-directory>');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(args[1]);
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild');
const bundle = await esbuild.build({ absWorkingDir: repo, entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
assert.equal(bundle.outputFiles.length, 1);
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
assert.ok(inputs.includes(resolve(repo, 'packages/barocss-cad/src/iges-import.ts')));
assert.ok(!inputs.some(path => path.includes('/packages/barocss-cad/dist/')));
assert.ok(inputs.filter(path => path.includes('/packages/barocss-cad/')).every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { importIGES, validateIGESImport, IGESImportError, IGESImportDiagnosticCode: codes, exportIGES, compileCadModel, editSourceCurveControlPolygon, validateSourceCurveControlPolygonEdit, editSourceSurfaceControlNetWide, validateSourceSurfaceControlNetWideEdit } = api;
const runtimeNames = ['importIGES', 'validateIGESImport', 'IGESImportError', 'IGESImportDiagnosticCode'];
const typeNames = ['IGESImportOptions', 'IGESImportEntity', 'IGESImportReport', 'IGESImportResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
for (const name of ['INPUT', 'IDENTITY', 'FILE', 'RECORD', 'GLOBAL', 'DIRECTORY', 'PARAMETER', 'UNSUPPORTED', 'BUDGET', 'NUMBER', 'NATIVE', 'SOURCE', 'BINDING', 'OWNED']) assert.equal(codes[name], name);
const files = new Map(), retained = [], refusals = [], ownControls = [];
const oracleWork = { fileOracleCalls: 0, coldCompileCalls: 0, ownedValidationCalls: 0, curveEditCalls: 0, surfaceEditCalls: 0, publicImportCalls: 0, publicOwnedCalls: 0, samplerCalls: 0, rationalOperations: 0 };
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
const size = text => ({ utf16: text.length, utf8: Buffer.byteLength(text) });
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : nativeJSON(value)).digest('hex');
function saveText(name, text) {
  const path = resolve(output, name); writeFileSync(path, text); files.set(path, readFileSync(path));
  assert.equal(readFileSync(path, 'utf8'), text); return path;
}
function saveJSON(name, value, limit = 4194304) {
  const text = nativeJSON(value) + '\n'; assert.ok(text.length <= limit && Buffer.byteLength(text) <= limit, name);
  const path = saveText(name + '.json', text); assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), value); return path;
}
function cold(source, expected, name) {
  assert.ok(source.length <= 262144 && Buffer.byteLength(source) <= 262144);
  const path = saveText(name + '.source0.css', source);
  oracleWork.coldCompileCalls++;
  const result = compileCadModel(readFileSync(path, 'utf8'), { sourceVersion: 0 });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); assert.deepEqual(result.model, expected);
  saveJSON(name + '-cold-model', result.model); return result.model;
}
function retention() {
  for (const [path, bytes] of files) assert.deepEqual(readFileSync(path), bytes, path);
  for (const [value, snapshot] of retained) assert.equal(nativeJSON(value), snapshot);
}
function independentlyOwned(input, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  function collect(value) { if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); Object.values(value).forEach(collect); } }
  function visit(value) { if (value && typeof value === 'object') { assert.ok(!caller.has(value)); assert.ok(!seen.has(value)); seen.add(value); Object.values(value).forEach(visit); } }
  collect(input); visit(result);
}
function reject(name, callback, expected) {
  let failure;
  try { callback(); } catch (error) { failure = error; }
  assert.ok(failure instanceof IGESImportError, name + ': actual importer error');
  if (expected) assert.ok((Array.isArray(expected) ? expected : [expected]).includes(failure.code), name + ': ' + failure.code);
  const cause = failure.cause;
  refusals.push({ name, code: failure.code, message: failure.message, causeName: cause?.name ?? null, causeCode: cause?.code ?? null, causeMessage: cause?.message ?? null });
  retention(); return failure;
}

// This scanner uses the supplied file only. It has no exporter sidecar input.
function scan(payload) {
  const tokens = []; let offset = 0;
  while (offset < payload.length) {
    while (payload[offset] === ' ') offset++;
    const start = offset, header = /^(\d+)H/.exec(payload.slice(offset));
    let text, value, kind;
    if (header) {
      const length = Number(header[1]); assert.ok(length <= 256);
      offset += header[0].length; value = payload.slice(offset, offset + length);
      assert.equal(value.length, length); offset += length;
      text = payload.slice(start, offset); kind = 'hollerith';
    } else {
      const end = payload.slice(offset).search(/[,;]/); assert.ok(end >= 0);
      offset += end; text = payload.slice(start, offset).trimEnd();
      assert.match(text, /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?$/);
      value = Number(text); assert.ok(Number.isFinite(value)); kind = 'number';
    }
    while (payload[offset] === ' ') offset++;
    const delimiter = payload[offset++]; assert.ok(delimiter === ',' || delimiter === ';');
    tokens.push({ index: tokens.length, kind, text, value }); assert.ok(tokens.length <= 1082);
    if (delimiter === ';') { assert.match(payload.slice(offset), /^ *$/); return tokens; }
  }
  assert.fail('Missing record delimiter');
}
function int(text) { assert.match(text.trim(), /^\d+$/); const value = Number(text); assert.ok(Number.isSafeInteger(value)); return value; }
function fileOracle(text) {
  oracleWork.fileOracleCalls++; assert.ok(text.endsWith('\n'));
  const lines = text.slice(0, -1).split('\n'), sections = { S: [], G: [], D: [], P: [], T: [] };
  let previous = -1;
  for (const line of lines) {
    assert.equal(line.length, 80); assert.match(line, /^[\x20-\x7e]{80}$/);
    const section = line[72], order = 'SGDPT'.indexOf(section); assert.ok(order >= previous && order >= 0); previous = order;
    sections[section].push(line); assert.equal(int(line.slice(73)), sections[section].length);
  }
  assert.equal(sections.S.length, 1); assert.equal(sections.T.length, 1); assert.equal(sections.D.length % 2, 0);
  const records = Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, value.length]));
  for (const [index, section] of ['S', 'G', 'D', 'P'].entries()) {
    const field = sections.T[0].slice(index * 8, index * 8 + 8); assert.equal(field[0], section); assert.equal(int(field.slice(1)), records[section]);
  }
  const globals = scan(sections.G.map(line => line.slice(0, 72)).join('')); assert.equal(globals.length, 26);
  assert.equal(globals.filter(token => token.kind === 'hollerith').length, 13);
  const decoded = []; let first = 1;
  for (let index = 0; index < sections.D.length / 2; index++) {
    const row1 = sections.D[2 * index], row2 = sections.D[2 * index + 1];
    const entity = int(row1.slice(0, 8)), pointer = int(row1.slice(8, 16)), count = int(row2.slice(24, 32));
    assert.equal(int(row2.slice(0, 8)), entity); assert.equal(pointer, first);
    for (let field = 2; field < 8; field++) assert.equal(int(row1.slice(field * 8, field * 8 + 8)), 0);
    assert.equal(row1.slice(64, 72), '00000000'); assert.equal(row2.slice(40, 56), ' '.repeat(16));
    for (const field of [1, 2, 4, 8]) assert.equal(int(row2.slice(field * 8, field * 8 + 8)), 0);
    const pointerD = 2 * index + 1, run = sections.P.slice(pointer - 1, pointer - 1 + count);
    assert.equal(run.length, count); run.forEach(line => assert.equal(int(line.slice(64, 72)), pointerD));
    const tokens = scan(run.map(line => line.slice(0, 64)).join('')); assert.ok(tokens.every(token => token.kind === 'number'));
    const numbers = tokens.map(token => token.value); assert.equal(numbers[0], entity);
    let cursor = entity === 126 ? 7 : 10;
    const nu = numbers[1] + 1, nv = entity === 128 ? numbers[2] + 1 : null;
    const pu = entity === 128 ? numbers[3] : numbers[2], pv = entity === 128 ? numbers[4] : null;
    const header = [0, cursor], knotsU = [cursor, cursor += nu + pu + 1];
    const knotsV = nv === null ? null : [cursor, cursor += nv + pv + 1];
    const total = nu * (nv ?? 1), weights = [cursor, cursor += total], cartesian = [cursor, cursor += 3 * total];
    const domains = [cursor, cursor += nv === null ? 2 : 4], normal = nv === null ? [cursor, cursor += 3] : null;
    assert.equal(cursor, numbers.length);
    const slice = range => numbers.slice(...range);
    const object = entity === 126
      ? { kind: 'curve', id: '', degree: pu, knots: slice(knotsU), weights: slice(weights), controlPoints: Array.from({ length: nu }, (_, u) => numbers.slice(cartesian[0] + 3 * u, cartesian[0] + 3 * u + 3)) }
      : { kind: 'surface', id: '', degreeU: pu, degreeV: pv, knotsU: slice(knotsU), knotsV: slice(knotsV), weights: Array.from({ length: nu }, (_, u) => Array.from({ length: nv }, (_, v) => numbers[weights[0] + v * nu + u])), controlPoints: Array.from({ length: nu }, (_, u) => Array.from({ length: nv }, (_, v) => numbers.slice(cartesian[0] + 3 * (v * nu + u), cartesian[0] + 3 * (v * nu + u) + 3))) };
    decoded.push({ entity, pointerD, pointer, count, labelField: row2.slice(56, 64), tokens, numbers, object, mapping: { firstSequence: pointer, lastSequence: pointer + count - 1, recordCount: count, tokenCount: tokens.length, header, knotsU, knotsV, weights, cartesian, domains, normal } });
    first += count;
  }
  assert.equal(first - 1, sections.P.length);
  return { sections, records, globals, decoded, tokenCount: globals.length + decoded.reduce((sum, item) => sum + item.tokens.length, 0), lines };
}
function importOracle(result, expectedObjects) {
  assert.deepEqual(Object.keys(result).sort(), ['request', 'source', 'model', 'metadata', 'entities', 'report'].sort());
  const parsed = fileOracle(result.request.iges), report = result.report;
  assert.deepEqual(result.metadata.globals, parsed.globals); assert.deepEqual(result.metadata.records, parsed.records);
  assert.equal(result.metadata.startText, parsed.sections.S[0].slice(0, 72));
  assert.deepEqual(report.records, parsed.records); assert.equal(report.entityCount, parsed.decoded.length);
  assert.equal(result.model.name, result.request.options.modelName); assert.equal(result.model.version, 0); assert.equal(result.model.lengthUnit, 'mm');
  for (const [index, decoded] of parsed.decoded.entries()) {
    const object = { ...decoded.object, id: result.request.options.idPrefix + '_d' + decoded.pointerD }, entity = result.entities[index];
    assert.deepEqual(result.model.objects[index], object);
    if (expectedObjects) {
      const normalized = structuredClone(expectedObjects[index]); normalized.id = object.id;
      function normalize(value) { return Array.isArray(value) ? value.map(normalize) : typeof value === 'number' && Object.is(value, -0) ? 0 : value; }
      for (const key of ['knots', 'knotsU', 'knotsV', 'weights', 'controlPoints']) if (key in normalized) normalized[key] = normalize(normalized[key]);
      assert.deepEqual(object, normalized);
    }
    assert.equal(entity.index, index); assert.equal(entity.entity, decoded.entity); assert.equal(entity.directoryPointer, decoded.pointerD);
    assert.equal(entity.parameterPointer, decoded.pointer); assert.equal(entity.parameterRecords, decoded.count);
    assert.equal(entity.labelField, decoded.labelField); assert.equal(entity.label, decoded.labelField.trimEnd());
    assert.equal(entity.nativeId, object.id); assert.equal(entity.nativeObjectIndex, index); assert.deepEqual(entity.parameterMapping, decoded.mapping);
    assert.equal(entity.coefficientOrder, object.kind === 'curve' ? 'curve-pole-order-xyz' : 'surface-u-fastest-to-native-u-v');
    const isCurve = object.kind === 'curve', nu = object.controlPoints.length, nv = isCurve ? null : object.controlPoints[0].length;
    assert.deepEqual(entity.degrees, { u: isCurve ? object.degree : object.degreeU, v: isCurve ? null : object.degreeV });
    assert.deepEqual(entity.poleCounts, { u: nu, v: nv, total: nu * (nv ?? 1) });
    assert.deepEqual(entity.knotCounts, { u: isCurve ? object.knots.length : object.knotsU.length, v: isCurve ? null : object.knotsV.length });
    assert.deepEqual(entity.domain, { u: decoded.numbers.slice(decoded.mapping.domains[0], decoded.mapping.domains[0] + 2), v: isCurve ? null : decoded.numbers.slice(decoded.mapping.domains[0] + 2, decoded.mapping.domains[1]) });
    const polynomial = decoded.numbers[isCurve ? 5 : 7];
    assert.deepEqual(entity.flags, isCurve ? { planar: 0, closed: 0, polynomial, periodic: 0, normal: [0, 0, 0] } : { closedU: 0, closedV: 0, polynomial, periodicU: 0, periodicV: 0 });
  }
  const objects = result.model.objects;
  const maximum = Math.max(0, ...objects.flatMap(object => object.controlPoints.flat(object.kind === 'curve' ? 1 : 2)).map(Math.abs));
  assert.ok(Object.is(parsed.globals[19].value, maximum)); assert.ok(Object.is(report.actualMaximumCoordinateMM, maximum)); assert.ok(Object.is(report.declaredMaximumCoordinateMM, maximum));
  assert.deepEqual(report.nativeIds, objects.map(object => object.id));
  assert.deepEqual(report.directoryPointers, parsed.decoded.map(item => item.pointerD)); assert.deepEqual(report.parameterPointers, parsed.decoded.map(item => item.pointer));
  assert.equal(report.curveCount, objects.filter(object => object.kind === 'curve').length); assert.equal(report.surfaceCount, objects.filter(object => object.kind === 'surface').length);
  assert.equal(result.metadata.parameterDelimiter, ','); assert.equal(result.metadata.recordDelimiter, ';');
  assert.equal(result.metadata.unitFlag, 2); assert.equal(result.metadata.lengthUnit, 'mm'); assert.equal(result.metadata.modelScale, 1);
  assert.ok(Object.is(result.metadata.declaredMaximumCoordinateMM, maximum)); assert.ok(Object.is(result.metadata.actualMaximumCoordinateMM, maximum));
  for (const [index, value] of [[6, 32], [7, 38], [8, 6], [9, 308], [10, 17], [12, 1], [13, 2], [15, 1], [16, 0], [18, 1e-9], [22, 11], [23, 0]]) assert.equal(parsed.globals[index].value, value);
  assert.equal(parsed.globals[14].value, 'MM'); assert.equal(parsed.globals[17].value, '20000101.000000'); assert.equal(parsed.globals[24].value, '20000101.000000'); assert.equal(parsed.globals[25].value, '');
  assert.equal(report.duplicateDirectoryLabelCount, parsed.decoded.length - new Set(parsed.decoded.map(item => item.labelField.trimEnd())).size);
  assert.equal(report.fileNegativeZeroTokenCount, [...parsed.globals, ...parsed.decoded.flatMap(item => item.tokens)].filter(token => token.kind === 'number' && Object.is(token.value, -0)).length);
  const direct = report.directCounts, decimals = objects.reduce((sum, object) => sum + (object.kind === 'curve' ? 1 + object.knots.length + 4 * object.controlPoints.length : 2 + object.knotsU.length + object.knotsV.length + 4 * object.controlPoints.length * object.controlPoints[0].length), 0);
  assert.equal(direct.recordScanCount, parsed.lines.length); assert.equal(direct.tokenScanCount, parsed.tokenCount);
  assert.equal(direct.hollerithParseCount, 13); assert.equal(direct.numericParseCount, parsed.tokenCount - 13);
  assert.equal(direct.integerFieldParseCount, parsed.lines.length + 14 * objects.length + parsed.records.P + 4);
  assert.equal(direct.decimalEmissionCount, decimals); assert.equal(direct.fullSourceCompileCount, 1);
  assert.equal(direct.nativeCurveValidationCount, objects.filter(object => object.kind === 'curve').length);
  assert.equal(direct.nativeSurfaceValidationCount, objects.filter(object => object.kind === 'surface').length);
  assert.equal(direct.curveDomainQueryCount, direct.nativeCurveValidationCount); assert.equal(direct.surfaceDomainQueryCount, direct.nativeSurfaceValidationCount);
  for (const key of ['curveD0Count', 'curveD1AttemptCount', 'surfaceD0Count', 'surfaceD1AttemptCount', 'rationalOperationCount']) assert.equal(direct[key], 0);
  assert.deepEqual(report.inputSizes, size(result.request.iges)); assert.deepEqual(report.sourceSizes, size(result.source));
  assert.deepEqual(report.fileSizes.request, size(nativeJSON(result.request) + '\n')); assert.deepEqual(report.fileSizes.result, size(nativeJSON(result) + '\n'));
  for (const [key, value] of Object.entries(report.quality)) if (typeof value === 'boolean') assert.equal(value, ['nativeGeometryValidated', 'sourceCoefficientBinding', 'geometryOnly'].includes(key), key);
  assert.equal(report.losses.originalFullNativeIdsRecovered, false); assert.equal(report.losses.originalAuthoredZeroSignsRecovered, false);
  assert.equal(report.losses.parsedNegativeZeroBitsPreserved, true);
  for (const value of Object.values(report.preservation)) assert.equal(value, true);
  return parsed;
}

const curve = { kind: 'curve', id: 'same_lab_curve', degree: 5, knots: [...Array(6).fill(-3), ...Array(6).fill(5)], weights: Array.from({ length: 6 }, (_, i) => i % 2 ? 3 : 1), controlPoints: Array.from({ length: 6 }, (_, i) => [2 * i, (-1) ** i * (i + 1), i * i / 4]) };
curve.controlPoints[0] = [-0, -0, -0];
const surface = { kind: 'surface', id: 'same_lab_surface', degreeU: 5, degreeV: 4, knotsU: [...Array(6).fill(-0), ...Array(6).fill(3)], knotsV: [...Array(5).fill(-2), ...Array(5).fill(2)], weights: Array.from({ length: 6 }, (_, u) => Array.from({ length: 5 }, (_, v) => 1 + (u + 2 * v) / 8 + u * v / 16)), controlPoints: Array.from({ length: 6 }, (_, u) => Array.from({ length: 5 }, (_, v) => [100 * u + v / 8, 200 * v + u / 16, u * u / 4 + v * v / 8 + u * v / 32])) };
surface.controlPoints[0][0] = [-0, -0, -0];
const longName = ('Native; IGES, complete source ' + 'weighted tensor '.repeat(10)).padEnd(200, ' ');
assert.equal(longName.length, 200);
const nativeModel = { name: longName, version: 0, lengthUnit: 'mm', objects: [curve, surface] };
const beforeNative = nativeJSON(nativeModel), exported = exportIGES(nativeModel, [surface.id, curve.id]);
assert.equal(nativeJSON(nativeModel), beforeNative);
saveJSON('main-native-model', nativeModel); saveJSON('main-export-report', exported.report); saveText('main-export.igs', exported.iges);
const options = { sourceId: 'imported_geometry', modelName: 'imported_iges_model', idPrefix: 'imp', maximumEntities: 16, maximumRecords: 8192 };
const beforeOptions = nativeJSON(options), main = importIGES(exported.iges, options);
assert.equal(nativeJSON(options), beforeOptions); independentlyOwned(options, main);
const parsed = importOracle(main, [surface, curve]); assert.equal(parsed.tokenCount, 230); assert.equal(main.report.directCounts.decimalEmissionCount, 181);
assert.equal(main.report.duplicateDirectoryLabelCount, 1); assert.ok(parsed.records.G > 3);
assert.ok(parsed.globals.some(token => token.kind === 'hollerith' && token.value === longName + '.igs'));
assert.equal(main.report.fileNegativeZeroTokenCount, 0);
saveJSON('main-request', main.request, 1048576); saveJSON('main-result', main); cold(main.source, main.model, 'main-imported');
oracleWork.ownedValidationCalls++; assert.deepEqual(validateIGESImport(main), main.report);
retained.push([main, nativeJSON(main)], [nativeModel, beforeNative]);

function saveEdit(name, edit, validator) {
  assert.deepEqual(validator(edit), edit.report); saveJSON(name + '-request', edit.request); saveJSON(name + '-result', edit);
  cold(edit.source, edit.model, name); retained.push([edit, nativeJSON(edit)]); return edit;
}
oracleWork.curveEditCalls++;
const curveEdit = saveEdit('curve-edit', editSourceCurveControlPolygon({ source: main.source, sourceVersion: 0, curveId: 'imp_d3', edits: { poleEdits: [{ index: 3, xMM: main.model.objects[1].controlPoints[3][0] + .25 }] } }), validateSourceCurveControlPolygonEdit);
assert.deepEqual(curveEdit.model.objects[0], main.model.objects[0]); assert.notEqual(curveEdit.source, main.source);
oracleWork.surfaceEditCalls++;
const surfaceEdit = saveEdit('surface-edit', editSourceSurfaceControlNetWide({ source: readFileSync(resolve(output, 'curve-edit.source0.css'), 'utf8'), sourceVersion: 0, surfaceId: 'imp_d1', edits: { poleEdits: [{ uIndex: 2, vIndex: 1, zMM: curveEdit.model.objects[0].controlPoints[2][1][2] + .5 }] } }), validateSourceSurfaceControlNetWideEdit);
assert.deepEqual(surfaceEdit.model.objects[1], curveEdit.model.objects[1]); assert.notEqual(surfaceEdit.source, curveEdit.source);
oracleWork.curveEditCalls++;
const reedit = saveEdit('curve-reedit', editSourceCurveControlPolygon({ source: readFileSync(resolve(output, 'surface-edit.source0.css'), 'utf8'), sourceVersion: 0, curveId: 'imp_d3', edits: { poleEdits: [{ index: 1, weight: 3.25 }] } }), validateSourceCurveControlPolygonEdit);
assert.deepEqual(reedit.model.objects[0], surfaceEdit.model.objects[0]); assert.equal(reedit.model.objects[1].controlPoints[3][0], 6.25); assert.equal(reedit.model.objects[1].weights[1], 3.25);

// Repack the supplied tokens for controls whose token length changes. Recompute
// real P pointers, counts and T counts, so a number guard is not a pointer test.
function pack(tokens, width) {
  const lines = []; let current = '';
  tokens.forEach((text, index) => {
    let token = text + (index === tokens.length - 1 ? ';' : ',');
    if (current && current.length + token.length > width) { lines.push(current.padEnd(width, ' ')); current = ''; }
    while (token.length > width) { lines.push(token.slice(0, width)); token = token.slice(width); }
    current += token;
  });
  if (current) lines.push(current.padEnd(width, ' ')); return lines;
}
const field = value => String(value).padStart(8, ' ');
const lineFor = (body, section, sequence) => body.padEnd(72, ' ') + section + String(sequence).padStart(7, ' ');
function repack(globalTexts, parameterTexts) {
  const globalLines = pack(globalTexts, 72).map((body, i) => lineFor(body, 'G', i + 1));
  const d = [], p = [];
  parameterTexts.forEach((tokens, index) => {
    const run = pack(tokens, 64), pointer = p.length + 1, owner = 2 * index + 1;
    let row1 = parsed.sections.D[2 * index].slice(0, 72), row2 = parsed.sections.D[2 * index + 1].slice(0, 72);
    row1 = row1.slice(0, 8) + field(pointer) + row1.slice(16);
    row2 = row2.slice(0, 24) + field(run.length) + row2.slice(32);
    d.push(lineFor(row1, 'D', owner), lineFor(row2, 'D', owner + 1));
    run.forEach(body => p.push(lineFor(body + field(owner), 'P', p.length + 1)));
  });
  const counts = { S: 1, G: globalLines.length, D: d.length, P: p.length };
  const t = lineFor(Object.entries(counts).map(([section, count]) => section + String(count).padStart(7, ' ')).join(''), 'T', 1);
  return [parsed.sections.S[0], ...globalLines, ...d, ...p, t].join('\n') + '\n';
}
const globalTexts = parsed.globals.map(token => token.text), parameterTexts = parsed.decoded.map(item => item.tokens.map(token => token.text));
function parameterVariant(entityIndex, tokenIndex, value) { const changed = structuredClone(parameterTexts); changed[entityIndex][tokenIndex] = value; return repack(globalTexts, changed); }
function globalVariant(index, value) { const changed = [...globalTexts]; changed[index] = value; return repack(changed, parameterTexts); }
function recordVariant(section, index, start, end, replacement) {
  const lines = [...parsed.lines], lineIndex = lines.findIndex(line => line[72] === section && int(line.slice(73)) === index + 1);
  assert.ok(lineIndex >= 0); assert.equal(replacement.length, end - start);
  lines[lineIndex] = lines[lineIndex].slice(0, start) + replacement + lines[lineIndex].slice(end); return lines.join('\n') + '\n';
}
const zeroText = parameterVariant(1, parsed.decoded[1].mapping.cartesian[0], '-0');
const zero = importIGES(zeroText, { ...options, sourceId: 'negative_zero_geometry', idPrefix: 'neg' });
importOracle(zero); assert.equal(zero.report.fileNegativeZeroTokenCount, 1); assert.ok(Object.is(zero.model.objects[1].controlPoints[0][0], -0));
saveText('negative-zero-token.igs', zeroText); saveJSON('negative-zero-result', zero); cold(zero.source, zero.model, 'negative-zero'); retained.push([zero, nativeJSON(zero)]);

function parserReject(name, text, expected) {
  saveJSON('refusal-' + name + '-request', { iges: text, options }, 1048576);
  return reject(name, () => importIGES(text, options), expected);
}
parserReject('missing-final-lf', exported.iges.slice(0, -1), 'RECORD');
parserReject('crlf', exported.iges.replaceAll('\n', '\r\n'), ['RECORD', 'FILE']);
parserReject('bad-sequence', recordVariant('D', 0, 73, 80, '      2'), 'RECORD');
parserReject('transform-reference', recordVariant('D', 0, 48, 56, field(1)), ['DIRECTORY', 'UNSUPPORTED']);
parserReject('parameter-owner', recordVariant('P', 0, 64, 72, field(3)), ['DIRECTORY', 'PARAMETER']);
parserReject('parameter-count', recordVariant('D', 1, 24, 32, field(parsed.decoded[0].count + 1)), ['DIRECTORY', 'PARAMETER']);
parserReject('maximum-coordinate', globalVariant(19, String(main.report.actualMaximumCoordinateMM + 1)), 'GLOBAL');
parserReject('units', globalVariant(13, '1'), ['GLOBAL', 'UNSUPPORTED']);
parserReject('scale', globalVariant(12, '2'), ['GLOBAL', 'UNSUPPORTED']);
parserReject('hollerith-length', globalVariant(3, '1H' + longName + '.igs'), 'GLOBAL');
parserReject('periodic-surface', parameterVariant(0, 8, '1'), ['PARAMETER', 'UNSUPPORTED']);
parserReject('polynomial-mismatch', parameterVariant(0, 7, '1'), ['PARAMETER', 'BINDING']);
parserReject('domain-mismatch', parameterVariant(1, parsed.decoded[1].mapping.domains[0], '-2'), ['PARAMETER', 'BINDING']);
parserReject('whole-token-garbage', parameterVariant(1, parsed.decoded[1].mapping.cartesian[0], '0.0x'), 'NUMBER');
parserReject('underflow-nonzero', parameterVariant(1, parsed.decoded[1].mapping.cartesian[0], '1E-999'), 'NUMBER');
parserReject('overflow', parameterVariant(1, parsed.decoded[1].mapping.cartesian[0], '1E999'), 'NUMBER');
parserReject('fortran-exponent', parameterVariant(1, parsed.decoded[1].mapping.cartesian[0], '1D0'), 'NUMBER');
parserReject('curve-pole-cap', parameterVariant(1, 1, '64'), ['BUDGET', 'PARAMETER']);
parserReject('surface-axis-cap', parameterVariant(0, 1, '16'), ['BUDGET', 'PARAMETER']);
parserReject('zero-weight-native', parameterVariant(1, parsed.decoded[1].mapping.weights[0], '0.0'), ['NATIVE', 'PARAMETER']);

const capKnots = [0, 0, ...Array.from({ length: 14 }, (_, i) => i + 1), 15, 15];
const tinySurface = id => ({ kind: 'surface', id, degreeU: 1, degreeV: 1, knotsU: [...capKnots], knotsV: [...capKnots], weights: Array.from({ length: 16 }, () => Array(16).fill(1)), controlPoints: Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => [Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE])) });
const tinyModel = { name: 'source_expansion', version: 0, lengthUnit: 'mm', objects: [tinySurface('tiny_a'), tinySurface('tiny_b')] };
const tinyExport = exportIGES(tinyModel, ['tiny_a', 'tiny_b']);
assert.ok(tinyExport.iges.includes('5E-324')); assert.ok(tinyExport.iges.length < 1048576);
saveJSON('source-expansion-native-model', tinyModel); saveJSON('source-expansion-export-report', tinyExport.report); saveText('source-expansion.igs', tinyExport.iges);
const expansionFailure = reject('genuine-source-expansion', () => importIGES(tinyExport.iges, { ...options, idPrefix: 'tiny' }), ['BUDGET', 'SOURCE', 'FILE']);
assert.ok(2 * 256 * 3 * 326 > 262144);

const mutations = [
  ['source', result => { result.source += '\n'; }],
  ['raw-input', result => { result.request.iges = zeroText; }],
  ['native-coordinate', result => { result.model.objects[0].controlPoints[2][1][2] += .25; }],
  ['native-weight', result => { result.model.objects[1].weights[1] += .25; }],
  ['native-id', result => { result.model.objects[0].id = 'wrong_id'; }],
  ['label', result => { result.entities[0].label = 'different'; }],
  ['token-range', result => { result.entities[0].parameterMapping.weights[0]++; }],
  ['pointer', result => { result.entities[0].directoryPointer = 3; }],
  ['metadata', result => { result.metadata.globals[2].value += 'changed'; }],
  ['count', result => { result.report.directCounts.numericParseCount++; }],
  ['loss', result => { result.report.losses.originalFullNativeIdsRecovered = true; }],
  ['quality', result => { result.report.quality.solid = true; }],
  ['size', result => { result.report.fileSizes.result.utf8++; }]
];
for (const [name, mutate] of mutations) {
  const changed = structuredClone(main), before = nativeJSON(changed); mutate(changed); assert.notEqual(nativeJSON(changed), before);
  reject('owned-' + name, () => { oracleWork.ownedValidationCalls++; return validateIGESImport(changed); }, 'OWNED'); ownControls.push(name);
}
let getterCalls = 0;
const accessorOptions = structuredClone(options); Object.defineProperty(accessorOptions, 'modelName', { enumerable: true, get() { getterCalls++; return options.modelName; } });
reject('options-getter', () => importIGES(exported.iges, accessorOptions), ['INPUT', 'OWNED']); assert.equal(getterCalls, 0);
const hidden = structuredClone(options); Object.defineProperty(hidden, 'hidden', { value: 1 }); reject('hidden-option', () => importIGES(exported.iges, hidden), ['INPUT', 'OWNED']);
const symbolic = structuredClone(options); symbolic[Symbol('hidden')] = 1; reject('symbol-option', () => importIGES(exported.iges, symbolic), ['INPUT', 'OWNED']);
const foreign = Object.assign(Object.create({ inherited: true }), options); reject('foreign-option', () => importIGES(exported.iges, foreign), ['INPUT', 'OWNED']);
const cyclic = structuredClone(main); cyclic.request.options.cycle = cyclic; reject('owned-cycle', () => validateIGESImport(cyclic), 'OWNED');
const sparse = structuredClone(main); delete sparse.entities[0]; reject('owned-sparse', () => validateIGESImport(sparse), 'OWNED');

saveJSON('source-api.metafile', bundle.metafile); saveText('source-api.mjs', bundle.outputFiles[0].text);
const publicAPI = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')).href);
const declarations = readFileSync(resolve(repo, 'packages/barocss-cad/dist/index.d.ts'), 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.match(declarations, new RegExp('\\b' + name + '\\b'));
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.IGESImportDiagnosticCode, codes);
oracleWork.publicImportCalls++;
const publicResult = publicAPI.importIGES(exported.iges, options); assert.deepEqual(publicResult, main);
oracleWork.publicOwnedCalls++; assert.deepEqual(publicAPI.validateIGESImport(publicResult), publicResult.report);
saveJSON('current-public-main', publicResult);
retention();
const summary = {
  schema: 'barocss-native-iges-import-demo', version: 0, sourceOnly: true,
  runtimeNames, typeNames, nativeParent: '6d60a50894660ea16aa90e9e669219633e370027',
  main: { inputHash: hash(exported.iges), importedHash: hash(main), records: main.report.records, directCounts: main.report.directCounts, inputSizes: main.report.inputSizes, sourceSizes: main.report.sourceSizes, fileSizes: main.report.fileSizes, duplicateLabels: main.report.duplicateDirectoryLabelCount, originalNegativeZeroKnown: true, exporterCanonicalizedKnownZeros: true },
  edits: { curve: hash(curveEdit.source), surface: hash(surfaceEdit.source), reopenedCurve: hash(reedit.source), curveSiblingPreserved: true, surfaceSiblingPreserved: true, delegatedDirectCounts: [curveEdit.report.directCounts, surfaceEdit.report.directCounts, reedit.report.directCounts] },
  negativeZeroFileCount: zero.report.fileNegativeZeroTokenCount,
  sourceExpansion: { inputSizes: size(tinyExport.iges), coordinateLiteralLowerBound: 500736, actualCode: expansionFailure.code, actualCause: expansionFailure.cause?.message ?? null },
  oracleWork, oracleWorkScope: 'demo-direct-calls-editor-native-observations-retained-separately', ownedControls: ownControls, getterCalls, refusals,
  sourceInputs: inputs.length, outputFilesBeforeSummary: files.size, noGeneralIGESClaim: true, noRendererClaim: true
};
saveJSON('summary', summary);
console.log(nativeJSON(summary));
