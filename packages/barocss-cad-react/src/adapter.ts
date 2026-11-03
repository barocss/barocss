/** Declaration and native request ownership over an injected existing engine. */
import type {StudioDoc} from '@barocss/cad-model/engine/doc';
import type {BodyResult,EvalResult} from '@barocss/cad-model/engine/evaluate';
import type {EnginePort,MassPatch} from './ports.js';
type MassPatches=MassPatch[];
export type Success = Extract<EvalResult, { ok: true }>;
export interface Owner {
  readonly hostEpoch: number;
  readonly declaration: number;
  readonly evaluationRevision: number;
  readonly fingerprint: string;
}
export interface CompleteModel {
  readonly doc: StudioDoc;
  readonly fingerprint: string;
  /** Reviewed frontend policy, not automatic internal-Suspense detection. */
  readonly admission: 'supported-synchronous-model' | 'explicit-readiness-barrier';
}
export interface ActiveFrame { dispose(): void }
export interface PreparedFrame {
  /** Proposed adapter contract, NOT an existing Viewer API. `previous` is borrowed:
   * commit may switch its visibility but MUST NOT dispose/consume it. The adapter
   * disposes previous exactly once after successful commit. On error, preserve
   * previous ownership/visibility. Only discard owns uncommitted staged resources.
   */
  commit(previous: ActiveFrame | null): ActiveFrame;
  discard(): void;
}
export interface PresentationPort {
  prepare(bodies: readonly BodyResult[], owner: Owner): Promise<PreparedFrame>;
  dispose(): void;
}
/** Inject existing provenance-aware withMasses equivalent; no merge-by-ref fallback. */
export interface MassPolicy {
  merge(bodies: BodyResult[], patches: MassPatches): BodyResult[];
}
export type Phase = 'idle' | 'pending' | 'invalid' | 'evaluating' | 'evaluated' | 'staging' | 'displayed' | 'failed' | 'disposed';
export interface State {
  phase: Phase;
  desired: Owner | null;
  shown: Owner | null;
  freshNative: boolean;
  freshPresentation: boolean;
  mass: 'none' | 'pending' | 'settled-or-not-applicable';
  error?: unknown;
}
export type Outcome = { kind: 'accepted'; owner: Owner; result: Success; presentation: 'absent' | 'committed' }
  | { kind: 'stale' } | { kind: 'failed'; error: unknown };
interface Ticket { owner: Owner; retired: Promise<void>; retire(): void }
interface Evaluation { owner: Owner; doc: StudioDoc; result: Success }
interface Options {
  engine: EnginePort;
  ownership: 'owned' | 'borrowed';
  presentation?: PresentationPort;
  ownsPresentation?: boolean;
  massPolicy?: MassPolicy;
  changed?(state: State): void;
}

/** No worker, viewer, native model or subscription is created in the constructor. */
export class EngineAdapter {
  private options: Options;
  private connected = false;
  private disposed = false;
  private epoch = 1;
  private declaration = 0;
  private revision = 0;
  private ticket: Ticket | null = null;
  private evaluation: Evaluation | null = null;
  private shown: Owner | null = null;
  private frame: ActiveFrame | null = null;
  private phase: Phase = 'idle';
  private error: unknown = undefined;
  private off: (() => void)[] = [];
  constructor(options: Options) { this.options = options; }
  get state(): State {
    const freshNative = !!this.evaluation && this.current(this.evaluation.owner)
      && ['evaluated', 'staging', 'displayed'].includes(this.phase);
    return { phase: this.phase, desired: this.ticket?.owner ?? null, shown: this.shown,
      freshNative, freshPresentation: freshNative && this.shown === this.ticket?.owner && this.phase === 'displayed',
      mass: !freshNative ? 'none' : this.evaluation!.result.bodies.some(b => b.massRef !== undefined)
        ? 'pending' : 'settled-or-not-applicable',
      ...(this.error === undefined ? {} : { error: this.error }) };
  }
  /** Explicit post-commit lifecycle; injected client must grant exclusive evaluation use. */
  connect(): void {
    if (this.disposed) throw new Error('Adapter is disposed');
    if (this.connected) return;
    try {
      this.off.push(this.options.engine.onFailure(error => {
        if (this.disposed) return;
        ++this.epoch; this.invalidate('failed', error);
      }));
      this.off.push(this.options.engine.onMasses(patches => this.receiveMasses(patches)));
      this.connected = true;
    } catch (error) {
      for (const off of this.off.splice(0)) try { off(); } catch { /* Preserve the connection error and attempt every rollback. */ }
      throw error;
    }
  }
  private notify() {
    // Observer failures cannot become native success or abort owned cleanup.
    try { this.options.changed?.(this.state); } catch { /* Observer is not authority. */ }
  }
  private current(owner: Owner): boolean {
    return !this.disposed && this.connected && this.ticket?.owner === owner && owner.hostEpoch === this.epoch;
  }
  private invalidate(phase: Phase, error?: unknown) {
    ++this.declaration; this.ticket?.retire(); this.ticket = null;
    this.phase = phase; this.error = error; this.notify();
  }
  /** Required on dirtiness BEFORE async realization/validation, even without a new evaluate. */
  pending(): void { if (!this.disposed) this.invalidate('pending'); }
  invalid(error: unknown): void { if (!this.disposed) this.invalidate('invalid', error); }
  private makeTicket(input: CompleteModel): Ticket {
    this.ticket?.retire();
    let retire = () => {};
    const retired = new Promise<void>(resolve => { retire = resolve; });
    const owner = Object.freeze({ hostEpoch: this.epoch, declaration: ++this.declaration,
      evaluationRevision: ++this.revision, fingerprint: input.fingerprint });
    const ticket = { owner, retired, retire }; this.ticket = ticket; return ticket;
  }
  private async wait<T>(ticket: Ticket, job: Promise<T>): Promise<{ stale: true } | { stale: false; value: T }> {
    return Promise.race([
      job.then(value => ({ stale: false as const, value })),
      ticket.retired.then(() => ({ stale: true as const })),
    ]);
  }
  async submit(input: CompleteModel): Promise<Outcome> {
    if (this.disposed) return { kind: 'stale' };
    if (!this.connected) throw new Error('Connect adapter after commit before submit');
    if (!['supported-synchronous-model', 'explicit-readiness-barrier'].includes(input.admission)) {
      const error = new Error('Model admission/readiness policy is missing'); this.invalid(error); return { kind: 'failed', error };
    }
    const ticket = this.makeTicket(input), owner = ticket.owner;
    this.phase = 'evaluating'; this.error = undefined; this.notify();
    // changed() can synchronously retire this ticket. Do not issue an unowned job.
    if (!this.current(owner)) return { kind: 'stale' };
    let prepared: PreparedFrame | null = null;
    try {
      const answer = await this.wait(ticket, this.options.engine.evaluate(input.doc, owner.evaluationRevision));
      if (answer.stale || !this.current(owner)) return { kind: 'stale' };
      const result = answer.value;
      if (result === null) throw new Error('Current exclusive client evaluation was retired');
      if (!result.ok) throw result.error;
      if (result.revision !== owner.evaluationRevision) throw new Error('Native result revision mismatch');
      // Bounded bracket prototype policy, NOT a general CAD body-count rule.
      if (result.bodies.length !== 1) throw new Error('This bracket prototype expects one output body; native validity remains engine authority');
      this.evaluation = { owner, doc: input.doc, result };
      this.phase = 'evaluated'; this.notify();
      if (!this.current(owner)) return { kind: 'stale' };
      if (this.options.presentation) {
        this.phase = 'staging'; this.notify();
        if (!this.current(owner)) return { kind: 'stale' };
        const preparation = this.options.presentation.prepare(result.bodies, owner).then(stage => {
          if (!this.current(owner)) { stage.discard(); return null; }
          return stage;
        });
        const staged = await this.wait(ticket, preparation);
        if (staged.stale || !this.current(owner) || staged.value === null) return { kind: 'stale' };
        prepared = staged.value;
        const previous = this.frame;
        this.frame = prepared.commit(previous); prepared = null;
        this.shown = owner; this.phase = 'displayed'; this.notify();
        previous?.dispose();
      }
      if (!this.current(owner)) return { kind: 'stale' };
      return { kind: 'accepted', owner, result: this.evaluation.result,
        presentation: this.options.presentation ? 'committed' : 'absent' };
    } catch (error) {
      prepared?.discard();
      if (!this.current(owner)) return { kind: 'stale' };
      this.phase = 'failed'; this.error = error; this.notify(); return { kind: 'failed', error };
    }
  }
  private receiveMasses(patches: MassPatches) {
    const evaluation = this.evaluation;
    if (!evaluation || !this.current(evaluation.owner) || !this.state.freshNative || !this.options.massPolicy) return;
    const refs = new Set(evaluation.result.bodies.flatMap(b => b.massRef === undefined ? [] : [b.massRef]));
    const candidates = patches.filter(p => refs.has(p.ref) && p.nativeMass.kind === 'ready'
      && p.nativeMass.revision === evaluation.owner.evaluationRevision
      && p.nativeMass.slot === 'evaluate' && p.nativeMass.massRef === p.ref && p.nativeMass.bodyKey === null);
    if (!candidates.length) return;
    // Existing EngineClient authenticates native epoch/request/signature. Injected
    // merge must STILL use matchesNativeMassPatch + placedMassFields, not ref alone.
    const before = evaluation.result.bodies;
    let bodies: BodyResult[];
    try { bodies = this.options.massPolicy.merge(before, candidates); }
    catch (error) { this.phase = 'failed'; this.error = error; this.notify(); return; }
    if (bodies.length !== before.length || bodies.some((b, i) => b.key !== before[i].key || b.mesh !== before[i].mesh)) {
      this.phase = 'failed'; this.error = new Error('Mass policy changed geometry ownership'); this.notify(); return;
    }
    if (bodies !== before) { evaluation.result = { ...evaluation.result, bodies }; this.notify(); }
  }
  /** Soft cancellation always works. Hard stop is allowed only for owned client. */
  cancel(hard = false): { hardStopped: boolean; reason?: string } {
    if (this.disposed) return { hardStopped: false, reason: 'disposed' };
    this.invalidate('pending');
    if (!hard) return { hardStopped: false };
    if (this.options.ownership !== 'owned') return { hardStopped: false, reason: 'borrowed-engine' };
    ++this.epoch;
    try {
      const started = this.options.engine.restart();
      if (!started) { this.phase = 'failed'; this.error = new Error('Engine restart failed'); this.notify(); }
      return { hardStopped: started };
    } catch (error) { this.phase = 'failed'; this.error = error; this.notify(); return { hardStopped: false, reason: 'restart-error' }; }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; ++this.epoch; this.ticket?.retire(); this.ticket = null;
    const actions = this.off.splice(0);
    if (this.frame) { const frame = this.frame; actions.push(() => frame.dispose()); }
    if (this.options.ownership === 'owned') actions.push(() => this.options.engine.dispose());
    if (this.options.presentation && this.options.ownsPresentation) actions.push(() => this.options.presentation!.dispose());
    const failures: unknown[] = [];
    for (const action of actions) try { action(); } catch (error) { failures.push(error); }
    this.frame = null; this.evaluation = null; this.shown = null; this.connected = false;
    this.phase = 'disposed'; this.error = failures.length ? failures : undefined; this.notify();
  }
}
