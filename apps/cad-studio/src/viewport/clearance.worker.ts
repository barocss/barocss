import { CLEARANCE_MAP_VERSION, assemblyPlacedBodies, bandFor, bandPending, clearanceMap, fillOverlap, pendingPairs, type PlacedBody } from '@barocss/cad-model/team/clearanceMap';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { acceptClearanceFill, clearanceDisplay, clearanceSourceDocument, posedClearanceBodies, visibleClearanceBodies } from './clearanceAnalysis';
import type { ClearanceDisplay } from './clearanceDisplay';
import { dropBlobs, putKnownBlob, type BlobArray } from '@barocss/cad-model/engine/blobs';

export interface ClearanceRequest { request: number; documentKey: number; doc: StudioDoc; nearMM: number; motions: [string, Float64Array][]; visibleKeys: string[]; visibleInstances: string[]; blobs?: [string, BlobArray][] }
let latest = 0, documentKey = -1, localBodies: PlacedBody[] = [], evaluation = 1;
let loadedBlobs = new Set<string>();
const yieldTurn = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const send = (display: ClearanceDisplay) => { if (display.request === latest) self.postMessage(display); };
async function compute(job: ClearanceRequest): Promise<void> {
  await yieldTurn(); if (job.request !== latest) return;
  if (!(Number.isFinite(job.nearMM) && job.nearMM > 0)) throw new Error('Near clearance must be a positive finite distance.');
  if (documentKey !== job.documentKey) {
    const result = await assemblyPlacedBodies(clearanceSourceDocument(job.doc), async doc => { const result = evaluateDoc(doc, evaluation++); if (!result.ok) throw new Error('Clearance source evaluation failed: ' + JSON.stringify(result.error)); return result; });
    if (job.request !== latest) return;
    localBodies = result; documentKey = job.documentKey;
  }
  const bodies = posedClearanceBodies(visibleClearanceBodies(localBodies, job.visibleKeys), new Map(job.motions), (job.doc.instances ?? []).map(i => i.id));
  const map = clearanceMap(bodies, { nearMM: job.nearMM }); send(clearanceDisplay(map, bodies, job.request, 'map'));
  for (const pair of bandPending(map)) {
    await yieldTurn(); if (job.request !== latest) return;
    bandFor(map, bodies, pair); send(clearanceDisplay(map, bodies, job.request, 'bands'));
  }
  for (const pair of pendingPairs(map)) {
    await yieldTurn(); if (job.request !== latest) return;
    const fill = fillOverlap(map, bodies, pair);
    if (acceptClearanceFill(map, fill, job.request, latest)) send(clearanceDisplay(map, bodies, job.request, 'overlaps'));
  }
  send(clearanceDisplay(map, bodies, job.request, 'ready'));
}
self.onmessage = (event: MessageEvent<ClearanceRequest>) => {
  const job = event.data; latest = job.request;
  if (job.blobs) {
    const keep = new Set(job.blobs.map(([hash]) => hash));
    dropBlobs([...loadedBlobs].filter(hash => !keep.has(hash)));
    for (const [hash, data] of job.blobs) putKnownBlob(hash, data);
    loadedBlobs = keep;
  }
  void compute(job).catch(error => send({ version: CLEARANCE_MAP_VERSION, request: job.request, revision: '', nearMM: job.nearMM, stage: 'error', pairs: [], overlays: [], error: error instanceof Error ? error.message : String(error) }));
};
