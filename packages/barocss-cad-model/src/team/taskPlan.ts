// D584: bind a bounded part task to the document and its authored design contract.
import { isEditableBox, updateBoxFootprint } from '../app/editCommand';
import { briefGaps, readBrief } from '../chat/brief';
import { unitAssumptions, unconfirmed } from '../chat/drafts';
import { checkNode } from '../chat/features';
import { checkRequirement, holeDiameterRequirementMm, meets, meetsHoleDiameterMm } from '../chat/spec';
import { bodyKey, withExtrusionHeight, type BodyRef, type PartInstance, type StudioDoc } from '../engine/doc';
import { PARAMETER_NAME, parameterUses, withParameters } from '../engine/parameters';
import { BRIEF_FIELDS, type Brief } from '../engine/schema/brief';
import type { Predicate, Requirement } from '../engine/schema/spec';
import { digestOf } from '../util/digest';
import { isObj, isVec3 } from '../util/guards';
import { readInterfaces, type Interfaces } from './interfaces';

interface TaskIdentity { readonly projectId: string; readonly documentId: string }
export interface TaskRequest {
  readonly id: string;
  readonly holder: string;
  readonly occurrence: string;
  readonly feature: string;
  readonly capability: 'extrusion-height' | 'rectangle-width' | 'rectangle-depth' | 'rectangle-footprint' | 'hole-diameter';
  readonly units: 'mm';
  readonly frame: 'part-local-z' | 'part-local-x' | 'part-local-y' | 'part-local-xy';
  readonly dependsOn?: readonly string[];
  readonly retainBoxCommand?: true;
}
export interface TaskPlanRequest {
  readonly identity: TaskIdentity;
  readonly policyRevision: string;
  readonly maxTasks: number;
  readonly throughSequence: number;
  readonly tasks: readonly TaskRequest[];
  readonly protectedOccurrences?: readonly string[];
}
export interface TaskPlanError { error: { code: string; message: string } }
export type TaskDimension = 'height' | 'width' | 'depth' | 'diameter' | 'footprint';
export type RectangleFootprint = Readonly<{ widthMm: number; depthMm: number }>;
export type TaskValue = number | RectangleFootprint;
export interface BoundTask extends TaskRequest {
  readonly dependsOn: readonly string[];
  readonly inputDigest: string;
  readonly reads: Readonly<{ occurrence: string; requirements: readonly string[]; interfaces: readonly string[]; holeFace?: string; heightParameter?: string }>;
  readonly writes: Readonly<{ occurrence: string; feature: string; field: TaskDimension }>;
  readonly verification: Readonly<{ native: 'requirements'; oracle: 'rectangular-prism' | 'circular-cylinder'; relativeTolerance: number }>;
  readonly checks: readonly Requirement[];
  readonly blockers: readonly string[];
}
export interface TaskPlan {
  readonly specRevision: string;
  readonly identity: TaskIdentity;
  readonly policyRevision: string;
  readonly baselineDigest: string;
  readonly maxTasks: number;
  readonly throughSequence: number;
  readonly providerCostUsd: 0;
  readonly specification: Readonly<{ brief: StudioDoc['brief']; requirements: readonly Requirement[]; interfaces: Interfaces }>;
  readonly tasks: readonly BoundTask[];
  readonly protectedOccurrences?: readonly string[];
}

const taskCapabilities = {
  'extrusion-height': { field: 'height', frame: 'part-local-z' },
  'rectangle-width': { field: 'width', frame: 'part-local-x' },
  'rectangle-depth': { field: 'depth', frame: 'part-local-y' },
  'rectangle-footprint': { field: 'footprint', frame: 'part-local-xy' },
  'hole-diameter': { field: 'diameter', frame: 'part-local-z' },
} as const;

export const isTaskCapability = (capability: unknown): capability is TaskRequest['capability'] =>
  typeof capability === 'string' && Object.hasOwn(taskCapabilities, capability);
export const taskField = (capability: TaskRequest['capability']): TaskDimension => taskCapabilities[capability].field;
export const isTaskDimension = (field: unknown): field is TaskDimension =>
  field === 'height' || field === 'width' || field === 'depth' || field === 'diameter' || field === 'footprint';
export const taskAxis = (field: TaskDimension): 'x' | 'y' | 'z' | undefined =>
  ({ height: 'z', width: 'x', depth: 'y', diameter: undefined, footprint: undefined } as const)[field];

/** The only authored change allowed by the local extrusion-height task. */
export function taskHeightEdit(doc: StudioDoc, instance: PartInstance, index: number, height: number): { doc: StudioDoc; local: StudioDoc } {
  const { nodes } = instance.doc;
  const local = { ...instance.doc, nodes: nodes.map((node, at) => at === index && node.kind === 'extrude'
    ? withExtrusionHeight(node, nodes[node.sketch], height) : node) };
  return { local, doc: { ...doc, instances: doc.instances!.map(part => part.id === instance.id ? { ...part, doc: local } : part) } };
}
export interface TaskShape {
  minX: number; minY: number; width: number; depth: number;
  circle?: { center: [number, number]; radius: number; wall: string };
  hole?: { x: number; y: number; radius: number };
}
export interface TaskImpact { id: string; state: 'current' | 'stale' | 'blocked'; reason?: string }

const MAX_TASKS = 32;
const admitted = new WeakSet<object>();
export const isTaskPlan = (value: unknown): value is TaskPlan => isObj(value) && admitted.has(value);
const error = (code: string, message: string): TaskPlanError => ({ error: { code, message } });
const name = (v: unknown): v is string => typeof v === 'string' && v.length <= 128 && !!v.trim() && v === v.trim();
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const positive = (v: unknown): v is number => finite(v) && v > 0;
export function readRectangleFootprint(value: unknown): RectangleFootprint | undefined {
  if (!isObj(value) || !only(value, ['widthMm', 'depthMm']) || Object.keys(value).length !== 2
      || !positive(value.widthMm) || !positive(value.depthMm)) return;
  return { widthMm: value.widthMm, depthMm: value.depthMm };
}

export const isPositiveTaskValue = (value: unknown): value is TaskValue => positive(value) || readRectangleFootprint(value) !== undefined;

const xy = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(finite);
const only = (value: object, keys: readonly string[]) => (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  && Reflect.ownKeys(value).every(key => typeof key === 'string' && keys.includes(key)
    && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, 'value'));

/** Read one positive, directly bound length from the occurrence's own parameter table. */
export function taskHeightParameter(height: unknown, parameters: StudioDoc['parameters']) {
  if (!isObj(height) || !only(height, ['parameter']) || !Object.hasOwn(height, 'parameter') ||
      typeof height.parameter !== 'string' || !PARAMETER_NAME.test(height.parameter) || !Object.hasOwn(parameters, height.parameter)) return;
  const value = parameters[height.parameter];
  if (positive(value)) return { name: height.parameter, value };
}
const byId = <T extends { id: string }>(a: T, b: T) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const featureId = (id: unknown): id is string => typeof id === 'string' && /^n(?:0|[1-9]\d*)$/.test(id);
function freeze<T>(value: T): T {
  if (isObj(value) || Array.isArray(value)) {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

interface TaskTarget {
  instance: PartInstance; index: number; shape: TaskShape; height: number; value: TaskValue; body: string; holeFace?: string; heightParameter?: string;
}

function boreFits(shape: TaskShape, x: number, y: number, radius: number): boolean {
  return positive(radius) && radius < x - shape.minX && radius < shape.minX + shape.width - x
    && radius < y - shape.minY && radius < shape.minY + shape.depth - y;
}

export function taskTarget(doc: StudioDoc, task: Pick<TaskRequest, 'occurrence' | 'feature'> & Partial<Pick<TaskRequest, 'capability' | 'retainBoxCommand'>>):
  TaskTarget | TaskPlanError {
  const matches = (doc.instances ?? []).filter(i => i.id === task.occurrence);
  if (task.occurrence === 'base' || matches.length !== 1) return error('WRONG_TARGET', `${task.occurrence} must name one placed occurrence.`);
  const instance = matches[0], part = instance.doc;
  const linked = instance.part || instance.pattern || instance.savedPlacement || instance.hidden || Object.keys(instance.joints ?? {}).length
    || doc.instancePatterns?.some(p => p.seed === instance.id) || doc.mates?.some(m => m.a.part === instance.id || m.b.part === instance.id)
    || doc.assemblyCuts?.some(c => c.targets.includes(instance.id)) || doc.variability?.inputs.length;
  if (linked || part.instances?.length || part.direct
    || Object.values(instance.looks ?? {}).some(l => l.hidden) || Object.values(part.bodies ?? {}).some(l => l.hidden)
    || !isVec3(instance.position) || !isVec3(instance.rotation) || instance.rotation.some(v => v !== 0)) {
    return error('UNSUPPORTED_PROFILE', `${instance.id} must be an upright, visible, standalone occurrence.`);
  }
  if (doc.units !== 'mm' || part.units !== 'mm') return error('WRONG_UNIT', 'The assembly and part must use mm.');
  const nodes = part.nodes, [sketch, extrusion, hole] = nodes;
  const capability = task.capability ?? 'extrusion-height';
  if (!isTaskCapability(capability)) return error('UNSUPPORTED_CAPABILITY', 'Unsupported task capability.');
  const dimension = taskField(capability);
  const planar = dimension === 'width' || dimension === 'depth' || dimension === 'footprint';
  const index = planar ? 0 : dimension === 'diameter' ? 2 : 1;
  if (!featureId(task.feature) || nodes.filter(n => n.id === task.feature).length !== 1 || nodes[index]?.id !== task.feature) {
    const feature = planar ? 'rectangle sketch' : dimension === 'diameter' ? 'Hole feature' : 'extrusion';
    return error('WRONG_TARGET', `${instance.id}/${task.feature} must name the authored ${feature}.`);
  }
  if ((nodes.length !== 2 && nodes.length !== 3) || nodes.some(n => !featureId(n.id) || n.suppressed || n.held)
    || new Set(nodes.map(n => n.id)).size !== nodes.length
    || sketch?.kind !== 'sketch'
    || sketch.association || sketch.plane || sketch.regions?.length || sketch.holes?.length || sketch.outline || sketch.on
    || extrusion.kind !== 'extrude' || extrusion.sketch !== 0
    || (extrusion.from !== undefined && extrusion.from !== 0) || (extrusion.draft !== undefined && extrusion.draft !== 0)) {
    return error('UNSUPPORTED_PROFILE', `${instance.id} needs a plain supported sketch with a positive extrusion along local +Z.`);
  }
  const parameter = dimension === 'height' ? taskHeightParameter(extrusion.height, part.parameters) : undefined;
  const height = parameter?.value ?? extrusion.height;
  if (!positive(height))
    return error('UNSUPPORTED_PROFILE', `${instance.id} needs a positive literal extrusion height or an admitted local height parameter.`);
  if (parameter && (nodes.length !== 2 || extrusion.made || part.variability
      || Object.values(part.configurations ?? {}).some(config => Object.hasOwn(config, parameter.name))
      || parameterUses([sketch, { ...extrusion, height: 0 }], parameter.name))) {
    return error('UNSUPPORTED_PROFILE', `${instance.id} needs one plain extrusion with a parameter that controls only its height.`);
  }
  let shape: TaskShape;
  if (sketch.profile === 'rectangle' && xy(sketch.min) && xy(sketch.max)) {
    const [minX, minY] = sketch.min, [maxX, maxY] = sketch.max;
    shape = { minX, minY, width: maxX - minX, depth: maxY - minY };
  } else if (dimension === 'height' && nodes.length === 2 && sketch.profile === 'circle' && xy(sketch.center)
      && positive(sketch.radius) && sketch.construction === undefined) {
    const { center, radius, sideTags } = sketch, [x, y] = center;
    const tag = sideTags?.outer?.[0];
    if (sideTags !== undefined && (!isObj(sideTags) || !only(sideTags, ['outer', 'regions', 'holes'])
      || !Array.isArray(sideTags.outer) || sideTags.outer.length !== 1 || typeof tag !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(tag)
      || (sideTags.regions !== undefined && (!Array.isArray(sideTags.regions) || sideTags.regions.length > 0))
      || (sideTags.holes !== undefined && (!Array.isArray(sideTags.holes) || sideTags.holes.length > 0))))
      return error('UNSUPPORTED_PROFILE', `${instance.id} needs one valid outer side tag for a tagged circle.`);
    const minX = x - radius, minY = y - radius, maxX = x + radius, maxY = y + radius;
    if (!(finite(minX) && finite(minY) && finite(maxX) && finite(maxY) && minX < x && x < maxX && minY < y && y < maxY))
      return error('UNSUPPORTED_PROFILE', `${instance.id} needs representable circle bounds around its literal centre.`);
    shape = { minX, minY, width: 2 * radius, depth: 2 * radius, circle: { center, radius, wall: extrusion.id + (tag ? `.side[${tag}]` : '.side0') } };
  } else {
    return error('UNSUPPORTED_PROFILE', `${instance.id} needs a plain rectangle or a solid literal circle for a height task.`);
  }
  if (task.retainBoxCommand && ((dimension !== 'width' && dimension !== 'depth') || nodes.length !== 2 || !isEditableBox(nodes, 0)))
    return error('UNSUPPORTED_PROFILE', `${instance.id} needs a standard upright Box to retain the Box command.`);
  if (dimension === 'footprint' && ((extrusion.made && !isEditableBox(nodes, 0)) || checkNode(sketch, [], part.parameters)))
    return error('UNSUPPORTED_PROFILE', `${instance.id} needs a plain rectangle or a standard upright Box for a footprint task.`);
  const area = shape.circle ? Math.PI * shape.circle.radius ** 2 : shape.width * shape.depth;
  if (!positive(shape.width) || !positive(shape.depth) || !positive(area * height)) {
    return error('UNSUPPORTED_PROFILE', `${instance.id} has nonfinite volume.`);
  }
  if (planar && hole) return error('UNSUPPORTED_PROFILE', `${instance.id} needs a solid rectangle without holes for a ${dimension} task.`);
  if (hole) {
    if (hole.kind !== 'hole' || hole.parent?.node !== 1 || hole.parent.side !== 'solid'
      || !xy(hole.center) || !positive(hole.radius) || !positive(2 * hole.radius)
      || (hole.axis !== undefined && hole.axis !== 'z') || (hole.side !== undefined && hole.side !== 'min' && hole.side !== 'max')
      || (hole.face !== undefined && hole.face !== `${extrusion.id}.top` && hole.face !== `${extrusion.id}.bottom`)
      || (hole.face === `${extrusion.id}.top` && hole.side === 'min') || (hole.face === `${extrusion.id}.bottom` && hole.side === 'max')
      || hole.depth !== undefined || hole.pattern !== undefined || hole.countersink !== undefined || hole.csk !== undefined || hole.thread !== undefined
      || !boreFits(shape, hole.center[0], hole.center[1], hole.radius)) {
      return error('UNSUPPORTED_PROFILE', `${instance.id} supports only one ordinary through hole inside its rectangle.`);
    }
    shape.hole = { x: hole.center[0], y: hole.center[1], radius: hole.radius };
  }
  const leaf: BodyRef = { node: nodes.length - 1, side: 'solid' };
  const key = bodyKey(leaf, nodes);
  if (Object.entries(part.outputs).some(([id, ref]) => id !== key || ref.node !== leaf.node || ref.side !== leaf.side)) {
    return error('UNSUPPORTED_PROFILE', `${instance.id} must expose its final solid as the only output.`);
  }
  const value = dimension === 'footprint' ? { widthMm: shape.width, depthMm: shape.depth }
    : planar ? shape[dimension] : dimension === 'diameter' ? 2 * shape.hole!.radius : height;
  return { instance, index, shape, height, value, body: key, ...(hole && { holeFace: `${hole.id}.side0` }),
    ...(parameter && { heightParameter: parameter.name }) };
}

/** Reconstruct the one authored change and the existing tool operation that produces it. */
export function taskDimensionEdit(doc: StudioDoc, task: BoundTask, target: Exclude<ReturnType<typeof taskTarget>, TaskPlanError>, value: TaskValue) {
  const { instance, index, shape } = target, field = task.writes.field;
  if (field === 'footprint') {
    const footprint = readRectangleFootprint(value);
    if (!footprint) return error('TASK_VALUE', 'The footprint needs two positive finite extents in mm.');
    return editRectangleExtents(doc, task, target, [['width', footprint.widthMm], ['depth', footprint.depthMm]]);
  }
  if (!positive(value) || value === target.value) return error('TASK_VALUE', 'The task must change its admitted dimension to a positive finite value in mm.');
  if (field === 'height') {
    if (target.heightParameter !== task.reads.heightParameter)
      return error('TASK_SCOPE_CHANGED', 'The extrusion height parameter differs from the task plan.');
    if (target.heightParameter !== undefined) {
      const area = shape.circle ? Math.PI * shape.circle.radius ** 2 : shape.width * shape.depth;
      if (!positive(area * value))
        return error('TASK_VALUE', 'The requested height must produce a positive finite volume.');
      const set = { [target.heightParameter]: value };
      const local = withParameters(instance.doc, set);
      return { local, doc: { ...doc, instances: doc.instances!.map(part => part.id === instance.id ? { ...part, doc: local } : part) },
        op: { tool: 'set_parameters', args: { set } }, shape, height: value };
    }
    return { ...taskHeightEdit(doc, instance, index, value),
      op: { tool: 'edit_feature', args: { index, values: { h: value } } }, shape, height: value };
  }
  const node = instance.doc.nodes[index];
  if (field === 'diameter') {
    const hole = shape.hole, radius = value / 2;
    if (node.kind !== 'hole' || !hole || radius === hole.radius || 2 * radius !== value
      || !boreFits(shape, hole.x, hole.y, radius))
      return error('TASK_VALUE', 'The requested diameter must keep the through hole wholly inside the rectangle.');
    const check = task.checks.find(req => req.hard && req.check.query.fn === 'hole_diameter');
    if (!check || !meetsHoleDiameterMm(value, check.check)?.ok)
      return error('TASK_REQUIRED_CHECK', 'The requested diameter must satisfy the bound hole diameter requirement.');
    const local = { ...instance.doc, nodes: instance.doc.nodes.map((n, at) => at === index ? { ...node, radius } : n) };
    return { local, doc: { ...doc, instances: doc.instances!.map(part => part.id === instance.id ? { ...part, doc: local } : part) },
      op: { tool: 'edit_feature', args: { index, values: { dia: value } } }, shape: { ...shape, hole: { ...hole, radius } }, height: target.height };
  }
  return editRectangleExtents(doc, task, target, [[field, value]]);
}

function editRectangleExtents(doc: StudioDoc, task: BoundTask, target: TaskTarget, changes: readonly (readonly ['width' | 'depth', number])[]) {
  const { instance, index, shape } = target, sketch = instance.doc.nodes[index];
  if (sketch.kind !== 'sketch' || sketch.profile !== 'rectangle')
    return error('UNSUPPORTED_PROFILE', 'The task needs a plain rectangle sketch.');
  const max: typeof sketch.max = [...sketch.max], editedShape = { ...shape };
  for (const [field, value] of changes) {
    const coordinate = field === 'width' ? 0 : 1, origin = coordinate === 0 ? shape.minX : shape.minY;
    const endpoint = origin + value, extent = endpoint - origin;
    if (!positive(extent) || extent === shape[field] || origin + extent !== endpoint
        || Math.abs(extent - value) > task.verification.relativeTolerance * Math.max(1, value))
      return error('TASK_VALUE', `The requested ${field} cannot be represented by this rectangle.`);
    const outsideTolerance = task.checks.find(req => req.hard && req.check.query.fn === 'bbox'
      && req.check.query.axis === taskAxis(field) && !meets(extent, req.check).ok);
    if (outsideTolerance) return error('TASK_REQUIRED_CHECK', `The authored ${field} does not satisfy ${outsideTolerance.id}.`);
    max[coordinate] = endpoint;
    editedShape[field] = extent;
  }
  if (!positive(editedShape.width * editedShape.depth * target.height))
    return error('TASK_VALUE', 'The requested extents must produce a positive finite volume.');
  const feature = { ...sketch, max };
  const reason = checkNode(feature, [], instance.doc.parameters);
  if (reason) return error('UNSUPPORTED_PROFILE', reason);
  const before = instance.doc.nodes, after = before.map((node, at) => at === index ? feature : node);
  const extrusion = before[index + 1];
  const retainBox = task.retainBoxCommand || (task.writes.field === 'footprint' && extrusion?.kind === 'extrude' && !!extrusion.made);
  const nodes = retainBox ? updateBoxFootprint(before, after, index) : after;
  if (retainBox && nodes === after)
    return error('TASK_VALUE', 'The requested extents must retain the Box command and its dimension limits.');
  const local = { ...instance.doc, nodes };
  return { local, doc: { ...doc, instances: doc.instances!.map(part => part.id === instance.id ? { ...part, doc: local } : part) },
    op: { tool: 'edit_feature', args: { index, feature, ...(nodes !== after && { retainBoxCommand: true }) } }, shape: editedShape, height: target.height };
}

const briefFields = (brief: Brief | undefined) => Object.fromEntries(BRIEF_FIELDS
  .filter(key => key !== 'notes' && key !== 'finish').map(key => [key, brief?.[key]]));
const pendingDrafts = (doc: StudioDoc, scope: string) => [
  ...unconfirmed(doc).map(d => `${scope}:draft:${d.key}`),
  ...unitAssumptions(doc).map(d => `${scope}:draft-units:${d}`),
];
const hardChecks = (doc: StudioDoc) => (doc.requirements ?? []).filter(r => r.hard);

function diameterCheckMatches(check: Predicate, target: TaskTarget): boolean {
  if (!target.holeFace || check.query.fn !== 'hole_diameter') return false;
  const face = check.query.face;
  if (face === target.holeFace) return true;
  return isObj(face) && only(face, ['feature', 'role', 'on']) && Object.hasOwn(face, 'feature') && Object.hasOwn(face, 'role')
    && face.feature === target.instance.doc.nodes[2].id && face.role === 'side0'
    && (!Object.hasOwn(face, 'on') || face.on === target.body);
}
function protectedChecksPass(doc: StudioDoc, id: string): boolean {
  const part = doc.instances?.find(instance => instance.id === id)?.doc;
  if (!part || pendingDrafts(part, id).length) return false;
  const target = taskTarget(doc, { occurrence: id, feature: part.nodes[1]?.id ?? '' });
  if ('error' in target) return false;
  const checks = hardChecks(part);
  if (!checks.length || new Set(checks.map(req => req.id)).size !== checks.length) return false;
  const bounds = { x: target.shape.width, y: target.shape.depth, z: target.height };
  return checks.every(req => {
    const check = req.check;
    if (checkRequirement(req) || req.basis !== 'stated' || !req.source.trim() || (check.tol ?? 0) < 0) return false;
    if (diameterCheckMatches(check, target)) return meetsHoleDiameterMm(2 * target.shape.hole!.radius, check)?.ok === true;
    return check.query.fn === 'bbox' && check.query.body === undefined && check.unit === 'mm'
      && (!target.shape.circle || check.query.axis === 'z')
      && (check.op !== 'between' || ((check.tol ?? 0) === 0 && check.min! <= check.max!)) && meets(bounds[check.query.axis], check).ok;
  });
}

function checkCoverage(doc: StudioDoc, tasks: readonly TaskRequest[], protectedOccurrences?: readonly string[]): TaskPlanError | undefined {
  if (hardChecks(doc).length) return error('UNCOVERED_REQUIREMENT', 'Assembly hard requirements are outside this profile.');
  const owned = new Set(tasks.map(t => t.occurrence));
  const protectedIds = new Set<string>();
  if (protectedOccurrences !== undefined) {
    if (tasks.length !== 1 || !Array.isArray(protectedOccurrences) || !protectedOccurrences.length || protectedOccurrences.length > MAX_TASKS)
      return error('BAD_PLAN', 'Protected occurrences require one repair task and a bounded list of sibling IDs.');
    for (const id of protectedOccurrences) {
      if (!name(id) || owned.has(id) || protectedIds.has(id))
        return error('BAD_PLAN', 'Protected occurrences must be distinct and outside the repair task.');
      if (!protectedChecksPass(doc, id))
        return error('UNCOVERED_REQUIREMENT', `${id} needs passing, stated local dimension requirements to stay protected.`);
      protectedIds.add(id);
    }
  }
  const walk = (parent: StudioDoc, top = true): string | undefined => {
    for (const i of parent.instances ?? []) {
      if ((!top || (!owned.has(i.id) && !protectedIds.has(i.id))) && hardChecks(i.doc).length) return i.id;
      const nested = walk(i.doc, false);
      if (nested) return nested;
    }
  };
  const uncovered = walk(doc);
  if (uncovered) return error('UNCOVERED_REQUIREMENT', `No admitted task covers the hard requirements of ${uncovered}.`);
}

function taskInterfaces(doc: StudioDoc): Interfaces | TaskPlanError {
  if (doc.interfaces !== undefined && (!isObj(doc.interfaces) || doc.interfaces.version !== 1)) {
    return error('BAD_INTERFACE', 'The assembly must use a version 1 interface contract.');
  }
  const interfaces = readInterfaces(doc.interfaces);
  const { holePatterns, envelopes, budgets, datums, keepouts } = interfaces;
  if (!Array.isArray(holePatterns) || !Array.isArray(envelopes) || !Array.isArray(datums) || !Array.isArray(keepouts)
    || !isObj(budgets) || (budgets.parts !== undefined && !isObj(budgets.parts))) {
    return error('BAD_INTERFACE', 'The assembly interface lists and budgets must have the expected shapes.');
  }
  if (datums.length || keepouts.length || budgets.mass !== undefined || Object.keys(budgets.parts ?? {}).length) {
    return error('UNSUPPORTED_INTERFACE', 'This task profile verifies hole patterns and envelopes. Datum, keep-out and mass-budget contracts require another profile.');
  }
  const visible = (id: string) => (doc.instances ?? []).filter(i => i.id === id && !i.hidden).length === 1;
  const patterns = new Set<string>(), boxes = new Set<string>();
  for (const p of holePatterns) {
    if (!isObj(p) || !name(p.id) || patterns.has(p.id) || !positive(p.diameter) || !isVec3(p.axis) || !positive(Math.hypot(...p.axis))
      || !Array.isArray(p.positions) || !p.positions.length || !p.positions.every(isVec3)
      || !Array.isArray(p.parts) || !p.parts.length || !p.parts.every(id => name(id) && visible(id)) || new Set(p.parts).size !== p.parts.length) {
      return error('BAD_INTERFACE', 'A hole pattern needs a distinct ID, finite positive diameter, finite axis and positions, and distinct visible participants.');
    }
    patterns.add(p.id);
  }
  for (const e of envelopes) {
    if (!isObj(e) || !name(e.id) || boxes.has(e.id) || !name(e.part) || !visible(e.part)
      || !isVec3(e.min) || !isVec3(e.max) || e.min.some((min, i) => min > e.max[i])) {
      return error('BAD_INTERFACE', 'An envelope needs a distinct ID, one visible occurrence and finite ordered bounds.');
    }
    boxes.add(e.id);
  }
  return interfaces;
}

/** Capture the checks from the document, not from the task request. */
function readTask(doc: StudioDoc, request: TaskRequest): Omit<BoundTask, 'inputDigest'> & { inputs: unknown } | TaskPlanError {
  const target = taskTarget(doc, request);
  if ('error' in target) return target;
  const { instance, shape } = target, part = instance.doc;
  const checks = [...(part.requirements ?? [])].sort(byId);
  if (new Set(checks.map(r => r.id)).size !== checks.length) return error('BAD_REQUIREMENT', `${instance.id} has duplicate requirement IDs.`);
  const rootBrief = readBrief(doc.brief), partBrief = readBrief(part.brief);
  const blockers = [...pendingDrafts(doc, 'assembly'), ...pendingDrafts(part, instance.id)];
  const combined = { ...rootBrief, ...partBrief, version: 1 as const };
  // Brief fields on the assembly can supply the context for a local part task.
  for (const gap of briefGaps(combined)) if (gap.field === 'purpose' || gap.field === 'process' || gap.field === 'material') {
    blockers.push(`brief:${gap.field}:${gap.why}`);
  }
  const dimension = taskField(request.capability), axis = taskAxis(dimension);
  const axes = new Map((dimension === 'footprint' ? ['x', 'y'] as const : axis ? [axis] : [])
    .map(axis => [axis, { hard: false, exact: 0, low: 0, high: Infinity }]));
  let diameterChecks = 0;
  for (const req of checks) {
    const invalid = checkRequirement(req);
    if (invalid) return error('BAD_REQUIREMENT', invalid);
    const p = req.check;
    if (req.hard && p.query.fn === 'hole_diameter') {
      if (!diameterCheckMatches(p, target) || p.op !== '==' || (p.unit !== 'mm' && p.unit !== 'in') || !positive(p.value))
        return error('UNSUPPORTED_CHECK', `${req.id} must check the stable cylindrical wall of the native Hole with a positive exact diameter in mm or in.`);
      if (!holeDiameterRequirementMm(p)) return error('BAD_REQUIREMENT', `${req.id} has an invalid diameter tolerance range in mm.`);
      diameterChecks++;
      if (req.basis === 'assumed' || req.basis === 'ambiguous') blockers.push(`requirement:${req.id}:${req.basis}`);
      else if (req.basis !== 'stated' || !req.source.trim())
        return error('BAD_REQUIREMENT', `${req.id} needs a stated source for the hole diameter.`);
      else if (dimension !== 'diameter' && !meetsHoleDiameterMm(2 * shape.hole!.radius, p)?.ok)
        return error('CONFLICTING_REQUIREMENT', `${req.id} cannot be met by a ${dimension} edit.`);
      continue;
    }
    if (p.query.fn !== 'bbox' || p.query.body !== undefined || p.unit !== 'mm') {
      if (req.hard) return error('UNSUPPORTED_CHECK', `${req.id} must check a part bounding-box axis in mm.`);
      continue;
    }
    if ((p.tol !== undefined && p.tol < 0) || (p.op === 'between' && (p.min! > p.max! || (p.tol ?? 0) !== 0))) {
      return error('BAD_REQUIREMENT', `${req.id} has an invalid tolerance or range.`);
    }
    if (!req.hard) continue;
    if (shape.circle && p.query.axis !== 'z')
      return error('UNSUPPORTED_CHECK', `${req.id} must check local Z for a circular extrusion height task.`);
    const range = axes.get(p.query.axis);
    if (range) {
      range.hard = true;
      if (p.op === '==') {
        range.exact++;
        if ((dimension === 'footprint' || request.retainBoxCommand) && (!positive(p.value) || (req.basis === 'stated'
          ? !req.source.trim() : req.basis !== 'assumed' && req.basis !== 'ambiguous')))
          return error('BAD_REQUIREMENT', `${req.id} needs a positive extent and a stated source.`);
      }
    }
    if (req.basis === 'assumed' || req.basis === 'ambiguous') {
      blockers.push(`requirement:${req.id}:${req.basis}`);
      continue;
    }
    if (!range) {
      const fixed = p.query.axis === 'x' ? shape.width : p.query.axis === 'y' ? shape.depth : target.height;
      if (!meets(fixed, p).ok) {
        return error('CONFLICTING_REQUIREMENT', `${req.id} cannot be met by a ${dimension} edit.`);
      }
      continue;
    }
    const tolerance = (p.tol ?? 0) + 1e-9 * Math.max(1, Math.abs(p.value ?? 0));
    if (p.op === 'between') { range.low = Math.max(range.low, p.min! - 1e-9); range.high = Math.min(range.high, p.max! + 1e-9); }
    if (p.op === '==' || p.op === '>=') range.low = Math.max(range.low, p.value! - tolerance);
    if (p.op === '==' || p.op === '<=') range.high = Math.min(range.high, p.value! + tolerance);
  }
  if (dimension === 'diameter' && diameterChecks !== 1)
    return error('MISSING_REQUIRED_CHECK', `${instance.id} needs one hard exact diameter requirement for the through hole in mm or in.`);
  for (const [axis, range] of axes) {
    if ((dimension === 'footprint' || request.retainBoxCommand) && range.exact !== 1)
      return error('MISSING_REQUIRED_CHECK', `${instance.id} needs one hard exact local ${axis.toUpperCase()} requirement in mm.`);
    if (!range.hard) return error('MISSING_REQUIRED_CHECK', `${instance.id} needs a hard check of local ${axis.toUpperCase()} ${dimension} in mm.`);
    if (range.low > range.high || range.high <= 0) return error('CONFLICTING_REQUIREMENT', `${instance.id} has incompatible ${dimension} requirements.`);
  }

  const interfaces = taskInterfaces(doc);
  if ('error' in interfaces) return interfaces;
  const holePatterns = interfaces.holePatterns.filter(p => p.parts.includes(instance.id)).sort(byId);
  if (dimension === 'diameter' && holePatterns.length)
    return error('SHARED_HOLE_PATTERN', `${instance.id} participates in ${holePatterns.map(p => p.id).join(', ')}. A local diameter task cannot change a shared hole pattern.`);
  const envelopes = interfaces.envelopes.filter(e => e.part === instance.id).sort(byId);
  const inputs = {
    target: { id: instance.id, position: instance.position, rotation: instance.rotation },
    model: { units: part.units, nodes: part.nodes, parameters: part.parameters, outputs: part.outputs, references: part.references,
      materials: Object.fromEntries(Object.entries(part.bodies ?? {}).filter(([, l]) => l.material !== undefined).map(([id, l]) => [id, l.material])),
      occurrenceMaterials: Object.fromEntries(Object.entries(instance.looks ?? {}).filter(([, l]) => l.material !== undefined).map(([id, l]) => [id, l.material])),
      process: part.process, printer: part.printer, print: part.print, mould: part.mould, machining: part.machining, casting: part.casting },
    brief: { assembly: briefFields(rootBrief), part: briefFields(partBrief) }, checks, blockers,
    ...(request.retainBoxCommand && { retainBoxCommand: true }),
    interfaces: { holePatterns, envelopes, references: doc.references },
  };
  const reads = {
    occurrence: instance.id, requirements: checks.map(r => r.id),
    interfaces: [...holePatterns.map(p => `pattern:${p.id}`), ...envelopes.map(e => `envelope:${e.id}`)].sort(),
    ...(diameterChecks && { holeFace: target.holeFace }),
    ...(target.heightParameter !== undefined && { heightParameter: target.heightParameter }),
  };
  return {
    id: request.id, holder: request.holder, occurrence: request.occurrence, feature: request.feature,
    capability: request.capability, units: request.units, frame: request.frame, dependsOn: request.dependsOn ?? [],
    ...(request.retainBoxCommand && { retainBoxCommand: true }),
    reads, writes: { occurrence: instance.id, feature: request.feature, field: dimension },
    verification: { native: 'requirements', oracle: shape.circle ? 'circular-cylinder' : 'rectangular-prism', relativeTolerance: 1e-8 },
    checks, blockers, inputs,
  };
}

function validateIdentity(value: unknown): value is TaskIdentity {
  return isObj(value) && only(value, ['projectId', 'documentId']) && name(value.projectId) && name(value.documentId);
}

export function compileTaskPlan(doc: StudioDoc, request: TaskPlanRequest): TaskPlan | TaskPlanError {
  if (!isObj(request) || !only(request, ['identity', 'policyRevision', 'maxTasks', 'throughSequence', 'tasks', 'protectedOccurrences'])
    || !validateIdentity(request.identity) || !name(request.policyRevision)) return error('BAD_PLAN', 'Supply a document identity and policy revision.');
  if (!Number.isSafeInteger(request.maxTasks) || request.maxTasks < 1 || request.maxTasks > MAX_TASKS
    || !Array.isArray(request.tasks) || !request.tasks.length || request.tasks.length > request.maxTasks) {
    return error('TASK_BUDGET', `Supply between 1 and ${MAX_TASKS} tasks within the plan budget.`);
  }
  if (!Number.isSafeInteger(request.throughSequence) || request.throughSequence < 0)
    return error('TASK_BUDGET', 'Supply the last admitted logical sequence for this plan.');
  const tasks = new Map<string, TaskRequest>(), owned = new Set<string>();
  for (const task of request.tasks) {
    if (!isObj(task) || !only(task, ['id', 'holder', 'occurrence', 'feature', 'capability', 'units', 'frame', 'dependsOn', 'retainBoxCommand'])
      || !name(task.id) || !name(task.holder) || !name(task.occurrence) || !name(task.feature)) return error('BAD_TASK', 'Supply task, holder, occurrence, and feature IDs.');
    if (!isTaskCapability(task.capability))
      return error('UNSUPPORTED_CAPABILITY', `${task.id} must use extrusion-height, rectangle-width, rectangle-depth, rectangle-footprint, or hole-diameter.`);
    if (Object.hasOwn(task, 'retainBoxCommand') && (task.retainBoxCommand !== true ||
        (task.capability !== 'rectangle-width' && task.capability !== 'rectangle-depth')))
      return error('BAD_TASK', 'Only scalar width or depth tasks can opt into retaining the Box command.');
    if (task.units !== 'mm') return error('WRONG_UNIT', `${task.id} must use mm.`);
    const requiredFrame = taskCapabilities[task.capability].frame;
    if (task.frame !== requiredFrame) return error('WRONG_FRAME', `${task.id} must use ${requiredFrame}.`);
    if (tasks.has(task.id)) return error('DUPLICATE_TASK', `Task ID ${task.id} is repeated.`);
    if (owned.has(task.occurrence)) return error('WRITE_CONFLICT', `More than one task writes ${task.occurrence}.`);
    const deps = task.dependsOn;
    if (deps !== undefined && (!Array.isArray(deps) || deps.length > request.maxTasks || !deps.every(name) || new Set(deps).size !== deps.length)) {
      return error('BAD_DEPENDENCY', `${task.id} must list distinct prerequisite task IDs.`);
    }
    const { id, holder, occurrence, feature, capability, units } = task;
    tasks.set(id, { id, holder, occurrence, feature, capability, units, frame: requiredFrame, dependsOn: deps,
      ...(task.retainBoxCommand === true ? { retainBoxCommand: true as const } : {}) });
    owned.add(task.occurrence);
  }
  for (const task of tasks.values()) for (const dep of task.dependsOn ?? []) {
    if (!tasks.has(dep)) return error('MISSING_DEPENDENCY', `${task.id} requires missing task ${dep}.`);
  }
  const active = new Set<string>(), ordered = new Set<string>();
  function visit(id: string): boolean {
    if (active.has(id)) return false;
    if (ordered.has(id)) return true;
    active.add(id);
    if (!(tasks.get(id)!.dependsOn ?? []).every(visit)) return false;
    active.delete(id);
    ordered.add(id);
    return true;
  }
  for (const id of tasks.keys()) if (!visit(id)) return error('DEPENDENCY_CYCLE', `The tasks contain a dependency cycle at ${id}.`);
  const coverage = checkCoverage(doc, [...tasks.values()], request.protectedOccurrences);
  if (coverage) return coverage;

  const bound: BoundTask[] = [];
  for (const id of ordered) {
    const captured = readTask(doc, tasks.get(id)!);
    if ('error' in captured) return captured;
    const { inputs, ...task } = captured;
    bound.push({ ...task, inputDigest: digestOf(inputs) });
  }
  const baselineDigest = digestOf(doc), { identity, policyRevision, maxTasks, throughSequence } = request;
  const specification = { brief: doc.brief, requirements: doc.requirements ?? [], interfaces: readInterfaces(doc.interfaces) };
  const contract = { identity, policyRevision, maxTasks, throughSequence, providerCostUsd: 0 as const, baselineDigest, specification, tasks: bound,
    ...(request.protectedOccurrences && { protectedOccurrences: request.protectedOccurrences }) };
  const specRevision = digestOf(contract);
  const plan = freeze(structuredClone({ specRevision, ...contract }));
  admitted.add(plan);
  return plan;
}

/** Reuse compares task inputs. Execution still requires a newly admitted plan on the current baseline. */
export function taskPlanImpact(plan: TaskPlan, doc: StudioDoc, identity: TaskIdentity, policyRevision: string): readonly TaskImpact[] {
  if (!isTaskPlan(plan)) {
    const tasks = (plan as TaskPlan | undefined)?.tasks;
    return Array.isArray(tasks) ? tasks.filter(t => isObj(t) && name(t.id)).map(t => ({ id: t.id, state: 'blocked', reason: 'Task plan was not admitted.' })) : [];
  }
  const foreign = !validateIdentity(identity) || plan.identity.projectId !== identity.projectId || plan.identity.documentId !== identity.documentId;
  const coverage = checkCoverage(doc, plan.tasks, plan.protectedOccurrences);
  const impacts = new Map<string, TaskImpact>();
  for (const task of plan.tasks) {
    const blocked = (reason: string): TaskImpact => ({ id: task.id, state: 'blocked', reason });
    const stale = (reason: string): TaskImpact => ({ id: task.id, state: 'stale', reason });
    let impact: TaskImpact;
    if (foreign || policyRevision !== plan.policyRevision) impact = blocked('Task authority or policy changed.');
    else if (coverage) impact = blocked(coverage.error.message);
    else {
      const current = readTask(doc, task);
      const prereqs = task.dependsOn.map(id => impacts.get(id)!);
      const blockedDep = prereqs.find(d => d.state === 'blocked'), staleDep = prereqs.find(d => d.state === 'stale');
      if ('error' in current) impact = blocked(current.error.message);
      else if (current.blockers.length) impact = blocked(current.blockers.join(', '));
      else if (blockedDep) impact = blocked(`Prerequisite ${blockedDep.id} is blocked.`);
      else if (digestOf(current.inputs) !== task.inputDigest) impact = stale('Task inputs changed.');
      else if (staleDep) impact = stale(`Prerequisite ${staleDep.id} changed.`);
      else impact = { id: task.id, state: 'current' };
    }
    impacts.set(task.id, impact);
  }
  return [...impacts.values()];
}

/** @internal Compare a task's exact contract and its prerequisite contracts with the active plan. */
export function taskScopeMatches(plan: TaskPlan, taskId: string, activePlan: TaskPlan): boolean {
  if (plan === activePlan) return true;
  if (plan.identity.projectId !== activePlan.identity.projectId || plan.identity.documentId !== activePlan.identity.documentId
    || plan.policyRevision !== activePlan.policyRevision
    || digestOf(plan.protectedOccurrences ?? []) !== digestOf(activePlan.protectedOccurrences ?? [])) return false;
  const active = new Map(activePlan.tasks.map(task => [task.id, task]));
  const same = new Map<string, boolean>();
  for (const task of plan.tasks) {
    same.set(task.id, digestOf(active.get(task.id) ?? null) === digestOf(task) && task.dependsOn.every(id => same.get(id)));
  }
  return same.get(taskId) ?? false;
}
