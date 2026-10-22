import { useEffect, useMemo, useRef, useState } from 'react';
import { CAM_PACKAGE_VERSION, type CamPackage } from '@barocss/cad-model/machining/camPackage';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { CamDisplay, CamOptions } from './camDisplay';
import type { CamReply, CamRequest } from './cam.worker';

// G23 CNC (G-R3, from Codex's source 5c9f861f): the preview's worker, one per enable. A display is shown only for the
// request it answers; a source, setup or tool change clears it at once (pending), so old removal never shows over a new
// part. The package's metadata (setups, move counts) stays while only the progress or the grid changes.

export interface CamState { stage: 'pending' | 'ready' | 'error'; display: CamDisplay | null; package?: CamPackage; count?: number; error?: string }
const PENDING: CamState = { stage: 'pending', display: null };

export function useCamPreview(active: boolean, doc: StudioDoc, bodies: BodyResult[], options: CamOptions): CamState {
  const worker = useRef<Worker | null>(null), request = useRef(0), source = useRef({ doc, bodies, key: 1 }), sent = useRef(0);
  if (source.current.doc !== doc || source.current.bodies !== bodies) source.current = { doc, bodies, key: source.current.key + 1 };
  const toolKey = JSON.stringify(options.tool ?? null);
  const scope = useMemo(() => ({}), [active, doc, bodies, toolKey]);
  const rangeScope = useMemo(() => ({}), [scope, options.setup]);
  const key = useMemo(() => ({}), [rangeScope, options.progress, options.cellMM]);
  const metadata = useRef<{ scope: object; packageKey: number; package: CamPackage } | null>(null);
  const range = useRef<{ scope: object; count: number } | null>(null);
  const [result, setResult] = useState<{ key: object; state: CamState } | null>(null);
  useEffect(() => {
    if (!active) return;
    const next = new Worker(new URL('./cam.worker.ts', import.meta.url), { type: 'module' });
    worker.current = next; metadata.current = null; range.current = null; sent.current = 0;
    return () => { request.current++; next.terminate(); if (worker.current === next) worker.current = null; };
  }, [active]);
  useEffect(() => {
    const next = worker.current;
    if (!active || !next) return;
    const id = ++request.current;
    setResult({ key, state: PENDING });
    next.onmessage = (event: MessageEvent<CamReply>) => {
      const value = event.data;
      if (id !== request.current || value.request !== id) return;
      if (value.package) {
        if (value.package.version !== CAM_PACKAGE_VERSION || value.package.notForProduction !== true) { setResult({ key, state: { stage: 'error', display: null, error: 'The CNC package version or its NOT FOR PRODUCTION banner is not the one this preview reads.' } }); return; }
        if (metadata.current?.scope !== scope || metadata.current.packageKey !== value.packageKey) metadata.current = { scope, packageKey: value.packageKey!, package: value.package };
        const count = value.package.setups[options.setup]?.moves.length;
        if (count !== undefined) range.current = { scope: rangeScope, count };
      }
      if (value.error) { setResult({ key, state: { stage: 'error', display: null, error: value.error } }); return; }
      if (!value.display || !metadata.current) { setResult({ key, state: { stage: 'error', display: null, error: 'The CNC worker returned no current display.' } }); return; }
      const pkg = metadata.current.package;
      setResult({ key, state: { stage: 'ready', display: { ...value.display, package: pkg, setup: pkg.setups[value.display.setupIndex] } } });
    };
    next.onerror = event => { if (id === request.current) setResult({ key, state: { stage: 'error', display: null, error: event.message || 'The CNC preview worker failed.' } }); };
    // (The document and bodies go only when the worker does not have this source yet.)
    const fresh = sent.current !== source.current.key;
    const job: CamRequest = { ...options, request: id, sourceKey: source.current.key, ...(fresh ? { source: { doc, bodies } } : {}) };
    try { next.postMessage(job); sent.current = source.current.key; }
    catch (error) { setResult({ key, state: { stage: 'error', display: null, error: error instanceof Error ? error.message : String(error) } }); }
    return () => { if (request.current === id) request.current++; };
  }, [active, key, doc, bodies]);
  const current = active && result?.key === key ? result.state : PENDING;
  return {
    ...current,
    package: active && metadata.current?.scope === scope ? metadata.current.package : undefined,
    count: active && range.current?.scope === rangeScope ? range.current.count : undefined,
  };
}
