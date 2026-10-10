import {queryQualifiedFaceTreeNode} from './qualified-face-tree.js';

const check=(condition,message)=>{if(!condition)throw new RangeError('Qualified Face appearance: '+message);};
function colorSnapshot(input){
  check(Array.isArray(input)&&Object.getPrototypeOf(input)===Array.prototype,'RGB must be an ordinary own array');
  const length=Object.getOwnPropertyDescriptor(input,'length'),keys=Reflect.ownKeys(input);
  check(length&&'value'in length&&length.value===3&&keys.length===4
    &&keys.every(key=>key==='length'||key==='0'||key==='1'||key==='2'),'RGB must contain exactly three dense own channels');
  const color=[];
  for(let index=0;index<3;index++){
    const descriptor=Object.getOwnPropertyDescriptor(input,String(index));
    check(descriptor&&descriptor.enumerable&&'value'in descriptor,'RGB channels must be own data');
    const value=descriptor.value;
    check(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1,'RGB channels must be finite numbers in0..1');
    color.push(value);
  }
  try{structuredClone(input);}catch(cause){throw new RangeError('Qualified Face appearance: RGB cannot be copied',{cause});}
  return color;
}
function same(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Reflect.ownKeys(a),other=Reflect.ownKeys(b);
  return keys.length===other.length&&keys.every(key=>other.includes(key)&&same(a[key],b[key]));
}

/** Display RGB for the whole original parent Face of one current native Surface or Curve tree node. */
export function applyQualifiedTreeFaceColor(viewer,ref,rgb){
  const color=colorSnapshot(rgb),node=queryQualifiedFaceTreeNode(viewer,ref),state=viewer.getState(),scene=state.qualifiedFaceScene;
  check(state.status==='ready'&&scene,'appearance requires a current available qualified Face view');
  const asset=scene.assets.find(value=>value.sourceId===node.ref.sourceId);
  check(asset&&asset.source===node.ref.expectedSource&&asset.face.topology.face.id===node.ref.faceId
    &&asset.face.geometry.name===node.ref.modelId&&same(asset.face,node.ref.expectedFace),'current original parent Face binding changed');
  if(color.every((value,index)=>Object.is(value,asset.color[index])))return structuredClone({version:0,node,color,changed:false});
  const assets=structuredClone(scene.assets);
  assets.find(value=>value.sourceId===node.ref.sourceId).color=[...color];
  viewer.loadQualifiedFaceScene({version:0,basis:scene.basis,assets,countU:scene.countU,countV:scene.countV,
    camera:structuredClone(state.camera),translateScene:[...scene.translate]});
  return structuredClone({version:0,node,color,changed:true});
}
