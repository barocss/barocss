import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
export function observeSectionUniformResult(result) {
  const mesh = result.line, geometry = mesh.geometry, material = mesh.material;
  const positionArray = mesh.getVerticesData(VertexBuffer.PositionKind), indexArray = mesh.getIndices();
  const row = { mesh, object: mesh, result, geometry, material, positionArray, indexArray,
    positions: Array.from(positionArray), indices: Array.from(indexArray), meshDisposals: 0, geometryDisposals: 0, materialDisposals: 0 };
  mesh.onDisposeObservable.add(() => row.meshDisposals++);
  material.onDisposeObservable.add(() => row.materialDisposals++);
  const previous = geometry.dispose;
  geometry.dispose = function (...args) { row.geometryDisposals++; return previous.apply(this, args); };
  return [row];
}
