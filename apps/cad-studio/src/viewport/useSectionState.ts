import { useCallback, useMemo, useRef, useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { createValueStore, useStoreValue } from '../state/valueStore';
import type { Section } from './sectionView';
export function useSectionState(viewBackend: 'webgpu' | 'webgl2' | null) {
  // (G19: one plane, a box or two or three planes — the kept region their intersection; the next face click sets plane `sectionFacePick`.)
  // (Dev/test: the exact section held back, and the CPU's path forced, to compare the two clips through one viewer.)
  const [sectionDebug, setSectionDebug] = useState({ hold: false, cpu: false });
  // The section as committed, and the plane being dragged (R1c (3c)): a drag sets `sectionLive`, outside React state.
  // On WebGPU only SceneViewport follows it in each frame, the App once as the drag starts. On WebGL2 the App follows it,
  // as before: its CPU copies are cut again in each frame. The release commits it.
  const [committedSection, setCommittedSection] = useState<Section | null>(null);
  const sectionLive = useMemo(() => createValueStore<Section | null>(null), []);
  const cpuSectionPath = viewBackend !== 'webgpu' || sectionDebug.cpu;
  const liveSection = useStoreValue(sectionLive, !!committedSection && cpuSectionPath);
  // (On WebGPU the App takes the plane as the drag started — its exact section waits for the release; R1c (3c).)
  const [sectionDragFrom, setSectionDragFrom] = useState<Section | null>(null);
  const section = cpuSectionPath ? liveSection ?? committedSection : sectionDragFrom ?? committedSection;
  const committedSectionRef = useRef(committedSection); committedSectionRef.current = committedSection;
  /** A section set (the toggle, the bar, a face, the hooks): committed, a drag's plane with it. */
  const setSection = useCallback((next: Section | null | ((s: Section | null) => Section | null)) => {
    const base = sectionLive.get();
    setCommittedSection(prev => typeof next === 'function' ? next(base ?? prev) : next);
    sectionLive.set(null); setSectionDragFrom(null);
  }, [sectionLive]);
  /** A section handle dragged: its plane into the store at each step, the App told once as it starts; the release commits. */
  const dragSection = useCallback((f: (s: Section | null) => Section | null, done: boolean) => {
    const was = sectionLive.get(), next = f(was ?? committedSectionRef.current);
    if (done) { setSection(() => next); return; }
    if (!was) setSectionDragFrom(next);
    sectionLive.set(next);
  }, [sectionLive, setSection]);
  const [sectionFacePick, setSectionFacePick] = useState<number | null>(null);
  const sectionFacePickRef = useRef(sectionFacePick); sectionFacePickRef.current = sectionFacePick;
  const [sectionExact, setSectionExact] = useState<{ key: string; source: StudioDoc; sourceBodies: readonly BodyResult[]; bodies: BodyResult[]; from: ReadonlyMap<string, string> } | null>(null);
  const sectionRef = useRef(section); sectionRef.current = section;

  return { sectionDragFrom, sectionDebug, setSectionDebug, sectionLive, section, setSection, dragSection, sectionFacePick, setSectionFacePick, sectionFacePickRef, sectionExact, setSectionExact, sectionRef };
}
