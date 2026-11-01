// Independent synthetic GLB writer for the public example and its focused tests.
// Four quadrants expose UV orientation, colour channels, and midtone conversion.
export async function textureSample(mimeType = 'image/png', { transparent = false, corruptImage = false } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('A 2D canvas is required to make the sample.');
  for (const [x,y,color] of [[0,0,'#f03020'],[16,0,'#18d048'],[0,16,'#2050f0'],[16,16,'#808080']]) {
    context.fillStyle = color; context.fillRect(x,y,16,16);
  }
  if (transparent) context.clearRect(0,0,1,1);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, 1));
  if (!blob || blob.type !== mimeType) throw new Error(`Cannot encode ${mimeType}.`);
  const encodedImage = new Uint8Array(await blob.arrayBuffer());
  // Keep a complete PNG signature and IHDR, but remove image data and IEND.
  const image = corruptImage && mimeType === 'image/png' ? encodedImage.slice(0,33) : encodedImage;
  const positions = [-2,-2,0, 2,-2,0, 2,2,0, -2,2,0], normals = [0,0,1, 0,0,1, 0,0,1, 0,0,1];
  const uv = [0,1, 1,1, 1,0, 0,0], indices = [0,1,2,0,2,3];
  const bin = new Uint8Array(140 + image.length), data = new DataView(bin.buffer);
  positions.forEach((v,i) => data.setFloat32(i*4,v,true));
  normals.forEach((v,i) => data.setFloat32(48+i*4,v,true));
  indices.forEach((v,i) => data.setUint16(96+i*2,v,true));
  uv.forEach((v,i) => data.setFloat32(108+i*4,v,true)); bin.set(image,140);
  const json = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 3 }, indices: 2, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [1,1,1,1], metallicFactor: 0, roughnessFactor: 1, baseColorTexture: { index: 0 } }, doubleSided: true }],
    textures: [{ source: 0, sampler: 0 }], images: [{ bufferView: 4, mimeType }],
    samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }], buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 48 }, { buffer: 0, byteOffset: 48, byteLength: 48 },
      { buffer: 0, byteOffset: 96, byteLength: 12 }, { buffer: 0, byteOffset: 108, byteLength: 32 }, { buffer: 0, byteOffset: 140, byteLength: image.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [-2,-2,0], max: [2,2,0] },
      { bufferView: 1, componentType: 5126, count: 4, type: 'VEC3' }, { bufferView: 2, componentType: 5123, count: 6, type: 'SCALAR' },
      { bufferView: 3, componentType: 5126, count: 4, type: 'VEC2' }] };
  return { json, bin, bytes: packTexturedGlb(json, bin) };
}

export function packTexturedGlb(json, bin) {
  const encoded = new TextEncoder().encode(JSON.stringify(json)), jsonLength = Math.ceil(encoded.length / 4) * 4, binLength = Math.ceil(bin.length / 4) * 4;
  const bytes = new Uint8Array(12 + 8 + jsonLength + 8 + binLength), view = new DataView(bytes.buffer);
  view.setUint32(0,0x46546c67,true); view.setUint32(4,2,true); view.setUint32(8,bytes.length,true);
  view.setUint32(12,jsonLength,true); view.setUint32(16,0x4e4f534a,true); bytes.fill(0x20,20,20+jsonLength); bytes.set(encoded,20);
  const offset = 20+jsonLength; view.setUint32(offset,binLength,true); view.setUint32(offset+4,0x004e4942,true); bytes.set(bin,offset+8);
  return bytes;
}
