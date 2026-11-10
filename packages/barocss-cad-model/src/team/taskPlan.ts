// D584: bind a bounded part task to the document and its authored design contract.
import { briefGaps, readBrief } from '../chat/brief';
import { unitAssumptions, unconfirmed } from '../chat/drafts';
import { checkNode } from '../chat/features';
import { checkRequirement, meets } from '../chat/spec';
import { bodyKey, type BodyRef, type PartInstance, type StudioDoc } from '../engine/doc';
import { BRIEF_FIELDS, type Brief } from '../engine/schema/brief';
import type { Requirement } from '../engine/schema/spec';
import { digestOf } from '../util/digest';
import { isObj, isVec3 } from '../util/guards';
import { readInterfaces, type Interfaces } from './interfaces';

interface TaskIdentity { readonly projectId: string; readonly documentId: string }
export interface TaskRequest {
  readonly id: string;
  readonly holder: string;
  readonly occurrence: string;
  readonly feature: string;
  readonly capability: 'extrusion-height' | 'rectangle-width';
  readonly units: 'mm';
  readonly frame: 'part-local-z' | 'part-local-x';
  readonly dependsOn?: readonly string[];
}
export interface TaskPlanRequest {
  readonly identity: TaskIdentity;
  readonly policyRevision: string;
  readonly maxTasks: number;
  readonly throughSequence: number;
  readonly tasks: readonly TaskRequest[];
}
export interface TaskPlanError { error: { code: string; message: string } }
export interface BoundTask extends TaskRequest {
  readonly dependsOn: readonly string[];
  readonly inputDigest: string;
  readonly reads: Readonly<{ occurrence: string; requirements: readonly string[]; interfaces: readonly string[] }>;
  readonly writes: Readonly<{ occurrence: string; feature: string; field: 'height' | 'width' }>;
  readonly verification: Readonly<{ native: 'requirements'; oracle: 'rectangular-prism'; relativeTolerance: number }>;
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
}

/** The only authored change allowed by the local extrusion-height task. */
export function taskHeightEdit(doc: StudioDoc, instance: PartInstance, index: number, height: number): { doc: StudioDoc; local: StudioDoc } {
  const local = { ...instance.doc, nodes: instance.doc.nodes.map((node, at) => at === index ? { ...node, height } : node) };
  return { local, doc: { ...doc, instances: doc.instances!.map(part => part.id === instance.id ? { ...part, doc: local } : part) } };
}
export interface TaskShape {
  minX: number; minY: number; width: number; depth: number;
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
const xy = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(finite);
const only = (value: object, keys: readonly string[]) => (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  && Reflect.ownKeys(value).every(key => typeof key === 'string' && keys.includes(key)
    && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, 'value'));
const byId = <T extends { id: string }>(a: T, b: T) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const featureId = (id: unknown): id is string => typeof id === 'string' && /^n(?:0|[1-9]\d*)$/.test(id);
function freeze<T>(value: T): T {
  if (isObj(value) || Array.isArray(value)) {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

export function taskTarget(doc: StudioDoc, task: Pick<TaskRequest, 'occurrence' | 'feature'> & Partial<Pick<TaskRequest, 'capability'>>):
  { instance: PartInstance; index: number; shape: TaskShape; height: number; value: number } | TaskPlanError {
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
  const widthTask = task.capability === 'rectangle-width', feature = widthTask ? sketch : extrusion;
  if (!featureId(task.feature) || nodes.filter(n => n.id === task.feature).length !== 1 || feature?.id !== task.feature) {
    return error('WRONG_TARGET', `${instance.id}/${task.feature} must name the authored ${widthTask ? 'rectangle sketch' : 'extrusion'}.`);
  }
  if ((nodes.length !== 2 && nodes.length !== 3) || nodes.some(n => !featureId(n.id) || n.suppressed || n.held)
    || new Set(nodes.map(n => n.id)).size !== nodes.length
    || sketch?.kind !== 'sketch' || sketch.profile !== 'rectangle' || !xy(sketch.min) || !xy(sketch.max)
    || sketch.association || sketch.plane || sketch.regions?.length || sketch.holes?.length || sketch.outline || sketch.on
    || extrusion.kind !== 'extrude' || extrusion.sketch !== 0 || !positive(extrusion.height)
    || (extrusion.from !== undefined && extrusion.from !== 0) || (extrusion.draft !== undefined && extrusion.draft !== 0)) {
    return error('UNSUPPORTED_PROFILE', `${instance.id} needs a plain rectangle with a positive literal extrusion along local +Z.`);
  }
  const [minX, minY] = sketch.min, [maxX, maxY] = sketch.max;
  if (!finite(minX) || !finite(minY) || !finite(maxX) || !finite(maxY)) {
    return error('UNSUPPORTED_PROFILE', `${instance.id} needs literal rectangle dimensions.`);
  }
  const shape: TaskShape = { minX, minY, width: maxX - minX, depth: maxY - minY };
  if (!positive(shape.width) || !positive(shape.depth) || !positive(shape.width * shape.depth * extrusion.height)) {
    return error('UNSUPPORTED_PROFILE', `${instance.id} has nonfinite volume.`);
  }
  if (widthTask && hole) return error('UNSUPPORTED_PROFILE', `${instance.id} needs a solid rectangle without holes for a width task.`);
  if (hole && (hole.kind !== 'hole' || hole.parent.node !== 1 || hole.parent.side !== 'solid'
    || !xy(hole.center) || !positive(hole.radius) || (hole.axis !== undefined && hole.axis !== 'z')
    || hole.depth !== undefined || hole.face || hole.pattern || hole.countersink !== undefined || hole.csk !== undefined || hole.thread
    || hole.center[0] - hole.radius <= minX || hole.center[0] + hole.radius >= maxX
    || hole.center[1] - hole.radius <= minY || hole.center[1] + hole.radius >= maxY)) {
    return error('UNSUPPORTED_PROFILE', `${instance.id} supports only one ordinary through hole inside its rectangle.`);
  }
  if (hole) shape.hole = { x: Number(hole.center[0]), y: Number(hole.center[1]), radius: Number(hole.radius) };
  const leaf: BodyRef = { node: nodes.length - 1, side: 'solid' };
  const key = bodyKey(leaf, nodes);
  if (Object.entries(part.outputs).some(([id, ref]) => id !== key || ref.node !== leaf.node || ref.side !== leaf.side)) {
    return error('UNSUPPORTED_PROFILE', `${instance.id} must expose its final solid as the only output.`);
  }
  return { instance, index: widthTask ? 0 : 1, shape, height: extrusion.height, value: widthTask ? shape.width : extrusion.height };
}

/** Reconstruct the one authored change and the existing tool operation that produces it. */
export function taskDimensionEdit(doc: StudioDoc, task: BoundTask, target: Exclude<ReturnType<typeof taskTarget>, TaskPlanError>, value: number) {
  const { instance, index, shape } = target;
  if (!positive(value) || value === target.value) return error('TASK_VALUE', 'The task must change its admitted dimension to a positive finite value in mm.');
  if (task.writes.field === 'height') return { ...taskHeightEdit(doc, instance, index, value),
    args: { index, values: { h: value } }, shape, height: value };
  const sketch = instance.doc.nodes[index];
  const maxX = shape.minX + value, width = maxX - shape.minX;
  if (sketch.kind !== 'sketch' || sketch.profile !== 'rectangle' || !positive(width) || width === shape.width
    || shape.minX + width !== maxX || !positive(width * shape.depth * target.height)
    || Math.abs(width - value) > task.verification.relativeTolerance * Math.max(1, value))
    return error('TASK_VALUE', 'The requested width cannot be represented by this rectangle.');
  const outsideTolerance = task.checks.find(req => req.hard && req.check.query.fn === 'bbox'
    && req.check.query.axis === 'x' && !meets(width, req.check).ok);
  if (outsideTolerance) return error('TASK_REQUIRED_CHECK', `The authored width does not satisfy ${outsideTolerance.id}.`);
  const feature = { ...sketch, max: [maxX, sketch.max[1]] as typeof sketch.max };
  const reason = checkNode(feature, [], instance.doc.parameters);
  if (reason) return error('UNSUPPORTED_PROFILE', reason);
  const local = { ...instance.doc, nodes: instance.doc.nodes.map((node, at) => at === index ? feature : node) };
  return { local, doc: { ...doc, instances: doc.instances!.map(part => part.id === instance.id ? { ...part, doc: local } : part) },
    args: { index, feature }, shape: { ...shape, width }, height: target.height };
}

const briefFields = (brief: Brief | undefined) => Object.fromEntries(BRIEF_FIELDS
  .filter(key => key !== 'notes' && key !== 'finish').map(key => [key, brief?.[key]]));
const pendingDrafts = (doc: StudioDoc, scope: string) => [
  ...unconfirmed(doc).map(d => `${scope}:draft:${d.key}`),
  ...unitAssumptions(doc).map(d => `${scope}:draft-units:${d}`),
];
const hardChecks = (doc: StudioDoc) => (doc.requirements ?? []).filter(r => r.hard);
function checkCoverage(doc: StudioDoc, tasks: readonly TaskRequest[]): TaskPlanError | undefined {
  if (hardChecks(doc).length) return error('UNCOVERED_REQUIREMENT', 'Assembly hard requirements are outside this profile.');
  const owned = new Set(tasks.map(t => t.occurrence));
  const walk = (parent: StudioDoc, top = true): string | undefined => {
    for (const i of parent.instances ?? []) {
      if ((!top || !owned.has(i.id)) && hardChecks(i.doc).length) return i.id;
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
  const widthTask = request.capability === 'rectangle-width', axis = widthTask ? 'x' : 'z', dimension = widthTask ? 'width' : 'height';
  let hardAxis = false, low = 0, high = Infinity;
  for (const req of checks) {
    const invalid = checkRequirement(req);
    if (invalid) return error('BAD_REQUIREMENT', invalid);
    const p = req.check;
    if (p.query.fn !== 'bbox' || p.query.body !== undefined || p.unit !== 'mm') {
      if (req.hard) return error('UNSUPPORTED_CHECK', `${req.id} must check a part bounding-box axis in mm.`);
      continue;
    }
    if ((p.tol !== undefined && p.tol < 0) || (p.op === 'between' && (p.min! > p.max! || (p.tol ?? 0) !== 0))) {
      return error('BAD_REQUIREMENT', `${req.id} has an invalid tolerance or range.`);
    }
    if (!req.hard) continue;
    if (p.query.axis === axis) hardAxis = true;
    if (req.basis === 'assumed' || req.basis === 'ambiguous') {
      blockers.push(`requirement:${req.id}:${req.basis}`);
      continue;
    }
    if (p.query.axis !== axis) {
      const fixed = p.query.axis === 'x' ? shape.width : p.query.axis === 'y' ? shape.depth : target.height;
      if (!meets(fixed, p).ok) {
        return error('CONFLICTING_REQUIREMENT', `${req.id} cannot be met by a ${dimension} edit.`);
      }
      continue;
    }
    const tolerance = (p.tol ?? 0) + 1e-9 * Math.max(1, Math.abs(p.value ?? 0));
    if (p.op === 'between') { low = Math.max(low, p.min! - 1e-9); high = Math.min(high, p.max! + 1e-9); }
    if (p.op === '==' || p.op === '>=') low = Math.max(low, p.value! - tolerance);
    if (p.op === '==' || p.op === '<=') high = Math.min(high, p.value! + tolerance);
  }
  if (!hardAxis) return error('MISSING_REQUIRED_CHECK', `${instance.id} needs a hard check of local ${axis.toUpperCase()} ${dimension} in mm.`);
  if (low > high || high <= 0) return error('CONFLICTING_REQUIREMENT', `${instance.id} has incompatible ${dimension} requirements.`);

  const interfaces = taskInterfaces(doc);
  if ('error' in interfaces) return interfaces;
  const holePatterns = interfaces.holePatterns.filter(p => p.parts.includes(instance.id)).sort(byId);
  const envelopes = interfaces.envelopes.filter(e => e.part === instance.id).sort(byId);
  const inputs = {
    target: { id: instance.id, position: instance.position, rotation: instance.rotation },
    model: { units: part.units, nodes: part.nodes, parameters: part.parameters, outputs: part.outputs, references: part.references,
      materials: Object.fromEntries(Object.entries(part.bodies ?? {}).filter(([, l]) => l.material !== undefined).map(([id, l]) => [id, l.material])),
      occurrenceMaterials: Object.fromEntries(Object.entries(instance.looks ?? {}).filter(([, l]) => l.material !== undefined).map(([id, l]) => [id, l.material])),
      process: part.process, printer: part.printer, print: part.print, mould: part.mould, machining: part.machining, casting: part.casting },
    brief: { assembly: briefFields(rootBrief), part: briefFields(partBrief) }, checks, blockers,
    interfaces: { holePatterns, envelopes, references: doc.references },
  };
  const reads = {
    occurrence: instance.id, requirements: checks.map(r => r.id),
    interfaces: [...holePatterns.map(p => `pattern:${p.id}`), ...envelopes.map(e => `envelope:${e.id}`)].sort(),
  };
  return {
    id: request.id, holder: request.holder, occurrence: request.occurrence, feature: request.feature,
    capability: request.capability, units: request.units, frame: request.frame, dependsOn: request.dependsOn ?? [],
    reads, writes: { occurrence: instance.id, feature: request.feature, field: dimension },
    verification: { native: 'requirements', oracle: 'rectangular-prism', relativeTolerance: 1e-8 },
    checks, blockers, inputs,
  };
}

function validateIdentity(value: unknown): value is TaskIdentity {
  return isObj(value) && only(value, ['projectId', 'documentId']) && name(value.projectId) && name(value.documentId);
}

export function compileTaskPlan(doc: StudioDoc, request: TaskPlanRequest): TaskPlan | TaskPlanError {
  if (!isObj(request) || !only(request, ['identity', 'policyRevision', 'maxTasks', 'throughSequence', 'tasks'])
    || !validateIdentity(request.identity) || !name(request.policyRevision)) return error('BAD_PLAN', 'Supply a document identity and policy revision.');
  if (!Number.isSafeInteger(request.maxTasks) || request.maxTasks < 1 || request.maxTasks > MAX_TASKS
    || !Array.isArray(request.tasks) || !request.tasks.length || request.tasks.length > request.maxTasks) {
    return error('TASK_BUDGET', `Supply between 1 and ${MAX_TASKS} tasks within the plan budget.`);
  }
  if (!Number.isSafeInteger(request.throughSequence) || request.throughSequence < 0)
    return error('TASK_BUDGET', 'Supply the last admitted logical sequence for this plan.');
  const tasks = new Map<string, TaskRequest>(), owned = new Set<string>();
  for (const task of request.tasks) {
    if (!isObj(task) || !only(task, ['id', 'holder', 'occurrence', 'feature', 'capability', 'units', 'frame', 'dependsOn'])
      || !name(task.id) || !name(task.holder) || !name(task.occurrence) || !name(task.feature)) return error('BAD_TASK', 'Supply task, holder, occurrence, and feature IDs.');
    if (task.capability !== 'extrusion-height' && task.capability !== 'rectangle-width')
      return error('UNSUPPORTED_CAPABILITY', `${task.id} must use extrusion-height or rectangle-width.`);
    if (task.units !== 'mm') return error('WRONG_UNIT', `${task.id} must use mm.`);
    const requiredFrame = task.capability === 'rectangle-width' ? 'part-local-x' : 'part-local-z';
    if (task.frame !== requiredFrame) return error('WRONG_FRAME', `${task.id} must use ${requiredFrame}.`);
    if (tasks.has(task.id)) return error('DUPLICATE_TASK', `Task ID ${task.id} is repeated.`);
    if (owned.has(task.occurrence)) return error('WRITE_CONFLICT', `More than one task writes ${task.occurrence}.`);
    const deps = task.dependsOn;
    if (deps !== undefined && (!Array.isArray(deps) || deps.length > request.maxTasks || !deps.every(name) || new Set(deps).size !== deps.length)) {
      return error('BAD_DEPENDENCY', `${task.id} must list distinct prerequisite task IDs.`);
    }
    const { id, holder, occurrence, feature, capability, units } = task;
    tasks.set(id, { id, holder, occurrence, feature, capability, units, frame: requiredFrame, dependsOn: deps });
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
  const coverage = checkCoverage(doc, [...tasks.values()]);
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
  const contract = { identity, policyRevision, maxTasks, throughSequence, providerCostUsd: 0 as const, baselineDigest, specification, tasks: bound };
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
  const coverage = checkCoverage(doc, plan.tasks);
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
    || plan.policyRevision !== activePlan.policyRevision) return false;
  const active = new Map(activePlan.tasks.map(task => [task.id, task]));
  const same = new Map<string, boolean>();
  for (const task of plan.tasks) {
    same.set(task.id, digestOf(active.get(task.id) ?? null) === digestOf(task) && task.dependsOn.every(id => same.get(id)));
  }
  return same.get(taskId) ?? false;
}
