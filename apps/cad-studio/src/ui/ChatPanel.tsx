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
import { isLocalTaskRunHost, type SavedTaskRunPlan, type TaskRunChatOutput, type TaskRunCheckpointRequest, type TaskRunLaunch, type TaskRunOffer, type TaskRunReplanSelection, type TaskRunReviewRequest, type TaskRunStatus } from '../chat/taskRunOffer';
import { TaskRunApprovalHistory } from './TaskRunApprovalHistory';
import type { RequirementEvidence } from '@barocss/cad-model/chat/requirementEvidence';
import type { WorkingApprovalChecks } from '../files/workingApprovalChecks';
import type { CheckpointReview } from '../files/taskCheckpoint';
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
  /** CG6: the project's version log for a turn (storage/useProject: its index and the documents the turn needs), and the turn's brought back. */
  versions?: import('../storage/useProject').ProjectActions['chat'];
  onOutboxSent?(id: number): void;
  taskRun?: {
    reopened?: TaskRunLaunch;
    sourceKey(): string | undefined;
    export(offer: TaskRunOffer, sourceKey: string): Promise<void>;
    start(plan: SavedTaskRunPlan): Promise<TaskRunLaunch | undefined>;
    refresh(run: TaskRunStatus): Promise<TaskRunStatus>;
    rebuild(run: TaskRunStatus, taskId: string, attemptId: string): Promise<TaskRunStatus>;
    observe(status: TaskRunStatus): void;
    openBaseline(status: TaskRunStatus): Promise<void>;
    openCheckpoint(status: TaskRunStatus): Promise<void>;
    workingVersion: object;
    prepareTaskReplacement(selection: TaskRunReplanSelection): Promise<SavedTaskRunPlan | undefined>;
    prepareWorkingRepair(review: CheckpointReview, report: RequirementEvidence, version: object, current: () => boolean): Promise<SavedTaskRunPlan | undefined>;
    checkWorkingApproval(review: CheckpointReview, current: () => boolean): Promise<WorkingApprovalChecks | undefined>;
    readApproval(request: TaskRunCheckpointRequest, current: () => boolean): Promise<CheckpointReview | undefined>;
    review(candidate: Omit<TaskRunReviewRequest, 'baselineDigest'>): Promise<void>;
    modelViewBlocked: boolean;
  };
  /** The document a turn runs on (an edited part, roadmap 10 ⑧, is another from the assembly): a turn that ends on a different one is dropped, not merged. */
  scope?: object | null;
  /** Whether a turn is running (the studio does not swap the document under one). */
  onRunning?(running: boolean): void;
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

interface RunStatuses {
  current: ReadonlyMap<string, TaskRunStatus>;
  remember(status: TaskRunStatus): void;
}

export function ChatPanel(props: ChatPanelProps) {
  const chat = useStudioChat(props), { status, autonomy, messages, running } = chat;
  useEffect(() => { props.onRunning?.(running); return () => props.onRunning?.(false); }, [running]);
  const [text, setText] = useState('');
  const [runStatuses, setRunStatuses] = useState<ReadonlyMap<string, TaskRunStatus>>(() => new Map());
  const runStatusesNow = useRef(runStatuses);
  const rememberRunStatus = (snapshot: TaskRunStatus) => {
    const prior = runStatusesNow.current.get(snapshot.runId);
    if (prior && (prior.runKey !== snapshot.runKey || prior.revision >= snapshot.revision)) return;
    const { runKey, runId, phase, revision, baselineDigest, checkpoint, approvals, tasks } = snapshot;
    const status = { runKey, runId, phase, revision, baselineDigest, checkpoint, approvals, tasks };
    const next = new Map(runStatusesNow.current).set(runId, status);
    runStatusesNow.current = next;
    setRunStatuses(next);
    props.taskRun?.observe(status);
  };
  /** Images attached to the next message. */
  const [images, setImages] = useState<ChatImage[]>([]);
  const imageDraftGeneration = useRef(0);
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
    const draft = imageDraftGeneration.current;
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
      try {
        const img = await prepareImage(file);
        if (draft !== imageDraftGeneration.current) return;
        setImages(list => list.length >= 4 ? list : [...list, img]);
      } catch (e) {
        if (draft !== imageDraftGeneration.current) return;
        chat.notice(e instanceof Error ? e.message : String(e));
      }
    }
  };
  const send = () => {
    if (running || !status?.enabled || props.blocked || (!text.trim() && !images.length && !rowFiles.length)) return;
    const limit = chat.imageLimitNotice(images.length);
    if (limit) { chat.notice(limit); return; }
    const typed = text, attached = images, rows = rowFiles;
    setText(''); setImages([]); setRowFiles([]);
    void chat.send(typed, attached, rows, chips);
  };

  const newConversation = () => {
    imageDraftGeneration.current++;
    setImages([]);
    setRowFiles([]);
    chat.reset();
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
        <button className="tool small" aria-label="New conversation" title="New conversation" disabled={running || !messages.length} onClick={newConversation}><Icon name="restart_alt" small /></button>
        <button className="tool small" aria-label="Close chat" title="Close" onClick={props.onClose}><Icon name="close" small /></button>
      </div>
      <div className="chat-log" ref={log} aria-live="polite">
        {status && !enabled && <div className="chat-setup" role="note">
          <b>Chat is off.</b> {status.reason ?? 'Start the chat server.'}
          <code>pnpm --filter @barocss/cad-studio-app chat</code>
          It runs the claude CLI with its own sign-in; the browser only talks to the local server.
        </div>}
        {enabled && !messages.length && !props.taskRun?.reopened && <div className="chat-empty muted">Describe a part or a change, e.g. “a 64×32×8 plate with four Ø8 holes 6 mm from the corners and R2 vertical edges” — or attach a sketch, photo or drawing of it.<br />Your messages are kept in the part’s design history, saved with the file.</div>}
        {props.taskRun?.reopened && <section className="chat-tool" aria-label="Reopened task run">
          <TaskRunCards key={props.taskRun.reopened.runId} initialRun={props.taskRun.reopened} actions={props.taskRun}
            blocked={running || !!props.blocked} statuses={{ current: runStatuses, remember: rememberRunStatus }} />
        </section>}
        {messages.map(m => m.role === 'user'
          ? <Message key={m.id} from="user">
              {m.parts.some(p => p.type === 'file') && <div className="chat-thumbs">{m.parts.map((p, k) => p.type === 'file' ? <img key={k} src={p.url} alt={p.filename ?? 'image'} title={p.filename} /> : null)}</div>}
              {m.parts.map(p => p.type === 'text' ? p.text : '').join('')}</Message>
          : <Fragment key={m.id}>{m.parts.map((p, k) => <ChatPart key={k} part={p} {...props} taskRunBlocked={running || !!props.blocked} runStatuses={{ current: runStatuses, remember: rememberRunStatus }} />)}</Fragment>)}
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
function ChatPart({ part: p, taskRunBlocked, runStatuses, ...props }: { part: StudioMessage['parts'][number]; taskRunBlocked: boolean; runStatuses: RunStatuses } & ChatPanelProps) {
  if (p.type === 'text') return <Message from="assistant">{p.text}</Message>;
  if (p.type === 'data-notice') return <Message from="notice">{p.data.text}</Message>;
  // (O17c: the model's thinking, when the CLI streams it — one collapsed line.)
  if (p.type === 'reasoning') return p.text ? <Reasoning text={p.text} /> : null;
  if (p.type !== 'dynamic-tool') return null;
  const output = p.state === 'output-available' ? p.output as TaskRunChatOutput | undefined : undefined;
  const failed = p.state === 'output-error', summary = failed ? p.errorText ?? '' : output?.summary ?? '';
  const label = toolLabel(p.toolName, p.input), id = label === 'proposals.propose' && !failed ? /\bP\d+\b/.exec(summary)?.[0] : undefined, proposal = id ? props.proposals?.find(q => q.id === id) : undefined;
  const taskRun = label === 'requirements.plan_tasks' ? output?.taskRun : undefined;
  return <>
    <Tool failed={failed} label={label} summary={summary} icon={<Icon name={failed ? 'error' : 'build'} small />}>
      <code>{brief(p.input)}</code>
      {taskRun && props.taskRun && <TaskRunCards plan={taskRun} actions={props.taskRun} blocked={taskRunBlocked} statuses={runStatuses} />}
    </Tool>
    {proposal && <ProposalLink proposal={proposal} stale={!!props.proposalStale?.(proposal)} busy={!!props.proposalBusy} onAccept={() => props.onAcceptProposal?.(proposal)} onReject={() => props.onRejectProposal?.(proposal)} />}
  </>;
}

interface TaskRunCardProps {
  plan?: SavedTaskRunPlan;
  initialRun?: TaskRunLaunch;
  actions: NonNullable<ChatPanelProps['taskRun']>;
  blocked: boolean;
  statuses: RunStatuses;
}

function TaskRunCards({ initialRun, ...props }: TaskRunCardProps) {
  const [repairs, setRepairs] = useState<ReadonlyMap<string, { plan: SavedTaskRunPlan; version: object }>>(() => new Map());
  const prepared = (plan: SavedTaskRunPlan, version: object) => {
    const key = JSON.stringify([plan.sourceKey, plan.offer.revision, plan.offer.occurrences, plan.replaces?.runId]);
    setRepairs(prior => new Map(prior).set(key, { plan, version }));
  };
  return <>
    <TaskRunActions {...props} initialRun={initialRun} onPrepared={prepared} />
    {[...repairs].map(([key, { plan, version }]) => <section key={key} aria-label={plan.replaces ? 'Prepared replacement' : 'Prepared repair'}>
      <strong>{plan.replaces ? 'Prepared replacement' : 'Prepared repair'}</strong>
      <TaskRunActions {...props} plan={plan} repair startBlocked={version !== props.actions.workingVersion} onPrepared={prepared} />
    </section>)}
  </>;
}

function TaskRunActions({ plan, initialRun, actions, blocked, statuses, repair = false, startBlocked = false, onPrepared }: TaskRunCardProps & {
  repair?: boolean;
  startBlocked?: boolean;
  onPrepared(plan: SavedTaskRunPlan, version: object): void;
}) {
  const busy = useRef(false);
  const [working, setWorking] = useState<'start' | 'status' | 'checkpoint' | 'baseline' | { taskId: string; action: 'review' | 'rebuild' | 'replan' }>();
  const disabled = blocked || working !== undefined;
  const [launch, setLaunch] = useState<TaskRunLaunch>();
  const base = launch ?? initialRun;
  const latest = base && statuses.current.get(base.runId);
  const result = base && latest?.runKey === base.runKey && latest.revision >= base.revision ? { ...base, ...latest } : base;
  const [error, setError] = useState('');
  async function start() {
    if (busy.current || blocked || startBlocked || !plan) return;
    busy.current = true;
    setWorking('start');
    setError('');
    try {
      const launched = await actions.start(plan);
      if (launched) {
        statuses.remember(launched);
        setLaunch(launched);
      } else setError('The saved source is no longer current. Save and inspect it again.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not start the local task run.');
    } finally { busy.current = false; setWorking(undefined); }
  }
  async function refresh() {
    if (busy.current || !result) return;
    busy.current = true;
    setWorking('status');
    setError('');
    try {
      statuses.remember(await actions.refresh(result));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not refresh the local task run.');
    } finally { busy.current = false; setWorking(undefined); }
  }
  async function openRunFile(kind: 'checkpoint' | 'baseline') {
    if (busy.current || !result || (kind === 'checkpoint' && !result.checkpoint)) return;
    busy.current = true;
    setWorking(kind);
    setError('');
    try { await (kind === 'baseline' ? actions.openBaseline(result) : actions.openCheckpoint(result)); }
    catch (error) { setError(error instanceof Error ? error.message : `Could not open the local run ${kind}.`); }
    finally { busy.current = false; setWorking(undefined); }
  }
  async function review(task: TaskRunLaunch['tasks'][number]) {
    if (busy.current || !result || !task.review) return;
    busy.current = true;
    setWorking({ taskId: task.id, action: 'review' });
    setError('');
    try {
      const { attemptId, candidateDigest } = task.review;
      await actions.review({ runKey: result.runKey, runId: result.runId, taskId: task.id, attemptId, candidateDigest });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not review the local worker candidate.');
    } finally { busy.current = false; setWorking(undefined); }
  }
  async function rebuild(task: TaskRunLaunch['tasks'][number]) {
    if (busy.current || !result || !task.rebuild) return;
    busy.current = true;
    setWorking({ taskId: task.id, action: 'rebuild' });
    setError('');
    try { statuses.remember(await actions.rebuild(result, task.id, task.rebuild)); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not rebuild the local candidate.'); }
    finally { busy.current = false; setWorking(undefined); }
  }
  async function replan(task: TaskRunLaunch['tasks'][number]) {
    if (busy.current || !result || !task.replan) return;
    const { runKey, runId, baselineDigest, revision } = result, version = actions.workingVersion;
    busy.current = true;
    setWorking({ taskId: task.id, action: 'replan' });
    setError('');
    try {
      const replacement = await actions.prepareTaskReplacement({ runKey, runId, baselineDigest, revision, taskId: task.id, pin: task.replan });
      if (replacement) onPrepared(replacement, version);
      else setError('The saved working model changed. Prepare the replacement again.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not prepare the replacement.');
    } finally { busy.current = false; setWorking(undefined); }
  }
  return <>
    {plan && <>
      <ul>{plan.offer.targets.map(target => <li key={target.id}>{target.id} · {target.widthMm === undefined ? '' : 'Width '}{target.currentHeightMm ?? target.currentWidthMm} → {target.heightMm ?? target.widthMm} mm</li>)}</ul>
      {!plan.replaces && <button className="ghost" type="button" disabled={blocked || startBlocked} onClick={() => void actions.export(plan.offer, plan.sourceKey)}>Export task run</button>}
      {isLocalTaskRunHost(window.location.hostname) && <button className="ghost" type="button" disabled={disabled || startBlocked} onClick={() => void start()}>{working === 'start' ? 'Starting local run…' : plan.replaces ? 'Start replacement' : repair ? 'Start repair' : 'Start local run'}</button>}
    </>}
    {startBlocked && !result && <div role="status">Check the saved working model and prepare the repair again.</div>}
    {error && <div role="status">{error}</div>}
    {result && <div role="status">
      <span>{(initialRun ? 'Reopened local run' : result.reused ? 'Existing local run' : 'Local run started') + ' · ' + result.phase}</span>
      <button className="ghost" type="button" aria-label="Refresh local run status" disabled={disabled} onClick={() => void refresh()}>
        {working === 'status' ? 'Refreshing…' : 'Refresh status'}
      </button>
      {initialRun && <button className="ghost" type="button" aria-label="Open run baseline"
        disabled={disabled || actions.modelViewBlocked} onClick={() => void openRunFile('baseline')}>
        {working === 'baseline' ? 'Verifying baseline…' : 'Open run baseline'}
      </button>}
      {result.checkpoint && <button className="ghost" type="button" aria-label="Open approved checkpoint"
        disabled={disabled || actions.modelViewBlocked} onClick={() => void openRunFile('checkpoint')}>
        {working === 'checkpoint' ? 'Verifying checkpoint…' : 'Open approved checkpoint'}
      </button>}
      <ul>{result.tasks.map(task => <li key={task.id}><span>{task.id + ' · ' + task.phase.replaceAll('-', ' ') + (task.reason ? ' · ' + task.reason : '')}</span>
        {task.review && <button className="ghost" type="button" aria-label={`Review candidate ${task.id}`}
          disabled={disabled || actions.modelViewBlocked}
          title={actions.modelViewBlocked ? 'Return to the current model view to review the candidate.' : undefined}
          onClick={() => void review(task)}>{typeof working === 'object' && working.taskId === task.id && working.action === 'review' ? 'Checking…' : 'Review'}</button>}
        {task.rebuild && <button className="ghost" type="button" aria-label={`Rebuild candidate ${task.id}`}
          disabled={disabled} onClick={() => void rebuild(task)}>
          {typeof working === 'object' && working.taskId === task.id && working.action === 'rebuild' ? 'Rebuilding…' : 'Rebuild'}
        </button>}
        {task.replan && <button className="ghost" type="button" aria-label={`Prepare replacement for ${task.id}`}
          disabled={disabled} onClick={() => void replan(task)}>
          {typeof working === 'object' && working.taskId === task.id && working.action === 'replan' ? 'Preparing…' : 'Prepare replacement'}
        </button>}
      </li>)}</ul>
      {!!result.approvals?.length && <TaskRunApprovalHistory key={result.runId} run={result} read={actions.readApproval}
        workingVersion={actions.workingVersion} checkWorking={actions.checkWorkingApproval}
        prepareRepair={isLocalTaskRunHost(window.location.hostname) ? actions.prepareWorkingRepair : undefined}
        repairBlocked={blocked} onPrepared={onPrepared} />}
      <code title={result.directory}>{result.directory}</code>
    </div>}
  </>;
}
