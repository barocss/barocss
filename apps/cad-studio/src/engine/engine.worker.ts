/// <reference lib="webworker" />
import { brepsFor, evaluateDoc, evaluatePart, evaluatePlaced, evaluatePreview, evaluateVolumes, shareMeshes, stepFor, stlFor, type PartSlot } from '@barocss/cad-model/engine/evaluate';
import { MeshSender } from '@barocss/cad-model/engine/meshWire';
import { projectViews } from '@barocss/cad-model/drawing/project';
import { sectionsCut } from '@barocss/cad-model/drawing/section';
import type { DrawingSection } from '@barocss/cad-model/drawing/types';
import { WireReceiver, type WireDoc } from '@barocss/cad-model/engine/wireDoc';
import { mouldView } from './mouldView';
import { proposalDiffFor } from '@barocss/cad-model/chat/proposalDiff';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
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
  | { type: 'mould'; id: number; doc: WireDoc; revision: number; halves: boolean; mould: StudioDoc['mould'] }
  | { type: 'proposalDiff'; id: number; doc: WireDoc; proposed: WireDoc; revision: number; key: { revision: string; proposal: string } }
  | { type: 'stl'; id: number; doc: WireDoc; key: string }
  | { type: 'step'; id: number; doc: WireDoc; name: string; meshes?: 'auto' | 'tessellated' | 'planar' }
  /** A STEP file's meshes when it holds nothing else (R3.5), for the repair gate. */
  | { type: 'stepMeshes'; id: number; step: string }
  | { type: 'drawing'; id: number; doc: WireDoc; options?: { tangentEdges?: boolean; sections?: DrawingSection[]; orientation?: 'x+' | 'y+' | 'x-' } }
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
  const proposed = event.data.type === 'proposalDiff' ? wire.unpack(event.data.proposed) : null;
  const request = { ...event.data, doc };
  if (request.type === 'evaluate' || request.type === 'part' || request.type === 'placed' || request.type === 'preview' || request.type === 'section') {
    const result = request.type === 'placed' ? evaluatePlaced(request.doc, base!, request.place, request.revision) : request.type === 'part' ? evaluatePart(request.doc, request.revision, 8, request.slot) : request.type === 'preview' || request.type === 'section' ? evaluatePreview(request.doc, request.revision, 8, request.type) : evaluateDoc(request.doc, request.revision);
    const out = meshesOut.pack(replySlot(request), result);
    (self as unknown as Worker).postMessage({ id: request.id, result: out.result }, out.transfer);
  } else if (request.type === 'mould') {
    // (The part's bodies as evaluated, then the view; the halves' meshes sent in a slot of their own.)
    const part = evaluateDoc(request.doc, request.revision);
    let view: ReturnType<typeof mouldView> = null, why: string | null = null;
    // (The wire carries what evaluation reads: the mould's settings come with the request.)
    try { view = part.ok ? mouldView({ ...request.doc, mould: request.mould }, part.bodies, request.halves) : null; } catch (e) { why = e instanceof Error ? e.message : String(e); }
    const halves = view?.halves, out = meshesOut.pack('mould', { ok: true, revision: request.revision, ms: 0, bodies: halves ? [...halves.plus, ...halves.minus] : [] });
    (self as unknown as Worker).postMessage({ id: request.id, result: out.result, mould: view && { pull: view.pull, loops: view.loops, why: view.why, plus: halves?.plus.length ?? 0, halves: !!halves }, why: why ?? (part.ok ? null : 'the part does not evaluate') }, out.transfer);
  } else if (request.type === 'proposalDiff') {
    // (G12: both sides evaluated in part slots of their own — the base in 'read', the proposal in 'agent', where its
    // preview was just made — then the diff, kept by the base's revision and the proposal; its two meshes in a slot.)
    const a = evaluatePart(request.doc, request.revision, 8, 'read'), b = evaluatePart(proposed!, request.revision, 8, 'agent');
    if (!a.ok || !b.ok) { (self as unknown as Worker).postMessage({ id: request.id, diff: null, why: 'a side does not build' }); return; }
    let d: ReturnType<typeof proposalDiffFor> | null = null, why: string | null = null;
    try { d = proposalDiffFor(request.key, { doc: request.doc, bodies: a.bodies }, { doc: proposed!, bodies: b.bodies }); } catch (e) { why = e instanceof Error ? e.message : String(e); }
    const sides = d ? [d.added, d.removed] : [], bodies = sides.flatMap((m, i) => m ? [{ ...a.bodies[0], key: i ? 'removed' : 'added', mesh: m.mesh }] : []);
    const out = meshesOut.pack('proposalDiff', { ok: true, revision: request.revision, ms: 0, bodies });
    (self as unknown as Worker).postMessage({ id: request.id, result: out.result, diff: d && { added: d.added ? d.added.volumeMM3 : null, removed: d.removed ? d.removed.volumeMM3 : null, changedFaces: d.changedFaces, method: d.method, why: d.why ?? null }, why }, out.transfer);
  } else if (request.type === 'volumes') {
    (self as unknown as Worker).postMessage({ id: request.id, volumes: evaluateVolumes(request.doc) });
  } else if (request.type === 'drawing') {
    const r = brepsFor(request.doc);
    const drawing = 'error' in r ? { ok: false as const, error: r.error } : projectViews(r.breps, r.prefixes, request.options);
    if (drawing.ok && request.options?.sections?.length) drawing.sections = sectionsCut(request.doc, request.options.sections, request.options.orientation);
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
