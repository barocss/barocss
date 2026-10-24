import { useEffect, useState } from 'react';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { computeExperimental as C } from '@barocss/gpu';
import { accessMapOf, accessStep, type ScalarMap } from './scalarMaps';

// G25b (G-R18): the access map on the GPU when the viewport draws with WebGPU — CNC4's samples, their six rays a sample
// in a compute pass, folded back per triangle — labelled a GPU estimate; the CPU's accessOf stays the panels' numbers.
// `cpu` means no device (WebGL2, or not ready): the caller keeps its CPU map.

export interface GpuMaps { state: 'cpu' | 'pending' | 'ready' | 'error'; maps: ScalarMap[] | null; error?: string }
const CPU: GpuMaps = { state: 'cpu', maps: null };

export function useGpuAccessMaps(active: boolean, bodies: readonly BodyResult[], device: () => object | null): GpuMaps {
  const [result, setResult] = useState<{ bodies: readonly BodyResult[]; maps: GpuMaps } | null>(null);
  useEffect(() => {
    // (R1d: cleared only when there is a result: off, the bodies change with each preview, and a set to the same null
    // rendered the App again each time.)
    if (!active) { if (result !== null) setResult(null); return; }
    const d = device();
    if (!d) { setResult({ bodies, maps: CPU }); return; }
    let live = true;
    setResult({ bodies, maps: { state: 'pending', maps: null } });
    const step = accessStep(bodies), maps: ScalarMap[] = [];
    (async () => {
      for (const b of bodies) {
        const s = C.accessSampleSet(b.mesh.positions, b.mesh.indices, step);
        const masks = await C.gpuAccessMasks(d as C.ComputeDevice, C.packBvh(b.mesh), s);
        if (!live) return;
        maps.push(accessMapOf(b.key, C.accessByTriangle(s, masks).unreachedShare, true));
      }
      if (live) setResult({ bodies, maps: { state: 'ready', maps } });
    })().catch(e => { if (live) setResult({ bodies, maps: { state: 'error', maps: null, error: e instanceof Error ? e.message : String(e) } }); });
    return () => { live = false; };
  }, [active, bodies, device]);
  // (A result for other bodies is never shown: pending until this one arrives.)
  if (!active) return CPU;
  return result && result.bodies === bodies ? result.maps : { state: 'pending', maps: null };
}
