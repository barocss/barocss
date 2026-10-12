import { createCadEditorSplitSession } from './split-session.js';
import { prepareSolidSplitScene } from './split-scene.js';
import type { CadEditorSplitCandidate, CadEditorSplitSession } from './split-types.js';
import { splitWorkerDisplay, splitWorkerIdentity, summarizeSplitWorkerState, validateSplitWorkerCommand, validateSplitWorkerReply } from './split-worker-protocol.js';
import type { SplitWorkerCommand, SplitWorkerIdentity, SplitWorkerReply, SplitWorkerSummary, SplitWorkerError } from './split-worker-protocol.js';

export interface SplitWorkerRuntimePorts {
  postMessage(reply: SplitWorkerReply): void;
  yieldTask?: () => Promise<void>;
  createSession?: typeof createCadEditorSplitSession;
  prepareScene?: typeof prepareSolidSplitScene;
}
interface Active { command: SplitWorkerCommand; cancelled: boolean; cancel: SplitWorkerCommand | null }
interface Candidate { native: CadEditorSplitCandidate; epoch: number }
function requireValue(value: unknown, message: string): asserts value { if (!value) throw Object.assign(new Error(message), { code: 'STALE' }); }

/** One worker, one native owner, one preparation. Cancellation drains before its ACK. */
export function createSplitWorkerRuntime(ports: SplitWorkerRuntimePorts) {
  const createSession = ports.createSession ?? createCadEditorSplitSession;
  const prepareScene = ports.prepareScene ?? prepareSolidSplitScene;
  const yieldTask = ports.yieldTask ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  let session: CadEditorSplitSession | null = null, workspaceId: string | null = null;
  let lastRequest = 0, lastEpoch = 0, disposed = false;
  let active: Active | null = null, candidate: Candidate | null = null;
  let lastDrainedEpoch: number | null = null;
  let accepted: { command: Extract<SplitWorkerCommand, { type: 'ACCEPT' }>; reply: Extract<SplitWorkerReply, { type: 'ACK' }> } | null = null;
  const state = (): SplitWorkerSummary | null => session ? summarizeSplitWorkerState(session.getSnapshot()) : null;
  const send = (reply: SplitWorkerReply) => { validateSplitWorkerReply(reply); ports.postMessage(reply); };
  const ack = (command: SplitWorkerIdentity, cancelled = false) => {
    const reply: Extract<SplitWorkerReply, { type: 'ACK' }> = { ...splitWorkerIdentity(command), type: 'ACK', summary: state(), cancelled };
    send(reply); return reply;
  };
  const fail = (command: SplitWorkerIdentity, cause: unknown, unchanged: boolean, cancelled = false) => {
    const encode = (value: unknown, depth = 0): SplitWorkerError => {
      const failure = value instanceof Error ? value : new Error('Split worker operation refused.');
      const code = 'code' in failure && typeof failure.code === 'string' ? failure.code.slice(0, 64) : 'NATIVE';
      const result: SplitWorkerError = { name: (failure.name || 'Error').slice(0, 64), code: code || 'NATIVE', message: (failure.message || 'Split worker operation refused.').slice(0, 1024) };
      if (failure.cause !== undefined && depth < 2) result.cause = encode(failure.cause, depth + 1);
      return result;
    };
    send({ ...splitWorkerIdentity(command), type: 'ERROR', error: encode(cause), unchanged, cancelled });
  };
  const dropCandidate = () => {
    if (candidate && session) { const token = candidate.native.token; candidate = null; session.cancelCandidate(token); }
  };
  const dispose = () => {
    if (disposed) return; disposed = true;
    if (active) active.cancelled = true;
    candidate = null; accepted = null; session?.dispose(); session = null;
  };
  const prepare = async (command: SplitWorkerCommand) => {
    const work: Active = { command, cancelled: false, cancel: null }; active = work;
    try {
      if (command.type === 'INIT') {
        session = createSession(command.text, { initialPresentation: command.initialPresentation });
        await yieldTask();
        requireValue(!disposed, 'Split initialization disposed.');
        const snapshot = session.getSnapshot();
        // INIT has no prior display to retain. Finish its one DTO even when hidden, then drain CANCEL.
        const display = splitWorkerDisplay(prepareScene(snapshot.presentation, snapshot.accepted));
        lastDrainedEpoch = command.epoch;
        requireValue(!disposed, 'Split initialization disposed.');
        send({ ...splitWorkerIdentity(command), type: 'INIT_READY', summary: summarizeSplitWorkerState(snapshot), display });
      } else {
        requireValue(session, 'Split session is unavailable.');
        const native = command.type === 'PREPARE_APPLY' ? session.prepareApply()
          : command.type === 'PREPARE_OPEN' ? session.prepareOpen(command.text)
          : command.type === 'PREPARE_UNDO' ? session.prepareUndo() : session.prepareRedo();
        if (native) candidate = { native, epoch: command.epoch };
        // This is a worker task boundary, not a microtask. Queued CANCEL gets a turn before tessellation.
        await yieldTask();
        requireValue(!work.cancelled && !disposed, 'Split preparation cancelled.');
        if (!native) { ack(command); return; }
        const display = splitWorkerDisplay(prepareScene(native.presentation, native.result));
        requireValue(!work.cancelled && !disposed && candidate?.native.token === native.token, 'Split candidate cancelled.');
        send({ ...splitWorkerIdentity(command), type: 'CANDIDATE', token: native.token, kind: native.kind, summary: state()!, display });
      }
    } catch (cause) {
      try { dropCandidate(); } catch { /* Preserve original failure; no acceptance was attempted. */ }
      if (command.type === 'INIT') { session?.dispose(); session = null; }
      if (!disposed) fail(command, cause, true, work.cancelled);
    } finally {
      lastDrainedEpoch = command.epoch;
      if (active === work) active = null;
      if (work.cancel && !disposed) ack(work.cancel, true);
    }
  };
  const receive = async (value: unknown): Promise<void> => {
    let command: SplitWorkerCommand;
    try { validateSplitWorkerCommand(value); command = value; }
    catch {
      // Never inspect payload accessors or invoke native code for malformed transport.
      return;
    }
    let unchanged = true;
    try {
      requireValue(!disposed, 'Split worker is disposed.');
      requireValue(workspaceId === null ? command.type === 'INIT' : command.workspaceId === workspaceId, 'Wrong Split worker identity.');
      if (accepted && command.type === 'ACCEPT' && command.requestId === accepted.command.requestId
        && command.epoch === accepted.command.epoch && command.token === accepted.command.token
        && command.generation === accepted.command.generation && command.displayGeneration === accepted.command.displayGeneration) {
        send(accepted.reply); return;
      }
      requireValue(command.requestId > lastRequest && command.epoch >= lastEpoch, 'Stale Split request identity.');
      const current = state();
      requireValue(command.generation === (current?.generation ?? 0) && command.displayGeneration === (current?.displayGeneration ?? 0), 'Stale Split generations.');
      lastRequest = command.requestId; lastEpoch = command.epoch;
      if (command.type === 'DISPOSE') { const reply = { ...splitWorkerIdentity(command), type: 'ACK' as const, summary: null, cancelled: false }; dispose(); send(reply); return; }
      if (command.type === 'CANCEL') {
        if (active) {
          requireValue(command.targetEpoch === active.command.epoch && active.cancel === null, 'Cancellation target is not the active preparation.');
          active.cancelled = true; active.cancel = command; return;
        }
        if (!candidate && command.targetEpoch === lastDrainedEpoch) { ack(command, true); return; }
        requireValue(candidate !== null && candidate.epoch === command.targetEpoch, 'Cancellation target is no longer current.');
        dropCandidate(); ack(command, true); return;
      }
      requireValue(active === null, 'A Split preparation is still draining.');
      if (command.type === 'INIT') {
        requireValue(workspaceId === null && session === null, 'Split worker was already initialized.');
        requireValue(command.generation === 0 && command.displayGeneration === 0, 'Initial generations must be zero.');
        workspaceId = command.workspaceId; await prepare(command); return;
      }
      requireValue(session !== null, 'Split worker has no initialized session.');
      if (command.type === 'ACCEPT') {
        requireValue(candidate !== null && candidate.epoch === command.epoch && candidate.native.token === command.token, 'Split candidate identity changed.');
        const before = state()!;
        try { session.acceptCandidate(command.token); }
        catch (cause) {
          const after = state(); unchanged = !!after && after.generation === before.generation && after.displayGeneration === before.displayGeneration;
          if (unchanged) { try { dropCandidate(); } catch { /* Acceptance failure remains authoritative. */ } }
          throw cause;
        }
        unchanged = false; candidate = null;
        const reply: Extract<SplitWorkerReply, { type: 'ACK' }> = { ...splitWorkerIdentity(command), type: 'ACK', summary: state(), cancelled: false };
        // Cache before posting: a lost response cannot cause a second history commit.
        accepted = { command, reply }; send(reply); return;
      }
      requireValue(candidate === null, 'Resolve the current Split candidate before another operation.');
      if (command.type.startsWith('PREPARE_')) { lastDrainedEpoch = null; await prepare(command); return; }
      if (command.type === 'STAGE') { session.stageCutYField(command.cutY); ack(command); return; }
      if (command.type === 'DISCARD') { session.discardPending(); ack(command); return; }
      if (command.type === 'MARK_DOWNLOADED') { session.markDownloaded(command.token); ack(command); return; }
      if (command.type === 'SERIALIZE') {
        const download = session.serializeAccepted(); send({ ...splitWorkerIdentity(command), type: 'SERIALIZED', summary: state()!, download }); return;
      }
      requireValue(false, 'Unsupported Split operation.');
    } catch (cause) { if (!disposed) fail(command, cause, unchanged); }
  };
  return { receive, dispose };
}
