/// <reference lib="webworker" />
import { brepsFor, evaluateDoc, evaluatePart, stepFor, stlFor } from './evaluate';
import { projectViews } from '../drawing/project';
import { sectionOf } from '../drawing/section';
import type { StudioDoc } from './doc';

export type WorkerRequest =
  | { type: 'evaluate'; id: number; doc: StudioDoc; revision: number }
  | { type: 'part'; id: number; doc: StudioDoc; revision: number }
  | { type: 'stl'; id: number; doc: StudioDoc; key: string }
  | { type: 'step'; id: number; doc: StudioDoc; name: string }
  | { type: 'drawing'; id: number; doc: StudioDoc; options?: { tangentEdges?: boolean; section?: { y: number } } };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type === 'evaluate' || request.type === 'part') {
    const result = request.type === 'part' ? evaluatePart(request.doc, request.revision) : evaluateDoc(request.doc, request.revision);
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
