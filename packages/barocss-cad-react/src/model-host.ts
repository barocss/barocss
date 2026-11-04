/** Actual Worker host. Viewer integration is a thin injected existing-Viewer sink. */
import { readStudioDoc } from '@barocss/cad-model/engine/migrate';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { EngineAdapter, type Owner, type State } from './adapter.js';
import type { Compiled } from './compiler.js';
import type { ModelLifecycle } from './components.js';

import type {ExistingViewerSink,ModelHostOptions} from './ports.js';

export class ModelHost implements ModelLifecycle {
  private adapter: EngineAdapter;
  private sink: ExistingViewerSink;
  private disposed = false;
  private pendingModel = true;
  private barrier: { promise: Promise<void>; resolve(): void } | null = null;
  private desired: { fingerprint: string; doc: StudioDoc } | null = null;
  private native: { owner: Owner; bodies: readonly BodyResult[] } | null = null;
  private rendered: Owner | null = null;
  private error: string | null = null;
  private state: State | null = null;
  private requests = 0;
  private merges = 0;
  private checkpoints = 0;
  private ignored = 0;
  private submitted: { fingerprint: string; revision: number }[] = [];
  constructor(private options: ModelHostOptions) {
    this.sink = options.sink;
    this.adapter = new EngineAdapter({ engine: options.engine, ownership: options.ownership,
      massPolicy: { merge: (bodies, patches) => {
        const merged = options.massPolicy.merge(bodies, patches);
        if (merged !== bodies && this.adapter.state.desired) {
          this.merges++; this.native = { owner: this.adapter.state.desired, bodies: merged };
        }
        return merged;
      } },
      changed: state => { this.state = state; },
    });
  }
  /** Subscribe after React commit, never during render. Constructor is inert. */
  connect() { this.adapter.connect(); }
  dirty() {
    if (this.disposed) return;
    this.pendingModel = true;
    if (!this.barrier) {
      let resolve = () => {};
      const promise = new Promise<void>(done => { resolve = done; }); this.barrier = { promise, resolve };
    }
    // Do not publish a React state pulse: a dirty->identical checkpoint is quiet.
    // Presentation/observation freshness is blocked by pendingModel immediately.
  }
  private settle() { const pending = this.barrier; this.barrier = null; pending?.resolve(); }
  invalid(error: unknown) {
    if (this.disposed) return;
    this.error = error instanceof Error ? error.message : String(error);
    this.pendingModel = false; this.desired = null;
    this.adapter.invalid(error); this.settle();
  }
  detached() {
    if (this.disposed) return;
    this.pendingModel = true; this.desired = null; this.adapter.pending(); this.settle();
  }
  complete(model: Compiled) {
    if (this.disposed) return;
    this.checkpoints++;
    const parsed = readStudioDoc(JSON.stringify(model.doc));
    if ('error' in parsed) { this.invalid(new Error(parsed.error)); return; }
    const same = this.desired?.fingerprint === model.fingerprint;
    this.desired = { fingerprint: model.fingerprint, doc: parsed.doc };
    this.pendingModel = false; this.error = null;
    const validOwner = this.adapter.state.desired?.fingerprint === model.fingerprint
      && !['idle', 'pending', 'invalid', 'failed', 'disposed'].includes(this.adapter.state.phase);
    // Identical complete checkpoint retains current successful/in-flight native
    // owner. Invalid/failure/restart recovery always submits a new actual request.
    if (same && validOwner) { this.settle(); return; }
    this.requests++;
    const job = this.adapter.submit({ doc: parsed.doc, fingerprint: model.fingerprint, admission: 'supported-synchronous-model' });
    const owner = this.adapter.state.desired;
    if (owner) this.submitted.push({ fingerprint: owner.fingerprint, revision: owner.evaluationRevision });
    this.settle();
    void job.then(async outcome => {
      if (outcome.kind === 'stale') { this.ignored++; return; }
      if (outcome.kind === 'failed') { if (this.desired?.fingerprint === model.fingerprint) this.error = String(outcome.error); return; }
      await this.whenStable();
      if (!this.current(outcome.owner)) { this.ignored++; return; }
      if (this.native?.owner !== outcome.owner) this.native = { owner: outcome.owner, bodies: outcome.result.bodies };
      await this.sink.show(outcome.result.bodies, outcome.owner, () => this.current(outcome.owner));
      if (this.current(outcome.owner)) this.rendered = outcome.owner;
      else this.ignored++;
    }).catch(error => {
      if (!this.disposed && owner && this.adapter.state.desired === owner)
        this.error = error instanceof Error ? error.message : String(error);
    });
  }
  private async whenStable() {
    while (!this.disposed && this.barrier) await this.barrier.promise;
  }
  private current(owner: Owner) {
    return !this.disposed && !this.pendingModel && this.desired?.fingerprint === owner.fingerprint
      && this.adapter.state.desired === owner && this.adapter.state.freshNative;
  }
  read() {
    const owner = this.native?.owner;
    const current = !!owner && this.current(owner);
    const body = current ? this.native!.bodies[0] : null;
    return { status: this.disposed ? 'disposed' : this.error ? 'failed' : current && this.rendered === owner ? 'ready' : 'pending',
      error: this.error, pendingModel: this.pendingModel, checkpoints: this.checkpoints, requests: this.requests,
      merges: this.merges, ignored: this.ignored, submitted: this.submitted,
      currentDocument: this.desired?.doc ?? null, documentJSON: this.desired ? JSON.stringify(this.desired.doc) : null,
      fingerprint: this.desired?.fingerprint ?? null, nativeOwner: owner ?? null, renderedOwner: this.rendered,
      native: body ? { key: body.key, volume: body.volume, centroid: body.centroid ?? null, bounds: body.mesh.bounds,
        ...(body.pieces === undefined ? {} : {pieces:body.pieces}),
        deferred: body.massRef !== undefined, vertices: body.mesh.positions.length / 3, triangles: body.mesh.indices.length / 3 } : null,
      adapter: this.state, viewer: this.sink.snapshot() };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.settle(); this.adapter.dispose(); if (this.options.ownsSink) this.sink.dispose();
  }
}
