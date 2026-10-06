import {decimal} from './parameters.mjs';
const surfaces=['x_min','x_max','y_min','y_max','z_min','z_max'];
const cornersByFace=[[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]];
const normalByFace=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
const wrappers=surfaces.map(id=>'box_'+id),vertices=Array.from({length:8},(_,i)=>'box_v'+i),edges=Array.from({length:12},(_,i)=>'box_e'+i);
const localIds={faceId:'local_face',loopId:'local_loop',vertexIds:['local_v0','local_v1','local_v2','local_v3'],edgeIds:['local_e0','local_e1','local_e2','local_e3'],curveIds:['local_c0','local_c1','local_c2','local_c3']};
function own(value,seen=new Set(),depth=0,budget={count:0}){
 if(++budget.count>32768||depth>18)throw new RangeError('Box data structural budget exceeded');
 if(typeof value==='string'){if(value.length>32768)throw new RangeError('Box string budget exceeded');return value;}
 if(typeof value==='number'){if(!Number.isFinite(value))throw new RangeError('Box data must be finite');return value;}
 if(value===null||typeof value==='boolean')return value;
 if(!value||typeof value!=='object'||seen.has(value))throw new TypeError('Box requires unaliased plain data');seen.add(value);
 const array=Array.isArray(value);if(Object.getPrototypeOf(value)!==(array?Array.prototype:Object.prototype))throw new TypeError('Box requires plain objects and arrays');
 const keys=Reflect.ownKeys(value);if(array?(value.length>128||keys.length!==value.length+1):keys.length>16)throw new RangeError('Box data shape budget exceeded');
 const result=array?[]:{};for(const key of keys){if(array&&key==='length')continue;const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||['__proto__','prototype','constructor'].includes(key)||!d||!('value'in d)||!d.enumerable||(array&&!/^(0|[1-9][0-9]*)$/.test(key)))throw new TypeError('Box fields must be safe own data');result[key]=own(d.value,seen,depth+1,budget);}return result;
}
function exact(value,keys,label){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||!keys.every(k=>Object.hasOwn(value,k)))throw new TypeError(label+' has missing or foreign fields');}
function requestData(input){const r=own(input);exact(r,['id','origin','sides','revision'],'Box request');if(typeof r.id!=='string'||r.id.length>128||!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(r.id)||[...surfaces,...wrappers,...vertices,...edges].includes(r.id))throw new RangeError('Use a distinct derived box mesh ID');if(!Number.isInteger(r.revision)||r.revision<0||r.revision>2147483647)throw new RangeError('Box revision must be 0..2147483647');for(const[k,tuple]of Object.entries({origin:r.origin,sides:r.sides})){if(!Array.isArray(tuple)||tuple.length!==3||!tuple.every(Number.isInteger))throw new TypeError('Box '+k+' must be an integer triple');}if(!r.sides.every(n=>n>=1&&n<=10000)||!r.origin.every((n,i)=>n>=-10000&&n+r.sides[i]<=10000))throw new RangeError('Box sides/corners exceed original bounds');return r;}
function immutableLineage(result){for(const face of result.lineage.faces)Object.freeze(face);Object.freeze(result.lineage.faces);Object.freeze(result.lineage);return result;}
const point=(origin,sides,index)=>origin.map((n,k)=>(index>>k)&1?n+sides[k]:n);
const encode=v=>Array.isArray(v)?'['+v.map(encode).join(',')+']':decimal(v);
function same(a,b,label){if(typeof a!==typeof b||a===null||b===null){if(a!==b)throw new RangeError('Box '+label+' association mismatch');return;}if(typeof a!=='object'){if(!Object.is(a,b))throw new RangeError('Box '+label+' association mismatch');return;}if(Array.isArray(a)!==Array.isArray(b)||Object.keys(a).length!==Object.keys(b).length)throw new RangeError('Box '+label+' association mismatch');for(const key of Object.keys(b)){if(!Object.hasOwn(a,key))throw new RangeError('Box '+label+' association mismatch');same(a[key],b[key],label+'.'+key);}}
export function prepareBoxPreview(input,cad){
 const r=requestData(input),corners=Array.from({length:8},(_,i)=>point(r.origin,r.sides,i));
 const source='@model preview_box {\n version: 0; length-unit: mm;\n'+surfaces.map((id,i)=>{const[a,b,c,d]=cornersByFace[i];return` @surface #${id} { type: nurbs; degree-u: 1; degree-v: 1; knots-u: [0,0,1,1]; knots-v: [0,0,1,1]; control-points: ${encode([[corners[a],corners[d]],[corners[b],corners[c]]])}; weights: [[1,1],[1,1]]; }\n`;}).join('')+'}\n';
 const model=cad.parseModel(source);if(model.objects.length!==6||model.version!==0)throw new RangeError('Box source model association mismatch');
 const bundles=model.objects.map((surface,i)=>{if(surface.kind!=='surface'||surface.id!==surfaces[i])throw new RangeError('Box source face order association mismatch');return cad.buildParametricFace(surface,localIds);});
 const shell=cad.buildAxisBoxShell(r.origin,r.sides,bundles,{shellId:r.id,faceIds:wrappers,vertexIds:vertices,edgeIds:edges}),solidReport=cad.validateAxisBoxSolid(shell);
 const facePackets=model.objects.map((surface,i)=>{
  const result=cad.tessellateSurface(surface,{countU:2,countV:2,revision:r.revision}),p=result.packet;cad.validatePreviewPacket(p);
  if(p.surfaceId!==surface.id||p.revision!==r.revision||p.positions.length!==12||p.indices.length!==6)throw new RangeError('Box face packet identity/range association mismatch');
  same(p.parameters,[0,0,0,1,1,0,1,1],'local face parameters');
  for(let j=0;j<4;j++){const q=cad.evaluateSurface(surface,p.parameters[2*j],p.parameters[2*j+1]);for(let k=0;k<3;k++)if(Math.abs(p.positions[3*j+k]-q[k])>1e-9||Math.abs(p.normals[3*j+k]-normalByFace[i][k])>1e-9)throw new RangeError('Box native position/normal association mismatch');}
  return result;
 });
 const packet={version:0,surfaceId:r.id,revision:r.revision,lengthUnit:'mm',coordinateSystem:'right-handed-y-up',winding:'ccw',positions:[],normals:[],indices:[],parameters:[],bounds:{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]}};
 for(const[resultIndex,result]of facePackets.entries()){const p=result.packet;packet.positions.push(...p.positions);packet.normals.push(...p.normals);packet.parameters.push(...p.parameters);packet.indices.push(...p.indices.map(n=>n+4*resultIndex));for(let k=0;k<3;k++){packet.bounds.min[k]=Math.min(packet.bounds.min[k],p.bounds.min[k]);packet.bounds.max[k]=Math.max(packet.bounds.max[k],p.bounds.max[k]);}}
 cad.validatePreviewPacket(packet);for(let k=0;k<3;k++)if(packet.bounds.min[k]!==solidReport.boundsMM.min[k]||packet.bounds.max[k]!==solidReport.boundsMM.max[k])throw new RangeError('Box bounds/solid association mismatch');
 const lineage={meshId:r.id,sourceVersion:0,faces:surfaces.map((surfaceId,i)=>({faceId:wrappers[i],surfaceId,vertexStart:4*i,vertexCount:4,indexStart:6*i,indexCount:6})),units:'mm',coordinateSystem:'right-handed-y-up',winding:'ccw',revision:r.revision};
 return immutableLineage(structuredClone({source,sourceVersion:0,model,shell,solidReport,facePackets,packet,lineage}));
}
// Rebuild every native association before a stored/corrupted consumer record can draw.
export function validateBoxPreview(input,cad){
 const value=own(input);exact(value,['source','sourceVersion','model','shell','solidReport','facePackets','packet','lineage'],'Box preview');
 const expected=prepareBoxPreview({id:value.shell.id,origin:value.shell.origin,sides:value.shell.sides,revision:value.packet.revision},cad);
 for(const key of Object.keys(expected))same(value[key],expected[key],key);
 return immutableLineage(value);
}
