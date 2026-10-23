// The chat's tools: the studio's own commands (validated by the same `available` / `fields` rules as
// the HUD and built by the same `build`), raw feature nodes for what has no command (sketched profiles,
// revolves, sweeps, lofts), the feature editor's fields, delete, measure, select and a part summary.
// Each change is evaluated by the engine before it is kept; the result is what the model reads back.
import { commandById } from '../app/commands';
import { prefixDoc, type DocPlane, type ModelNode, type StudioDoc } from '../engine/doc';
type Vec3T = [number, number, number];
import { type BodyResult } from '../engine/evaluate';
import type { ToolDefinition } from './api';
import { CAGE_MUTATORS, CAGE_TOOL_NAMES, CAGE_TOOLS, runCageTool } from './cageTools';
import { DRAWING_CHANGES, DRAWING_TOOL_NAMES, DRAWING_TOOLS, runDrawingTool } from './drawing';
import { OUTPUT_TOOLS, OUTPUT_TOOL_NAMES } from './outputDefinitions';
import { resolveShopRows, resolveShopTree, restoreAuthoredShopRows } from '../engine/shopRows';
import { friendly } from '../engine/errors';
import { ROW_KINDS } from './rowDefinitions';
import { personRowsRefusal, reconcileRowSources } from './rowSources';
import { bodyKeyFor, featureId, nodeIndexOf } from '../engine/ids';
import { GROUPS, V2_OF, v1Call, viaV2 } from './groups';
import { ROBOT_TOOL_NAMES, ROBOT_TOOLS, runRobotTool } from './robot';
import { BRIEF_TOOL_NAMES, BRIEF_TOOLS, runBriefTool } from './brief';
import { QUESTION_TOOL_NAMES, QUESTION_TOOLS, runQuestionTool } from './questions';
import { DRAFT_TOOL_NAMES, DRAFT_TOOLS, runDraftTool } from './drafts';
import { runStandardsTool, STANDARDS_TOOL_NAMES, STANDARDS_TOOLS } from '../standards/provenance';
import { datumPlane, readReferences, REFERENCE_TOOL_NAMES, REFERENCE_TOOLS, referenceNameIn, ReferenceError, runReferenceTool } from './references';
import { parse, runScript, SCRIPT_VERSION, ScriptError, type ScriptHost, type ScriptRun } from './script';
import { deleteFeatures, featureDependents, renumber } from './features';
import { ASSEMBLY_TOOL_NAMES, ASSEMBLY_TOOLS, runAssemblyTool, solveDoc } from './assembly';
import { resolveNames, type NameSelection } from './names';
import { changeOf, factsOf } from './observe';
import { newTransactions, OP_IDS, treeDiff, type TreeDiff } from './transactions';
import { canonical } from '../team/revision';
import { moveOp } from './remap';
import { diffLine, nextProposalId, PLAN_CHARS, PROMPT_CHARS, approvalOf, riskOf, riskRank, withHistory, type ChecksDelta, type Op, type Proposal, type Risk } from './proposals';
import { checkSpec, modelHash, newPolicy } from './spec';
import { verifyReferences } from '../engine/references';
import { rememberedEvaluate } from '../engine/evalMemo';
import { partEditRefusal, refreshFollowed } from '../frames/skeleton';
import { type ChatState, type Evaluate, type ToolOutcome, type PartHandler, because, setCall, json, CHECKPOINTS, accept, fail, isObj, strings, isVec3 } from './toolKit';
import { QUERY_HANDLERS } from './part/query';
import { IMAGE_HANDLERS } from './part/image';
import { CHAT_COMMANDS, COMMAND_DOCS, FEATURE_HANDLERS } from './part/features';
import { REQUIREMENT_HANDLERS } from './part/requirements';
import { VIEW_HANDLERS } from './part/views';
// ./outputs is loaded on first use: it reaches team/bundle → baseline → assembly → parts, which import this
// module, so a static import closes a cycle that leaves `commands` undefined here at load.
let outputsModule: Promise<typeof import('./outputs')> | undefined;
export { resolveNames, type NameSelection };
// (R3: the names that moved, re-exported so `chat/tools` resolves as it did.)
export { describeBodies, type ChatState, type Evaluate, type ToolOutcome } from './toolKit';
export { INFLATE, layerSketches, surfaceAt } from './part/image';
export { CHAT_COMMANDS, COMMAND_DOCS } from './part/features';
/** Every moved handler, by v1 tool name (R3): built once, at load. */
const PART_HANDLERS: Readonly<Record<string, PartHandler>> = { ...QUERY_HANDLERS, ...IMAGE_HANDLERS, ...FEATURE_HANDLERS, ...REQUIREMENT_HANDLERS, ...VIEW_HANDLERS };

/** The tools a batch may hold (those changing the base part, one at a time). */
// (The drawing tools that change it ride in ops: an agent proposes a drawing change, R14.5.)
const BATCHABLE = new Set([...DRAWING_CHANGES, 'load_rows', 'set_joints', 'set_brief', 'set_material', 'set_stock', 'set_casting', 'set_frame_stock', 'set_frame_sections', 'set_welds', 'import_drawing', 'add_keepout', 'add_datum', 'set_requirements', 'run_script', 'run_command', 'add_features', 'edit_feature', 'delete_feature', 'add_part', 'place_part', 'delete_part', 'add_mate', 'edit_mate', 'delete_mate', 'insert_part', 'snap_part', 'add_library_part', ...CAGE_MUTATORS]);
/** The tools a batch (apply_ops, a patch) may hold (A7.5: a candidate's unsupported op is refused by name before it runs). */
export const BATCHABLE_TOOLS: ReadonlySet<string> = BATCHABLE;
const MUTATORS = new Set(['load_rows', 'set_stock', 'set_frame_stock', 'set_frame_sections', 'apply_ops', 'run_script', 'restore', 'set_requirements', 'import_drawing', 'restore_best', 'run_command', 'add_features', 'edit_feature', 'delete_feature', 'extrude_image_layer', 'inflate_image_layer', 'add_library_part', ...CAGE_MUTATORS]);

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
  const out = await runToolCounted({ ...state, policy }, name, input, evaluate);
  // (Assemblies, mates, drawings and locked parts always need the user: an agent proposes such a change, D41.)
  if (!out.isError && out.changed && name !== 'propose' && name !== 'accept_proposal') {
    const needs = approvalOf(state.doc, out.state.doc);
    if (needs.length) return { ...fail(state, `This changes the ${needs.join(', ')}: propose it (propose) instead — this kind of change always needs the user's approval.`, { code: 'needs_approval', approval: needs, kept: 'the part is unchanged' }), state };
  }
  // (Autonomy L2, the owner's option b: the turn's changes so far apply directly only when they edit values of one
  // feature or of parameters and keep every hard requirement passing; anything else is a proposal, D41. The owner's
  // exception: a turn that starts on an empty part — no features yet — builds it directly, the first build.)
  if (!out.isError && out.changed && autonomy() === 2 && state.turnBase?.nodes.length && changesPart(name, input) && name !== 'propose') {
    const why = await proposalNeededAtL2(state.turnBase, out.state, evaluate);
    if (why) return { ...fail(state, `At autonomy L2 ${why}: propose it (propose) instead, and the user accepts it. Value edits of one feature or of parameters that keep every hard requirement passing apply directly.`, { code: 'needs_proposal', kept: 'the part is unchanged' }), state };
  }
  // (A refused call leaves the state as it was: the very same object, uncounted.)
  if (out.isError) return { ...out, state };
  return { ...out, state: { ...out.state, policy: out.state.policy ?? policy } };
}
/** The dispatcher without the session's gates (autonomy, approval): what proposals replay, and the tools' own tests. */
export const dispatchTool = (state: ChatState, name: string, input: unknown, evaluate: Evaluate) => runToolCounted(state, name, input, evaluate);
async function runToolCounted(state: ChatState, name: string, input: unknown, evaluate: Evaluate): Promise<ToolOutcome> {
  const out = await runToolUnchecked(state, name, input, evaluate);
  if (out.isError || !out.changed) return out;
  const context = state.rowFiles, refused = personRowsRefusal(state.doc, out.state.doc, context);
  if (refused) return fail(state, refused);
  return { ...out, state: { ...out.state, doc: reconcileRowSources(state.doc, out.state.doc, context) } };
}
async function runToolUnchecked(state: ChatState, name: string, input: unknown, evaluate: Evaluate): Promise<ToolOutcome> {
  [name, input] = viaV2(name, input);
  const v1 = v1Call(name, input);
  if (v1) { if ('error' in v1) return fail(state, v1.error); name = v1.name; input = v1.args; }
  if (name === 'describe') { const d = describe(isObj(input) ? input : {}); return 'error' in d ? fail(state, String(d.error)) : { state, content: json(d), isError: false, changed: false, summary: 'described' }; }
  const args = isObj(input) ? input : {};
  // (A9-3: an argument the tool does not take is refused, named — never dropped, so a call never says it did what it ignored.)
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
    const shop = { ...resolveShopRows(inst.doc, state.doc), doc: resolveShopTree(inst.doc, state.doc, inst.id) };
    const partEvaluate: Evaluate = async d => {
      const authored = restoreAuthoredShopRows(d, shop.doc);
      return 'error' in authored ? { ok: false, revision: 0, error: friendly(authored.error), ms: 0 } : evaluate(resolveShopTree(authored.doc, state.doc, inst.id));
    };
    const r = await partEvaluate(shop.doc);
    const out = await runToolCounted({ doc: shop.doc, bodies: r?.ok ? r.bodies : [], partOf: inst.id, rowFiles: state.rowFiles, ...(state.turns ? { turns: state.turns } : {}) }, name, rest, partEvaluate);
    const content = out.content.replace(/^\{/, `{"part":${JSON.stringify(inst.id)},"shopRows":${JSON.stringify(shop.provenance)},`);
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
  if (STANDARDS_TOOL_NAMES.has(name)) { const r = runStandardsTool(args); return 'error' in r ? fail(state, r.error) : { state, content: json(r.content), isError: false, changed: false, summary: r.summary }; }
  if (DRAFT_TOOL_NAMES.has(name)) {
    // (A drawing on a datum plane or a given plane, A6.4.)
    let plane: DocPlane | undefined;
    const pl = args.plane as Record<string, unknown> | undefined;
    if (pl !== undefined) {
      if (isObj(pl) && typeof pl.datum === 'string') { try { plane = datumPlane(readReferences(state.doc.references), pl.datum); } catch (e) { return fail(state, e instanceof ReferenceError ? e.message : String(e)); } }
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
    return { state: out.changed ? { ...state, doc: out.doc } : state, content: json(out.content), isError: false, changed: out.changed, summary: out.summary };
  }
  // (The brief, A6.1: the part's intent, its required fields and gaps.)
  if (BRIEF_TOOL_NAMES.has(name) || QUESTION_TOOL_NAMES.has(name)) {
    const out = QUESTION_TOOL_NAMES.has(name) ? runQuestionTool(state.doc, args) : runBriefTool(state.doc, name, args, state.turns);
    if ('error' in out) return fail(state, out.error);
    return { state: out.changed ? { ...state, doc: out.doc } : state, content: json(out.content), isError: false, changed: out.changed, summary: out.summary };
  }
  if (ROBOT_TOOL_NAMES.has(name)) {
    const out = await runRobotTool(state.doc, state.bodies, name, args, evaluate);
    if ('error' in out) return fail(state, out.error);
    return { state: out.changed ? { ...state, doc: out.doc } : state, content: json(out.content), isError: false, changed: out.changed, summary: out.summary };
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
  const shop = { ...resolveShopRows(inst.doc, state.doc), doc: resolveShopTree(inst.doc, state.doc, inst.id) };
  const partEvaluate: Evaluate = async d => {
    const authored = restoreAuthoredShopRows(d, shop.doc);
    return 'error' in authored ? { ok: false, revision: 0, error: friendly(authored.error), ms: 0 } : evaluate(resolveShopTree(authored.doc, state.doc, inst.id));
  };
  const r = await partEvaluate(shop.doc);
  const sub: ChatState = { doc: shop.doc, bodies: r?.ok ? r.bodies : [], partOf: inst.id, rowFiles: state.rowFiles, ...(state.images ? { images: state.images } : {}) };
  const out = await runPartTool(sub, name, rest, partEvaluate);
  const content = out.content.replace(/^\{/, `{"part":${JSON.stringify(inst.id)},"shopRows":${JSON.stringify(shop.provenance)},`);
  if (out.isError || !out.changed) return { ...out, state, content };
  const authored = restoreAuthoredShopRows(out.state.doc, shop.doc);
  if ('error' in authored) return fail(state, authored.error);
  // (FRf2, O125: base frames following this part's sketches keep every edge they use; their copies follow the edit.)
  const held = partEditRefusal(state.doc, inst.id, authored.doc);
  if (held) return fail(state, held, { kept: 'the part is unchanged' });
  const doc = refreshFollowed({ ...state.doc, instances: state.doc.instances!.map(i => i.id === inst.id ? { ...i, doc: authored.doc } : i) });
  const solved = solveDoc(doc, state.doc.instances);
  return { ...out, state: { ...state, doc: solved.doc }, content: solved.problems.length ? content.replace(/}$/, `,"unmet_mates":${JSON.stringify(solved.problems)}}`) : content, summary: `${inst.id}: ${out.summary}` };
}

/**
 * How far an agent may go on its own (D41), set per turn by the studio (`CAD_AUTONOMY`):
 * L1 proposes only; L2 (default; the owner's option b) applies value edits of one feature or of parameters that keep
 * every hard requirement passing, and proposes anything else (more features, adding, deleting or moving features,
 * what a feature is built on), the user accepting proposals — except a turn starting on an empty part, which builds
 * it directly (the first build); L3 also changes the part and accepts its own
 * proposals of low or medium risk changing no hard requirement; L4 any that breaks no hard requirement.
 * A proposal with approval reasons (an assembly, mates, a drawing, a locked part) is always the user's.
 */
export function autonomy(): 1 | 2 | 3 | 4 {
  const n = typeof process !== 'undefined' ? Number(process.env?.CAD_AUTONOMY) : NaN;
  return n === 1 || n === 3 || n === 4 ? n : 2;
}
// (add_library changes no model: it adds data to the document, marked as the agent's until a person confirms it.)
const ASSEMBLY_CHANGES = new Set(['set_joints', 'add_part', 'place_part', 'delete_part', 'add_mate', 'edit_mate', 'delete_mate', 'insert_part', 'snap_part']);
/** Whether a call changes the part (requirements are the brief, not the part; a dry run changes nothing). */
function changesPart(name: string, input: unknown): boolean {
  if (name === 'set_requirements' || name === 'accept_proposal') return false;
  if ((name === 'apply_ops' || name === 'run_script') && isObj(input) && input.dryRun === true) return false;
  return MUTATORS.has(name) || ASSEMBLY_CHANGES.has(name);
}
/** Fields that say what a feature is built on or how it is made (references, choices, counts), not its values. */
const STRUCTURAL = new Set(['sideTags', 'kind', 'parent', 'left', 'right', 'tool', 'sketch', 'node', 'side', 'edges', 'faces', 'open', 'made', 'blob', 'positions', 'indices', 'repair', 'pieces', 'solids', 'count', 'suppressed', 'representation', 'op', 'axis', 'plane', 'toward']);
const dimLike = (x: unknown) => typeof x === 'number' || (isObj(x) && Object.keys(x).length === 1 && typeof x.parameter === 'string');
/** Whether `b` differs from `a` only in values (numbers, or a value bound to a parameter) outside the structural fields. */
function valuesOnly(a: unknown, b: unknown, key = ''): boolean {
  if (a === b) return true;
  // (A SubD cage with the same faces and creases — its vertices moved — is the feature's values, D83: what it is built
  // of, the topology, is its structure.)
  if (key === 'cage' && isObj(a) && isObj(b)) return JSON.stringify(a.faces) === JSON.stringify(b.faces) && JSON.stringify(a.creases ?? []) === JSON.stringify(b.creases ?? []) && Array.isArray(a.positions) && Array.isArray(b.positions) && a.positions.length === b.positions.length;
  if (STRUCTURAL.has(key)) return JSON.stringify(a) === JSON.stringify(b);
  if (dimLike(a) && dimLike(b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => valuesOnly(x, b[i], key));
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a).filter(k => !NODE_MARKS.has(k)), kb = Object.keys(b).filter(k => !NODE_MARKS.has(k));
    return ka.length === kb.length && ka.every(k => k in b && valuesOnly(a[k], b[k], k));
  }
  return false;
}
/** What the studio keeps on a node about its references (not the feature). */
const NODE_MARKS = new Set(['sigs', 'rematched', 'held']);
/** The hard requirements passing on each turn's base, worked out once. */
const basePassing = new WeakMap<StudioDoc, Promise<Set<string>>>();
/**
 * Why the turn's changes (from `base` to `cur`) need a proposal at L2, or null when they apply directly: values of
 * one feature, or parameter values, with every hard requirement that passed at the turn's start still passing.
 */
async function proposalNeededAtL2(base: StudioDoc, cur: ChatState, evaluate: Evaluate): Promise<string | null> {
  const d = treeDiff(base, cur.doc), what = [d.added.length ? `adds ${d.added.length}` : '', d.deleted.length ? `deletes ${d.deleted.length}` : '', d.moved.length ? `moves ${d.moved.length}` : ''].filter(Boolean);
  if (what.length) return `this turn ${what.join(', ')} feature${d.added.length + d.deleted.length + d.moved.length > 1 ? 's' : ''}`;
  // (A sketch is part of the feature built from it: a box's width and height are one feature's values.)
  const nodes = cur.doc.nodes, index = new Map(nodes.map((_, i) => [featureId(nodes, i), i])), consumer = new Map<number, number>();
  nodes.forEach((n, j) => { const r = n as { sketch?: unknown; sections?: { sketch?: unknown }[] }; for (const k of [r.sketch, ...(r.sections ?? []).map(x => x.sketch)]) if (typeof k === 'number' && !consumer.has(k)) consumer.set(k, j); });
  const owners = new Set(d.changed.map(c => { const i = index.get(c.id)!; return nodes[i]?.kind === 'sketch' && consumer.has(i) ? consumer.get(i)! : i; }));
  if (owners.size > 1) return `this turn changes ${owners.size} features (${d.changed.map(c => c.label).join(', ')})`;
  if (d.parameters && Object.values(d.parameters).some(p => p.before === undefined || p.after === undefined)) return 'this turn adds or removes parameters';
  const before = new Map(base.nodes.map((n, i) => [featureId(base.nodes, i), n]));
  for (const c of d.changed) if (!valuesOnly(before.get(c.id), nodes[index.get(c.id)!])) return `this changes ${c.label} beyond its values (what it is built on, its kind or options)`;
  const hard = (cur.doc.requirements ?? []).filter(r => r.hard);
  if (!hard.length) return null;
  let passing = basePassing.get(base);
  if (!passing) {
    passing = (async () => { const r = await evaluate(base); const c = await checkSpec(base, r?.ok ? r.bodies : [], evaluate); return new Set([...c.outcomes].filter(([, o]) => o.status === 'pass').map(([id]) => id)); })();
    basePassing.set(base, passing);
  }
  const was = await passing, now = await checkSpec(cur.doc, cur.bodies, evaluate);
  const broken = hard.filter(r => was.has(r.id) && now.outcomes.get(r.id)?.status !== 'pass').map(r => r.id);
  return broken.length ? `this leaves hard requirement${broken.length > 1 ? 's' : ''} ${broken.join(', ')} failing` : null;
}
/** Why an agent may not accept this proposal at this autonomy, or null (D41). */
export function agentMayNotAccept(p: Proposal, level: number): string | null {
  if (level < 3) return `At autonomy L${level} the user accepts proposals in the studio: tell them ${p.id} is ready.`;
  if (p.risk.approval.length) return `${p.id} always needs the user's approval (${p.risk.approval.join(', ')}).`;
  const hard = new Set(p.risk.hard_requirements_changed), breaks = (p.checks?.newly_failing ?? []).filter(x => hard.has(x));
  if (p.rebased && (riskRank(p.risk.level) > riskRank(p.rebased.risk_was.level) || hard.size)) return `${p.id} was rebased and its risk rose or a hard requirement changes: the user decides.`;
  if (level === 3 && (p.risk.level === 'high' || hard.size)) return `At autonomy L3 an agent accepts only low or medium risk changing no hard requirement; ${p.id} is ${p.risk.level}${hard.size ? `, changing ${[...hard].join(', ')}` : ''}: the user decides.`;
  if (breaks.length) return `${p.id} breaks hard requirement${breaks.length > 1 ? 's' : ''} ${breaks.join(', ')}: the user decides.`;
  return null;
}

/** Ops run in order on a copy, each on what the one before left: the result, or the first refusal (nothing applied). */
interface OpsRun { cur: ChatState; results: Record<string, unknown>[]; ops: Op[]; /** The feature ids in order before each op kept (O133: what its indices name). */ orders: string[][]; diff: TreeDiff; change: Record<string, unknown>; broken: Record<string, unknown>[] }
async function runOps(state: ChatState, input: unknown, evaluate: Evaluate): Promise<{ fail: ToolOutcome } | OpsRun> {
  // (The same ops on the same part again — a proposal accepted or rebased — are the evaluations already made, PERF3 A3.)
  evaluate = rememberedEvaluate(evaluate);
  const ops = Array.isArray(input) ? input : null;
  if (!ops?.length) return { fail: fail(state, 'Pass "ops": a list of {tool, args, opId?}.') };
  const tx = state.tx ?? newTransactions(), results: Record<string, unknown>[] = [], kept: Op[] = [], orders: string[][] = [];
  let cur: ChatState = state;
  for (let k = 0; k < ops.length; k++) {
    let op = ops[k] as Record<string, unknown>;
    // (An op may name a consolidated tool, A5.3: it is kept as the v1 call, so a proposal replays the same.)
    if (isObj(op) && typeof op.tool === 'string') { const v1 = v1Call(op.tool, op.args); if (v1 && !('error' in v1)) op = { ...op, tool: v1.name, args: v1.args }; }
    if (!isObj(op) || typeof op.tool !== 'string' || !BATCHABLE.has(op.tool)) return { fail: fail(state, `op ${k}: tool is one of ${[...BATCHABLE].join(', ')}.`, { kept: 'nothing was applied' }) };
    const opId = typeof op.opId === 'string' ? op.opId : undefined, opArgs = isObj(op.args) ? op.args : {};
    if (opId && tx.applied.includes(opId)) { results.push({ op: k, opId, skipped: 'already applied' }); continue; }
    // (Through the dispatcher: a part tool may name an instance with "part", assembly tools are batchable too.)
    const r = await runToolCounted(cur, op.tool, opArgs, evaluate);
    if (r.isError) { let why: unknown = r.content; try { why = JSON.parse(r.content).error; } catch { /* plain text */ } return { fail: fail(state, `op ${k} (${op.tool}${opId ? ` ${opId}` : ''}) was refused: ${String(why)} Nothing was applied.`, { failed_op: k, kept: 'nothing was applied' }) }; }
    orders.push(idsOf(cur.doc.nodes)); cur = r.state; let did: unknown = r.summary; try { did = JSON.parse(r.content).did ?? r.summary; } catch { /* plain text */ }
    results.push({ op: k, ...(opId ? { opId } : {}), did }); kept.push({ tool: op.tool, args: opArgs, ...(opId ? { opId } : {}) });
  }
  const diff = treeDiff(state.doc, cur.doc), change = changeOf(factsOf(state.doc, state.bodies), factsOf(cur.doc, cur.bodies));
  const refs = await verifyReferences(cur.doc, cur.bodies, evaluate), broken = [...refs.problems.map(p => ({ where: p.where, name: p.name, ...(p.candidates.length ? { could_be: p.candidates } : { gone: true }) })), ...refs.changes.map(c => ({ where: c.where, name: c.was, now: c.now }))];
  return { cur, results, ops: kept, orders, diff, change, broken };
}
/** A document's feature ids in order. */
const idsOf = (nodes: readonly ModelNode[]) => nodes.map((_, i) => featureId(nodes, i));
/** The studio side of a script (A5.2): each call through the dispatcher on the working part, a concise result. */
class ScriptOn implements ScriptHost {
  readonly commands = CHAT_COMMANDS;
  constructor(public cur: ChatState, private readonly evaluate: Evaluate, private readonly because: string) {}
  indexOf(id: string): number { return nodeIndexOf(this.cur.doc.nodes, id); }
  idAt(index: number): string | null { return Number.isInteger(index) && this.cur.doc.nodes[index] ? featureId(this.cur.doc.nodes, index) : null; }
  /**
   * The body a feature is part of now: the one holding its faces (after holes, a union or a cut, the body it went into),
   * else the body it made (A5.5: `difference([plate, tool])` after the plate's holes; unions in a loop onto one body).
   */
  bodyOf(id: string): string {
    const i = this.indexOf(id), made = i >= 0 ? bodyKeyFor(this.cur.doc.nodes, i) : id, prefix = `${id}.`;
    const holding = this.cur.bodies.filter(b => b.mesh.faces.some(f => f.name.split('+').some(n => n.startsWith(prefix))));
    return holding.length === 1 ? holding[0].key : holding.find(b => b.key === made)?.key ?? holding[0]?.key ?? made;
  }
  async call(tool: string, args: Record<string, unknown>): Promise<{ ok: true; added: string[]; did: string } | { ok: false; why: string }> {
    const was = this.cur.doc.nodes, before = new Set<string>();
    for (let i = 0; i < was.length; i++) before.add(featureId(was, i));
    // (Concise results and the script's reason, on the tools that take them: A9-3 refuses an argument a tool does not.)
    const v1 = v1Call(tool, args), named = v1 && !('error' in v1) ? v1.name : tool;
    const r = await runToolCounted(this.cur, tool, { ...args, ...(takesArgument(named, 'response_format') ? { response_format: 'concise' } : {}), ...(this.because && takesArgument(named, 'because') ? { because: this.because } : {}) }, this.evaluate);
    let out: Record<string, unknown> = {}; try { out = JSON.parse(r.content); } catch { /* plain text */ }
    if (r.isError) return { ok: false, why: String(out.error ?? r.content) };
    this.cur = r.state;
    const now = r.state.doc.nodes, added: string[] = [];
    for (let i = 0; i < now.length; i++) if (!before.has(featureId(now, i))) added.push(featureId(now, i));
    return { ok: true, added, did: String(out.did ?? r.summary) };
  }
}
/** A script run on a copy (A5.2): the part it leaves, its calls by line, the names it set; or the first problem, typed with its line (nothing applied). */
async function runScriptOn(state: ChatState, source: unknown, evaluate: Evaluate): Promise<{ fail: ToolOutcome } | { cur: ChatState; calls: ScriptRun['calls']; names: Record<string, string>; diff: TreeDiff; change: Record<string, unknown>; broken: Record<string, unknown>[] }> {
  if (typeof source !== 'string' || !source.trim()) return { fail: fail(state, 'Pass "source": the script (its language is in the tool description).') };
  const host = new ScriptOn(state, rememberedEvaluate(evaluate), because);
  let run: ScriptRun;
  try { run = await runScript(parse(source), host); } catch (e) {
    if (!(e instanceof ScriptError)) throw e;
    return { fail: fail(state, `${e.message}${e.code === 'REFUSED' ? '' : '.'} Nothing was applied.`, { code: `script_${e.code.toLowerCase()}`, line: e.line, col: e.col, kept: 'nothing was applied' }) };
  }
  const cur = host.cur, diff = treeDiff(state.doc, cur.doc), change = changeOf(factsOf(state.doc, state.bodies), factsOf(cur.doc, cur.bodies));
  const refs = await verifyReferences(cur.doc, cur.bodies, evaluate), broken = [...refs.problems.map(p => ({ where: p.where, name: p.name, ...(p.candidates.length ? { could_be: p.candidates } : { gone: true }) })), ...refs.changes.map(c => ({ where: c.where, name: c.was, now: c.now }))];
  return { cur, calls: run.calls, names: run.names, diff, change, broken };
}
/**
 * A proposal's change worked out on a copy (A4.2): the ops run as a person would apply them (no regression
 * guard: the checks' delta and the risk say what it does), the requirements checked before and after.
 */
export async function proposalOf(state: ChatState, ops: unknown, evaluate: Evaluate): Promise<{ fail: ToolOutcome } | OpsRun & { checks?: ChecksDelta; risk: Risk; summary: string }> {
  const run = await runOps({ ...state, policy: undefined }, ops, evaluate);
  if ('fail' in run) return run;
  const { cur, diff, broken } = run;
  let checks: ChecksDelta | undefined;
  const hardChanged = new Set<string>();
  if (state.doc.requirements?.length || cur.doc.requirements?.length) {
    const a = await checkSpec(state.doc, state.bodies, evaluate), b = await checkSpec(cur.doc, cur.bodies, evaluate);
    const flipped = [...b.outcomes].filter(([id, o]) => (a.outcomes.get(id)?.status ?? 'unknown') !== o.status);
    checks = { before: countsOf(a.summary), after: countsOf(b.summary), newly_failing: flipped.filter(([, o]) => o.status === 'fail').map(([id]) => id), newly_passing: flipped.filter(([, o]) => o.status === 'pass').map(([id]) => id) };
    const hard = new Set([...(state.doc.requirements ?? []), ...(cur.doc.requirements ?? [])].filter(r => r.hard).map(r => r.id));
    for (const [id] of flipped) if (hard.has(id)) hardChanged.add(id);
    for (const id of [...(diff.requirements?.added ?? []), ...(diff.requirements?.changed ?? []), ...(diff.requirements?.deleted ?? [])]) if (hard.has(id)) hardChanged.add(id);
  }
  const risk = riskOf(state.doc, cur.doc, diff, broken.length, [...hardChanged]);
  const summary = [diffLine(diff), ...(checks ? [`checks ${checks.before.pass}/${checks.before.fail}/${checks.before.unknown} → ${checks.after.pass}/${checks.after.fail}/${checks.after.unknown}`] : [])].filter(Boolean).join(', ') || 'no change';
  return { ...run, checks, risk, summary };
}
const countsOf = (s: { pass: number; fail: number; unknown: number }) => ({ pass: s.pass, fail: s.fail, unknown: s.unknown });

/** Who decides: a person in the studio, or an agent (its model). */
export interface Decider { agent: string; model?: string }
/**
 * A proposal accepted (A4.2, A4.3): its ops replayed on the part as it is now, less the parts left out (`leaveOut`,
 * feature ids, with what depends on them), the proposal marked, the decision in the history with who proposed it,
 * the prompt, plan and requirements, and the model it made. A proposal made on a part changed since is refused as
 * stale: rebase it first and look again (D41). The replay's refusal, if any, is returned and nothing changes.
 */
export async function acceptProposal(state: ChatState, id: string, evaluate: Evaluate, o: { by?: Decider; leaveOut?: readonly string[] } = {}): Promise<{ state: ChatState; leftOut: string[] } | { error: string; stale?: true }> {
  const p = state.doc.proposals?.find(q => q.id === id), by = o.by ?? { agent: 'user' };
  if (!p || p.status !== 'open') return { error: p ? `${id} is ${p.status} already.` : `No proposal ${id}.` };
  if (p.base !== modelHash(state.doc)) return { error: `${id} was made on a part that has changed since: rebase it and look at the result before accepting.`, stale: true };
  const run = await runOps({ ...state, policy: undefined }, p.ops, evaluate);
  if ('fail' in run) return { error: errorOf(run.fail) };
  let cur = run.cur, leftOut: string[] = [];
  if (o.leaveOut?.length) {
    const parts = proposalParts(state.doc, cur.doc), wrong = o.leaveOut.filter(x => !parts.some(q => q.id === x && q.kind !== 'deleted'));
    if (wrong.length) return { error: `${wrong.join(', ')}: not an added or changed feature of ${id} (${parts.filter(q => q.kind !== 'deleted').map(q => q.id).join(', ') || 'none'}).` };
    leftOut = leaveOutClosure(parts, o.leaveOut);
    const partial = partialDoc(state.doc, cur.doc, parts, leftOut);
    if ('error' in partial) return partial;
    const r = await evaluate(partial.doc);
    if (!r) return { error: 'The evaluation was superseded; try again.' };
    if (!r.ok) return { error: `Without ${leftOut.join(', ')} the part does not build: ${r.error.title}. ${r.error.hint}` };
    cur = { ...cur, doc: partial.doc, bodies: r.bodies };
  }
  const at = new Date().toISOString(), hash = modelHash(cur.doc);
  const decided = { by: by.agent, at, model_hash: hash, ...(leftOut.length ? { left_out: leftOut } : {}), ...(p.rebased ? { note: 'rebased before it was accepted' } : {}) };
  let doc: StudioDoc = { ...cur.doc, proposals: (state.doc.proposals ?? []).map(q => q.id === id ? { ...q, status: 'accepted' as const, decided } : q) };
  doc = withHistory(doc, { kind: 'accept', by, proposed_by: p.by, proposal: id, model_hash: hash, summary: `${id} ${p.title}${leftOut.length ? ` (without ${leftOut.join(', ')})` : ''}`,
    ...(p.prompt ? { prompt: p.prompt } : {}), ...(p.plan ? { plan: p.plan } : {}), ...(p.requirements ? { requirements: p.requirements } : {}), ...(p.rebased ? { base_was: p.rebased.original } : {}), risk: p.risk });
  return { state: { ...cur, doc }, leftOut };
}
/**
 * A stale proposal made again on the part as it is now (D41): its ops replayed as a fresh proposal — diff, facts'
 * change, broken references, the checks' delta and risk all recomputed — kept with the base it was made on first
 * and the risk it had then, and recorded in the history. It stays open, to be looked at before it is accepted.
 */
export async function rebaseProposal(state: ChatState, id: string, evaluate: Evaluate, by: Decider = { agent: 'user' }): Promise<{ state: ChatState; made: OpsRun & { checks?: ChecksDelta; risk: Risk; summary: string } } | { error: string }> {
  const p = state.doc.proposals?.find(q => q.id === id);
  if (!p || p.status !== 'open') return { error: p ? `${id} is ${p.status} already.` : `No proposal ${id}.` };
  const now = modelHash(state.doc);
  if (p.base === now) return { error: `${id} was made on the part as it is: nothing to rebase.` };
  // (O133: its ops' feature indices and the ids it made itself moved to the part as it is, when it says what they named.)
  let ops = p.ops;
  if (p.orders?.length === p.ops.length) {
    const moved = await moveOps(state, p.ops, p.orders, evaluate);
    if ('error' in moved) return { error: `${id} no longer applies: ${moved.error}` };
    ops = moved.ops;
  }
  const made = await proposalOf(state, ops, evaluate);
  if ('fail' in made) return { error: `${id} no longer applies: ${errorOf(made.fail)}` };
  const rebased = { original: p.rebased?.original ?? p.base, from: p.base, at: new Date().toISOString(), risk_was: p.rebased?.risk_was ?? p.risk };
  const q: Proposal = { ...p, base: now, ops: made.ops, orders: made.orders, risk: made.risk, summary: made.summary, rebased, ...(made.checks ? { checks: made.checks } : {}) };
  if (!made.checks) delete q.checks;
  const doc = withHistory({ ...state.doc, proposals: state.doc.proposals!.map(x => x.id === id ? q : x) }, { kind: 'rebase', by, proposal: id, base_was: p.base, model_hash: now, summary: `${id} rebased: ${made.summary}`, risk: made.risk });
  return { state: { ...state, doc }, made };
}
/**
 * Ops made on one state replayed one at a time on another (O133): each moved first (`moveOp`: the indices it names by
 * the ids they had — `orders`, the ids in order before each op — and the ids the ops made themselves as the ones the
 * replay hands out), then run. The ops as moved, or the first that names a feature gone or is refused.
 */
export async function moveOps(state: ChatState, ops: readonly Op[], orders: readonly (readonly string[])[], evaluate: Evaluate, ids: Map<string, string> = new Map(), made?: readonly (readonly string[])[]): Promise<{ ops: Op[]; state: ChatState } | { error: string; op: number; ops: Op[] }> {
  let cur: ChatState = { ...state, policy: undefined };
  const out: Op[] = [];
  for (let k = 0; k < ops.length; k++) {
    const before = idsOf(cur.doc.nodes), { op, missing } = moveOp(ops[k], { from: orders[k] ?? before, to: before, ids });
    // (Stopped at the first that does not apply: the rest moved as far as known, not run.)
    const rest = () => [...out, op, ...ops.slice(k + 1).map((o, j) => moveOp(o, { from: orders[k + 1 + j] ?? before, to: before, ids }).op)];
    if (missing.length) return { error: `op ${k} (${op.tool}) names ${[...new Set(missing)].join(', ')}, which the part no longer has`, op: k, ops: rest() };
    const r = await runToolCounted(cur, op.tool, op.args ?? {}, evaluate);
    if (r.isError) return { error: `op ${k} (${op.tool}) was refused: ${errorOf(r)}`, op: k, ops: rest() };
    // (The ids it made, in the order made, are the ones it made where it was made: what later ops name.)
    const now = idsOf(r.state.doc.nodes), had = new Set(before), madeHere = now.filter(x => !had.has(x));
    const was = new Set(orders[k] ?? []), madeThere = made?.[k] ?? (orders[k + 1] ?? []).filter(x => !was.has(x));
    madeThere.forEach((x, i) => { if (madeHere[i] && madeHere[i] !== x) ids.set(x, madeHere[i]); });
    out.push(op); cur = r.state;
  }
  return { ops: out, state: cur };
}
const errorOf = (o: ToolOutcome) => { try { return String(JSON.parse(o.content).error); } catch { return o.content; } };

/** A feature a proposal adds, changes or deletes, and the ones (of the proposal's) that go when it is left out. */
export interface ProposalPart { id: string; label: string; kind: 'added' | 'changed' | 'deleted'; children: string[] }
/** The proposal's parts from the part `base` to what it leaves, `after` (sketches go with their features). */
export function proposalParts(base: StudioDoc, after: StudioDoc): ProposalPart[] {
  const diff = treeDiff(base, after), out: ProposalPart[] = [];
  const index = new Map(after.nodes.map((_, i) => [featureId(after.nodes, i), i]));
  const own = new Set([...diff.added, ...diff.changed].map(x => x.id).filter(x => after.nodes[index.get(x)!]?.kind !== 'sketch'));
  for (const kind of ['added', 'changed'] as const) for (const x of diff[kind]) {
    if (!own.has(x.id)) continue;
    // (A change put back leaves what is built on it standing, as it stood before: only an added feature has children.)
    const children = kind === 'added' ? featureDependents(after, index.get(x.id)!).map(i => featureId(after.nodes, i)).filter(c => own.has(c)) : [];
    out.push({ id: x.id, label: x.label, kind, children });
  }
  const baseIndex = new Map(base.nodes.map((_, i) => [featureId(base.nodes, i), i]));
  for (const x of diff.deleted) if (base.nodes[baseIndex.get(x.id)!]?.kind !== 'sketch') out.push({ id: x.id, label: x.label, kind: 'deleted', children: [] });
  return out;
}
/** The parts left out with everything that depends on them (unticking a parent unticks its children). */
export function leaveOutClosure(parts: readonly ProposalPart[], ids: readonly string[]): string[] {
  const out = new Set(ids), byId = new Map(parts.map(q => [q.id, q]));
  for (const x of out) for (const c of byId.get(x)?.children ?? []) out.add(c);
  return parts.filter(q => out.has(q.id)).map(q => q.id);
}
/** The parts left out after ticking (`on`) or unticking a part: unticked, its children go too; ticked, its parents come back. */
export function toggledLeaveOut(parts: readonly ProposalPart[], leaveOut: readonly string[], id: string, on: boolean): string[] {
  if (!on) return leaveOutClosure(parts, [...leaveOut, id]);
  const back = new Set([id]);
  for (let grew = true; grew;) { grew = false; for (const q of parts) if (!back.has(q.id) && q.children.some(c => back.has(c))) { back.add(q.id); grew = true; } }
  return leaveOut.filter(x => !back.has(x));
}
/**
 * What a proposal leaves without some of its parts: changed features put back as they were (their references
 * renumbered to where those features are now), added ones deleted with the sketches only they use.
 */
export function partialDoc(base: StudioDoc, after: StudioDoc, parts: readonly ProposalPart[], leaveOut: readonly string[]): { doc: StudioDoc } | { error: string } {
  const out = new Set(leaveOut), nodes = [...after.nodes];
  const index = new Map(after.nodes.map((_, i) => [featureId(after.nodes, i), i])), baseIndex = new Map(base.nodes.map((_, i) => [featureId(base.nodes, i), i]));
  for (const q of parts) {
    if (!out.has(q.id) || q.kind !== 'changed') continue;
    const was = base.nodes[baseIndex.get(q.id)!];
    let missing: string | null = null;
    const back = renumber(was, i => { const at = index.get(featureId(base.nodes, i)); if (at === undefined) missing = featureId(base.nodes, i); return at ?? i; });
    if (missing) return { error: `${q.id} cannot be put back as it was: it was built on ${missing}, which the proposal deletes.` };
    nodes[index.get(q.id)!] = { ...back, id: q.id } as ModelNode;
  }
  const added = parts.filter(q => out.has(q.id) && q.kind === 'added').map(q => index.get(q.id)!);
  if (!added.length) return { doc: prefixDoc({ ...after, nodes }, nodes.length) };
  const r = deleteFeatures({ ...after, nodes }, added);
  return 'error' in r ? { error: `Leaving out ${leaveOut.join(', ')}: ${r.error}` } : { doc: r.doc };
}
/** The bodies a proposal would leave (its ghost preview), or its refusal. */
export async function previewProposal(state: ChatState, id: string, evaluate: Evaluate): Promise<{ doc: StudioDoc; bodies: BodyResult[] } | { error: string }> {
  const p = state.doc.proposals?.find(q => q.id === id);
  if (!p) return { error: `No proposal ${id}.` };
  const run = await runOps({ ...state, policy: undefined }, p.ops, evaluate);
  if ('fail' in run) { let why = run.fail.content; try { why = JSON.parse(why).error; } catch { /* plain text */ } return { error: why }; }
  return { doc: run.cur.doc, bodies: run.cur.bodies };
}
async function runPartTool(state: ChatState, name: string, input: unknown, evaluate: Evaluate): Promise<ToolOutcome> {
  const args = isObj(input) ? input : {};
  setCall(args);
  if ('__invalid_json' in args) return fail(state, 'The tool input was not valid JSON; send it again.');
  if (DRAWING_TOOL_NAMES.has(name)) {
    // The drawing (R14.5): reading tools, and changes that only a proposal makes (the approval gate, D41).
    const out = runDrawingTool(state.doc, name, args);
    if ('error' in out) return fail(state, out.error);
    return { state: out.changed ? { ...state, doc: out.doc } : state, content: json(out.content), isError: false, changed: out.changed, summary: out.summary };
  }
  // (R3: the handlers moved to a module per v2 action group, found by name first.)
  if (Object.hasOwn(PART_HANDLERS, name)) return PART_HANDLERS[name](state, args, evaluate, runToolCounted);
  switch (name) {
    case 'apply_ops': {
      // All or nothing: each op runs on what the one before left; one refusal and nothing is applied.
      const tx = state.tx ?? newTransactions(), dry = args.dryRun === true, run = await runOps(state, args.ops, evaluate);
      if ('fail' in run) return run.fail;
      const { cur, results, diff, change, broken } = run;
      const body = { ...(dry ? { dryRun: true, would_apply: results } : { ok: true, applied: results }), diff, change, ...(broken.length ? { broken_references: broken } : {}) };
      if (dry) return { state, content: json(body), isError: false, changed: false, summary: `dry run: ${results.length} ops` };
      const applied = [...tx.applied, ...results.flatMap(r => typeof r.opId === 'string' && !r.skipped ? [r.opId] : [])].slice(-OP_IDS);
      // The feature diff is for display; approval and saving must cover the whole document.
      return { state: { ...cur, tx: { ...tx, applied } }, content: json({ ...body, facts: factsOf(cur.doc, cur.bodies) }), isError: false, changed: canonical(state.doc) !== canonical(cur.doc), summary: `${results.length} ops applied` };
    }
    case 'run_script': {
      // (A5.2, O10: a script's commands and features as one change, all or nothing, as apply_ops.)
      const dry = args.dryRun === true, run = await runScriptOn(state, args.source, evaluate);
      if ('fail' in run) return run.fail;
      const { cur, calls, names, diff, change, broken } = run;
      const body = { ...(dry ? { dryRun: true } : { ok: true }), script: SCRIPT_VERSION, calls, names, diff, change, ...(broken.length ? { broken_references: broken } : {}) };
      if (dry) return { state, content: json(body), isError: false, changed: false, summary: `dry run: a script of ${calls.length} calls` };
      return { state: cur, content: json({ ...body, facts: factsOf(cur.doc, cur.bodies) }), isError: false, changed: canonical(state.doc) !== canonical(cur.doc), summary: `a script of ${calls.length} calls` };
    }
    case 'propose': {
      // (A4.2: the change worked out and kept on the side, the part as it was; the user accepts or rejects it.)
      const title = typeof args.title === 'string' ? args.title.trim() : '';
      if (!title) return fail(state, 'A proposal takes a title.');
      const reqs = strings(args.requirements), known = new Set((state.doc.requirements ?? []).map(r => r.id)), unknown = reqs.filter(r => !known.has(r));
      if (unknown.length) return fail(state, `No requirement ${unknown.join(', ')}; requirements: ${[...known].join(', ') || 'none'}.`);
      const made = await proposalOf(state, args.ops, evaluate);
      if ('fail' in made) return made.fail;
      const env = typeof process !== 'undefined' ? process.env : undefined;
      const by = { agent: 'chat', ...(env?.CAD_MODEL ? { model: env.CAD_MODEL } : {}) };
      const plan = typeof args.plan === 'string' ? args.plan : undefined;
      const p: Proposal = { id: nextProposalId(state.doc), title: title.slice(0, 120), status: 'open', by, at: new Date().toISOString(), ...(plan ? { plan: plan.slice(0, PLAN_CHARS) } : {}),
        ...(reqs.length ? { requirements: reqs } : {}), ...(env?.CAD_PROMPT ? { prompt: env.CAD_PROMPT.slice(0, PROMPT_CHARS) } : {}), base: modelHash(state.doc), ops: made.ops, orders: made.orders, risk: made.risk, summary: made.summary, ...(made.checks ? { checks: made.checks } : {}) };
      const doc = withHistory({ ...state.doc, proposals: [...(state.doc.proposals ?? []), p] }, { kind: 'proposal', by, proposal: p.id, summary: `${p.id} ${p.title}: ${p.summary}`, ...(plan ? { plan } : {}), ...(reqs.length ? { requirements: reqs } : {}), risk: p.risk });
      return { state: { ...state, doc }, content: json({ ok: true, proposal: p.id, applied: false, note: 'The part is unchanged: the user accepts or rejects the proposal in the studio.', diff: made.diff, change: made.change, ...(made.broken.length ? { broken_references: made.broken } : {}), ...(made.checks ? { checks: made.checks } : {}), risk: p.risk }), isError: false, changed: true, summary: `proposed ${p.id}: ${p.summary}` };
    }
    case 'accept_proposal': {
      const id = String(args.id ?? ''), p = state.doc.proposals?.find(q => q.id === id);
      if (!p || p.status !== 'open') return fail(state, p ? `${id} is ${p.status} already.` : `No proposal "${id}"; open: ${(state.doc.proposals ?? []).filter(q => q.status === 'open').map(q => q.id).join(', ') || 'none'}.`);
      const env = typeof process !== 'undefined' ? process.env : undefined, by = { agent: 'chat', ...(env?.CAD_MODEL ? { model: env.CAD_MODEL } : {}) };
      const level = autonomy();
      const early = level < 3 || p.risk.approval.length ? agentMayNotAccept(p, level) : null;
      if (early) return fail(state, early);
      // (Stale: made again on the part as it is, and shown; accepting it is a second call, D41.)
      if (p.base !== modelHash(state.doc)) {
        const r = await rebaseProposal(state, id, evaluate, by);
        if ('error' in r) return fail(state, r.error, { kept: `${id} stays open` });
        const q = r.state.doc.proposals!.find(x => x.id === id)!;
        return { state: r.state, content: json({ ok: true, rebased: id, accepted: false, note: 'The part changed since this was proposed: it was made again on the part as it is. Read what it does now; call accept_proposal again to accept it.', diff: r.made.diff, change: r.made.change, ...(r.made.broken.length ? { broken_references: r.made.broken } : {}), ...(q.checks ? { checks: q.checks } : {}), risk: q.risk, risk_was: q.rebased!.risk_was, may_accept: agentMayNotAccept(q, level) ?? true }), isError: false, changed: true, summary: `rebased ${id}: ${q.summary}` };
      }
      const why = agentMayNotAccept(p, level);
      if (why) return fail(state, why);
      const r = await acceptProposal(state, id, evaluate, { by, leaveOut: strings(args.leave_out) });
      if ('error' in r) return fail(state, r.error, { kept: `${id} stays open` });
      return { state: r.state, content: json({ ok: true, accepted: id, ...(r.leftOut.length ? { left_out: r.leftOut } : {}), feature_count: r.state.doc.nodes.length, facts: factsOf(r.state.doc, r.state.bodies) }), isError: false, changed: true, summary: `accepted ${id}` };
    }
    case 'list_proposals': {
      const list = (state.doc.proposals ?? []).filter(p => args.all === true || p.status === 'open');
      return { state, content: json({ proposals: list.map(({ ops, ...p }) => ({ ...p, ops: ops.length, stale: p.status === 'open' && p.base !== modelHash(state.doc) })) }), isError: false, changed: false, summary: `${list.length} proposal${list.length === 1 ? '' : 's'}` };
    }
    case 'checkpoint': {
      const label = String(args.name ?? ''); if (!label) return fail(state, 'A checkpoint takes a name.');
      const tx = state.tx ?? newTransactions(), names = Object.keys(tx.checkpoints).filter(n => n !== label);
      const checkpoints = Object.fromEntries([...names.slice(-(CHECKPOINTS - 1)).map(n => [n, tx.checkpoints[n]] as const), [label, state.doc] as const]);
      return { state: { ...state, tx: { ...tx, checkpoints } }, content: json({ ok: true, checkpoint: label, model_hash: modelHash(state.doc), checkpoints: Object.keys(checkpoints) }), isError: false, changed: false, summary: `checkpoint ${label}` };
    }
    case 'restore': {
      const doc = state.tx?.checkpoints[String(args.name ?? '')];
      if (!doc) return fail(state, `No checkpoint "${String(args.name)}"; checkpoints: ${Object.keys(state.tx?.checkpoints ?? {}).join(', ') || 'none'}.`);
      return accept(state, doc, evaluate, `restored checkpoint ${String(args.name)}`, { diff: treeDiff(state.doc, doc) });
    }
    case 'diff': {
      const pick = (n: unknown) => n === undefined || n === 'current' ? state.doc : n === 'best' ? state.policy?.best?.doc : state.tx?.checkpoints[String(n)];
      const a = pick(args.from), b = pick(args.to);
      if (!a || !b) return fail(state, `from and to are checkpoint names, "best" or "current" (checkpoints: ${Object.keys(state.tx?.checkpoints ?? {}).join(', ') || 'none'}).`);
      return { state, content: json({ from: args.from ?? 'current', to: args.to ?? 'current', diff: treeDiff(a, b) }), isError: false, changed: false, summary: 'diff' };
    }
    case 'restore_best': {
      const best = state.policy?.best;
      if (!best) return fail(state, 'No checked snapshot yet: run check_spec first.');
      if (best.hash === modelHash(state.doc)) return fail(state, 'The part is the best snapshot already.');
      return accept(state, best.doc, evaluate, `restored the best snapshot ${best.hash} (${best.pass} passing)`);
    }
  }
  // (R8.2: the SubD cage tools, D83.)
  if (CAGE_TOOL_NAMES.has(name)) {
    const r = runCageTool(state.doc, name, args);
    if ('error' in r) return fail(state, r.error, { kept: 'the part is unchanged' });
    if ('read' in r) return { state, content: json({ ok: true, ...r.read }), isError: false, changed: false, summary: `${name}: read` };
    return accept(state, r.doc, evaluate, r.did, r.extra);
  }
  return fail(state, `Unknown tool "${name}".`);
}

export const isMutator = (name: string) => MUTATORS.has(name);

const nameList = { type: 'array', items: { type: 'string' } };
/** A face or edge: its name, or a selector (A1.2) that resolves to it (the result reports the name). */
const SELECTOR = 'or a selector: a feature\'s face by role {"feature": index or id, "role": "top" | "bottom" | "side2" (by position) or "side[e3]" (a sketch drawn in the sketcher: by its edge\'s id) | "side" (one of its sides) | "cut" …}, the flat face facing a direction {"normal": [0, 0, 1], "pick": "max" | "min"}, either with "on": a body key and "all": true for every face that fits; an edge {"between": [face, face]}';
const selectorList = (what: string) => ({ type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'object' }] }, description: `${what}: names, ${SELECTOR}.` });
const oneSelector = (what: string) => ({ anyOf: [{ type: 'string' }, { type: 'object' }], description: `${what}: a name, ${SELECTOR}.` });
const commandDoc = CHAT_COMMANDS.map(id => {
  const c = commandById(id)!, d = COMMAND_DOCS[id];
  const values = Object.entries(d.values).map(([k, v]) => `${k}: ${v}`).join('; ');
  return `- ${id} (${c.label}) — select ${d.selection}${values ? `; values: ${values}` : ''}`;
}).join('\n');

/**
 * `describe` (A5.3): what the consolidated list leaves out, on request — a tool's actions, an action's full v1
 * description and schema, a command's selection and values, a feature kind's node JSON.
 */
function describe(args: Record<string, unknown>): Record<string, unknown> | { error: string } {
  if (typeof args.command === 'string') {
    const c = commandById(args.command.replace(/_/g, '-')), d = c && COMMAND_DOCS[c.id];
    if (!c || !d || !CHAT_COMMANDS.includes(c.id)) return { error: `No command "${args.command}"; commands: ${CHAT_COMMANDS.join(', ')}.` };
    return { command: c.id, label: c.label, hint: c.hint, selection: d.selection, values: d.values };
  }
  if (typeof args.feature === 'string') {
    const add = TOOLS.find(t => t.name === 'add_features')!, lines = add.description.split('\n').filter(l => l.includes(`"kind":"${args.feature}"`));
    if (!lines.length) return { error: `No feature kind "${args.feature}"; kinds: ${featureKinds().join(', ')}.` };
    return { feature: args.feature, nodes: lines.map(l => l.replace(/^- /, '')), note: 'Dimensions in mm; Dim = a number or {"parameter": name}; i = a node index.' };
  }
  const tool = typeof args.tool === 'string' ? args.tool : undefined, g = tool ? GROUPS[tool] : undefined;
  if (tool && (!g || tool === 'describe')) return { error: `No tool "${tool}"; tools: ${Object.keys(GROUPS).filter(n => n !== 'describe').join(', ')}.` };
  if (!g) return { tools: Object.fromEntries(Object.entries(GROUPS).filter(([n]) => n !== 'describe').map(([n, x]) => [n, Object.keys(x.actions)])) };
  const action = typeof args.action === 'string' ? args.action : undefined;
  if (action === undefined) return { tool, actions: Object.fromEntries(Object.entries(g.actions).map(([a, [, hint]]) => [a, hint])) };
  const v1 = g.actions[action]?.[0], t = v1 && TOOLS.find(x => x.name === v1);
  if (!t) return { error: `${tool} has no action "${action}"; actions: ${Object.keys(g.actions).join(', ')}.` };
  return { tool, action, description: t.description, input: t.input_schema };
}
/** The feature kinds add_features documents. */
function featureKinds(): string[] {
  const add = TOOLS.find(t => t.name === 'add_features')!;
  return [...new Set([...add.description.matchAll(/"kind":"([a-z-]+)"/g)].map(m => m[1]).filter(k => k !== 'line' && k !== 'arc'))];
}
export { featureKinds };

const PART_TOOLS: ToolDefinition[] = [
  {
    name: 'get_part_summary',
    description: 'The current part: every feature node by index (sketch outlines abbreviated), parameters, and each visible body with volume and bounds, and its faces and edges by persistent name (e.g. face "n1.top", edge "n1.side0|n1.side1"; a sketch drawn in the sketcher names its walls by its edges\' ids, "n2.side[e3]", which stay as the sketch is edited). On a big part, faces and edges are listed for the one body named in "body". Call it before referring to faces or edges you have not seen in a result.',
    input_schema: { type: 'object', properties: { body: { type: 'string', description: 'A body key (e.g. "b27") to list the faces and edges of.' }, page: { type: 'integer', description: 'The page of that body\'s faces and edges (60 a page, from 1).' } }, additionalProperties: false },
  },
  {
    name: 'run_command',
    description: `Runs one studio command, exactly as the toolbar and its HUD would: the same availability rules, value ranges and defaults (omitted values take the HUD default). Faces, edges and bodies are selected by name; the command applies to that selection. Commands:\n${commandDoc}\nThe result has the bodies after evaluation (volume, bounds, face and edge names) or the refusal reason; nothing changes on a refusal.`,
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', enum: CHAT_COMMANDS },
        values: { type: 'object', description: 'Command values by key (numbers in mm or degrees; choices as strings).', additionalProperties: { type: ['number', 'string'] } },
        faces: selectorList('Faces to select'),
        edges: selectorList('Edges to select'),
        bodies: { ...nameList, description: 'Body keys to select (e.g. "b1").' },
        point: { type: 'array', items: { type: 'number' }, description: 'Optional picked point [x, y, z] on the face (hole default centre).' },
      },
      required: ['command'], additionalProperties: false,
    },
  },
  {
    name: 'add_features',
    description: `Appends raw feature nodes for what no command covers: sketched profiles and the solids made from them (polygon or line/arc outlines, sketches on other planes, extrudes with draft or a start Z, revolves, sweeps, lofts), blind holes, or feature-level control. Nodes are checked, appended in order (each new node gets the next index) and evaluated together; on any error nothing is added. Node kinds (dimensions in mm; Dim = number or {"parameter": name}):
- {"kind":"sketch","profile":"rectangle","min":[x,y],"max":[x,y]} | {"kind":"sketch","profile":"circle","center":[x,y],"radius":r} | {"kind":"sketch","profile":"polygon","points":[[x,y],...]} | {"kind":"sketch","profile":"loop","segments":[{"kind":"line","start":[x,y]} | {"kind":"arc","start":[x,y],"center":[x,y],"direction":"ccw"|"cw"}, ...]}; optional "plane":{origin,normal,xAxis} (default XY at Z 0), "regions" (more loops), "holes" (loops cut out; straight extrudes only)
- {"kind":"extrude","sketch":i,"height":h,"from"?:z,"draft"?:deg}
- {"kind":"revolve","sketch":i,"axis":"x"|"y","origin"?:[a,b],"angleDegrees":deg} (about the sketch's own axis)
- {"kind":"sweep","sketch":i,"path":[{"kind":"straight","length":l} | {"kind":"bend","radius":r,"angleDegrees":deg,"toward":"x"|"-x"|"y"|"-y"}]} (from the sketch plane up +Z)
- {"kind":"loft","sections":[{"sketch":i,"z":z},...],"smooth"?:bool}
- Sheet metal (each with the sheet's rules: "thickness":T, "bendRadius":R (inner), and either "kFactor":K 0–1 (the neutral layer at R + K·T; K from the user's shop, else say it is an estimate) or "bendTable":{"id","sources":[{"id","label","url"?}],"rows":[{"thicknessMM","radiusMM","angleDegrees"?,"kFactor"|"allowanceMM"|"deductionMM","source":id | "estimate":true}]} — the shop's table, a bend outside it refused): {"kind":"sheet-base","sketch":i,…rules,"reverse"?:bool} (a plate T thick from a closed sketch) | {"kind":"sheet-contour","path":[[x,y],…],"side":"left"|"right","width":w,"plane"?:{origin,normal,xAxis},…rules} (an open path, one skin of the sheet, the material to its side looking along it, a bend at each corner, extruded w along the plane's normal; faces .leg<i>.a/.b, .bend<k>.inner/.outer, .start, .end, .front, .back) | {"kind":"sheet-flange","parent":Ref,"edges":[edge name],"length":L,"angleDegrees"?:deg,"bendRadius"?:r,"measure"?:"outer"|"inner"|"tangent","position"?:"material-inside"|"material-outside"|"bend-outside","offsets"?:[a,b],"relief"?:{"kind":"rectangular"|"obround","width":w,"depth":d} | {"kind":"none"}} (an edge flange on a sheet's straight skin edge, bent up from that skin; with offsets its relief is required, width and depth given — no defaults; the sheet's T is the usual estimate) | {"kind":"sheet-corner-relief","parent":Ref,"edges":[corner edge name],"shape":"square"|"round","size":s} (a plate's square corner cut off before flanging its two edges; size at least R + T, round √2 that)
- Skeleton (FRf): {"kind":"skeleton","points":[[x,y,z],…],"segments":[[from,to],…],"constraints"?:[{"kind":"fixed"|"coincident"|"length"|"distance"|"angle"|"parallel"|"perpendicular"|"on-axis"|"on-plane"|"along",…}]} (FRg: solved on add and edit; the result's skeletons: status, dof, redundant, free) — no body; frames on it follow its edits ("follows":{"skeleton":k} in place of points and segments; {"sketch":k}: a sketch's straight edges; {"part":id,"sketch":feature id}: a placed part's sketch, base frames only, its revision pinned — get_part_summary's followed_changed says when to relink).
- Frame (FR2): {"kind":"frame","points":[[x,y,z],…],"segments":[[from,to],…],"section":S,"anchor"?,"offset"?,"roll"?,"mirror"?:bool,"up"?,"overrides"?:[{"member":k,"section"?:S,"anchor"?,"offset"?,"roll"?,"mirror"?}]} — a member along each segment (point indices), each its own body (sides part0, part1, …); a member as frame-member's below; mirror turns the section over across its own y axis; faces .m<k>.<role>, .m<k>.start/.end. No two segments on the same points or overlapping on one line. "corners"?:{"default"?:"mitre"|"butt"|"none","at"?:[{"point":i,"kind","through"?:member}]} finishes points where exactly two members end (mitre: both on the halfway plane, the same section turned alike; butt: through runs on, the other ends on its face; none: square, overlapping); left out, no corner is finished; "multi":"order"|"none" (three or more ends: an ordered trim — the first, by "order" or the larger section, runs through, each next trimmed to the envelopes before it); "tee":"butt"|"cope"|"none" (a member ending on another's length); "at" kinds also "cope" (to the through member's envelope), "order" with "order":[members], and "trim":"face"|"envelope" on a butt (a butt on an open side — an angle's leg end, a round tube, a round corner — is refused BUTT_ON_OPEN_SIDE: trim to the envelope); faces .m<k>.start.mitre, .m<k>.end.butt, .m<k>.end.cope, .m<k>.end.trim. "trims"?:[{"member":k,"end":"start"|"end","plane":{"origin","normal"}} | {…,"body":Ref}] trims an end no joint finishes to a plane (run on to meet it) or to an earlier body (not consumed); crossing members are refused MEMBERS_CLASH
- Structural member (FR1): {"kind":"frame-member","section":S,"start":[x,y,z],"end":[x,y,z],"anchor"?:"centroid"|"origin"|"bottom-left"|…|"top-right","offset"?:[dx,dy],"roll"?:deg,"up"?:[x,y,z]} — the section square to the line start→end, extruded its length; the anchor point on the line (default the centroid), the section moved by offset, its y along up (default +Z) made square to the line (a vertical line takes +X), turned roll°. S, every dimension given (no default sizes or radii; ask for the stock's or say they are estimates): {"kind":"rect-tube","width","height","wall","outerRadius","innerRadius"?} | {"kind":"round-tube","diameter","wall"} | {"kind":"angle","legX","legY","thickness","rootRadius","toeRadius"} | {"kind":"channel","height","width","web","flange","rootRadius","toeRadius"?,"flangeSlope"?} | {"kind":"i-beam","height","width","web","flange","rootRadius","toeRadius","flangeSlope"} (I/H: all fields required, including explicit zero; channel new fields omitted = 0; slope rise/run; flange thickness at overhang midpoint) | {"kind":"tslot","size","cells":1|2,"openSlots"?:0–4 (one cell),"opening","lip","undercut","depth","bore"} | {"kind":"sketch","sketch":i} (a closed sketch, holes allowed). Faces by role: .top/.bottom/.left/.right/.round.*, .bore.*, .back.x/.face.y/.root/.toe.x, .web/.tip.top, .<slot>.floor …, and the ends .start/.end
- {"kind":"hole","parent":Ref,"center":[a,b],"radius":r,"axis"?:"x"|"y"|"z","side"?:"min"|"max","depth"?:d} (omit depth for through)
- {"kind":"fillet","parent":Ref,"edges":[names],"radius":r,"section"?:{"kind":"conic","rho":0..1} | {"kind":"g2","tension"?:0..1}} (or "radii":[{"at":[x,y,z],"radius":r}, …] — 2 to 16 points on the edges, the radius varying between them; then radius is the first point's; any section) | {"kind":"chamfer","parent":Ref,"edges":[names],"distance":d} | {"kind":"shell","parent":Ref,"thickness":t,"open":[face names]}
- {"kind":"union"|"intersect","left":Ref,"right":Ref} | {"kind":"difference","parent":Ref,"tool":Ref} | {"kind":"split","parent":Ref,"axis":"x"|"y"|"z","at":v}
- {"kind":"translate","parent":Ref,"offset":[dx,dy,dz]} | {"kind":"rotate","parent":Ref,"axis":"x"|"y"|"z","angleDegrees":deg} | {"kind":"mirror","parent":Ref,"plane":"xy"|"xz"|"yz"} | {"kind":"scale","parent":Ref,"factor":k} | {"kind":"linear-pattern","parent":Ref,"axis":a,"spacing":s,"count":n} | {"kind":"circular-pattern","parent":Ref,"axis":a,"angleDegrees":deg,"count":n}
Ref = {"node": index of the feature that made a visible body, "side": "solid"} (split halves: "negative"/"positive"). Body key "b5" is {"node":5,"side":"solid"}.`,
    input_schema: { type: 'object', properties: { features: { type: 'array', items: { type: 'object' }, minItems: 1 } }, required: ['features'], additionalProperties: false },
  },
  {
    name: 'edit_feature',
    description: 'Changes an existing feature, as the feature editor does: "values" sets its editable dimensions by key (an extrude also edits its sketch: w, d, c0, c1 for a rectangle; dia, cc0, cc1 for a circle; h height; from; draft — a hole: dia, c0, c1, depth; fillet r; chamfer d; shell t; …). Call it with an index and no values to list the keys. Or pass a whole replacement "feature" node (same rules as add_features). Later features follow the edit.',
    input_schema: { type: 'object', properties: { index: { type: 'integer' }, values: { type: 'object', additionalProperties: { type: ['number', 'string', 'boolean'] } }, feature: { type: 'object' } }, required: ['index'], additionalProperties: false },
  },
  {
    name: 'delete_feature',
    description: 'Deletes a feature (and the sketches only it used). Refused while a later feature uses it. Later features move down one index per deleted node; face and edge names keep their feature ids (`n<k>`), so names in results stay as they were.',
    input_schema: { type: 'object', properties: { index: { type: 'integer' } }, required: ['index'], additionalProperties: false },
  },
  {
    name: 'get_image_layers',
    description: 'The traced outlines of an attached image (a character, logo, icon or silhouette): its silhouette and its flat colour regions, each with colour, share of the figure, region and hole counts and its box within the silhouette, plus the silhouette\'s aspect ratio. Use it before extrude_image_layer.',
    input_schema: { type: 'object', properties: { image: { type: 'integer', description: 'Image number in this conversation (1 = first; default the latest).' } }, additionalProperties: false },
  },
  {
    name: 'extrude_image_layer',
    description: 'Builds a solid from a traced image layer: its outline (with holes and separate islands) scaled so the whole silhouette is width_mm wide, extruded `height` mm, starting `base` mm off the sketch plane. Every layer of an image uses the same scale and placement, so stacking them makes a relief (a keychain, badge, cookie cutter or figure plaque): the silhouette as the base, then colour layers on top of it (base = the base\'s thickness) to raise details like eyes, mouth and outlines. orientation "flat" lies on XY (thickness up +Z); "standing" stands it on XZ (figure upright, thickness towards −Y, `y` sets the plane). Later run_command union can join the layers into one body.',
    input_schema: {
      type: 'object',
      properties: {
        image: { type: 'integer' }, layer: { type: 'string', description: 'Layer id from get_image_layers (default "silhouette").' },
        width_mm: { type: 'number' }, height: { type: 'number' }, base: { type: 'number' },
        orientation: { type: 'string', enum: ['flat', 'standing'] }, at: { type: 'array', items: { type: 'number' }, description: '[x, y] of the silhouette\'s lower-left corner on the sketch plane (default [0, 0]).' },
        y: { type: 'number', description: 'Standing only: the Y of the sketch plane.' },
      },
      required: ['width_mm', 'height'], additionalProperties: false,
    },
  },
  {
    name: 'inflate_image_layer',
    description: 'A rounded three-dimensional version of a traced image layer (a plush, toy or figure look rather than a flat slab). mode "body": each region of the layer (normally the silhouette) becomes a smooth pebble-like solid, depth mm front to back, symmetric about its mid plane, round all along its rim. mode "bump": each region (eyes, nose, cheeks, buttons, a muzzle) becomes a smooth dome standing depth mm out of the front surface of the inflated silhouette, placed where it is in the picture — pass body_depth (the silhouette\'s depth) and the same width_mm/at/orientation. Filled areas are inflated by their outer outline (small holes, like a nose inside a muzzle, are covered); outline strokes are skipped. Bumps stay separate bodies sunk into the surface.',
    input_schema: {
      type: 'object',
      properties: {
        image: { type: 'integer' }, layer: { type: 'string' }, mode: { type: 'string', enum: ['body', 'bump'] },
        width_mm: { type: 'number' }, depth: { type: 'number' }, body_depth: { type: 'number' },
        orientation: { type: 'string', enum: ['flat', 'standing'] }, at: { type: 'array', items: { type: 'number' } }, y: { type: 'number' },
      },
      required: ['width_mm', 'depth'], additionalProperties: false,
    },
  },
  {
    name: 'measure',
    description: 'Measures one face or edge (area, length, radius), or the distance between two (and the angle between planes or straight edges, the normal distance between parallel planes).',
    input_schema: { type: 'object', properties: { a: oneSelector('A face or edge'), b: oneSelector('An optional second face or edge') }, required: ['a'], additionalProperties: false },
  },
  {
    name: 'set_material',
    description: 'Sets what bodies are made of: a material id from the material library (their mass, the BOM and a library part\'s checks read it before the brief\'s material). bodies: body keys (default: all of the part).',
    input_schema: { type: 'object', properties: { material: { type: 'string' }, bodies: { ...nameList, description: 'Body keys (default: all).' } }, required: ['material'], additionalProperties: false },
  },
  {
    name: 'set_stock',
    description: 'Loads machining stock from a person-supplied conversation JSON file, and/or sets allowance per face in mm. file is the attachment reference. Raw rows are refused as ROWS_NOT_FROM_PERSON. File rows merge by id, keeping id, block size [a,b,c] or bar diameter/maxLength, and their original source; remove lists row ids to drop.',
    input_schema: { type: 'object', properties: { file: { type: 'string' }, rows: { type: 'array', description: 'Refused: use a person-supplied file.', items: { type: 'object' } }, remove: { type: 'array', items: { type: 'string' } }, allowance: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'set_casting',
    description: 'Sets a casting pattern\'s inputs (IM8b): machined, the faces machined after casting (flat ones get the machining allowance on the pattern); allowance, your machining allowance (mm a face; unset: the process\'s table by the part\'s size); shrink, your shrinkage (a ratio, mm/mm; unset: the table\'s by the alloy and size); gate, where the metal comes in ([x, y, z] mm on the part: the report\'s hot spots are fed from it, IM8c). The manufacturability report shows them and their sources; cad-cli pattern writes the pattern.',
    input_schema: { type: 'object', properties: { machined: { type: 'array', items: { type: 'string' } }, allowance: { type: 'number' }, shrink: { type: 'number' }, gate: { type: 'array', items: { type: 'number' } } }, additionalProperties: false },
  },
  {
    name: 'set_frame_stock',
    description: 'Loads frame stock from a person-supplied conversation JSON file, and/or sets the saw kerf in mm. file is the attachment reference. Raw rows are refused as ROWS_NOT_FROM_PERSON. File rows merge by id, keeping id, length or lengthMM, count, section and source; remove lists row ids to drop.',
    input_schema: { type: 'object', properties: { file: { type: 'string' }, rows: { type: 'array', description: 'Refused: use a person-supplied file.', items: { type: 'object' } }, remove: { type: 'array', items: { type: 'string' } }, kerf: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'set_frame_sections',
    description: 'Loads section rows or a section table from a person-supplied conversation JSON file. file is the attachment reference; raw rows are refused as ROWS_NOT_FROM_PERSON. remove lists unused row ids. Original source or estimate is retained, with file/turn/hash receipts. Existing members using a replaced row are evaluated before the change is kept.',
    input_schema: { type: 'object', properties: { file: { type: 'string' }, rows: { type: 'array', description: 'Refused: use a person-supplied file.', items: { type: 'object' } }, remove: { type: 'array', items: { type: 'string' } } }, additionalProperties: false },
  },
  {
    name: 'set_welds',
    description: 'Sets the person\'s welds on the part\'s frame joints (FRd1): welds [{joint (an id from weld_list), kind? fillet | butt, size? mm, allRound?, inner? (whether the end\'s inner loop, a tube\'s bore, is welded: yours to say, none assumed), notes?}] replace a joint\'s record; remove: joint ids. Unset, the rule\'s weld: a butt weld at a mitre, a fillet elsewhere, the thinner wall as its size (an estimate). beadOwnership: {version:1, policy:"equal-length"} opts into shared material ownership; null removes it; absent retains it. A policy-only edit is allowed. No policy is added automatically.',
    input_schema: { type: 'object', properties: { welds: { type: 'array', items: { type: 'object' } }, remove: { type: 'array', items: { type: 'string' } }, beadOwnership: { anyOf: [{ type: 'object', properties: { version: { const: 1 }, policy: { const: 'equal-length' } }, required: ['version', 'policy'], additionalProperties: false }, { type: 'null' }] } }, additionalProperties: false },
  },
  {
    name: 'weld_list',
    description: 'The frame\'s weld joints read off the geometry (FRd1): {joints [{label W1…, id, kind mitre | butt | on-face, body, end, meets, face, seamMM (the end face\'s outer loop), seamBasis exact | mesh, innerLoop {mm, welded: yours, null when not said} | null, weldMM, at, centre, weld {kind, sizeMM, sizeBasis set | estimate | none, allRound, notes?}}], totals {count, seamMM}, orphaned (records whose joint is gone), notes}. Say estimated sizes are estimates.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'fit_clearance',
    description: 'A hole–shaft fit from the user\'s fit tables (none built in): hole and shaft faces (their classes as set, or hole_class / shaft_class) — the limits, the least and greatest clearance (µm, negative interference) and kind, and the pair at MMC and LMC by the kernel (overlap, the axes\' offset, the margin; contradicted when a clearance fit meets at MMC); or hole_class, shaft_class and size (mm) alone — the limits. A class with no row for the size says what to load (FIT_TABLE_MISS). Say an estimate row is an estimate.',
    input_schema: { type: 'object', properties: { hole: { type: 'string' }, shaft: { type: 'string' }, hole_class: { type: 'string' }, shaft_class: { type: 'string' }, size: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'mass_properties',
    description: 'Each body\'s volume, surface area, mass by its material (none set: aluminium, said as assumed), centroid, inertia about it (kg·m²) and box.',
    input_schema: { type: 'object', properties: { bodies: { ...nameList, description: 'Body keys (default: all).' } }, additionalProperties: false },
  },
  {
    name: 'interference',
    description: 'Every pair of bodies (or of those given): overlapping pairs with the overlap\'s volume, the others\' smallest clearance and where.',
    input_schema: { type: 'object', properties: { bodies: { ...nameList, description: 'Body keys (default: all).' } }, additionalProperties: false },
  },
  {
    name: 'section',
    description: 'A section across x, y or z at a position: each body it cuts, with the cut\'s area, its regions and its box. The part is not changed.',
    input_schema: { type: 'object', properties: { axis: { type: 'string', enum: ['x', 'y', 'z'] }, at: { type: 'number' } }, required: ['axis', 'at'], additionalProperties: false },
  },
  {
    name: 'wall_thickness',
    description: 'A body\'s thinnest wall (inward from each face to the next wall) with where and on which face; with "below", every face thinner than that.',
    input_schema: { type: 'object', properties: { body: { type: 'string' }, below: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'draft',
    description: 'Draft of a body\'s walls against a pull direction (default +Z), from exact normals — flat and curved faces: each wall\'s least angle in degrees (negative: facing against the pull), its range and class (drafted, steep, straddle: n·d takes both signs, a parting line crosses it), and those under min_deg (default 1).',
    input_schema: { type: 'object', properties: { body: { type: 'string' }, pull: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 }, min_deg: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'set_requirements',
    description: 'Keeps the brief as requirements, each with a check that can be run: {id, source (the user\'s words, quoted exactly as they wrote them: checked against the conversation, SOURCE_NOT_SAID; a requirement you derived is assumed), hard (true: must hold), basis (stated | assumed | ambiguous), subject?, assume?, check: {op: "==" | "<=" | ">=" | "between", query: {fn, …}, value | min and max, tol?, unit?}}. query.fn: bbox {axis, body?}, volume {body?}, mass {body?}, count_solids, count_faces_of_kind {kind: plane | curved, body?}, distance_between {a, b}, radius {face}, hole_diameter {face}, min_wall {body?}, draft_min {body?, pull?}, clearance {a, b: body keys}, gear_center_distance | gear_backlash | gear_contact_ratio | gear_clearance {a, b: the feature ids n<k> of two spur gears, or of a gear and a rack (then the centre distance is the gear axis from the rack pitch line); gear_clearance is minus the depth when the teeth cross}, library_check {feature: the id n<k> of a library part, check: the id of one of its rules — the margin it reports, unknown without its context}, hole_alignment {board: base or a part id holding the board (an imported PCB), features?: standoff ids — the largest offset in mm of their screw axes from its holes}, overhang_area {body?, direction?: build direction, default [0, 0, 1] — the area past the printing process limit}, print_rule {rule: wall | wall-rec | hole | horizontal-hole | gap | cavity | bed-fit | overhang | warp | tip, direction?}, subd_deviation {body?, at?: all | crease — the largest distance of a SubD body’s caps from the limit surface, in mm; crease: only those at crease, corner or boundary vertices}. Faces and edges by name or selector. Write them before modelling. Adds to (or with replace: true, replaces) those there; an id given again replaces its requirement.',
    input_schema: { type: 'object', properties: { requirements: { type: 'array', items: { type: 'object' } }, replace: { type: 'boolean' } }, required: ['requirements'], additionalProperties: false },
  },
  {
    name: 'cut_list',
    description: 'The frame members\' cut list (FR4a): identical members on one row — {rows [{item, quantity, section, material, axisLengthMM (the centroidal axis between the end planes; by volume where an end is coped or trimmed to an envelope or a body: fromVolume), longPointMM, ends [{end, kind (square | mitre | butt | through | cope | trim), mitreDegrees (about the section\'s y), bevelDegrees (about its x)}], massKG each, totalMassKG, pieces: body keys}], totals {quantity, axisLengthMM, massKG}}. Masses use the materials library\'s densities, every one an estimate: say so. nesting (FRb): with stock lengths loaded (set_frame_stock), {bars [{stock, section, lengthMM, pieces, usedMM, kerfMM, offcutMM}], sections [{method exact | first-fit-decreasing, stockMM, lowerBoundMM, optimal, note?}], totals {bars, stockMM, piecesMM, kerfMM, wasteMM}, kerf {mm, basis}, unplaced}; else {error}. csv: true adds the CSV.',
    input_schema: { type: 'object', properties: { csv: { type: 'boolean' } }, additionalProperties: false },
  },
  {
    name: 'check_spec',
    description: 'validate: true also runs the checks on cheap mutants (bodies scaled, parameters ±15%, a subject\'s feature suppressed, a stub box) and lists those that cannot fail (vacuous), cannot be tried (unverified) or are declared invariant. Every report carries the policy: the best snapshot, rounds without progress, a restart hint after two. Runs every requirement\'s check against the part as it stands: {model_hash, summary {pass, fail, unknown, hard_failing}, failures [{req_id, check, measured, expected, delta, entities, feature, hint}], unknowns [{req_id, why}]}; passes as counts only. A mass check on a body without a material is unknown.',
    input_schema: { type: 'object', properties: { validate: { type: 'boolean' } }, additionalProperties: false },
  },
  {
    name: 'apply_ops',
    description: 'Several tool calls as one change, all or nothing: ops [{tool, args, opId?}] run in order, each on what the one before left; one refused and none is applied. dryRun: true tries them and returns what would change (the feature-tree diff, the facts\' change, references that would break) without applying. An opId applied before is skipped, so a retried batch does not apply twice.',
    input_schema: { type: 'object', properties: { ops: { type: 'array', items: { type: 'object', properties: { tool: { type: 'string' }, args: { type: 'object' }, opId: { type: 'string' } }, required: ['tool'] } }, dryRun: { type: 'boolean' } }, required: ['ops'], additionalProperties: false },
  },
  {
    name: 'run_script',
    description: 'Builds or changes the part with a short script, all or nothing (as apply_ops): each command or feature call in it runs as that tool call, in order; the first refusal or error stops it with its line and nothing is applied. dryRun: true tries it and returns what would change. The result lists each call with its line and the feature ids it made, and the names the script set. The language (JS-like): `const x = expr` (or `const a = 1, b = 2`), `for (const i of range(n)) { … }`, `if (c) { … } else { … }`, `//` comments; numbers, "strings", [lists], {objects}, + - * / %, comparisons, && || !, a ? b : c. A command is called by its name with "-" as "_" — box, cylinder, hole, fillet, chamfer, shell, linear_pattern, union, … — as cmd(selection?, {values}), values by run_command\'s keys; it returns a handle to the feature it made: h.top, h.bottom, h.cut, h.side0 (or h.side(2), h.side("e3")) are its faces, h.body its body, h.id its id. edge(faceA, faceB) is the edge between two faces; face({normal: [0, 0, 1], pick: "max"}) a face by direction; a selection may be a list. feature({kind: …}) adds a feature node (as add_features takes it; a handle in it is that feature\'s index, ref(h, side) a body reference); edit(h, {values}) and remove(h) edit or delete one; node("f3") or node(index) is a feature there before. requirements([{id, source, hard?, check}]) sets the requirements (as set_requirements); brief({field: {value, basis, source?, why?}}) the brief (as set_brief). Built in: range, min, max, abs, sqrt, round, floor, ceil, sin, cos, tan (degrees), PI. Example: const p = box({w: 80, d: 40, h: 8}); for (const i of range(3)) { hole(p.top, {d: 5, x: 20 + 20 * i, y: 20}) } fillet([edge(p.top, p.side0)], {radius: 1}). At most 200 calls, 2000 loop iterations, 20 000 characters.',
    input_schema: { type: 'object', properties: { source: { type: 'string', description: 'The script.' }, dryRun: { type: 'boolean' } }, required: ['source'], additionalProperties: false },
  },
  {
    name: 'checkpoint',
    description: 'Keeps the part as it is under a name, to restore or compare later (this session; the last 20).',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false },
  },
  {
    name: 'restore',
    description: 'Puts the part back as a checkpoint kept it.',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false },
  },
  {
    name: 'diff',
    description: 'What changed between two states of the part, feature by feature (by stable id: added, changed before → after, deleted, moved), and in parameters and requirements. from and to: a checkpoint name, "best" or "current" (default).',
    input_schema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, additionalProperties: false },
  },
  {
    name: 'propose',
    description: 'Proposes a change without making it: title, ops (as apply_ops takes them), plan (a few lines: what and why), requirements (the ids it serves). The ops are tried on a copy; the result is the feature-tree diff, the facts\' change, references it would break, the checks before and after, and a risk badge. The part stays as it is: the user accepts or rejects the proposal in the studio, and rejected ones are kept. Propose instead of changing when the user asks for options or a review, or when the change is risky (deletes features, breaks references or hard requirements). Changes to an assembly (add_part, place_part, delete_part, a part tool with "part"), its mates, the drawing or a locked part can only be proposed: ops may hold those tools too (add_part ids run p1, p2, … in order, so later ops can name them).',
    input_schema: { type: 'object', properties: { title: { type: 'string' }, ops: { type: 'array', items: { type: 'object', properties: { tool: { type: 'string' }, args: { type: 'object' }, opId: { type: 'string' } }, required: ['tool'] } }, plan: { type: 'string' }, requirements: { type: 'array', items: { type: 'string' } } }, required: ['title', 'ops'], additionalProperties: false },
  },
  {
    name: 'accept_proposal',
    description: 'Accepts an open proposal as the agent, when the autonomy the user set allows it: L3 low or medium risk changing no hard requirement, L4 any breaking no hard requirement; never one needing the user\'s approval (an assembly, mates, a drawing, a locked part). leave_out: feature ids of the proposal to leave out (what depends on them goes too). A proposal made on a part that has changed since is first made again on the part as it is and returned (rebased, not accepted): read it, then call again.',
    input_schema: { type: 'object', properties: { id: { type: 'string' }, leave_out: { type: 'array', items: { type: 'string' } } }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'list_proposals',
    description: 'The open proposals (all: true for accepted and rejected ones too, with who decided, when and why): id, title, summary, risk, and stale when the part changed since.',
    input_schema: { type: 'object', properties: { all: { type: 'boolean' } }, additionalProperties: false },
  },
  {
    name: 'restore_best',
    description: 'Puts the part back to the best snapshot check_spec has seen this session (most requirements passing, then the smallest misses): the restart point when repairs stop making progress.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'render_views',
    description: 'The part as engineering views on one image: front, top, right and isometric, edges by exact hidden-line projection (visible solid, hidden dashed), each face that shows numbered (the legend gives its name). Look at it at milestones or when something seems wrong, not after every step. highlight: faces to fill red (e.g. a failed check\'s); section: cut first across an axis at a position.',
    input_schema: { type: 'object', properties: { highlight: { ...nameList, description: 'Face names to fill red.' }, section: { type: 'object', properties: { axis: { type: 'string', enum: ['x', 'y', 'z'] }, at: { type: 'number' } }, required: ['axis', 'at'], additionalProperties: false } }, additionalProperties: false },
  },
  {
    name: 'inspect',
    description: 'Detail of faces and edges: a face\'s kind, area, normal or axis, radius, centre, the faces next to it and the feature that made it; an edge\'s ends, chord, line or curve, its two faces and the feature that made it.',
    input_schema: { type: 'object', properties: { faces: selectorList('Faces'), edges: selectorList('Edges') }, additionalProperties: false },
  },
  {
    name: 'select',
    description: 'Highlights faces, edges or bodies in the user’s viewport when the turn ends (for example to show what was filleted). Does not change the part.',
    input_schema: { type: 'object', properties: { faces: selectorList('Faces'), edges: selectorList('Edges'), bodies: nameList }, additionalProperties: false },
  },
  ...CAGE_TOOLS,
  ...DRAWING_TOOLS,
];

/** `response_format` on the tools that list the part (A2.4). */
const RESPONSE_FORMAT = { type: 'string', enum: ['concise', 'detailed'], description: 'concise: facts and what changed only; detailed: every body\'s faces and edges (paged); default: those when the part is small.' };
for (const t of PART_TOOLS) if (MUTATORS.has(t.name) || t.name === 'get_part_summary') (t.input_schema as { properties: Record<string, unknown> }).properties.response_format = RESPONSE_FORMAT;
/** `because` on the tools that change the part (A3.2): why a change may break a hard requirement that passed. */
for (const t of PART_TOOLS) if (MUTATORS.has(t.name) && t.name !== 'set_requirements') (t.input_schema as { properties: Record<string, unknown> }).properties.because = { type: 'string', description: 'Why this change may break a hard requirement that passed at the last check (else such a change is refused).' };

/** A9-2: tools that are a part's own but not part tools (they read or write the document's settings): they take `part` too. */
const PART_SCOPED: ReadonlySet<string> = new Set(['check_printability', 'orient_for_print', 'set_brief', 'get_brief']);
const PART_ARGUMENT = { type: 'string', description: 'The part to work on: an instance id from add_part (default "base", the document\'s own part).' };
const withPartArgument = (t: ToolDefinition): ToolDefinition => PART_SCOPED.has(t.name) ? { ...t, input_schema: { ...t.input_schema, properties: { ...(t.input_schema.properties as object), part: PART_ARGUMENT } } } : t;
/** Each tool's arguments, from its schema (`part` on the part tools); null for a schema that takes any. */
let argumentsOf: Map<string, ReadonlySet<string> | null> | null = null;
/** Whether a tool takes an argument (a schema that takes any: yes). */
export function takesArgument(name: string, key: string): boolean { return !unknownArguments(name, { [key]: true }); }
/** Why a call's arguments are refused (UNKNOWN_ARGUMENT, naming each and what the tool takes), or null. */

export function unknownArguments(name: string, args: Record<string, unknown>): string | null {
  argumentsOf ??= new Map(TOOLS.map(t => { const sc = t.input_schema as { properties?: Record<string, unknown>; additionalProperties?: unknown }; return [t.name, sc.additionalProperties === false ? new Set(Object.keys(sc.properties ?? {})) : null]; }));
  const takes = argumentsOf.get(name);
  if (!takes) return null;
  const extra = Object.keys(args).filter(k => !takes.has(k));
  if (!extra.length) return null;
  const v2 = V2_OF.get(name), shown = v2 ?? name, list = [...takes].join(', ') || 'none';
  return `[UNKNOWN_ARGUMENT] ${shown} takes no ${extra.map(k => `"${k}"`).join(', ')}: its arguments are ${list}.${extra.includes('part') ? ' It works on the whole document, not one part.' : ''}`;
}

/** Part tools take `part` (an instance id; default the base part); then the assembly tools. */
export const TOOLS: ToolDefinition[] = [
  { name: 'load_rows', description: 'Loads strict shop rows only from a JSON file supplied by the person in this conversation. file is an opaque reference listed with the user attachments, never a path, URL, inline rows or suppliedBy claim. Keeps the original source/estimate and adds a file/turn/hash receipt per row. Kinds use the existing domain validators. fits accepts tables, sections accepts section rows or a section table, stock is machining stock, frame-stock is bar lengths, fasteners are bought screws, bolts, nuts and washers (kind, size as M6, lengthMM, designation; a fastener placed as its own part is the BOM line of the row of its kind, size and length). bend requires feature: the index of an existing sheet-base or sheet-contour, whose bend table is replaced. All edits keep the current proposal and approval gates.', input_schema: { type: 'object', properties: { kind: { type: 'string', enum: [...ROW_KINDS] }, file: { type: 'string' }, feature: { type: 'integer', minimum: 0 }, part: PART_ARGUMENT }, required: ['kind', 'file'], additionalProperties: false } },
  ...PART_TOOLS.map(t => t.name === 'select' ? t : { ...t, input_schema: { ...t.input_schema, properties: { ...(t.input_schema.properties as object), part: PART_ARGUMENT } } }),
  ...ASSEMBLY_TOOLS.map(withPartArgument),
  ...ROBOT_TOOLS,
  ...OUTPUT_TOOLS,
  ...BRIEF_TOOLS.map(withPartArgument),
  ...QUESTION_TOOLS,
  ...REFERENCE_TOOLS,
  ...DRAFT_TOOLS,
  ...STANDARDS_TOOLS,
];

export const SYSTEM_PROMPT = `You are the modeling assistant inside barocss CAD Studio, a parametric part modeler. The user describes a part or a change; you build it with the tools, which edit the part's feature tree exactly like the studio's own commands. Every change you make is evaluated by the geometry kernel and the result (bodies, volumes, bounds, face and edge names, or the exact refusal) comes back to you.

Conventions: millimetres; Z is up; sketches and boxes start on the XY plane at Z 0 unless placed otherwise; a box's x, y are its minimum corner. Holes go through the whole body by default. Faces and edges are referred to by their persistent names from results (e.g. the top face of the first extrude is "n1.top", a vertical corner edge "n1.side0|n1.side1"); vertical edges are the straight edges "along z". Instead of a name, a face or edge may be a selector — {"feature": 1, "role": "top"}, {"normal": [0, 0, 1], "pick": "max"}, {"between": [face, face]}: the result reports the name it resolved to (use that name afterwards), and one that fits several faces is refused with the candidates. Names keep their feature id when features are added, moved or deleted.

Start from the brief: set_brief with its purpose, process and material (required) and what else the user said — stated with their words quoted, everything you chose yourself assumed with why, never stated; get_brief lists the gaps. The brief's material is the base part's; a body or a placed part of another material gets it with set_material. Then write the requirements. A part built to fit something (get_references: locked reference bodies) is built on their datums (add_datum; a sketch on {"datum": id}) and kept out of their keep-outs (add_keepout, check_keepouts) — never on their faces, which no feature may use.

Work like an engineer: prefer the commands (box, cylinder, hole, fillet, chamfer, shell, patterns, Booleans) and use add_features for profiles and solids no command makes. Make each change, read the result — its facts (solids, volume, mass, centroid, box, face/edge/vertex counts) and change (what moved since the last step) — and correct yourself when a tool refuses or a volume or bound is not what the request implies; inspect gives a face's or edge's detail (neighbours, the feature that made it). A mass is only a fact once the body's material is set: facts say mass_assumed when a body has none (aluminium taken); set the material, or state the assumption, before checking a mass against a requirement. mass_properties, interference (overlap and clearance), section, wall_thickness and draft analyse the part without changing it. When the user asks for options or a review, or a change is risky, propose it (propose) instead of making it: the user accepts or rejects it. Each message says your autonomy level: at L1 propose every change; at L2 (the default) change values of one feature or of parameters directly — anything more in a turn (several features; adding, deleting or moving features; what a feature is built on) you propose, except on an empty part, whose first build you make directly; at L3 and L4 you may accept proposals yourself (accept_proposal) within its limits. Before modelling a brief, write its requirements with set_requirements (quote the words; say what you assumed), and run check_spec after changes and before saying you are done. Ask only what blocks the design — ask_user, at most 5 questions a batch and 2 batches, each naming the gap it settles (a required brief field, or a hard requirement whose value you assumed); assume everything else, with why, and say what you chose: nothing waits on the answers. When the user attaches images (a sketch, a photo, a dimensioned drawing), model the part they show: take dimensions written on a drawing as given; read views (top, front, side) together; for a photo or an undimensioned sketch, estimate proportions from the picture and scale them by any one known size, and if no size is given or implied, ask for one key dimension (ask_user, within the batches) and build at an assumed size meanwhile, said so. Always say which dimensions you read and which you assumed.

For a part of many steps or repeated features, write it as one run_script instead of many calls: loops and arithmetic in it, each command's handle naming its faces for the next; a refused line comes back with its number, nothing applied, so fix that line and run the script again.

For the part's 2D drawing: drawing_issues and tolerance_suggestions read it; auto_dimension (layout and dimensions), fix_drawing, accept_tolerances and set_drawing change it, and a drawing change is always the user's to accept, so make those as ops of propose. When you report tolerances, say which suggestions are estimates and which come from the fastener data.

A picture that is not an engineering drawing — a character, mascot, logo or icon bitmap — has been traced for you: get_image_layers lists its silhouette and colour regions, and extrude_image_layer turns them into solids at one shared scale. Unless the user asks otherwise, make a relief of it: the silhouette as a base about 3–5 mm thick at a size that suits the request (around 60 mm wide if none is given), then the colour layers that carry the character's features raised 0.6–2 mm on top of the base (base = the base's thickness), the small dark details (eyes, outlines) highest. Skip layers that are just the main body colour or the background. When the user wants it three-dimensional or "realistic" (a figure, toy, plush, 실사화), use inflate_image_layer: the silhouette as a rounded body (depth about 35–50 % of its width; orientation "standing" for a figure that stands up), then the features as bumps on it (eyes, nose, muzzle, cheeks; 1–4 mm), each from its colour layer — leave out the body colour itself and thin outline strokes. Add what the picture implies but a silhouette cannot show — a flat base to stand on, a separate inflated part — with the other tools, sized from the picture's proportions; spheres are a revolved half-circle loop (add_features: a loop sketch of a line and an arc, revolved 360° about its axis). Say which approach you took.

For a machine, mechanism or anything made of several parts (a gearbox, a hinge, a vice, a robot arm, furniture), make an assembly. Assembly changes always need the user's approval, so you propose them: build the main or fixed part as the base part directly, then propose the rest — ops that add each other part with add_part (ids p1, p2, … in order) and build it with the part tools and "part": its id, in its own coordinates (so a shaft is modelled along its own Z, centred), then place it with mates — concentric for shafts in bores and pins in holes, coincident or distance for faces that sit on each other, angle for set orientations — and read the proposal's result: what each part can still do, or why a mate was refused. Copy repeated parts with add_part copy_of. Check the whole with get_assembly once the user has accepted it. For a robot or a mechanism that moves, get_joints reads the assembly as links and joints from its base link (what each pair's mates leave free); set its base link and joint limits with set_joints, as ops of propose.

For a smooth, organic shape (a handle, a mouse shell, a bottle), start from run_command subd-box, subd-torus or subd-tube and shape its cage: subd_select finds faces (by the way they face, or a box), vertices, loops and rings, and the open edges; subd_extrude, subd_insert_loop (its "t" places a holding loop near an edge, for a tighter rounding) and subd_move shape it; subd_crease makes edges sharp; subd_fill, subd_bridge, subd_weld and subd_delete mend or open it; subd_cage reports its validation. Moving vertices is a value edit; changing the cage's topology is proposed for the user.

Finish with one or two sentences: what was built and its key numbers (volume, overall size). The user can undo your whole turn with one undo.`;
