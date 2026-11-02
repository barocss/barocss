import { CadAstError } from './source-ast.js';
import { validateCurve, validateSurface } from '../core/math.js';
import { preflightExtrusion } from '../features/extrusion-validation.js';
import { copyCadData } from '../data-copy.js';
import { resolveCadParameters } from '../document/parameter-semantics.js';
import { resolveCadFunctionParameters } from '../document/function-quantity-semantics.js';
export { copyCadData } from '../data-copy.js';
function raw(value) {
    if (value.kind === 'array')
        return value.items.map(raw);
    if (value.kind === 'reference')
        return value.id;
    if (value.kind === 'number' || value.kind === 'identifier')
        return value.value;
    throw new CadAstError('TYPE', 'Resolved numeric values are required', value.range);
}
const zeroRange = () => ({ start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 });
function nativeCode(message) {
    if (/^Degree /i.test(message))
        return 'DEGREE';
    if (/knot|domain|multiplicity/i.test(message))
        return 'KNOTS';
    if (/weight/i.test(message))
        return 'WEIGHTS';
    if (/at most|exceed|1e6/i.test(message))
        return 'LIMIT';
    if (/three|dimension|point/i.test(message))
        return 'DIMENSION';
    return 'GEOMETRY';
}
function geometryRange(d, message) {
    // The original surface validator does not identify U versus V in knot errors.
    // Retain the owning declaration rather than blame the other axis's valid field.
    if (d.kind === 'surface' && (nativeCode(message) === 'DEGREE' || nativeCode(message) === 'KNOTS'))
        return d.range;
    const keys = nativeCode(message) === 'DEGREE' ? ['degree'] : nativeCode(message) === 'KNOTS' ? ['knots'] : /weight/i.test(message) ? ['weights'] : ['control-points'];
    return d.fields.find(f => keys.includes(f.name))?.value.range ?? d.range;
}
/** Resolve original source data and preflight every feature before any lowering. */
function analyzeGeometry(ast, sourceVersion) {
    const nodes = [];
    const literals = new Map();
    const byId = new Map(ast.declarations.map(d => [d.id, d]));
    for (const declaration of ast.declarations) {
        if (declaration.kind === 'parameter')
            throw new CadAstError('TYPE', 'Unresolved parameter cannot enter geometry validation', declaration.range, declaration.id);
        if (declaration.kind === 'function')
            throw new CadAstError('TYPE', 'Unresolved function cannot enter geometry validation', declaration.range, declaration.id);
        if (declaration.kind === 'extrude') {
            if (!declaration.fields.some(f => f.name === 'curve') || !declaration.fields.some(f => f.name === 'vector'))
                throw new CadAstError('FIELD', 'Extrusion requires curve and vector fields', declaration.range, declaration.id);
            continue;
        }
        const props = new Map(declaration.fields.map(f => [f.name, f]));
        const keys = declaration.kind === 'curve' ? ['type', 'degree', 'knots', 'control-points', 'weights'] : ['type', 'degree-u', 'degree-v', 'knots-u', 'knots-v', 'control-points', 'weights'];
        for (const key of keys)
            if (!props.has(key))
                throw new CadAstError('FIELD', 'Missing field ' + key, declaration.range, declaration.id);
        if (raw(props.get('type').value) !== 'nurbs')
            throw new CadAstError('VALUE', 'Only nurbs is supported', props.get('type').value.range, declaration.id);
        const get = (name) => raw(props.get(name).value);
        const geometry = declaration.kind === 'curve' ? {
            kind: 'curve', id: declaration.id, degree: get('degree'), knots: get('knots'),
            controlPoints: get('control-points'), weights: get('weights'),
        } : {
            kind: 'surface', id: declaration.id, degreeU: get('degree-u'), degreeV: get('degree-v'),
            knotsU: get('knots-u'), knotsV: get('knots-v'),
            controlPoints: get('control-points'), weights: get('weights'),
        };
        try {
            if (geometry.kind === 'curve')
                validateCurve(geometry);
            else
                validateSurface(geometry);
        }
        catch (error) {
            const message = error.message;
            throw new CadAstError(nativeCode(message), message, geometryRange(declaration, message), declaration.id);
        }
        const suffix = declaration.kind === 'surface' ? '[][]' : '[]';
        const fieldTypes = Object.fromEntries(keys.map(key => [key, key === 'type' ? 'geometry-kind' : key.startsWith('degree') ? 'integer' : key.startsWith('knots') ? 'dimensionless[]' : key === 'control-points' ? 'mm-point3' + suffix : 'dimensionless' + suffix]));
        const fields = { id: declaration.id, span: { ...declaration.range }, fieldTypes };
        literals.set(declaration.id, geometry.kind === 'curve' ? { ...fields, kind: 'curve', geometry } : { ...fields, kind: 'surface', geometry });
    }
    const version = ast.fields.find(f => f.name === 'version'), unit = ast.fields.find(f => f.name === 'length-unit');
    if (!version || raw(version.value) !== sourceVersion)
        throw new CadAstError('VERSION', 'Declared source version must match sourceVersion: ' + sourceVersion, version?.value.range ?? zeroRange());
    if (!unit || raw(unit.value) !== 'mm')
        throw new CadAstError('UNIT', 'length-unit: mm is required', unit?.value.range ?? zeroRange());
    if (!ast.declarations.length)
        throw new CadAstError('GEOMETRY', 'Model must contain geometry', zeroRange(), undefined);
    const dependencies = [];
    for (const declaration of ast.declarations) {
        if (declaration.kind !== 'extrude') {
            nodes.push(literals.get(declaration.id));
            continue;
        }
        const reference = declaration.fields.find(f => f.name === 'curve'), vectorField = declaration.fields.find(f => f.name === 'vector');
        if (!reference || !vectorField)
            throw new CadAstError('FIELD', 'Extrusion requires curve and vector fields', declaration.range, declaration.id);
        const inputId = raw(reference.value), input = byId.get(inputId), vector = raw(vectorField.value);
        if (!input || input.kind !== 'curve') {
            const detail = !input ? 'Undefined curve reference ' + inputId : 'Reference ' + inputId + ' has kind ' + input.kind + '; a curve is required';
            throw new CadAstError('REFERENCE', detail, reference.value.range, declaration.id);
        }
        const curve = literals.get(inputId).geometry;
        try {
            preflightExtrusion(curve, { id: declaration.id, vector });
        }
        catch (error) {
            const message = error.message;
            throw new CadAstError(nativeCode(message), message, vectorField.value.range, declaration.id);
        }
        nodes.push({ kind: 'extrude', id: declaration.id, inputId, vector: copyCadData(vector), span: { ...declaration.range }, referenceSpan: { ...reference.value.range }, fieldTypes: { curve: 'curve-reference', vector: 'mm-vector3' } });
        dependencies.push({ fromId: declaration.id, toId: inputId, kind: 'curve-input', span: { ...reference.value.range } });
    }
    return { name: ast.name, lengthUnit: 'mm', nodes, dependencies };
}
/** All references/quantities/native inputs resolve before any derived lowering. */
export function analyzeCadAst(ast, sourceVersion, _source) {
    if (sourceVersion === 3) {
        const resolved = resolveCadFunctionParameters(ast);
        const geometry = analyzeGeometry(resolved.ast, 3);
        const dependencies = [...geometry.dependencies, ...resolved.dependencies].sort((a, b) => a.span.start - b.span.start);
        return { schema: 'barocss-cad-ir', schemaVersion: 3, sourceVersion: 3, ...geometry, dependencies,
            parameters: resolved.parameters, bindings: resolved.bindings, functions: resolved.functions,
            calls: resolved.calls, work: resolved.work };
    }
    if (sourceVersion !== 2) {
        const geometry = analyzeGeometry(ast, sourceVersion);
        return { schema: 'barocss-cad-ir', schemaVersion: 1, sourceVersion, ...geometry };
    }
    const resolved = resolveCadParameters(ast);
    const geometry = analyzeGeometry(resolved.ast, 2);
    const dependencies = [...geometry.dependencies, ...resolved.dependencies].sort((a, b) => a.span.start - b.span.start);
    return { schema: 'barocss-cad-ir', schemaVersion: 2, sourceVersion: 2, ...geometry, dependencies,
        parameters: resolved.parameters, bindings: resolved.bindings };
}
