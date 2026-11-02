import { compileCadModel } from '../../model-compiler.js';
import { validateSurface, surfaceDomain, evaluateSurface } from '../../core/math.js';
import { evaluateSurfaceD1 } from '../../core/derivatives.js';
import { curveDecimal } from '../curves/curve-source.js';
import { copyCadData } from '../../data-copy.js';
import { same } from '../../core/structural-equality.js';
import { KernelError } from '../../core/barocss-error.js';
import { EXACT_OWN_FIELDS_REQUIRED, OWN_RECORD_REQUIRED, hasExactOwnFields, isOwnRecord, ownSnapshot } from '../../core/own-data.js';
export const SourceSurfaceControlNetWideDiagnosticCode = Object.freeze({ INPUT: 'INPUT', VERSION: 'VERSION', IDENTITY: 'IDENTITY', SOURCE: 'SOURCE', TARGET: 'TARGET', BINDING: 'BINDING', BUDGET: 'BUDGET', NATIVE: 'NATIVE', OWNED: 'OWNED' });
export class SourceSurfaceControlNetWideError extends KernelError {
    code;
    constructor(code, detail, cause) { super(('Source Surface control-net wide: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'SourceSurfaceControlNetWideError'; this.code = code; }
}
const CODE = SourceSurfaceControlNetWideDiagnosticCode, FIELDS = ['xMM', 'yMM', 'zMM', 'weight'];
function check(condition, code, detail) { if (!condition)
    throw new SourceSurfaceControlNetWideError(code, detail); }
function child(action, detail) { try {
    return action();
}
catch (cause) {
    throw new SourceSurfaceControlNetWideError(CODE.NATIVE, detail, cause);
} }
function record(input, fields, code = CODE.INPUT) { check(isOwnRecord(input), code, OWN_RECORD_REQUIRED); check(hasExactOwnFields(input, fields), code, EXACT_OWN_FIELDS_REQUIRED); return input; }
const OWN = { input: CODE.INPUT, owned: CODE.OWNED, budget: CODE.BUDGET, fail: (code, detail) => { throw new SourceSurfaceControlNetWideError(code, detail); }, wrap: (code, detail, cause) => { throw new SourceSurfaceControlNetWideError(code, detail, cause); }, isRefusal: e => e instanceof SourceSurfaceControlNetWideError };
function snapshot(input, owned = false) { return ownSnapshot(input, owned, OWN); }
function bytes(source) { check(source.length <= 262144, CODE.BUDGET, 'Source UTF-16 limit exceeded'); let count = 0; for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i), next = source.charCodeAt(i + 1);
    if (code < 128)
        count++;
    else if (code < 2048)
        count += 2;
    else if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
        count += 4;
        i++;
    }
    else
        count += 3;
    check(count <= 262144, CODE.BUDGET, 'Source UTF-8 limit exceeded');
} return count; }
function compile(source, stage) { let result; try {
    result = compileCadModel(source, { sourceVersion: 0 });
}
catch (cause) {
    throw new SourceSurfaceControlNetWideError(CODE.SOURCE, 'Actual ' + stage + ' Source0 compiler failed', cause);
} if (!result.ok)
    throw new SourceSurfaceControlNetWideError(CODE.SOURCE, 'Actual ' + stage + ' whole Source0 compilation refused', result); return result; }
function value(surface, uIndex, vIndex, field) { return field === 'weight' ? surface.weights[uIndex][vIndex] : surface.controlPoints[uIndex][vIndex][field === 'xMM' ? 0 : field === 'yMM' ? 1 : 2]; }
function item(value, index) { check(value.kind === 'array' && Number.isInteger(index) && index >= 0 && index < value.items.length, CODE.BINDING, 'Actual numeric AST array path is required'); return value.items[index]; }
function scalar(declaration, uIndex, vIndex, field, surface, source) {
    const fields = declaration.fields.filter(fieldValue => fieldValue.name === (field === 'weight' ? 'weights' : 'control-points'));
    check(fields.length === 1, CODE.BINDING, 'A unique actual scalar field binding is required');
    const pole = item(item(fields[0].value, uIndex), vIndex), node = field === 'weight' ? pole : item(pole, field === 'xMM' ? 0 : field === 'yMM' ? 1 : 2);
    check(node.kind === 'number', CODE.BINDING, 'An actual directly authored numeric scalar is required');
    const range = node.range;
    check(Number.isInteger(range.start) && Number.isInteger(range.end) && range.start >= declaration.range.start && range.start >= fields[0].value.range.start && range.start >= 0 && range.start < range.end && range.end <= fields[0].value.range.end && range.end <= declaration.range.end && range.end <= source.length, CODE.BINDING, 'Actual numeric UTF-16 exclusive range is invalid');
    const lexeme = source.slice(range.start, range.end);
    check(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(lexeme) && Object.is(Number(lexeme), node.value) && Object.is(node.value, value(surface, uIndex, vIndex, field)), CODE.BINDING, 'Original scalar source/AST/native coefficient bits disagree');
    return node;
}
function apply(source, patches) { let result = source; for (let i = patches.length - 1; i >= 0; i--) {
    const patch = patches[i];
    check(source.slice(patch.startUTF16, patch.endUTF16) === patch.originalText, CODE.BINDING, 'Each retained patch must bind the original source lexeme');
    result = result.slice(0, patch.startUTF16) + patch.replacementText + result.slice(patch.endUTF16);
} return result; }
function untouched(original, candidate, patches) { let before = 0, after = 0; for (const patch of patches) {
    const length = patch.startUTF16 - before;
    check(original.slice(before, patch.startUTF16) === candidate.slice(after, after + length), CODE.BINDING, 'An untouched original source span changed');
    after += length;
    check(candidate.slice(after, after + patch.replacementText.length) === patch.replacementText, CODE.BINDING, 'Candidate scalar differs from the retained patch');
    after += patch.replacementText.length;
    before = patch.endUTF16;
} check(original.slice(before) === candidate.slice(after), CODE.BINDING, 'The untouched original source suffix changed'); }
/** Edit literal scalars on the complete native Surface profile while retaining the whole original Model source. */
export function editSourceSurfaceControlNetWide(input) {
    const data = record(snapshot(input), ['source', 'sourceVersion', 'surfaceId', 'edits']);
    check(data.sourceVersion === 0, CODE.VERSION, 'Only explicit literal Source0 editing is supported');
    check(typeof data.source === 'string', CODE.INPUT, 'The complete original source string is required');
    check(typeof data.surfaceId === 'string' && data.surfaceId.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.surfaceId), CODE.IDENTITY, 'Selected Surface ID must be ASCII1..48');
    const request = data, editData = record(request.edits, ['poleEdits']);
    check(Array.isArray(editData.poleEdits) && editData.poleEdits.length >= 1 && editData.poleEdits.length <= 256, CODE.BUDGET, 'Exactly1..256 distinct existing pole edits are supported');
    const originalSourceUTF8 = bytes(request.source), original = compile(request.source, 'original'), originalModel = original.model, selectedObjectIndex = originalModel.objects.findIndex(object => object.id === request.surfaceId), selected = originalModel.objects[selectedObjectIndex];
    check(selected?.kind === 'surface', CODE.TARGET, 'The selected ID must identify an existing original Surface');
    const declarations = original.ast.declarations.filter(value => value.id === selected.id), nodes = original.ir.nodes.filter(value => value.id === selected.id);
    check(declarations.length === 1 && declarations[0].kind === 'surface' && nodes.length === 1 && nodes[0].kind === 'surface' && same(nodes[0].geometry, selected) && same(nodes[0].span, declarations[0].range), CODE.BINDING, 'Unique actual Surface AST/IR/full Model binding is required');
    const declaration = declarations[0], surface = copyCadData(selected), countU = selected.controlPoints.length, countV = selected.controlPoints[0].length, targets = new Set(), provenance = [];
    let requestedFieldCount = 0;
    for (const raw of editData.poleEdits) {
        check(raw !== null && typeof raw === 'object' && !Array.isArray(raw), CODE.INPUT, 'Each pole edit must be an own record');
        const edit = raw, keys = Object.keys(edit);
        check(Object.hasOwn(edit, 'uIndex') && Object.hasOwn(edit, 'vIndex') && keys.length >= 3 && keys.length <= 6 && keys.every(key => key === 'uIndex' || key === 'vIndex' || FIELDS.includes(key)), CODE.INPUT, 'Existing U/V indices and a nonempty coordinate/weight subset are required');
        check(typeof edit.uIndex === 'number' && Number.isInteger(edit.uIndex) && edit.uIndex >= 0 && edit.uIndex < countU && typeof edit.vIndex === 'number' && Number.isInteger(edit.vIndex) && edit.vIndex >= 0 && edit.vIndex < countV, CODE.INPUT, 'In-range integer U/V pole indices are required');
        const uIndex = edit.uIndex, vIndex = edit.vIndex, target = uIndex + ':' + vIndex;
        check(!targets.has(target), CODE.INPUT, 'Pole pairs must be unique, including zero-sign aliases');
        targets.add(target);
        const requestedFields = FIELDS.filter(field => Object.hasOwn(edit, field));
        requestedFieldCount += requestedFields.length;
        check(requestedFieldCount <= 1024, CODE.BUDGET, 'The complete requested scalar limit1024 exceeded');
        const before = { pointMM: copyCadData(selected.controlPoints[uIndex][vIndex]), weight: selected.weights[uIndex][vIndex] };
        for (const field of requestedFields) {
            check(typeof edit[field] === 'number' && Number.isFinite(edit[field]), CODE.INPUT, 'Finite replacement scalars are required');
            scalar(declaration, uIndex, vIndex, field, selected, request.source);
            if (field === 'weight')
                surface.weights[uIndex][vIndex] = edit[field];
            else
                surface.controlPoints[uIndex][vIndex][field === 'xMM' ? 0 : field === 'yMM' ? 1 : 2] = edit[field];
        }
        const changedFields = requestedFields.filter(field => !Object.is(value(selected, uIndex, vIndex, field), value(surface, uIndex, vIndex, field))), after = { pointMM: copyCadData(surface.controlPoints[uIndex][vIndex]), weight: surface.weights[uIndex][vIndex] };
        provenance.push({ uIndex, vIndex, requestedFields, changedFields, before, after });
    }
    child(() => validateSurface(surface), 'Actual complete edited native Surface validation refused');
    check(surface.knotsU.length <= 22 && surface.knotsV.length <= 22 && same(surface.knotsU, selected.knotsU) && same(surface.knotsV, selected.knotsV) && surface.degreeU === selected.degreeU && surface.degreeV === selected.degreeV && surface.id === selected.id && surface.controlPoints.length === countU && surface.controlPoints.every(row => row.length === countV), CODE.BINDING, 'Original native degrees/knots/identity/grid must remain unchanged');
    for (let u = 0; u < countU; u++)
        for (let v = 0; v < countV; v++)
            for (const field of FIELDS)
                if (!provenance.find(change => change.uIndex === u && change.vIndex === v)?.requestedFields.includes(field))
                    check(Object.is(value(surface, u, v, field), value(selected, u, v, field)), CODE.BINDING, 'Every unrequested original pole/weight scalar must retain its bits');
    const patches = [];
    for (const change of provenance)
        for (const field of change.changedFields) {
            const node = scalar(declaration, change.uIndex, change.vIndex, field, selected, request.source), after = value(surface, change.uIndex, change.vIndex, field), replacementText = child(() => curveDecimal(after, 'Source Surface control-net wide'), 'Actual CAD decimal emission refused');
            check(replacementText.length <= 512 && Object.is(Number(replacementText), after), CODE.BINDING, 'Changed scalar decimal must round-trip exact accepted bits within512characters');
            patches.push({ uIndex: change.uIndex, vIndex: change.vIndex, field, startUTF16: node.range.start, endUTF16: node.range.end, originalText: request.source.slice(node.range.start, node.range.end), replacementText });
        }
    patches.sort((a, b) => a.startUTF16 - b.startUTF16);
    check(patches.length <= 1024 && patches.every((patch, index) => index === 0 || patches[index - 1].endUTF16 <= patch.startUTF16), CODE.BINDING, 'All changed scalar patches must be unique/nonoverlapping and bounded');
    const source = apply(request.source, patches), candidateSourceUTF8 = bytes(source);
    untouched(request.source, source, patches);
    const candidate = compile(source, 'candidate'), expected = copyCadData(originalModel);
    expected.objects[selectedObjectIndex] = copyCadData(surface);
    check(same(candidate.model, expected), CODE.BINDING, 'The whole candidate Model must retain original metadata/order/IDs/siblings and the complete actual edited Surface');
    const accepted = candidate.model.objects[selectedObjectIndex];
    check(accepted.kind === 'surface', CODE.BINDING, 'Actual complete candidate must retain selected Surface kind');
    const noOp = patches.length === 0;
    check(!noOp || source === request.source && same(candidate.model, originalModel), CODE.BINDING, 'Bitwise no-op must retain exact original source spelling and Model');
    const domain = child(() => surfaceDomain(selected), 'Actual original Surface domain query refused'), parameters = { u: [domain.u[0], domain.u[0] / 2 + domain.u[1] / 2, domain.u[1]], v: [domain.v[0], domain.v[0] / 2 + domain.v[1] / 2, domain.v[1]] };
    check(parameters.u.every(u => Number.isFinite(u) && u >= domain.u[0] && u <= domain.u[1]) && parameters.v.every(v => Number.isFinite(v) && v >= domain.v[0] && v <= domain.v[1]), CODE.NATIVE, 'Three finite original-domain observation parameters per axis are required');
    const queries = parameters.u.flatMap(u => parameters.v.map(v => ({ u, v })));
    const observations = queries.map(({ u, v }) => { const beforePointMM = child(() => evaluateSurface(selected, u, v), 'Actual original native Surface D0 observation refused'), afterPointMM = child(() => evaluateSurface(accepted, u, v), 'Actual edited native Surface D0 observation refused'), observedChangeMM = Math.hypot(...afterPointMM.map((value, axis) => value - beforePointMM[axis])); check(Number.isFinite(observedChangeMM), CODE.NATIVE, 'Actual native point change norm must remain finite'); return { u, v, beforePoint: beforePointMM, afterPoint: afterPointMM, observedChange: observedChangeMM }; });
    let derivativeSuccessCount = 0, derivativeRefusalCount = 0;
    const derivative = (surface, u, v) => { try {
        const result = evaluateSurfaceD1(surface, u, v);
        derivativeSuccessCount++;
        return { kind: 'evaluated', result };
    }
    catch (cause) {
        if (!(cause instanceof Error))
            throw new SourceSurfaceControlNetWideError(CODE.NATIVE, 'Actual native derivative attempt did not provide an Error', cause);
        derivativeRefusalCount++;
        return { kind: 'refused', message: cause.message.slice(0, 512) };
    } };
    const derivativeObservations = queries.map(({ u, v }) => ({ u, v, before: derivative(selected, u, v), after: derivative(accepted, u, v) }));
    check(derivativeSuccessCount + derivativeRefusalCount === 18, CODE.BINDING, 'All eighteen actual native derivative attempts must be accounted');
    const changedFieldCount = provenance.reduce((count, change) => count + change.changedFields.length, 0), changedPoleCount = provenance.filter(change => change.changedFields.length > 0).length, total = countU * countV;
    check(changedFieldCount === patches.length, CODE.BINDING, 'Every genuinely changed scalar must have exactly one retained patch');
    const report = {
        schema: 'barocss-source-surface-control-net-wide-edit', version: 0, sourceVersion: 0, modelVersion: 0, lengthUnit: 'mm', modelName: originalModel.name, surfaceId: accepted.id, selectedObjectIndex, objectCount: originalModel.objects.length, degrees: { u: accepted.degreeU, v: accepted.degreeV }, controlPointCounts: { u: countU, v: countV, total }, domain, parameters,
        requestedPoleCount: provenance.length, requestedFieldCount, changedPoleCount, changedFieldCount, untouchedPoleCount: total - changedPoleCount, untouchedFieldCount: 4 * total - changedFieldCount, patchCount: patches.length, noOp, originalSourceUTF16: request.source.length, candidateSourceUTF16: source.length, originalSourceUTF8, candidateSourceUTF8, observations, maximumObservedChange: Math.max(...observations.map(observation => observation.observedChange)), derivativeObservations,
        preservation: { untouchedSourceSpans: true, modelHeaderBits: true, objectOrderAndIds: true, unselectedObjectBits: true, selectedSurfaceEqualsActualEditedSurface: true, degreesKnotsDomainsAndGrid: true }, directCounts: { originalCompileCount: 1, candidateCompileCount: 1, nativeSurfaceValidationCount: 1, domainQueryCount: 1, surfacePointEvaluationCount: 18, surfaceDerivativeEvaluationCount: 18, derivativeSuccessCount, derivativeRefusalCount, decimalEmissionCount: changedFieldCount },
        quality: { geometricValidity: 'not-certified', topologyCertified: false, solid: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, editorDisplayCertified: false, persistentTopologyBindingCertified: false, parametricRecipeBindingCertified: false, derivativeSemantics: 'native-guards-unchanged', ownership: 'independent-copied-cpu-data-gc' },
        limits: { maximumPatches: 1024, maximumEdits: 256, maximumRequestedFields: 1024, maximumModelObjects: 16, maximumSelectedDegree: 5, maximumSelectedGridAxis: 16, maximumSelectedPoles: 256, maximumSelectedKnotsPerAxis: 22, selectedCoordinateAbs: 1000000, minimumWeight: 0.000001, maximumWeight: 1000000, maximumReplacementLiteralCharacters: 512, maximumPointObservations: 9, maximumDerivativeObservations: 9, sourceUTF16: 262144, sourceUTF8: 262144, ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, stringCharacters: 262144 }, workScope: 'direct-original-candidate-compiles-edited-native-validation-and-fixed-observations-inherited-work-excluded', budgetFailure: 'atomic-no-partial-source-surface-edit',
    };
    return snapshot({ request, originalModel, model: candidate.model, source, surface: accepted, provenance, patches, report }, true);
}
/** Rebuild the entire source operation and its native observations, comparing every retained bit. */
export function validateSourceSurfaceControlNetWideEdit(input) {
    const owned = record(snapshot(input, true), ['request', 'originalModel', 'model', 'source', 'surface', 'provenance', 'patches', 'report'], CODE.OWNED);
    let expected;
    try {
        expected = editSourceSurfaceControlNetWide(owned.request);
    }
    catch (cause) {
        throw new SourceSurfaceControlNetWideError(CODE.OWNED, 'Whole owned source/native Surface edit reconstruction refused', cause);
    }
    check(same(owned, expected), CODE.OWNED, 'Owned request/full sources/Model/Surface/provenance/patches/native observations/counters changed');
    return snapshot(expected.report, true);
}
