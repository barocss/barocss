import {buildQualifiedFaceTree} from './qualified-face-tree.js';

const check=(value,message)=>{if(!value)throw new RangeError('Qualified Face tree filter: '+message);};
function filterInput(input){
  check(input!==null&&typeof input==='object'&&Object.getPrototypeOf(input)===Object.prototype,'input must be plain own data');
  const fields=['query','sourceId','kind'],keys=Reflect.ownKeys(input);
  check(keys.length===3&&keys.every(key=>typeof key==='string'&&fields.includes(key)),'input requires exact query/sourceId/kind fields');
  const filter={};
  for(const key of fields){
    const field=Object.getOwnPropertyDescriptor(input,key);
    check(field&&field.enumerable&&'value'in field,key+' must be own enumerable data');filter[key]=field.value;
  }
  check(typeof filter.query==='string'&&filter.query.length<=256
    &&new TextEncoder().encode(filter.query).length<=256,'query exceeds256 code units or UTF8 bytes');
  check(filter.sourceId===null||typeof filter.sourceId==='string'&&/^[A-F]$/.test(filter.sourceId),'sourceId must be null or uppercase A..F');
  check(filter.kind==='all'||filter.kind==='surface'||filter.kind==='curve','kind must be all, surface or curve');
  try{structuredClone(input);}catch(cause){throw new RangeError('Qualified Face tree filter: input cannot be copied',{cause});}
  return filter;
}
function asciiFold(value){
  let result='';
  for(const character of value){const code=character.charCodeAt(0);result+=code>=65&&code<=90?String.fromCharCode(code+32):character;}
  return result;
}
function asciiTrim(value){
  const space=code=>code===32||code===9||code===13||code===10;
  let start=0,end=value.length;
  while(start<end&&space(value.charCodeAt(start)))start++;
  while(end>start&&space(value.charCodeAt(end-1)))end--;
  return value.slice(start,end);
}

/** Filter copied labels only; the complete original tree remains the native authority. */
export function filterQualifiedFaceTree(viewer,input){
  const filter=filterInput(input),tree=buildQualifiedFaceTree(viewer);if(tree===null)return null;
  const query=asciiFold(asciiTrim(filter.query)),sources=[];
  for(const source of tree.sources){
    if(filter.sourceId!==null&&source.sourceId!==filter.sourceId)continue;
    const geometries=source.geometries.filter(node=>{
      if(filter.kind!=='all'&&node.ref.kind!==filter.kind)return false;
      const label=`Source ${source.sourceId} Face ${source.faceId} Model ${source.modelId} ${source.sourceId} ${node.ref.kind} ${node.ref.geometryId}`;
      return asciiFold(label).includes(query);
    });
    if(geometries.length)sources.push({...source,geometries});
  }
  return structuredClone({version:0,filter,sources,counts:{totalSources:tree.sources.length,
    totalGeometries:tree.sources.reduce((sum,source)=>sum+source.geometries.length,0),visibleSources:sources.length,
    visibleGeometries:sources.reduce((sum,source)=>sum+source.geometries.length,0)}});
}
