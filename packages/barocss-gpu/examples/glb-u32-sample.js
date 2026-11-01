// Synthetic GLB writer: its only triangle references vertices 65535 and 65536.
export function u32Sample({ mirrored = false, imageBytes = null, mimeType = 'image/png' } = {}) {
  const count = 65537, vectors = count * 12, indexOffset = vectors * 2, uvOffset = indexOffset + 12;
  const imageOffset = uvOffset + (imageBytes ? count * 8 : 0), bin = new Uint8Array(imageOffset + (imageBytes?.length ?? 0));
  const data = new DataView(bin.buffer);
  for (let i = 0; i < count; i++) data.setFloat32(vectors + i * 12 + 8,1,true);
  const setPosition = (index,x,y) => { data.setFloat32(index*12,x,true); data.setFloat32(index*12+4,y,true); };
  setPosition(0,-1,-1); setPosition(65535,1,-1); setPosition(65536,0,1);
  [0,65535,65536].forEach((n,i) => data.setUint32(indexOffset+i*4,n,true));
  if (imageBytes) {
    const setUV = (index,u,v) => { data.setFloat32(uvOffset+index*8,u,true); data.setFloat32(uvOffset+index*8+4,v,true); };
    setUV(0,0,1); setUV(65535,1,1); setUV(65536,0.5,0); bin.set(imageBytes,imageOffset);
  }
  const primitive = { attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }, material = { pbrMetallicRoughness: { baseColorFactor: [1,1,1,1], metallicFactor: 0, roughnessFactor: 1 }, doubleSided: false };
  const json = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, ...(mirrored ? { scale: [-1,1,1] } : {}) }],
    meshes: [{ primitives: [primitive] }], materials: [material], buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: vectors }, { buffer: 0, byteOffset: vectors, byteLength: vectors }, { buffer: 0, byteOffset: indexOffset, byteLength: 12 }],
    accessors: [{ bufferView: 0, componentType: 5126, count, type: 'VEC3', min: [-1,-1,0], max: [1,1,0] },
      { bufferView: 1, componentType: 5126, count, type: 'VEC3' }, { bufferView: 2, componentType: 5125, count: 3, type: 'SCALAR' }] };
  if (imageBytes) {
    primitive.attributes.TEXCOORD_0 = 3; material.pbrMetallicRoughness.baseColorTexture = { index: 0 };
    json.bufferViews.push({ buffer: 0, byteOffset: uvOffset, byteLength: count*8 }, { buffer: 0, byteOffset: imageOffset, byteLength: imageBytes.length });
    json.accessors.push({ bufferView: 3, componentType: 5126, count, type: 'VEC2' });
    json.images = [{ bufferView: 4, mimeType }]; json.textures = [{ source: 0, sampler: 0 }];
    json.samplers = [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }];
  }
  return { json, bin, bytes: packU32Glb(json,bin), indexOffset };
}

export function packU32Glb(json,bin) {
  const encoded = new TextEncoder().encode(JSON.stringify(json)), jsonLength = Math.ceil(encoded.length/4)*4, binLength = Math.ceil(bin.length/4)*4;
  const bytes = new Uint8Array(12+8+jsonLength+8+binLength), view = new DataView(bytes.buffer);
  view.setUint32(0,0x46546c67,true); view.setUint32(4,2,true); view.setUint32(8,bytes.length,true);
  view.setUint32(12,jsonLength,true); view.setUint32(16,0x4e4f534a,true); bytes.fill(0x20,20,20+jsonLength); bytes.set(encoded,20);
  const offset = 20+jsonLength; view.setUint32(offset,binLength,true); view.setUint32(offset+4,0x004e4942,true); bytes.set(bin,offset+8);
  return bytes;
}
