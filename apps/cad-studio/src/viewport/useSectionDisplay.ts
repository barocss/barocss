import { useMemo, useState } from 'react';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import type { Active } from '../app/commandState';
import type { useScenePoses } from '../state/useScenePoses';
import type { useSectionState } from './useSectionState';
import type { SketchState } from './Viewport';
import { hatchSpacing, sectionPlanes, sectionHatch, type Section } from './sectionView';
import { sectionHandles } from '../ui/SectionBar';
export function useSectionDisplay({ bodies, instancesPlaced, section, sketch, gpuSection, shownBodies, sectionBodies, sectionExactShown, sectionLive, active, dragSection }: {
  bodies: BodyResult[]; instancesPlaced: ReturnType<typeof useScenePoses>['instancesPlaced']; section: Section | null;
  sketch: SketchState | null; gpuSection: boolean; shownBodies: BodyResult[]; sectionBodies: BodyResult[] | null;
  sectionExactShown: boolean; sectionLive: ReturnType<typeof useSectionState>['sectionLive']; active: Active | null;
  dragSection: ReturnType<typeof useSectionState>['dragSection'];
}) {
  // The part's and its placed parts' box: the section's handles and planes in it (G19), its hatch's spacing (G19.3).
  const sectionBox = useMemo(() => {
    const all = [...bodies, ...instancesPlaced.flatMap(i => i.bodies)];
    if (!all.length) return { min: [0, 0, 0] as Vec3, max: [0, 0, 0] as Vec3 };
    return { min: [0, 1, 2].map(i => Math.min(...all.map(b => b.mesh.bounds.min[i]))) as Vec3, max: [0, 1, 2].map(i => Math.max(...all.map(b => b.mesh.bounds.max[i]))) as Vec3 };
  }, [bodies, instancesPlaced]);
  // The hatch on the cut (G19.3; on by default): on the GPU in the caps' shader while the planes move; as lines on
  // WebGL2's clipped caps and on the exact section's cut faces (either renderer).
  const [sectionHatchOn, setSectionHatchOn] = useState(true);
  const hatchStep = useMemo(() => hatchSpacing(sectionBox), [sectionBox]);
  const sectionClip = useMemo(() => section && !sketch && gpuSection ? { planes: sectionPlanes(section), bodies: shownBodies === sectionBodies && !sectionExactShown, hatch: sectionHatchOn ? hatchStep : null, cutout: section.mode === 'cutout' } : null, [section, sketch, gpuSection, shownBodies, sectionBodies, sectionExactShown, sectionHatchOn, hatchStep]);
  // (R1c (3c): a dragged plane's clip and handles, made as the App's are — SceneViewport draws them in each frame of the
  // drag on WebGPU, the App not rendering. On WebGL2 the App does, so there is none.)
  const sectionLiveView = gpuSection && !sketch ? {
    store: sectionLive,
    clip: (s: Section) => ({ planes: sectionPlanes(s), bodies: shownBodies === sectionBodies && !sectionExactShown, hatch: sectionHatchOn ? hatchStep : null, cutout: s.mode === 'cutout' }),
    handles: (s: Section) => !active && bodies.length ? sectionHandles(s, sectionBox, dragSection) : [],
  } : null;
  const sectionHatchLines = useMemo(() => section && !sketch && sectionHatchOn && shownBodies === sectionBodies && (!gpuSection || sectionExactShown) ? sectionHatch(shownBodies, sectionPlanes(section), hatchStep) : null,
    [section, sketch, sectionHatchOn, shownBodies, sectionBodies, gpuSection, sectionExactShown, hatchStep]);

  return { sectionBox, sectionHatchOn, setSectionHatchOn, hatchStep, sectionClip, sectionLiveView, sectionHatchLines };
}
