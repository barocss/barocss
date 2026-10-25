// The chat's tools: the studio's own commands (validated by the same `available` / `fields` rules as
// the HUD and built by the same `build`), raw feature nodes for what has no command (sketched profiles,
// revolves, sweeps, lofts), the feature editor's fields, delete, measure, select and a part summary.
// Each change is evaluated by the engine before it is kept; the result is what the model reads back.
import { type DocPlane, type PartInstance } from '../engine/doc';
type Vec3T = [number, number, number];
import { CAGE_TOOL_NAMES, runCageTool } from './cageTools';
import { DRAWING_TOOL_NAMES, runDrawingTool } from './drawing';
import { OUTPUT_TOOL_NAMES } from './outputDefinitions';
import { resolveShopRows, resolveShopTree, restoreAuthoredShopRows } from '../engine/shopRows';
import { friendly } from '../engine/errors';
import { personRowsRefusal, reconcileRowSources } from '../engine/rowSources';
import { v1Call, viaV2 } from './groups';
import { ROBOT_TOOL_NAMES, runRobotTool } from './robot';
import { BRIEF_TOOL_NAMES, runBriefTool } from './brief';
import { QUESTION_TOOL_NAMES, runQuestionTool } from './questions';
import { DRAFT_TOOL_NAMES, runDraftTool } from './drafts';
import { runStandardsTool, STANDARDS_TOOL_NAMES } from '../standards/provenance';
import { datumPlane, readReferences, REFERENCE_TOOL_NAMES, referenceNameIn, runReferenceTool } from './references';
import { ASSEMBLY_TOOL_NAMES, runAssemblyTool } from './assembly';
import { solveDoc } from '../assembly/edit';
import { validateFastenedOptions } from '../assembly/connectors';
import { resolveNames, type NameSelection } from './names';
import { approvalOf } from './proposals';
import type { Op } from '../engine/schema/proposals';
import { newPolicy } from './spec';
import { checkPartEdit, refreshFollowed } from '../frames/skeleton';
import { type ChatState, type Evaluate, type ToolOutcome, type PartHandler, setCall, json, accept, fail, subToolResult } from './toolKit';
import { QUERY_HANDLERS } from './part/query';
import { IMAGE_HANDLERS } from './part/image';
import { FEATURE_HANDLERS } from './part/features';
import { REQUIREMENT_HANDLERS } from './part/requirements';
import { VIEW_HANDLERS } from './part/views';
import { HISTORY_HANDLERS, moveOpsWith } from './part/history';
import { VERSION_HANDLERS } from '../versions/tools';
import { ASSEMBLY_CHANGES, PROPOSAL_HANDLERS, acceptProposalWith, autonomy, changesPart, previewProposalWith, proposalNeededAtL2, proposalOfWith, rebaseProposalWith, type Decider } from './part/proposals';
import { BATCHABLE, MUTATORS, PART_SCOPED, describe, unknownArguments } from './toolDefinitions';
import { isObj, isVec3 } from '../util/guards';
import { firstProblem, isRefusal } from '../engine/refusal';
import { REFERENCE_CODES } from '../engine/schema/references';
// ./outputs is loaded on first use: it reaches team/bundle → baseline → assembly → parts, which import this
// module, so a static import closes a cycle that leaves `commands` undefined here at load.
let outputsModule: Promise<typeof import('./outputs')> | undefined;
export { resolveNames, type NameSelection };
// (R3: the names that moved, re-exported so `chat/tools` resolves as it did.)
export { describeBodies, type ChatState, type Evaluate, type ToolOutcome } from './toolKit';
export { INFLATE, layerSketches, surfaceAt } from './part/image';
export { CHAT_COMMANDS, COMMAND_DOCS } from './part/features';
export { BATCHABLE_TOOLS, isMutator, featureKinds, takesArgument, unknownArguments, TOOLS, SYSTEM_PROMPT } from './toolDefinitions';
export { agentMayNotAccept, autonomy, leaveOutClosure, partialDoc, proposalParts, toggledLeaveOut, type Decider, type ProposalPart } from './part/proposals';
/** Every moved handler, by v1 tool name (R3): built once, at load. */
const PART_HANDLERS: Readonly<Record<string, PartHandler>> = { ...QUERY_HANDLERS, ...IMAGE_HANDLERS, ...FEATURE_HANDLERS, ...REQUIREMENT_HANDLERS, ...VIEW_HANDLERS, ...HISTORY_HANDLERS, ...VERSION_HANDLERS, ...PROPOSAL_HANDLERS };

// (R3e: the proposal functions the studio and the team code call, with their signatures as they were; the work is in
// chat/part/proposals.ts and chat/part/history.ts, this module's runner passed in.)
/** A proposal's change worked out on a copy (A4.2): see proposalOfWith. */
export function proposalOf(state: ChatState, ops: unknown, evaluate: Evaluate) { return proposalOfWith(runToolCounted, state, ops, evaluate); }
/** A proposal accepted (A4.2, A4.3): see acceptProposalWith. */
export function acceptProposal(state: ChatState, id: string, evaluate: Evaluate, o: { by?: Decider; leaveOut?: readonly string[] } = {}) { return acceptProposalWith(runToolCounted, state, id, evaluate, o); }
/** A stale proposal made again on the part as it is now (D41): see rebaseProposalWith. */
export function rebaseProposal(state: ChatState, id: string, evaluate: Evaluate, by: Decider = { agent: 'user' }) { return rebaseProposalWith(runToolCounted, state, id, evaluate, by); }
/** Ops made on one state replayed one at a time on another (O133): see moveOpsWith. */
export function moveOps(state: ChatState, ops: readonly Op[], orders: readonly (readonly string[])[], evaluate: Evaluate, ids: Map<string, string> = new Map(), made?: readonly (readonly string[])[]) { return moveOpsWith(runToolCounted, state, ops, orders, evaluate, ids, made); }
/** The bodies a proposal would leave (its ghost preview), or its refusal: see previewProposalWith. */
export function previewProposal(state: ChatState, id: string, evaluate: Evaluate) { return previewProposalWith(runToolCounted, state, id, evaluate); }

/** A placed part as a part tool runs on it (A9-2, FRf2): its shop rows resolved from the assembly's, an evaluation that
 *  restores the part's own rows first, and its bodies (R3e: written once for both of the dispatcher's paths). */
async function placedPart(state: ChatState, inst: PartInstance, evaluate: Evaluate) {
  const shop = { ...resolveShopRows(inst.doc, state.doc), doc: resolveShopTree(inst.doc, state.doc, inst.id) };
  const partEvaluate: Evaluate = async d => {
    const authored = restoreAuthoredShopRows(d, shop.doc);
    return 'error' in authored ? { ok: false, revision: 0, error: friendly(authored.error), wallTime: 0 } : evaluate(resolveShopTree(authored.doc, state.doc, inst.id));
  };
  const r = await partEvaluate(shop.doc);
  return { shop, partEvaluate, bodies: r?.ok ? r.bodies : [] };
}
/** A placed part's reply: the part's id and the shop rows it was given, before the tool's own. */
const partReply = (content: string, inst: PartInstance, shop: { provenance: unknown }) => content.replace(/^\{/, `{"part":${JSON.stringify(inst.id)},"shopRows":${JSON.stringify(shop.provenance)},`);

/**
 * Runs one tool call against the turn's state. Assembly tools act on the instances and mates; a part
 * tool with `part` set to an instance id builds that part (in its own coordinates), and the assembly is
 * re-solved after it, as after a change of the base part.
 */
export async function runTool(state: ChatState, name: string, input: unknown, evaluate: Evaluate): Promise<ToolOutcome> {
  // (A consolidated tool, A5.3: the v1 call it stands for, under the same gates.)
  [name, input] = viaV2(name, input);
  const v1 = v1Call(name, input);
  if (v1) { if ('error' in v1) return fail(state, v1.error); name = v1.name; input = v1.args; }
  // (Autonomy L1: the agent proposes, the user changes the part, D41.)
  if (autonomy() === 1 && changesPart(name, input)) return fail(state, 'At autonomy L1 the agent only proposes: make this change with propose, and the user accepts it in the studio.');
  // (Every call counted; the policy rides on the state the call leaves.)
  const policy = { ...(state.policy ?? newPolicy()) }; policy.calls++;
  const out = await runToolCounted({ ...state, policy }, name, input, evaluate, true);
  // (Assemblies, mates, drawings and locked parts always need the user: an agent proposes such a change, D41.)
  if (!out.isError && out.changed && name !== 'propose' && name !== 'accept_proposal') {
    const needs = approvalOf(state.doc, out.state.doc);
    if (needs.length) return { ...fail(state, `This changes the ${needs.join(', ')}: propose it (propose) instead — this kind of change always needs the user's approval.`, { code: 'needs_approval', approval: needs, kept: 'the part is unchanged' }), state };
  }
  // (Autonomy L2, the owner's option b: the turn's changes so far apply directly only when they edit values of one
  // feature or of parameters and keep every hard requirement passing; anything else is a proposal, D41. The owner's
  // exception: a turn that starts on an empty part — no features yet — builds it directly, the first build.)
  // (O11: the assembly's inputs are its structure, as features are: at L2 they are proposed, even on an empty part.)
  if (!out.isError && out.changed && autonomy() === 2 && ((state.turnBase?.nodes.length && changesPart(name, input)) || name === 'set_inputs') && name !== 'propose') {
    const why = name === 'set_inputs' ? 'this changes the assembly\'s inputs (its structure)' : await proposalNeededAtL2(state.turnBase!, out.state, evaluate);
    if (why) return { ...fail(state, `At autonomy L2 ${why}: propose it (propose) instead, and the user accepts it. Value edits of one feature or of parameters that keep every hard requirement passing apply directly.`, { code: 'needs_proposal', kept: 'the part is unchanged' }), state };
  }
  // (A refused call leaves the state as it was: the very same object, uncounted.)
  if (out.isError) return { ...out, state };
  return { ...out, state: { ...out.state, policy: out.state.policy ?? policy } };
}
/** The dispatcher without the session's gates (autonomy, approval): what proposals replay, and the tools' own tests. */
export const dispatchTool = (state: ChatState, name: string, input: unknown, evaluate: Evaluate) => runToolCounted(state, name, input, evaluate);
/** `v1`: the name and input are a v1 call already (runTool translated them; R3e: translated once). */
async function runToolCounted(state: ChatState, name: string, input: unknown, evaluate: Evaluate, v1 = false): Promise<ToolOutcome> {
  const out = await runToolUnchecked(state, name, input, evaluate, v1);
  if (out.isError || !out.changed) return out;
  const context = state.rowFiles, refused = personRowsRefusal(state.doc, out.state.doc, context);
  if (refused) return fail(state, refused);
  return { ...out, state: { ...out.state, doc: reconcileRowSources(state.doc, out.state.doc, context) } };
}
async function runToolUnchecked(state: ChatState, name: string, input: unknown, evaluate: Evaluate, translated = false): Promise<ToolOutcome> {
  if (!translated) {
    [name, input] = viaV2(name, input);
    const v1 = v1Call(name, input);
    if (v1) { if ('error' in v1) return fail(state, v1.error); name = v1.name; input = v1.args; }
  }
  if (name === 'describe') { const d = describe(isObj(input) ? input : {}); return 'error' in d ? fail(state, String(d.error)) : { state, content: json(d), isError: false, changed: false, summary: 'described' }; }
  const args = isObj(input) ? input : {};
  // (A9-3: an argument the tool does not take is refused, named — never dropped, so a call never says it did what it ignored.)
  // O24(d): refuse the fixed joint's forbidden raw fields before the generic unknown-argument gate.
  if (name === 'add_mate' || name === 'edit_mate') {
    const kind = name === 'add_mate' ? args.kind : state.doc.mates?.find(m => m.id === String(args.id))?.kind;
    try { validateFastenedOptions(kind, args); } catch (e) { if (isRefusal(e, 'VALUE')) return fail(state, e.message); throw e; }
  }
  const unknown = unknownArguments(name, args);
  if (unknown) return fail(state, unknown);
  if (OUTPUT_TOOL_NAMES.has(name)) {
    const { runOutputTool } = await (outputsModule ??= import('./outputs'));
    const output = await runOutputTool(state.doc, state.bodies, name, args, evaluate);
    return 'error' in output ? fail(state, output.error) : { state, content: json(output.content), isError: false, changed: false, summary: output.summary };
  }
  // (A9-2: the report, the print orientation and the brief are a part's own: `part` runs them on that part's document.)
  if (PART_SCOPED.has(name) && args.part !== undefined) {
    const { part, ...rest } = args;
    if (part === 'base') return runToolCounted(state, name, rest, evaluate);
    const inst = state.doc.instances?.find(i => i.id === part);
    if (!inst) return fail(state, `No part "${String(part)}"; parts: base${(state.doc.instances ?? []).map(i => `, ${i.id}`).join('')}.`);
    const { shop, partEvaluate, bodies } = await placedPart(state, inst, evaluate);
    const out = await runToolCounted({ doc: shop.doc, bodies, partOf: inst.id, rowFiles: state.rowFiles, ...(state.turns ? { turns: state.turns } : {}) }, name, rest, partEvaluate);
    const content = partReply(out.content, inst, shop);
    if (out.isError || !out.changed) return { ...out, state, content };
    const authored = restoreAuthoredShopRows(out.state.doc, shop.doc);
    if ('error' in authored) return fail(state, authored.error);
    return { ...out, state: { ...state, doc: { ...state.doc, instances: state.doc.instances!.map(i => i.id === inst.id ? { ...i, doc: authored.doc } : i) } }, content, summary: `${inst.id}: ${out.summary}` };
  }
  // (The robot, RM1: the assembly's joint tree and its settings.)
  // (A locked reference, A6.3: no part or assembly change may use its faces, edges or body.)
  if ((MUTATORS.has(name) || BATCHABLE.has(name) || ASSEMBLY_CHANGES.has(name)) && name !== 'apply_ops' && name !== 'run_script' && !REFERENCE_TOOL_NAMES.has(name)) {
    const ref = referenceNameIn(args);
    if (ref) return fail(state, `[REFERENCE_LOCKED] ${ref} belongs to a locked reference: no feature may use it. Take a datum from it (add_datum) and build on that, or keep the part clear of it (add_keepout).`);
  }
  // (Standards-derived values with their sources, A6.5.)
  if (STANDARDS_TOOL_NAMES.has(name)) { const r = runStandardsTool(args, state.doc); return 'error' in r ? fail(state, r.error) : { state, content: json(r.content), isError: false, changed: false, summary: r.summary }; }
  if (DRAFT_TOOL_NAMES.has(name)) {
    // (A drawing on a datum plane or a given plane, A6.4.)
    let plane: DocPlane | undefined;
    const pl = args.plane as Record<string, unknown> | undefined;
    if (pl !== undefined) {
      if (isObj(pl) && typeof pl.datum === 'string') { try { plane = datumPlane(readReferences(state.doc.references), pl.datum); } catch (e) { return fail(state, isRefusal(e, ...REFERENCE_CODES) ? e.message : String(e)); } }
      else if (isObj(pl) && [pl.origin, pl.normal, pl.xAxis].every(isVec3)) plane = { origin: pl.origin as Vec3T, normal: pl.normal as Vec3T, xAxis: pl.xAxis as Vec3T };
      else return fail(state, '"plane" is {datum: id} or {origin, normal, xAxis}.');
    }
    const out = runDraftTool(state.doc, name, args, plane);
    if ('error' in out) return fail(state, out.error);
    if (!out.changed) return { state, content: json(out.content), isError: false, changed: false, summary: out.summary };
    return accept(state, out.doc, evaluate, out.summary, out.content as Record<string, unknown>);
  }
  if (REFERENCE_TOOL_NAMES.has(name)) {
    const out = await runReferenceTool(state.doc, state.bodies, name, args, evaluate);
    if ('error' in out) return fail(state, out.error);
    return subToolResult(state, out);
  }
  // (The brief, A6.1: the part's intent, its required fields and gaps.)
  if (BRIEF_TOOL_NAMES.has(name) || QUESTION_TOOL_NAMES.has(name)) {
    const out = QUESTION_TOOL_NAMES.has(name) ? runQuestionTool(state.doc, args) : runBriefTool(state.doc, name, args, state.turns);
    if ('error' in out) return fail(state, out.error);
    return subToolResult(state, out);
  }
  if (ROBOT_TOOL_NAMES.has(name)) {
    const out = await runRobotTool(state.doc, state.bodies, name, args, evaluate);
    if ('error' in out) return fail(state, out.error);
    return subToolResult(state, out);
  }
  if (ASSEMBLY_TOOL_NAMES.has(name)) {
    const out = await runAssemblyTool(state, name, args, evaluate);
    // (O72: a change re-evaluates the part, so the state's bodies are its own — add_library_part unites into a body, and
    // the next call in the turn finds that body by its face, not the one before the union.)
    const e = out.changed && !out.isError ? await evaluate(out.doc) : null;
    return { state: { ...state, doc: out.doc, ...(e?.ok ? { bodies: e.bodies } : {}) }, content: out.content, isError: out.isError, changed: out.changed, summary: out.summary };
  }
  const { part, ...rest } = args;
  if (part === undefined || part === 'base') {
    const out = await runPartTool(state, name, rest, evaluate);
    if (!out.changed || !state.doc.mates?.length) return out;
    // Parts mated to the base part follow its edit.
    const solved = solveDoc(out.state.doc, state.doc.instances);
    return { ...out, state: { ...out.state, doc: solved.doc }, ...(solved.problems.length ? { content: out.content.replace(/}$/, `,"unmet_mates":${JSON.stringify(solved.problems)}}`) } : {}) };
  }
  const inst = state.doc.instances?.find(i => i.id === part);
  if (!inst) return fail(state, `No part "${String(part)}"; parts: base${(state.doc.instances ?? []).map(i => `, ${i.id}`).join('')}.`);
  if (name === 'select') return fail(state, 'The viewport selection shows the base part\'s faces only; select without "part".');
  const { shop, partEvaluate, bodies } = await placedPart(state, inst, evaluate);
  const sub: ChatState = { doc: shop.doc, bodies, partOf: inst.id, rowFiles: state.rowFiles, ...(state.images ? { images: state.images } : {}) };
  const out = await runPartTool(sub, name, rest, partEvaluate);
  const content = partReply(out.content, inst, shop);
  if (out.isError || !out.changed) return { ...out, state, content };
  const authored = restoreAuthoredShopRows(out.state.doc, shop.doc);
  if ('error' in authored) return fail(state, authored.error);
  // (FRf2, O125: base frames following this part's sketches keep every edge they use; their copies follow the edit.)
  const held = firstProblem(checkPartEdit(state.doc, inst.id, authored.doc));
  if (held) return fail(state, held, { kept: 'the part is unchanged' });
  const doc = refreshFollowed({ ...state.doc, instances: state.doc.instances!.map(i => i.id === inst.id ? { ...i, doc: authored.doc } : i) });
  const solved = solveDoc(doc, state.doc.instances);
  return { ...out, state: { ...state, doc: solved.doc }, content: solved.problems.length ? content.replace(/}$/, `,"unmet_mates":${JSON.stringify(solved.problems)}}`) : content, summary: `${inst.id}: ${out.summary}` };
}

async function runPartTool(state: ChatState, name: string, input: unknown, evaluate: Evaluate): Promise<ToolOutcome> {
  const args = isObj(input) ? input : {};
  setCall(args);
  if ('__invalid_json' in args) return fail(state, 'The tool input was not valid JSON; send it again.');
  if (DRAWING_TOOL_NAMES.has(name)) {
    // The drawing (R14.5): reading tools, and changes that only a proposal makes (the approval gate, D41).
    const out = runDrawingTool(state.doc, name, args);
    if ('error' in out) return fail(state, out.error);
    return subToolResult(state, out);
  }
  // (R3: every part tool's handler, in a module per v2 action group, by name.)
  if (Object.hasOwn(PART_HANDLERS, name)) return PART_HANDLERS[name](state, args, evaluate, runToolCounted);
  // (R8.2: the SubD cage tools, D83.)
  if (CAGE_TOOL_NAMES.has(name)) {
    const r = runCageTool(state.doc, name, args);
    if ('error' in r) return fail(state, r.error, { kept: 'the part is unchanged' });
    if ('read' in r) return { state, content: json({ ok: true, ...r.read }), isError: false, changed: false, summary: `${name}: read` };
    return accept(state, r.doc, evaluate, r.did, r.extra);
  }
  return fail(state, `Unknown tool "${name}".`);
}
