import type { CadEditorModelingSummary } from './modeling-engine.js';

export type ModelingStructureTarget = { name: string; solidId: string; node: number };
export type ModelingStructureCommand =
  | { kind: 'add-arm'; target: ModelingStructureTarget; x: number; y: number; width: number; height: number }
  | { kind: 'add-hole'; target: ModelingStructureTarget; x: number; y: number; radius: number }
  | { kind: 'cut-pocket'; target: ModelingStructureTarget; wall: number; floor: number }
  | { kind: 'chamfer'; target: ModelingStructureTarget; distance: number }
  | ({ kind: 'rotate-part'; target: ModelingStructureTarget } & CardinalRotation)
  | { kind: 'move-part'; target: ModelingStructureTarget; x: number; y: number; z: number }
  | { kind: 'linear-pattern'; target: ModelingStructureTarget; spacing: number }
  | { kind: 'union'; targets: [ModelingStructureTarget, ModelingStructureTarget] }
  | { kind: 'cut-slot'; target: ModelingStructureTarget; x: number; y: number; width: number; height: number };

const FILE_BYTES = 65536, HISTORY_BYTES = 8 * 1024 * 1024, LENGTH = 10000;
const ARM = ['armX', 'armY', 'armWidth', 'armHeight'] as const;
const SLOT = ['slotX', 'slotY', 'slotWidth', 'slotHeight'] as const;
const HOLE = ['holeCenterX', 'holeCenterY', 'holeRadius'] as const;
const POCKET = ['pocketWall', 'pocketFloor'] as const;
const CHAMFER = ['bevelDistance'] as const;
const OPPOSITE_CHAMFER = ['backBevelDistance'] as const;
const PLACEMENT = ['placementX', 'placementY', 'placementZ'] as const;
const PATTERN = ['patternSpacing'] as const;
const PATTERN_COPIES = ['railCopy1', 'railCopy2'] as const;
type CardinalRotation = { axis: 'x' | 'y' | 'z'; angleDegrees: 90 | 180 | 270 | -90 | -180 | -270 };
type XYZ = [number, number, number];
/** Accepted authored coordinates only: neither native bounds nor certified geometry. */
type AuthoredRailPlacement = { rotation: CardinalRotation | null; offset: XYZ; envelope: { min: XYZ; max: XYZ } };
type Data = Record<string, unknown>;
type Dimension = number | { parameter: string } | { op: 'add'; left: Dimension; right: Dimension }
  | { op: 'scale'; value: Dimension; factor: number };
type Ref = { node: number; side: 'solid' };
type OutputRef = Ref | { node: number; side: 'instance1' | 'instance2' };
type Document = { format: 'barocss-cad-model'; schema: 1; units: 'mm'; parameters: Record<string, number>; nodes: Data[]; outputs: Record<string, OutputRef> };
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
function resolveDimension(input: unknown, parameters: Record<string, number>, sourceOnly = false): number {
  let count = 0;
  const visit = (value: unknown, depth: number): number => {
    check(++count <= 32 && depth <= 6, 'dimension exceeds 32 nodes or depth 6.');
    if (typeof value === 'number') return sourceOnly ? 0 : length(value);
    const d = record(value);
    if (Object.hasOwn(d, 'parameter')) {
      record(d, ['parameter']); name(d.parameter); check(Object.hasOwn(parameters, d.parameter), 'unknown parameter: ' + d.parameter + '.');
      return sourceOnly ? 0 : length(parameters[d.parameter]);
    }
    if (d.op === 'add') { record(d, ['op', 'left', 'right']); return length(visit(d.left, depth + 1) + visit(d.right, depth + 1)); }
    record(d, ['op', 'value', 'factor']); check(d.op === 'scale' && typeof d.factor === 'number' && Number.isFinite(d.factor), 'only add or finite numeric scale is supported.');
    return length(visit(d.value, depth + 1) * d.factor);
  };
  return visit(input, 1);
}
function document(text: string, boundedParameters = true): Document {
  modelingSourceBytes(text);
  const d = record(ownData(JSON.parse(text)), ['format', 'schema', 'units', 'parameters', 'nodes', 'outputs']);
  check(d.format === 'barocss-cad-model' && d.schema === 1 && d.units === 'mm', 'a primary model schema1 in mm is required; legacy sources are unsupported.');
  for (const [key, value] of Object.entries(record(d.parameters))) { name(key); if (boundedParameters) length(value); }
  const nodes = list(d.nodes, 8); check(nodes.length > 0, 'authored nodes required.'); nodes.forEach(n => record(n));
  const outputs = record(d.outputs); check(Object.keys(outputs).length > 0 && Object.keys(outputs).length <= 8, 'one to eight owned outputs required.');
  for (const [key, value] of Object.entries(outputs)) {
    name(key); const ref = record(value, ['node', 'side']);
    check(Number.isInteger(ref.node) && !Object.is(ref.node, -0) && (ref.node as number) >= 0 && (ref.node as number) < nodes.length
      && ['solid', 'negative', 'positive', 'instance1', 'instance2'].includes(ref.side as string), 'valid output reference required.');
  }
  // Instance references belong only to the complete owned pattern. Validate its
  // source identity without imposing current dimension feasibility on history.
  if (nodes.some(node => (node as Data).kind === 'linear-pattern')
    || Object.values(outputs).some(value => ['instance1', 'instance2'].includes((value as Data).side as string)))
    linearPatternGraph(d as unknown as Document, true);
  return d as unknown as Document;
}
function ref(value: unknown, node: number): void {
  const r = record(value, ['node', 'side']); check(Object.is(r.node, node) && r.side === 'solid', 'exact owned solid reference required.');
}
function point(value: unknown, parameters: Record<string, number>, sourceOnly = false): [number, number] {
  const values = list(value, 2); check(values.length === 2, 'two XY coordinates required.');
  return values.map(v => resolveDimension(v, parameters, sourceOnly)) as [number, number];
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
/** Decimal admission belongs only to these bounded rectangular-edge chamfers. */
function chamferPlate(d: Document): [number, number] {
  check(d.nodes.length === 2, 'Chamfer requires one unmodified rectangular part; a second chamfer or other ancestry is unsupported.');
  const s = record(d.nodes[0], ['kind', 'profile', 'min', 'max']);
  const e = record(d.nodes[1], ['kind', 'sketch', 'height']);
  check(s.kind === 'sketch' && s.profile === 'rectangle' && e.kind === 'extrude' && Object.is(e.sketch, 0),
    'Chamfer requires the direct rectangle/extrude pair with omitted from.');
  const min = point(s.min, d.parameters), max = point(s.max, d.parameters), height = resolveDimension(e.height, d.parameters);
  check(min.every(value => value === 0), 'Chamfer requires an origin-zero rectangular part.');
  check([...max, height].every(value => value > 0 && value <= LENGTH), 'Chamfer requires positive finite rectangular spans and thickness up to 10000 mm.');
  check(Object.keys(d.outputs).length === 1 && Object.hasOwn(d.outputs, 'part'), 'Chamfer requires the sole owned output named part.');
  ref(d.outputs.part, 1); return [max[1], height];
}
function chamferDistance(d: Document, input: unknown): number {
  const distance = length(input), [spanY, thickness] = chamferPlate(d);
  check(distance > 0 && distance < spanY && distance < thickness,
    'Bevel distance must be positive and strictly below both the rectangular Y span and extrusion thickness.');
  return distance;
}
/** Only the exact first-bevel authoring graph can own the opposite top edge. */
function oppositeChamferPlate(d: Document): [number, number, number] {
  check(d.nodes.length === 3, 'Opposite chamfer requires the exact three-node front-bevel part; a third bevel is unsupported.');
  check(Object.keys(d.outputs).length === 1 && Object.hasOwn(d.outputs, 'part'), 'Opposite chamfer requires the sole owned output named part.');
  ref(d.outputs.part, 2);
  check(Object.hasOwn(d.parameters, CHAMFER[0]) && signedJson(d.nodes[2]) === signedJson({
    kind: 'chamfer', parent: { node: 1, side: 'solid' },
    edge: { parallelTo: 'x', at: { y: 0, z: 'max' } }, distance: parameter(CHAMFER[0]),
  }), 'Opposite chamfer requires the exact front bevel with its own bevelDistance driver and X-parallel Y=0, Z=max selector.');
  const plate = { ...d, nodes: d.nodes.slice(0, 2), outputs: { part: { node: 1, side: 'solid' as const } } };
  const [spanY, thickness] = chamferPlate(plate), front = chamferDistance(plate, d.parameters[CHAMFER[0]]);
  return [spanY, thickness, front];
}
function oppositeChamferDistance(d: Document, input: unknown): number {
  const distance = length(input), [spanY, thickness, front] = oppositeChamferPlate(d);
  check(distance > 0 && distance < thickness && front + distance < spanY,
    'Opposite bevel distance must be positive and strictly below thickness; front plus back must be strictly below the rectangular Y span.');
  return distance;
}
function cardinalRotation(axis: unknown, angleDegrees: unknown): CardinalRotation {
  check(axis === 'x' || axis === 'y' || axis === 'z', 'Rotate part requires a cardinal x, y or z axis about the world origin.');
  check(typeof angleDegrees === 'number' && [90, 180, 270, -90, -180, -270].includes(angleDegrees),
    'Rotate part requires exactly +/-90, +/-180 or +/-270 degrees about the world origin.');
  return { axis, angleDegrees: angleDegrees as CardinalRotation['angleDegrees'] };
}
function usesParameter(value: unknown, names: readonly string[]): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(item => usesParameter(item, names));
  const data = value as Data;
  return typeof data.parameter === 'string' && names.includes(data.parameter)
    || Object.values(data).some(item => usesParameter(item, names));
}
function placementNode(): Data {
  return { kind: 'translate', parent: { node: 4, side: 'solid' }, offset: PLACEMENT.map(parameter) };
}
/** Exact #1989-owned rail, optionally followed by its sole rotation and placement. */
function authoredRailPlacement(d: Document): AuthoredRailPlacement {
  check([4, 5, 6].includes(d.nodes.length), 'Rotate/Move part requires the exact owned two-bevel rectangular rail, with at most one rotation then one placement.');
  check(Object.keys(d.outputs).length === 1 && Object.hasOwn(d.outputs, 'part'), 'Rotate/Move part requires the sole owned output named part without aliases.');
  ref(d.outputs.part, d.nodes.length - 1);
  check(Object.hasOwn(d.parameters, OPPOSITE_CHAMFER[0]) && signedJson(d.nodes[3]) === signedJson({
    kind: 'chamfer', parent: { node: 2, side: 'solid' },
    edge: { parallelTo: 'x', at: { y: list(d.nodes[0].max, 2)[1], z: 'max' } }, distance: parameter(OPPOSITE_CHAMFER[0]),
  }), 'Rotate/Move part requires the exact unnamed opposite bevel and its original max-Y expression and backBevelDistance driver.');
  check(!usesParameter(d.nodes.slice(0, 2), [...CHAMFER, ...OPPOSITE_CHAMFER]), 'The owned bevel drivers must remain independent of the rectangular prefix.');
  const front = { ...d, nodes: d.nodes.slice(0, 3), outputs: { part: { node: 2, side: 'solid' as const } } };
  oppositeChamferDistance(front, d.parameters[OPPOSITE_CHAMFER[0]]);
  const max = point(d.nodes[0].max, d.parameters), height = resolveDimension(d.nodes[1].height, d.parameters);
  let rotation: CardinalRotation | null = null;
  if (d.nodes.length >= 5) {
    const node = record(d.nodes[4], ['kind', 'parent', 'axis', 'angleDegrees']);
    check(node.kind === 'rotate', 'Only the owned rail rotation may follow the two bevels.'); ref(node.parent, 3);
    rotation = cardinalRotation(node.axis, node.angleDegrees);
  }
  let offset: XYZ = [0, 0, 0];
  if (d.nodes.length === 6) {
    check(PLACEMENT.every(key => Object.hasOwn(d.parameters, key)) && signedJson(d.nodes[5]) === signedJson(placementNode()),
      'Move part requires its exact three named placement drivers and owned rotated parent.');
    check(!usesParameter(d.nodes.slice(0, 5), PLACEMENT), 'The three placement drivers must remain independent of the rail and rotation.');
    offset = PLACEMENT.map(key => length(d.parameters[key])) as XYZ;
  }
  // Cardinal permutation/sign changes avoid trigonometric rounding. This is the
  // original rectangular envelope, not a mesh measurement or native certificate.
  const corners: XYZ[] = [];
  for (const x of [0, max[0]]) for (const y of [0, max[1]]) for (const z of [0, height]) {
    let corner: XYZ = [x, y, z];
    const turns = rotation ? ((rotation.angleDegrees / 90) % 4 + 4) % 4 : 0;
    for (let turn = 0; turn < turns; turn++) {
      const [a, b, c] = corner;
      corner = rotation!.axis === 'x' ? [a, -c, b] : rotation!.axis === 'y' ? [c, b, -a] : [-b, a, c];
    }
    corners.push(corner.map((value, axis) => value + offset[axis]) as XYZ);
  }
  // Normalize derived envelope zeros only; authored source and offset signs stay intact.
  const coordinate = (value: number): number => value === 0 ? 0 : value;
  const min = [0, 1, 2].map(axis => coordinate(Math.min(...corners.map(corner => corner[axis])))) as XYZ;
  const upper = [0, 1, 2].map(axis => coordinate(Math.max(...corners.map(corner => corner[axis])))) as XYZ;
  return { rotation, offset, envelope: { min, max: upper } };
}
function linearPatternNode(): Data {
  return { kind: 'linear-pattern', parent: { node: 3, side: 'solid' }, axis: 'x', spacing: parameter(PATTERN[0]), count: 3 };
}
function linearPatternOutputs(): Document['outputs'] {
  return { part: { node: 3, side: 'solid' }, railCopy1: { node: 4, side: 'instance1' }, railCopy2: { node: 4, side: 'instance2' } };
}
function linearPatternSpacing(input: unknown): number {
  const spacing = length(input);
  check(spacing > 0 && 2 * spacing <= LENGTH, 'Pattern spacing must be finite and positive, with twice-spacing at most 10000 mm.');
  return spacing;
}
function reservePattern(d: Document): void {
  reserve(d, PATTERN);
  check(PATTERN_COPIES.every(key => !Object.hasOwn(d.parameters, key) && !Object.hasOwn(d.outputs, key)),
    'The reserved output names railCopy1 and railCopy2 must be unused.');
}
/** Only this terminal graph owns instance1/instance2, including during history.
 * Source-only checks preserve parameter edit identity; native acceptance still
 * owns feasibility, exact stored coefficients and final translated coordinates. */
function linearPatternGraph(d: Document, sourceOnly = false): void {
  check(d.nodes.length === 5 && signedJson(d.nodes[4]) === signedJson(linearPatternNode())
    && signedJson(d.outputs) === signedJson(linearPatternOutputs()),
    'Linear pattern requires exactly the owned +X three-rail graph and its original part plus railCopy1 and railCopy2 outputs.');
  check(PATTERN.every(key => Object.hasOwn(d.parameters, key))
    && PATTERN_COPIES.every(key => !Object.hasOwn(d.parameters, key))
    && !usesParameter(d.nodes.slice(0, 4), PATTERN), 'The patternSpacing driver must be independent of the rail and reserved copy names.');
  const rail = { ...d, nodes: d.nodes.slice(0, 4), outputs: { part: { node: 3, side: 'solid' as const } } };
  if (!sourceOnly) { authoredRailPlacement(rail); linearPatternSpacing(d.parameters[PATTERN[0]]); return; }
  const s = record(rail.nodes[0], ['kind', 'profile', 'min', 'max']);
  const e = record(rail.nodes[1], ['kind', 'sketch', 'height']);
  check(s.kind === 'sketch' && s.profile === 'rectangle' && e.kind === 'extrude' && Object.is(e.sketch, 0),
    'Linear pattern requires the direct rectangular rail prefix with omitted from.');
  check(point(s.min, d.parameters).every(value => value === 0), 'Linear pattern requires the origin-zero rectangular rail prefix.');
  point(s.max, d.parameters, true); resolveDimension(e.height, d.parameters, true);
  check([...CHAMFER, ...OPPOSITE_CHAMFER].every(key => Object.hasOwn(d.parameters, key))
    && !usesParameter(rail.nodes.slice(0, 2), [...CHAMFER, ...OPPOSITE_CHAMFER])
    && signedJson(rail.nodes[2]) === signedJson({ kind: 'chamfer', parent: { node: 1, side: 'solid' },
      edge: { parallelTo: 'x', at: { y: 0, z: 'max' } }, distance: parameter(CHAMFER[0]) })
    && signedJson(rail.nodes[3]) === signedJson({ kind: 'chamfer', parent: { node: 2, side: 'solid' },
      edge: { parallelTo: 'x', at: { y: list(s.max, 2)[1], z: 'max' } }, distance: parameter(OPPOSITE_CHAMFER[0]) }),
    'Linear pattern requires the two exact unnamed bevels and their independent original drivers.');
}
function parameter(key: string): { parameter: string } { return { parameter: key }; }
function addedRectangle(names: readonly string[]): Data {
  const [x, y, width, height] = names;
  return { kind: 'sketch', profile: 'rectangle', min: [parameter(x), parameter(y)],
    max: [{ op: 'add', left: parameter(x), right: parameter(width) }, { op: 'add', left: parameter(y), right: parameter(height) }] };
}
function addedHole(): Data {
  return { kind: 'hole', parent: { node: 1, side: 'solid' },
    center: [parameter(HOLE[0]), parameter(HOLE[1])], radius: parameter(HOLE[2]) };
}
function holePlate(d: Document): [number, number] {
  rectangle(d, 0, 1);
  const min = point(d.nodes[0].min, d.parameters), max = point(d.nodes[0].max, d.parameters);
  check(min.every(value => value === 0), 'Add through-hole requires an origin-zero rectangular plate.');
  check(Object.keys(d.outputs).length === 1 && Object.hasOwn(d.outputs, 'part'), 'Add through-hole requires the sole owned output named part.');
  ref(d.outputs.part, d.nodes.length - 1);
  return max;
}
function holeDimensions(d: Document, x: unknown, y: unknown, radius: unknown): number[] {
  const values = [x, y, radius].map(length), [cx, cy, r] = values, [width, height] = holePlate(d);
  check(r >= 0.001, 'hole radius must be from 0.001 to 10000 mm.');
  const endpoints = [cx - r, cx + r, cy - r, cy + r].map(length);
  check(endpoints[0] < cx && cx < endpoints[1] && endpoints[2] < cy && cy < endpoints[3], 'hole endpoints must remain distinguishable from their center.');
  check(endpoints[0] > 0 && endpoints[1] < width && endpoints[2] > 0 && endpoints[3] < height,
    'hole must be strictly contained on all four plate sides.');
  return values;
}
function pocketNodes(d: Document): Data[] {
  const wall = parameter(POCKET[0]), floor = parameter(POCKET[1]);
  const inset = (value: unknown, driver: Dimension): Dimension => ({ op: 'add', left: value as Dimension, right: { op: 'scale', value: driver, factor: -1 } });
  const max = list(d.nodes[0].max, 2); check(max.length === 2, 'two outer upper coordinates required.');
  return [{ kind: 'sketch', profile: 'rectangle', min: [wall, wall], max: max.map(value => inset(value, wall)) },
    { kind: 'extrude', sketch: 2, from: floor, height: inset(d.nodes[1].height, floor) },
    { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } }];
}
/** Warning identity can validate source terms without resolving edited parameters.
 * Command ownership keeps the strict current-origin check; native geometry remains authoritative. */
function pocketGraph(d: Document, sourceOnly = false): boolean {
  if (d.nodes.length !== 5 || d.nodes[4].kind !== 'difference') return false;
  const s = record(d.nodes[0], ['kind', 'profile', 'min', 'max']), e = record(d.nodes[1], ['kind', 'sketch', 'height']);
  check(s.kind === 'sketch' && s.profile === 'rectangle' && e.kind === 'extrude' && Object.is(e.sketch, 0), 'the pocket must retain its direct rectangular parent.');
  check(point(s.min, d.parameters, sourceOnly).every(value => value === 0), 'the pocket must retain its origin-zero rectangular parent.');
  check(POCKET.every(key => Object.hasOwn(d.parameters, key))
    && signedJson(d.nodes.slice(2)) === signedJson(pocketNodes(d)), 'the pocket must retain its two named drivers and exact offset difference ancestry.');
  check(Object.keys(d.outputs).length === 1 && Object.hasOwn(d.outputs, 'part'), 'the pocket requires the sole result named part.');
  ref(d.outputs.part, 4); return true;
}
function pocketPlate(d: Document): [number, number, number] {
  const height = rectangle(d, 0, 1), min = point(d.nodes[0].min, d.parameters), max = point(d.nodes[0].max, d.parameters);
  check(min.every(value => value === 0), 'Cut rectangular pocket requires an origin-zero rectangular part.');
  check(Object.keys(d.outputs).length === 1 && Object.hasOwn(d.outputs, 'part'), 'Cut rectangular pocket requires the sole owned output named part.');
  ref(d.outputs.part, 1); return [max[0], max[1], height];
}
function pocketDimensions(d: Document, wall: unknown, floor: unknown): [number, number] {
  const values = [length(wall), length(floor)] as [number, number], [w, f] = values;
  check(values.every(value => Number.isSafeInteger(value) && value >= 1), 'pocket wall and floor must be positive safe integers.');
  const [x, y, z] = pocketPlate(d);
  check(length(2 * w) < x && 2 * w < y && f < z, 'pocket must be strictly contained: twice wall < both outer sides and floor < thickness.');
  check([x - 2 * w, y - 2 * w, z - f].every(value => Number.isSafeInteger(value) && value >= 1 && value <= LENGTH), 'positive integer pocket spans from 1 to 10000 mm required.');
  return values;
}
function ownedGraph(d: Document): number {
  check([2, 3, 4, 5, 8].includes(d.nodes.length), 'only complete 2, 3, 4, 5 or 8-node construction stages are supported; no 6/7-node intermediate.');
  const height = rectangle(d, 0, 1);
  if (pocketGraph(d)) return height;
  if (d.nodes.length === 3) {
    check(HOLE.every(k => Object.hasOwn(d.parameters, k)) && signedJson(d.nodes[2]) === signedJson(addedHole()),
      'the through-hole must retain its three named drivers and exact parent.');
    holeDimensions(d, ...HOLE.map(k => d.parameters[k]) as [number, number, number]);
    return height;
  }
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
    : node.kind === 'hole' || node.kind === 'chamfer' || node.kind === 'rotate' || node.kind === 'translate' || node.kind === 'linear-pattern' ? [(node.parent as Ref).node]
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
  check(Object.keys(d.parameters).length + names.length <= 16, 'adding ' + names.length + ' drivers exceeds the 16-parameter limit.');
  check(names.every(k => !Object.hasOwn(d.parameters, k) && !Object.hasOwn(d.outputs, k)), 'reserved parameter name collision: ' + names.join(', ') + '.');
}
export function getModelingStructureCapabilities(text: string | null, summary: CadEditorModelingSummary | null): {
  addArm: ModelingStructureTarget | null; addHole: ModelingStructureTarget | null;
  union: [ModelingStructureTarget, ModelingStructureTarget] | null;
  cutSlot: ModelingStructureTarget | null; cutPocket: ModelingStructureTarget | null;
  chamfer: ModelingStructureTarget | null; chamferReason: string;
  rotatePart: ModelingStructureTarget | null; movePart: ModelingStructureTarget | null;
  placementReason: string; placementAuthored: AuthoredRailPlacement | null;
  linearPattern: ModelingStructureTarget | null; patternReason: string; patternAuthored: boolean;
  reason: string; holeReason: string; pocketReason: string; sharedThickness: number | null;
  pocketDefaults: { wall: number; floor: number } | null; pocketAuthored: boolean;
} {
  const message = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause);
  let chamfer: ModelingStructureTarget | null = null;
  let chamferReason = 'Chamfer the X-parallel edge at model Y=0, Z=max. Native geometry and display limits still apply.';
  try {
    check(text !== null && summary !== null, 'open an accepted primary rectangular part first.');
    const d = document(text), targets = accepted(d, summary);
    if (d.nodes.length === 3) {
      oppositeChamferPlate(d); reserve(d, OPPOSITE_CHAMFER);
      chamferReason = 'Chamfer the opposite X-parallel top edge at the original model Y=max, Z=max. Native geometry and display limits still apply.';
    } else { chamferPlate(d); reserve(d, CHAMFER); }
    chamfer = targets[0];
  } catch (cause) { chamferReason = message(cause); }
  let rotatePart: ModelingStructureTarget | null = null, movePart: ModelingStructureTarget | null = null;
  let placementAuthored: AuthoredRailPlacement | null = null;
  let placementReason = 'Rotate the owned two-bevel rail about the world origin, then move it in native model XYZ millimetres.';
  try {
    check(text !== null && summary !== null, 'open an accepted owned two-bevel rectangular rail first.');
    const d = document(text), targets = accepted(d, summary);
    placementAuthored = authoredRailPlacement(d);
    if (d.nodes.length === 4) rotatePart = targets[0];
    else if (d.nodes.length === 5) {
      reserve(d, PLACEMENT); movePart = targets[0];
      placementReason = 'Move the rotated rail once in native model XYZ millimetres. Finite offsets do not guarantee native exact representability.';
    } else placementReason = 'This six-node rail placement is complete. Edit placementX, placementY and placementZ in Model dimensions; another transform is unsupported.';
  } catch (cause) { placementReason = message(cause); }
  let linearPattern: ModelingStructureTarget | null = null, patternAuthored = false;
  let patternReason = 'Create three separate rails along +X with one shared spacing driver. Native exactness, final-coordinate and display limits still apply.';
  try {
    check(text !== null && summary !== null, 'open an accepted owned two-bevel rectangular rail first.');
    const d = document(text), targets = accepted(d, summary);
    if (d.nodes.length === 5 && d.nodes[4].kind === 'linear-pattern') {
      linearPatternGraph(d); patternAuthored = true;
      patternReason = 'This three-rail pattern is complete. Edit patternSpacing or the shared rail dimensions; another feature or transform is unsupported.';
    } else {
      check(d.nodes.length === 4, 'Linear pattern requires the exact untransformed four-node owned two-bevel rectangular rail.');
      authoredRailPlacement(d); reservePattern(d); linearPattern = targets[0];
    }
  } catch (cause) { patternReason = message(cause); }
  // Keep the older integer-only commands and all their reasons independent.
  const none = { addArm: null, addHole: null, union: null, cutSlot: null, cutPocket: null, sharedThickness: null,
    pocketDefaults: null, pocketAuthored: false, chamfer, chamferReason, rotatePart, movePart, placementReason, placementAuthored,
    linearPattern, patternReason, patternAuthored };
  let pocketAuthored = false;
  const unavailableHole = 'Add through-hole requires the selected Extrude of one unmodified rectangular part.';
  const unavailablePocket = 'Cut rectangular pocket requires the selected Extrude of one unmodified rectangular part.';
  try {
    check(text !== null && summary !== null, 'open an accepted primary rectangular part first.');
    const d = document(text, false), targets = accepted(d, summary);
    pocketAuthored = pocketGraph(d, true);
    Object.values(d.parameters).forEach(length);
    const sharedThickness = ownedGraph(d);
    if (pocketAuthored) return { ...none, pocketAuthored, sharedThickness,
      reason: 'The complete five-node rectangular pocket is already authored. Edit its existing dimensions.', holeReason: unavailableHole,
      pocketReason: 'A rectangular pocket is already authored; a second pocket is unsupported. Keep wall and floor positive to retain a tray.' };
    if (d.nodes.length === 2) {
      let addArm: ModelingStructureTarget | null = null, addHole: ModelingStructureTarget | null = null, cutPocket: ModelingStructureTarget | null = null;
      let pocketDefaults: { wall: number; floor: number } | null = null;
      let reason = 'Add an arm using the existing thickness term; editing shared thickness changes both bodies.';
      let holeReason = 'Add one through-hole; the prior part output is consumed while its source feature remains in history. Provider and receiver limits still apply.';
      let pocketReason = 'Cut one rectangular pocket; the prior part output is consumed while its source features remain in history. Provider and receiver limits still apply.';
      try {
        reserve(d, ARM); check(!Object.hasOwn(d.outputs, 'arm'), 'the reserved output name arm is already used.'); addArm = targets[0];
      } catch (cause) { reason = message(cause); }
      try { holePlate(d); reserve(d, HOLE); addHole = targets[0]; } catch (cause) { holeReason = message(cause); }
      try {
        const [x, y, z] = pocketPlate(d); reserve(d, POCKET);
        const wall = Math.min(8, Math.floor((Math.min(x, y) - 1) / 2)), floor = Math.min(4, z - 1);
        pocketDimensions(d, wall, floor); pocketDefaults = { wall, floor }; cutPocket = targets[0];
      } catch (cause) { pocketReason = message(cause); }
      return { ...none, addArm, addHole, cutPocket, pocketDefaults, sharedThickness, reason, holeReason, pocketReason };
    }
    if (d.nodes.length === 3) return { ...none, sharedThickness,
      reason: 'The complete three-node through-hole is already authored. Edit its existing dimensions.',
      holeReason: 'A through-hole is already authored; a second hole is unsupported. Edit its existing dimensions.', pocketReason: unavailablePocket };
    if (d.nodes.length === 4) return { ...none, union: targets as [ModelingStructureTarget, ModelingStructureTarget], sharedThickness,
      reason: 'Union consumes both named outputs into part; authored operand features remain in history.', holeReason: unavailableHole, pocketReason: unavailablePocket };
    if (d.nodes.length === 5) {
      check(sharedThickness === 8, 'Cut requires resolved thickness exactly 8 mm with omitted from (Z=0..8); shared thickness currently resolves to ' + sharedThickness + ' mm.');
      reserve(d, SLOT); return { ...none, cutSlot: targets[0], sharedThickness, holeReason: unavailableHole, pocketReason: unavailablePocket,
        reason: 'Cut creates one atomic through-slot across the existing 8 mm thickness; provider and receiver limits still apply.' };
    }
    return { ...none, sharedThickness, reason: 'The complete eight-node union-slot is already authored. Edit its existing dimensions.', holeReason: unavailableHole, pocketReason: unavailablePocket };
  } catch (cause) { return { ...none, pocketAuthored, reason: message(cause), holeReason: message(cause), pocketReason: message(cause) }; }
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
  check(kind === 'add-arm' || kind === 'add-hole' || kind === 'union' || kind === 'cut-slot' || kind === 'cut-pocket' || kind === 'chamfer'
    || kind === 'rotate-part' || kind === 'move-part' || kind === 'linear-pattern', 'known structural command required.');
  if (kind === 'linear-pattern') {
    record(command, ['kind', 'target', 'spacing']);
    check(capabilities.linearPattern, capabilities.patternReason); matchingTarget(command.target, capabilities.linearPattern);
    const spacing = linearPatternSpacing(command.spacing); reservePattern(d);
    d.parameters[PATTERN[0]] = spacing; d.nodes.push(linearPatternNode()); d.outputs = linearPatternOutputs();
    return { text: canonicalModelingText(d), selectedOutput: 'part', consumed: [], kind };
  }
  if (kind === 'rotate-part') {
    record(command, ['kind', 'target', 'axis', 'angleDegrees']);
    check(capabilities.rotatePart, capabilities.placementReason); matchingTarget(command.target, capabilities.rotatePart);
    const rotation = cardinalRotation(command.axis, command.angleDegrees);
    d.nodes.push({ kind: 'rotate', parent: { node: 3, side: 'solid' }, ...rotation });
    d.outputs = { part: { node: 4, side: 'solid' } };
    return { text: canonicalModelingText(d), selectedOutput: 'part', consumed: [capabilities.rotatePart.name], kind };
  }
  if (kind === 'move-part') {
    record(command, ['kind', 'target', 'x', 'y', 'z']);
    check(capabilities.movePart, capabilities.placementReason); matchingTarget(command.target, capabilities.movePart);
    const values = [command.x, command.y, command.z].map(length); reserve(d, PLACEMENT);
    PLACEMENT.forEach((key, index) => { d.parameters[key] = values[index]; });
    d.nodes.push(placementNode()); d.outputs = { part: { node: 5, side: 'solid' } };
    return { text: canonicalModelingText(d), selectedOutput: 'part', consumed: [capabilities.movePart.name], kind };
  }
  if (kind === 'chamfer') {
    record(command, ['kind', 'target', 'distance']);
    check(capabilities.chamfer, capabilities.chamferReason); matchingTarget(command.target, capabilities.chamfer);
    if (capabilities.chamfer.node === 2) {
      const distance = oppositeChamferDistance(d, command.distance); reserve(d, OPPOSITE_CHAMFER);
      d.parameters[OPPOSITE_CHAMFER[0]] = distance;
      d.nodes.push({ kind: 'chamfer', parent: { node: 2, side: 'solid' },
        edge: { parallelTo: 'x', at: { y: list(d.nodes[0].max, 2)[1], z: 'max' } }, distance: parameter(OPPOSITE_CHAMFER[0]) });
      d.outputs = { part: { node: 3, side: 'solid' } };
      return { text: canonicalModelingText(d), selectedOutput: 'part', consumed: [capabilities.chamfer.name], kind };
    }
    const distance = chamferDistance(d, command.distance); reserve(d, CHAMFER);
    d.parameters[CHAMFER[0]] = distance;
    d.nodes.push({ kind: 'chamfer', parent: { node: 1, side: 'solid' },
      edge: { parallelTo: 'x', at: { y: 0, z: 'max' } }, distance: parameter(CHAMFER[0]) });
    d.outputs = { part: { node: 2, side: 'solid' } };
    return { text: canonicalModelingText(d), selectedOutput: 'part', consumed: [capabilities.chamfer.name], kind };
  }
  if (kind === 'cut-pocket') {
    record(command, ['kind', 'target', 'wall', 'floor']);
    check(capabilities.cutPocket, capabilities.pocketReason); matchingTarget(command.target, capabilities.cutPocket);
    const values = pocketDimensions(d, command.wall, command.floor); reserve(d, POCKET);
    POCKET.forEach((key, index) => { d.parameters[key] = values[index]; });
    d.nodes.push(...pocketNodes(d)); d.outputs = { part: { node: 4, side: 'solid' } };
    // Check the newly wrapped expressions while preserving the exact prefix.
    const min = point(d.nodes[2].min, d.parameters), max = point(d.nodes[2].max, d.parameters);
    const from = resolveDimension(d.nodes[3].from, d.parameters), height = resolveDimension(d.nodes[3].height, d.parameters);
    length(from + height); check([...min, ...max, from, height].every(Number.isSafeInteger), 'safe-integer pocket coordinates required.');
    ownedGraph(d);
    return { text: canonicalModelingText(d), selectedOutput: 'part', consumed: [capabilities.cutPocket.name], kind };
  }
  if (kind === 'add-hole') {
    record(command, ['kind', 'target', 'x', 'y', 'radius']);
    check(capabilities.addHole, capabilities.holeReason); matchingTarget(command.target, capabilities.addHole);
    const values = holeDimensions(d, command.x, command.y, command.radius); reserve(d, HOLE);
    HOLE.forEach((key, index) => { d.parameters[key] = values[index]; });
    d.nodes.push(addedHole()); d.outputs = { part: { node: 2, side: 'solid' } }; ownedGraph(d);
    return { text: canonicalModelingText(d), selectedOutput: 'part', consumed: [capabilities.addHole.name], kind };
  }
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
        check(['sketch', 'extrude', 'translate', 'rotate', 'cut', 'intersect', 'union', 'difference', 'split', 'chamfer', 'hole', 'linear-pattern'].includes(node.kind as string), 'unknown authored feature.');
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
