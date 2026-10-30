// Independent GLB writer for fixed test inputs. It does not use the GPU importer or the CAD exporter.
const encoder = new TextEncoder();
export const JSON_CHUNK = 0x4e4f534a;
export const BIN_CHUNK = 0x004e4942;

export function bytesChunk(type, data, pad = 0) {
  const padded = Math.ceil(data.length / 4) * 4;
  const bytes = new Uint8Array(8 + padded), view = new DataView(bytes.buffer);
  view.setUint32(0, padded, true); view.setUint32(4, type, true);
  bytes.fill(pad, 8); bytes.set(data, 8);
  return bytes;
}

export function container(chunks) {
  const bytes = new Uint8Array(12 + chunks.reduce((n, chunk) => n + chunk.length, 0));
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.length, true);
  let offset = 12;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export const jsonChunk = json => bytesChunk(JSON_CHUNK, encoder.encode(JSON.stringify(json)), 0x20);
export const binChunk = bytes => bytesChunk(BIN_CHUNK, bytes);
export const glb = (json, bin) => container(bin === undefined ? [jsonChunk(json)] : [jsonChunk(json), binChunk(bin)]);

export function triangleFixture({ vertexColors = false } = {}) {
  const positions = [0,0,0, 1,0,0, 0,1,0], normals = [0,0,1, 0,0,1, 0,0,1];
  const colorOffset = 80, binLength = vertexColors ? 116 : 78;
  const bin = new Uint8Array(binLength), data = new DataView(bin.buffer);
  positions.forEach((value, i) => data.setFloat32(i * 4, value, true));
  normals.forEach((value, i) => data.setFloat32(36 + i * 4, value, true));
  [0,1,2].forEach((value, i) => data.setUint16(72 + i * 2, value, true));
  if (vertexColors) for (let i = 0; i < 9; i++) data.setFloat32(colorOffset + i * 4, 0.5, true);
  const json = {
    asset: { version: '2.0' },
    scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ translation: [2,0,0], children: [1] }, { mesh: 0, translation: [0,3,0], scale: [2,1,1] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0, mode: 4 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.5,0.5,0.5,1] } }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 36 }, { buffer: 0, byteOffset: 72, byteLength: 6 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0,0,0], max: [1,1,0] },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
  };
  if (vertexColors) {
    json.bufferViews.push({ buffer: 0, byteOffset: colorOffset, byteLength: 36 });
    json.accessors.push({ bufferView: 3, componentType: 5126, count: 3, type: 'VEC3' });
    json.meshes[0].primitives[0].attributes.COLOR_0 = 3;
  }
  return { json, bin, positions, normals };
}
