import { check, guard, snapshot, record, identifier, length, definition, admitParameter, admitFeature, resolve, admitJSONText, authoredRoles, applyFeatureOperations, applyParameterOperations } from './circle-graph-internal.js';
import { evaluateSketchCircleFeatureGraph, evaluateCircleGraphWithIdentities } from './sketch-circle-feature-graph.js';
import { evaluateXYCirclePrismDocument } from './xy-circle-prism-document.js';
import type { SketchCircleLengthParameter, SketchCircleGraphFeature, SketchCircleResolvedParameter, SketchCircleFeatureGraphV0, SketchCircleFeatureGraphResult, SketchCircleFeatureGraphReport, SketchCircleFeatureGraphEdits, SketchCircleFeatureBindings, SketchCircleParameterOperation, SketchCircleFeatureOperation } from './sketch-circle-feature-graph.js';
import type { XYArcSketchProfileIntent, XYArcSketchBindings } from './xy-arc-sketch-document.js';
import type { XYPoint } from './xy-profile.js';
import { copyCadData } from './data-copy.js';
import { curveDecimal } from './nurbs/curves/curve-source.js';

export type DrivenCircleRadiusDefinition = { kind: 'literal'; valueMM: number } | { kind: 'parameter'; parameterId: string };
export type DrivenXYArcProfileIntent = Omit<Extract<XYArcSketchProfileIntent, { kind: 'circle' }>, 'radius'> & { radius: { id: string; definition: DrivenCircleRadiusDefinition } }
  | Omit<Extract<XYArcSketchProfileIntent, { kind: 'quarter-arc' }>, 'radius'> & { radius: { id: string; definition: Extract<DrivenCircleRadiusDefinition, { kind: 'literal' }> } };
export interface DrivenXYArcSketchDocumentV0 {
  format: 'barocss-driven-xy-arc-sketch'; version: 0; id: string; lengthUnit: 'mm'; workplane: 'xy'; profiles: DrivenXYArcProfileIntent[];
}
export interface DrivenSketchCircleFeatureGraphV1 {
  format: 'barocss-driven-sketch-circle-feature-graph'; version: 1; id: string; lengthUnit: 'mm';
  sketch: DrivenXYArcSketchDocumentV0; parameters: SketchCircleLengthParameter[]; features: SketchCircleGraphFeature[];
}
export interface DrivenSketchCircleFeatureGraphEdits {
  parameterEdits?: SketchCircleFeatureGraphEdits['parameterEdits'];
  circleEdits?: { profileId: string; centerMM?: XYPoint; radiusDefinition?: DrivenCircleRadiusDefinition }[];
  featureEdits?: SketchCircleFeatureGraphEdits['featureEdits'];
}
export interface DrivenSketchCircleParameterLifecycleEdits {
  parameterOperations: SketchCircleParameterOperation[];
  featureOperations?: SketchCircleFeatureOperation[];
  circleEdits?: DrivenSketchCircleFeatureGraphEdits['circleEdits'];
}
export type DrivenSketchCircleProfileOperation = { kind: 'upsert'; profile: DrivenXYArcProfileIntent } | { kind: 'remove'; profileId: string };
export interface DrivenSketchCircleProfileLifecycleEdits {
  profileOperations: DrivenSketchCircleProfileOperation[];
  parameterOperations?: SketchCircleParameterOperation[];
  featureOperations?: SketchCircleFeatureOperation[];
}
export interface DrivenCircleProfileDimension {
  profileId: string; radiusId: string; definition: DrivenCircleRadiusDefinition; parameterId: string | null; resolvedRadiusMM: number; dependencyIds: string[];
}
export interface DrivenCircleRadiusBindings extends DrivenCircleProfileDimension {
  kind: 'resolved-radius-projection';
  authoredGraph: { id: string; format: DrivenSketchCircleFeatureGraphV1['format']; version: 1 };
  authoredSketch: { id: string; format: DrivenXYArcSketchDocumentV0['format']; version: 0 };
  projection: { graphId: string; graphFormat: SketchCircleFeatureGraphV0['format']; graphVersion: 0; sketchId: string; sketchFormat: 'barocss-xy-arc-sketch'; sketchVersion: 0; profileId: string; curveId: string };
  profileBindings: XYArcSketchBindings; featureBindings: SketchCircleFeatureBindings[];
  nativeFeatures: { featureId: string; shellId: string; faceIds: string[]; edgeIds: string[]; loopIds: string[]; useIds: string[]; pcurveIds: string[] }[];
}
export interface DrivenSketchCircleFeatureGraphReport {
  kind: 'driven-sketch-circle-feature-graph-evaluation'; formatVersion: 1; documentId: string;
  parameterOrder: string[]; radiusDependencies: { profileId: string; radiusId: string; parameterId: string }[];
  bindings: DrivenCircleRadiusBindings[]; native: SketchCircleFeatureGraphReport;
  wholeGraphCertified: false; candidateClosedShell: true; periodic: false; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: SketchCircleFeatureGraphReport['limits'];
}
export interface DrivenSketchCircleFeatureGraphResult {
  document: DrivenSketchCircleFeatureGraphV1; parameters: SketchCircleResolvedParameter[]; profileDimensions: DrivenCircleProfileDimension[];
  projection: SketchCircleFeatureGraphV0; nativeGraph: SketchCircleFeatureGraphResult; report: DrivenSketchCircleFeatureGraphReport;
}
function context(input: unknown): string {
  const descriptor = input !== null && typeof input === 'object' ? Object.getOwnPropertyDescriptor(input, 'id') : undefined;
  const id = descriptor && 'value' in descriptor && typeof descriptor.value === 'string' && descriptor.value.length <= 64 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(descriptor.value) ? descriptor.value : '?';
  return 'Driven circle feature graph #' + id;
}
function center(input: unknown, label: string, path: string): XYPoint {
  check(Array.isArray(input) && input.length === 2, label, path, 'literal XY centre required');
  return [length(input[0], label, path + '[0]'), length(input[1], label, path + '[1]')];
}
function radiusDefinition(input: unknown, label: string, path: string): DrivenCircleRadiusDefinition {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), label, path, 'radius definition record required');
  const kind = (input as Record<string, unknown>).kind;
  check(kind === 'literal' || kind === 'parameter', label, path + '.kind', 'one literal or parameter radius authority required');
  const data = record(input, kind === 'literal' ? ['kind', 'valueMM'] : ['kind', 'parameterId'], label, path);
  return kind === 'literal' ? { kind, valueMM: length(data.valueMM, label, path + '.valueMM') } : { kind, parameterId: identifier(data.parameterId, label, path + '.parameterId') };
}
function admitProfile(input: unknown, label: string, path: string): DrivenXYArcProfileIntent {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), label, path, 'profile record required');
  const kind = (input as Record<string, unknown>).kind;
  check(kind === 'circle' || kind === 'quarter-arc', label, path + '.kind', 'original circle/quarter-arc required');
  const p = record(input, kind === 'circle' ? ['id', 'kind', 'centerId', 'centerMM', 'radius', 'seamId'] : ['id', 'kind', 'centerId', 'centerMM', 'radius', 'quadrant', 'endpointIds'], label, path);
  const radius = record(p.radius, ['id', 'definition'], label, path + '.radius');
  const common = { id: identifier(p.id, label, path + '.id'), centerId: identifier(p.centerId, label, path + '.centerId'), centerMM: center(p.centerMM, label, path + '.centerMM') };
  const r = { id: identifier(radius.id, label, path + '.radius.id'), definition: radiusDefinition(radius.definition, label, path + '.radius.definition') };
  if (kind === 'circle') return { ...common, kind, radius: r, seamId: identifier(p.seamId, label, path + '.seamId') };
  check(r.definition.kind === 'literal', label, path + '.radius.definition', 'parameter-driven quarters unsupported');
  check(typeof p.quadrant === 'number' && Number.isInteger(p.quadrant) && p.quadrant >= 0 && p.quadrant <= 3, label, path + '.quadrant', 'original quadrant0..3 required');
  check(Array.isArray(p.endpointIds) && p.endpointIds.length === 2, label, path + '.endpointIds', 'two original endpoint IDs required');
  return { ...common, kind, radius: { id: r.id, definition: r.definition }, quadrant: p.quadrant as 0 | 1 | 2 | 3, endpointIds: [identifier(p.endpointIds[0], label, path + '.endpointIds[0]'), identifier(p.endpointIds[1], label, path + '.endpointIds[1]')] };
}
function admit(input: unknown, label: string): DrivenSketchCircleFeatureGraphV1 {
  const data = record(snapshot(input, label, '$'), ['format', 'version', 'id', 'lengthUnit', 'sketch', 'parameters', 'features'], label, '$');
  check(data.format === 'barocss-driven-sketch-circle-feature-graph' && data.version === 1 && data.lengthUnit === 'mm', label, '$.format/version/lengthUnit', 'distinct driven circle graph1/mm required');
  const id = identifier(data.id, label, '$.id'), sketch = record(data.sketch, ['format', 'version', 'id', 'lengthUnit', 'workplane', 'profiles'], label, '$.sketch');
  check(sketch.format === 'barocss-driven-xy-arc-sketch' && sketch.version === 0 && sketch.lengthUnit === 'mm' && sketch.workplane === 'xy', label, '$.sketch.format/version/lengthUnit/workplane', 'driven original arc sketch0/mm/xy required');
  check(Array.isArray(sketch.profiles) && sketch.profiles.length <= 8, label, '$.sketch.profiles', '0..8 original profiles required');
  const profiles = sketch.profiles.map((input, index) => admitProfile(input, label, '$.sketch.profiles[' + index + ']'));
  check(Array.isArray(data.parameters) && data.parameters.length >= 1 && data.parameters.length <= 8, label, '$.parameters', '1..8 original fractional length parameters required');
  check(Array.isArray(data.features) && data.features.length >= 1 && data.features.length <= 4, label, '$.features', '1..4 original circle extrusion features required');
  return { format: 'barocss-driven-sketch-circle-feature-graph', version: 1, id, lengthUnit: 'mm',
    sketch: { format: 'barocss-driven-xy-arc-sketch', version: 0, id: identifier(sketch.id, label, '$.sketch.id'), lengthUnit: 'mm', workplane: 'xy', profiles },
    parameters: data.parameters.map((p, i) => admitParameter(p, label, '$.parameters[' + i + ']')),
    features: data.features.map((f, i) => admitFeature(f, label, '$.features[' + i + ']')) };
}
function evaluate(document: DrivenSketchCircleFeatureGraphV1, label: string, nativeIdentities?: Map<string, string>): DrivenSketchCircleFeatureGraphResult {
  const resolved = resolve(document.parameters, label), values = new Map(resolved.map(p => [p.id, p.valueMM]));
  const profileDimensions = document.sketch.profiles.map((p): DrivenCircleProfileDimension => {
    const d = p.radius.definition, parameterId = d.kind === 'parameter' ? d.parameterId : null;
    if (parameterId !== null) check(values.has(parameterId), label + ' profile #' + p.id, '$.sketch.radius.parameterId #' + parameterId, 'existing length parameter required');
    const resolvedRadiusMM = d.kind === 'literal' ? d.valueMM : values.get(d.parameterId)!;
    check(resolvedRadiusMM >= 0.001 && resolvedRadiusMM <= 10000, label + ' profile #' + p.id, '$.sketch.radius', 'resolved radius0.001..10000mm required for every profile');
    return { profileId: p.id, radiusId: p.radius.id, definition: d, parameterId, resolvedRadiusMM, dependencyIds: parameterId === null ? [] : [parameterId] };
  });
  const projection: SketchCircleFeatureGraphV0 = {
    format: 'barocss-sketch-circle-feature-graph', version: 0, id: document.id, lengthUnit: 'mm',
    sketch: { format: 'barocss-xy-arc-sketch', version: 0, id: document.sketch.id, lengthUnit: 'mm', workplane: 'xy', profiles: document.sketch.profiles.map((p, i) => ({ ...p, radius: { id: p.radius.id, valueMM: profileDimensions[i].resolvedRadiusMM } })) },
    parameters: document.parameters, features: document.features,
  };
  // Original601 admission owns global identities and actual587/599/595 geometry.
  const nativeGraph = nativeIdentities ? evaluateCircleGraphWithIdentities(projection, nativeIdentities) : evaluateSketchCircleFeatureGraph(projection);
  const nativeFeatures = nativeGraph.features.map(f => {
    //601 intentionally omits suppressed evaluation. Obtain its selectable IDs
    //from the same actual599 projection, never from a naming approximation.
    const shell = (f.evaluation ?? evaluateXYCirclePrismDocument({
      format: 'barocss-xy-circle-prism-feature', version: 0, id: projection.id, lengthUnit: 'mm',
      sketch: { ...projection.sketch, profiles: [projection.sketch.profiles.find(p => p.id === f.profileId)!] },
      feature: { id: f.featureId, kind: 'xy-circle-extrude', profileId: f.profileId, shellId: f.shellId,
        height: { id: f.distanceParameterId, valueMM: f.bindings.heightMM } },
    })).shell.bundle.topology;
    return { profileId: f.profileId, featureId: f.featureId, shellId: f.shellId, faceIds: shell.faces.map(x => x.id),
      edgeIds: shell.edges.map(x => x.id), loopIds: shell.loops.map(x => x.id),
      useIds: shell.loops.flatMap(x => x.uses.map(u => u.id)), pcurveIds: shell.loops.flatMap(x => x.uses.map(u => u.pcurve.curve.id)) };
  });
  const bindings: DrivenCircleRadiusBindings[] = profileDimensions.map(d => ({ ...d, kind: 'resolved-radius-projection',
    authoredGraph: { id: document.id, format: document.format, version: document.version }, authoredSketch: { id: document.sketch.id, format: document.sketch.format, version: document.sketch.version },
    projection: { graphId: projection.id, graphFormat: projection.format, graphVersion: projection.version, sketchId: projection.sketch.id, sketchFormat: projection.sketch.format, sketchVersion: projection.sketch.version, profileId: d.profileId, curveId: d.profileId },
    profileBindings: nativeGraph.sketchEvaluation.profiles.find(p => p.profileId === d.profileId)!.bindings,
    featureBindings: nativeGraph.features.filter(f => f.profileId === d.profileId).map(f => f.bindings),
    nativeFeatures: nativeFeatures.filter(f => f.profileId === d.profileId).map(({ profileId: _profileId, ...f }) => f),
  }));
  return copyCadData({ document, parameters: nativeGraph.parameters, profileDimensions, projection: nativeGraph.document, nativeGraph,
    report: { kind: 'driven-sketch-circle-feature-graph-evaluation', formatVersion: 1, documentId: document.id,
      parameterOrder: nativeGraph.report.parameterOrder, radiusDependencies: profileDimensions.filter(d => d.parameterId !== null).map(d => ({ profileId: d.profileId, radiusId: d.radiusId, parameterId: d.parameterId! })),
      bindings, native: nativeGraph.report, wholeGraphCertified: false, candidateClosedShell: true, periodic: false,
      geometricValidity: 'not-certified', topologyCertified: false, solid: false, limits: nativeGraph.report.limits } });
}
export function evaluateDrivenSketchCircleFeatureGraph(document: DrivenSketchCircleFeatureGraphV1): DrivenSketchCircleFeatureGraphResult {
  const label = context(document); return guard(label, () => evaluate(admit(document, label), label));
}
function applyCircleEdits(candidate: DrivenSketchCircleFeatureGraphV1, operations: unknown[], label: string): void {
  const circleTargets = new Set<string>();
  for (const [i, input] of operations.entries()) {
    const path = '$edits.circleEdits[' + i + ']';
    check(input !== null && typeof input === 'object' && !Array.isArray(input), label, path, 'circle edit record required');
    const e = input as Record<string, unknown>, fields = Object.keys(e);
    check(Object.hasOwn(e, 'profileId') && fields.length >= 2 && fields.length <= 3 && fields.every(k => ['profileId', 'centerMM', 'radiusDefinition'].includes(k)), label, path, 'existing profileId and centre/radius definition only');
    const id = identifier(e.profileId, label, path + '.profileId'); check(!circleTargets.has(id), label, path, 'duplicate circle target #' + id); circleTargets.add(id);
    const p = candidate.sketch.profiles.find(p => p.id === id); check(p?.kind === 'circle', label, path, 'existing original circle required #' + id);
    if (Object.hasOwn(e, 'centerMM')) p.centerMM = center(e.centerMM, label, path + '.centerMM');
    if (Object.hasOwn(e, 'radiusDefinition')) p.radius.definition = radiusDefinition(e.radiusDefinition, label, path + '.radiusDefinition');
  }
}
export function updateDrivenSketchCircleFeatureGraph(document: DrivenSketchCircleFeatureGraphV1, edits: DrivenSketchCircleFeatureGraphEdits): DrivenSketchCircleFeatureGraphResult {
  const label = context(document);
  return guard(label, () => {
    const candidate = admit(document, label), value = snapshot(edits, label, '$edits');
    check(value !== null && typeof value === 'object' && !Array.isArray(value), label, '$edits', 'edit record required');
    const data = value as Record<string, unknown>, keys = Object.keys(data);
    check(keys.length >= 1 && keys.length <= 3 && keys.every(k => ['parameterEdits', 'circleEdits', 'featureEdits'].includes(k)), label, '$edits', 'parameterEdits/circleEdits/featureEdits only');
    let count = 0;
    for (const key of keys) { check(Array.isArray(data[key]) && (data[key] as unknown[]).length <= (key === 'featureEdits' ? 4 : 8), label, '$edits.' + key, 'bounded edit array required'); count += (data[key] as unknown[]).length; }
    check(count > 0, label, '$edits', 'at least one actual edit required');
    const parameterTargets = new Set<string>(), featureTargets = new Set<string>();
    for (const [i, input] of ((data.parameterEdits ?? []) as unknown[]).entries()) {
      const path = '$edits.parameterEdits[' + i + ']', e = record(input, ['parameterId', 'definition'], label, path), id = identifier(e.parameterId, label, path + '.parameterId');
      check(!parameterTargets.has(id), label, path, 'duplicate parameter target #' + id); parameterTargets.add(id);
      const p = candidate.parameters.find(p => p.id === id); check(!!p, label, path, 'existing parameter required #' + id); p.definition = definition(e.definition, label, path + '.definition');
    }
    applyCircleEdits(candidate, (data.circleEdits ?? []) as unknown[], label);
    for (const [i, input] of ((data.featureEdits ?? []) as unknown[]).entries()) {
      const path = '$edits.featureEdits[' + i + ']', e = record(input, ['featureId', 'suppressed'], label, path), id = identifier(e.featureId, label, path + '.featureId');
      check(!featureTargets.has(id), label, path, 'duplicate feature target #' + id); featureTargets.add(id);
      check(typeof e.suppressed === 'boolean', label, path, 'boolean suppression required'); const f = candidate.features.find(f => f.id === id); check(!!f, label, path, 'existing feature required #' + id); f.suppressed = e.suppressed;
    }
    return evaluate(admit(candidate, label), label);
  });
}
function finishLifecycle(candidate: DrivenSketchCircleFeatureGraphV1, startingAuthored: Map<string, string>, selectableNative: Map<string, string>, label: string): DrivenSketchCircleFeatureGraphResult {
  const finalNative = new Map<string, string>(), result = evaluate(admit(candidate, label), label, finalNative);
  // A fresh shell's generated descendants must not recycle a removed authored
  // or generated ID under a different entity role either. Stable original
  // descendants and intentional source/shell aliases retain their roles.
  for (const [id, role] of [...authoredRoles(result.projection, label), ...finalNative]) {
    const originalAuthored = startingAuthored.get(id), originalNative = selectableNative.get(id);
    check((originalAuthored === undefined || originalAuthored === role) && (originalNative === undefined || originalNative === role), label, '$edits.generatedIds #' + id, 'final identity cannot recycle a starting authored/selectable native identity under another role');
  }
  return result;
}
export function editDrivenSketchCircleFeatureGraphParameters(document: DrivenSketchCircleFeatureGraphV1, edits: DrivenSketchCircleParameterLifecycleEdits): DrivenSketchCircleFeatureGraphResult {
  const label = context(document);
  return guard(label, () => {
    // Admit the original accepted graph once to reserve actual generated IDs,
    // including suppressed candidates. No partially edited graph is evaluated.
    const selectableNative = new Map<string, string>();
    const original = evaluate(admit(document, label), label, selectableNative), candidate = original.document;
    const startingAuthored = authoredRoles(original.projection, label), reserved = new Set([...startingAuthored.keys(), ...selectableNative.keys()]);
    const startingParameters = new Map(candidate.parameters.map(p => [p.id, copyCadData(p)]));
    const startingFeatures = new Map(candidate.features.map(f => [f.id, copyCadData(f)]));
    const value = snapshot(edits, label, '$edits');
    check(value !== null && typeof value === 'object' && !Array.isArray(value), label, '$edits', 'driven parameter lifecycle record required');
    const data = value as Record<string, unknown>, keys = Object.keys(data);
    check(Object.hasOwn(data, 'parameterOperations') && keys.length <= 3 && keys.every(k => ['parameterOperations', 'featureOperations', 'circleEdits'].includes(k)), label, '$edits', 'required parameterOperations and optional featureOperations/circleEdits only');
    for (const key of keys) check(Array.isArray(data[key]) && (data[key] as unknown[]).length >= 1 && (data[key] as unknown[]).length <= (key === 'parameterOperations' ? 16 : 8), label, '$edits.' + key, key === 'parameterOperations' ? 'ordered1..16 parameter operations required' : 'optional present1..8 operations required');
    applyParameterOperations(candidate, data.parameterOperations as unknown[], startingParameters, reserved, label);
    if (Object.hasOwn(data, 'featureOperations')) applyFeatureOperations(candidate, data.featureOperations as unknown[], startingFeatures, reserved, label);
    if (Object.hasOwn(data, 'circleEdits')) applyCircleEdits(candidate, data.circleEdits as unknown[], label);
    // Full final radius/offset/height references and count admission only now.
    return finishLifecycle(candidate, startingAuthored, selectableNative, label);
  });
}
export function editDrivenSketchCircleFeatureGraphProfiles(document: DrivenSketchCircleFeatureGraphV1, edits: DrivenSketchCircleProfileLifecycleEdits): DrivenSketchCircleFeatureGraphResult {
  const label = context(document);
  return guard(label, () => {
    const selectableNative = new Map<string, string>();
    const original = evaluate(admit(document, label), label, selectableNative), candidate = original.document;
    const startingAuthored = authoredRoles(original.projection, label), reserved = new Set([...startingAuthored.keys(), ...selectableNative.keys()]);
    const startingParameters = new Map(candidate.parameters.map(p => [p.id, copyCadData(p)]));
    const startingFeatures = new Map(candidate.features.map(f => [f.id, copyCadData(f)]));
    const startingProfiles = new Map(candidate.sketch.profiles.map(p => [p.id, copyCadData(p)])), targets = new Set<string>();
    const value = snapshot(edits, label, '$edits');
    check(value !== null && typeof value === 'object' && !Array.isArray(value), label, '$edits', 'driven profile lifecycle record required');
    const data = value as Record<string, unknown>, keys = Object.keys(data);
    check(Object.hasOwn(data, 'profileOperations') && keys.length <= 3 && keys.every(k => ['profileOperations', 'parameterOperations', 'featureOperations'].includes(k)), label, '$edits', 'required profileOperations and optional parameterOperations/featureOperations only');
    for (const key of keys) check(Array.isArray(data[key]) && (data[key] as unknown[]).length >= 1 && (data[key] as unknown[]).length <= (key === 'featureOperations' ? 8 : 16), label, '$edits.' + key, key === 'featureOperations' ? 'optional present1..8 operations required' : 'ordered present1..16 operations required');
    if (Object.hasOwn(data, 'parameterOperations')) applyParameterOperations(candidate, data.parameterOperations as unknown[], startingParameters, reserved, label);
    if (Object.hasOwn(data, 'featureOperations')) applyFeatureOperations(candidate, data.featureOperations as unknown[], startingFeatures, reserved, label);
    for (const [i, input] of (data.profileOperations as unknown[]).entries()) {
      const path = '$edits.profileOperations[' + i + ']';
      check(input !== null && typeof input === 'object' && !Array.isArray(input), label, path, 'profile operation record required');
      const kind = (input as Record<string, unknown>).kind;
      check(kind === 'upsert' || kind === 'remove', label, path + '.kind', 'upsert/remove profile operation required');
      const operation = record(input, kind === 'upsert' ? ['kind', 'profile'] : ['kind', 'profileId'], label, path);
      const next = kind === 'upsert' ? admitProfile(operation.profile, label, path + '.profile') : undefined;
      const id = next ? next.id : identifier(operation.profileId, label, path + '.profileId'), owner = label + ' profile #' + id;
      check(!targets.has(id), owner, path, 'target profile appears more than once in transaction'); targets.add(id);
      const previous = startingProfiles.get(id), slot = candidate.sketch.profiles.findIndex(p => p.id === id);
      if (next) {
        if (previous) {
          check(previous.kind === next.kind && previous.centerId === next.centerId && previous.radius.id === next.radius.id && slot >= 0, owner, path + '.profile', 'existing profile kind/centre/radius identities and slot must remain');
          if (previous.kind === 'circle' && next.kind === 'circle') check(previous.seamId === next.seamId, owner, path + '.profile.seamId', 'existing circle seam identity must remain');
          else if (previous.kind === 'quarter-arc' && next.kind === 'quarter-arc') check(previous.quadrant === next.quadrant && previous.endpointIds.every((id, j) => id === next.endpointIds[j]), owner, path + '.profile.quadrant/endpointIds', 'existing quarter orientation and endpoint identities/order must remain');
          candidate.sketch.profiles[slot] = next;
        } else {
          const ids = [next.id, next.centerId, next.radius.id, ...(next.kind === 'circle' ? [next.seamId] : next.endpointIds)];
          check(new Set(ids).size === ids.length && ids.every(id => !reserved.has(id)), owner, path + '.profile.ids', 'new profile identities must be distinct and fresh relative to starting/new authored/selectable native IDs');
          check(candidate.sketch.profiles.length < 16, owner, path, 'bounded working profile array cannot exceed16');
          ids.forEach(id => reserved.add(id)); candidate.sketch.profiles.push(next);
        }
      } else {
        check(!!previous && slot >= 0, owner, path + '.profileId', 'remove must resolve a starting profile'); candidate.sketch.profiles.splice(slot, 1);
      }
    }
    // No partial profile count/radius/native evaluation: every explicit repair
    // and fresh forward reference now belongs to the complete final candidate.
    return finishLifecycle(candidate, startingAuthored, selectableNative, label);
  });
}
export function serializeDrivenSketchCircleFeatureGraph(document: DrivenSketchCircleFeatureGraphV1): string {
  const label = context(document);
  return guard(label, () => {
    const accepted = evaluate(admit(document, label), label).document;
    const encode = (value: unknown): string => typeof value === 'number' ? curveDecimal(value, label) : typeof value === 'string' || typeof value === 'boolean' ? JSON.stringify(value) : Array.isArray(value) ? '[' + value.map(encode).join(',') + ']' : '{' + Object.entries(value as Record<string, unknown>).map(([key, field]) => JSON.stringify(key) + ':' + encode(field)).join(',') + '}';
    const text = encode(accepted) + '\n'; check(text.length <= 131072, label, '$serialization', 'intent JSON exceeds128KiB'); return text;
  });
}
export function parseDrivenSketchCircleFeatureGraph(text: string): DrivenSketchCircleFeatureGraphV1 {
  const label = 'Driven circle feature graph parse';
  return guard(label, () => {
    check(typeof text === 'string' && text.length <= 131072, label, '$text', 'JSON text within128KiB UTF-8 required'); let bytes = 0;
    for (let i = 0; i < text.length; i++) { const code = text.charCodeAt(i), next = text.charCodeAt(i + 1); if (code < 128) bytes++; else if (code < 2048) bytes += 2; else if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { bytes += 4; i++; } else bytes += 3; check(bytes <= 131072, label, '$text', 'JSON exceeds128KiB UTF-8'); }
    admitJSONText(text, label); return evaluateDrivenSketchCircleFeatureGraph(JSON.parse(text)).document;
  });
}
