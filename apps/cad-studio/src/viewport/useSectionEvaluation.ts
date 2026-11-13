import { useEffect, useMemo, useRef } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { lookOf } from '@barocss/cad-model/app/bodies';
import { nextSerial } from '@barocss/cad-model/engine/ids';
import type { EngineClient } from '../engine/client';
import type { Lanes } from '../engine/lanes';
import type { useSectionState } from './useSectionState';
import type { ViewportHandle } from './Viewport';
import { exactBodies, sectionSplits, sectionedBodies, type Section } from './sectionView';
export function useSectionEvaluation({ section, sectionDragFrom, sectionDebug, sectionExact, setSectionExact, doc, evaluated, bodies, viewport, engine, revision, lanes }: {
  section: Section | null; sectionDragFrom: Section | null;
  sectionDebug: ReturnType<typeof useSectionState>['sectionDebug'];
  sectionExact: ReturnType<typeof useSectionState>['sectionExact']; setSectionExact: ReturnType<typeof useSectionState>['setSectionExact'];
  doc: StudioDoc; evaluated: StudioDoc; bodies: BodyResult[]; viewport: { current: ViewportHandle | null }; engine: EngineClient; revision: { current: number }; lanes: Lanes;
}) {
  // Read visibility on the source keys before Section generates new body keys.
  const visibleBodies = useMemo(() => {
    const visible = bodies.filter(body => !lookOf(doc, body).hidden);
    return visible.length === bodies.length ? bodies : visible;
  }, [bodies, doc]);
  const sectionRun = useRef<{ busy: boolean; next: (() => Promise<void>) | null }>({ busy: false, next: null });
  // The section: the part with each body that crosses the plane split there (the rest kept or left out whole).
  useEffect(() => {
    if (!section) { sectionRun.current.next = null; setSectionExact(null); return; }
    if (sectionDragFrom) { sectionRun.current.next = null; return; }
    const key = JSON.stringify(section);
    // (G19: each body split by each plane that crosses what is left of it, the kept pieces' keys.)
    const { doc, kept, from } = sectionSplits(evaluated, visibleBodies, section);
    // Latest wins: while one section is worked out, only the newest plane waits behind it. (R4b: on the section's O9 lane —
    // a reply overtaken by a newer plane, or by the effect's cleanup, comes back stale.)
    const run = sectionRun.current;
    run.next = async () => { const at = revision.current++, reply = await lanes.run('section', { revision: at, source: key }, () => engine.section(doc, at)), r = reply.stale ? null : reply.result; if (r?.ok) { const x = exactBodies(r.bodies, kept, from); setSectionExact({ key, source: evaluated, sourceBodies: visibleBodies, bodies: x.bodies, from: x.from }); } };
    if (!run.busy) void (async () => { run.busy = true; try { while (run.next) { const j = run.next; run.next = null; await j(); } } finally { run.busy = false; } })();
    return () => lanes.cancel('section');
  }, [section, visibleBodies, evaluated, engine, sectionDragFrom]);
  // At once (while the plane is dragged, until the exact section arrives): on WebGPU the bodies whole, cut and capped by
  // the viewer's clip plane (G2); on WebGL2 the meshes clipped and capped on the CPU.
  const gpuSection = viewport.current?.backend === 'webgpu' && !sectionDebug.cpu;
  const sectionClipped = useMemo(() => {
    if (!section) return null;
    // (The section's first split is the next feature: its cut faces are named after the next id, engine/ids.ts.)
    return sectionedBodies(visibleBodies, section, gpuSection, `n${nextSerial(evaluated)}.cut`);
  }, [section, visibleBodies, evaluated, gpuSection]);
  const sectionExactShown = !!section && !sectionDragFrom && sectionExact?.key === JSON.stringify(section) && sectionExact.source === evaluated && sectionExact.sourceBodies === visibleBodies && !sectionDebug.hold;
  const sectionBodies = section ? (sectionExactShown ? sectionExact!.bodies : sectionClipped) : null;

  return { gpuSection, sectionExactShown, sectionBodies };
}
