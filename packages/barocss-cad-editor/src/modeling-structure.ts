import type { CadEditorModelingSummary } from './modeling-engine.js';

export type ModelingStructureTarget = { name: string; solidId: string; node: number };
export type ModelingStructureCommand =
  | { kind: 'add-arm'; target: ModelingStructureTarget; x: number; y: number; width: number; height: number }
  | { kind: 'union'; targets: [ModelingStructureTarget, ModelingStructureTarget] }
  | { kind: 'cut-slot'; target: ModelingStructureTarget; x: number; y: number; width: number; height: number };

const FILE_BYTES = 65536, HISTORY_BYTES = 8 * 1024 * 1024, LENGTH = 10000;
const ARM = ['armX', 'armY', 'armWidth', 'armHeight'] as const;
const SLOT = ['slotX', 'slotY', 'slotWidth', 'slotHeight'] as const;
type Data = Record<string, unknown>;
type Dimension = number | { parameter: string } | { op: 'add'; left: Dimension; right: Dimension }
  | { op: 'scale'; value: Dimension; factor: number };
type Ref = { node: number; side: 'solid' };
type Document = { format: 'barocss-cad-model'; schema: 1; units: 'mm'; parameters: Record<string, number>; nodes: Data[]; outputs: Record<string, Ref> };
function check(value: unknown, message: string): asserts value { if (!value) throw new Error('Model structure: ' + message); }
function record(value: unknown, fields?: readonly string[]): Data {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), 'plain own data record required.');
  check(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, 'plain own data prototype required.');
  const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
  check(keys.length <= 16 && keys.every(k => typeof k === 'string' && k.length <= 128
    && Object.hasOwn(descriptors[k], 'value') && descriptors[k].enumerable), 'bounded enumerable own data fields required; accessors and symbols are refused.');
  if (fields) check(keys.length === fields.length && fields.every(k => Object.hasOwn(descriptors, k)), 'exact fields required: ' + fields.join(', ') + '.');
  return value as Data;
}
function list(value: unknown, maximum: number): unknown[] {
  check(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype, 'ordinary own data array required.');
  const descriptors = Object.getOwnPropertyDescriptors(value), length = Object.getOwnPropertyDescriptor(value, 'length')!.value as number;
  check(length <= maximum && Reflect.ownKeys(value).length === length + 1
    && Array.from({ length }, (_, i) => descriptors[i]).every(d => d && Object.hasOwn(d, 'value') && d.enumerable), 'dense bounded own data array required.');
  return value;
}
/** Descriptor-first, acyclic and bounded. No getter, toJSON or native helper is used. */
function ownData(input: unknown): unknown {
  let remaining = 4096;
  const active = new Set<object>();
  const visit = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 12, 'authored value/depth budget exceeded.');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), 'finite numeric data required.'); return value; }
    if (typeof value === 'string') { check(value.length <= 128, 'authored string budget exceeded.'); return value; }
    check(typeof value === 'object' && !active.has(value), 'acyclic own data required.'); active.add(value);
    try {
      if (Array.isArray(value)) return list(value, 64).map(v => visit(v, depth + 1));
      return Object.fromEntries(Object.entries(record(value)).map(([k, v]) => [k, visit(v, depth + 1)]));
    } finally { active.delete(value); }
  };
  return visit(input, 0);
}
function signedJson(value: unknown): string {
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(signedJson).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(k => JSON.stringify(k) + ':' + signedJson((value as Data)[k])).join(',') + '}';
  return JSON.stringify(value);
}
/** Public save-compatible key order, newline and signed-zero representation. */
export function canonicalModelingText(value: unknown): string {
  const text = signedJson(ownData(value)) + '\n'; modelingSourceBytes(text); return text;
}
export function modelingSourceBytes(text: string): number {
  check(typeof text === 'string' && text.length <= FILE_BYTES, 'authored source exceeds 64 KiB characters or is not text.');
  const bytes = new TextEncoder().encode(text).length;
  check(bytes <= FILE_BYTES, 'authored source exceeds 64 KiB UTF-8 bytes.'); return bytes;
}
/** Charge each retained slot, even when identical strings may share storage. */
export function modelingSourceBudget(historyBytes: number[], acceptedBytes: number, candidateBytes: number[]): number {
  const history = list(historyBytes, 20), candidates = list(candidateBytes, 64);
  let total = 0;
  for (const bytes of [...history, acceptedBytes, ...candidates]) {
    check(typeof bytes === 'number' && Number.isSafeInteger(bytes) && bytes >= 0 && !Object.is(bytes, -0), 'source byte counts must be nonnegative safe integers.');
    total += bytes; check(Number.isSafeInteger(total) && total <= HISTORY_BYTES, 'retained authored sources exceed 8 MiB.');
  }
  return total;
}
function name(value: unknown): asserts value is string {
  check(typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(value)
    && !['__proto__', 'prototype', 'constructor'].includes(value), 'safe ASCII name of 1..48 characters required.');
}
function length(value: unknown): number {
  check(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= LENGTH, 'every dimension and intermediate must be finite within +/-10000 mm.');
  return value;
}
function resolveDimension(input: unknown, parameters: Record<string, number>): number {
  let count = 0;
  const visit = (value: unknown, depth: number): number => {
    check(++count <= 32 && depth <= 6, 'dimension exceeds 32 nodes or depth 6.');
    if (typeof value === 'number') return length(value);
    const d = record(value);
    if (Object.hasOwn(d, 'parameter')) {
      record(d, ['parameter']); name(d.parameter); check(Object.hasOwn(parameters, d.parameter), 'unknown parameter: ' + d.parameter + '.');
      return length(parameters[d.parameter]);
    }
    if (d.op === 'add') { record(d, ['op', 'left', 'right']); return length(visit(d.left, depth + 1) + visit(d.right, depth + 1)); }
    record(d, ['op', 'value', 'factor']); check(d.op === 'scale' && typeof d.factor === 'number' && Number.isFinite(d.factor), 'only add or finite numeric scale is supported.');
    return length(visit(d.value, depth + 1) * d.factor);
  };
  return visit(input, 1);
}
function document(text: string): Document {
  modelingSourceBytes(text);
  const d = record(ownData(JSON.parse(text)), ['format', 'schema', 'units', 'parameters', 'nodes', 'outputs']);
  check(d.format === 'barocss-cad-model' && d.schema === 1 && d.units === 'mm', 'a primary model schema1 in mm is required; legacy sources are unsupported.');
  for (const [key, value] of Object.entries(record(d.parameters))) { name(key); length(value); }
  const nodes = list(d.nodes, 8); check(nodes.length > 0, 'authored nodes required.'); nodes.forEach(n => record(n));
  const outputs = record(d.outputs); check(Object.keys(outputs).length > 0 && Object.keys(outputs).length <= 8, 'one to eight owned outputs required.');
  for (const [key, value] of Object.entries(outputs)) {
    name(key); const ref = record(value, ['node', 'side']);
    check(Number.isInteger(ref.node) && !Object.is(ref.node, -0) && (ref.node as number) >= 0 && (ref.node as number) < nodes.length
      && ['solid', 'negative', 'positive'].includes(ref.side as string), 'valid output reference required.');
  }
  return d as unknown as Document;
}
function ref(value: unknown, node: number): void {
  const r = record(value, ['node', 'side']); check(Object.is(r.node, node) && r.side === 'solid', 'exact owned solid reference required.');
}
function point(value: unknown, parameters: Record<string, number>): [number, number] {
  const values = list(value, 2); check(values.length === 2, 'two XY coordinates required.');
  return values.map(v => resolveDimension(v, parameters)) as [number, number];
}
function rectangle(d: Document, sketch: number, extrusion: number): number {
  const s = record(d.nodes[sketch], ['kind', 'profile', 'min', 'max']);
  const e = record(d.nodes[extrusion], ['kind', 'sketch', 'height']);
  check(s.kind === 'sketch' && s.profile === 'rectangle' && e.kind === 'extrude' && Object.is(e.sketch, sketch), 'direct rectangle/extrude pairs with omitted from are required.');
  const min = point(s.min, d.parameters), max = point(s.max, d.parameters), height = resolveDimension(e.height, d.parameters);
  check([...min, ...max, height].every(Number.isSafeInteger), 'safe-integer corners and thickness required.');
  const spans = [max[0] - min[0], max[1] - min[1], height];
  check(spans.every(v => Number.isSafeInteger(v) && v >= 1 && v <= LENGTH), 'positive integer spans and thickness from 1 to 10000 mm required.');
  return height;
}
function parameter(key: string): { parameter: string } { return { parameter: key }; }
function addedRectangle(names: readonly string[]): Data {
  const [x, y, width, height] = names;
  return { kind: 'sketch', profile: 'rectangle', min: [parameter(x), parameter(y)],
    max: [{ op: 'add', left: parameter(x), right: parameter(width) }, { op: 'add', left: parameter(y), right: parameter(height) }] };
}
function ownedGraph(d: Document): number {
  check([2, 4, 5, 8].includes(d.nodes.length), 'only complete 2, 4, 5 or 8-node construction stages are supported; no 6/7-node intermediate.');
  const height = rectangle(d, 0, 1);
  if (d.nodes.length >= 4) {
    rectangle(d, 2, 3);
    check(ARM.every(k => Object.hasOwn(d.parameters, k)) && signedJson(d.nodes[2]) === signedJson(addedRectangle(ARM))
      && signedJson(d.nodes[1].height) === signedJson(d.nodes[3].height), 'the authored arm must retain its four named drivers and exactly the shared thickness term.');
  }
  if (d.nodes.length >= 5) {
    const union = record(d.nodes[4], ['kind', 'left', 'right']); check(union.kind === 'union', 'the owned pair union is required.'); ref(union.left, 1); ref(union.right, 3);
  }
  if (d.nodes.length === 8) {
    check(height === 8, 'through-slot requires resolved thickness exactly 8 mm and Z=0..8.'); rectangle(d, 5, 6);
    check(SLOT.every(k => Object.hasOwn(d.parameters, k)) && signedJson(d.nodes[5]) === signedJson(addedRectangle(SLOT))
      && signedJson(d.nodes[1].height) === signedJson(d.nodes[6].height), 'the slot must retain its four named drivers and shared thickness term.');
    const cut = record(d.nodes[7], ['kind', 'parent', 'tool']); check(cut.kind === 'difference', 'complete union-slot difference required.'); ref(cut.parent, 4); ref(cut.tool, 6);
  }
  const outputs = Object.entries(d.outputs);
  if (d.nodes.length === 2) { check(outputs.length === 1, 'Add arm requires one sole owned output without aliases.'); ref(outputs[0][1], 1); }
  else if (d.nodes.length === 4) {
    check(outputs.length === 2 && Object.hasOwn(d.outputs, 'arm'), 'Union requires exactly the original output and arm without aliases.');
    ref(d.outputs.arm, 3); check(outputs.filter(([key]) => key !== 'arm').length === 1, 'distinct output names required.');
    ref(outputs.find(([key]) => key !== 'arm')![1], 1);
  } else { check(outputs.length === 1 && outputs[0][0] === 'part', 'Union/Cut requires the sole result named part, without aliases or extra outputs.'); ref(outputs[0][1], d.nodes.length - 1); }
  return height;
}
function dependencies(node: Data): number[] {
  return node.kind === 'sketch' ? [] : node.kind === 'extrude' ? [node.sketch as number]
    : node.kind === 'union' ? [(node.left as Ref).node, (node.right as Ref).node] : [(node.parent as Ref).node, (node.tool as Ref).node];
}
function accepted(d: Document, input: CadEditorModelingSummary): ModelingStructureTarget[] {
  const s = record(ownData(input));
  check(s.source === 'model' && typeof s.documentId === 'string' && s.documentId.length > 0
    && Number.isSafeInteger(s.revision) && (s.revision as number) >= 0 && !Object.is(s.revision, -0), 'current primary summary required.');
  check(signedJson(record(s.parameters)) === signedJson(d.parameters), 'accepted parameters must match the exact source.');
  if (Object.hasOwn(s, 'suppression')) check(Object.keys(record(s.suppression)).length === 0, 'suppressed finishing features are unsupported.');
  const features = list(s.features, 8); check(features.length === d.nodes.length, 'summary/source feature inventories differ.');
  features.forEach((value, index) => {
    const f = record(value, ['kind', 'index', 'dependencies']);
    check(f.kind === d.nodes[index].kind && Object.is(f.index, index) && signedJson(f.dependencies) === signedJson(dependencies(d.nodes[index])), 'summary/source feature ownership differs.');
  });
  const outputs = list(s.outputs, 8); check(outputs.length === Object.keys(d.outputs).length, 'summary/source output inventories differ.');
  const seen = new Set<string>(), native = new Set<string>();
  return outputs.map(value => {
    const output = record(value); name(output.name);
    check(Object.hasOwn(d.outputs, output.name) && !seen.has(output.name) && typeof output.solidId === 'string'
      && /^[A-Za-z_][A-Za-z0-9_-]{0,127}$/.test(output.solidId) && !native.has(output.solidId), 'distinct current output names and native IDs required.');
    seen.add(output.name); native.add(output.solidId);
    return { name: output.name, solidId: output.solidId, node: d.outputs[output.name].node };
  }).sort((a, b) => a.node - b.node);
}
function reserve(d: Document, names: readonly string[]): void {
  check(Object.keys(d.parameters).length + names.length <= 16, 'adding four drivers exceeds the 16-parameter limit.');
  check(names.every(k => !Object.hasOwn(d.parameters, k) && !Object.hasOwn(d.outputs, k)), 'reserved parameter name collision: ' + names.join(', ') + '.');
}
export function getModelingStructureCapabilities(text: string | null, summary: CadEditorModelingSummary | null): {
  addArm: ModelingStructureTarget | null; union: [ModelingStructureTarget, ModelingStructureTarget] | null;
  cutSlot: ModelingStructureTarget | null; reason: string; sharedThickness: number | null;
} {
  const none = { addArm: null, union: null, cutSlot: null, sharedThickness: null };
  try {
    check(text !== null && summary !== null, 'open an accepted primary rectangular part first.');
    const d = document(text), sharedThickness = ownedGraph(d), targets = accepted(d, summary);
    if (d.nodes.length === 2) {
      reserve(d, ARM); check(!Object.hasOwn(d.outputs, 'arm'), 'the reserved output name arm is already used.');
      return { ...none, addArm: targets[0], sharedThickness, reason: 'Add an arm using the existing thickness term; editing shared thickness changes both bodies.' };
    }
    if (d.nodes.length === 4) return { ...none, union: targets as [ModelingStructureTarget, ModelingStructureTarget], sharedThickness,
      reason: 'Union consumes both named outputs into part; authored operand features remain in history.' };
    if (d.nodes.length === 5) {
      check(sharedThickness === 8, 'Cut requires resolved thickness exactly 8 mm with omitted from (Z=0..8); shared thickness currently resolves to ' + sharedThickness + ' mm.');
      reserve(d, SLOT); return { ...none, cutSlot: targets[0], sharedThickness, reason: 'Cut creates one atomic through-slot across the existing 8 mm thickness; provider and receiver limits still apply.' };
    }
    return { ...none, sharedThickness, reason: 'The complete eight-node union-slot is already authored. Edit its existing dimensions.' };
  } catch (cause) { return { ...none, reason: cause instanceof Error ? cause.message : String(cause) }; }
}
function matchingTarget(input: unknown, expected: ModelingStructureTarget): void {
  const target = record(input, ['name', 'solidId', 'node']);
  check(target.name === expected.name && target.solidId === expected.solidId && Object.is(target.node, expected.node), 'selected output/native identity is stale or not owned by this command.');
}
/** Pure authored intent. cad.load/save and transport admission retain geometry authority. */
export function buildModelingStructure(text: string, summary: CadEditorModelingSummary, input: ModelingStructureCommand): {
  text: string; selectedOutput: string; consumed: string[]; kind: ModelingStructureCommand['kind'];
} {
  const command = record(ownData(input)), capabilities = getModelingStructureCapabilities(text, summary), d = document(text);
  const kind = command.kind;
  check(kind === 'add-arm' || kind === 'union' || kind === 'cut-slot', 'known structural command required.');
  if (kind === 'union') {
    record(command, ['kind', 'targets']); check(capabilities.union, capabilities.reason);
    const targets = list(command.targets, 2); check(targets.length === 2, 'select both current outputs.');
    const ordered = targets.map(t => record(t, ['name', 'solidId', 'node'])).sort((a, b) => (a.node as number) - (b.node as number));
    ordered.forEach((target, index) => matchingTarget(target, capabilities.union![index]));
    d.nodes.push({ kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
    d.outputs = { part: { node: 4, side: 'solid' } };
    return { text: canonicalModelingText(d), selectedOutput: 'part', consumed: capabilities.union.map(t => t.name), kind };
  }
  record(command, ['kind', 'target', 'x', 'y', 'width', 'height']);
  const target = kind === 'add-arm' ? capabilities.addArm : capabilities.cutSlot; check(target, capabilities.reason); matchingTarget(command.target, target);
  const values = [command.x, command.y, command.width, command.height].map(length);
  check(values.every(Number.isSafeInteger), 'safe-integer coordinates and dimensions required.');
  check(values[2] >= 1 && values[3] >= 1, 'width and profile height must be positive integer spans.');
  const [x, y, width, height] = values; length(x + width); length(y + height);
  check(Number.isSafeInteger(x + width) && Number.isSafeInteger(y + height), 'safe-integer upper corners required.');
  const names = kind === 'add-arm' ? ARM : SLOT; reserve(d, names);
  names.forEach((key, i) => { d.parameters[key] = values[i]; });
  const sketch = d.nodes.length;
  d.nodes.push(addedRectangle(names), { kind: 'extrude', sketch, height: d.nodes[1].height as Dimension });
  if (kind === 'add-arm') d.outputs.arm = { node: 3, side: 'solid' };
  else { d.nodes.push({ kind: 'difference', parent: { node: 4, side: 'solid' }, tool: { node: 6, side: 'solid' } }); d.outputs = { part: { node: 7, side: 'solid' } }; }
  ownedGraph(d);
  return { text: canonicalModelingText(d), selectedOutput: kind === 'add-arm' ? 'arm' : 'part', consumed: kind === 'add-arm' ? [] : [target.name], kind };
}
/** Fast-path identity only; native acceptance and exact reconstructed save remain required. */
export function sameModelingStructure(a: string, b: string): boolean {
  try {
    const identity = (text: string): string => {
      const d = document(text);
      d.parameters = Object.fromEntries(Object.keys(d.parameters).map(key => [key, 0]));
      for (const node of d.nodes) {
        check(['sketch', 'extrude', 'translate', 'cut', 'intersect', 'union', 'difference', 'split', 'chamfer', 'hole'].includes(node.kind as string), 'unknown authored feature.');
        if (Object.hasOwn(node, 'suppressed')) {
          record(node, ['kind', 'parent', 'edge', 'distance', 'name', 'suppressed']);
          check(node.kind === 'chamfer' && typeof node.suppressed === 'boolean', 'only named chamfer suppression can vary.'); name(node.name); node.suppressed = false;
        }
      }
      return signedJson(d);
    };
    return identity(a) === identity(b);
  } catch { return false; }
}
