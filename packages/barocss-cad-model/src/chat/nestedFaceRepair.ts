import type { StudioDoc } from '../engine/doc';
import type { Op } from '../engine/schema/proposals';
import { featureId } from '../engine/ids';
import { nestedRequirementScope } from '../team/requirementScope';
import { freshnessOf } from '../team/freshness';
import { digestOf, requirementEvidenceRevision } from '../util/digest';
import { isObj } from '../util/guards';
import { canonical } from '../util/revision';
import { editNestedDefinition, nestedDefinitionEditProblem } from './nestedParameterProposal';
import { missingNamedEntityMessage } from './names';
import { isCurrentRequirement, requirementEvidenceOf, type RequirementEvidence } from './requirementEvidence';
import { fail, json, type PartRun, type ToolOutcome } from './toolKit';

export interface NestedFaceRepair {
  part: string; revision: string; requirement: string; criterion: string; from: string; to: string;
  source: { version: string; evidenceRevision: string; sha256: string };
}
type Scope = Exclude<ReturnType<typeof nestedRequirementScope>, { error: string }>;
const tagged = /^n\d+\.side\[([A-Za-z0-9_-]+)\]$/;
const sha = /^[0-9a-f]{64}$/;
const refusal = 'The selected reference has no verified tag-only replacement on this occurrence.';
const rowOf = (report: RequirementEvidence, id: string) => report.evidence.find(row => row.requirement?.id === id);

function prism(doc: StudioDoc) {
  const [sketch, extrude] = doc.nodes;
  if (doc.nodes.length !== 2 || sketch?.kind !== 'sketch' || sketch.profile !== 'polygon' || sketch.on
    || sketch.holes?.length || sketch.regions?.length || extrude?.kind !== 'extrude' || extrude.sketch !== 0 || extrude.suppressed) return;
  const tags = sketch.sideTags?.outer;
  if (!tags || tags.length !== sketch.points.length || new Set(tags).size !== tags.length) return;
  return { sketch, extrude, tags, id: featureId(doc.nodes, 1) };
}
const withTags = (doc: StudioDoc, p: NonNullable<ReturnType<typeof prism>>, outer: string[]) =>
  ({ ...doc, nodes: [{ ...p.sketch, sideTags: { ...p.sketch.sideTags, outer } }, p.extrude] });
const placement = (scope: Scope) => [...scope.ancestors, scope.leaf].map(i => [i.id, i.name, i.part?.id, i.part?.source, i.position, i.rotation]);

/** Find the tag-only edit on the same occurrence. The actual proposal repeats the native checks. */
export function identifyNestedFaceRepair(approved: StudioDoc, doc: StudioDoc, evidence: RequirementEvidence,
  requirement: string, source: NestedFaceRepair['source']): NestedFaceRepair | null {
  const part = evidence.part, old = nestedRequirementScope(approved, part), current = nestedRequirementScope(doc, part);
  if ('error' in old || 'error' in current || canonical(placement(old)) !== canonical(placement(current))) return null;
  if (requirementEvidenceRevision(approved) !== source.evidenceRevision || evidence.revision !== source.evidenceRevision
    || nestedDefinitionEditProblem(doc, current)) return null;
  const a = prism(old.leaf.doc), b = prism(current.leaf.doc);
  if (!a || !b || a.tags.length !== b.tags.length || canonical(withTags(current.leaf.doc, b, a.tags)) !== canonical(old.leaf.doc)) return null;
  const edits = a.tags.flatMap((tag, i) => tag === b.tags[i] ? [] : [[tag, b.tags[i]]]);
  if (edits.length !== 1) return null;
  const [from, to] = edits[0].map(tag => `${a.id}.side[${tag}]`);
  const row = rowOf(evidence, requirement);
  if (!row?.requirement || !isCurrentRequirement(row, part, source.evidenceRevision) || row.result.verdict !== 'pass') return null;
  const query = row.requirement.check.query;
  if (query.fn !== 'distance_between' || ![query.a, query.b].includes(from) || !tagged.test(from) || !tagged.test(to)) return null;
  return { part, revision: requirementEvidenceRevision(doc), requirement, criterion: digestOf(row.requirement), from, to, source };
}

function valid(value: unknown): value is NestedFaceRepair {
  return isObj(value) && typeof value.part === 'string' && value.part.includes('/') && typeof value.requirement === 'string'
    && typeof value.revision === 'string' && sha.test(value.revision) && typeof value.criterion === 'string' && sha.test(value.criterion)
    && typeof value.from === 'string' && typeof value.to === 'string' && value.from !== value.to && tagged.test(value.from) && tagged.test(value.to)
    && isObj(value.source) && typeof value.source.version === 'string' && /^v[0-9a-f]{16}$/.test(value.source.version)
    && typeof value.source.sha256 === 'string' && sha.test(value.source.sha256)
    && typeof value.source.evidenceRevision === 'string' && sha.test(value.source.evidenceRevision);
}

export function hasNestedFaceRepair(ops: unknown): boolean {
  return Array.isArray(ops) && ops.some(op => isObj(op) && op.tool === 'set_requirements' && isObj(op.args) && Object.hasOwn(op.args, 'faceRepair'));
}

export function nestedFaceRepairOp(repair: NestedFaceRepair): Op {
  return { tool: 'set_requirements', args: { faceRepair: repair } };
}

function repairCriterion(scope: Scope, repair: NestedFaceRepair) {
  const reqs = scope.leaf.doc.requirements ?? [];
  const rows = reqs.filter(req => req.id === repair.requirement);
  const [requirement] = rows;
  if (rows.length !== 1 || digestOf(requirement) !== repair.criterion) return null;
  const query = requirement.check.query, { from, to } = repair;
  if (query.fn !== 'distance_between' || (query.a === from) === (query.b === from) || query.a === to || query.b === to) return null;
  const selected = { ...query, [query.a === from ? 'a' : 'b']: to };
  const changed = { ...requirement, check: { ...requirement.check, query: selected } };
  return { requirement, leaf: { ...scope.leaf.doc, requirements: reqs.map(req => req === requirement ? changed : req) } };
}

/** Match a saved acceptance to exactly the same authored edit used by proposal replay. */
export function isNestedFaceRepairEdit(before: StudioDoc, after: StudioDoc, repair: NestedFaceRepair): boolean {
  if (!valid(repair) || requirementEvidenceRevision(before) !== repair.revision) return false;
  const scope = nestedRequirementScope(before, repair.part);
  if ('error' in scope || nestedDefinitionEditProblem(before, scope)) return false;
  const criterion = repairCriterion(scope, repair);
  if (!criterion) return false;
  const next = editNestedDefinition(before, scope, criterion.leaf);
  return !('error' in next) && requirementEvidenceRevision(next.doc) === requirementEvidenceRevision(after);
}

/** Replay only in the Studio-authored proposal flow, on the exact working revision. */
export const replayNestedFaceRepair: PartRun = async (state, tool, args, evaluate): Promise<ToolOutcome> => {
  const repair = isObj(args) ? args.faceRepair : undefined;
  if (state.partOf || tool !== 'set_requirements' || !valid(repair) || requirementEvidenceRevision(state.doc) !== repair.revision)
    return fail(state, refusal);
  const { part, from, to } = repair, scope = nestedRequirementScope(state.doc, part);
  if ('error' in scope || nestedDefinitionEditProblem(state.doc, scope)) return fail(state, refusal);
  const leaf = scope.leaf.doc, p = prism(leaf), criterion = repairCriterion(scope, repair);
  if (!p || !criterion) return fail(state, refusal);
  const { requirement } = criterion;
  const oldTag = tagged.exec(from)![1], newTag = tagged.exec(to)![1];
  if (from !== `${p.id}.side[${oldTag}]` || to !== `${p.id}.side[${newTag}]` || p.tags.includes(oldTag) || !p.tags.includes(newTag))
    return fail(state, refusal);

  // The original named geometry is reconstructed with the inverse tag change only.
  const inverse = editNestedDefinition(state.doc, scope, withTags(leaf, p, p.tags.map(tag => tag === newTag ? oldTag : tag)));
  if ('error' in inverse) return fail(state, inverse.error);
  const original = await requirementEvidenceOf(inverse.doc, part, evaluate);
  const current = await requirementEvidenceOf(state.doc, part, evaluate, repair.revision);
  if ('error' in original || 'error' in current) return fail(state, refusal);
  const old = rowOf(original, repair.requirement), missing = rowOf(current, repair.requirement);
  if (!old || !isCurrentRequirement(old, part, original.revision) || old.result.verdict !== 'pass' ||
    missing?.result.status !== 'unsupported' || missing.result.why !== missingNamedEntityMessage(from)) return fail(state, refusal);
  const fresh = await freshnessOf(old.result, state.doc, evaluate), [change] = fresh.unresolved;
  const oldSig = old.result.fingerprint.faces?.[from];
  if (fresh.state !== 'unresolved' || fresh.unresolved.length !== 1 || change.face !== from ||
    change.why !== 'renamed' || change.candidates.length !== 1 || change.candidates[0] !== to || oldSig?.k !== 'plane' || oldSig.n)
    return fail(state, refusal);

  const next = editNestedDefinition(state.doc, scope, criterion.leaf);
  if ('error' in next) return fail(state, next.error);
  const evidence = await requirementEvidenceOf(next.doc, part, evaluate);
  if ('error' in evidence) return fail(state, refusal);
  const row = rowOf(evidence, repair.requirement), newSig = row?.result.fingerprint.faces?.[to];
  if (!row || !isCurrentRequirement(row, part, evidence.revision) || row.result.verdict !== 'pass' || row.result.number !== old.result.number ||
    canonical(oldSig) !== canonical(newSig)) return fail(state, refusal);
  const did = `${part} ${requirement.id}: ${from} → ${to} · ${row.result.number} ${requirement.check.unit ?? ''} Pass`.trim();
  return { state: { ...state, doc: next.doc }, content: json({ ok: true, did }), isError: false, changed: true, summary: did };
};
