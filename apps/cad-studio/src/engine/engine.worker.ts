/// <reference lib="webworker" />
import { brepsFor, evaluateDoc, evaluatePart, evaluatePlaced, evaluatePreview, evaluateVolumes, shareMeshes, stepFor, stlFor, type PartSlot } from '@barocss/cad-model/engine/evaluate';
import { MeshSender } from '@barocss/cad-model/engine/meshWire';
import { projectViews } from '@barocss/cad-model/drawing/project';
import { sectionOf } from '@barocss/cad-model/drawing/section';
import { WireReceiver, type WireDoc } from '@barocss/cad-model/engine/wireDoc';
import { mouldView } from './mouldView';
import { diagnoseMesh, repairMesh, stepMeshes, stepSizeProblem, stepTessellatedChars, type MeshRepairSteps } from '@barocss/cad';

export type WorkerRequest =
  | { type: 'evaluate'; id: number; doc: WireDoc; revision: number }
  | { type: 'part'; id: number; doc: WireDoc; revision: number; slot?: PartSlot }
  /** A part's bodies' volumes, no meshes (a clash probe, PERF3 B12). */
  | { type: 'volumes'; id: number; doc: WireDoc }
  | { type: 'placed'; id: number; doc: WireDoc; base: WireDoc; place: { m: number[]; t: [number, number, number] }; revision: number }
  | { type: 'preview'; id: number; doc: WireDoc; revision: number }
  | { type: 'section'; id: number; doc: WireDoc; revision: number }
  /** The mould's parting loops, and its halves when asked (G6: the tooling's Booleans, off the main thread). */
  | { type: 'mould'; id: number; doc: WireDoc; revision: number; halves: boolean }
  | { type: 'stl'; id: number; doc: WireDoc; key: string }
  | { type: 'step'; id: number; doc: WireDoc; name: string; meshes?: 'auto' | 'tessellated' | 'planar' }
  /** A STEP file's meshes when it holds nothing else (R3.5), for the repair gate. */
  | { type: 'stepMeshes'; id: number; step: string }
  | { type: 'drawing'; id: number; doc: WireDoc; options?: { tangentEdges?: boolean; section?: { y: number }; orientation?: 'x+' | 'y+' | 'x-' } }
  /** A mesh checked and repaired (M3, D47), off the main thread; a repair posts its stages as it goes. */
  | { type: 'diagnose'; id: number; positions: ArrayLike<number>; indices: ArrayLike<number> }
  | { type: 'repair'; id: number; positions: ArrayLike<number>; indices: ArrayLike<number>; steps: MeshRepairSteps };

const wire = new WireReceiver(), meshesOut = new MeshSender();
// (The kept meshes are handed out as they are; the sender copies only what the client does not hold.)
shareMeshes(true);
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const post = (data: unknown, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(data, transfer);
  if (event.data.type === 'diagnose') {
    const { id, positions, indices } = event.data;
    try { post({ id, diagnosis: diagnoseMesh(positions, indices) }); } catch (e) { post({ id, error: e instanceof Error ? e.message : String(e) }); }
    return;
  }
  if (event.data.type === 'stepMeshes') {
    const { id, step } = event.data;
    // Too large: refused unread (D49); no tessellated record: not a mesh file, and not parsed twice.
    const tooLarge = stepSizeProblem(step);
    if (tooLarge) { post({ id, error: tooLarge }); return; }
    if (!stepTessellatedChars(step)) { post({ id, meshes: null }); return; }
    try { const m = stepMeshes(step); post({ id, meshes: m }, m ? m.flatMap(x => [x.positions.buffer, x.indices.buffer]) : []); } catch (e) { post({ id, error: e instanceof Error ? e.message : String(e) }); }
    return;
  }
  if (event.data.type === 'repair') {
    const { id, positions, indices, steps } = event.data;
    try {
      const r = repairMesh(positions, indices, steps, stage => post({ id, progress: stage }));
      post({ id, repair: r }, [r.positions.buffer, r.indices.buffer, r.fill.buffer]);
    } catch (e) { post({ id, error: e instanceof Error ? e.message : String(e) }); }
    return;
  }
  // (The documents unpacked in the order the client packed them: the request's, then a placed part's base.)
  const doc = wire.unpack(event.data.doc), base = event.data.type === 'placed' ? wire.unpack(event.data.base) : null;
  const request = { ...event.data, doc };
  if (request.type === 'evaluate' || request.type === 'part' || request.type === 'placed' || request.type === 'preview' || request.type === 'section') {
    const result = request.type === 'placed' ? evaluatePlaced(request.doc, base!, request.place, request.revision) : request.type === 'part' ? evaluatePart(request.doc, request.revision, 8, request.slot) : request.type === 'preview' || request.type === 'section' ? evaluatePreview(request.doc, request.revision, 8, request.type) : evaluateDoc(request.doc, request.revision);
    const out = meshesOut.pack(replySlot(request), result);
    (self as unknown as Worker).postMessage({ id: request.id, result: out.result }, out.transfer);
  } else if (request.type === 'mould') {
    // (The part's bodies as evaluated, then the view; the halves' meshes sent in a slot of their own.)
    const part = evaluateDoc(request.doc, request.revision);
    let view: ReturnType<typeof mouldView> = null, why: string | null = null;
    try { view = part.ok ? mouldView(request.doc, part.bodies, request.halves) : null; } catch (e) { why = e instanceof Error ? e.message : String(e); }
    const halves = view?.halves, out = meshesOut.pack('mould', { ok: true, revision: request.revision, ms: 0, bodies: halves ? [...halves.plus, ...halves.minus] : [] });
    (self as unknown as Worker).postMessage({ id: request.id, result: out.result, mould: view && { pull: view.pull, loops: view.loops, why: view.why, plus: halves?.plus.length ?? 0, halves: !!halves }, why: why ?? (part.ok ? null : 'the part does not evaluate') }, out.transfer);
  } else if (request.type === 'volumes') {
    (self as unknown as Worker).postMessage({ id: request.id, volumes: evaluateVolumes(request.doc) });
  } else if (request.type === 'drawing') {
    const r = brepsFor(request.doc);
    const drawing = 'error' in r ? { ok: false as const, error: r.error } : projectViews(r.breps, r.prefixes, request.options);
    if (drawing.ok && request.options?.section) drawing.section = sectionOf(request.doc, request.options.section.y, request.options.orientation);
    (self as unknown as Worker).postMessage({ id: request.id, drawing });
  } else if (request.type === 'step') {
    (self as unknown as Worker).postMessage({ id: request.id, step: stepFor(request.doc, request.name, request.meshes) });
  } else {
    const bytes = stlFor(request.doc, request.key);
    (self as unknown as Worker).postMessage({ id: request.id, bytes }, bytes ? [bytes.buffer] : []);
  }
};
/** Which reply slot a request's meshes are kept in (the client names the same: EngineClient.slotOf). */
function replySlot(r: { type: string; slot?: string }): string { return r.type === 'part' ? `part:${r.slot ?? 'part'}` : r.type; }
