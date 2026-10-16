// One chat turn: the user's message, then model calls and tool runs until the model ends its turn
// (or the step cap, a refusal or an abort). The part is changed only in the turn's own state; the caller
// commits it once at the end, so a whole turn is one undo step.
import { echoContent, toolUses, type MessageParam, type ToolResultBlock, type Transport } from './api';
import { runTool, SYSTEM_PROMPT, TOOLS, type ChatState, type Evaluate } from './tools';

export type ChatEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string; input: unknown; summary: string; isError: boolean }
  | { type: 'state'; state: ChatState }
  | { type: 'notice'; text: string };

export interface TurnResult {
  state: ChatState; history: MessageParam[]; changed: boolean;
  /** How the turn ended. */
  end: 'done' | 'step-cap' | 'refusal' | 'max-tokens' | 'aborted' | 'error';
  error?: string;
}

export const MAX_STEPS = 16;

/** A short line of the part's state for the model, sent with each user message. */
export function stateNote(state: ChatState): string {
  const bodies = state.bodies.map(b => `${b.key}${b.volumeMM3 === null ? '' : ` ${Math.round(b.volumeMM3)} mm³`}`).join(', ');
  return `[Current part: ${state.doc.nodes.length} feature${state.doc.nodes.length === 1 ? '' : 's'}; ${state.bodies.length ? `bodies ${bodies}` : 'no bodies'}. The user may have edited it since your last turn.]`;
}

export async function runTurn(options: {
  transport: Transport; evaluate: Evaluate; state: ChatState; history: MessageParam[]; text: string;
  onEvent?: (event: ChatEvent) => void; signal?: AbortSignal; maxSteps?: number;
}): Promise<TurnResult> {
  const { transport, evaluate, onEvent, signal } = options;
  const history: MessageParam[] = [...options.history, { role: 'user', content: [{ type: 'text', text: stateNote(options.state) }, { type: 'text', text: options.text }] }];
  let state = options.state, changed = false;
  const end = (e: TurnResult['end'], error?: string): TurnResult => ({ state, history, changed, end: e, ...(error ? { error } : {}) });
  for (let step = 0; step < (options.maxSteps ?? MAX_STEPS); step++) {
    if (signal?.aborted) return end('aborted');
    let message;
    try { message = await transport.send({ system: SYSTEM_PROMPT, tools: TOOLS, messages: history }, { signal, onText: delta => onEvent?.({ type: 'text', delta }) }); }
    catch (e) { return signal?.aborted ? end('aborted') : end('error', e instanceof Error ? e.message : String(e)); }
    if (message.stop_reason === 'refusal') {
      // (A refused response is not sent back; the next user message starts clean.)
      onEvent?.({ type: 'notice', text: `The model declined this request${message.stop_details?.explanation ? `: ${message.stop_details.explanation}` : '.'}` });
      return end('refusal');
    }
    history.push({ role: 'assistant', content: echoContent(message.content) });
    const calls = toolUses(message.content);
    if (message.stop_reason === 'max_tokens') {
      // A cut-off tool call is incomplete: answer each call so the history stays valid, but run none.
      if (calls.length) history.push({ role: 'user', content: calls.map(c => ({ type: 'tool_result', tool_use_id: c.id, content: 'Not run: the response was cut off.', is_error: true })) });
      onEvent?.({ type: 'notice', text: 'The response was cut off (output limit).' });
      return end('max-tokens');
    }
    if (!calls.length) return end('done');
    const results: ToolResultBlock[] = [];
    for (const call of calls) {
      if (signal?.aborted) { results.push({ type: 'tool_result', tool_use_id: call.id, content: 'Not run: the user stopped the turn.', is_error: true }); continue; }
      const out = await runTool(state, call.name, call.input, evaluate);
      state = out.state; changed ||= out.changed;
      results.push({ type: 'tool_result', tool_use_id: call.id, content: out.content, ...(out.isError ? { is_error: true } : {}) });
      onEvent?.({ type: 'tool', name: call.name, input: call.input, summary: out.summary, isError: out.isError });
      // (A refused change leaves the preview as it was.)
      if (out.changed || (call.name === 'select' && !out.isError)) onEvent?.({ type: 'state', state });
    }
    history.push({ role: 'user', content: results });
    if (signal?.aborted) return end('aborted');
  }
  onEvent?.({ type: 'notice', text: `Stopped after ${options.maxSteps ?? MAX_STEPS} model steps.` });
  return end('step-cap');
}
