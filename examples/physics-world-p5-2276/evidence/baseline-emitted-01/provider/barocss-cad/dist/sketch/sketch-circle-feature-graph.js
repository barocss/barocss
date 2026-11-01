import { check, guard, snapshot, record, identifier, definition, admitParameter, admitFeature, resolve, admitJSONText, authoredRoles, applyFeatureOperations, applyParameterOperations } from './circle-graph-internal.js';
import { evaluateXYArcSketchDocument, updateXYArcSketchDocument } from './xy-arc-sketch-document.js';
import { evaluateXYCirclePrismDocument } from '../planar-solids/xy-circle-prism-document.js';
import { curveDecimal } from '../nurbs/curves/curve-source.js';
import { copyCadData } from '../data-copy.js';
import { same as sameData } from '../core/structural-equality.js';
function context(input) {
    const ownId = (value) => { if (value === null || typeof value !== 'object')
        return '?'; const d = Object.getOwnPropertyDescriptor(value, 'id'); return d && 'value' in d && typeof d.value === 'string' && d.value.length <= 64 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(d.value) ? d.value : '?'; };
    return 'Sketch circle feature graph #' + ownId(input);
}
function admit(input, label) {
    const data = record(snapshot(input, label, '$'), ['format', 'version', 'id', 'lengthUnit', 'sketch', 'parameters', 'features'], label, '$');
    check(data.format === 'barocss-sketch-circle-feature-graph' && data.version === 0 && data.lengthUnit === 'mm', label, '$.format/version/lengthUnit', 'circle feature graph0/mm required');
    const id = identifier(data.id, label, '$.id');
    check(Array.isArray(data.parameters) && data.parameters.length >= 1 && data.parameters.length <= 8, label, '$.parameters', '1..8 fractional typed length parameters required');
    const parameters = data.parameters.map((value, index) => {
        return admitParameter(value, label, '$.parameters[' + index + ']');
    });
    check(Array.isArray(data.features) && data.features.length >= 1 && data.features.length <= 4, label, '$.features', '1..4 original circle extrusion features required');
    const features = data.features.map((value, index) => {
        return admitFeature(value, label, '$.features[' + index + ']');
    });
    return { format: 'barocss-sketch-circle-feature-graph', version: 0, id, lengthUnit: 'mm', sketch: data.sketch, parameters, features };
}
function evaluate(document, label, nativeIdentities) {
    const sketchEvaluation = guard(label + ': $.sketch', () => evaluateXYArcSketchDocument(document.sketch));
    document.sketch = sketchEvaluation.document;
    const authored = authoredRoles(document, label), parameters = resolve(document.parameters, label), values = new Map(parameters.map(p => [p.id, p.valueMM]));
    const nativeRoles = nativeIdentities ?? new Map();
    const features = document.features.map((f) => guard(label + ' feature #' + f.id + ': $.features', () => {
        const p = document.sketch.profiles.find(p => p.id === f.profileId), original = sketchEvaluation.profiles.find(p => p.profileId === f.profileId);
        check(p?.kind === 'circle' && !!original, label + ' feature #' + f.id, '$.features.profileId #' + f.profileId, 'existing original circle required; quarter profiles cannot drive extrusion');
        check(values.has(f.distanceParameterId), label + ' feature #' + f.id, '$.features.distanceParameterId #' + f.distanceParameterId, 'existing resolved height parameter required');
        const heightMM = values.get(f.distanceParameterId);
        check(heightMM >= .001 && heightMM <= 10000, label + ' feature #' + f.id, '$.features.distanceParameterId', 'resolved positive fractional height0.001..10000mm required');
        const projection = { format: 'barocss-xy-circle-prism-feature', version: 0, id: document.id, lengthUnit: 'mm',
            sketch: { ...copyCadData(document.sketch), profiles: [copyCadData(p)] },
            feature: { id: f.id, kind: 'xy-circle-extrude', profileId: f.profileId, shellId: f.shellId, height: { id: f.distanceParameterId, valueMM: heightMM } } };
        // Native599 admission also runs for suppressed features; no preview is called.
        const candidate = evaluateXYCirclePrismDocument(projection);
        check(sameData(original.evaluation, candidate.shell.profile), label + ' feature #' + f.id, '$.features.projection.profile', 'full original587 and actual599 projection source/Curve/domain/IDs must match');
        const bundle = candidate.shell.bundle;
        const add = (id, role) => {
            const owner = authored.get(id), previous = nativeRoles.get(id);
            check(owner === undefined || owner === role, label + ' feature #' + f.id, '$.features.generatedIds #' + id, 'generated native identity collides with unrelated authored slot');
            check(previous === undefined || previous === role, label + ' feature #' + f.id, '$.features.generatedIds #' + id, 'generated native identity collides across distinct features/entities');
            nativeRoles.set(id, role);
        };
        add(bundle.topology.id, 'shell:' + f.id);
        add(bundle.geometry.name, 'shell:' + f.id);
        for (const [i, object] of bundle.geometry.objects.entries())
            add(object.id, i === 0 ? 'source:' + p.id : 'generated:' + f.id + ':object:' + object.id);
        for (const vertex of bundle.topology.vertices)
            add(vertex.id, 'generated:' + f.id + ':vertex:' + vertex.id);
        for (const edge of bundle.topology.edges)
            add(edge.id, 'generated:' + f.id + ':edge:' + edge.id);
        for (const face of bundle.topology.faces)
            add(face.id, 'generated:' + f.id + ':face:' + face.id);
        for (const loop of bundle.topology.loops) {
            add(loop.id, 'generated:' + f.id + ':loop:' + loop.id);
            for (const use of loop.uses) {
                add(use.id, 'generated:' + f.id + ':use:' + use.id);
                add(use.pcurve.curve.id, 'generated:' + f.id + ':pcurve:' + use.pcurve.curve.id);
            }
        }
        add(candidate.shell.baseFace.bundle.geometry.name, 'generated:' + f.id + ':face:' + bundle.topology.faces[0].id);
        // Source0's fixed container name "profile" stays local to each original Model.
        // Actual599 still applies its own per-feature authored/name collision gate.
        const bindings = { kind: 'derived-one-circle-projection', graphDocumentId: document.id, graphSketchId: document.sketch.id, featureId: f.id,
            profileId: p.id, shellId: f.shellId, heightParameterId: f.distanceParameterId, heightMM, profileBindings: copyCadData(original.bindings),
            projectionBindings: copyCadData(candidate.report.bindings), projectionFormat: projection.format, geometryIds: copyCadData(candidate.shell.report.geometryIds),
            domains: copyCadData(candidate.shell.report.domains), faceIds: bundle.topology.faces.map(face => face.id) };
        return { featureId: f.id, profileId: f.profileId, shellId: f.shellId, distanceParameterId: f.distanceParameterId,
            status: f.suppressed ? 'suppressed' : 'active', evaluation: f.suppressed ? null : candidate, bindings };
    }));
    const report = { kind: 'sketch-circle-feature-graph-evaluation', formatVersion: 0, documentId: document.id,
        parameterOrder: parameters.map(p => p.id), parameterDependencies: document.parameters.flatMap(p => p.definition.kind === 'offset' ? [{ parameterId: p.id, dependsOn: p.definition.parameterId }] : []),
        featureDependencies: document.features.map(f => ({ featureId: f.id, profileId: f.profileId, distanceParameterId: f.distanceParameterId })),
        featureStatus: features.map(f => ({ featureId: f.featureId, shellId: f.shellId, status: f.status, native: f.evaluation?.shell.report ?? null })),
        activeShellIds: features.filter(f => f.status === 'active').map(f => f.shellId), wholeGraphCertified: false, candidateClosedShell: true,
        periodic: false, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        limits: { maximumParameters: 8, maximumFeatures: 4, authoredIdCharacters: 64, profileShellIdCharacters: 48, snapshotValues: 8192, snapshotDepth: 10, arrayElements: 64, recordFields: 12, stringCharacters: 128, maximumJSONBytes: 131072 } };
    return copyCadData({ document, sketchEvaluation, parameters, features, report });
}
export function evaluateSketchCircleFeatureGraph(document) {
    const label = context(document);
    return guard(label, () => evaluate(admit(document, label), label));
}
// Internal bridge for lifecycle ID reservation; not exported by the package index.
export function evaluateCircleGraphWithIdentities(document, identities) {
    const label = context(document);
    return guard(label, () => evaluate(admit(document, label), label, identities));
}
function applyInputEdits(candidate, data, label) {
    if (Object.hasOwn(data, 'parameterEdits')) {
        const targets = new Set();
        for (const [index, input] of data.parameterEdits.entries()) {
            const path = '$edits.parameterEdits[' + index + ']', e = record(input, ['parameterId', 'definition'], label, path), id = identifier(e.parameterId, label, path + '.parameterId');
            check(!targets.has(id), label + ' parameter #' + id, path, 'repeated parameter edit target');
            targets.add(id);
            const p = candidate.parameters.find(p => p.id === id);
            check(!!p, label + ' parameter #' + id, path, 'existing parameter required');
            p.definition = definition(e.definition, label + ' parameter #' + id, path + '.definition');
        }
    }
    if (Object.hasOwn(data, 'sketchEdits') && data.sketchEdits.length)
        candidate.sketch = updateXYArcSketchDocument(candidate.sketch, data.sketchEdits).document;
}
export function updateSketchCircleFeatureGraph(document, edits) {
    const label = context(document);
    return guard(label, () => {
        const candidate = admit(document, label), value = snapshot(edits, label, '$edits');
        check(value !== null && typeof value === 'object' && !Array.isArray(value), label, '$edits', 'edit record required');
        const data = value, keys = Object.keys(data);
        check(keys.length >= 1 && keys.length <= 3 && keys.every(key => ['parameterEdits', 'sketchEdits', 'featureEdits'].includes(key)), label, '$edits', 'exact optional parameter/sketch/feature arrays required');
        let count = 0;
        for (const key of keys) {
            check(Array.isArray(data[key]) && data[key].length <= (key === 'featureEdits' ? 4 : 8), label, '$edits.' + key, 'bounded edit array required');
            count += data[key].length;
        }
        check(count > 0, label, '$edits', 'at least one actual edit required');
        applyInputEdits(candidate, data, label);
        if (Object.hasOwn(data, 'featureEdits')) {
            const targets = new Set();
            for (const [index, input] of data.featureEdits.entries()) {
                const path = '$edits.featureEdits[' + index + ']', e = record(input, ['featureId', 'suppressed'], label, path), id = identifier(e.featureId, label, path + '.featureId');
                check(!targets.has(id), label + ' feature #' + id, path, 'repeated feature edit target');
                targets.add(id);
                const f = candidate.features.find(f => f.id === id);
                check(!!f && typeof e.suppressed === 'boolean', label + ' feature #' + id, path, 'existing feature and boolean suppression required');
                f.suppressed = e.suppressed;
            }
        }
        return evaluate(admit(candidate, label), label);
    });
}
function reserveSketchIdentities(candidate, startingAuthored, reserved, label) {
    for (const [id, role] of authoredRoles(candidate, label)) {
        if (!['source:', 'center:', 'radius:', 'seam:', 'endpoint:'].some(prefix => role.startsWith(prefix)))
            continue;
        const originalRole = startingAuthored.get(id);
        check(originalRole === role || originalRole === undefined && !reserved.has(id), label, '$edits.sketchEdits.ids #' + id, 'new sketch identity cannot recycle starting/removed authored or selectable native identity or new feature/shell identity');
        reserved.add(id);
    }
}
export function editSketchCircleFeatureGraphFeatures(document, edits) {
    const label = context(document);
    return guard(label, () => {
        const selectableNative = new Map();
        // Suppressed candidates contribute actual native IDs too. Source0's fixed
        // per-Model container name is intentionally absent from this global pool.
        const candidate = evaluate(admit(document, label), label, selectableNative).document;
        const startingAuthored = authoredRoles(candidate, label), startingFeatures = new Map(candidate.features.map(f => [f.id, copyCadData(f)]));
        const reserved = new Set([...startingAuthored.keys(), ...selectableNative.keys()]);
        const value = snapshot(edits, label, '$edits');
        check(value !== null && typeof value === 'object' && !Array.isArray(value), label, '$edits', 'feature lifecycle edit record required');
        const data = value, keys = Object.keys(data);
        check(Object.hasOwn(data, 'featureOperations') && keys.length <= 3 && keys.every(key => ['featureOperations', 'parameterEdits', 'sketchEdits'].includes(key)), label, '$edits', 'required featureOperations and optional parameterEdits/sketchEdits only');
        check(Array.isArray(data.featureOperations) && data.featureOperations.length >= 1 && data.featureOperations.length <= 8, label, '$edits.featureOperations', 'ordered1..8 feature operations required');
        for (const key of ['parameterEdits', 'sketchEdits'])
            if (Object.hasOwn(data, key))
                check(Array.isArray(data[key]) && data[key].length <= 8, label, '$edits.' + key, 'optional0..8 existing input edits required');
        applyFeatureOperations(candidate, data.featureOperations, startingFeatures, reserved, label);
        applyInputEdits(candidate, data, label);
        reserveSketchIdentities(candidate, startingAuthored, reserved, label);
        // Only the complete final candidate owns1..4 count and reference admission.
        return evaluate(admit(candidate, label), label);
    });
}
export function editSketchCircleFeatureGraphParameters(document, edits) {
    const label = context(document);
    return guard(label, () => {
        const selectableNative = new Map();
        const candidate = evaluate(admit(document, label), label, selectableNative).document;
        const startingAuthored = authoredRoles(candidate, label), reserved = new Set([...startingAuthored.keys(), ...selectableNative.keys()]);
        const startingParameters = new Map(candidate.parameters.map(p => [p.id, copyCadData(p)]));
        const startingFeatures = new Map(candidate.features.map(f => [f.id, copyCadData(f)]));
        const value = snapshot(edits, label, '$edits');
        check(value !== null && typeof value === 'object' && !Array.isArray(value), label, '$edits', 'parameter lifecycle edit record required');
        const data = value, keys = Object.keys(data);
        check(Object.hasOwn(data, 'parameterOperations') && keys.length <= 3 && keys.every(key => ['parameterOperations', 'featureOperations', 'sketchEdits'].includes(key)), label, '$edits', 'required parameterOperations and optional featureOperations/sketchEdits only');
        for (const key of keys)
            check(Array.isArray(data[key]) && data[key].length >= 1 && data[key].length <= (key === 'parameterOperations' ? 16 : 8), label, '$edits.' + key, key === 'parameterOperations' ? 'ordered1..16 parameter operations required' : 'optional present1..8 operations required');
        applyParameterOperations(candidate, data.parameterOperations, startingParameters, reserved, label);
        if (Object.hasOwn(data, 'featureOperations'))
            applyFeatureOperations(candidate, data.featureOperations, startingFeatures, reserved, label);
        applyInputEdits(candidate, data, label);
        reserveSketchIdentities(candidate, startingAuthored, reserved, label);
        // Count, references, forward dependencies and native validity belong to the
        // complete final candidate, after every explicit repair has been applied.
        return evaluate(admit(candidate, label), label);
    });
}
export function serializeSketchCircleFeatureGraph(document) {
    const label = context(document);
    return guard(label, () => {
        const accepted = evaluate(admit(document, label), label).document;
        const encode = (value) => typeof value === 'number' ? curveDecimal(value, label) : typeof value === 'string' || typeof value === 'boolean' ? JSON.stringify(value) : Array.isArray(value) ? '[' + value.map(encode).join(',') + ']' : '{' + Object.entries(value).map(([key, field]) => JSON.stringify(key) + ':' + encode(field)).join(',') + '}';
        const text = encode(accepted) + '\n';
        check(text.length <= 131072, label, '$serialization', 'intent JSON exceeds128KiB');
        return text;
    });
}
/** Admission scan only; JSON.parse remains the JSON syntax/value parser. */
export function parseSketchCircleFeatureGraph(text) {
    const label = 'Sketch circle feature graph parse';
    return guard(label, () => {
        check(typeof text === 'string' && text.length <= 131072, label, '$text', 'JSON text within128KiB UTF-8 required');
        let bytes = 0;
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i), next = text.charCodeAt(i + 1);
            if (code < 128)
                bytes++;
            else if (code < 2048)
                bytes += 2;
            else if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
                bytes += 4;
                i++;
            }
            else
                bytes += 3;
            check(bytes <= 131072, label, '$text', 'JSON exceeds128KiB UTF-8');
        }
        admitJSONText(text, label);
        const data = JSON.parse(text);
        return evaluateSketchCircleFeatureGraph(data).document;
    });
}
