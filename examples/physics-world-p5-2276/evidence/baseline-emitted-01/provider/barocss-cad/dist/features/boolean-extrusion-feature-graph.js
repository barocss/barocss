import { admitParameter, definition, resolve, length } from '../sketch/circle-graph-internal.js';
import { buildConvexPlanarFace } from '../own-convex-planar-face.js';
import { booleanCoplanarFaces } from '../planar-solids/coplanar-face-boolean.js';
import { extrudeCoplanarFaceBoolean } from '../planar-solids/coplanar-face-boolean-extrusion.js';
import { validateCurve, validateSurface } from '../core/math.js';
import { copyCadData } from '../data-copy.js';
import { same } from '../core/structural-equality.js';
import { KernelError } from '../core/barocss-error.js';
export const BooleanExtrusionFeatureGraphDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', PARAMETER: 'PARAMETER', DEPENDENCY: 'DEPENDENCY',
    REVISION: 'REVISION', BUDGET: 'BUDGET', NATIVE: 'NATIVE', REPRESENTABILITY: 'REPRESENTABILITY', JSON: 'JSON', OWNED: 'OWNED' });
export class BooleanExtrusionFeatureGraphError extends KernelError {
    code;
    path;
    featureId;
    parameterId;
    constructor(code, detail, context = {}) {
        const path = typeof context.path === 'string' ? context.path.slice(0, 256) : '$';
        super(('Boolean Extrusion Feature Graph: ' + path + ': ' + detail).slice(0, 1024), context.cause === undefined ? undefined : { cause: context.cause });
        const ownId = (value) => typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value) ? value : null;
        this.name = 'BooleanExtrusionFeatureGraphError';
        this.code = code;
        this.path = path;
        this.featureId = ownId(context.featureId);
        this.parameterId = ownId(context.parameterId);
    }
}
const CODE = BooleanExtrusionFeatureGraphDiagnosticCode, LABEL = 'Boolean extrusion feature graph native length';
function check(condition, code, detail, context = {}) {
    if (!condition)
        throw new BooleanExtrusionFeatureGraphError(code, detail, context);
}
function helper(action, code, detail, context) {
    try {
        return action();
    }
    catch (cause) {
        if (cause instanceof BooleanExtrusionFeatureGraphError)
            throw cause;
        throw new BooleanExtrusionFeatureGraphError(code, detail, { ...context, cause });
    }
}
function snapshot(input, owned = false, code = CODE.INPUT, root = '$') {
    let remaining = owned ? 1048576 : 16384;
    const ancestors = new Set();
    const copy = (value, depth, path) => {
        check(--remaining >= 0 && depth <= (owned ? 40 : 12), code, 'own-value/depth budget exceeded', { path });
        if (value === null && owned || typeof value === 'boolean')
            return value;
        if (typeof value === 'number') {
            check(Number.isFinite(value), code, 'finite own numbers required', { path });
            return value;
        }
        if (typeof value === 'string') {
            check(value.length <= (owned ? 262144 : 128), code, 'bounded own/source string required', { path });
            return value;
        }
        check(value !== null && typeof value === 'object', code, 'plain own data required', { path });
        check(!ancestors.has(value), code, 'ancestor cycles refused', { path });
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
        check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'foreign own-data prototype refused', { path });
        check(keys.length <= (array ? (owned ? 8193 : 65) : (owned ? 64 : 16)) && keys.every(key => typeof key === 'string' && key.length <= 128
            && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden/excess fields refused', { path });
        ancestors.add(value);
        try {
            if (array) {
                const n = descriptors.length.value;
                check(Number.isInteger(n) && n >= 0 && n <= (owned ? 8192 : 64) && keys.length === n + 1, code, 'dense bounded own array required', { path });
                return Array.from({ length: n }, (_, i) => {
                    check(Object.hasOwn(descriptors, String(i)), code, 'sparse/foreign own array field refused', { path });
                    return copy(descriptors[String(i)].value, depth + 1, path + '[' + i + ']');
                });
            }
            return Object.fromEntries(keys.map(key => [key, copy(descriptors[key].value, depth + 1, path + '.' + key)]));
        }
        finally {
            ancestors.delete(value);
        }
    };
    return copy(input, 0, root);
}
function record(input, fields, context = {}, code = CODE.INPUT) {
    check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'own record required', context);
    const data = input;
    check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'exact fields required: ' + fields.join(','), context);
    return data;
}
function id(value, context, maximum = 48) {
    check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII ID1..' + maximum + ' required', context);
    return value;
}
function revision(value, path) {
    check(typeof value === 'number' && Number.isInteger(value) && !Object.is(value, -0) && value >= 0 && value <= 1000000000, CODE.REVISION, 'unsigned stable revision0..1000000000 required', { path });
    return value;
}
function boundedInteger(value, maximum, context, minimum = 0) {
    check(typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum, CODE.BUDGET, 'integer native work/output bound required', context);
    return value;
}
function admitDefinition(input, context) {
    const admitted = helper(() => definition(input, LABEL, context.path ?? '$'), CODE.PARAMETER, 'actual original typed length definition admission', context);
    if (admitted.kind === 'offset')
        id(admitted.parameterId, { ...context, path: context.path + '.parameterId' });
    return admitted;
}
function admitOptions(input) {
    const data = record(input, ['maximumParameterResolutions', 'maximumFeatureEvaluations'], { path: '$options' });
    return { maximumParameterResolutions: boundedInteger(data.maximumParameterResolutions, 8, { path: '$options.maximumParameterResolutions' }),
        maximumFeatureEvaluations: boundedInteger(data.maximumFeatureEvaluations, 7, { path: '$options.maximumFeatureEvaluations' }) };
}
function admitNativeFace(data, context) {
    const p = record(data.plane, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights'], { ...context, path: context.path + '.plane' });
    id(p.id, context);
    check(p.kind === 'surface' && p.degreeU === 1 && p.degreeV === 1 && Array.isArray(p.controlPoints)
        && p.controlPoints.length === 2 && p.controlPoints.every(row => Array.isArray(row) && row.length === 2 && row.every(point => Array.isArray(point)
        && point.length === 3 && point.every(value => typeof value === 'number' && Math.abs(value) <= 10000))), CODE.INPUT, 'original degree1x1 four-pole Plane coordinates required', context);
    helper(() => validateSurface(p), CODE.NATIVE, 'original native Plane profile admission', context);
    const l = record(data.loop, ['id', 'edges'], { ...context, path: context.path + '.loop' });
    id(l.id, context);
    check(Array.isArray(l.edges) && l.edges.length >= 3 && l.edges.length <= 8, CODE.INPUT, '3..8 original ordered native Lines required', context);
    const edges = l.edges.map((value, index) => {
        const edgeContext = { ...context, path: context.path + '.loop.edges[' + index + ']' };
        const curve = record(value, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights'], edgeContext);
        id(curve.id, edgeContext);
        check(curve.kind === 'curve' && curve.degree === 1 && Array.isArray(curve.controlPoints) && curve.controlPoints.length === 2
            && curve.controlPoints.every(point => Array.isArray(point) && point.length === 3 && point.every(value => typeof value === 'number' && Math.abs(value) <= 10000)), CODE.INPUT, 'original two-pole Line coordinates required', edgeContext);
        helper(() => validateCurve(curve), CODE.NATIVE, 'original native Line profile admission', edgeContext);
        check(curve.weights.length === 2 && Object.is(curve.weights[0], curve.weights[1]), CODE.INPUT, 'original equal-weight native Line required', edgeContext);
        return curve;
    });
    const o = record(data.options, ['faceId', 'evaluationId', 'resultIdPrefix', 'orientation'], context);
    check(o.orientation === 'forward' || o.orientation === 'reverse', CODE.INPUT, 'explicit native face orientation required', context);
    const options = { faceId: id(o.faceId, context), evaluationId: id(o.evaluationId, context),
        resultIdPrefix: id(o.resultIdPrefix, context, 20), orientation: o.orientation };
    const roles = [p.id, l.id, options.faceId, options.evaluationId, ...edges.map(edge => edge.id),
        ...edges.flatMap((_, i) => ['v', 'e', 'use', 'uv'].map(stem => options.resultIdPrefix + '_' + stem + '_' + i))];
    check(new Set(roles).size === roles.length, CODE.IDENTITY, 'native Face within-context original/generated IDs must be distinct', context);
    return { id: data.id, kind: 'face-input', outputSlotId: data.outputSlotId, plane: p, loop: { id: l.id, edges }, options };
}
function admitDocument(input) {
    const data = record(input, ['format', 'version', 'id', 'revision', 'lengthUnit', 'sourceFrame', 'parameters', 'features'], { path: '$' });
    check(data.format === 'barocss-native-boolean-extrusion-feature-graph' && Object.is(data.version, 0) && data.lengthUnit === 'mm'
        && data.sourceFrame === 'authored-xyz-no-axis-conversion', CODE.INPUT, 'current native intent graph0/mm/authored XYZ header required', { path: '$.format/version/lengthUnit/sourceFrame' });
    const graphId = id(data.id, { path: '$.id' }), graphRevision = revision(data.revision, '$.revision');
    check(Array.isArray(data.parameters) && data.parameters.length <= 8, CODE.BUDGET, '0..8 original typed parameters required', { path: '$.parameters' });
    const parameters = data.parameters.map((value, index) => {
        const path = '$.parameters[' + index + ']';
        const own = record(value, ['id', 'type', 'definition'], { path }), parameterId = id(own.id, { path: path + '.id' });
        const p = helper(() => admitParameter(value, LABEL, path), CODE.PARAMETER, 'actual original typed parameter admission', { path, parameterId });
        id(p.id, { path: path + '.id', parameterId: p.id });
        if (p.definition.kind === 'offset')
            id(p.definition.parameterId, { path: path + '.definition.parameterId', parameterId: p.id });
        return p;
    });
    check(Array.isArray(data.features) && data.features.length >= 4 && data.features.length <= 7, CODE.INPUT, 'two Face inputs, one Boolean and1..4 extrusions required', { path: '$.features' });
    const features = data.features.map((value, index) => {
        const path = '$.features[' + index + ']';
        check(value !== null && typeof value === 'object' && !Array.isArray(value), CODE.INPUT, 'native feature record required', { path });
        const kind = value.kind;
        check(kind === 'face-input' || kind === 'coplanar-boolean' || kind === 'normal-extrusion', CODE.INPUT, 'fixed native feature kind required', { path: path + '.kind' });
        const fields = kind === 'face-input' ? ['id', 'kind', 'outputSlotId', 'plane', 'loop', 'options'] : kind === 'coplanar-boolean'
            ? ['id', 'kind', 'outputSlotId', 'operandAFeatureId', 'operandBFeatureId', 'options'] : ['id', 'kind', 'outputSlotId', 'regionFeatureId', 'distance', 'options'];
        const f = record(value, fields, { path }), featureId = id(f.id, { path: path + '.id' }), outputSlotId = id(f.outputSlotId, { path: path + '.outputSlotId', featureId });
        const context = { path, featureId };
        if (kind === 'face-input')
            return admitNativeFace(f, context);
        if (kind === 'coplanar-boolean') {
            const o = record(f.options, ['operation', 'evaluationId', 'resultIdPrefix', 'maximumPairTests', 'maximumFragments'], context);
            check(o.operation === 'union' || o.operation === 'intersection' || o.operation === 'difference', CODE.INPUT, 'native Boolean operation required', context);
            const options = { operation: o.operation, evaluationId: id(o.evaluationId, context), resultIdPrefix: id(o.resultIdPrefix, context, 12),
                maximumPairTests: boundedInteger(o.maximumPairTests, 64, context, 1), maximumFragments: boundedInteger(o.maximumFragments, 64, context, 1) };
            return { id: featureId, kind, outputSlotId, operandAFeatureId: id(f.operandAFeatureId, context), operandBFeatureId: id(f.operandBFeatureId, context), options };
        }
        const o = record(f.options, ['evaluationId', 'resultIdPrefix', 'maximumVertices', 'maximumFaces', 'maximumSourceChunks', 'maximumBindingSamples'], context);
        return { id: featureId, kind, outputSlotId, regionFeatureId: id(f.regionFeatureId, context), distance: admitDefinition(f.distance, { path: path + '.distance', featureId }),
            options: { evaluationId: id(o.evaluationId, context), resultIdPrefix: id(o.resultIdPrefix, context, 20),
                maximumVertices: boundedInteger(o.maximumVertices, 128, context), maximumFaces: boundedInteger(o.maximumFaces, 80, context),
                maximumSourceChunks: boundedInteger(o.maximumSourceChunks, 17, context), maximumBindingSamples: boundedInteger(o.maximumBindingSamples, 1152, context) } };
    });
    const extrusionCount = features.filter(feature => feature.kind === 'normal-extrusion').length;
    check(features.filter(feature => feature.kind === 'face-input').length === 2 && features.filter(feature => feature.kind === 'coplanar-boolean').length === 1
        && extrusionCount >= 1 && extrusionCount <= 4, CODE.INPUT, 'two Face/one Boolean/one through four native extrusion nodes required', { path: '$.features' });
    return { format: 'barocss-native-boolean-extrusion-feature-graph', version: 0, id: graphId, revision: graphRevision, lengthUnit: 'mm',
        sourceFrame: 'authored-xyz-no-axis-conversion', parameters, features };
}
function collectIds(input) {
    const result = new Set(), collect = (value) => {
        if (Array.isArray(value)) {
            value.forEach(collect);
            return;
        }
        if (value !== null && typeof value === 'object')
            for (const [key, item] of Object.entries(value)) {
                if (typeof item === 'string' && (key === 'id' || key.endsWith('Id') || key === 'name'))
                    result.add(item);
                else if (key.endsWith('Ids') && Array.isArray(item))
                    for (const value of item) {
                        if (typeof value === 'string')
                            result.add(value);
                    }
                else
                    collect(item);
            }
    };
    collect(input);
    return result;
}
/** Same complete native extrusion role enumeration, including unused slots and source assets. */
function extrusionNativeRoles(feature) {
    const roles = new Set(), context = { path: '$.features.options', featureId: feature.id };
    const reserve = (value) => { check(!roles.has(value), CODE.IDENTITY, 'extrusion evaluation ID aliases another own derived role: ' + value, context); roles.add(value); };
    const prefix = feature.options.resultIdPrefix, add = (suffix) => reserve(prefix + suffix);
    reserve(feature.options.evaluationId);
    add('_s_b');
    add('_s_t');
    for (let i = 0; i < 64; i++) {
        ['_v_b_', '_v_t_', '_c_b_', '_c_t_', '_c_v_', '_e_b_', '_e_t_', '_e_v_', '_s_w_', '_f_w_', '_loop_w_', '_use_b_', '_use_t_', '_uv_b_', '_uv_t_'].forEach(stem => add(stem + i));
        for (let j = 0; j < 4; j++) {
            add('_use_w_' + i + '_' + j);
            add('_uv_w_' + i + '_' + j);
        }
    }
    for (let i = 0; i < 8; i++) {
        add('_f_b_' + i);
        add('_f_t_' + i);
        add('_shell_' + i);
    }
    for (let i = 0; i < 16; i++) {
        add('_loop_b_' + i);
        add('_loop_t_' + i);
    }
    for (let i = 0; i < 17; i++)
        add('_src_' + i);
    return roles;
}
function admitIdentities(document) {
    const logical = [document.id, ...document.parameters.map(p => p.id), ...document.features.flatMap(f => [f.id, f.outputSlotId])];
    check(new Set(logical).size === logical.length, CODE.IDENTITY, 'graph/parameter/feature/output slot IDs must be globally distinct', { path: '$.ids' });
    const original = new Set(), extrusionOwners = new Map();
    for (const feature of document.features) {
        if (feature.kind === 'face-input') {
            collectIds({ plane: feature.plane, loop: feature.loop, options: feature.options }).forEach(value => original.add(value));
            feature.loop.edges.forEach((_, i) => ['v', 'e', 'use', 'uv'].forEach(stem => original.add(feature.options.resultIdPrefix + '_' + stem + '_' + i)));
        }
        else if (feature.kind === 'coplanar-boolean') {
            const prefix = feature.options.resultIdPrefix, add = (suffix) => { original.add(prefix + suffix); };
            original.add(feature.options.evaluationId);
            add('_support');
            for (let i = 0; i < 8; i++) {
                add('_v_a_' + i);
                add('_v_b_' + i);
                add('_comp_' + i);
            }
            for (let i = 0; i < 64; i++) {
                ['_ev_', '_v_x_', '_f_', '_e_', '_use_', '_c_', '_uv_'].forEach(stem => add(stem + i));
                ['_cut_0_lo', '_cut_0_hi', '_cut_1_lo', '_cut_1_hi'].forEach(cut => add('_xf_' + i + cut));
            }
            for (let i = 0; i < 16; i++)
                add('_loop_' + i);
            for (let i = 0; i < 5; i++)
                add('_src_' + i);
        }
        else {
            for (const value of extrusionNativeRoles(feature)) {
                const owner = extrusionOwners.get(value);
                check(owner === undefined, CODE.IDENTITY, 'complete sibling native role overlaps feature #' + owner + ': ' + value, { path: '$.features.options', featureId: feature.id });
                extrusionOwners.set(value, feature.id);
                original.add(value);
            }
        }
    }
    check(logical.every(value => !original.has(value)), CODE.IDENTITY, 'logical graph/parameter/node/output slots are separate from original/generated native entity roles', { path: '$.ids' });
    return new Set(logical);
}
function dependencyIds(feature) {
    return feature.kind === 'face-input' ? [] : feature.kind === 'coplanar-boolean' ? [feature.operandAFeatureId, feature.operandBFeatureId] : [feature.regionFeatureId];
}
function featureOrder(document) {
    const byId = new Map(document.features.map(f => [f.id, f])), pending = new Set(document.features.map(f => f.id)), done = new Set();
    for (const f of document.features)
        for (const ref of dependencyIds(f))
            check(byId.has(ref) && ref !== f.id, CODE.DEPENDENCY, 'every feature dependency must be an existing other node', { path: '$.features.dependencies', featureId: f.id });
    const order = [];
    while (pending.size) {
        const ready = document.features.find(f => pending.has(f.id) && dependencyIds(f).every(id => done.has(id)));
        check(ready !== undefined, CODE.DEPENDENCY, 'cyclic native feature dependencies', { path: '$.features.dependencies', featureId: document.features.find(f => pending.has(f.id)).id });
        order.push(ready);
        done.add(ready.id);
        pending.delete(ready.id);
    }
    const boolean = document.features.find(f => f.kind === 'coplanar-boolean');
    check(boolean.kind === 'coplanar-boolean', CODE.DEPENDENCY, 'actual sole Boolean node required');
    check(boolean.operandAFeatureId !== boolean.operandBFeatureId && byId.get(boolean.operandAFeatureId)?.kind === 'face-input'
        && byId.get(boolean.operandBFeatureId)?.kind === 'face-input', CODE.DEPENDENCY, 'Boolean must consume both distinct Face input nodes', { path: '$.features.operands', featureId: boolean.id });
    for (const extrusion of document.features)
        if (extrusion.kind === 'normal-extrusion')
            check(extrusion.regionFeatureId === boolean.id, CODE.DEPENDENCY, 'every extrusion must consume the same actual sole Boolean node', { path: '$.features.regionFeatureId', featureId: extrusion.id });
    return order;
}
function resolvedParameters(document) {
    let parameters;
    try {
        parameters = resolve(document.parameters, LABEL);
    }
    catch (cause) {
        const message = cause instanceof Error ? cause.message : '', match = /parameter #([A-Za-z_][A-Za-z0-9_-]*)/.exec(message) ?? /#([A-Za-z_][A-Za-z0-9_-]*)/.exec(message);
        throw new BooleanExtrusionFeatureGraphError(CODE.PARAMETER, 'actual original parameter dependency/length resolution refused', { path: '$.parameters', parameterId: match?.[1] ?? null, cause });
    }
    const values = new Map(parameters.map(p => [p.id, p.valueMM]));
    for (const p of document.parameters)
        if (p.definition.kind === 'offset')
            check(p.definition.offsetMM === 0 || values.get(p.id) !== values.get(p.definition.parameterId), CODE.REPRESENTABILITY, 'nonzero authored parameter offset disappeared into unchanged dependency value', { path: '$.parameters.definition', parameterId: p.id });
    return parameters;
}
function distanceDefinition(feature, parameters, path) {
    const context = { path, featureId: feature.id }, d = feature.distance, values = new Map(parameters.map(p => [p.id, p.valueMM]));
    if (d.kind === 'offset')
        check(values.has(d.parameterId), CODE.PARAMETER, 'distance must refer to an actual declared resolved parameter', { ...context, parameterId: d.parameterId });
    const base = d.kind === 'literal' ? d.valueMM : values.get(d.parameterId), value = d.kind === 'literal' ? base : base + d.offsetMM;
    const valueMM = helper(() => length(value, LABEL, context.path), CODE.PARAMETER, 'actual original distance length admission', context);
    if (d.kind === 'offset')
        check(d.offsetMM === 0 || valueMM !== base, CODE.REPRESENTABILITY, 'nonzero distance offset disappeared into unchanged dependency value', { ...context, parameterId: d.parameterId });
    check(valueMM >= 0.0001 && valueMM <= 10000, CODE.PARAMETER, 'resolved native distance0.0001..10000mm required', context);
    return { featureId: feature.id, definition: d, valueMM, dependencyIds: d.kind === 'offset' ? [d.parameterId] : [] };
}
function nativeBinding(document, row) {
    const ids = new Set(), add = (value) => { ids.add(value); };
    let sources;
    if (row.kind === 'face-input') {
        const r = row.evaluation;
        add(r.plane.id);
        add(r.loop.id);
        add(r.options.faceId);
        add(r.options.evaluationId);
        r.loop.edges.forEach(curve => add(curve.id));
        r.topology.vertices.forEach(vertex => add(vertex.id));
        r.topology.edges.forEach(edge => add(edge.id));
        add(r.topology.loop.id);
        r.topology.loop.uses.forEach(use => add(use.id));
        r.pcurves.forEach(pcurve => { add(pcurve.id); add(pcurve.curve.id); });
        sources = [{ assetId: r.model.name, sourceVersion: 0, objectIds: r.model.objects.map(object => object.id) }];
    }
    else if (row.kind === 'coplanar-boolean') {
        const r = row.evaluation;
        add(r.support.id);
        add(r.options.evaluationId);
        r.vertices.forEach(vertex => add(vertex.id));
        r.events.forEach(event => { add(event.id); add(event.vertexId); });
        r.fragments.forEach(fragment => { add(fragment.id); add(fragment.edgeId); add(fragment.useId); add(fragment.curve.id); add(fragment.pcurve.id); add(fragment.pcurve.curve.id); });
        r.loops.forEach(loop => { add(loop.id); loop.uses.forEach(use => add(use.id)); });
        r.components.forEach(component => add(component.id));
        sources = r.sources.map(source => ({ assetId: source.id, sourceVersion: 0, objectIds: source.model.objects.map(object => object.id) }));
    }
    else {
        const r = row.evaluation;
        add(r.options.evaluationId);
        r.vertices.forEach(vertex => add(vertex.id));
        r.edges.forEach(edge => { add(edge.id); add(edge.curve.id); });
        r.faces.forEach(face => { add(face.id); add(face.surface.id); face.loops.forEach(loop => { add(loop.id); loop.uses.forEach(use => { add(use.id); add(use.pcurve.id); add(use.pcurve.curve.id); }); }); });
        r.shells.forEach(shell => add(shell.id));
        sources = r.sources.map(source => ({ assetId: source.id, sourceVersion: 0, objectIds: source.model.objects.map(object => object.id) }));
    }
    sources.forEach(source => { add(source.assetId); source.objectIds.forEach(add); });
    return { graphId: document.id, revision: document.revision, featureId: row.featureId, outputSlotId: row.outputSlotId, kind: row.kind,
        nativeReferences: [...ids].map(nativeId => ({ graphId: document.id, revision: document.revision, featureId: row.featureId, outputSlotId: row.outputSlotId, nativeId })), sources };
}
/** A declared current snapshot evaluates two Faces, one shared Boolean and every authored-ready extrusion leaf. */
export function evaluateBooleanExtrusionFeatureGraph(documentInput, optionsInput) {
    const copied = record(snapshot({ document: documentInput, options: optionsInput }), ['document', 'options']);
    const document = admitDocument(copied.document), options = admitOptions(copied.options), logicalIds = admitIdentities(document);
    check(document.parameters.length <= options.maximumParameterResolutions && document.features.length <= options.maximumFeatureEvaluations, CODE.BUDGET, 'complete declared parameter and actual feature-count evaluation budgets required', { path: '$options' });
    const order = featureOrder(document), parameters = resolvedParameters(document);
    const extrusionFeatures = order.filter((feature) => feature.kind === 'normal-extrusion');
    let distanceDefinitionEvaluationCount = 0;
    const distances = extrusionFeatures.map(feature => {
        distanceDefinitionEvaluationCount++;
        return distanceDefinition(feature, parameters, '$.features[' + document.features.findIndex(value => value.id === feature.id) + '].distance');
    });
    const distanceByFeature = new Map(distances.map(distance => [distance.featureId, distance]));
    const features = [];
    const evaluated = new Map();
    const actualCalls = { faceInput: 0, coplanarBoolean: 0, normalExtrusion: 0 };
    for (const f of order) {
        const context = { path: '$.features[' + document.features.findIndex(value => value.id === f.id) + ']', featureId: f.id };
        const common = { featureId: f.id, outputSlotId: f.outputSlotId, order: features.length, dependencyIds: dependencyIds(f) };
        let row;
        if (f.kind === 'face-input') {
            actualCalls.faceInput++;
            row = { ...common, kind: f.kind, evaluation: helper(() => buildConvexPlanarFace(f.plane, f.loop, f.options), CODE.NATIVE, 'actual native Face builder refused', context) };
        }
        else if (f.kind === 'coplanar-boolean') {
            const a = evaluated.get(f.operandAFeatureId), b = evaluated.get(f.operandBFeatureId);
            check(a?.kind === 'face-input' && b?.kind === 'face-input', CODE.DEPENDENCY, 'actual evaluated Face operands required', context);
            actualCalls.coplanarBoolean++;
            row = { ...common, kind: f.kind, evaluation: helper(() => booleanCoplanarFaces(a.evaluation, b.evaluation, f.options), CODE.NATIVE, 'actual native Boolean builder refused', context) };
        }
        else {
            const region = evaluated.get(f.regionFeatureId);
            check(region?.kind === 'coplanar-boolean', CODE.DEPENDENCY, 'actual evaluated Boolean input required', context);
            const distance = distanceByFeature.get(f.id);
            check(distance !== undefined, CODE.PARAMETER, 'actual prestaged per-feature distance required', context);
            actualCalls.normalExtrusion++;
            row = { ...common, kind: f.kind, evaluation: helper(() => extrudeCoplanarFaceBoolean(region.evaluation, { ...f.options, distanceMM: distance.valueMM }), CODE.NATIVE, 'actual native extrusion builder refused', context) };
        }
        features.push(row);
        evaluated.set(f.id, row);
    }
    check(features.length === document.features.length && actualCalls.faceInput === 2 && actualCalls.coplanarBoolean === 1
        && actualCalls.normalExtrusion === extrusionFeatures.length && distanceDefinitionEvaluationCount === actualCalls.normalExtrusion, CODE.DEPENDENCY, 'actual complete evaluation requires two Face/one Boolean/one builder and distance per extrusion leaf', { path: '$.features' });
    const qualifiedBindings = features.map(row => nativeBinding(document, row));
    for (const binding of qualifiedBindings)
        check(binding.nativeReferences.every(ref => !logicalIds.has(ref.nativeId)), CODE.IDENTITY, 'actual native output IDs cannot alias logical graph/node/parameter/output slots', { path: '$.features.nativeReferences', featureId: binding.featureId });
    const boolean = features.find(f => f.kind === 'coplanar-boolean');
    check(boolean.kind === 'coplanar-boolean', CODE.DEPENDENCY, 'complete actual native shared region required');
    const extrusions = features.filter((feature) => feature.kind === 'normal-extrusion');
    const nativeBuilderCallCount = actualCalls.faceInput + actualCalls.coplanarBoolean + actualCalls.normalExtrusion;
    const report = {
        schema: 'barocss-native-boolean-extrusion-feature-graph-report', version: 0, graphId: document.id, revision: document.revision, lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
        authoredFeatureOrder: document.features.map(f => f.id), featureOrder: features.map(f => f.featureId), parameterOrder: parameters.map(p => p.id),
        parameterDependencies: document.parameters.flatMap(p => p.definition.kind === 'offset' ? [{ parameterId: p.id, dependsOn: p.definition.parameterId }] : []),
        featureDependencies: document.features.map(f => ({ featureId: f.id, dependencyIds: dependencyIds(f) })), parameterResolutionCount: parameters.length,
        distanceDefinitionEvaluationCount, featureEvaluationCount: features.length, nativeBuilderCallCount,
        nativeBuilderCalls: { faceInput: actualCalls.faceInput, coplanarBoolean: actualCalls.coplanarBoolean, normalExtrusion: actualCalls.normalExtrusion }, distances, qualifiedBindings,
        summary: { booleanFeatureId: boolean.featureId, empty: extrusions.every(extrusion => extrusion.evaluation.report.empty),
            componentCount: boolean.evaluation.components.length, holeCount: boolean.evaluation.report.holeCount, materialAreaUV: boolean.evaluation.report.areaUV,
            extrusions: extrusions.map(extrusion => ({ featureId: extrusion.featureId, outputSlotId: extrusion.outputSlotId, empty: extrusion.evaluation.report.empty,
                shellIds: extrusion.evaluation.shells.map(shell => shell.id), distanceMM: distanceByFeature.get(extrusion.featureId).valueMM })) }, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        quality: { geometryAuthority: 'actual-native-face-boolean-and-extrusion-builders', authoredOrderPreserved: true, parameterResolver: 'actual-original-circle-graph-first-authored-ready',
            allUnusedParametersResolved: true, logicalSlotsAreGeometryIds: false, originalNativeIdsRetainedPerFeatureContext: true,
            nativeReferenceScope: 'entities-defined-by-this-feature-not-transitive-operand-references', revisionBinding: 'declared-graph-revision-qualified-no-hidden-history',
            priorRevisionReferences: 'stale-after-declared-revision-advance-even-if-native-id-repeats', updateEvaluation: 'complete-prior-owned-rebuild-then-full-copied-candidate-chain',
            builderWork: 'two-face-one-boolean-and-per-leaf-extrusion-calls-excludes-native-internal-validation-compiler-primitive-work', nativeOutputsAreAuthoredEditingAuthority: false,
            selectiveRecomputationClaimed: false, globalHistoryCertified: false, wholeGraphCertified: false, manufacturingToleranceCertified: false, ownership: 'copied-cpu-data-gc-no-renderer-resources' },
        budgetFailure: 'atomic-refusal-prior-intent-results-and-files-retained', limits: { maximumParameters: 8, maximumFeatures: 7, maximumExtrusions: 4, authoredIdCharacters: 48, maximumRevision: 1000000000, lengthMM: 10000,
            authoredValues: 16384, authoredDepth: 12, authoredArrayElements: 64, authoredRecordFields: 16, authoredStringCharacters: 128, ownValues: 1048576, ownDepth: 40,
            arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144, maximumFileBytes: 1048576 },
    };
    return snapshot({ document, options, parameters, features, report }, true);
}
function rebuild(input) {
    const owned = record(snapshot(input, true, CODE.OWNED), ['document', 'options', 'parameters', 'features', 'report'], { path: '$owned' }, CODE.OWNED);
    let expected;
    try {
        expected = evaluateBooleanExtrusionFeatureGraph(owned.document, owned.options);
    }
    catch (cause) {
        const context = cause instanceof BooleanExtrusionFeatureGraphError ? { featureId: cause.featureId, parameterId: cause.parameterId } : {};
        throw new BooleanExtrusionFeatureGraphError(CODE.OWNED, 'complete owned authored/native graph reconstruction refused', { path: '$owned', ...context, cause });
    }
    check(same(owned, expected), CODE.OWNED, 'owned intent/options/parameter order/native source/geometry/qualified bindings/report mismatch', { path: '$owned' });
    return expected;
}
export function validateBooleanExtrusionFeatureGraph(input) {
    return snapshot(rebuild(input).report, true, CODE.OWNED);
}
/** One copied candidate is evaluated only after every stable-ID edit has been admitted. */
export function updateBooleanExtrusionFeatureGraph(previousInput, editsInput) {
    const previous = rebuild(previousInput), data = record(snapshot(editsInput, false, CODE.INPUT, '$edits'), ['expectedRevision', 'revision', 'parameterEdits', 'faceEdits', 'booleanEdits', 'distanceEdits'], { path: '$edits' });
    const expectedRevision = revision(data.expectedRevision, '$edits.expectedRevision'), nextRevision = revision(data.revision, '$edits.revision');
    check(expectedRevision === previous.document.revision && nextRevision === previous.document.revision + 1, CODE.REVISION, 'expected previous revision and exact previous+1 required', { path: '$edits.revision' });
    let total = 0;
    for (const [field, maximum] of [['parameterEdits', 8], ['faceEdits', 2], ['booleanEdits', 1], ['distanceEdits', 4]]) {
        const entries = data[field];
        check(Array.isArray(entries) && entries.length <= maximum, CODE.BUDGET, 'bounded explicit edit array required', { path: '$edits.' + field });
        total += entries.length;
    }
    check(total > 0, CODE.INPUT, 'nonempty explicit edit transaction required', { path: '$edits' });
    const candidate = copyCadData(previous.document);
    candidate.revision = nextRevision;
    for (const [index, input] of data.parameterEdits.entries()) {
        const path = '$edits.parameterEdits[' + index + ']', e = record(input, ['parameterId', 'definition'], { path }), parameterId = id(e.parameterId, { path });
        check(data.parameterEdits.filter(edit => edit.parameterId === parameterId).length === 1, CODE.INPUT, 'duplicate parameter edit target', { path, parameterId });
        const parameter = candidate.parameters.find(p => p.id === parameterId);
        check(parameter !== undefined, CODE.PARAMETER, 'existing parameter edit target required', { path, parameterId });
        parameter.definition = admitDefinition(e.definition, { path: path + '.definition', parameterId });
    }
    for (const [field, kind] of [['faceEdits', 'face-input'], ['booleanEdits', 'coplanar-boolean'], ['distanceEdits', 'normal-extrusion']]) {
        const targets = new Set();
        for (const [index, input] of data[field].entries()) {
            const path = '$edits.' + field + '[' + index + ']', fields = kind === 'face-input' ? ['featureId', 'plane', 'loop'] : kind === 'coplanar-boolean' ? ['featureId', 'operation'] : ['featureId', 'definition'];
            const e = record(input, fields, { path }), featureId = id(e.featureId, { path }), context = { path, featureId };
            check(!targets.has(featureId), CODE.INPUT, 'duplicate feature edit target', context);
            targets.add(featureId);
            const feature = candidate.features.find(f => f.id === featureId);
            check(feature !== undefined && feature.kind === kind, CODE.DEPENDENCY, 'existing feature of exact edit kind required', context);
            if (kind === 'face-input' && feature.kind === 'face-input') {
                const admitted = admitNativeFace({ id: feature.id, outputSlotId: feature.outputSlotId, plane: e.plane, loop: e.loop, options: feature.options }, context);
                check(admitted.plane.id === feature.plane.id && admitted.loop.id === feature.loop.id && admitted.loop.edges.length === feature.loop.edges.length
                    && admitted.loop.edges.every((curve, i) => curve.id === feature.loop.edges[i].id), CODE.IDENTITY, 'Face edits preserve complete plane/loop/ordered Curve IDs/count', context);
                feature.plane = admitted.plane;
                feature.loop = admitted.loop;
            }
            else if (kind === 'coplanar-boolean' && feature.kind === 'coplanar-boolean') {
                check(e.operation === 'union' || e.operation === 'intersection' || e.operation === 'difference', CODE.INPUT, 'native Boolean operation edit required', context);
                feature.options.operation = e.operation;
            }
            else if (feature.kind === 'normal-extrusion')
                feature.distance = admitDefinition(e.definition, { ...context, path: path + '.definition' });
        }
    }
    return evaluateBooleanExtrusionFeatureGraph(candidate, previous.options);
}
