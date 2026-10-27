import { forwardRef, useEffect, useMemo, type ComponentPropsWithoutRef } from 'react';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import type { JointTree } from '@barocss/cad-model/robot/joints';
import { Viewport, type FrameTriad, type ViewportHandle } from './Viewport';
import { boundsUnder, instancePoses } from './instancePose';
import { framePoses } from '@barocss/cad-model/robot/frames';
import { poseKinematics } from '../state/useJoints';
import { createValueStore, useStoreValue, type ValueStore } from '../state/valueStore';
import type { Section } from './sectionView';
import { countRender } from '../devRenders';

/** What the placed parts' matrices are made from, beside the pose and the explode factor (useScenePoses' inputs). */
export interface ScenePoseInputs {
  poseStore: ValueStore<Record<string, number>>;
  explodeStore: ValueStore<number>;
  jointTree: JointTree | null;
  bodies: BodyResult[];
  instancesPlaced: Parameters<typeof instancePoses>[1];
  /** The CPU's section copies are already moved: the meshes take no matrices then. */
  cpuInstanceSection: boolean;
}

/** A section plane being dragged (R1c (3c)): its store, and its clip and handles as the App makes them. */
export interface LiveSection {
  store: ValueStore<Section | null>;
  clip(s: Section): NonNullable<ComponentPropsWithoutRef<typeof Viewport>['clip']>;
  handles(s: Section): NonNullable<ComponentPropsWithoutRef<typeof Viewport>['handles']>;
}
const NO_SECTION = createValueStore<Section | null>(null);

/**
 * The viewport with the placed parts posed and exploded (R1c (3b)): subscribed to the pose and the explode factor, so a
 * joint played or an explode dragged renders this, not the App. The matrices as useScenePoses makes them. A section plane
 * dragged on WebGPU likewise: its clip and handles from the plane as it is dragged.
 */
export const SceneViewport = forwardRef<ViewportHandle, Omit<ComponentPropsWithoutRef<typeof Viewport>, 'instanceTransforms'> & { poses: ScenePoseInputs; liveSection: LiveSection | null }>(function SceneViewport({ poses, liveSection, ...props }, ref) {
  countRender('SceneViewport');
  const values = useStoreValue(poses.poseStore), explode = useStoreValue(poses.explodeStore);
  const fk = useMemo(() => poseKinematics(poses.jointTree, values), [poses.jointTree, values]);
  const poseMap = useMemo(() => instancePoses(poses.bodies, poses.instancesPlaced, fk, explode), [poses.bodies, poses.instancesPlaced, fk, explode]);
  const { instancesPlaced } = poses;
  // (G13: the tool and sensor frames where the pose puts them — FK's link motions, or the solved pose's own — made here, so
  // a joint played renders this, not the App; their axes' length a fifth of the parts' own extent.)
  const frames = useMemo((): FrameTriad[] | undefined => {
    const tree = poses.jointTree; if (!tree?.frames?.length) return undefined;
    const at = fk ? framePoses(tree, fk.motions) : null, out: FrameTriad[] = [];
    for (const f of tree.frames) { const p = at ? at.get(f.name) : f; if (p) out.push({ name: f.name, ...(f.kind ? { kind: f.kind } : {}), o: [...p.o] as Vec3, R: p.R }); }
    return out;
  }, [poses.jointTree, fk]);
  const frameSize = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    // (The parts' own bounds, not as placed, so the triads keep their size as the arm moves.)
    for (const i of instancesPlaced) for (const b of i.bodies) { const m = b.mesh.bounds; lo = Math.min(lo, m.min[0], m.min[1], m.min[2]); hi = Math.max(hi, m.max[0], m.max[1], m.max[2]); }
    return Number.isFinite(hi - lo) && hi > lo ? Math.max(5, (hi - lo) / 5) : 25;
  }, [instancesPlaced]);
  // (The flow's view of what is shown, RM2: each instance's bounds as placed, posed or exploded.)
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __studioInstanceBounds: () => unknown }).__studioInstanceBounds = () => instancesPlaced.map(i => { const b = i.bodies[0]?.mesh, M = poseMap.get(i.id), box = b && M ? boundsUnder(b.positions, M) : b?.bounds; return { id: i.id, min: box?.min, max: box?.max }; }); }, [instancesPlaced, poseMap]);
  const dragged = useStoreValue(liveSection?.store ?? NO_SECTION);
  const handles = dragged && liveSection ? liveSection.handles(dragged) : null;
  const live = dragged && liveSection ? { clip: liveSection.clip(dragged), ...(handles?.length ? { handles } : {}) } : null;
  return <Viewport ref={ref} {...props} {...live} frames={frames} frameSize={frameSize} instanceTransforms={poses.cpuInstanceSection ? undefined : poseMap} />;
});
