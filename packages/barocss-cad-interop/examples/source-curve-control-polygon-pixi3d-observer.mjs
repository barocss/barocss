/** Captured real instances only. No prototype replacement or synthetic lifecycle. */
export function observeSourceCurveEditPixi3DResult(result) {
 const {root,mesh}=result,geometry=mesh.geometry,material=mesh.material;
 const row={result,root,mesh,geometry,material,positionAttribute:geometry.positions,normalAttribute:geometry.normals,indexAttribute:geometry.indices,
  positionArray:geometry.positions.buffer,normalArray:geometry.normals.buffer,indexArray:geometry.indices.buffer,
  positions:Array.from(geometry.positions.buffer),normals:Array.from(geometry.normals.buffer),indices:Array.from(geometry.indices.buffer),
  rootDisposals:0,meshDisposals:0,geometryDisposals:0,materialDisposals:0};
 for(const [name,object] of Object.entries({root,mesh,geometry,material})){
  const original=object.destroy;object.destroy=function(...args){row[name+'Disposals']++;return original.apply(this,args);};
 }
 return row;
}
/** Observe only genuine shader geometries/buffers created by a completed draw. */
export function observeSourceCurveShaderResources(row, renderer) {
 row.shaderResources ??= [];
 for (const [name, geometry] of Object.entries(row.geometry._shaderGeometry)) {
  if (row.shaderResources.some(value => value.geometry === geometry)) continue;
  const item={name,geometry,destroyCalls:0,buffers:geometry.buffers.map(buffer=>({buffer,glBuffer:buffer._glBuffers[renderer.CONTEXT_UID]?.buffer,
   wasLive:renderer.gl.isBuffer(buffer._glBuffers[renderer.CONTEXT_UID]?.buffer)}))};
  const original=geometry.destroy;geometry.destroy=function(...args){item.destroyCalls++;return original.apply(this,args);};row.shaderResources.push(item);
 }
}
