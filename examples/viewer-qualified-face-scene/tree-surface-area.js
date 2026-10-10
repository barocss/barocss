import {queryQualifiedFaceTreeNode} from './qualified-face-tree.js';
import {AREA_OPTIONS,queryQualifiedFaceSurfaceArea} from './surface-area.js';

function copyOptions(input){
  const check=(condition,detail)=>{if(!condition)throw new RangeError('Qualified Face tree Surface area: '+detail);};
  let remaining=32768;
  const ancestors=new Set();
  const copy=(value,depth)=>{
    check(--remaining>=0&&depth<=8,'options own-value/depth budget exceeded');
    if(value===null||typeof value==='boolean')return value;
    if(typeof value==='number'){check(Number.isFinite(value),'finite own options numbers required');return value;}
    if(typeof value==='string'){check(value.length<=128,'options string budget exceeded');return value;}
    check(typeof value==='object','plain own options data required');
    check(!ancestors.has(value),'cyclic options data refused');
    const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
    check(array?prototype===Array.prototype:prototype===Object.prototype||prototype===null,'foreign options prototype refused');
    const keys=Reflect.ownKeys(value),descriptors=Object.getOwnPropertyDescriptors(value);
    check(keys.length<=(array?129:16),'options field budget exceeded');
    check(keys.every(key=>typeof key==='string'&&key.length<=128&&'value'in descriptors[key]
      &&(array&&key==='length'||descriptors[key].enumerable===true)),'getter/symbol/hidden options data refused');
    ancestors.add(value);
    let result;
    if(array){
      const length=descriptors.length.value;
      check(Number.isInteger(length)&&length>=0&&length<=128&&keys.length===length+1,'dense bounded options arrays required');
      result=Array.from({length},(_,index)=>{
        check(Object.hasOwn(descriptors,String(index)),'sparse/extra options array field refused');
        return copy(descriptors[String(index)].value,depth+1);
      });
    }else result=Object.fromEntries(keys.map(key=>[key,copy(descriptors[key].value,depth+1)]));
    ancestors.delete(value);
    return result;
  };
  try{
    const owned=copy(input,0);
    // Test the original input after descriptor admission: cloning the copy would admit Proxies.
    structuredClone(input);
    return owned;
  }catch(cause){
    if(cause instanceof RangeError&&cause.message.startsWith('Qualified Face tree Surface area: '))throw cause;
    throw new RangeError('Qualified Face tree Surface area: own options snapshot refused',{cause});
  }
}

/** Original parametric area estimate for one current, source-qualified native Surface tree node. */
export function queryQualifiedTreeSurfaceArea(viewer,ref,options=AREA_OPTIONS){
  const node=queryQualifiedFaceTreeNode(viewer,ref);
  if(node.ref.kind!=='surface')throw new RangeError('Qualified Face tree Surface area: selected node must be an original Surface');
  const ownedOptions=copyOptions(options);
  const pin={sourceId:node.ref.sourceId,expectedSource:node.ref.expectedSource,faceId:node.ref.faceId,
    modelId:node.ref.modelId,surfaceId:node.ref.geometryId};
  const measurement=queryQualifiedFaceSurfaceArea(viewer.getState().qualifiedFaceScene,pin,ownedOptions);
  return structuredClone({version:0,node,measurement});
}
