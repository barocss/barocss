// Host-only projection of accepted construction data into the existing CSS grammar.
const identifier = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const limit = 262144;
function record(value, allowed, required = allowed) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError('Expected a plain data record');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string' || !allowed.includes(key) || (!Object.hasOwn(descriptors[key], 'value') || !descriptors[key].enumerable)) throw new TypeError('Unsupported field or accessor');
  }
  for (const key of required) if (!Object.hasOwn(descriptors, key)) throw new TypeError('Missing field ' + key);
  return Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]));
}
function array(value, maximum = 70) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) throw new TypeError('Expected a plain data array');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length = descriptors.length.value;
  if (length > maximum) throw new RangeError('Array limit exceeded');
  for (const key of Reflect.ownKeys(descriptors)) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length || (!Object.hasOwn(descriptors[key], 'value') || !descriptors[key].enumerable)) throw new TypeError('Unsupported array field or accessor');
  }
  return Array.from({ length }, (_, index) => {
    if (!Object.hasOwn(descriptors, index)) throw new TypeError('Sparse arrays are unsupported');
    return descriptors[index].value;
  });
}
function finite(value) { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected a finite number'); return value; }
function id(value) { if (typeof value !== 'string' || !identifier.test(value)) throw new TypeError('Unsupported identifier'); return value; }
function point(value) { const values = array(value, 3); if (values.length !== 3) throw new TypeError('Expected three coordinates'); return values.map(finite); }
function numbers(value, maximum) { return array(value, maximum).map(finite); }
function span(value, sourceLength) {
  const result = record(value, ['start', 'end', 'line', 'column']);
  for (const key of Object.keys(result)) if (!Number.isSafeInteger(result[key])) throw new TypeError('Invalid source span');
  if (result.start < 0 || result.end <= result.start || result.end > sourceLength || result.line < 1 || result.column < 1) throw new RangeError('Invalid source span');
  return result;
}
function feature(value, sourceLength) {
  const result = record(value, ['outputId', 'inputId', 'operation', 'vector', 'span', 'referenceSpan']);
  if (result.operation !== 'extrude') throw new TypeError('Unsupported construction operation');
  result.outputId = id(result.outputId); result.inputId = id(result.inputId); result.vector = point(result.vector);
  result.span = span(result.span, sourceLength); result.referenceSpan = span(result.referenceSpan, sourceLength);
  if (result.referenceSpan.start < result.span.start || result.referenceSpan.end > result.span.end) throw new RangeError('Foreign reference span');
  return result;
}
function same(a, b) {
  if (typeof a === 'number' || typeof b === 'number') return Object.is(a, b);
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return a === b;
  const keys = Object.keys(a); return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
}
function acceptedData(accepted) {
  const root = record(accepted, ['source', 'sourceVersion', 'model', 'packet', 'report', 'options', 'iges', 'revision', 'viewRevision', 'constructions', 'selectedConstruction'], ['source', 'sourceVersion', 'model', 'packet', 'constructions', 'selectedConstruction']);
  if (root.sourceVersion !== 1 || typeof root.source !== 'string' || new TextEncoder().encode(root.source).length > limit) throw new TypeError('An accepted construction-v1 source is required');
  const model = record(root.model, ['name', 'version', 'lengthUnit', 'objects']);
  id(model.name); if (model.version !== 0 || model.lengthUnit !== 'mm') throw new TypeError('Unsupported native model');
  const objects = array(model.objects, 16);
  if (!objects.length) throw new TypeError('No accepted declarations');
  const byId = new Map();
  model.objects = objects.map(value => {
    const common = record(value, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights', 'degreeU', 'degreeV', 'knotsU', 'knotsV'], ['kind', 'id']);
    const fields = common.kind === 'curve' ? ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights'] : common.kind === 'surface' ? ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights'] : [];
    const object = record(value, fields); id(object.id);
    if (byId.has(object.id)) throw new TypeError('Duplicate native ID');
    if (object.kind === 'curve') {
      object.degree = finite(object.degree); object.knots = numbers(object.knots, 70);
      object.controlPoints = array(object.controlPoints, 16).map(point); object.weights = numbers(object.weights, 16);
      if (!object.controlPoints.length || object.controlPoints.length !== object.weights.length) throw new TypeError('Unrepresentable curve');
    } else {
      object.degreeU = finite(object.degreeU); object.degreeV = finite(object.degreeV);
      object.knotsU = numbers(object.knotsU, 70); object.knotsV = numbers(object.knotsV, 70);
      object.controlPoints = array(object.controlPoints, 16).map(row => array(row, 2).map(point));
      object.weights = array(object.weights, 16).map(row => numbers(row, 2));
    }
    byId.set(object.id, object); return object;
  });
  const constructions = array(root.constructions, 16).map(value => feature(value, root.source.length));
  const outputs = new Map(); let previous = -1;
  for (const construction of constructions) {
    if (outputs.has(construction.outputId) || construction.span.start <= previous) throw new TypeError('Duplicate or unordered construction provenance');
    previous = construction.span.start;
    const curve = byId.get(construction.inputId), surface = byId.get(construction.outputId);
    if (!curve || curve.kind !== 'curve' || !surface || surface.kind !== 'surface') throw new TypeError('Foreign construction provenance');
    const expected = { kind: 'surface', id: surface.id, degreeU: curve.degree, degreeV: 1,
      knotsU: curve.knots, knotsV: [0, 0, 1, 1],
      controlPoints: curve.controlPoints.map(p => [p, p.map((v, axis) => v + construction.vector[axis])]), weights: curve.weights.map(w => [w, w]) };
    if (!same(surface, expected)) throw new TypeError('Native surface differs from its construction');
    outputs.set(construction.outputId, construction);
  }
  const orderedOutputs = model.objects.filter(o => o.kind === 'surface').map(o => o.id);
  if (!same(orderedOutputs, constructions.map(f => f.outputId))) throw new TypeError('Missing or unordered surface provenance');
  const selected = feature(root.selectedConstruction, root.source.length);
  const packetDescriptors = Object.getOwnPropertyDescriptors(root.packet ?? {});
  const surfaceDescriptor = packetDescriptors.surfaceId;
  if (!surfaceDescriptor || !Object.hasOwn(surfaceDescriptor, 'value')) throw new TypeError('Displayed surface ID is required');
  if (surfaceDescriptor.value !== selected.outputId || !same(selected, outputs.get(selected.outputId))) throw new TypeError('Selected construction differs from the displayed surface');
  return { model, constructions, selected, curve: byId.get(selected.inputId) };
}
function requestData(request, count) {
  const data = record(request, ['vector', 'weight'], []);
  if (Object.hasOwn(data, 'vector')) data.vector = point(data.vector);
  if (Object.hasOwn(data, 'weight')) {
    data.weight = record(data.weight, ['index', 'value']);
    if (!Number.isSafeInteger(data.weight.index) || data.weight.index < 0 || data.weight.index >= count) throw new RangeError('Invalid weight index');
    finite(data.weight.value);
    if (data.weight.value < 1e-6 || data.weight.value > 1e6) throw new RangeError('Weight must be within [1e-6, 1e6]');
  }
  return data;
}
// ECMAScript's shortest decimal is a binary64 roundtrip. Expand only its exponent.
export function decimal(value) {
  finite(value); if (Object.is(value, -0)) return '-0';
  const text = String(value); const at = text.indexOf('e'); if (at === -1) return text;
  const sign = text.startsWith('-') ? '-' : '';
  const mantissa = text.slice(sign.length, at), exponent = Number(text.slice(at + 1));
  const dot = mantissa.indexOf('.'), digits = mantissa.replace('.', '');
  const position = (dot === -1 ? mantissa.length : dot) + exponent;
  if (position <= 0) return sign + '0.' + '0'.repeat(-position) + digits;
  if (position >= digits.length) return sign + digits + '0'.repeat(position - digits.length);
  return sign + digits.slice(0, position) + '.' + digits.slice(position);
}
function literal(value) { return Array.isArray(value) ? '[' + value.map(literal).join(', ') + ']' : decimal(value); }
export function parameterState(accepted) {
  if (accepted === undefined) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(accepted);
  const version = descriptors.sourceVersion;
  if (version && !Object.hasOwn(version, 'value')) throw new TypeError('Unsupported source version accessor');
  if (!version || version.value === 0) return undefined;
  const selection = descriptors.selectedConstruction;
  if (selection && !Object.hasOwn(selection, 'value')) throw new TypeError('Unsupported construction accessor');
  if (!selection || selection.value === undefined) return undefined;
  const { selected, curve, constructions } = acceptedData(accepted);
  return { surfaceId: selected.outputId, inputId: selected.inputId, vector: [...selected.vector], weights: [...curve.weights],
    indexCount: curve.weights.length, sharedOutputs: constructions.filter(f => f.inputId === curve.id).map(f => f.outputId) };
}
export function canonicalConstruction(accepted, request = {}) {
  const { model, constructions, selected, curve } = acceptedData(accepted);
  const edits = requestData(request, curve.weights.length);
  const features = new Map(constructions.map(f => [f.outputId, f]));
  const declarations = model.objects.map(object => {
    if (object.kind === 'curve') {
      const weights = [...object.weights];
      if (object.id === curve.id && edits.weight) weights[edits.weight.index] = edits.weight.value;
      return `  @curve #${object.id} {\n    type: nurbs;\n    degree: ${decimal(object.degree)};\n    knots: ${literal(object.knots)};\n    control-points: ${literal(object.controlPoints)};\n    weights: ${literal(weights)};\n  }`;
    }
    const f = features.get(object.id), vector = f.outputId === selected.outputId && edits.vector ? edits.vector : f.vector;
    return `  @extrude #${object.id} {\n    curve: #${f.inputId};\n    vector: ${literal(vector)};\n  }`;
  });
  const source = `@model ${model.name} {\n  version: 1;\n  length-unit: mm;\n${declarations.join('\n')}\n}\n`;
  if (new TextEncoder().encode(source).length > limit) throw new RangeError('Canonical construction exceeds 256 KiB');
  return source;
}
