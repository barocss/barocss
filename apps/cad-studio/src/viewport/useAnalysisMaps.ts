import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction, type RefObject } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { isoclinePolylines } from '@barocss/cad-model/mould/parting';
import type { EngineClient } from '../engine/client';
import type { Lanes } from '../engine/lanes';
import type { SketchState, ViewportHandle } from './Viewport';
import { useGpuAccessMaps } from './useGpuMaps';
import { mapsOf, type MapKind } from './scalarMaps';
type MouldResult = Awaited<ReturnType<EngineClient['mould']>> | 'working' | null;
export function useAnalysisMaps({ doc, evaluated, shownBodies, mapKind, rendering, sketch, previewBodies, viewport, engine,
  revision, lanes, mouldResult, setMouldResult, mouldSpread, halvesShownRef, viewBackend }: {
  doc: StudioDoc; evaluated: StudioDoc; shownBodies: BodyResult[]; mapKind: MapKind | 'parting' | 'halves' | null;
  rendering: boolean; sketch: SketchState | null; previewBodies: BodyResult[] | null; viewport: RefObject<ViewportHandle | null>;
  engine: EngineClient; revision: { current: number }; lanes: Lanes; mouldResult: MouldResult;
  setMouldResult: Dispatch<SetStateAction<MouldResult>>; mouldSpread: number; halvesShownRef: RefObject<boolean>;
  viewBackend: 'webgpu' | 'webgl2' | null;
}) {
  // (G25b: on WebGPU the access map is the GPU's estimate, the CPU's when there is no device; the panels keep the CPU's numbers.)
  const mapsShown = (mapKind === 'thickness' || mapKind === 'draft' || mapKind === 'access') && !rendering && !sketch && !previewBodies;
  const computeDevice = useCallback(() => viewport.current?.computeDevice() ?? null, []);
  const gpuAccess = useGpuAccessMaps(mapsShown && mapKind === 'access', shownBodies, computeDevice);
  const cpuMaps = useMemo(() => mapsShown && !(mapKind === 'access' && gpuAccess.state !== 'cpu' && gpuAccess.state !== 'error') ? mapsOf(mapKind as MapKind, doc, shownBodies) : null, [mapsShown, mapKind, gpuAccess.state, shownBodies, doc]);
  const scalarMaps = mapKind === 'access' && gpuAccess.state === 'ready' ? gpuAccess.maps : mapKind === 'access' && gpuAccess.state === 'pending' ? null : cpuMaps;
  // (With the draft map, each body's isoclines n·d = 0 on its straddling faces, from the exact surface.)
  const isoclines = useMemo(() => mapKind === 'draft' && scalarMaps && doc.mould?.pull ? shownBodies.flatMap(b => isoclinePolylines(doc, b, doc.mould!.pull!)) : null, [mapKind, scalarMaps, doc, shownBodies]);
  // (The mould's view: asked again when the part, its pull or its sides change; none outside its two maps.)
  const mouldWanted = (mapKind === 'parting' || mapKind === 'halves') && !rendering && !sketch && !previewBodies && !!doc.mould?.pull;
  useEffect(() => {
    if (!mouldWanted) { setMouldResult(null); return; }
    setMouldResult('working');
    // (R4b: on the O9 'mould' lane — a reply for a part, pull or map since changed comes back stale.)
    const at = revision.current++;
    void lanes.run('mould', { revision: at, source: mapKind }, () => engine.mould(doc, at, mapKind === 'halves')).then(reply => { if (!reply.stale) setMouldResult(reply.result); });
    return () => lanes.cancel('mould');
  }, [mouldWanted, mapKind, evaluated, doc.mould, engine]);
  const mouldShown = useMemo(() => mouldResult && mouldResult !== 'working' && !('error' in mouldResult)
    ? { pull: mouldResult.pull, loops: mouldResult.loops, plus: mapKind === 'halves' ? mouldResult.plus : [], minus: mapKind === 'halves' ? mouldResult.minus : [], spread: mouldSpread } : null, [mouldResult, mapKind, mouldSpread]);
  halvesShownRef.current = !!mouldShown && (mouldShown.plus.length + mouldShown.minus.length) > 0;
  const mapLegend = scalarMaps?.[0] && viewBackend === 'webgpu' ? scalarMaps[0] : null;

  return { scalarMaps, isoclines, mouldShown, mapLegend };
}
