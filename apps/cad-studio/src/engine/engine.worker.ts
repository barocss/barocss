/// <reference lib="webworker" />
import { evaluateDoc, stepFor, stlFor } from './evaluate';
import type { StudioDoc } from './doc';

export type WorkerRequest =
  | { type: 'evaluate'; id: number; doc: StudioDoc; revision: number }
  | { type: 'stl'; id: number; doc: StudioDoc; key: string }
  | { type: 'step'; id: number; doc: StudioDoc; name: string };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type === 'evaluate') {
    const result = evaluateDoc(request.doc, request.revision);
    const transfer: Transferable[] = [];
    if (result.ok) for (const body of result.bodies) {
      const m = body.mesh;
      transfer.push(m.positions.buffer, m.normals.buffer, m.faceOfVertex.buffer, m.indices.buffer, m.edgeLines.buffer, m.edgeOfSegment.buffer);
    }
    (self as unknown as Worker).postMessage({ id: request.id, result }, transfer);
  } else if (request.type === 'step') {
    (self as unknown as Worker).postMessage({ id: request.id, step: stepFor(request.doc, request.name) });
  } else {
    const bytes = stlFor(request.doc, request.key);
    (self as unknown as Worker).postMessage({ id: request.id, bytes }, bytes ? [bytes.buffer] : []);
  }
};
