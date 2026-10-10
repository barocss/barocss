export function observeSectionUniformResult(result) {
  const {root,mesh}=result,geometry=mesh.geometry,material=mesh.material;
  const row={result,root,mesh,geometry,material,positionAttribute:geometry.positions,normalAttribute:geometry.normals,indexAttribute:geometry.indices,
    positionArray:geometry.positions.buffer,normalArray:geometry.normals.buffer,indexArray:geometry.indices.buffer,
    positions:Array.from(geometry.positions.buffer),normals:Array.from(geometry.normals.buffer),indices:Array.from(geometry.indices.buffer),
    rootDisposals:0,meshDisposals:0,geometryDisposals:0,materialDisposals:0};
  for(const [kind,object] of Object.entries({root,mesh,geometry,material})) {const original=object.destroy;
    object.destroy=function(...args){row[kind+'Disposals']++;return original.apply(this,args);};}
  return [row];
}
