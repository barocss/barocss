// Modeling by chat: the transcript (messages, compact tool calls), the input, and the turn's live
// preview. Turns run on the chat server (the claude CLI with the studio's tools); the part changes here
// only through `onCommit`, once per turn, so one undo takes a turn back.
import { useEffect, useRef, useState } from 'react';
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { NameSelection } from '../chat/tools';
import { chatStatus, newChatBlobs, runServerTurn, type ChatStatus } from '../chat/client';
import { ACCEPT, imageUrl, prepareImage, type ChatImage } from '../chat/images';
import { diffLine, withHistory } from '../chat/proposals';
import { treeDiff } from '../chat/transactions';
import { latestPump, reshareNodes } from '../chat/pump';
import { modelHash } from '../chat/spec';
import { Icon } from './atoms';
import './chat.css';

type Item =
  | { kind: 'user'; text: string; images?: ChatImage[] }
  | { kind: 'assistant' | 'notice'; text: string }
  | { kind: 'tool'; name: string; input: unknown; summary: string; isError: boolean };

export interface ChatPanelProps {
  /** The part a new turn starts from (the evaluated document). */
  base(): StudioDoc;
  /** The bodies of a document the turn has built so far (for the preview), or null. */
  evaluate(doc: StudioDoc): Promise<BodyResult[] | null>;
  /** Why chat cannot start now (a command or sketch is open), or null. */
  blocked: string | null;
  onPreview(bodies: BodyResult[] | null): void;
  onCommit(doc: StudioDoc, selection?: NameSelection): void;
  /** What is selected in the viewport, by name: offered as context chips for the next message (A4.3). */
  context: { kind: 'face' | 'edge' | 'body'; name: string }[];
  /** A turn that only selected (the part unchanged). */
  onSelect(selection: NameSelection): void;
  onClose(): void;
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
  const fileInput = useRef<HTMLInputElement>(null);
  /** The CLI conversation the next turn resumes. */
  const session = useRef<string | undefined>(undefined);
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

  useEffect(() => { let live = true; chatStatus().then(s => { if (live) setStatus(s); }); return () => { live = false; }; }, []);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [items]);
  useEffect(() => () => abort.current?.abort(), []);

  const attach = async (files: Iterable<File>) => {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      try { const img = await prepareImage(file); setImages(list => list.length >= 4 ? list : [...list, img]); }
      catch (e) { setItems(list => [...list, { kind: 'notice', text: e instanceof Error ? e.message : String(e) }]); }
    }
  };

  const send = async () => {
    const attached = images;
    const first = traces.current.length + 1;
    const note = attached.length ? `\n\n[Attached: ${attached.map((img, k) => `image ${first + k} (${img.name}, traced into ${img.trace.layers.length} layers: ${img.trace.layers.map(l => l.id).join(', ')})`).join('; ')}]` : '';
    // (The selection as context: names the tools take, A4.3.)
    const sel = chips.length ? `\n\n[Selected in the viewport: ${(['face', 'edge', 'body'] as const).flatMap(k => { const n = chips.filter(c => c.kind === k).map(c => c.name); return n.length ? [`${k}${n.length > 1 ? 's' : ''} ${n.join(', ')}`] : []; }).join('; ')}]` : '';
    const message = (text.trim() || (attached.length ? 'Model what the image shows.' : '')) + (text.trim() || attached.length ? sel : '') + note;
    if (!message || running || !status?.enabled || props.blocked) return;
    setText(''); setImages([]); setRunning(true);
    traces.current = [...traces.current, ...attached.map(i => i.trace)];
    setItems(list => [...list, { kind: 'user', text: text.trim(), ...(attached.length ? { images: attached } : {}) }]);
    const controller = new AbortController(); abort.current = controller;
    // Streamed text goes into the last assistant item until a tool call starts a new one.
    let open = false, built: StudioDoc | null = null;
    const base = props.base();
    // (The previews: one evaluation at a time, the latest state waiting; nodes a state did not change are the ones
    // already sent, PERF3 A3.)
    let shared = base;
    const previews = latestPump((d: StudioDoc) => latest.current.evaluate(d), bodies => { if (abort.current === controller && bodies) latest.current.onPreview(bodies); });
    const done = await runServerTurn({
      text: message, images: attached, traces: traces.current, doc: base, autonomy, blobs: chatBlobs.current, session: session.current, signal: controller.signal,
      onEvent: e => {
        if (e.type === 'text') {
          const wasOpen = open; open = true;
          setItems(list => wasOpen ? [...list.slice(0, -1), { kind: 'assistant', text: (list[list.length - 1] as { text: string }).text + e.delta }] : [...list, { kind: 'assistant', text: e.delta }]);
        } else if (e.type === 'tool') { open = false; setItems(list => [...list, { kind: 'tool', name: e.name, input: e.input, summary: e.summary, isError: e.isError }]); }
        else if (e.type === 'state') {
          built = shared = reshareNodes(shared, e.doc); previews.push(built);
        }
      },
    });
    previews.close();
    if (done.session) session.current = done.session;
    abort.current = null; setRunning(false);
    // An aborted turn keeps what it had built when it stopped.
    let doc = done.doc ? reshareNodes(shared, done.doc) : done.end === 'aborted' ? built : null;
    // (The turn in the design history, saved with the part: the message capped, the model, what it changed.)
    if (doc) {
      const hash = modelHash(doc), line = diffLine(treeDiff(base, doc));
      doc = withHistory(doc, { kind: 'prompt', by: { agent: 'chat', ...(status?.model ? { model: status.model } : {}) }, prompt: message, ...(line ? { summary: line } : {}), ...(hash !== modelHash(base) ? { model_hash: hash } : {}) });
    }
    if (done.end === 'error') setItems(list => [...list, { kind: 'notice', text: done.error ?? 'The chat request failed.' }]);
    if (done.end === 'aborted') setItems(list => [...list, { kind: 'notice', text: doc ? 'Stopped. The changes made so far are kept (one undo removes them).' : 'Stopped.' }]);
    latest.current.onPreview(null);
    if (doc) latest.current.onCommit(doc, done.selection);
    else if (done.selection) latest.current.onSelect(done.selection);
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
        <button className="tool small" aria-label="New conversation" title="New conversation" disabled={running || !items.length} onClick={() => { session.current = undefined; traces.current = []; chatBlobs.current = newChatBlobs(); setItems([]); }}><Icon name="restart_alt" small /></button>
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
              <summary><Icon name={it.isError ? 'error' : 'build'} small /><span className="mono">{it.name}</span> <span className="chat-sum">{it.summary}</span></summary>
              <code>{brief(it.input)}</code>
            </details>
          : <div key={i} className={'chat-msg ' + it.kind}>
              {it.kind === 'user' && it.images && <div className="chat-thumbs">{it.images.map((img, k) => <img key={k} src={imageUrl(img)} alt={img.name} title={`${img.name} · ${img.width}×${img.height}`} />)}</div>}
              {it.text}</div>)}
        {running && <div className="chat-msg notice busy">Working…</div>}
      </div>
      {!!images.length && <div className="chat-thumbs pending" aria-label="Attached images">{images.map((img, k) => <span key={k} className="chat-thumb">
        <img src={imageUrl(img)} alt={img.name} title={`${img.name} · ${img.width}×${img.height}`} />
        <button type="button" aria-label={`Remove ${img.name}`} onClick={() => setImages(list => list.filter((_, j) => j !== k))}><Icon name="close" small /></button></span>)}</div>}
      {!!chips.length && <div className="chat-chips" aria-label="Selection sent as context">{chips.map(c => <span key={c.name} className="chat-chip" title={`The ${c.kind} selected in the viewport, sent with the next message`}>{c.name}
        <button type="button" aria-label={`Leave out ${c.name}`} onClick={() => setDropped(d => [...d, c.name])}><Icon name="close" small /></button></span>)}</div>}
      <form className="chat-input" onSubmit={e => { e.preventDefault(); void send(); }}>
        <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden aria-label="Chat image file" onChange={e => { if (e.target.files) void attach([...e.target.files]); e.target.value = ''; }} />
        <button type="button" className="tool" aria-label="Attach image" title="Attach a sketch, photo or drawing (or paste / drop one)" disabled={!enabled || running || images.length >= 4} onClick={() => fileInput.current?.click()}><Icon name="image" /></button>
        <textarea aria-label="Chat message" rows={2} value={text} disabled={!enabled || running} placeholder={props.blocked ?? (enabled ? 'Ask for a part or a change…' : 'Chat is off')}
          onChange={e => setText(e.target.value)}
          onPaste={e => { const files = [...e.clipboardData.files].filter(f => f.type.startsWith('image/')); if (files.length) { e.preventDefault(); void attach(files); } }}
          onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        {running
          ? <button type="button" className="ghost" onClick={() => abort.current?.abort()}>Stop</button>
          : <button type="submit" className="primary" disabled={!enabled || (!text.trim() && !images.length) || !!props.blocked}>Send</button>}
      </form>
    </aside>
  );
}
