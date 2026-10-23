import type { QualifiedTranslatedStripBodyResult } from './qualified-translated-strip-body.js';
import type { QualifiedTranslatedStripBodyMeshError, QualifiedTranslatedStripBodyMeshResult } from './qualified-translated-strip-body-mesh.js';
import type { SurfaceD1Result } from '../derivatives.js';
import type { Point, Surface } from '../types.js';

type Face=QualifiedTranslatedStripBodyResult['faces'][number];
type Role=Face['role'];
type Key=[number,number,number];
type UV=[number,number];
type EdgePath=QualifiedTranslatedStripBodyMeshResult['edgePaths'][number];
type FaceSample=QualifiedTranslatedStripBodyMeshResult['faceSamples'][number];
type D1State=FaceSample['d1'];
export type QualifiedStripMeshFaceGrid={faceId:string;role:Role;orientation:Face['orientation'];gridSize:[number,number];vertexIndices:number[];sampleIndices:number[]};
export interface QualifiedStripMeshDomainCallbacks {
  fail(code:QualifiedTranslatedStripBodyMeshError['code'],detail:string,cause?:unknown):never;
  isRootError(cause:unknown):boolean;
  surfaceD0(surface:Surface,uv:UV):Point;
  surfaceD1(surface:Surface,uv:UV):SurfaceD1Result;
  resolveVertex(key:Key,faceId:string,point:Point,faceSampleIndex:number):{vertexIndex:number;anchorPoint:Point};
  existingVertex(key:Key):{vertexIndex:number;anchorPoint:Point}|null;
}
export type QualifiedStripMeshDomainResult={faceSamples:FaceSample[];faceGrids:QualifiedStripMeshFaceGrid[]};

/** Trusted only after main validates the complete Body, sources, logical keys and native Curve/Use caches. */
export function buildQualifiedStripMeshFaceSamplesTrusted(
  body:QualifiedTranslatedStripBodyResult,
  uStations:number[],
  edgePaths:EdgePath[],
  callbacks:QualifiedStripMeshDomainCallbacks,
):QualifiedStripMeshDomainResult {
  const fail:QualifiedStripMeshDomainCallbacks['fail']=callbacks.fail;const check=(condition:boolean,code:QualifiedTranslatedStripBodyMeshError['code'],detail:string):void=>{if(!condition)fail(code,detail);};
  const finite=(value:number):number=>{check(Number.isFinite(value),'REPRESENTABILITY','Finite chart/normal/gap arithmetic required');return value;};
  const copyPoint=(point:Point):Point=>[point[0],point[1],point[2]],copyUV=(uv:UV):UV=>[uv[0],uv[1]];
  const gap=(a:Point,b:Point):number=>finite(Math.hypot(...a.map((value,k)=>finite(value-b[k]))));
  const interpolate=(a:number,b:number,index:number):number=>index===0?a:index===4?b:finite(a+finite(finite(b-a)*(index/4)));
  const cross=(a:Point,b:Point):Point=>[finite(finite(a[1]*b[2])-finite(a[2]*b[1])),finite(finite(a[2]*b[0])-finite(a[0]*b[2])),finite(finite(a[0]*b[1])-finite(a[1]*b[0]))];
  const roles:Role[]=['lower','upper','cap','base','uMin','uMax'];
  check(body.faces.length===6&&body.faces.every((face,i)=>face.role===roles[i]),'TOPOLOGY','Actual six Face order must match the occupied charts');
  check(uStations.length>=5&&uStations.length<=17&&uStations.length%4===1,'UV','Original quartile U station count must be 4n+1');
  const lastU=uStations.length-1,faceSamples:FaceSample[]=[],faceGrids:QualifiedStripMeshFaceGrid[]=[];
  const path=(role:EdgePath['role']):EdgePath=>{const value=edgePaths.find(item=>item.role===role);if(value===undefined)fail('TOPOLOGY','Actual canonical Edge cache role must resolve');return value;};
  const useFor=(edge:EdgePath,face:Face):EdgePath['uses'][number]=>{const use=edge.uses.find(item=>item.faceId===face.id);if(use===undefined)fail('UV','Actual Face Use pcurve cache must resolve');return use;};
  const cachedUV=(role:EdgePath['role'],face:Face,index:number):UV=>{const sample=useFor(path(role),face).samples[index];if(sample===undefined)fail('UV','Actual roof/PlaneUV cached sample must resolve');return sample.uv;};
  const keyFor=(role:Role,i:number,j:number):Key=>role==='lower'?[i,j,0]:role==='upper'?[i,j,4]:role==='cap'?[i,4,j]:role==='base'?[i,0,j]:role==='uMin'?[0,i,j]:[lastU,i,j];
  const roleNormal=(face:Face,normal:Point):void=>{
    const correct=face.role==='lower'?normal[1]<0:face.role==='upper'?normal[1]>0:face.role==='base'?normal[2]<0:face.role==='uMin'?normal[0]<0:face.role==='uMax'?normal[0]>0:normal[2]>0;
    check(correct,'ORIENTATION','Actual oriented native support normal must have the correct outward principal sign');
    if(face.role==='cap'){const grid=face.nativeSurface.controlPoints,origin=grid[0][0],u=grid[1][0].map((value,k)=>finite(value-origin[k])) as Point,v=grid[0][1].map((value,k)=>finite(value-origin[k])) as Point,raw=cross(u,v),dot=finite(normal.reduce((sum,value,k)=>finite(sum+finite(value*raw[k])),0));check(dot>0,'ORIENTATION','Actual cap normal must agree with the original Plane orientation');}
  };
  const normalState=(face:Face,uv:UV,point:Point):D1State=>{
    let raw:SurfaceD1Result;
    try{raw=callbacks.surfaceD1(face.nativeSurface,uv);}catch(cause){
      if(callbacks.isRootError(cause))throw cause;
      if(!(cause instanceof Error)||!/exact C0 interior knot/.test(cause.message))fail('NATIVE','Actual native Surface D1 refused outside the admitted C0 union',cause);
      if(cause.name.length>1024||cause.message.length>1024)fail('NATIVE','Actual native C0 refusal metadata exceeds its bound',cause);
      return {status:'refused-c0',name:cause.name,reason:cause.message,point:null,du:null,dv:null,orientedNormal:null,pointGapMM:null};
    }
    const pointGapMM=gap(raw.point,point);check(pointGapMM<=1e-7,'UV','Actual native Surface D1 point differs from its D0 sample');
    const nativeNormal=cross(raw.du,raw.dv),length=finite(Math.hypot(...nativeNormal));check(length>0,'REPRESENTABILITY','Actual native normal cross product must be nonzero');const sign=face.orientation==='forward'?1:-1,orientedNormal=nativeNormal.map(value=>finite(sign*value/length)) as Point;
    check(Math.abs(finite(Math.hypot(...orientedNormal))-1)<=1e-5,'REPRESENTABILITY','Actual finite native normal normalization failed');roleNormal(face,orientedNormal);
    return {status:'evaluated',point:copyPoint(raw.point),du:copyPoint(raw.du),dv:copyPoint(raw.dv),orientedNormal,pointGapMM};
  };
  for(const face of body.faces){
    const isEnd=face.role==='uMin'||face.role==='uMax',width=isEnd?5:uStations.length,gridSize:[number,number]=[width,5],vertexIndices:number[]=[],sampleIndices:number[]=[];
    const surface=face.nativeSurface,domains={u:[surface.knotsU[surface.degreeU],surface.knotsU[surface.controlPoints.length]],v:[surface.knotsV[surface.degreeV],surface.knotsV[surface.controlPoints[0].length]]};
    for(let i=0;i<width;i++)for(let j=0;j<5;j++){
      const key=keyFor(face.role,i,j),boundary=i===0||i===width-1||j===0||j===4,anchor=callbacks.existingVertex(key);
      check(boundary?anchor!==null:anchor===null,'TOPOLOGY','Logical Face boundary/interior must match the shared topology cache');
      let nominalUV:UV;
      if(face.role==='lower'||face.role==='upper'){const roof=cachedUV(face.role==='lower'?'lowerCut':'upperCut',face,i);nominalUV=[uStations[i],interpolate(domains.v[0],roof[1],j)];}
      else if(face.role==='base')nominalUV=[uStations[i],interpolate(domains.v[0],domains.v[1],j)];
      else if(face.role==='cap'){const low=cachedUV('lowerCut',face,i),high=cachedUV('upperCut',face,i);nominalUV=[interpolate(low[0],high[0],j),interpolate(low[1],high[1],j)];}
      else nominalUV=[interpolate(domains.u[0],domains.u[1],i),interpolate(domains.v[0],domains.v[1],j)];
      check(nominalUV.every(Number.isFinite),'REPRESENTABILITY','Nominal occupied chart coordinates must be finite');
      const boundaryUseSamples:FaceSample['boundaryUseSamples']=[];const nativeUVs:UV[]=[];
      if(boundary&&anchor!==null){
        for(const storedUse of face.loop.uses){const edge=edgePaths.find(item=>item.edgeId===storedUse.edgeId);if(edge===undefined)fail('UV','Stored Face Use must resolve its actual Edge cache');const actualUse=edge.uses.find(item=>item.useId===storedUse.id&&item.faceId===face.id);if(actualUse===undefined)fail('UV','Stored Face Use must resolve its actual pcurve witness');
          const matches=actualUse.samples.filter(sample=>sample.vertexIndex===anchor.vertexIndex);check(matches.length<=1,'TOPOLOGY','One canonical Use sample may resolve each shared boundary node');
          if(matches.length===1){const sample=matches[0];boundaryUseSamples.push({edgeId:edge.edgeId,useId:actualUse.useId,sampleIndex:sample.index});nativeUVs.push(sample.uv);}
        }
        const expected=(i===0||i===width-1)&&(j===0||j===4)?2:1;check(boundaryUseSamples.length===expected,'UV','Each Edge node/Face corner must retain one/two actual Use witnesses');
      }
      const uv=nativeUVs.length?copyUV(nativeUVs[0]):copyUV(nominalUV),chosenUseId=boundaryUseSamples.length?boundaryUseSamples[0].useId:null,alternateUVGap=nativeUVs.length===2?finite(Math.max(Math.abs(finite(nativeUVs[1][0]-uv[0])),Math.abs(finite(nativeUVs[1][1]-uv[1])))):null;
      const index=faceSamples.length,point=callbacks.surfaceD0(surface,uv),resolved=callbacks.resolveVertex(key,face.id,copyPoint(point),index),anchorGapMM=gap(point,resolved.anchorPoint);
      check(boundary?anchor!==null&&resolved.vertexIndex===anchor.vertexIndex:anchorGapMM===0,'TOPOLOGY','Face interior insertion/boundary anchor must retain actual topology authority');check(anchorGapMM<=1e-7,'UV','Actual native support point-to-shared-anchor gap exceeds 1e-7 mm');
      const d1=normalState(face,uv,point);faceSamples.push({index,faceId:face.id,role:face.role,supportRef:{...face.supportRef},grid:[i,j],vertexIndex:resolved.vertexIndex,nominalUV:copyUV(nominalUV),uv,boundaryUseSamples,chosenUseId,alternateUVGap,point:copyPoint(point),anchorPoint:copyPoint(resolved.anchorPoint),anchorGapMM,d1});vertexIndices.push(resolved.vertexIndex);sampleIndices.push(index);
    }
    faceGrids.push({faceId:face.id,role:face.role,orientation:face.orientation,gridSize,vertexIndices,sampleIndices});
  }
  check(faceSamples.length===20*uStations.length+50&&faceSamples.length<=390,'BUDGET','Complete six Face sample schedule must fit 390');return {faceSamples,faceGrids};
}
