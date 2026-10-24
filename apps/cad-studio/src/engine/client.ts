import { rememberFaceTable } from '@barocss/cad-model/assembly/faces';
import type { EvalResult, PartSlot } from '@barocss/cad-model/engine/evaluate';
import { MeshReceiver, type WireResult } from '@barocss/cad-model/engine/meshWire';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';
/** A proposal's diff as the viewport overlays it (G12). */
export interface ProposalOverlay {
  added: { mesh: DisplayMesh; volume: number } | null;
  removed: { mesh: DisplayMesh; volume: number } | null;
  changedFaces: { name: string; kind: 'added' | 'removed' | 'changed' }[];
  method: 'boolean' | 'faces';
  why: string | null;
}
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { DrawingResult } from '@barocss/cad-model/drawing/project';
import type { DrawingSection } from '@barocss/cad-model/drawing/types';
import { WireSender } from '@barocss/cad-model/engine/wireDoc';
import type { MeshDiagnosis, MeshRepairResult, MeshRepairSteps } from '@barocss/cad';
import { Lanes, type LaneReply } from './lanes';
import { receiveNativeMass, receiveNativeMassPatch, type NativeMassSource } from '@barocss/cad-model/engine/nativeMassWire';
import type { MassReply } from './engine.worker';
export type { LaneReply } from './lanes';

/** An evaluation's face table kept on this side (by the part's content), so face reads here do not evaluate it again (PERF3 A1). */
function remembered(doc: StudioDoc, r: EvalResult): void { if (r.ok && r.faceTable) rememberFaceTable(doc, r.faceTable); }

/** One worker; the newest evaluation wins and stale replies are dropped. */
export class EngineClient {
  private worker!: Worker;
  private next = 1;
  private epoch = 0;
  private nativeSources = new Map<number, NativeMassSource>();
  private massSource: NativeMassSource | null = null;
  private pending = new Map<number, (data: unknown) => void>();
  /** A repair's stages as the worker posts them, by request. */
  private progress = new Map<number, (stage: string) => void>();
  private latestEval = 0;
  /** Every request's document goes through this, in the order the worker receives them. */
  private wire = new WireSender();
  /** Replies' meshes by slot (the worker sends only those it has not sent there last time, PERF3 B12), and each evaluation's slot. */
  private meshesIn = new MeshReceiver();
  private slots = new Map<number, string>();
  /** O9: the lanes requests go on (engine/lanes.ts): a newer request on a lane makes the older come back stale. */
  private lanes = new Lanes();
  /** O18: who hears the masses the worker posts after an evaluation's reply (by mass ref, unplaced). */
  private massListeners = new Set<(masses: MassReply['masses']) => void>();

  constructor() { this.start(); }
  private start() {
    const epoch = ++this.epoch;
    this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<{ id: number; progress?: string; result?: WireResult; nativeMass?: unknown[] } | MassReply>) => {
      if (epoch !== this.epoch) return;
      if ('masses' in event.data) {
        const source = this.massSource;
        const current = source ? event.data.masses.filter(m => receiveNativeMassPatch(m.fields, m.ref, m.nativeMass, source)) : [];
        if (current.length) for (const listen of this.massListeners) listen(current);
        return;
      }
      if (event.data.progress !== undefined) { this.progress.get(event.data.id)?.(event.data.progress); return; }
      this.progress.delete(event.data.id);
      // (Every evaluation reply, stale ones too, in the order posted: the held meshes follow the worker's.)
      const slot = this.slots.get(event.data.id);
      if (slot !== undefined && event.data.result) {
        this.slots.delete(event.data.id);
        try { (event.data as { result: EvalResult }).result = this.meshesIn.unpack(slot, event.data.result); }
        catch (e) { (event.data as { result: EvalResult }).result = { ok: false, revision: 0, error: { title: 'Evaluation lost', hint: 'Evaluate again.', detail: e instanceof Error ? e.message : String(e) }, ms: 0 }; }
      }
      const source = this.nativeSources.get(event.data.id);
      this.nativeSources.delete(event.data.id);
      const result = event.data.result as EvalResult | undefined;
      if (source && result?.ok && result.revision === source.revision && (source.slot !== 'evaluate' || source.requestId === this.latestEval)) {
        const envelopes = event.data.nativeMass;
        if (Array.isArray(envelopes) && envelopes.length === result.bodies.length) {
          for (let i = 0; i < result.bodies.length; i++) receiveNativeMass(result.bodies[i], envelopes[i], source);
        }
      }
      const resolve = this.pending.get(event.data.id);
      this.pending.delete(event.data.id);
      resolve?.(event.data);
    };
  }
  /**
   * Stops whatever the worker is computing (a long Boolean on a mesh, D42): the worker is ended and a new one
   * started (its caches empty); every request waiting gets a refusal ("Stopped").
   */
  restart(): void {
    this.worker.terminate();
    const error = { title: 'Stopped', hint: 'The computation was stopped.', detail: '' };
    const cancelled = { result: { ok: false, revision: 0, error, ms: 0 }, step: { error: 'cancelled' }, drawing: { ok: false, error }, bytes: null, error: 'stopped', why: 'stopped' };
    this.progress.clear();
    for (const resolve of this.pending.values()) resolve(cancelled);
    // (The lanes are kept: a request waiting on one comes back as the refusal above, "Stopped", as before O9.)
    this.pending.clear(); this.latestEval = 0; this.wire = new WireSender(); this.meshesIn = new MeshReceiver(); this.slots.clear(); this.nativeSources.clear(); this.massSource = null;
    this.start();
  }

  /**
   * O9: a request on a lane — `engine.latest('preview', { revision, source }, () => engine.preview(doc, revision))` — its
   * reply, stale when a newer request went on the same lane first (a late reply never overwrites what overtook it). One lane
   * per thing a result replaces: 'preview', `section:<view>`, `drawing:<part>`, `placed:<instance>` …
   */
  /** O18: the deferred masses as the worker works them out (each a body's, by its `massRef`); the returned function stops listening. */
  onMasses(listen: (masses: MassReply['masses']) => void): () => void { this.massListeners.add(listen); return () => { this.massListeners.delete(listen); }; }

  latest<T>(lane: string, asked: { revision: number; source: string }, request: () => Promise<T>): Promise<LaneReply<T>> { return this.lanes.run(lane, asked, request); }

  evaluate(doc: StudioDoc, revision: number): Promise<EvalResult | null> {
    const id = this.next++; this.latestEval = id;
    const nativeSource = { epoch: this.epoch, requestId: id, revision, slot: 'evaluate' };
    this.nativeSources.set(id, nativeSource); this.massSource = nativeSource;
    return new Promise(resolve => {
      this.pending.set(id, data => { const r = (data as { result: EvalResult }).result; remembered(doc, r); resolve(id === this.latestEval ? r : null); });
      this.slots.set(id, 'evaluate');
      this.worker.postMessage({ type: 'evaluate', id, doc: this.wire.pack(doc), revision, nativeSource });
    });
  }

  /** A command's preview (its own cache, no mass properties): never dropped as stale. */
  preview(doc: StudioDoc, revision: number): Promise<EvalResult> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => resolve((data as { result: EvalResult }).result));
      this.slots.set(id, 'preview');
      this.worker.postMessage({ type: 'preview', id, doc: this.wire.pack(doc), revision });
    });
  }

  /** The section view's split part (a cache of its own, so dragging the plane leaves a command's preview alone). */
  section(doc: StudioDoc, revision: number): Promise<EvalResult> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => resolve((data as { result: EvalResult }).result));
      this.slots.set(id, 'section');
      this.worker.postMessage({ type: 'section', id, doc: this.wire.pack(doc), revision });
    });
  }

  /**
   * The mould's view (G6): its parting loops, and its two halves' bodies when asked (built in the worker); null without a
   * pull, with why when the halves cannot be built.
   */
  mould(doc: StudioDoc, revision: number, halves: boolean): Promise<{ pull: [number, number, number]; loops: { points: [number, number, number][]; closed: boolean; flat: boolean }[]; why: string | null; plus: import('@barocss/cad-model/engine/evaluate').BodyResult[]; minus: import('@barocss/cad-model/engine/evaluate').BodyResult[] } | { error: string } | null> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => {
        const d = data as { result: EvalResult; mould: { pull: [number, number, number]; loops: { points: [number, number, number][]; closed: boolean; flat: boolean }[]; why: string | null; plus: number; halves: boolean } | null; why: string | null };
        if (d.why) { resolve({ error: d.why }); return; }
        if (!d.mould) { resolve(null); return; }
        const bodies = d.result.ok ? d.result.bodies : [];
        resolve({ pull: d.mould.pull, loops: d.mould.loops, why: d.mould.why, plus: bodies.slice(0, d.mould.plus), minus: bodies.slice(d.mould.plus) });
      });
      this.slots.set(id, 'mould');
      this.worker.postMessage({ type: 'mould', id, doc: this.wire.pack(doc), revision, halves, mould: doc.mould });
    });
  }

  /**
   * Another part on its own (an instance, or a check's, an agent's or a reference's version of this one): never
   * dropped as stale. `slot`: what it is for — each keeps its own last snapshot in the worker (PERF3 B12).
   */
  part(doc: StudioDoc, revision: number, slot: PartSlot = 'part'): Promise<EvalResult> {
    const id = this.next++;
    const nativeSource = { epoch: this.epoch, requestId: id, revision, slot: `part:${slot}` };
    this.nativeSources.set(id, nativeSource);
    return new Promise(resolve => {
      this.pending.set(id, data => { const r = (data as { result: EvalResult }).result; remembered(doc, r); resolve(r); });
      this.slots.set(id, `part:${slot}`);
      this.worker.postMessage({ type: 'part', id, doc: this.wire.pack(doc), revision, slot, nativeSource });
    });
  }

  /**
   * What a proposal adds to and takes from the part (G12, `proposalDiff` in the worker, kept there by `key`): the added and
   * removed material's meshes and volumes, the faces by persistent name, and the method ('faces': the Boolean refused, why).
   */
  proposalDiff(base: StudioDoc, proposed: StudioDoc, revision: number, key: { revision: string; proposal: string }): Promise<ProposalOverlay | { error: string }> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => {
        const d = data as { result?: EvalResult; diff: { added: number | null; removed: number | null; changedFaces: { name: string; kind: 'added' | 'removed' | 'changed' }[]; method: 'boolean' | 'faces'; why: string | null } | null; why: string | null };
        if (!d.diff) { resolve({ error: d.why ?? 'stopped' }); return; }
        const bodies = d.result?.ok ? d.result.bodies : [], mesh = (k: string) => bodies.find(b => b.key === k)?.mesh ?? null;
        resolve({ added: d.diff.added !== null ? { mesh: mesh('added')!, volume: d.diff.added } : null, removed: d.diff.removed !== null ? { mesh: mesh('removed')!, volume: d.diff.removed } : null, changedFaces: d.diff.changedFaces, method: d.diff.method, why: d.diff.why });
      });
      this.slots.set(id, 'proposalDiff');
      // (The base, then the proposal: the worker unpacks them in that order.)
      const baseWire = this.wire.pack(base), proposedWire = this.wire.pack(proposed);
      this.worker.postMessage({ type: 'proposalDiff', id, doc: baseWire, proposed: proposedWire, revision, key });
    });
  }

  /** A part's bodies' volumes only, no meshes (a clash probe's intersection). */
  volumes(doc: StudioDoc): Promise<{ ok: true; volumes: { key: string; volume: number | null }[] } | { ok: false; error: unknown }> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => resolve((data as { volumes?: { ok: true; volumes: { key: string; volume: number | null }[] } }).volumes ?? { ok: false, error: 'stopped' }));
      this.worker.postMessage({ type: 'volumes', id, doc: this.wire.pack(doc) });
    });
  }

  /** A placed part's display bodies (copies of one part share its tessellation): never dropped as stale. */
  placed(doc: StudioDoc, base: StudioDoc, place: { m: number[]; t: [number, number, number] }, revision: number): Promise<EvalResult> {
    const id = this.next++;
    const nativeSource = { epoch: this.epoch, requestId: id, revision, slot: 'placed' };
    this.nativeSources.set(id, nativeSource);
    return new Promise(resolve => {
      this.pending.set(id, data => resolve((data as { result: EvalResult }).result));
      this.slots.set(id, 'placed');
      this.worker.postMessage({ type: 'placed', id, doc: this.wire.pack(doc), base: this.wire.pack(base), place, revision, nativeSource });
    });
  }

  /** A STEP file's meshes when it holds nothing else (R3.5), else null. */
  stepMeshes(step: string): Promise<{ name: string; positions: Float64Array; indices: Uint32Array }[] | null | { error: string }> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => { const d = data as { meshes?: { name: string; positions: Float64Array; indices: Uint32Array }[] | null; error?: string }; resolve(d.error ? { error: d.error } : d.meshes ?? null); });
      this.worker.postMessage({ type: 'stepMeshes', id, step });
    });
  }
  /** What is wrong with a mesh (M3), worked out in the worker. */
  diagnose(positions: ArrayLike<number>, indices: ArrayLike<number>): Promise<MeshDiagnosis | { error: string }> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => { const d = data as { diagnosis?: MeshDiagnosis; error?: string }; resolve(d.diagnosis ?? { error: d.error ?? 'stopped' }); });
      this.worker.postMessage({ type: 'diagnose', id, positions, indices });
    });
  }
  /** A mesh repaired by the steps in the worker, its stages told as it goes; stopped by `restart`. */
  repair(positions: ArrayLike<number>, indices: ArrayLike<number>, steps: MeshRepairSteps, onStage: (stage: string) => void): Promise<MeshRepairResult | { error: string }> {
    const id = this.next++;
    return new Promise(resolve => {
      this.progress.set(id, onStage);
      this.pending.set(id, data => { const d = data as { repair?: MeshRepairResult; error?: string }; resolve(d.repair ?? { error: d.error ?? 'stopped' }); });
      this.worker.postMessage({ type: 'repair', id, positions, indices, steps });
    });
  }

  step(doc: StudioDoc, name: string, meshes?: 'auto' | 'tessellated' | 'planar'): Promise<{ text: string; omitted?: string[] } | { error: string }> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => resolve((data as { step: { text: string; omitted?: string[] } | { error: string } }).step));
      this.worker.postMessage({ type: 'step', id, doc: this.wire.pack(doc), name, ...(meshes ? { meshes } : {}) });
    });
  }

  /** The part's drawing views (hidden-line projections), never dropped as stale. */
  /** `made` (O174): a part's drawing — its bought elements left out of the views and the sections; an assembly's keeps them. */
  drawing(doc: StudioDoc, options: { tangentEdges?: boolean; sections?: DrawingSection[]; orientation?: 'x+' | 'y+' | 'x-'; made?: boolean } = {}): Promise<DrawingResult> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => resolve((data as { drawing: DrawingResult }).drawing));
      this.worker.postMessage({ type: 'drawing', id, doc: this.wire.pack(doc), options });
    });
  }

  stl(doc: StudioDoc, key: string): Promise<Uint8Array | null> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => resolve((data as { bytes: Uint8Array | null }).bytes));
      this.worker.postMessage({ type: 'stl', id, doc: this.wire.pack(doc), key });
    });
  }
}
