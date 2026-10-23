import { useEffect, useMemo } from 'react';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { placementOf, type PartInstance, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { previewMatrix, type InstanceDrag } from '@barocss/cad-model/assembly/drag';
import { multiply } from '@barocss/gpu/viewer';
import { boundsUnder, instancePoses, poseMatrix } from '../viewport/instancePose';
import { sectionedInstances, type Section } from '../viewport/sectionView';
import type { SketchState } from '@barocss/cad-model/sketch/types';

/**
 * The placed parts as the viewport shows them (R1c (3a), moved out of App as it was): each with its placement (copies of
 * one tessellation share a geometry, G10), posed by the joints' forward kinematics and exploded (G1: a matrix per
 * instance on its meshes), a live drag included under a CPU section, and sectioned.
 */
export function useScenePoses(doc: StudioDoc, instanceBodies: ReadonlyMap<string, { key: string; sourceKey: string; inst: PartInstance; bodies: BodyResult[] }>, bodies: BodyResult[],
  jointFk: Parameters<typeof instancePoses>[2], explode: number, section: Section | null, sketch: SketchState | null, gpuSection: boolean,
  instDrag: { id: string; drag: InstanceDrag; settling: boolean; key: string } | null) {
  const instancesPlaced = useMemo(() => (doc.instances ?? []).filter(i => !i.hidden && instanceBodies.has(i.id)).map(i => { const b = instanceBodies.get(i.id)!, p = placementOf(b.inst); return { id: i.id, bodies: b.bodies, placement: poseMatrix({ R: Float64Array.from(p.m), t: Float64Array.from(p.t) }, undefined) }; }), [doc.instances, instanceBodies]);
  // (G1: posed and exploded by a matrix per instance on its meshes, not by moved copies of them: the meshes are made once.)
  const instancePoseMap = useMemo(() => instancePoses(bodies, instancesPlaced, jointFk, explode), [instancesPlaced, explode, bodies, jointFk]);
  const cpuInstanceSection = !!section && !sketch && !gpuSection;
  // A CPU section cuts the complete displayed placement, including a live drag, in world space.
  // The clipped copy must not receive that drag a second time after its cap has been made.
  const instanceSectionPoses = useMemo(() => {
    if (!cpuInstanceSection || !instDrag) return instancePoseMap;
    const poses = new Map(instancePoseMap), drag = previewMatrix(instDrag.drag), pose = poses.get(instDrag.id);
    poses.set(instDrag.id, pose ? multiply(drag, pose) : drag);
    return poses;
  }, [cpuInstanceSection, instDrag, instancePoseMap]);
  // (The flow's view of what is shown, RM2: each instance's bounds as placed, posed or exploded.)
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __studioInstanceBounds: () => unknown }).__studioInstanceBounds = () => instancesPlaced.map(i => { const b = i.bodies[0]?.mesh, M = instancePoseMap.get(i.id), box = b && M ? boundsUnder(b.positions, M) : b?.bounds; return { id: i.id, min: box?.min, max: box?.max }; }); }, [instancesPlaced, instancePoseMap]);
  // The section view cuts the placed parts too: on WebGPU by the clip plane where their matrices put them (G2), on WebGL2
  // as moved copies clipped and capped.
  const instancesShown = useMemo(() => !section || sketch ? instancesPlaced : sectionedInstances(instancesPlaced, instanceSectionPoses, section, gpuSection), [instancesPlaced, instanceSectionPoses, section, sketch, gpuSection]);
  // (The CPU's clipped copies are already moved; otherwise the meshes take the matrices.)
  const instanceTransforms = cpuInstanceSection ? undefined : instancePoseMap;
  return { instancesPlaced, instancePoseMap, cpuInstanceSection, instanceSectionPoses, instancesShown, instanceTransforms };
}
