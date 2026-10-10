import { tessellateSurface } from '@barocss/cad';
import type { Surface } from '@barocss/cad';
import { prepareMesh, prepareQualifiedFaceScene } from '@barocss/gpu';
import type { QualifiedFaceSceneV0 } from '@barocss/gpu';

type Vec3 = [number, number, number];

/** Sampled filled display bounds only; original control hulls and unshown Curves are excluded. */
export function qualifiedFaceDisplayBounds(input: QualifiedFaceSceneV0): { min: Vec3; max: Vec3 } {
  const scene = prepareQualifiedFaceScene(input);
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const asset of scene.assets) {
    const surface = asset.face.geometry.objects.find((object): object is Surface =>
      object.id === asset.face.topology.face.surfaceId && 'degreeU' in object);
    if (!surface) throw new RangeError('Viewer qualified Face fit: current original Face Surface is missing');
    const tessellation = tessellateSurface(surface, { countU: scene.countU, countV: scene.countV, revision: 0 });
    const buffers = prepareMesh(tessellation.packet, { camera: scene.camera, mmToSceneUnit: scene.mmToSceneUnit,
      translate: scene.translate, background: scene.background, color: asset.color });
    for (let offset = 0; offset < buffers.positions.length; offset += 3) {
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], buffers.positions[offset + axis]);
        max[axis] = Math.max(max[axis], buffers.positions[offset + axis]);
      }
    }
  }
  return { min, max };
}
