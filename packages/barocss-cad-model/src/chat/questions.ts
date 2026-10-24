// Clarifying questions (A6.2, O25): the agent asks only what blocks the design, in at most two batches of at most five,
// and assumes the rest, said so and editable. The tool layer holds the policy: a question names what it settles — a
// gap get_brief reports on a required field, or a hard requirement whose value was assumed — and anything else is
// refused, to be made an assumption. The user answers in the studio's Specify panel (or skips: nothing is blocked);
// an answer is written into the brief or the requirement as the user's, confirmed, and sent to the chat as one message.
import type { StudioDoc } from '../engine/doc';
import { badValue, briefGaps, readBrief, REQUIRED } from './brief';
import { BRIEF_FIELDS, PROCESSES } from '../engine/schema/brief';
import type { Brief, BriefKey, Field } from '../engine/schema/brief';
import type { Requirement } from '../engine/schema/spec';
import { confirmDimension, DRAFT_CODES, unconfirmed } from './drafts';
import type { Blocks, Question, Batch, QuestionLog, AskCode } from '../engine/schema/questions';
import { isRefusal } from '../engine/refusal';

export const MAX_QUESTIONS = 5, MAX_BATCHES = 2;

export const readQuestions = (raw: unknown): QuestionLog => (raw && typeof raw === 'object' && (raw as QuestionLog).version === 1 && Array.isArray((raw as QuestionLog).batches) ? raw as QuestionLog : { version: 1, batches: [] });
const blocksKey = (b: Blocks) => ('field' in b ? `field:${b.field}` : 'requirement' in b ? `requirement:${b.requirement}` : `dimension:${b.dimension}`);
/** A hard requirement whose value the user has not given: assumed or ambiguous, and not confirmed. */
const openHard = (r: Requirement) => r.hard && (r.basis === 'assumed' || r.basis === 'ambiguous') && !r.confirmed;

/** What a question may settle now: the required brief fields get_brief reports as gaps, and the open hard requirements. */
export function blockingTargets(doc: StudioDoc): Blocks[] {
  const fields = briefGaps(readBrief(doc.brief)).filter(g => REQUIRED.includes(g.field)).map(g => ({ field: g.field }));
  // (A6.4: a draft's dimension not yet confirmed — from an image or a drawing — may be asked about too.)
  return [...fields, ...(doc.requirements ?? []).filter(openHard).map(r => ({ requirement: r.id })), ...unconfirmed(doc).map(u => ({ dimension: u.key }))];
}

/** Why a batch may not be asked (typed), or null. */
export function checkBatch(doc: StudioDoc, raw: unknown): { code: AskCode; message: string } | null {
  if (!Array.isArray(raw) || !raw.length) return { code: 'BAD_QUESTION', message: '"questions" is a list of 1–5 {id, text, kind, options?, unit?, blocks: {field} | {requirement}}.' };
  if (raw.length > MAX_QUESTIONS) return { code: 'TOO_MANY', message: `${raw.length} questions: at most ${MAX_QUESTIONS} a batch. Ask the ones that block the design; assume the rest and say so.` };
  const log = readQuestions(doc.questions);
  if (log.batches.some(b => b.status === 'open')) return { code: 'OPEN_BATCH', message: `Batch ${log.batches.find(b => b.status === 'open')!.n} is still open in the user's Specify panel: carry on with your assumptions said, and read their answers when they come.` };
  if (log.batches.length >= MAX_BATCHES) return { code: 'BATCHES_USED', message: `Both batches are used (at most ${MAX_BATCHES} a brief): assume what is left and say so; the user can change any assumption.` };
  const targets = new Set(blockingTargets(doc).map(blocksKey)), ids = new Set<string>(), seen = new Set<string>();
  for (const [i, q] of (raw as Record<string, unknown>[]).entries()) {
    const at = `questions[${i}]`;
    if (!q || typeof q !== 'object' || typeof q.id !== 'string' || !q.id || ids.has(q.id)) return { code: 'BAD_QUESTION', message: `${at}: each question has its own id.` };
    ids.add(q.id);
    if (typeof q.text !== 'string' || !q.text.trim() || q.text.length > 300) return { code: 'BAD_QUESTION', message: `${q.id}: its text is 1–300 characters.` };
    if (q.kind !== 'choice' && q.kind !== 'number' && q.kind !== 'text') return { code: 'BAD_QUESTION', message: `${q.id}: kind is choice, number or text.` };
    if (q.kind === 'choice' && (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 8 || q.options.some(o => typeof o !== 'string' || !o.trim() || o.length > 80))) return { code: 'BAD_QUESTION', message: `${q.id}: a choice has 2–8 options of at most 80 characters.` };
    if (q.unit !== undefined && (typeof q.unit !== 'string' || q.unit.length > 20)) return { code: 'BAD_QUESTION', message: `${q.id}: unit is a short text.` };
    const b = q.blocks as Record<string, unknown> | undefined;
    const valid = !!b && typeof b === 'object' && Object.keys(b).length === 1 && (typeof b.field === 'string' || typeof b.requirement === 'string' || typeof b.dimension === 'string');
    if (!valid) return { code: 'BAD_QUESTION', message: `${q.id}: "blocks" is {field: a brief field}, {requirement: a requirement id} or {dimension: a draft dimension F<k>.<name>} — what the design cannot go on without.` };
    const key = blocksKey(b as Blocks);
    if (!targets.has(key)) return { code: 'NOT_BLOCKING', message: `${q.id}: ${'dimension' in (b as object) ? `the draft dimension ${String(b.dimension)} is not an unconfirmed one` : 'field' in (b as object) ? `the brief's ${String(b.field)} is ${(BRIEF_FIELDS as readonly string[]).includes(String(b.field)) ? (REQUIRED.includes(b.field as BriefKey) ? 'already stated' : 'not a required field') : 'not a field'}` : `${String(b.requirement)} is not a hard requirement with an assumed value`}, so it blocks nothing: make it an assumption (set_brief or set_requirements, basis assumed, say why). What may be asked now: ${[...targets].join(', ') || 'nothing'}.` };
    if (seen.has(key)) return { code: 'BAD_QUESTION', message: `${q.id}: another question already settles ${key}.` };
    seen.add(key);
    if ('field' in (b as object) && b.field === 'process' && q.kind === 'choice' && (q.options as string[]).some(o => !(PROCESSES as readonly string[]).includes(o))) return { code: 'BAD_QUESTION', message: `${q.id}: the process options are among ${PROCESSES.join(', ')}.` };
    if (('requirement' in (b as object) || 'dimension' in (b as object)) && q.kind !== 'number') return { code: 'BAD_QUESTION', message: `${q.id}: a ${'dimension' in (b as object) ? 'dimension' : 'requirement\'s value'} is asked as a number.` };
  }
  return null;
}

/** The batch asked: added to the document's question log, open in the Specify panel. */
export function askBatch(doc: StudioDoc, questions: Question[]): { doc: StudioDoc; batch: Batch } {
  const log = readQuestions(doc.questions), batch: Batch = { n: log.batches.length + 1, questions: questions.map(q => ({ id: q.id, text: q.text, kind: q.kind, ...(q.options ? { options: q.options } : {}), ...(q.unit ? { unit: q.unit } : {}), blocks: q.blocks })), status: 'open' };
  return { doc: { ...doc, questions: { version: 1, batches: [...log.batches, batch] } }, batch };
}

/** What is worth a check in the Specify panel: the brief's and the requirements' assumptions, each editable. */
export function assumptionsOf(doc: StudioDoc): ({ field: BriefKey; value: unknown; why?: string } | { requirement: string; value: number | undefined; why?: string })[] {
  const b = readBrief(doc.brief), out: ReturnType<typeof assumptionsOf> = [];
  for (const k of BRIEF_FIELDS) { const f = b?.[k] as Field<unknown> | undefined; if (f && f.basis !== 'stated') out.push({ field: k, value: f.value, ...(f.why ? { why: f.why } : {}) }); }
  for (const r of doc.requirements ?? []) if ((r.basis === 'assumed' || r.basis === 'ambiguous') && !r.confirmed) out.push({ requirement: r.id, value: r.check.op === 'between' ? undefined : r.check.value, ...(r.assume ? { why: r.assume } : {}) });
  return out;
}

/** A value for a brief field from what the user typed or chose (a number for quantity; the text otherwise). */
function fieldValue(key: BriefKey, a: string | number): unknown {
  if (key === 'quantity') return typeof a === 'number' ? a : Number(String(a).trim());
  if (key === 'interfaces') return String(a).split(/[;\n]/).map(x => x.trim()).filter(Boolean);
  return String(a).trim();
}
const userField = (f: Field<unknown> | undefined, value: unknown, words: string, at: string): Field<unknown> => ({ ...(f?.why ? { why: f.why } : {}), value, basis: 'stated', source: words, said: 'verified', confirmed: { by: 'user', at } });

/**
 * The user's answers to the open batch (null: skipped): each written where it belongs as the user's, stated and
 * confirmed; the batch answered (or skipped, if every answer was); the message that tells the agent. A value that does
 * not fit is refused before anything is written.
 */
export function answerBatch(doc: StudioDoc, answers: Record<string, string | number | null>, at: string): { doc: StudioDoc; message: string } | { error: string } {
  const log = readQuestions(doc.questions), open = log.batches.find(b => b.status === 'open');
  if (!open) return { error: 'No questions are open.' };
  let brief: Brief | undefined = readBrief(doc.brief), reqs = doc.requirements ?? [], reqDoc = doc;
  const lines: string[] = [];
  for (const q of open.questions) {
    const a = answers[q.id];
    if (a === null || a === undefined || (typeof a === 'string' && !a.trim())) { lines.push(`- ${q.text} → (skipped: carry on with your assumption)`); continue; }
    const words = String(a).trim();
    if ('dimension' in q.blocks) {
      // (A draft's dimension, A6.4: confirmed at the answer, its features re-driven.)
      const v = typeof a === 'number' ? a : Number(words);
      try { reqDoc = confirmDimension(reqDoc, q.blocks.dimension, v, at); } catch (e) { return { error: `${q.text}: ${isRefusal(e, ...DRAFT_CODES) ? e.message.replace(/^\[[A-Z_]+\] /, '') : String(e)}` }; }
    } else if ('field' in q.blocks) {
      const key = q.blocks.field, v = fieldValue(key, a), bad = badValue(key, v);
      if (bad) return { error: `${q.text}: the answer is ${bad}.` };
      brief = { ...(brief ?? { version: 1 }), [key]: userField(brief?.[key] as Field<unknown> | undefined, v, words, at) } as Brief;
    } else {
      const id = q.blocks.requirement, v = typeof a === 'number' ? a : Number(words);
      if (!Number.isFinite(v)) return { error: `${q.text}: the answer is a number.` };
      if (!reqs.some(r => r.id === id)) return { error: `${q.text}: requirement ${id} is gone.` };
      reqs = reqs.map(r => (r.id !== id ? r : { ...r, basis: 'stated' as const, said: 'verified' as const, confirmed: { by: 'user', at }, check: r.check.op === 'between' ? r.check : { ...r.check, value: v } }));
    }
    lines.push(`- ${q.text} → ${words}${q.unit ? ` ${q.unit}` : ''}`);
  }
  const skipped = open.questions.every(q => answers[q.id] === null || answers[q.id] === undefined || (typeof answers[q.id] === 'string' && !(answers[q.id] as string).trim()));
  const batches = log.batches.map(b => (b !== open ? b : { ...b, status: skipped ? 'skipped' as const : 'answered' as const, answers: Object.fromEntries(open.questions.map(q => [q.id, answers[q.id] ?? null])), at }));
  const out: StudioDoc = { ...reqDoc, questions: { version: 1, batches }, ...(reqs.length ? { requirements: reqs } : {}) };
  if (brief) out.brief = brief;
  return { doc: out, message: `${skipped ? 'I skipped your questions' : 'My answers to your questions'} (batch ${open.n}):\n${lines.join('\n')}` };
}

/** Accept all as they are: every listed assumption confirmed by the user, and the message that says so. */
export function acceptAssumptions(doc: StudioDoc, at: string): { doc: StudioDoc; message: string; count: number } {
  const list = assumptionsOf(doc), b = readBrief(doc.brief);
  if (!list.length) return { doc, message: '', count: 0 };
  const brief = b ? { ...b } : undefined;
  for (const x of list) if ('field' in x && brief) (brief as unknown as Record<string, unknown>)[x.field] = { ...(brief[x.field] as Field<unknown>), basis: 'stated', confirmed: { by: 'user', at } };
  const reqs = (doc.requirements ?? []).map(r => (list.some(x => 'requirement' in x && x.requirement === r.id) ? { ...r, basis: 'stated' as const, confirmed: { by: 'user', at } } : r));
  const out: StudioDoc = { ...doc, ...(reqs.length ? { requirements: reqs } : {}) };
  if (brief) out.brief = brief;
  const names = list.map(x => ('field' in x ? x.field : x.requirement));
  return { doc: out, count: list.length, message: `I accept your ${list.length} assumption${list.length === 1 ? '' : 's'} as they are: ${names.join(', ')}.` };
}

// ——— The tool (A6.2): ask_user.
export const QUESTION_TOOL_NAMES = new Set(['ask_user']);
export const QUESTION_TOOLS = [{
  name: 'ask_user',
  description: `Asks the user what blocks the design, in the studio's Specify panel: at most ${MAX_QUESTIONS} questions a batch, at most ${MAX_BATCHES} batches a brief, one batch open at a time. Each question {id, text, kind: choice | number | text, options? (a choice's 2–8), unit?, blocks} names what it settles in "blocks": {field: a required brief field get_brief reports as a gap (purpose, process, material missing, assumed or ambiguous)} or {requirement: a hard requirement whose value you assumed} or {dimension: a draft dimension not yet confirmed (get_drafts), asked as a number}. Anything else blocks nothing and is refused (NOT_BLOCKING): assume it (set_brief or set_requirements, basis assumed, with why) and say so — the user sees every assumption and can change it. Also refused: TOO_MANY, BATCHES_USED, OPEN_BATCH, BAD_QUESTION. Nothing waits on the answers: carry on with your assumptions said; the user's answers come back as their message, written into the brief and requirements as stated and confirmed.`,
  input_schema: { type: 'object', properties: { questions: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' }, kind: { type: 'string', enum: ['choice', 'number', 'text'] }, options: { type: 'array', items: { type: 'string' } }, unit: { type: 'string' }, blocks: { type: 'object', properties: { field: { type: 'string' }, requirement: { type: 'string' } } } }, required: ['id', 'text', 'kind', 'blocks'] } } }, required: ['questions'], additionalProperties: false },
}];
/** Runs ask_user on the document. */
export function runQuestionTool(doc: StudioDoc, args: Record<string, unknown>): { doc: StudioDoc; content: unknown; changed: boolean; summary: string } | { error: string } {
  const why = checkBatch(doc, args.questions);
  if (why) return { error: `[${why.code}] ${why.message}` };
  const { doc: next, batch } = askBatch(doc, args.questions as Question[]);
  return { doc: next, content: { ok: true, batch: batch.n, of: MAX_BATCHES, asked: batch.questions.map(q => q.id), note: 'The user answers in the Specify panel, or skips; nothing waits on it. Carry on with your assumptions said.' }, changed: true, summary: `asked ${batch.questions.length} (batch ${batch.n} of ${MAX_BATCHES})` };
}
