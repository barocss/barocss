// Modeling by chat: the transcript (messages, compact tool calls), the input, and the turn's live
// preview. Turns run on the chat server (the claude CLI with the studio's tools); the part changes here
// only through `onCommit`, once per turn, so one undo takes a turn back.
import { useEffect, useRef, useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { NameSelection } from '@barocss/cad-model/chat/tools';
import { chatStatus, newChatBlobs, runServerTurn, type ChatStatus } from '../chat/client';
import { receivePersonRowFiles, revokePersonRowFiles, pastedRowFile, type RowFileInput, type PersonRowFiles } from '@barocss/cad-model/engine/rowFiles';
import { ACCEPT, imageUrl, prepareImage, type ChatImage } from '../chat/images';
import { diffLine, withHistory } from '@barocss/cad-model/chat/proposals';
import { treeDiff } from '@barocss/cad-model/chat/transactions';
import { latestPump, reshareNodes } from '@barocss/cad-model/chat/pump';
import { modelHash } from '@barocss/cad-model/chat/spec';
import type { EvalResult } from '@barocss/cad-model/engine/evaluate';
import { nextSerial } from '@barocss/cad-model/engine/ids';
import { changedDuring, mergeTurn, type Merged, type TurnOp } from '@barocss/cad-model/chat/merge';
import { revisionOf } from '@barocss/cad-model/util/revision';
import { holdSweeps } from '@barocss/cad-model/engine/blobs';
import { Icon } from './atoms';
import './chat.css';

type Item =
  | { kind: 'user'; text: string; images?: ChatImage[] }
  | { kind: 'assistant' | 'notice'; text: string }
  | { kind: 'tool'; name: string; input: unknown; summary: string; isError: boolean };

/** A call as the transcript names it: the tool and its action (`features.command`), O105. */
const toolLabel = (name: string, input: unknown) => { const a = input && typeof input === 'object' ? (input as { action?: unknown }).action : undefined; return typeof a === 'string' ? `${name}.${a}` : name; };

export interface ChatPanelProps {
  /** The part a new turn starts from (the evaluated document). */
  base(): StudioDoc;
  /** The bodies of a document the turn has built so far (for the preview), or null. */
  evaluate(doc: StudioDoc): Promise<BodyResult[] | null>;
  /** Why chat cannot start now (a command or sketch is open), or null. */
  blocked: string | null;
  onPreview(bodies: BodyResult[] | null): void;
  /** The whole evaluation of a document (the merge of a turn onto edits made during it checks each step, O133). */
  check(doc: StudioDoc): Promise<EvalResult | null>;
  /** The turn's part, once; `merged`: it was merged onto edits the person made while it ran (O133). */
  onCommit(doc: StudioDoc, selection?: NameSelection, merged?: Merged): void;
  /** What is selected in the viewport, by name: offered as context chips for the next message (A4.3). */
  context: { kind: 'face' | 'edge' | 'body'; name: string }[];
  /** A turn that only selected (the part unchanged). */
  onSelect(selection: NameSelection): void;
  onClose(): void;
  /** Current conversation authority, held by the host for explicit proposal replay. */
  onRowFiles?(files: PersonRowFiles | undefined): void;
  /** A message the studio sends as the user's (the Specify panel's answers, A6.2): sent once, when the chat is free. */
  outbox?: { id: number; text: string } | null;
  onOutboxSent?(id: number): void;
}

/** What each autonomy level lets the agent do (D41). */
const AUTONOMY_TIPS = [
  'L1 · Propose only: every change is a proposal you accept',
  'L2 · Values: the agent edits values of one feature or parameters directly, and builds an empty part; anything more is a proposal you accept',
  'L3 · Edit and accept low or medium risk proposals changing no hard requirement',
  'L4 · Edit and accept proposals breaking no hard requirement',
];
function readAutonomy(): number {
  try { const n = Number(localStorage.getItem('studio.autonomy')); return n >= 1 && n <= 4 ? n : 2; } catch { return 2; }
}

const brief = (input: unknown) => {
  const s = JSON.stringify(input ?? {});
  return s.length > 140 ? s.slice(0, 137) + '…' : s;
};

export function ChatPanel(props: ChatPanelProps) {
  const latest = useRef(props); latest.current = props;
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);
  /** Images attached to the next message. */
  const [images, setImages] = useState<ChatImage[]>([]);
  const [rowFiles, setRowFiles] = useState<{ name: string; text: string }[]>([]);
  const suppliedRows = useRef<RowFileInput[]>([]);
  const rowAuthority = useRef<PersonRowFiles | undefined>(undefined);
  const replaceRowFiles = (next?: PersonRowFiles) => {
    revokePersonRowFiles(rowAuthority.current); rowAuthority.current = next;
    latest.current.onRowFiles?.(next);
  };
  // A newly mounted panel starts a new conversation. Closing it keeps pending UI approval usable.
  useEffect(() => { latest.current.onRowFiles?.(undefined); }, []);
  const fileInput = useRef<HTMLInputElement>(null);
  /** The CLI conversation the next turn resumes. */
  const session = useRef<string | undefined>(undefined);
  // (What the user typed this conversation, as typed: the tools check a quote said to be theirs against it, A6.2.)
  const said = useRef<string[]>([]);
  /** The traces of every image attached in this conversation (image 1 first). */
  const traces = useRef<ChatImage['trace'][]>([]);
  const abort = useRef<AbortController | null>(null);
  /** The mesh blobs this conversation has sent the server (each once, D45). */
  const chatBlobs = useRef(newChatBlobs());
  const log = useRef<HTMLDivElement>(null);
  /** How far the agent may go on its own (D41), kept in this browser. */
  const [autonomy, setAutonomy] = useState(readAutonomy);
  /** Context chips the user removed (by name), until the selection changes. */
  const [dropped, setDropped] = useState<string[]>([]);
  const contextKey = props.context.map(c => c.name).join(' ');
  useEffect(() => { setDropped([]); }, [contextKey]);
  const chips = props.context.filter(c => !dropped.includes(c.name));

  // (The studio's message as the user's — the Specify panel's answers — once the chat is free.)
  useEffect(() => {
    const o = props.outbox; if (!o || running || !status?.enabled || props.blocked) return;
    props.onOutboxSent?.(o.id); void send(o.text);
  }, [props.outbox?.id, running, status?.enabled, props.blocked]);
  useEffect(() => { let live = true; chatStatus().then(s => { if (live) setStatus(s); }); return () => { live = false; }; }, []);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [items]);
  useEffect(() => () => abort.current?.abort(), []);

  const attach = async (files: Iterable<File>) => {
    for (const file of files) {
      if (/\.json$/i.test(file.name)) {
        try {
          if (file.size > 262144) throw new Error('Row JSON files must be at most 256 KiB.');
          const text = await file.text(); JSON.parse(text);
          setRowFiles(list => [...list, { name: file.name, text }]);
        } catch (e) { setItems(list => [...list, { kind: 'notice', text: e instanceof Error ? e.message : String(e) }]); }
        continue;
      }
      if (!file.type.startsWith('image/')) continue;
      try { const img = await prepareImage(file); setImages(list => list.length >= 4 ? list : [...list, img]); }
      catch (e) { setItems(list => [...list, { kind: 'notice', text: e instanceof Error ? e.message : String(e) }]); }
    }
  };

  const send = async (typed?: string) => {
    if (running || !status?.enabled || props.blocked) return;
    const said0 = typed ?? text;
    if (!said0.trim() && !images.length && !rowFiles.length) return;
    const attached = images, turn = said.current.length + 1;
    const incoming = rowFiles.map(file => ({ ...file, turn }));
    const pasted = pastedRowFile(said0, turn);
    if (pasted) incoming.push(pasted);
    // The complete pasted bytes travel as a file; the existing quote history caps each entry at20k.
    const recorded = pasted && said0.trim().length > 20000 ? `[Pasted JSON file ${pasted.name}; full content is in the conversation file input]` : said0.trim();
    const allRows = [...suppliedRows.current, ...incoming];
    try { replaceRowFiles(receivePersonRowFiles(chatBlobs.current.session, allRows, turn)); }
    catch (e) { setItems(list => [...list, { kind: 'notice', text: e instanceof Error ? e.message : String(e) }]); return; }
    const first = traces.current.length + 1;
    const note = attached.length ? `\n\n[Attached: ${attached.map((img, k) => `image ${first + k} (${img.name}, traced into ${img.trace.layers.length} layers: ${img.trace.layers.map(l => l.id).join(', ')})`).join('; ')}]` : '';
    // (The selection as context: names the tools take, A4.3.)
    const sel = chips.length ? `\n\n[Selected in the viewport: ${(['face', 'edge', 'body'] as const).flatMap(k => { const n = chips.filter(c => c.kind === k).map(c => c.name); return n.length ? [`${k}${n.length > 1 ? 's' : ''} ${n.join(', ')}`] : []; }).join('; ')}]` : '';
    const message = (said0.trim() || (attached.length ? 'Model what the image shows.' : incoming.length ? 'Use the attached row files.' : '')) + (said0.trim() || attached.length ? sel : '') + note;
    if (!message || running || !status?.enabled || props.blocked) return;
    if (typed === undefined) setText(''); setImages([]); setRowFiles([]); setRunning(true);
    suppliedRows.current = allRows;
    // (No blob sweep while the turn runs: its base, built and shared states and their meshes are held here, O135.)
    const release = holdSweeps();
    try {
    traces.current = [...traces.current, ...attached.map(i => i.trace)];
    said.current = [...said.current, recorded || (incoming.length ? 'Use the attached row files.' : 'Model what the image shows.')];
    setItems(list => [...list, { kind: 'user', text: said0.trim() || (incoming.length ? incoming.map(f => f.name).join(', ') : ''), ...(attached.length ? { images: attached } : {}) }]);
    const controller = new AbortController(); abort.current = controller;
    // Streamed text goes into the last assistant item until a tool call starts a new one.
    let open = false, built: StudioDoc | null = null;
    /** The turn's calls that changed the part, as the tool server captured them (O133). */
    const ops: TurnOp[] = [];
    const base = props.base();
    // (The previews: one evaluation at a time, the latest state waiting; nodes a state did not change are the ones
    // already sent, PERF3 A3.)
    let shared = base;
    const previews = latestPump((d: StudioDoc) => latest.current.evaluate(d), bodies => { if (abort.current === controller && bodies) latest.current.onPreview(bodies); });
    const done = await runServerTurn({
      text: message, turns: said.current, rowFiles: allRows, rowConversation: chatBlobs.current.session, images: attached, traces: traces.current, doc: base, autonomy, blobs: chatBlobs.current, session: session.current, signal: controller.signal,
      onEvent: e => {
        if (e.type === 'text') {
          const wasOpen = open; open = true;
          setItems(list => wasOpen ? [...list.slice(0, -1), { kind: 'assistant', text: (list[list.length - 1] as { text: string }).text + e.delta }] : [...list, { kind: 'assistant', text: e.delta }]);
        } else if (e.type === 'tool') { open = false; setItems(list => [...list, { kind: 'tool', name: e.name, input: e.input, summary: e.summary, isError: e.isError }]); }
        else if (e.type === 'state') {
          if (e.ops) ops.push(...e.ops);
          built = shared = reshareNodes(shared, e.doc); previews.push(built);
        }
      },
    });
    previews.close();
    if (done.ops) ops.push(...done.ops);
    if (done.session) session.current = done.session;
    abort.current = null; setRunning(false);
    // An aborted turn keeps what it had built when it stopped.
    let doc = done.doc ? reshareNodes(shared, done.doc) : done.end === 'aborted' ? built : null;
    // (Edited during the turn: its calls merged onto the part as it is now, the conflicting ones a proposal, O133. Edited
    // again while merging: merged again, twice at most; then every call waits.)
    let merged: Merged | undefined, from = base;
    if (doc && ops.length && changedDuring(base, latest.current.base())) {
      const patch = { id: `${session.current ?? 'turn'}#${said.current.length}`, by: { agent: 'chat', ...(status?.model ? { model: status.model } : {}) }, base: revisionOf(base), nextId: nextSerial(base), ops };
      try {
        for (let tries = 0; ; tries++) {
          const now = latest.current.base();
          merged = await mergeTurn(base, now, patch, latest.current.check, { rowFiles: rowAuthority.current, ...(tries < 3 ? {} : { deferAll: 'you kept editing the part while the turn was merged onto it' }) });
          from = now;
          if (tries === 3 || !changedDuring(now, latest.current.base())) break;
        }
        doc = merged.doc;
      } catch (e) {
        setItems(list => [...list, { kind: 'notice', text: `The turn could not be merged with your edits: ${e instanceof Error ? e.message : String(e)}. Nothing of it was applied.` }]);
        doc = null; merged = undefined;
      }
    }
    // (The turn in the design history, saved with the part: the message capped, the model, what it changed.)
    if (doc) {
      const hash = modelHash(doc), line = [diffLine(treeDiff(from, doc)), merged ? `merged over your edits: ${merged.applied.length} of ${ops.length} applied${merged.proposal ? `, the rest ${merged.proposal}` : ''}` : ''].filter(Boolean).join('; ');
      doc = withHistory(doc, { kind: 'prompt', by: { agent: 'chat', ...(status?.model ? { model: status.model } : {}) }, prompt: message, ...(line ? { summary: line } : {}), ...(hash !== modelHash(from) ? { model_hash: hash } : {}) });
    }
    if (done.end === 'error') setItems(list => [...list, { kind: 'notice', text: done.error ?? 'The chat request failed.' }]);
    if (done.end === 'aborted') setItems(list => [...list, { kind: 'notice', text: doc ? 'Stopped. The changes made so far are kept (one undo removes them).' : 'Stopped.' }]);
    latest.current.onPreview(null);
    if (doc) latest.current.onCommit(doc, done.selection, merged);
    else if (done.selection) latest.current.onSelect(done.selection);
    } finally { release(); }
  };

  const enabled = !!status?.enabled;
  return (
    <aside className="card chat" aria-label="Chat"
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
      onDrop={e => { if (!e.dataTransfer.files.length) return; e.preventDefault(); if (enabled && !running) void attach(e.dataTransfer.files); }}>
      <div className="card-title">CHAT <span className="muted">{status?.model ?? ''}</span>
        <span className="grow" />
        <select className="chat-autonomy" aria-label="Autonomy" title={AUTONOMY_TIPS[autonomy - 1]} value={autonomy} disabled={running}
          onChange={e => { const n = Number(e.currentTarget.value); setAutonomy(n); try { localStorage.setItem('studio.autonomy', String(n)); } catch { /* private mode */ } }}>
          {AUTONOMY_TIPS.map((t, i) => <option key={i} value={i + 1} title={t}>L{i + 1}</option>)}</select>
        <button className="tool small" aria-label="New conversation" title="New conversation" disabled={running || !items.length} onClick={() => { session.current = undefined; said.current = []; suppliedRows.current = []; replaceRowFiles(); setRowFiles([]); traces.current = []; chatBlobs.current = newChatBlobs(); setItems([]); }}><Icon name="restart_alt" small /></button>
        <button className="tool small" aria-label="Close chat" title="Close" onClick={props.onClose}><Icon name="close" small /></button>
      </div>
      <div className="chat-log" ref={log} aria-live="polite">
        {status && !enabled && <div className="chat-setup" role="note">
          <b>Chat is off.</b> {status.reason ?? 'Start the chat server.'}
          <code>pnpm --filter @barocss/cad-studio-app chat</code>
          It runs the claude CLI with its own sign-in; the browser only talks to the local server.
        </div>}
        {enabled && !items.length && <div className="chat-empty muted">Describe a part or a change, e.g. “a 64×32×8 plate with four Ø8 holes 6 mm from the corners and R2 vertical edges” — or attach a sketch, photo or drawing of it.<br />Your messages are kept in the part’s design history, saved with the file.</div>}
        {items.map((it, i) => it.kind === 'tool'
          ? <details key={i} className={'chat-tool' + (it.isError ? ' err' : '')}>
              <summary><Icon name={it.isError ? 'error' : 'build'} small /><span className="mono">{toolLabel(it.name, it.input)}</span> <span className="chat-sum">{it.summary}</span></summary>
              <code>{brief(it.input)}</code>
            </details>
          : <div key={i} className={'chat-msg ' + it.kind}>
              {it.kind === 'user' && it.images && <div className="chat-thumbs">{it.images.map((img, k) => <img key={k} src={imageUrl(img)} alt={img.name} title={`${img.name} · ${img.width}×${img.height}`} />)}</div>}
              {it.text}</div>)}
        {running && <div className="chat-msg notice busy">Working…</div>}
      </div>
      {!!rowFiles.length && <div className="chat-thumbs pending" aria-label="Attached row files">{rowFiles.map((file, index) => <span key={index}>{file.name}<button type="button" className="tool tiny" aria-label={`Remove row file ${index + 1}`} onClick={() => setRowFiles(list => list.filter((_, k) => k !== index))}>×</button></span>)}</div>}
      {!!images.length && <div className="chat-thumbs pending" aria-label="Attached images">{images.map((img, k) => <span key={k} className="chat-thumb">
        <img src={imageUrl(img)} alt={img.name} title={`${img.name} · ${img.width}×${img.height}`} />
        <button type="button" aria-label={`Remove ${img.name}`} onClick={() => setImages(list => list.filter((_, j) => j !== k))}><Icon name="close" small /></button></span>)}</div>}
      {!!chips.length && <div className="chat-chips" aria-label="Selection sent as context">{chips.map(c => <span key={c.name} className="chat-chip" title={`The ${c.kind} selected in the viewport, sent with the next message`}>{c.name}
        <button type="button" aria-label={`Leave out ${c.name}`} onClick={() => setDropped(d => [...d, c.name])}><Icon name="close" small /></button></span>)}</div>}
      <form className="chat-input" onSubmit={e => { e.preventDefault(); void send(); }}>
        <input ref={fileInput} type="file" accept={`${ACCEPT},application/json,.json`} multiple hidden aria-label="Chat image file" onChange={e => { if (e.target.files) void attach([...e.target.files]); e.target.value = ''; }} />
        <button type="button" className="tool" aria-label="Attach image" title="Attach an image or JSON rows (or paste / drop one)" disabled={!enabled || running || images.length >= 4} onClick={() => fileInput.current?.click()}><Icon name="image" /></button>
        <textarea aria-label="Chat message" rows={2} value={text} disabled={!enabled || running} placeholder={props.blocked ?? (enabled ? 'Ask for a part or a change…' : 'Chat is off')}
          onChange={e => setText(e.target.value)}
          onPaste={e => { const files = [...e.clipboardData.files].filter(f => f.type.startsWith('image/') || /\.json$/i.test(f.name)); if (files.length) { e.preventDefault(); void attach(files); } }}
          onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        {running
          ? <button type="button" className="ghost" onClick={() => abort.current?.abort()}>Stop</button>
          : <button type="submit" className="primary" disabled={!enabled || (!text.trim() && !images.length && !rowFiles.length) || !!props.blocked}>Send</button>}
      </form>
    </aside>
  );
}
