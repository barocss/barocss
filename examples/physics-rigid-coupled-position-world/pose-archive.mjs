export const rawLayout={type:'Float64',endian:'little',componentsPerBody:13,fields:['positionM:3','velocityMps:3','orientation:4','angularVelocityRadps:3'],signedZerosPreserved:true};
export function poseBytes(bodies,ids=bodies.map(b=>b.id)) {
  const bytes=Buffer.alloc(ids.length*13*8);let offset=0;
  for(const id of ids) { const b=bodies.find(b=>b.id===id);if(!b)throw new Error('Archive body is absent: '+id);for(const x of [...b.positionM,...b.velocityMps,...b.orientation,...b.angularVelocityRadps]) { bytes.writeDoubleLE(x,offset);offset+=8; } }
  return bytes;
}
