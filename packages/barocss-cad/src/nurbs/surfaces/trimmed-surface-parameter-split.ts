import { arrangementRegionsExact, exactPoint2FromXY, type ExactPoint2 } from '../../brep/planar-arrangement.js';
import { evaluateSurface } from '../../core/math.js';
import { CadNumericPolicy } from '../../numeric-policy.js';
import type { SectionFraction, SectionRational } from '../../section-rational-internal.js';
import type { Surface } from '../../types.js';
import type { SurfaceAxisTrimLoop, OwnedSurfaceAxisTrimLoop } from './trimmed-surface-axis-reversal.js';
import { splitSurfaceAtParameter, type SurfaceParameterSplitOptions, type SurfaceParameterSplitResult } from './surface-parameter-split.js';
import { splitAffineFrame, splitChildBinding, splitRational, type SplitChildBindingProof } from './trimmed-surface-split-binding.js';
import { canonicalRing, compareRings, compareRingRelations, coordinateCompare, pointInRing, pointKey, ringArea2, simpleRing, uvRing, type SplitTopologyWork, type SplitUV } from './trimmed-surface-split-topology.js';
import { splitCheck, TrimmedSurfaceParameterSplitError } from './trimmed-surface-split-common.js';
export { TrimmedSurfaceParameterSplitError } from './trimmed-surface-split-common.js';
export type { TrimmedSurfaceParameterSplitDiagnosticCode } from './trimmed-surface-split-common.js';

export interface TrimmedSurfaceSplitComponent {
  side: 'lower'|'upper'; surfaceId: string; componentIndex: number; trimLoops: OwnedSurfaceAxisTrimLoop[];
}
type RationalWork = ReturnType<ReturnType<typeof splitRational>['counts']>;
export interface TrimmedSurfaceSplitReport {
  family: 'affine-plane-single-stored-trim-loop-parameter-split';
  axis: 'u'|'v'; inputKeep: 'inside'|'outside'; inputPointCount: number;
  componentCounts: {lower:number;upper:number};
  originalMaterialAreaUV: SectionFraction; selectedMaterialAreaUV: SectionFraction;
  maximumUVRoundingBound: number; maximumWorldBoundaryBound: number; maximumNativePointDifference: number;
  usedChildren: {lower:SplitChildBindingProof|null;upper:SplitChildBindingProof|null};
  work: {arrangement:ReturnType<typeof arrangementRegionsExact>['counts'];topology:SplitTopologyWork;materialArithmetic:RationalWork;bindingArithmetic:RationalWork};
  limits: {maximumInputPoints:160;maximumSegments:165;maximumPairTests:13530;maximumVertices:326;maximumEdges:651;maximumBoundaryOccurrences:1302;maximumComponents:434;maximumRationalOperations:200000;maximumRationalBits:8192};
  quality: {uvComparison:1e-7;linearComparison:1e-7;chartPolicy:typeof CadNumericPolicy.chartParameters;
    materialComposition:'one-object-per-interior-component-inside-outer-and-outside-holes';
    emptyChild:'no-component';childRegularity:'strict-positive-projected-bilinear-Jacobian-and-convex-boundary';
    worldBoundary:'whole-child-coefficient-bound-plus-affine-UV-rounding';
    genericSurfaceEmbeddingCertified:false;globalBinary64EvaluatorErrorCertified:false;solid:false;parentReportUnchanged:true};
}
export interface TrimmedSurfaceParameterSplitResult extends SurfaceParameterSplitResult {
  components: TrimmedSurfaceSplitComponent[]; trimSplit: TrimmedSurfaceSplitReport;
}
function own(value: unknown, fields: readonly string[]|number): PropertyDescriptorMap {
  splitCheck(value!==null&&typeof value==='object','INPUT','plain own trim data required');
  const array=typeof fields==='number',prototype=Object.getPrototypeOf(value);
  splitCheck(array?Array.isArray(value)&&prototype===Array.prototype:!Array.isArray(value)&&(prototype===Object.prototype||prototype===null),'INPUT','plain own trim data required');
  const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(value);
  splitCheck(keys.length===(array?fields+1:fields.length),'INPUT','exact dense trim fields required');
  for(const key of keys)splitCheck(typeof key==='string'&&'value' in descriptors[key]&&(array&&key==='length'||descriptors[key].enumerable===true),'INPUT','trim accessors, symbols and hidden fields refused');
  if(array){splitCheck(descriptors.length.value===fields,'INPUT','trim array length differs');for(let i=0;i<fields;i++)splitCheck(Object.hasOwn(descriptors,String(i)),'INPUT','dense trim data required');}
  else for(const key of fields)splitCheck(Object.hasOwn(descriptors,key),'INPUT','exact trim fields required');
  return descriptors;
}
function copyLoop(input: readonly SurfaceAxisTrimLoop[],domain: SurfaceParameterSplitResult['report']['domains']['original']): OwnedSurfaceAxisTrimLoop {
  const list=own(input,1),data=own(list['0'].value,['keep','uv']),keep=data.keep.value,points=data.uv.value;
  splitCheck(keep==='inside'||keep==='outside','INPUT','trim keep must be inside or outside');
  splitCheck(Array.isArray(points),'INPUT','trim UV array required');
  const length=Object.getOwnPropertyDescriptor(points,'length')?.value;
  splitCheck(Number.isInteger(length)&&length>=3&&length<=160,'BUDGET','one stored trim loop with3..160 points required');
  const values=own(points,length),uv: SplitUV[]=[];
  for(let i=0;i<length;i++){
    const p=own(values[String(i)].value,2),u=p['0'].value,v=p['1'].value;
    splitCheck(typeof u==='number'&&Number.isFinite(u)&&typeof v==='number'&&Number.isFinite(v),'INPUT','finite stored UV coordinates required');
    splitCheck(u>=domain.u[0]&&u<=domain.u[1]&&v>=domain.v[0]&&v<=domain.v[1],'DOMAIN','stored trim point lies outside original domain');uv.push([u,v]);
  }
  return {keep,uv};
}
interface ExactComponent {side:'lower'|'upper';outer:ExactPoint2[];holes:ExactPoint2[][]}
function componentOrder(a: ExactComponent,b: ExactComponent): number {if(a.side!==b.side)return a.side==='lower'?-1:1;return compareRings(a.outer,b.outer);}
function nativeParent(surface: Surface,options: SurfaceParameterSplitOptions): SurfaceParameterSplitResult {
  try{return splitSurfaceAtParameter(surface,options);}catch(cause){throw new TrimmedSurfaceParameterSplitError('NATIVE',cause instanceof Error?cause.message:'native support split refused',cause);}
}
function checkHole(outer: ExactPoint2[],hole: ExactPoint2[],work: SplitTopologyWork): void {
  for(const p of hole)splitCheck(pointInRing(outer,p,work)===1,'TOPOLOGY','material hole must remain strictly inside its outer boundary');
}
/** Split the native support once, then preserve each admitted positive-area material component. */
export function splitTrimmedSurfaceAtParameter(surfaceInput: Surface,trimInput: readonly SurfaceAxisTrimLoop[],options: SurfaceParameterSplitOptions): TrimmedSurfaceParameterSplitResult {
  try{return splitTrimmed(surfaceInput,trimInput,options);}catch(cause){
    if(cause instanceof TrimmedSurfaceParameterSplitError)throw cause;
    const detail=cause instanceof Error?cause.message:'trimmed split failed';
    throw new TrimmedSurfaceParameterSplitError(/BUDGET|budget/.test(detail)?'BUDGET':/REPRESENTABILITY/.test(detail)?'REPRESENTABILITY':'NATIVE',detail,cause);
  }
}
function splitTrimmed(surfaceInput: Surface,trimInput: readonly SurfaceAxisTrimLoop[],options: SurfaceParameterSplitOptions): TrimmedSurfaceParameterSplitResult {
  const parent=nativeParent(surfaceInput,options),q=splitRational(),areaQ=splitRational(),frame=splitAffineFrame(parent.original,q),domain=parent.report.domains.original;
  const loop=copyLoop(trimInput,domain),input=uvRing(loop.uv),work: SplitTopologyWork={vertexPairs:0,edgePairs:0,orientations:0,containmentTests:0};
  simpleRing(input,work);const inputArea=areaQ.abs(ringArea2(input,areaQ));splitCheck(inputArea.n>0n,'TOPOLOGY','stored trim must have positive area');
  const rectangle=[exactPoint2FromXY([domain.u[0],domain.v[0]]),exactPoint2FromXY([domain.u[1],domain.v[0]]),exactPoint2FromXY([domain.u[1],domain.v[1]]),exactPoint2FromXY([domain.u[0],domain.v[1]])];
  const domainArea=areaQ.abs(ringArea2(rectangle,areaQ)),originalArea2=loop.keep==='inside'?inputArea:areaQ.sub(domainArea,inputArea);
  splitCheck(originalArea2.n>0n,'DOMAIN','original stored trim has no positive-area material');
  const axis=parent.report.axis,selected=axis==='u'?0:1,parameter=parent.report.parameter;
  const cutA=exactPoint2FromXY(axis==='u'?[parameter,domain.v[0]]:[domain.u[0],parameter]);
  const cutB=exactPoint2FromXY(axis==='u'?[parameter,domain.v[1]]:[domain.u[1],parameter]);
  const arranged=arrangementRegionsExact([{polygon:0,ring:rectangle},{polygon:1,ring:input}],[[cutA,cutB]],2),counts=arranged.counts;
  splitCheck(counts.segments<=165&&counts.pairTests<=13530&&counts.vertices<=326&&counts.edges<=651&&counts.boundaryOccurrences<=1302,'BUDGET','complete single-loop split arrangement exceeds derived bounds');
  const exact: ExactComponent[]=[];let selectedArea2=areaQ.rat(0n),occurrences=0;
  for(const region of arranged.regions){
    if(region.winding[0]===0||(loop.keep==='inside'?region.winding[1]===0:region.winding[1]!==0))continue;
    const outer=canonicalRing(region.outer,true,areaQ,work),holes: ExactPoint2[][]=[];let regionArea2=ringArea2(outer,areaQ);
    for(const ring of region.holes){const hole=canonicalRing(ring,false,areaQ,work);checkHole(outer,hole,work);holes.push(hole);regionArea2=areaQ.add(regionArea2,ringArea2(hole,areaQ));}
    splitCheck(regionArea2.n>0n,'TOPOLOGY','material component must have strictly positive exact area');
    holes.sort(compareRings);let below=false,above=false;
    for(const ring of [outer,...holes])for(const point of ring){const c=coordinateCompare(point,cutA,selected);if(c<0)below=true;if(c>0)above=true;occurrences++;}
    splitCheck(below!==above,'BINDING','positive-area arrangement component must belong to one child');
    selectedArea2=areaQ.add(selectedArea2,regionArea2);exact.push({side:below?'lower':'upper',outer,holes});
  }
  splitCheck(exact.length>0&&exact.length<=434&&occurrences<=1302,'BUDGET','material split exceeds derived component/boundary capacity');
  splitCheck(areaQ.compare(originalArea2,selectedArea2)===0,'BINDING','exact split material area must conserve the original');exact.sort(componentOrder);
  const used={lower:false,upper:false};for(const component of exact)used[component.side]=true;
  const proofs: {lower:SplitChildBindingProof|null;upper:SplitChildBindingProof|null}={lower:null,upper:null};
  const bounds: {lower:SectionRational;upper:SectionRational}={lower:q.rat(0n),upper:q.rat(0n)};
  for(const side of ['lower','upper'] as const)if(used[side]){const binding=splitChildBinding(parent[side],frame,q);proofs[side]=binding.proof;bounds[side]=binding.bound;splitCheck(q.upward(binding.bound)<=CadNumericPolicy.linearTolerance,'BINDING','whole used-child coefficient position bound exceeds linear policy');}
  const stored=new Map<string,SplitUV>(),reverse=new Map<string,string>();
  for(let i=0;i<input.length;i++)stored.set(pointKey(input[i]),[loop.uv[i][0],loop.uv[i][1]]);
  for(const p of rectangle){const u=q.nearest(q.rat(p.x,p.w)),v=q.nearest(q.rat(p.y,p.w));stored.set(pointKey(p),[u,v]);}
  let maximumUVRoundingBound=0,maximumWorldBoundaryBound=0,maximumNativePointDifference=0;
  const components: TrimmedSurfaceSplitComponent[]=[],exactRings: ExactPoint2[][]=[],roundedRings: ExactPoint2[][]=[];
  const componentCounts={lower:0,upper:0};
  for(const component of exact){
    const trimLoops: OwnedSurfaceAxisTrimLoop[]=[];
    for(const ring of [component.outer,...component.holes]){
      const uv: SplitUV[]=[];
      for(const point of ring){
        const key=pointKey(point),x=q.rat(point.x,point.w),y=q.rat(point.y,point.w);let mapped=stored.get(key);
        if(!mapped){mapped=[q.nearest(x),q.nearest(y)];if(coordinateCompare(point,cutA,selected)===0)mapped[selected]=parameter;stored.set(key,mapped);}
        const childDomain=parent.report.domains[component.side];
        splitCheck(Number.isFinite(mapped[0])&&Number.isFinite(mapped[1])&&mapped[0]>=childDomain.u[0]&&mapped[0]<=childDomain.u[1]&&mapped[1]>=childDomain.v[0]&&mapped[1]<=childDomain.v[1],'REPRESENTABILITY','rounded material vertex lies outside finite child domain');
        const roundedKey=`${mapped[0]}/${mapped[1]}`,prior=reverse.get(roundedKey);splitCheck(prior===undefined||prior===key,'TOPOLOGY','distinct exact material vertices collapse after rounding');reverse.set(roundedKey,key);
        const du=q.abs(q.sub(q.from(mapped[0]),x)),dv=q.abs(q.sub(q.from(mapped[1]),y));
        const chart=q.upward(q.max(du,dv)),world=q.upward(q.add(bounds[component.side],q.add(q.mul(du,frame.scaleU),q.mul(dv,frame.scaleV))));
        splitCheck(chart<=CadNumericPolicy.uvBindingTolerance&&world<=CadNumericPolicy.linearTolerance,'BINDING','joint used-child and UV-rounding displacement exceeds original policy');
        maximumUVRoundingBound=Math.max(maximumUVRoundingBound,chart);maximumWorldBoundaryBound=Math.max(maximumWorldBoundaryBound,world);
        const a=evaluateSurface(parent.original,mapped[0],mapped[1]),b=evaluateSurface(parent[component.side],mapped[0],mapped[1]),difference=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
        splitCheck(Number.isFinite(difference)&&difference<=CadNumericPolicy.linearTolerance,'BINDING','actual stored-parameter native child/original comparison exceeds linear policy');maximumNativePointDifference=Math.max(maximumNativePointDifference,difference);
        uv.push([mapped[0],mapped[1]]);
      }
      const rounded=uvRing(uv);simpleRing(rounded,work);
      splitCheck((ringArea2(ring,areaQ).n>0n)===(ringArea2(rounded,areaQ).n>0n),'TOPOLOGY','rounded material winding changes');
      exactRings.push(ring);roundedRings.push(rounded);trimLoops.push({keep:trimLoops.length===0?'inside':'outside',uv});
    }
    components.push({side:component.side,surfaceId:parent[component.side].id,componentIndex:componentCounts[component.side]++,trimLoops});
  }
  compareRingRelations(exactRings,roundedRings,work);
  const trimSplit: TrimmedSurfaceSplitReport={family:'affine-plane-single-stored-trim-loop-parameter-split',axis,inputKeep:loop.keep,inputPointCount:loop.uv.length,componentCounts,
    originalMaterialAreaUV:areaQ.text(areaQ.div(originalArea2,areaQ.rat(2n))),selectedMaterialAreaUV:areaQ.text(areaQ.div(selectedArea2,areaQ.rat(2n))),
    maximumUVRoundingBound,maximumWorldBoundaryBound,maximumNativePointDifference,usedChildren:proofs,
    work:{arrangement:counts,topology:work,materialArithmetic:areaQ.counts(),bindingArithmetic:q.counts()},
    limits:{maximumInputPoints:160,maximumSegments:165,maximumPairTests:13530,maximumVertices:326,maximumEdges:651,maximumBoundaryOccurrences:1302,maximumComponents:434,maximumRationalOperations:200000,maximumRationalBits:8192},
    quality:{uvComparison:1e-7,linearComparison:1e-7,chartPolicy:CadNumericPolicy.chartParameters,materialComposition:'one-object-per-interior-component-inside-outer-and-outside-holes',emptyChild:'no-component',childRegularity:'strict-positive-projected-bilinear-Jacobian-and-convex-boundary',worldBoundary:'whole-child-coefficient-bound-plus-affine-UV-rounding',genericSurfaceEmbeddingCertified:false,globalBinary64EvaluatorErrorCertified:false,solid:false,parentReportUnchanged:true}};
  return {...parent,components,trimSplit};
}
