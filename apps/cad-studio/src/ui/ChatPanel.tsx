// Modeling by chat: the transcript (messages, compact tool calls), the input, and the turn's live
// preview. Turns run on the chat server (the claude CLI with the studio's tools); the part changes here
// only through `onCommit`, once per turn, so one undo takes a turn back. O17: the messages are the AI SDK's (useChat,
// chat/useStudioChat), each part drawn by the chat's components (components/ai).
import { Fragment, useEffect, useRef, useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult, EvalResult } from '@barocss/cad-model/engine/evaluate';
import type { NameSelection } from '@barocss/cad-model/chat/tools';
import type { PersonRowFiles } from '@barocss/cad-model/engine/rowFiles';
import type { Merged } from '@barocss/cad-model/chat/merge';
import type { Proposal } from '@barocss/cad-model/engine/schema/proposals';
import { ACCEPT, imageUrl, prepareImage, type ChatImage } from '../chat/images';
import { AUTONOMY_TIPS, useStudioChat } from '../chat/useStudioChat';
import type { StudioMessage } from '../chat/transport';
import { Message } from '@/components/ai/message';
import { Tool } from '@/components/ai/tool';
import { ProposalLink } from '@/components/ai/proposal';
import { Reasoning } from '@/components/ai/reasoning';
import { Icon } from './atoms';
import './chat.css';

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
  /** The document's proposals, for a `propose` call's linked card (O17), and how they are decided (as the Proposals list). */
  proposals?: readonly Proposal[];
  proposalStale?(p: Proposal): boolean;
  proposalBusy?: boolean;
  onAcceptProposal?(p: Proposal): void;
  onRejectProposal?(p: Proposal): void;
}

const brief = (input: unknown) => {
  const s = JSON.stringify(input ?? {});
  return s.length > 140 ? s.slice(0, 137) + '…' : s;
};

export function ChatPanel(props: ChatPanelProps) {
  const chat = useStudioChat(props), { status, autonomy, messages, running } = chat;
  const [text, setText] = useState('');
  /** Images attached to the next message. */
  const [images, setImages] = useState<ChatImage[]>([]);
  const [rowFiles, setRowFiles] = useState<{ name: string; text: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  /** Context chips the user removed (by name), until the selection changes. */
  const [dropped, setDropped] = useState<string[]>([]);
  const contextKey = props.context.map(c => c.name).join(' ');
  useEffect(() => { setDropped([]); }, [contextKey]);
  const chips = props.context.filter(c => !dropped.includes(c.name));

  // (The studio's message as the user's — the Specify panel's answers — once the chat is free.)
  useEffect(() => {
    const o = props.outbox; if (!o || running || !status?.enabled || props.blocked) return;
    props.onOutboxSent?.(o.id); void chat.send(o.text, [], [], chips);
  }, [props.outbox?.id, running, status?.enabled, props.blocked]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [messages]);

  const attach = async (files: Iterable<File>) => {
    for (const file of files) {
      if (/\.json$/i.test(file.name)) {
        try {
          if (file.size > 262144) throw new Error('Row JSON files must be at most 256 KiB.');
          const text = await file.text(); JSON.parse(text);
          setRowFiles(list => [...list, { name: file.name, text }]);
        } catch (e) { chat.notice(e instanceof Error ? e.message : String(e)); }
        continue;
      }
      if (!file.type.startsWith('image/')) continue;
      try { const img = await prepareImage(file); setImages(list => list.length >= 4 ? list : [...list, img]); }
      catch (e) { chat.notice(e instanceof Error ? e.message : String(e)); }
    }
  };
  const send = () => {
    if (running || !status?.enabled || props.blocked || (!text.trim() && !images.length && !rowFiles.length)) return;
    const typed = text, attached = images, rows = rowFiles;
    setText(''); setImages([]); setRowFiles([]);
    void chat.send(typed, attached, rows, chips);
  };

  const enabled = !!status?.enabled;
  return (
    <aside className="card chat" aria-label="Chat"
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
      onDrop={e => { if (!e.dataTransfer.files.length) return; e.preventDefault(); if (enabled && !running) void attach(e.dataTransfer.files); }}>
      <div className="card-title">CHAT <span className="muted">{status?.model ?? ''}</span>
        <span className="grow" />
        <select className="chat-autonomy" aria-label="Autonomy" title={AUTONOMY_TIPS[autonomy - 1]} value={autonomy} disabled={running}
          onChange={e => chat.setAutonomy(Number(e.currentTarget.value))}>
          {AUTONOMY_TIPS.map((t, i) => <option key={i} value={i + 1} title={t}>L{i + 1}</option>)}</select>
        <button className="tool small" aria-label="New conversation" title="New conversation" disabled={running || !messages.length} onClick={() => { setRowFiles([]); chat.reset(); }}><Icon name="restart_alt" small /></button>
        <button className="tool small" aria-label="Close chat" title="Close" onClick={props.onClose}><Icon name="close" small /></button>
      </div>
      <div className="chat-log" ref={log} aria-live="polite">
        {status && !enabled && <div className="chat-setup" role="note">
          <b>Chat is off.</b> {status.reason ?? 'Start the chat server.'}
          <code>pnpm --filter @barocss/cad-studio-app chat</code>
          It runs the claude CLI with its own sign-in; the browser only talks to the local server.
        </div>}
        {enabled && !messages.length && <div className="chat-empty muted">Describe a part or a change, e.g. “a 64×32×8 plate with four Ø8 holes 6 mm from the corners and R2 vertical edges” — or attach a sketch, photo or drawing of it.<br />Your messages are kept in the part’s design history, saved with the file.</div>}
        {messages.map(m => m.role === 'user'
          ? <Message key={m.id} from="user">
              {m.parts.some(p => p.type === 'file') && <div className="chat-thumbs">{m.parts.map((p, k) => p.type === 'file' ? <img key={k} src={p.url} alt={p.filename ?? 'image'} title={p.filename} /> : null)}</div>}
              {m.parts.map(p => p.type === 'text' ? p.text : '').join('')}</Message>
          : <Fragment key={m.id}>{m.parts.map((p, k) => <ChatPart key={k} part={p} {...props} />)}</Fragment>)}
        {running && <div className="chat-msg notice busy">Working…</div>}
      </div>
      {!!rowFiles.length && <div className="chat-thumbs pending" aria-label="Attached row files">{rowFiles.map((file, index) => <span key={index}>{file.name}<button type="button" className="tool tiny" aria-label={`Remove row file ${index + 1}`} onClick={() => setRowFiles(list => list.filter((_, k) => k !== index))}>×</button></span>)}</div>}
      {!!images.length && <div className="chat-thumbs pending" aria-label="Attached images">{images.map((img, k) => <span key={k} className="chat-thumb">
        <img src={imageUrl(img)} alt={img.name} title={`${img.name} · ${img.width}×${img.height}`} />
        <button type="button" aria-label={`Remove ${img.name}`} onClick={() => setImages(list => list.filter((_, j) => j !== k))}><Icon name="close" small /></button></span>)}</div>}
      {!!chips.length && <div className="chat-chips" aria-label="Selection sent as context">{chips.map(c => <span key={c.name} className="chat-chip" title={`The ${c.kind} selected in the viewport, sent with the next message`}>{c.name}
        <button type="button" aria-label={`Leave out ${c.name}`} onClick={() => setDropped(d => [...d, c.name])}><Icon name="close" small /></button></span>)}</div>}
      <form className="chat-input" onSubmit={e => { e.preventDefault(); send(); }}>
        <input ref={fileInput} type="file" accept={`${ACCEPT},application/json,.json`} multiple hidden aria-label="Chat image file" onChange={e => { if (e.target.files) void attach([...e.target.files]); e.target.value = ''; }} />
        <button type="button" className="tool" aria-label="Attach image" title="Attach an image or JSON rows (or paste / drop one)" disabled={!enabled || running || images.length >= 4} onClick={() => fileInput.current?.click()}><Icon name="image" /></button>
        <textarea aria-label="Chat message" rows={2} value={text} disabled={!enabled || running} placeholder={props.blocked ?? (enabled ? 'Ask for a part or a change…' : 'Chat is off')}
          onChange={e => setText(e.target.value)}
          onPaste={e => { const files = [...e.clipboardData.files].filter(f => f.type.startsWith('image/') || /\.json$/i.test(f.name)); if (files.length) { e.preventDefault(); void attach(files); } }}
          onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        {running
          ? <button type="button" className="ghost" onClick={chat.stop}>Stop</button>
          : <button type="submit" className="primary" disabled={!enabled || (!text.trim() && !images.length && !rowFiles.length) || !!props.blocked}>Send</button>}
      </form>
    </aside>
  );
}

/** One part of an assistant message: a run of text, a tool call (a proposal's linked card under its `propose`), a notice, the thinking. */
function ChatPart({ part: p, ...props }: { part: StudioMessage['parts'][number] } & ChatPanelProps) {
  if (p.type === 'text') return <Message from="assistant">{p.text}</Message>;
  if (p.type === 'data-notice') return <Message from="notice">{p.data.text}</Message>;
  // (O17c: the model's thinking, when the CLI streams it — one collapsed line.)
  if (p.type === 'reasoning') return p.text ? <Reasoning text={p.text} /> : null;
  if (p.type !== 'dynamic-tool') return null;
  const failed = p.state === 'output-error', summary = failed ? p.errorText ?? '' : p.state === 'output-available' ? (p.output as { summary?: string } | undefined)?.summary ?? '' : '';
  const label = toolLabel(p.toolName, p.input), id = label === 'proposals.propose' && !failed ? /\bP\d+\b/.exec(summary)?.[0] : undefined, proposal = id ? props.proposals?.find(q => q.id === id) : undefined;
  return <>
    <Tool failed={failed} label={label} summary={summary} icon={<Icon name={failed ? 'error' : 'build'} small />}><code>{brief(p.input)}</code></Tool>
    {proposal && <ProposalLink proposal={proposal} stale={!!props.proposalStale?.(proposal)} busy={!!props.proposalBusy} onAccept={() => props.onAcceptProposal?.(proposal)} onReject={() => props.onRejectProposal?.(proposal)} />}
  </>;
}
