import type { SectionFraction, SectionRational, SectionRationalContext } from './section-rational-internal.js';
import type { Point } from './types.js';

/** Geometry only, projected by a caller that owns the complete native validation. */
export interface QualifiedStlGeometry {
  readonly positionsMM: readonly number[];
  readonly indices: readonly number[];
  readonly vertices: readonly { readonly index: number; readonly point: readonly number[] }[];
  readonly triangles: readonly { readonly index: number; readonly faceId: string; readonly vertexIndices: readonly number[] }[];
}

/** Private seam: the caller first admits the complete native mesh, once. */
export interface QualifiedStlCounts {
  meshValidationCount:number;vertexCount:number;coordinateFloat32RoundCount:number;
  triangleCount:number;normalFloat32RoundCount:number;exactCrossCount:number;normalAlignmentCount:number;
  encodedFloat32Count:number;encodedAttributeCount:number;encodedByteCount:number;
  curveD0Count:0;curveD1Count:0;surfaceD0Count:0;surfaceD1Count:0;sourceCompilationCount:0;
  rootSolveCount:0;rationalFloatConversionCount:0;fileWriteCount:0;fileReadCount:0;
}
export interface QualifiedStlVertexLoss {
  vertexIndex:number;sourcePointMM:Point;float32PointMM:Point;componentLossMM:Point;
  exactSquaredDisplacementMM2:SectionFraction;measuredDisplacementMM:number;
}
export interface QualifiedStlFacet {
  triangleIndex:number;faceId:string;vertexIndices:[number,number,number];byteOffset:number;
  normal:Point;unitResidual:number;exactCross:[SectionFraction,SectionFraction,SectionFraction];
  exactNormalDotCross:SectionFraction;attributeByteCount:0;
}
export interface QualifiedStlEncodingResult {
  bytes:number[];vertexLosses:QualifiedStlVertexLoss[];facets:QualifiedStlFacet[];
  maximumSquaredDisplacementMM2:SectionFraction;maximumMeasuredDisplacementMM:number;
}
export interface QualifiedStlEncodingCallbacks {
  beginVertex(index:number):void;
  beginTriangle(index:number):void;
  beginEncoding():void;
  retainPhase(data:{vertexLosses:QualifiedStlVertexLoss[];facets:QualifiedStlFacet[];bytes:number[]|null}):void;
  fail(code:'BINDING'|'REPRESENTABILITY'|'COLLAPSE'|'NORMAL'|'BUDGET',detail:string,cause?:unknown):never;
}

const HEADER='BaroCSS binary STL | mm convention | approximate facets';
type ExactPoint=[SectionRational,SectionRational,SectionRational];

/** Encode only after every vertex-loss and quantized-facet guard has succeeded. */
export function encodeQualifiedStripBinaryStlTrusted(
  packet:QualifiedStlGeometry,
  q:SectionRationalContext,
  counts:QualifiedStlCounts,
  callbacks:QualifiedStlEncodingCallbacks,
):QualifiedStlEncodingResult {
  const {fail}=callbacks;
  function check(condition:boolean,code:Parameters<typeof fail>[0],detail:string):asserts condition {
    if(!condition)fail(code,detail);
  }
  function finite(value:number,code:'REPRESENTABILITY'|'NORMAL'='REPRESENTABILITY'):number {
    check(Number.isFinite(value),code,'Every binary STL arithmetic value must remain finite');return value;
  }
  const vertexCount=packet.vertices.length,triangleCount=packet.triangles.length;
  check(vertexCount>0&&vertexCount<=290&&triangleCount>0&&triangleCount<=576,'BUDGET','Binary STL requires the bounded290-vertex/576-triangle profile');
  check(packet.positionsMM.length===3*vertexCount&&packet.indices.length===3*triangleCount,'BINDING','Flat authority positions and indices must bind every original vertex and triangle');
  const byteLength=84+50*triangleCount;
  check(byteLength<=28884,'BUDGET','Complete binary STL must fit28884 bytes');
  const vertexLosses:QualifiedStlVertexLoss[]=[],facets:QualifiedStlFacet[]=[],exactPoints:ExactPoint[]=[];
  const zero=q.integer(0);
  // Request-local reuse of already-metered exact values, never a second context.
  // Signed zero remains in the source/Float32 points; both represent exact zero.
  const represented=new Map<number,SectionRational>([[0,zero]]);
  const from=(value:number):SectionRational=>{
    const cached=represented.get(value);if(cached!==undefined)return cached;
    const result=q.from(value);represented.set(value,result);return result;
  };
  const negatives=new WeakMap<SectionRational,SectionRational>();
  const neg=(value:SectionRational):SectionRational=>{
    if(value.n===0n)return zero;
    const cached=negatives.get(value);if(cached!==undefined)return cached;
    const result=q.neg(value);negatives.set(value,result);negatives.set(result,value);return result;
  };
  // At most the frozen vertex/triangle schedule can introduce cache entries.
  // Every cache miss still performs all arithmetic through the metered q.
  const memo=(operation:(a:SectionRational,b:SectionRational)=>SectionRational)=>{
    const cache=new WeakMap<SectionRational,WeakMap<SectionRational,SectionRational>>();
    return (a:SectionRational,b:SectionRational):SectionRational=>{
      let row=cache.get(a);const cached=row?.get(b);if(cached!==undefined)return cached;
      const result=operation(a,b);if(row===undefined){row=new WeakMap();cache.set(a,row)}row.set(b,result);return result;
    };
  };
  const exactAdd=memo((a,b)=>q.add(a,b)),exactSub=memo((a,b)=>q.sub(a,b)),exactMul=memo((a,b)=>q.mul(a,b));
  const add=(a:SectionRational,b:SectionRational):SectionRational=>a.n===0n?b:b.n===0n?a:exactAdd(a,b);
  const sub=(a:SectionRational,b:SectionRational):SectionRational=>a.n===b.n&&a.d===b.d?zero:b.n===0n?a:a.n===0n?neg(b):exactSub(a,b);
  const mul=(a:SectionRational,b:SectionRational):SectionRational=>{
    if(a.n===0n||b.n===0n)return zero;
    if(a.n===1n&&a.d===1n)return b;if(b.n===1n&&b.d===1n)return a;
    if(a.n===-1n&&a.d===1n)return neg(b);if(b.n===-1n&&b.d===1n)return neg(a);
    return exactMul(a,b);
  };
  let maximumSquared=zero,maximumMeasuredDisplacementMM=0;
  for(let index=0;index<vertexCount;index++){
    callbacks.beginVertex(index);counts.vertexCount++;
    const vertex=packet.vertices[index];
    check(vertex.index===index&&vertex.point.length===3,'BINDING','Every original unique vertex must retain its original index and XYZ rank');
    const sourcePointMM:Point=[0,0,0],float32PointMM:Point=[0,0,0],componentLossMM:Point=[0,0,0],exactPoint:ExactPoint=[zero,zero,zero];
    let squared=zero;
    for(let axis=0;axis<3;axis++){
      const source=finite(packet.positionsMM[3*index+axis]);
      check(Object.is(source,vertex.point[axis]),'BINDING','Native packet positions must retain the original vertex coordinate bits');
      sourcePointMM[axis]=source;
      counts.coordinateFloat32RoundCount++;
      const rounded=finite(Math.fround(source));float32PointMM[axis]=rounded;
      componentLossMM[axis]=finite(source-rounded);
      exactPoint[axis]=from(rounded);
      const loss=sub(from(source),exactPoint[axis]);squared=add(squared,mul(loss,loss));
    }
    const measuredDisplacementMM=finite(Math.hypot(...componentLossMM));
    if(q.compare(squared,maximumSquared)>0)maximumSquared=squared;
    maximumMeasuredDisplacementMM=Math.max(maximumMeasuredDisplacementMM,measuredDisplacementMM);
    exactPoints.push(exactPoint);
    vertexLosses.push({vertexIndex:index,sourcePointMM,float32PointMM,componentLossMM,exactSquaredDisplacementMM2:q.text(squared),measuredDisplacementMM});
  }
  callbacks.retainPhase({vertexLosses,facets,bytes:null});
  for(let index=0;index<triangleCount;index++){
    callbacks.beginTriangle(index);counts.triangleCount++;
    const triangle=packet.triangles[index];
    check(triangle.index===index&&triangle.vertexIndices.length===3&&typeof triangle.faceId==='string'&&triangle.faceId.length>0,'BINDING','Original triangle order, face identity and index rank must be retained');
    const vertexIndices:[number,number,number]=[triangle.vertexIndices[0],triangle.vertexIndices[1],triangle.vertexIndices[2]];
    for(let corner=0;corner<3;corner++)check(Number.isInteger(vertexIndices[corner])&&vertexIndices[corner]>=0&&vertexIndices[corner]<vertexCount&&Object.is(vertexIndices[corner],packet.indices[3*index+corner]),'BINDING','Triangle indices must bind the original flat uint32 authority mapping');
    check(new Set(vertexIndices).size===3,'BINDING','An original triangle requires three distinct authority vertices');
    const a=exactPoints[vertexIndices[0]],b=exactPoints[vertexIndices[1]],c=exactPoints[vertexIndices[2]];
    const u=a.map((value,axis)=>sub(b[axis],value)) as ExactPoint,v=a.map((value,axis)=>sub(c[axis],value)) as ExactPoint;
    counts.exactCrossCount++;
    const cross:ExactPoint=[sub(mul(u[1],v[2]),mul(u[2],v[1])),sub(mul(u[2],v[0]),mul(u[0],v[2])),sub(mul(u[0],v[1]),mul(u[1],v[0]))];
    check(cross.some(value=>value.n!==0n),'COLLAPSE','Float32 quantization collapsed an original triangle exactly');
    const pa=vertexLosses[vertexIndices[0]].float32PointMM,pb=vertexLosses[vertexIndices[1]].float32PointMM,pc=vertexLosses[vertexIndices[2]].float32PointMM;
    const du=pa.map((value,axis)=>finite(pb[axis]-value,'NORMAL')) as Point,dv=pa.map((value,axis)=>finite(pc[axis]-value,'NORMAL')) as Point;
    const approximateCross:Point=[finite(finite(du[1]*dv[2],'NORMAL')-finite(du[2]*dv[1],'NORMAL'),'NORMAL'),finite(finite(du[2]*dv[0],'NORMAL')-finite(du[0]*dv[2],'NORMAL'),'NORMAL'),finite(finite(du[0]*dv[1],'NORMAL')-finite(du[1]*dv[0],'NORMAL'),'NORMAL')];
    const length=finite(Math.hypot(...approximateCross),'NORMAL');
    check(length>0,'NORMAL','Approximate quantized triangle normal must have nonzero finite length');
    const normal=approximateCross.map(value=>{const component=finite(value/length,'NORMAL');counts.normalFloat32RoundCount++;return finite(Math.fround(component),'NORMAL')}) as Point;
    const unitResidual=finite(Math.abs(finite(Math.hypot(...normal),'NORMAL')-1),'NORMAL');
    check(unitResidual<=1e-5,'NORMAL','Encoded Float32 normal must be unit within1e-5');
    counts.normalAlignmentCount++;
    const alignment=add(add(mul(cross[0],from(normal[0])),mul(cross[1],from(normal[1]))),mul(cross[2],from(normal[2])));
    check(alignment.n>0n,'NORMAL','Encoded approximate normal must have a strictly positive exact dot with the quantized cross');
    facets.push({triangleIndex:index,faceId:triangle.faceId,vertexIndices,byteOffset:84+50*index,normal,unitResidual,exactCross:cross.map(value=>q.text(value)) as QualifiedStlFacet['exactCross'],exactNormalDotCross:q.text(alignment),attributeByteCount:0});
  }
  callbacks.retainPhase({vertexLosses,facets,bytes:null});
  // Fraction serialization is also guarded before any binary bytes are allocated.
  const maximumSquaredDisplacementMM2=q.text(maximumSquared);
  callbacks.beginEncoding();
  const storage=new ArrayBuffer(byteLength),view=new DataView(storage);
  for(let index=0;index<80;index++){view.setUint8(index,index<HEADER.length?HEADER.charCodeAt(index):0);counts.encodedByteCount++}
  view.setUint32(80,triangleCount,true);counts.encodedByteCount+=4;
  for(const facet of facets){
    let offset=facet.byteOffset;
    const points=[facet.normal,...facet.vertexIndices.map(index=>vertexLosses[index].float32PointMM)];
    for(const point of points)for(let axis=0;axis<3;axis++){view.setFloat32(offset,point[axis],true);offset+=4;counts.encodedFloat32Count++;counts.encodedByteCount+=4}
    view.setUint16(offset,0,true);counts.encodedAttributeCount++;counts.encodedByteCount+=2;
  }
  check(counts.encodedByteCount===byteLength&&counts.encodedFloat32Count===12*triangleCount&&counts.encodedAttributeCount===triangleCount,'BUDGET','Actual binary writes must equal the exact frozen facet schedule');
  const bytes=Array.from(new Uint8Array(storage));
  callbacks.retainPhase({vertexLosses,facets,bytes});
  return {bytes,vertexLosses,facets,maximumSquaredDisplacementMM2,maximumMeasuredDisplacementMM};
}
