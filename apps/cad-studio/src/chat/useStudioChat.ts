// O17: the chat's turn logic on the AI SDK's useChat — what ChatPanel did around runServerTurn, unchanged: the
// conversation's session, said messages, image traces, row files and blobs; the live previews from each state; and, at
// the turn's end, the A7 merge onto edits made while it ran (O133), the design history, the commit or the selection,
// and the notices (stopped, not merged, failed) — written into the turn's own message as it ends. The messages are
// useChat's; StudioTransport sends each turn as the server has always taken it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import type { ChatTransport } from 'ai';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { receivePersonRowFiles, revokePersonRowFiles, pastedRowFile, type RowFileInput, type PersonRowFiles } from '@barocss/cad-model/engine/rowFiles';
import { diffLine, withHistory } from '@barocss/cad-model/chat/proposals';
import { treeDiff } from '@barocss/cad-model/chat/transactions';
import { latestPump, reshareNodes, type LatestPump } from '@barocss/cad-model/chat/pump';
import { modelHash } from '@barocss/cad-model/chat/spec';
import { nextSerial } from '@barocss/cad-model/engine/ids';
import { changedDuring, mergeTurn, type Merged, type TurnOp } from '@barocss/cad-model/chat/merge';
import { revisionOf } from '@barocss/cad-model/util/revision';
import { holdSweeps } from '@barocss/cad-model/engine/blobs';
import { chatStatus, newChatBlobs, type ChatStatus } from './client';
import { imageUrl, type ChatImage } from './images';
import { StudioTransport, type StudioMessage, type TurnDone, type TurnInputs } from './transport';
import type { ChatPanelProps } from '../ui/ChatPanel';

/** What each autonomy level lets the agent do (D41). */
export const AUTONOMY_TIPS = [
  'L1 · Propose only: every change is a proposal you accept',
  'L2 · Values: the agent edits values of one feature or parameters directly, and builds an empty part; anything more is a proposal you accept',
  'L3 · Edit and accept low or medium risk proposals changing no hard requirement',
  'L4 · Edit and accept proposals breaking no hard requirement',
];
function readAutonomy(): number {
  try { const n = Number(localStorage.getItem('studio.autonomy')); return n >= 1 && n <= 4 ? n : 2; } catch { return 2; }
}
/** A notice of its own (an attachment refused before any turn): an assistant message with only that part. */
const noticeMessage = (text: string): StudioMessage => ({ id: `notice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, role: 'assistant', parts: [{ type: 'data-notice', data: { text } }] });

/** One turn in flight: what its end needs (its base, the previews, the calls that changed the part). */
interface Turn {
  inputs: TurnInputs; message: string; base: StudioDoc; shared: StudioDoc; built: StudioDoc | null; ops: TurnOp[]; previews: LatestPump<StudioDoc>;
  /** The turn's end done here, with the notices a stopped turn's message is given afterwards (a stopped stream is read no further). */
  ended: Promise<string[]>; end(stopped: string[]): void;
}

export function useStudioChat(props: ChatPanelProps) {
  const latest = useRef(props); latest.current = props;
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [autonomy, setAutonomyState] = useState(readAutonomy);
  const suppliedRows = useRef<RowFileInput[]>([]);
  const rowAuthority = useRef<PersonRowFiles | undefined>(undefined);
  const replaceRowFiles = (next?: PersonRowFiles) => { revokePersonRowFiles(rowAuthority.current); rowAuthority.current = next; latest.current.onRowFiles?.(next); };
  /** The CLI conversation the next turn resumes. */
  const session = useRef<string | undefined>(undefined);
  // (What the user typed this conversation, as typed: the tools check a quote said to be theirs against it, A6.2.)
  const said = useRef<string[]>([]);
  /** The traces of every image attached in this conversation (image 1 first). */
  const traces = useRef<ChatImage['trace'][]>([]);
  /** The mesh blobs this conversation has sent the server (each once, D45). */
  const chatBlobs = useRef(newChatBlobs());
  const turn = useRef<Turn | null>(null);
  const statusRef = useRef(status); statusRef.current = status;

  /** The turn's end in the studio: today's post-turn code, its notices returned for the turn's message. */
  const after = async (done: TurnDone): Promise<string[]> => {
    const t = turn.current!; turn.current = null;
    t.previews.close();
    const notices: string[] = [], { ops, base } = t;
    if (done.ops) ops.push(...done.ops);
    if (done.session) session.current = done.session;
    // An aborted turn keeps what it had built when it stopped.
    let doc = done.doc ? reshareNodes(t.shared, done.doc) : done.end === 'aborted' ? t.built : null;
    // (Edited during the turn: its calls merged onto the part as it is now, the conflicting ones a proposal, O133. Edited
    // again while merging: merged again, twice at most; then every call waits.)
    let merged: Merged | undefined, from = base;
    const model = statusRef.current?.model;
    if (doc && ops.length && changedDuring(base, latest.current.base())) {
      const patch = { id: `${session.current ?? 'turn'}#${said.current.length}`, by: { agent: 'chat', ...(model ? { model } : {}) }, base: revisionOf(base), nextId: nextSerial(base), ops };
      try {
        for (let tries = 0; ; tries++) {
          const now = latest.current.base();
          merged = await mergeTurn(base, now, patch, latest.current.check, { rowFiles: rowAuthority.current, ...(tries < 3 ? {} : { deferAll: 'you kept editing the part while the turn was merged onto it' }) });
          from = now;
          if (tries === 3 || !changedDuring(now, latest.current.base())) break;
        }
        doc = merged.doc;
      } catch (e) {
        notices.push(`The turn could not be merged with your edits: ${e instanceof Error ? e.message : String(e)}. Nothing of it was applied.`);
        doc = null; merged = undefined;
      }
    }
    // (The turn in the design history, saved with the part: the message capped, the model, what it changed.)
    if (doc) {
      const hash = modelHash(doc), line = [diffLine(treeDiff(from, doc)), merged ? `merged over your edits: ${merged.applied.length} of ${ops.length} applied${merged.proposal ? `, the rest ${merged.proposal}` : ''}` : ''].filter(Boolean).join('; ');
      doc = withHistory(doc, { kind: 'prompt', by: { agent: 'chat', ...(model ? { model } : {}) }, prompt: t.message, ...(line ? { summary: line } : {}), ...(hash !== modelHash(from) ? { model_hash: hash } : {}) });
    }
    if (done.end === 'error') notices.push(done.error ?? 'The chat request failed.');
    if (done.end === 'aborted') notices.push(doc ? 'Stopped. The changes made so far are kept (one undo removes them).' : 'Stopped.');
    latest.current.onPreview(null);
    if (doc) latest.current.onCommit(doc, done.selection, merged);
    else if (done.selection) latest.current.onSelect(done.selection);
    // (Stopped: useChat reads the stream no further, so the notices are added to the turn's message once it has settled.)
    t.end(done.end === 'aborted' ? notices : []);
    return done.end === 'aborted' ? [] : notices;
  };
  const afterRef = useRef(after); afterRef.current = after;
  const transport = useMemo(() => new StudioTransport({ inputs: () => turn.current!.inputs, after: done => afterRef.current(done) }) as unknown as ChatTransport<StudioMessage>, []);
  const chat = useChat<StudioMessage>({
    transport,
    // (Each state the turn has built: the previews, one evaluation at a time; its calls that changed the part, O133.)
    onData: part => {
      const t = turn.current; if (!t || part.type !== 'data-state') return;
      const e = part.data as Extract<StudioMessage['parts'][number], { type: 'data-state' }>['data'];
      if (e.ops) t.ops.push(...e.ops);
      t.built = t.shared = reshareNodes(t.shared, e.doc); t.previews.push(t.built);
    },
  });
  const running = chat.status === 'submitted' || chat.status === 'streaming';
  // A newly mounted panel starts a new conversation. Closing it keeps pending UI approval usable.
  useEffect(() => { latest.current.onRowFiles?.(undefined); }, []);
  useEffect(() => { let live = true; chatStatus().then(s => { if (live) setStatus(s); }); return () => { live = false; }; }, []);
  useEffect(() => () => { void chat.stop(); }, []);

  const notice = (text: string) => chat.setMessages(list => [...list, noticeMessage(text)]);
  const setAutonomy = (n: number) => { setAutonomyState(n); try { localStorage.setItem('studio.autonomy', String(n)); } catch { /* private mode */ } };

  /** One turn: what was typed (or the studio's message), the attachments and the selection as context. */
  const send = async (said0: string, attached: ChatImage[], rowFiles: readonly { name: string; text: string }[], chips: readonly { kind: 'face' | 'edge' | 'body'; name: string }[]): Promise<boolean> => {
    if (running || turn.current || !statusRef.current?.enabled || latest.current.blocked) return false;
    if (!said0.trim() && !attached.length && !rowFiles.length) return false;
    const n = said.current.length + 1;
    const incoming = rowFiles.map(file => ({ ...file, turn: n }));
    const pasted = pastedRowFile(said0, n);
    if (pasted) incoming.push(pasted);
    // The complete pasted bytes travel as a file; the existing quote history caps each entry at 20k.
    const recorded = pasted && said0.trim().length > 20000 ? `[Pasted JSON file ${pasted.name}; full content is in the conversation file input]` : said0.trim();
    const allRows = [...suppliedRows.current, ...incoming];
    try { replaceRowFiles(receivePersonRowFiles(chatBlobs.current.session, allRows, n)); }
    catch (e) { notice(e instanceof Error ? e.message : String(e)); return false; }
    const first = traces.current.length + 1;
    const note = attached.length ? `\n\n[Attached: ${attached.map((img, k) => `image ${first + k} (${img.name}, traced into ${img.trace.layers.length} layers: ${img.trace.layers.map(l => l.id).join(', ')})`).join('; ')}]` : '';
    // (The selection as context: names the tools take, A4.3.)
    const sel = chips.length ? `\n\n[Selected in the viewport: ${(['face', 'edge', 'body'] as const).flatMap(k => { const names = chips.filter(c => c.kind === k).map(c => c.name); return names.length ? [`${k}${names.length > 1 ? 's' : ''} ${names.join(', ')}`] : []; }).join('; ')}]` : '';
    const message = (said0.trim() || (attached.length ? 'Model what the image shows.' : incoming.length ? 'Use the attached row files.' : '')) + (said0.trim() || attached.length ? sel : '') + note;
    if (!message) return false;
    suppliedRows.current = allRows;
    traces.current = [...traces.current, ...attached.map(i => i.trace)];
    said.current = [...said.current, recorded || (incoming.length ? 'Use the attached row files.' : 'Model what the image shows.')];
    // (No blob sweep while the turn runs: its base, built and shared states and their meshes are held here, O135.)
    const release = holdSweeps(), base = latest.current.base();
    const previews = latestPump((d: StudioDoc) => latest.current.evaluate(d), bodies => { if (turn.current?.previews === previews && bodies) latest.current.onPreview(bodies); });
    let end!: (stopped: string[]) => void;
    const ended = new Promise<string[]>(resolve => { end = resolve; });
    turn.current = { message, base, shared: base, built: null, ops: [], previews, ended, end,
      inputs: { text: message, turns: said.current, rowFiles: allRows, rowConversation: chatBlobs.current.session, images: attached, traces: traces.current, doc: base, autonomy, blobs: chatBlobs.current, session: session.current } };
    // (The message as shown: what was typed — or the row files' names — its images as file parts, its row files named.)
    const shown = said0.trim() || (incoming.length ? incoming.map(f => f.name).join(', ') : '');
    try {
      await chat.sendMessage({ role: 'user', parts: [
        ...(shown ? [{ type: 'text' as const, text: shown }] : []),
        ...attached.map(img => ({ type: 'file' as const, mediaType: img.media_type, filename: img.name, url: imageUrl(img) })),
        ...incoming.map(f => ({ type: 'data-rowfile' as const, data: { name: f.name } })),
      ] });
      const stopped = await ended;
      if (stopped.length) chat.setMessages(list => {
        const last = list[list.length - 1], parts = stopped.map(text => ({ type: 'data-notice' as const, data: { text } }));
        return last?.role === 'assistant' ? [...list.slice(0, -1), { ...last, parts: [...last.parts, ...parts] }] : [...list, ...stopped.map(noticeMessage)];
      });
    } finally { release(); if (turn.current?.previews === previews) { turn.current = null; previews.close(); end([]); } }
    return true;
  };

  /** A new conversation: a new CLI session, its quotes, rows, traces and blobs forgotten. */
  const reset = () => { session.current = undefined; said.current = []; suppliedRows.current = []; replaceRowFiles(); traces.current = []; chatBlobs.current = newChatBlobs(); chat.setMessages([]); };
  return { status, autonomy, setAutonomy, messages: chat.messages, running, send, stop: () => void chat.stop(), reset, notice };
}
