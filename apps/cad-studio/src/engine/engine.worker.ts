/// <reference lib="webworker" />
import { brepsFor, evaluateDoc, evaluatePart, evaluatePreview, stepFor, stlFor } from './evaluate';
import { projectViews } from '../drawing/project';
import { sectionOf } from '../drawing/section';
import { WireReceiver, type WireDoc } from './wireDoc';

export type WorkerRequest =
  | { type: 'evaluate'; id: number; doc: WireDoc; revision: number }
  | { type: 'part'; id: number; doc: WireDoc; revision: number }
  | { type: 'preview'; id: number; doc: WireDoc; revision: number }
  | { type: 'section'; id: number; doc: WireDoc; revision: number }
  | { type: 'stl'; id: number; doc: WireDoc; key: string }
  | { type: 'step'; id: number; doc: WireDoc; name: string }
  | { type: 'drawing'; id: number; doc: WireDoc; options?: { tangentEdges?: boolean; section?: { y: number } } };

const wire = new WireReceiver();
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = { ...event.data, doc: wire.unpack(event.data.doc) };
  if (request.type === 'evaluate' || request.type === 'part' || request.type === 'preview' || request.type === 'section') {
    const result = request.type === 'part' ? evaluatePart(request.doc, request.revision) : request.type === 'preview' || request.type === 'section' ? evaluatePreview(request.doc, request.revision, 8, request.type) : evaluateDoc(request.doc, request.revision);
    const transfer: Transferable[] = [];
    if (result.ok) for (const body of result.bodies) {
      const m = body.mesh;
      transfer.push(m.positions.buffer, m.normals.buffer, m.faceOfVertex.buffer, m.indices.buffer, m.edgeLines.buffer, m.edgeOfSegment.buffer);
    }
    (self as unknown as Worker).postMessage({ id: request.id, result }, transfer);
  } else if (request.type === 'drawing') {
    const r = brepsFor(request.doc);
    const drawing = 'error' in r ? { ok: false as const, error: r.error } : projectViews(r.breps, r.prefixes, request.options);
    if (drawing.ok && request.options?.section) drawing.section = sectionOf(request.doc, request.options.section.y);
    (self as unknown as Worker).postMessage({ id: request.id, drawing });
  } else if (request.type === 'step') {
    (self as unknown as Worker).postMessage({ id: request.id, step: stepFor(request.doc, request.name) });
  } else {
    const bytes = stlFor(request.doc, request.key);
    (self as unknown as Worker).postMessage({ id: request.id, bytes }, bytes ? [bytes.buffer] : []);
  }
};
