// Explicit read-only assembly input for A9-7. Symbols survive derived spreads, never JSON Save/Open.
import { type ModelNode, type StudioDoc } from './doc';
import { placementOf } from './placement';
import type { HousingPose } from './bearingHousing';
import { bodyNodeOf } from './ids';

export interface BearingHousingRef { part: string; body: string }
/** Optional host/part-dispatch input for the existing bearing command and feature editor. */
export interface BearingAssemblyInput { root: StudioDoc; owner: string }
export interface BearingHousingTarget { part: string; doc: StudioDoc; pose: HousingPose; hidden?: boolean }
export interface BearingAssemblyContext { owner: string; ownerPose: HousingPose; targets: readonly BearingHousingTarget[] }
const contextKey = Symbol('bearingAssemblyContext');
type ContextualDoc = StudioDoc & { [contextKey]?: BearingAssemblyContext };
const basePose = (): HousingPose => ({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] });
function bad(detail: string): never { throw new Error(`[BEARING_HOUSING_REFERENCE] ${detail}`); }

export function bearingHousingRefProblem(value: unknown): string | null {
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '[BEARING_HOUSING_REFERENCE] housingRef must be {part, body}';
  const ref = value as Record<string, unknown>;
  if (Object.keys(ref).some(k => k !== 'part' && k !== 'body') || typeof ref.part !== 'string' || !ref.part.trim() || typeof ref.body !== 'string' || !/^b\d+(?:_(?:negative|positive|part\d+))?$/.test(ref.body)) return '[BEARING_HOUSING_REFERENCE] housingRef needs an existing part id and stable body key';
  return null;
}

/** Read the proposed field without a fallback to a local numeric index. */
export function bearingHousingRef(node: ModelNode): BearingHousingRef | undefined {
  if (node.kind !== 'bearing') return undefined;
  const ref = (node as ModelNode & { housingRef?: BearingHousingRef }).housingRef, problem = bearingHousingRefProblem(ref);
  if (problem) throw new Error(problem);
  if (ref && node.housing !== undefined) bad('housing and housingRef are mutually exclusive');
  return ref;
}
export const bearingContextOf = (doc: StudioDoc): BearingAssemblyContext | undefined => (doc as ContextualDoc)[contextKey];
export function withBearingContext(doc: StudioDoc, context: BearingAssemblyContext): StudioDoc {
  const out: ContextualDoc = { ...doc, [contextKey]: context }; return out;
}
export const withoutBearingContext = (doc: StudioDoc): StudioDoc => { const out: ContextualDoc = { ...doc }; delete out[contextKey]; return out; };
const withoutContext = withoutBearingContext;

const trees = new WeakMap<StudioDoc, StudioDoc>();
/** Whether any node of the document or of its immediate parts links a housing in another part (raw field, no checks). */
function linksHousing(root: StudioDoc): boolean {
  for (const n of root.nodes) if (n.kind === 'bearing' && (n as ModelNode & { housingRef?: unknown }).housingRef !== undefined) return true;
  for (const inst of root.instances ?? []) for (const n of inst.doc.nodes) if (n.kind === 'bearing' && (n as ModelNode & { housingRef?: unknown }).housingRef !== undefined) return true;
  return false;
}
/** Called after the existing row tree resolves. Each occurrence gets its own context view, only when some bearing links a
 *  housing in another part: an assembly with none keeps its document and instance identity (A9-10's resolved tree). */
export function bearingAssemblyView(root: StudioDoc): StudioDoc {
  return linksHousing(root) ? assemblyContextView(root) : root;
}
function assemblyContextView(root: StudioDoc): StudioDoc {
  if (!root.instances?.length || (bearingContextOf(root)?.owner ?? 'base') !== 'base') return root;
  const cached = trees.get(root); if (cached) return cached;
  const ids = new Set(['base']);
  const targets: BearingHousingTarget[] = [{ part: 'base', doc: withoutContext({ ...root, instances: undefined }), pose: basePose() }];
  for (const inst of root.instances) {
    if (ids.has(inst.id)) bad(`ambiguous assembly part id ${inst.id}`);
    ids.add(inst.id); targets.push({ part: inst.id, doc: withoutContext(inst.doc), pose: placementOf(inst), ...(inst.hidden ? { hidden: true } : {}) });
  }
  const out = withBearingContext({ ...root, instances: root.instances.map(inst => ({ ...inst, doc: withBearingContext(inst.doc, { owner: inst.id, ownerPose: targets.find(t => t.part === inst.id)!.pose, targets }) })) }, { owner: 'base', ownerPose: basePose(), targets });
  trees.set(root, out); trees.set(out, out);
  return out;
}
/** An isolated child draft receives the current explicit occurrence; never infer it from shared nodes. */
export function bearingPartView(child: StudioDoc, root: StudioDoc, owner: string): StudioDoc {
  // (A part draft gets its context whether or not anything links a housing yet: the draft may add the first link.)
  const context = bearingContextOf(assemblyContextView(root));
  if (!context) {
    if (!child.nodes.some(n => bearingHousingRef(n))) return child;
    bad(`part ${owner} has no current assembly context`);
  }
  const occurrence = context.targets.find(t => t.part === owner);
  if (!occurrence) {
    if (!child.nodes.some(n => bearingHousingRef(n))) return child;
    throw new Error(`[BEARING_HOUSING_SCOPE] no immediate owner occurrence ${owner}`);
  }
  return withBearingContext(child, { owner, ownerPose: occurrence.pose, targets: context.targets.map(t => t.part === owner ? { ...t, doc: withoutContext(child) } : t) });
}

/** Resolve identity only. The evaluator must still obtain and check this current body's exact Brep. */
export function bearingHousingTarget(doc: StudioDoc, ref: BearingHousingRef): BearingHousingTarget {
  const context = bearingContextOf(doc);
  if (!context) bad('the housing link needs its current assembly and owner occurrence');
  if (ref.part === context.owner) bad('use numeric housing for a body in the bearing\'s own part');
  const target = context.targets.find(t => t.part === ref.part);
  if (!target) bad(`housing part ${ref.part} no longer exists`);
  if (target.hidden) bad(`housing part ${ref.part} is hidden`);
  if (target.doc.instances?.length) throw new Error('[BEARING_HOUSING_SCOPE] a nested housing occurrence needs an explicit addressing contract');
  const body = bodyNodeOf(target.doc.nodes, ref.body);
  if (!body || target.doc.nodes[body.node].suppressed) bad(`housing body ${ref.part}/${ref.body} no longer exists`);
  return target;
}

/** The current dependency data, also used by evaluation and durable result freshness hashes. */
export function bearingDependencyKey(doc: StudioDoc): string | undefined {
  const refs = doc.nodes.flatMap(n => { const ref = bearingHousingRef(n); return ref && !n.suppressed ? [ref] : []; });
  if (!refs.length) return undefined;
  const context = bearingContextOf(doc);
  if (!context) bad('the housing link needs its current assembly and owner occurrence');
  const visiting: string[] = [], done = new Set<string>();
  const walk = (part: string, source: StudioDoc): void => {
    if (visiting.includes(part)) throw new Error(`[BEARING_HOUSING_CYCLE] ${[...visiting, part].join(' -> ')}`);
    if (done.has(part)) return;
    visiting.push(part);
    for (const node of source.nodes) {
      const ref = bearingHousingRef(node); if (!ref || node.suppressed) continue;
      const local = withBearingContext(source, { ...context, owner: part });
      const target = bearingHousingTarget(local, ref);
      walk(target.part, target.part === context.owner ? doc : target.doc);
    }
    visiting.pop(); done.add(part);
  };
  walk(context.owner, doc);
  const relevant = [...done].filter(p => p !== context.owner).map(part => {
    const target = context.targets.find(t => t.part === part)!;
    return { part, doc: target.doc, pose: target.pose, hidden: target.hidden };
  });
  return JSON.stringify({ owner: context.owner, ownerPose: context.ownerPose, refs, targets: relevant });
}

/** Shape validation only; current identity and exact geometry are checked during evaluation. */
export function documentBearingHousingProblem(value: unknown, path = ''): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const doc = value as Record<string, unknown>;
  for (const [i, raw] of (Array.isArray(doc.nodes) ? doc.nodes : []).entries()) {
    if (!raw || typeof raw !== 'object' || raw.kind !== 'bearing') continue;
    const problem = bearingHousingRefProblem(raw.housingRef);
    if (problem) return `${problem} (${path}nodes[${i}])`;
    if (raw.housingRef !== undefined && raw.housing !== undefined) return `[BEARING_HOUSING_REFERENCE] ${path}nodes[${i}]: housing and housingRef are mutually exclusive`;
  }
  for (const [i, inst] of (Array.isArray(doc.instances) ? doc.instances : []).entries()) {
    const problem = documentBearingHousingProblem(inst?.doc, `${path}instances[${i}].doc.`); if (problem) return problem;
  }
  if (doc.pendingParts && typeof doc.pendingParts === 'object') for (const [id, pending] of Object.entries(doc.pendingParts)) {
    const problem = documentBearingHousingProblem(pending?.doc, `${path}pendingParts[${JSON.stringify(id)}].doc.`); if (problem) return problem;
  }
  return null;
}
