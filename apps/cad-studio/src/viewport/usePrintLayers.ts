import { useEffect, useMemo, useRef, useState } from 'react';
import { PRINT_LAYERS_VERSION } from '@barocss/cad-model/print/layers';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';
import type { PrintDisplay } from './printDisplay';
import type { PrintReply, PrintRequest } from './print.worker';

export interface PrintOptions { layer: number; layerMM?: number; direction?: [number, number, number]; limitDeg?: number; supports: boolean; printed: boolean }
export interface PrintState { stage: 'pending' | 'ready' | 'error'; display: PrintDisplay | null; count?: number; error?: string }
/** One Model summary per source/options, lazy layer requests, and no old-source frame during source/pose changes. */
export function usePrintLayers(active: boolean, meshes: DisplayMesh[], options: PrintOptions): PrintState {
  const worker = useRef<Worker | null>(null), request = useRef(0), source = useRef({ meshes, key: 1 }), support = useRef<{ key: number; mesh: DisplayMesh; summary: PrintDisplay['summary'] } | null>(null);
  if (source.current.meshes !== meshes) source.current = { meshes, key: source.current.key + 1 };
  const directionKey = JSON.stringify(options.direction ?? null);
  const scope = useMemo(() => ({}), [active, meshes, directionKey, options.layerMM, options.limitDeg]);
  const range = useRef<{ scope: object; count: number } | null>(null);
  const key = useMemo(() => ({}), [active, meshes, directionKey, options.layer, options.layerMM, options.limitDeg]);
  const [result, setResult] = useState<{ key: object; state: PrintState } | null>(null);
  useEffect(() => {
    if (!active) return;
    const next = new Worker(new URL('./print.worker.ts', import.meta.url), { type: 'module' }); worker.current = next; support.current = null;
    return () => { request.current++; next.terminate(); if (worker.current === next) worker.current = null; };
  }, [active]);
  useEffect(() => {
    const next = worker.current; if (!active || !next) return;
    const id = ++request.current;
    setResult({ key, state: { stage: 'pending', display: null } });
    next.onmessage = (event: MessageEvent<PrintReply>) => {
      const value = event.data; if (id !== request.current || value.request !== id) return;
      if ('error' in value) { setResult({ key, state: { stage: 'error', display: null, error: value.error } }); return; }
      if (value.display.summary.version !== PRINT_LAYERS_VERSION) { setResult({ key, state: { stage: 'error', display: null, error: 'Print preview version is not supported.' } }); return; }
      if (support.current?.key !== value.display.summaryKey) support.current = { key: value.display.summaryKey, mesh: value.display.supportMesh, summary: value.display.summary };
      range.current = { scope, count: value.display.summary.count };
      setResult({ key, state: { stage: 'ready', display: { ...value.display, supportMesh: support.current.mesh, summary: support.current.summary } } });
    };
    next.onerror = event => { if (id === request.current) setResult({ key, state: { stage: 'error', display: null, error: event.message || 'Print preview worker failed.' } }); };
    const job: PrintRequest = { request: id, sourceKey: source.current.key, meshes, layer: options.layer, layerMM: options.layerMM, direction: options.direction, limitDeg: options.limitDeg };
    try { next.postMessage(job); }
    catch (error) { setResult({ key, state: { stage: 'error', display: null, error: error instanceof Error ? error.message : String(error) } }); }
    return () => { if (request.current === id) request.current++; };
  }, [active, key, meshes]);
  const state = active && result?.key === key ? result.state : { stage: 'pending' as const, display: null };
  // Layer requests keep their known range without exposing old geometry or another source's bounds.
  const current = { ...state, count: active && range.current?.scope === scope ? range.current.count : undefined };
  return useMemo(() => current.display ? { ...current, display: { ...current.display, supports: options.supports, printed: options.printed } } : current, [current, options.supports, options.printed]);
}
