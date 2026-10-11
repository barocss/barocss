/** Import-inert CPU/input and instance observations. No DOM, SDK or peer imports. */
export const CASE_KEYS=['main','edited','single'];
export const PINS=[
  {file:'main.mesh-request.json',bytes:1997510,sha256:'6777a43586cfb0ef6df0f4979f83ec610e37223b98b6294f02cdb8372cb2ae09'},
  {file:'main.mesh-result.json',bytes:2783390,sha256:'30013ca3ff2e04b77388a5c7d5ea2fe1f3ea97c6054089f7491e54ef7ffb2165'},
  {file:'edited.mesh-request.json',bytes:2011904,sha256:'af325a5efddf789fae2c7021db94eb6220fc0a05bf632afeef50dbe96eeb5d65'},
  {file:'edited.mesh-result.json',bytes:2806407,sha256:'241b8ebe23c844f3717110b3d856499ec6e1b6e9cfc5a9aa6a2eda1e40e9bfa0'},
  {file:'single.mesh-request.json',bytes:702431,sha256:'a7cd5e9628940555f6c5c9555491292429536788c4d2dc4af85a3f67dbc3f06c'},
  {file:'single.mesh-result.json',bytes:986547,sha256:'935c30ad1693d27765c6aad0a66613edda9a2904258f3a0bb469b41eaefa627a'},
];
export const requireFact=(condition,message)=>{if(!condition)throw new Error(message);};
export const serializeSigned=value=>JSON.stringify(value,(_key,item)=>typeof item==='number'&&Object.is(item,-0)?JSON.rawJSON('-0'):item)+'\n';
export function plainTyped(value){if(ArrayBuffer.isView(value))return{type:value.constructor.name,values:Array.from(value)};if(Array.isArray(value))return value.map(plainTyped);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,plainTyped(item)]));return value;}
export function same(a,b,at='$'){if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){requireFact(Object.is(a,b),'Value/sign changed '+at);return;}requireFact(ArrayBuffer.isView(a)===ArrayBuffer.isView(b)&&Array.isArray(a)===Array.isArray(b),'Container kind changed '+at);if(ArrayBuffer.isView(a)){requireFact(a.constructor===b.constructor&&a.length===b.length,'Typed-array type/size changed '+at);for(let i=0;i<a.length;i++)same(a[i],b[i],at+'.'+i);return;}const left=Object.keys(a),right=Object.keys(b);requireFact(left.length===right.length&&left.every((key,index)=>key===right[index]),'Ordered fields changed '+at);for(const key of left)same(a[key],b[key],at+'.'+key);}
export function refs(value,out=new Set()){if(value&&typeof value==='object'&&!out.has(value)&&!Object.isFrozen(value)){out.add(value);for(const item of Object.values(value))refs(item,out);}return out;}
export function noShared(a,b){const right=refs(b);for(const value of refs(a))requireFact(!right.has(value),'Mutable output reference shared');}
export function zeroPaths(value,path='$',out=[]){if(typeof value==='number'&&Object.is(value,-0))out.push(path);else if(value&&typeof value==='object')for(const[key,item]of Object.entries(value))zeroPaths(item,path+'.'+key,out);return out;}
export function assetFromTexts(key,requestText,resultText){requireFact(CASE_KEYS.includes(key),'Unknown original case');const request=JSON.parse(requestText),native=JSON.parse(resultText);same({body:native.body,options:native.options},request);return{key,request,text:resultText,native,requestPin:PINS.find(pin=>pin.file===key+'.mesh-request.json'),resultPin:PINS.find(pin=>pin.file===key+'.mesh-result.json')};}
const ids=new WeakMap();let nextId=0;
export function identityOf(object){if(object===null||object===undefined)return null;if(!ids.has(object))ids.set(object,++nextId);return ids.get(object);}
export function pose(object){return{position:Array.from(object.position.array),scale:Array.from(object.scale.array),quaternion:Array.from(object.rotationQuaternion.array)};}

/** Peers are passed by the actual browser; importing this module initializes none. */
export function observeResult(result,key,{types,onEvent=()=>{}}){
  requireFact(Object.keys(result).join(',')==='data,root,faceBindings,dispose','Public result boundary changed');
  requireFact(result.root.parent===null&&result.faceBindings.length===6,'Candidate must be detached with six Faces');
  const rootRow={object:result.root,id:identityOf(result.root),destroyCalls:0,pose:pose(result.root)};
  const rootDestroy=result.root.destroy;result.root.destroy=function(...args){rootRow.destroyCalls++;onEvent({type:'owned-root-destroy',key,id:rootRow.id,args:plainTyped(args)});return Reflect.apply(rootDestroy,this,args);};
  const resources=result.faceBindings.map((binding,index)=>{
    const mesh=binding.object,geometry=mesh.geometry,material=mesh.material,chunk=result.data.projection.chunks[index];
    requireFact(mesh instanceof types.Mesh3D&&geometry instanceof types.MeshGeometry3D&&material instanceof types.StandardMaterial,'Actual peer target instances required');
    requireFact(Object.isFrozen(result.faceBindings)&&Object.isFrozen(binding)&&Object.isFrozen(binding.supportRef),'Binding metadata must be frozen');
    requireFact(!Object.isFrozen(mesh)&&binding.supportRef!==chunk.supportRef,'Independent metadata, mutable target required');
    same({faceId:binding.faceId,role:binding.role,orientation:binding.orientation,supportRef:binding.supportRef},{faceId:chunk.faceId,role:chunk.role,orientation:chunk.orientation,supportRef:chunk.supportRef});
    const row={key,index,binding,chunk,mesh,geometry,material,id:identityOf(mesh),geometryId:identityOf(geometry),materialId:identityOf(material),positionsHolder:geometry.positions,normalsHolder:geometry.normals,indicesHolder:geometry.indices,positions:geometry.positions.buffer,normals:geometry.normals.buffer,indices:geometry.indices.buffer,positionsCopy:Array.from(geometry.positions.buffer),normalsCopy:Array.from(geometry.normals.buffer),indicesCopy:Array.from(geometry.indices.buffer),pose:pose(mesh),meshDestroyCalls:0,geometryDestroyCalls:0,materialDestroyCalls:0,shader:null,shaderCreateCalls:0,draws:[]};
    requireFact(row.positions instanceof Float32Array&&row.normals instanceof Float32Array&&row.indices instanceof Uint32Array,'Copied F32/F32/U32 targets required');
    requireFact(row.positions!==chunk.positions&&row.normals!==chunk.normals&&row.indices!==chunk.indices,'Target arrays must be independent copies');
    same(Array.from(row.positions),Array.from(chunk.positions));same(Array.from(row.normals),Array.from(chunk.normals));same(Array.from(row.indices),Array.from(chunk.indices));
    for(const[name,object]of [['mesh',mesh],['geometry',geometry],['material',material]]){const original=object.destroy;object.destroy=function(...args){row[name+'DestroyCalls']++;onEvent({type:'owned-'+name+'-destroy',id:row.id,key,count:row[name+'DestroyCalls'],args:plainTyped(args)});return Reflect.apply(original,this,args);};}
    const createShader=material.createShader;material.createShader=function(...args){row.shaderCreateCalls++;const shader=Reflect.apply(createShader,this,args);row.shader=shader;onEvent({type:'actual-shader-return',id:row.id,returned:!!shader,shaderId:identityOf(shader),name:shader?.name??null});return shader;};
    return row;
  });
  return{key,result,resources,rootRow,dataCopy:structuredClone(result.data)};
}
export function checkResult(record,{borrowedRow=null,callerGeometry=null,callerMaterial=null,camera=null,lighting=null}={}){
  same(record.result.data,record.dataCopy);
  if(record.rootRow.destroyCalls===0)same(pose(record.result.root),record.rootRow.pose);
  for(const row of record.resources){
    same(Array.from(row.positions),row.positionsCopy);same(Array.from(row.normals),row.normalsCopy);same(Array.from(row.indices),row.indicesCopy);
    requireFact(row.geometry.positions===row.positionsHolder&&row.geometry.normals===row.normalsHolder&&row.geometry.indices===row.indicesHolder,'Original attribute holder changed');
    requireFact(!row.geometry.uvs,'Native UV must remain CPU authority only');
    if(row.meshDestroyCalls===0){same(pose(row.mesh),row.pose);if(row===borrowedRow)requireFact(row.mesh.geometry===callerGeometry&&row.mesh.material===callerMaterial,'Borrowed pointer changed');else requireFact(row.mesh.geometry===row.geometry&&row.mesh.material===row.material,'Owned current pointers changed');if(camera)requireFact(row.material.camera===camera&&row.material.lightingEnvironment===lighting,'Caller material context changed');}
  }
}
export function captureRows(resources){return resources.map(row=>({key:row.key,faceId:row.binding.faceId,role:row.binding.role,orientation:row.binding.orientation,supportRef:row.binding.supportRef,meshId:row.id,geometryId:row.geometryId,materialId:row.materialId,positions:[...row.positionsCopy],normals:[...row.normalsCopy],indices:[...row.indicesCopy],nativeUV:plainTyped(row.chunk.nativeUV),association:plainTyped({authorityIndices:row.chunk.authorityIndices,faceSampleIndices:row.chunk.faceSampleIndices,triangleIndices:row.chunk.triangleIndices,nativeQuantizationGapsMM:row.chunk.nativeQuantizationGapsMM}),pose:row.pose,currentGeometryId:identityOf(row.mesh.geometry),currentMaterialId:identityOf(row.mesh.material),meshDestroyed:row.mesh.destroyed,meshDestroyCalls:row.meshDestroyCalls,geometryDestroyCalls:row.geometryDestroyCalls,materialDestroyCalls:row.materialDestroyCalls,shaderId:identityOf(row.shader),shaderCreateCalls:row.shaderCreateCalls,draws:row.draws}));}
