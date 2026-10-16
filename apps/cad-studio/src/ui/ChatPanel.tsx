// Modeling by chat: the transcript (messages, compact tool calls), the input, and the turn's live
// preview. The part changes only through `onCommit`, once per turn, so one undo takes a turn back.
import { useEffect, useRef, useState } from 'react';
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { MessageParam, Transport } from '../chat/api';
import { runTurn } from '../chat/loop';
import type { ChatState, Evaluate, NameSelection } from '../chat/tools';
import { chatStatus, proxyTransport, type ChatStatus } from '../chat/transport';
import { Icon } from './atoms';
import './chat.css';

type Item =
  | { kind: 'user' | 'assistant' | 'notice'; text: string }
  | { kind: 'tool'; name: string; input: unknown; summary: string; isError: boolean };

export interface ChatPanelProps {
  /** The part a new turn starts from (the evaluated document and its bodies). */
  base(): ChatState;
  evaluate: Evaluate;
  /** Why chat cannot start now (a command or sketch is open), or null. */
  blocked: string | null;
  onPreview(bodies: BodyResult[] | null): void;
  onCommit(doc: StudioDoc, selection?: NameSelection): void;
  /** A turn that only selected (the part unchanged). */
  onSelect(selection: NameSelection): void;
  onClose(): void;
  transport?: Transport;
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
  const history = useRef<MessageParam[]>([]);
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
    let open = false;
    const result = await runTurn({
      transport: props.transport ?? proxyTransport(), evaluate: props.evaluate, state: props.base(), history: history.current, text: message, signal: controller.signal,
      onEvent: e => {
        if (e.type === 'text') {
          const wasOpen = open; open = true;
          setItems(list => wasOpen ? [...list.slice(0, -1), { kind: 'assistant', text: (list[list.length - 1] as { text: string }).text + e.delta }] : [...list, { kind: 'assistant', text: e.delta }]);
        } else if (e.type === 'tool') { open = false; setItems(list => [...list, { kind: 'tool', name: e.name, input: e.input, summary: e.summary, isError: e.isError }]); }
        else if (e.type === 'notice') { open = false; setItems(list => [...list, { kind: 'notice', text: e.text }]); }
        else latest.current.onPreview(e.state.bodies);
      },
    });
    history.current = result.history; abort.current = null; setRunning(false);
    if (result.end === 'error') setItems(list => [...list, { kind: 'notice', text: result.error ?? 'The chat request failed.' }]);
    if (result.end === 'aborted') setItems(list => [...list, { kind: 'notice', text: result.changed ? 'Stopped. The changes made so far are kept (one undo removes them).' : 'Stopped.' }]);
    latest.current.onPreview(null);
    if (result.changed) latest.current.onCommit(result.state.doc, result.state.selection);
    else if (result.state.selection) latest.current.onSelect(result.state.selection);
  };

  const enabled = !!status?.enabled;
  return (
    <aside className="card chat" aria-label="Chat">
      <div className="card-title">CHAT <span className="muted">{status?.model ?? ''}</span>
        <span className="grow" />
        <button className="tool small" aria-label="New conversation" title="New conversation" disabled={running || !items.length} onClick={() => { history.current = []; setItems([]); }}><Icon name="restart_alt" small /></button>
        <button className="tool small" aria-label="Close chat" title="Close" onClick={props.onClose}><Icon name="close" small /></button>
      </div>
      <div className="chat-log" ref={log} aria-live="polite">
        {status && !enabled && <div className="chat-setup" role="note">
          <b>Chat is off.</b> {status.reason ?? 'Set ANTHROPIC_API_KEY for the dev server.'}
          <code>ANTHROPIC_API_KEY=sk-ant-… pnpm --filter @barocss/cad-studio-app dev</code>
          The key stays in the dev server; the browser only talks to it.
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
