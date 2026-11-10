import { editDefinition, sharing } from '../assembly/definitions';
import { placedDoc, type PartInstance, type StudioDoc } from '../engine/doc';
import { hostOf } from '../engine/occurrences';
import { withParameters } from '../engine/parameters';
import { isRefusal } from '../engine/refusal';
import { reconcileRowSources } from '../engine/rowSources';
import { nestedRequirementDoc, nestedRequirementScope } from '../team/requirementScope';
import { isObj } from '../util/guards';
import { fail, json, type ChatState, type Evaluate, type ToolOutcome } from './toolKit';

export function nestedParameterPart(name: string, args: unknown): string | undefined {
  return name === 'set_parameters' && isObj(args) && typeof args.part === 'string' && args.part.includes('/') ? args.part : undefined;
}

export function nestedParameterOps(ops: unknown): string | undefined {
  if (!Array.isArray(ops)) return;
  for (const op of ops) {
    if (!isObj(op)) continue;
    const named = op.tool === 'set_parameters' || (op.tool === 'features' && isObj(op.args) && op.args.action === 'parameters');
    const part = named ? nestedParameterPart('set_parameters', op.args) : undefined;
    if (part !== undefined) return part;
  }
}

function dependencyOf(parent: StudioDoc, inst: PartInstance): string | undefined {
  const id = inst.id, definition = inst.part;
  if (![...inst.position, ...inst.rotation].every(Number.isFinite)) return 'an invalid placement';
  if (definition?.source) return 'a file-backed definition';
  if (definition && sharing(parent, definition.id).length !== 1) return 'a shared definition';
  if (definition && Object.hasOwn(parent.pendingParts ?? {}, definition.id)) return 'a pending revision';
  if (inst.pattern || parent.instancePatterns?.length || parent.instances?.some(i => i.pattern)) return 'an assembly pattern';
  if (parent.variability || inst.doc.variability) return 'assembly variants';
  if (parent.robot || inst.doc.robot || Object.keys(inst.joints ?? {}).length) return 'driven placement';
  if (parent.mates?.length) return 'an assembly mate';
  if (parent.nodes.some(node => node.kind === 'frame' && node.follows && 'part' in node.follows && hostOf(node.follows.part) === id))
    return 'a frame following the edited branch';
  const usesHousing = (doc: StudioDoc) => doc.nodes.some(node => node.kind === 'bearing' && !node.suppressed && node.housingRef && hostOf(node.housingRef.part) === id);
  if (usesHousing(parent) || parent.instances?.some(i => usesHousing(i.doc))) return 'a linked bearing housing';
  return undefined;
}

/** Replay a single value edit on a private root, then validate the rebuilt placed definition. */
export async function nestedParameterEdit(state: ChatState, part: string, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  const scope = nestedRequirementScope(state.doc, part);
  if ('error' in scope) return fail(state, scope.error);
  if (scope.leaf.doc.nodes.some(node => !node.suppressed && (node.kind === 'skeleton' || node.kind === 'frame')))
    return fail(state, `Cannot edit ${part}: frame and skeleton geometry needs a separate assembly check.`);
  const values = isObj(args.set) ? Object.entries(args.set) : [];
  if (values.length !== 1 || Object.keys(args).some(key => key !== 'set' && key !== 'response_format' && key !== 'because'))
    return fail(state, 'A nested parameter proposal sets exactly one existing parameter.');
  const [[name, value]] = values;
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail(state, `Parameter ${name} needs a finite number.`);

  const chain = [...scope.ancestors, scope.leaf], parents = [state.doc, ...scope.ancestors.map(inst => inst.doc)];
  for (const [index, inst] of chain.entries()) {
    const dependency = dependencyOf(parents[index], inst);
    if (dependency) return fail(state, `Cannot edit ${part}: ${inst.id} is governed by ${dependency}.`);
  }
  if (reconcileRowSources(state.doc, state.doc, state.rowFiles) !== state.doc)
    return fail(state, 'Review the assembly row provenance before proposing a nested parameter edit.');

  let next: StudioDoc;
  try {
    const old = scope.leaf.doc.parameters[name];
    next = withParameters(scope.leaf.doc, { [name]: value });
    if (old === value) return fail(state, `${part}: ${name} is already ${value}.`);
    for (let i = chain.length - 1; i >= 0; i--) {
      const updated = editDefinition(parents[i], chain[i].id, next);
      if ('error' in updated) return fail(state, updated.error);
      next = updated.doc;
    }
    const changed = nestedRequirementScope(next, part);
    if ('error' in changed) return fail(state, changed.error);
    // Check the authored leaf before flattening, which substitutes parameter references.
    const local = await evaluate(nestedRequirementDoc(next, changed));
    if (!local) return fail(state, `Could not validate ${part}: evaluation was superseded.`);
    if (!local.ok) return fail(state, `Could not build ${part}: ${local.error.title}. ${local.error.hint}`, { detail: local.error.detail });
    if (!local.bodies.length) return fail(state, `Could not build ${part}: the leaf has no body.`);
    const placed = await evaluate(placedDoc(changed.host, next));
    if (!placed) return fail(state, `Could not validate the placement of ${part}: evaluation was superseded.`);
    if (!placed.ok) return fail(state, `Could not build the placement of ${part}: ${placed.error.title}. ${placed.error.hint}`, { detail: placed.error.detail });
    if (!placed.bodies.length) return fail(state, `Could not build the placement of ${part}: the host has no body.`);
    const did = `${part}: ${name} ${old} → ${value}`;
    return { state: { ...state, doc: next }, content: json({ ok: true, part, did }), changed: true, isError: false, summary: did };
  } catch (error) {
    if (isRefusal(error)) return fail(state, `${part}: ${error.message}`);
    throw error;
  }
}

/** The same scoped results the inspector and MCP expose. Root checks keep their existing contract. */
export async function nestedParameterChecks(before: StudioDoc, after: StudioDoc, part: string, evaluate: Evaluate) {
  const scope = nestedRequirementScope(before, part);
  if ('error' in scope) return;
  const requirements = scope.leaf.doc.requirements;
  if (requirements === undefined || (Array.isArray(requirements) && !requirements.length)) return;
  const { requirementEvidenceOf } = await import('./requirementEvidence');
  const old = await requirementEvidenceOf(before, part, evaluate), next = await requirementEvidenceOf(after, part, evaluate);
  if ('error' in old || 'error' in next) return { summary: `${part} local checks unavailable`, hardChanged: [], needsReview: true };
  const verdicts = (report: typeof old) => new Map(report.evidence.flatMap(row => row.requirement
    ? [[row.requirement.id, row.result.status === 'ok' && row.freshness.state === 'current' ? row.result.verdict ?? 'unknown' : 'unknown'] as const]
    : []));
  const counts = (outcomes: ReturnType<typeof verdicts>) => {
    const tally = { pass: 0, fail: 0, unknown: 0 };
    for (const verdict of outcomes.values()) tally[verdict]++;
    return `${tally.pass}/${tally.fail}/${tally.unknown}`;
  };
  const a = verdicts(old), b = verdicts(next);
  const hard = requirements.filter(req => req.hard);
  const hardChanged = hard.filter(req => a.get(req.id) !== b.get(req.id)).map(req => `${part}:${req.id}`);
  const unverified = (verdict: string | undefined) => verdict === undefined || verdict === 'unknown';
  const needsReview = hard.some(req => unverified(a.get(req.id)) || unverified(b.get(req.id)));
  return { summary: `${part} local checks ${counts(a)} → ${counts(b)}`, hardChanged, needsReview };
}
