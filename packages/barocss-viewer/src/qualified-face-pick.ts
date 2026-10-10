import { tessellateSurface } from '@barocss/cad';
import type { Surface } from '@barocss/cad';
import { prepareMesh, prepareQualifiedFaceScene } from '@barocss/gpu';
import type { QualifiedFaceSceneV0 } from '@barocss/gpu';
import { prepareScreenTriangleRay } from './screen-triangle.js';

type Vec3 = [number, number, number];
type Vec2 = [number, number];
export interface ViewerQualifiedFacePick {
  ref: {
    sourceId: string;
    expectedSource: string;
    faceId: string;
    modelId: string;
    surfaceId: string;
  };
  triangleIndex: number;
  displayPositionScene: Vec3;
  depthScene: number;
  approximate: true;
  ambiguous: boolean;
}
interface FaceTriangleCandidate {
  pick: ViewerQualifiedFacePick;
  barycentric: Vec3;
  triangleParameters: [Vec2, Vec2, Vec2];
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new RangeError('Viewer qualified Face pick: ' + message);
}
function point(input: unknown): { xCss: number; yCss: number } {
  check(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype,
    'point must be plain own data');
  const keys = Reflect.ownKeys(input);
  check(keys.length === 2 && keys.every(key => key === 'xCss' || key === 'yCss'), 'point requires exact xCss/yCss fields');
  const values: number[] = [];
  for (const key of ['xCss', 'yCss']) {
    const field = Object.getOwnPropertyDescriptor(input, key);
    check(field && field.enumerable && 'value' in field && typeof field.value === 'number'
      && Number.isFinite(field.value) && field.value >= 0 && field.value <= 4096, key + ' must be own finite data0..4096');
    values.push(field.value);
  }
  try { structuredClone(input); }
  catch (cause) { throw new RangeError('Viewer qualified Face pick: point cannot be copied', { cause }); }
  return { xCss: values[0], yCss: values[1] };
}

/** Keep original parameter pairs attached to the same accepted display triangle. */
export function pickViewerQualifiedFaceCandidate(sceneInput: QualifiedFaceSceneV0, input: unknown,
  backingWidth: number, backingHeight: number, cssWidth: number,
  cssHeight: number): (FaceTriangleCandidate & { scene: QualifiedFaceSceneV0 }) | null {
  const query = point(input);
  check(Number.isFinite(cssWidth) && Number.isFinite(cssHeight) && cssWidth > 0 && cssHeight > 0
    && cssWidth <= 4096 && cssHeight <= 4096, 'CSS bounding-box dimensions must be finite positive values≤4096');
  check(query.xCss <= cssWidth && query.yCss <= cssHeight, 'point is outside the canvas CSS bounding box');
  check(Number.isFinite(backingWidth) && Number.isFinite(backingHeight) && backingWidth > 0 && backingHeight > 0,
    'backing dimensions must be finite and positive');
  const scene = prepareQualifiedFaceScene(sceneInput);
  const ray = prepareScreenTriangleRay(query, scene.camera, backingWidth, backingHeight, cssWidth, cssHeight,
    'Viewer qualified Face pick: ');
  const candidates: FaceTriangleCandidate[] = [];
  for (const asset of scene.assets) {
    const surface = asset.face.geometry.objects.find((object): object is Surface =>
      object.id === asset.face.topology.face.surfaceId && 'degreeU' in object);
    check(surface, 'current original Face Surface is missing');
    const tessellation = tessellateSurface(surface, { countU: scene.countU, countV: scene.countV, revision: 0 });
    const buffers = prepareMesh(tessellation.packet, { camera: scene.camera, mmToSceneUnit: scene.mmToSceneUnit,
      translate: scene.translate, background: scene.background, color: asset.color });
    const ref = { sourceId: asset.sourceId, expectedSource: asset.source, faceId: asset.face.topology.face.id,
      modelId: asset.face.geometry.name, surfaceId: asset.face.topology.face.surfaceId };
    let best: FaceTriangleCandidate | null = null;
    const vertex = (index: number): Vec3 => [buffers.positions[index * 3], buffers.positions[index * 3 + 1], buffers.positions[index * 3 + 2]];
    const parameters = (index: number): Vec2 =>
      [tessellation.packet.parameters[index * 2], tessellation.packet.parameters[index * 2 + 1]];
    for (let offset = 0; offset < buffers.indices.length; offset += 3) {
      const hit = ray.intersectionDetail(vertex(buffers.indices[offset]),
        vertex(buffers.indices[offset + 1]), vertex(buffers.indices[offset + 2]));
      if (hit === null) continue;
      const { displayPositionScene, depthScene } = ray.observation(hit.fraction);
      if (depthScene <= 0) continue;
      const triangleIndex = offset / 3;
      if (!best || depthScene < best.pick.depthScene || depthScene === best.pick.depthScene && triangleIndex < best.pick.triangleIndex)
        best = { pick: { ref, triangleIndex, displayPositionScene, depthScene, approximate: true, ambiguous: false },
          barycentric: hit.barycentric, triangleParameters: [parameters(buffers.indices[offset]),
            parameters(buffers.indices[offset + 1]), parameters(buffers.indices[offset + 2])] };
    }
    if (best) candidates.push(best);
  }
  if (!candidates.length) return null;
  const minimum = Math.min(...candidates.map(candidate => candidate.pick.depthScene));
  const eligible = candidates.filter(candidate => ray.finite(candidate.pick.depthScene - minimum) <= 1e-6);
  eligible.sort((a, b) => a.pick.ref.sourceId < b.pick.ref.sourceId ? -1 : a.pick.ref.sourceId > b.pick.ref.sourceId ? 1 : 0);
  return { ...eligible[0], pick: { ...eligible[0].pick, ambiguous: eligible.length > 1 }, scene };
}

/** Current derived F32 filled triangles only; original parameters and raster depth are not queried. */
export function pickViewerQualifiedFace(sceneInput: QualifiedFaceSceneV0, input: unknown,
  backingWidth: number, backingHeight: number, cssWidth: number,
  cssHeight: number): ViewerQualifiedFacePick | null {
  const candidate = pickViewerQualifiedFaceCandidate(sceneInput, input,
    backingWidth, backingHeight, cssWidth, cssHeight);
  return candidate ? structuredClone(candidate.pick) : null;
}
