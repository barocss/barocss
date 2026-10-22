import { useEffect, useMemo, useRef, useState } from 'react';
import { CLEARANCE_MAP_VERSION } from '@barocss/cad-model/team/clearanceMap';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { ClearanceDisplay } from './clearanceDisplay';
import type { ClearanceRequest } from './clearance.worker';
import { getBlob, type BlobArray } from '@barocss/cad-model/engine/blobs';
import { clearanceBlobRefs } from './clearanceBlobs';

/** A single worker per active analysis; current document/pose identity is checked before anything reaches the Canvas. */
export function useClearanceAnalysis(active: boolean, doc: StudioDoc, nearMM: number, motions: [string, Float64Array][], visibleKeys: string[], visibleInstances: string[]): ClearanceDisplay | null {
  const worker = useRef<Worker | null>(null), request = useRef(0), document = useRef({ doc, key: 1 }), sentDocument = useRef(-1);
  if (document.current.doc !== doc) document.current = { doc, key: document.current.key + 1 };
  const key = useMemo(() => ({}), [active, doc, nearMM, motions, visibleKeys, visibleInstances]);
  const [state, setState] = useState<{ key: object; value: ClearanceDisplay } | null>(null);
  useEffect(() => {
    if (!active) return;
    const next = new Worker(new URL('./clearance.worker.ts', import.meta.url), { type: 'module' }); worker.current = next; sentDocument.current = -1;
    return () => { request.current++; next.terminate(); if (worker.current === next) worker.current = null; };
  }, [active]);
  useEffect(() => {
    const next = worker.current; if (!active || !next) return;
    const id = ++request.current;
    setState({ key, value: { version: CLEARANCE_MAP_VERSION, request: id, revision: '', nearMM, stage: 'evaluating', pairs: [], overlays: [] } });
    next.onmessage = (event: MessageEvent<ClearanceDisplay>) => {
      const value = event.data;
      if (request.current === id && value.request === id && value.version === CLEARANCE_MAP_VERSION) setState({ key, value });
    };
    next.onerror = event => { if (request.current === id) setState({ key, value: { version: CLEARANCE_MAP_VERSION, request: id, revision: '', nearMM, stage: 'error', pairs: [], overlays: [], error: event.message || 'Clearance worker failed.' } }); };
    try {
      let blobs: [string, BlobArray][] | undefined;
      if (sentDocument.current !== document.current.key) blobs = [...clearanceBlobRefs(doc)].map(hash => { const data = getBlob(hash); if (!data) throw new Error('Clearance mesh data is not loaded: ' + hash); return [hash, data]; });
      const job: ClearanceRequest = { request: id, documentKey: document.current.key, doc, nearMM, motions, visibleKeys, visibleInstances, blobs };
      // Copy, do not transfer: the document's arrays remain available to the editor and Save.
      next.postMessage(job); sentDocument.current = document.current.key;
    } catch (error) {
      setState({ key, value: { version: CLEARANCE_MAP_VERSION, request: id, revision: '', nearMM, stage: 'error', pairs: [], overlays: [], error: error instanceof Error ? error.message : String(error) } });
    }
    return () => { if (request.current === id) request.current++; };
  }, [active, key, doc, nearMM, motions, visibleKeys, visibleInstances]);
  return active && state?.key === key ? state.value : null;
}
