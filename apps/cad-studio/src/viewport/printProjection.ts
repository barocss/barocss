import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { DisplayEdge, DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';
import { posedBody } from '@barocss/cad-model/robot/preview';
import { motionOf } from './instancePose';
import type { PrintDisplay } from './printDisplay';
import { clipMeshSection } from './sectionView';

/** Inverse of the Model's rigid column-major model-to-bed transform; used only for source-space callbacks. */
export function printPointToModel(point: Vec3, modelToBed: ArrayLike<number>): Vec3 {
  const x = point[0] - modelToBed[12], y = point[1] - modelToBed[13], z = point[2] - modelToBed[14];
  return [modelToBed[0] * x + modelToBed[1] * y + modelToBed[2] * z, modelToBed[4] * x + modelToBed[5] * y + modelToBed[6] * z, modelToBed[8] * x + modelToBed[9] * y + modelToBed[10] * z];
}

/** Full bed-frame scene for camera fitting, independent of the displayed printed layer. */
export function printSceneBounds(bodies: readonly BodyResult[], modelToBed: ArrayLike<number>, hiddenBodies?: ReadonlySet<number>): { min: Vec3; max: Vec3 } | null {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  let any = false;
  bodies.forEach((body, index) => {
    if (hiddenBodies?.has(index) || !body.mesh.indices.length) return;
    const p = body.mesh.positions;
    for (const vertex of body.mesh.indices) {
      const x = p[vertex * 3], y = p[vertex * 3 + 1], z = p[vertex * 3 + 2];
      for (let k = 0; k < 3; k++) {
        const value = modelToBed[k] * x + modelToBed[4 + k] * y + modelToBed[8 + k] * z + modelToBed[12 + k];
        min[k] = Math.min(min[k], value); max[k] = Math.max(max[k], value);
      }
      any = true;
    }
  });
  return any ? { min, max } : null;
}

const native = (index: number) => Number.isInteger(index) && index >= 0;
const faceKey = (face: DisplayMesh['faces'][number]) => JSON.stringify([face.id, face.name]);
function faceSources(source: DisplayMesh, shown: DisplayMesh): number[] {
  const byIndex = new Map<number, DisplayMesh['faces']>();
  for (const face of source.faces) byIndex.set(face.index, [...(byIndex.get(face.index) ?? []), face]);
  const result = Array.from({ length: shown.faces.reduce((n, f) => Math.max(n, f.index + 1), 0) }, () => -1);
  for (const face of shown.faces) {
    const originals = byIndex.get(face.index);
    if (face.id !== 'section-cap' && native(face.index) && originals?.length === 1 && originals[0].id !== 'section-cap' && faceKey(originals[0]) === faceKey(face)) result[face.index] = face.index;
  }
  return result;
}
function edgeSources(source: DisplayMesh, shown: DisplayMesh, faces: readonly number[]): number[] {
  const key = (edge: DisplayEdge, mapped: (face: number) => number) => {
    const adjacent = edge.faces.map(mapped);
    return edge.names.length && adjacent.every(native) ? JSON.stringify([[...edge.names].sort(), adjacent.sort((a, b) => a - b)]) : null;
  };
  const sourceFaces = faceSources(source, source), byIndex = new Map<number, DisplayEdge[]>();
  for (const edge of source.edges) byIndex.set(edge.index, [...(byIndex.get(edge.index) ?? []), edge]);
  const result = Array.from({ length: shown.edges.reduce((n, e) => Math.max(n, e.index + 1), 0) }, () => -1);
  for (const edge of shown.edges) {
    const originals = byIndex.get(edge.index), shownKey = key(edge, i => faces[i] ?? -1);
    if (native(edge.index) && originals?.length === 1 && shownKey !== null && key(originals[0], i => sourceFaces[i] ?? -1) === shownKey) result[edge.index] = edge.index;
  }
  return result;
}
const emptyMesh = (): DisplayMesh => ({ positions: new Float32Array(), normals: new Float32Array(), indices: new Uint32Array(), faceOfVertex: new Float32Array(), faces: [], edgeLines: new Float32Array(), edgeOfSegment: new Float32Array(), edges: [], bounds: { min: [0, 0, 0], max: [0, 0, 0] } });

/** Bed-frame display only: preserve every source body ordinal, and give new caps no native identity. */
export function projectPrintBodies(bodies: readonly BodyResult[], display: PrintDisplay): { bodies: BodyResult[]; faceSources: readonly number[][]; edgeSources: readonly number[][] } {
  const motion = motionOf(display.summary.modelToBed), faces: number[][] = [], edges: number[][] = [];
  const shown = bodies.map(body => {
    // posedBody explicitly copies positions, normals and edge lines before Model placeBody can change them.
    const moved = posedBody(body, motion), mesh = display.printed ? clipMeshSection(moved.mesh, { mode: 'plane', planes: [{ normal: [0, 0, -1], offset: -display.topMM }] }, 'Printed top') : moved.mesh;
    if (!mesh) { faces.push([]); edges.push([]); return { ...moved, mesh: emptyMesh() }; }
    const faceMap = faceSources(body.mesh, mesh); faces.push(faceMap); edges.push(edgeSources(body.mesh, mesh, faceMap));
    return { ...moved, mesh };
  });
  return { bodies: shown, faceSources: faces, edgeSources: edges };
}
