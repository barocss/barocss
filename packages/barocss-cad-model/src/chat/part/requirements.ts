// The v2 `requirements` group's handlers (R3, moved verbatim from chat/tools.ts's runPartTool): the part's
// requirements, set from the brief, and the spec checked against them.
import { saidIn } from '../brief';
import { checkRequirement, checkSpec, expectedOf, newPolicy, updatePolicy, validateSuite } from '../spec';
import type { Requirement } from '../../engine/schema/spec';
import { type ChatState, type Evaluate, type ToolOutcome, type PartHandler, json, fail } from '../toolKit';

async function setRequirementsTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  const list = Array.isArray(args.requirements) ? args.requirements : null;
  if (!list) return fail(state, 'Pass "requirements": a list of {id, source, hard, basis?, subject?, assume?, check: {op, query, value | min, max, tol?, unit?}}.');
  for (const r of list) { const why = checkRequirement(r); if (why) return fail(state, why); }
  const ids = list.map(r => (r as Requirement).id); if (new Set(ids).size !== ids.length) return fail(state, 'Requirement ids repeat.');
  // (The user's say, A6.2: only the user confirms; a stated source is their words, checked against the conversation
  // when there is one; what the user stated or confirmed is not replaced or dropped by an assumption.)
  const given = list as Requirement[], own = (r: Requirement) => !!r.confirmed || r.said === 'verified';
  for (const r of given) {
    if (r.confirmed !== undefined || r.said !== undefined) return fail(state, `[CONFIRM_IS_THE_USERS] ${r.id}: only the user confirms a requirement, in the studio; leave "confirmed" and "said" out.`);
    if ((r.basis ?? 'stated') === 'stated' && state.turns && !saidIn(r.source, state.turns)) return fail(state, `[SOURCE_NOT_SAID] ${r.id}: "${r.source}" is not in what the user wrote this conversation; quote their words exactly, or say it is assumed.`);
  }
  for (const was of state.doc.requirements ?? []) {
    if (!own(was)) continue;
    const next = given.find(r => r.id === was.id);
    if (next ? (next.basis ?? 'stated') !== 'stated' : args.replace === true) return fail(state, `[STATED_KEPT] ${was.id} was ${was.confirmed ? `confirmed by ${was.confirmed.by}` : 'stated by the user'} ("${was.source}"): an assumption does not ${next ? 'replace' : 'drop'} it.`);
  }
  const marked = given.map(r => ((r.basis ?? 'stated') === 'stated' ? { ...r, said: state.turns ? 'verified' as const : 'unverified' as const } : r));
  const kept = args.replace === true ? [] : (state.doc.requirements ?? []).filter(r => !ids.includes(r.id));
  const doc = { ...state.doc, requirements: [...kept, ...marked] };
  return { state: { ...state, doc }, content: json({ ok: true, requirements: doc.requirements.map(r => ({ id: r.id, hard: r.hard, check: `${r.check.query.fn} ${expectedOf(r.check)}` })) }), isError: false, changed: true, summary: `${list.length} requirement${list.length === 1 ? '' : 's'} set` };
}
async function checkSpecTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  if (!state.doc.requirements?.length) return fail(state, 'There are no requirements yet: set_requirements first, from the brief.');
  const { outcomes, ...report } = await checkSpec(state.doc, state.bodies, evaluate);
  // (validate: the suite against cheap mutants, to catch checks that cannot fail; the policy: best, rounds, hint.)
  const validation = args.validate === true ? await validateSuite(state.doc, state.bodies, evaluate, outcomes) : undefined;
  const turns = typeof process !== 'undefined' && process.env?.CAD_MAX_TURNS ? Number(process.env.CAD_MAX_TURNS) : undefined;
  const { policy, out } = updatePolicy(state.policy ?? newPolicy(), state.doc, report, outcomes, turns);
  return { state: { ...state, policy }, content: json({ ...report, ...(validation ?? {}), policy: out }), isError: false, changed: false, summary: `${report.summary.pass} pass, ${report.summary.fail} fail, ${report.summary.unknown} unknown` };
}

/** The requirement group's handlers, by v1 tool name (R3). */
export const REQUIREMENT_HANDLERS: Readonly<Record<string, PartHandler>> = { set_requirements: setRequirementsTool, check_spec: checkSpecTool };
