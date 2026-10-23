import { forwardRef, useEffect, useMemo, type ComponentPropsWithoutRef } from 'react';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { JointTree } from '@barocss/cad-model/robot/joints';
import { Viewport, type ViewportHandle } from './Viewport';
import { boundsUnder, instancePoses } from './instancePose';
import { poseKinematics } from '../state/useJoints';
import { useStoreValue, type ValueStore } from '../state/valueStore';
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

/**
 * The viewport with the placed parts posed and exploded (R1c (3b)): subscribed to the pose and the explode factor, so a
 * joint played or an explode dragged renders this, not the App. The matrices as useScenePoses makes them.
 */
export const SceneViewport = forwardRef<ViewportHandle, Omit<ComponentPropsWithoutRef<typeof Viewport>, 'instanceTransforms'> & { poses: ScenePoseInputs }>(function SceneViewport({ poses, ...props }, ref) {
  countRender('SceneViewport');
  const values = useStoreValue(poses.poseStore), explode = useStoreValue(poses.explodeStore);
  const fk = useMemo(() => poseKinematics(poses.jointTree, values), [poses.jointTree, values]);
  const poseMap = useMemo(() => instancePoses(poses.bodies, poses.instancesPlaced, fk, explode), [poses.bodies, poses.instancesPlaced, fk, explode]);
  const { instancesPlaced } = poses;
  // (The flow's view of what is shown, RM2: each instance's bounds as placed, posed or exploded.)
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __studioInstanceBounds: () => unknown }).__studioInstanceBounds = () => instancesPlaced.map(i => { const b = i.bodies[0]?.mesh, M = poseMap.get(i.id), box = b && M ? boundsUnder(b.positions, M) : b?.bounds; return { id: i.id, min: box?.min, max: box?.max }; }); }, [instancesPlaced, poseMap]);
  return <Viewport ref={ref} {...props} instanceTransforms={poses.cpuInstanceSection ? undefined : poseMap} />;
});
