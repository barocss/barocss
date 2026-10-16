// Modeling by chat: the transcript (messages, compact tool calls), the input, and the turn's live
// preview. Turns run on the chat server (the claude CLI with the studio's tools); the part changes here
// only through `onCommit`, once per turn, so one undo takes a turn back.
import { useEffect, useRef, useState } from 'react';
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { NameSelection } from '../chat/tools';
import { chatStatus, runServerTurn, type ChatStatus } from '../chat/client';
import { Icon } from './atoms';
import './chat.css';

type Item =
  | { kind: 'user' | 'assistant' | 'notice'; text: string }
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
  /** A turn that only selected (the part unchanged). */
  onSelect(selection: NameSelection): void;
  onClose(): void;
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
  /** The CLI conversation the next turn resumes. */
  const session = useRef<string | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => { let live = true; chatStatus().then(s => { if (live) setStatus(s); }); return () => { live = false; }; }, []);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [items]);
  useEffect(() => () => abort.current?.abort(), []);

  const send = async () => {
    const message = text.trim();
    if (!message || running || !status?.enabled || props.blocked) return;
    setText(''); setRunning(true);
    setItems(list => [...list, { kind: 'user', text: message }]);
    const controller = new AbortController(); abort.current = controller;
    // Streamed text goes into the last assistant item until a tool call starts a new one.
    let open = false, built: StudioDoc | null = null, previewing = 0;
    const done = await runServerTurn({
      text: message, doc: props.base(), session: session.current, signal: controller.signal,
      onEvent: e => {
        if (e.type === 'text') {
          const wasOpen = open; open = true;
          setItems(list => wasOpen ? [...list.slice(0, -1), { kind: 'assistant', text: (list[list.length - 1] as { text: string }).text + e.delta }] : [...list, { kind: 'assistant', text: e.delta }]);
        } else if (e.type === 'tool') { open = false; setItems(list => [...list, { kind: 'tool', name: e.name, input: e.input, summary: e.summary, isError: e.isError }]); }
        else if (e.type === 'state') {
          built = e.doc; const n = ++previewing;
          void latest.current.evaluate(e.doc).then(bodies => { if (n === previewing && abort.current === controller && bodies) latest.current.onPreview(bodies); });
        }
      },
    });
    if (done.session) session.current = done.session;
    abort.current = null; setRunning(false);
    // An aborted turn keeps what it had built when it stopped.
    const doc = done.doc ?? (done.end === 'aborted' ? built : null);
    if (done.end === 'error') setItems(list => [...list, { kind: 'notice', text: done.error ?? 'The chat request failed.' }]);
    if (done.end === 'aborted') setItems(list => [...list, { kind: 'notice', text: doc ? 'Stopped. The changes made so far are kept (one undo removes them).' : 'Stopped.' }]);
    latest.current.onPreview(null);
    if (doc) latest.current.onCommit(doc, done.selection);
    else if (done.selection) latest.current.onSelect(done.selection);
  };

  const enabled = !!status?.enabled;
  return (
    <aside className="card chat" aria-label="Chat">
      <div className="card-title">CHAT <span className="muted">{status?.model ?? ''}</span>
        <span className="grow" />
        <button className="tool small" aria-label="New conversation" title="New conversation" disabled={running || !items.length} onClick={() => { session.current = undefined; setItems([]); }}><Icon name="restart_alt" small /></button>
        <button className="tool small" aria-label="Close chat" title="Close" onClick={props.onClose}><Icon name="close" small /></button>
      </div>
      <div className="chat-log" ref={log} aria-live="polite">
        {status && !enabled && <div className="chat-setup" role="note">
          <b>Chat is off.</b> {status.reason ?? 'Start the chat server.'}
          <code>pnpm --filter @barocss/cad-studio-app chat</code>
          It runs the claude CLI with its own sign-in; the browser only talks to the local server.
        </div>}
        {enabled && !items.length && <div className="chat-empty muted">Describe a part or a change, e.g. “a 64×32×8 plate with four Ø8 holes 6 mm from the corners and R2 vertical edges”.</div>}
        {items.map((it, i) => it.kind === 'tool'
          ? <details key={i} className={'chat-tool' + (it.isError ? ' err' : '')}>
              <summary><Icon name={it.isError ? 'error' : 'build'} small /><span className="mono">{it.name}</span> <span className="chat-sum">{it.summary}</span></summary>
              <code>{brief(it.input)}</code>
            </details>
          : <div key={i} className={'chat-msg ' + it.kind}>{it.text}</div>)}
        {running && <div className="chat-msg notice busy">Working…</div>}
      </div>
      <form className="chat-input" onSubmit={e => { e.preventDefault(); void send(); }}>
        <textarea aria-label="Chat message" rows={2} value={text} disabled={!enabled || running} placeholder={props.blocked ?? (enabled ? 'Ask for a part or a change…' : 'Chat is off')}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        {running
          ? <button type="button" className="ghost" onClick={() => abort.current?.abort()}>Stop</button>
          : <button type="submit" className="primary" disabled={!enabled || !text.trim() || !!props.blocked}>Send</button>}
      </form>
    </aside>
  );
}
