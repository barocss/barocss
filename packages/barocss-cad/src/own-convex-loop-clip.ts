import { CadNumericPolicy } from './numeric-policy.js';
import { admitConvexNativeLineLoop } from './own-affine-plane-loop-internal.js';
import { validateCurve, curveDomain, evaluateCurve, evaluateSurface } from './math.js';
import { evaluateCurveD1 } from './derivatives.js';
import { splitCurveAtParameter } from './curve-parameter-split.js';
import type { CurveParameterSplitProvenance } from './curve-parameter-split.js';
import { intersectCoplanarCurveWithLineSegment } from './own-curve-line-intersection.js';
import type { CoplanarCurveLineIntersectionResult, CurveLinePointEvent, CurveLineOverlapContact, CurveLineBinding } from './own-curve-line-intersection.js';
import type { PlaneClipUVSplitProvenance } from './own-coincident-plane-clip.js';
import type { CurveAffinePlaneAxes, CurvePlaneD1State } from './own-curve-plane-intersection.js';
import { compileCadModel } from './model-compiler.js';
import { curveDecimal } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Surface, Model, Point } from './types.js';

export interface ConvexNativeLineLoop { id:string;edges:Curve[] }
export interface ConvexLineLoopClipOptions { evaluationId:string;resultIdPrefix:string }
export type ConvexLoopUVSplitProvenance=PlaneClipUVSplitProvenance;
export interface ConvexLoopContactContribution {
  edgeId:string;edgeIndex:number;kind:'point-event'|'overlap-contact'|'overlap-end';parameter:number;brackets:[number,number][];
  evidence:CurveLinePointEvent|CurveLineOverlapContact|CurveLineBinding;overlapId:string|null;
}
export interface ConvexLoopClipContact {
  contactId:string;parameter:number;pointMM:Point;planeUV:Point;loopDomainAdmitted:boolean;
  halfspaces:number[];originalCurveD1:CurvePlaneD1State;contributions:ConvexLoopContactContribution[];
}
export interface ConvexLoopClipSpan {spanId:string;originalDerivedSpanId:string;domain:[number,number];curve:Curve;uvCurve:Curve;coordinateSystem:'uv'}
export interface ConvexLoopEndpointApproximation {
  parameter:number;rootEstimates:number[];parameterOffsets:number[];brackets:[number,number][];halfspaces:number[];
  policy:'represented-inward-contact-bracket-endpoint';
}
export interface ConvexLoopBoundaryBinding {
  edgeId:string;edgeIndex:number;overlapId:string;lineDomain:[number,number];lineRange:[number,number];orientation:'forward'|'reverse';
  derivativeNumeratorBernstein:number[];observations:CurveLineBinding[];
}
export interface ConvexLoopPieceObservation {
  parameter:number;originalPointMM:Point;piecePointMM:Point;planeUV:Point;originalPlaneUV:Point;planePointMM:Point;
  originalPieceDifferenceMM:number;surfaceBindingDifferenceMM:number;dimensionlessBindingDifference:number;halfspaces:number[];
  originalCurveD1:CurvePlaneD1State;pieceCurveD1:CurvePlaneD1State;
}
export interface ConvexLoopClipPiece {
  pieceId:string;spanId:string;domain:[number,number];classification:'interior'|'boundary';curve:Curve;uvCurve:Curve;coordinateSystem:'uv';
  orientation:'ccw'|'cw';boundaryBindings:ConvexLoopBoundaryBinding[];bindings:ConvexLoopPieceObservation[];
  endpointApproximations:[ConvexLoopEndpointApproximation|null,ConvexLoopEndpointApproximation|null];
  provenance:{xyz:CurveParameterSplitProvenance[];uv:ConvexLoopUVSplitProvenance[]};source:string;sourceVersion:0;model:Model;
}
export interface ConvexLineLoopClipReport {
  family:'own-curve-convex-native-line-loop-clip';kind:ConvexLineLoopClipResult['kind'];evaluationId:string;loopId:string;curveId:string;planeId:string;
  orientation:'ccw'|'cw';edgeCount:number;spanCount:number;contactCount:number;pieceCount:number;boundaryPieceCount:number;
  contributionCount:number;outsideIntervalCount:number;isolatedContactIds:string[];authority:'original-curve-native-lines-and-plane';
  geometricValidity:'not-certified';topologyCertified:false;solid:false;
  numericPolicy:{exactParameterDedupOnly:true;pointBindingComparisonMM:1e-7;convexityProof:'every-nonadjacent-vertex-strict-directed-halfspace';
    convexityUnsafeThreshold:'64-epsilon-scaled-determinant';uvBindingUnits:'dimensionless-not-mm-source';parameterWidthTarget:1e-12;maximumRootSteps:64};
  limits:{maximumEdges:8;maximumSpans:8;maximumContacts:128;maximumPieces:128;maximumContributions:256;maximumTemporaryPoles:16;
    snapshotValues:262144;snapshotDepth:28;arrayElements:2048;recordFields:48;resultIdPrefixCharacters:20};
}
export interface ConvexLineLoopClipResult {
  kind:'pieces'|'boundary-pieces'|'mixed'|'isolated-contacts'|'disjoint';curve:Curve;loop:ConvexNativeLineLoop;plane:Surface;options:ConvexLineLoopClipOptions;
  source:string;sourceVersion:0;model:Model;orientation:'ccw'|'cw';verticesUV:Point[];
  convexityEvidence:{edgeIndex:number;vertexIndex:number;determinant:number;unsafeThreshold:number}[];
  edgeResults:CoplanarCurveLineIntersectionResult[];spans:ConvexLoopClipSpan[];contacts:ConvexLoopClipContact[];pieces:ConvexLoopClipPiece[];
  outsideIntervals:{spanId:string;domain:[number,number];midpoint:number;halfspaces:number[]}[];report:ConvexLineLoopClipReport;
}
const LABEL='Own convex native Line loop clip',TOL=CadNumericPolicy.linearToleranceMM;
function check(c:boolean,detail:string):asserts c {if(!c)throw new Error((LABEL+': '+detail).slice(0,1024));}
function finite(n:number):number {check(Number.isFinite(n),'finite native homogeneous/Gram arithmetic required');return n;}
function snapshot(input:unknown,results=false):unknown {
  let budget=results?262144:4096;const copy=(v:unknown,depth:number):unknown=>{check(--budget>=0&&depth<=(results?28:8),'own-data values/depth bound');if(v===null&&results)return null;if(typeof v==='number'){check(Number.isFinite(v),'finite own numbers');return v;}if(typeof v==='string'){check(v.length<=(results?262144:128),'bounded own string');return v;}if(typeof v==='boolean'&&results)return v;check(v!==null&&typeof v==='object','plain own data');const array=Array.isArray(v),proto=Object.getPrototypeOf(v),keys=Reflect.ownKeys(v),descriptors=Object.getOwnPropertyDescriptors(v);check(array?proto===Array.prototype:proto===Object.prototype||proto===null,'foreign own-data prototype');check(keys.length<=(array?(results?2049:65):(results?48:16))&&keys.every(k=>typeof k==='string'&&k.length<=128&&'value'in descriptors[k]&&(array&&k==='length'||descriptors[k].enumerable===true)),'getter/symbol/hidden/excess own data');if(array){const n=descriptors.length.value as number;check(Number.isInteger(n)&&n>=0&&n<=(results?2048:64)&&keys.length===n+1,'dense bounded own array');return Array.from({length:n},(_,i)=>{check(Object.hasOwn(descriptors,String(i)),'sparse own array');return copy(descriptors[String(i)].value,depth+1);});}return Object.fromEntries((keys as string[]).map(k=>[k,copy(descriptors[k].value,depth+1)]));};return copy(input,0);
}
function record(v:unknown,keys:string[]):Record<string,unknown>{check(v!==null&&typeof v==='object'&&!Array.isArray(v),'own record');const r=v as Record<string,unknown>;check(Object.keys(r).length===keys.length&&keys.every(k=>Object.hasOwn(r,k)),'exact fields required: '+keys.join(','));return r;}
function id(v:unknown):string {check(typeof v==='string'&&v.length<=48&&/^[A-Za-z_][A-Za-z0-9_-]*$/.test(v),'ASCII ID1..48 required');return v;}
function same(a:unknown,b:unknown):boolean {if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>same(x,b[i]));if(a&&b&&typeof a==='object'&&typeof b==='object'){const x=a as Record<string,unknown>,y=b as Record<string,unknown>;return Object.keys(x).length===Object.keys(y).length&&Object.keys(x).every(k=>Object.hasOwn(y,k)&&same(x[k],y[k]));}return Object.is(a,b);}
function delta(a:Point,b:Point):Point{return a.map((x,i)=>finite(x-b[i])) as Point;}
function dot(a:Point,b:Point):number{return finite(a.reduce((s,x,i)=>{const product=finite(x*b[i]);check(x===0||b[i]===0||product!==0,'nonzero native dot-product term underflowed to zero');return finite(s+product);},0));}
function mapParameter(d:[number,number],t:number):number {if(t===0)return d[0];if(t===1)return d[1];return finite(d[0]+(d[1]-d[0])*t);}
function inRectangle(uv:Point,axes:CurveAffinePlaneAxes):boolean{return uv[2]===0&&uv[0]>=axes.domains.u[0]&&uv[0]<=axes.domains.u[1]&&uv[1]>=axes.domains.v[0]&&uv[1]<=axes.domains.v[1];}
function uvOf(point:Point,axes:CurveAffinePlaneAxes):Point {
  const d=delta(point,axes.originMM),du=dot(d,axes.uDirectionMM),dv=dot(d,axes.vDirectionMM),g=axes.gram;
  const u=finite(finite(du*g.vv-dv*g.uv)/g.determinant),v=finite(finite(dv*g.uu-du*g.uv)/g.determinant);
  return[mapParameter(axes.domains.u,u),mapParameter(axes.domains.v,v),0];
}
function d1(curve:Curve,t:number):CurvePlaneD1State {try{return{status:'evaluated',value:evaluateCurveD1(curve,t)};}catch(e){return{status:'native-refused',reason:(e instanceof Error?e.message:'original native D1 refused').slice(0,1024)};}}
function restrict(curve:Curve,domain:[number,number],outputId:string,temporary:()=>string):{curve:Curve;provenance:CurveParameterSplitProvenance[]} {
  let current=copyCadData(curve);const provenance:CurveParameterSplitProvenance[]=[];
  if(domain[0]>curveDomain(current)[0]){const split=splitCurveAtParameter(current,{parameter:domain[0],lowerCurveId:temporary(),upperCurveId:temporary()});check(split.refined.controlPoints.length<=16,'inherited temporary pole bound');provenance.push(split.provenance);current=split.upper;}
  if(domain[1]<curveDomain(current)[1]){const split=splitCurveAtParameter(current,{parameter:domain[1],lowerCurveId:temporary(),upperCurveId:temporary()});check(split.refined.controlPoints.length<=16,'inherited temporary pole bound');provenance.push(split.provenance);current=split.lower;}
  current.id=outputId;check(same(curveDomain(current),domain),'actual restriction must retain the represented interval bits');validateCurve(current);return{curve:current,provenance};
}
function uvProvenance(provenance:CurveParameterSplitProvenance[]):ConvexLoopUVSplitProvenance[] {
  // Retain coefficient maps only. The inherited splitter's temporary mm source/report is not UV authority.
  return provenance.map(p=>({sourceCurveId:p.sourceCurveId,parameter:p.parameter,firstRefinedKnotIndex:p.firstRefinedKnotIndex,
    refinement:{kind:p.refinement.kind,insertions:p.refinement.insertions},lower:p.lower,upper:p.upper,
    shared:{refinedPoleIndex:p.shared.refinedPoleIndex,lowerPoleIndex:p.shared.lowerPoleIndex,upperPoleIndex:p.shared.upperPoleIndex,pointUV:p.shared.pointMM,weight:p.shared.weight}}));
}


function multiply(a:number,b:number):number {const value=finite(a*b);check(a===0||b===0||value!==0,'nonzero determinant product underflowed to zero');return value;}
function determinant(direction:Point,relative:Point):{value:number;threshold:number} {
  const a=multiply(direction[0],relative[1]),b=multiply(direction[1],relative[0]);return{value:finite(a-b),threshold:finite(64*Number.EPSILON*finite(Math.abs(a)+Math.abs(b)))};
}
function adopt(curve:Curve,edges:Curve[],plane:Surface,name:string):{source:string;model:Model} {
  const dec=(n:number)=>curveDecimal(n,LABEL),list=(a:number[])=>'['+a.map(dec).join(',')+']',poles=(a:Point[])=>'['+a.map(list).join(',')+']';
  const source='@model '+name+' { version:0; length-unit:mm; '+[curve,...edges].map(c=>'@curve #'+c.id+' { type:nurbs; degree:'+dec(c.degree)+'; knots:'+list(c.knots)+'; control-points:'+poles(c.controlPoints)+'; weights:'+list(c.weights)+'; } ').join('')+'@surface #'+plane.id+' { type:nurbs; degree-u:1; degree-v:1; knots-u:'+list(plane.knotsU)+'; knots-v:'+list(plane.knotsV)+'; control-points:['+plane.controlPoints.map(poles).join(',')+']; weights:['+plane.weights.map(list).join(',')+']; } }\n';
  check(source.length<=262144,'actual source bound');const compiled=compileCadModel(source,{sourceVersion:0});check(compiled.ok,'actual native geometry source0 compilation required');check(same(compiled.model,{name,version:0,lengthUnit:'mm',objects:[curve,...edges,plane]}),'complete original/piece source coefficient/ID/domain/sign adoption');return{source,model:compiled.model};
}
/** Actual finite Line intersections plus strict convex halfspaces; no arbitrary trimmed topology. */
export function clipCurveWithConvexLineLoop(curveInput:Curve,loopInput:ConvexNativeLineLoop,planeInput:Surface,inputOptions:ConvexLineLoopClipOptions):ConvexLineLoopClipResult {
  const curveData=snapshot(curveInput),loopData=snapshot(loopInput),planeData=snapshot(planeInput),optionData=snapshot(inputOptions);
  const c=record(curveData,['kind','id','degree','knots','controlPoints','weights']) as unknown as Curve,p=record(planeData,['kind','id','degreeU','degreeV','knotsU','knotsV','controlPoints','weights']) as unknown as Surface,lr=record(loopData,['id','edges']),o=record(optionData,['evaluationId','resultIdPrefix']);
  const loopId=id(lr.id);check(Array.isArray(lr.edges)&&lr.edges.length>=3&&lr.edges.length<=8,'3..8 ordered native Line edges required');
  const edges=lr.edges.map(value=>record(value,['kind','id','degree','knots','controlPoints','weights']) as unknown as Curve),loop:ConvexNativeLineLoop={id:loopId,edges};
  id(c.id);id(p.id);validateCurve(c);check(c.kind==='curve'&&(c.degree===1||c.degree===2)&&c.controlPoints.length<=12,'original degree1/2 Curve with at most12 poles required');
  for(const edge of edges){id(edge.id);validateCurve(edge);check(edge.kind==='curve'&&edge.degree===1&&edge.controlPoints.length===2&&edge.knots.length===4&&Object.is(edge.weights[0],edge.weights[1]),'actual equal-weight two-pole native Line required');check(edge.controlPoints[0].some((value,i)=>value!==edge.controlPoints[1][i]),'nondegenerate native edge required');}
  for(let i=0;i<edges.length;i++)check(edges[i].controlPoints[1].every((value,j)=>Object.is(value,edges[(i+1)%edges.length].controlPoints[0][j])),'original Line endpoint closure must preserve represented XYZ bits');
  const domain=curveDomain(c),breaks=[domain[0]];for(const knot of c.knots)if(knot>domain[0]&&knot<domain[1]&&!breaks.some(value=>value===knot))breaks.push(knot);breaks.push(domain[1]);check(breaks.length<=9,'at most8 original spans required');
  check(typeof o.resultIdPrefix==='string'&&o.resultIdPrefix.length<=20&&/^[A-Za-z_][A-Za-z0-9_-]*$/.test(o.resultIdPrefix),'ASCII result prefix1..20 required');
  const options:ConvexLineLoopClipOptions={evaluationId:id(o.evaluationId),resultIdPrefix:o.resultIdPrefix},prefix=options.resultIdPrefix,originalIds=[c.id,p.id,loopId,options.evaluationId,...edges.map(edge=>edge.id)];check(new Set(originalIds).size===originalIds.length,'original geometry/loop/evaluation identities must be distinct');
  const expanded:string[]=[];const role=(suffix:string):string=>id(prefix+suffix);
  for(let i=0;i<breaks.length-1;i++)expanded.push(role('_s'+i),role('_u'+i));
  for(let edge=0;edge<edges.length;edge++){
    expanded.push(role('_e'+edge+'_eval'));for(let i=0;i<breaks.length-1;i++)expanded.push(role('_e'+edge+'_s'+i),role('_e'+edge+'_u'+i));
    for(let i=0;i<16;i++)expanded.push(role('_e'+edge+'_p'+i));for(let i=0;i<32;i++)expanded.push(role('_e'+edge+'_o'+i),role('_e'+edge+'_b'+i));for(let i=0;i<64;i++)expanded.push(role('_e'+edge+'_c'+i));
  }
  for(let i=0;i<128;i++)expanded.push(role('_c'+i),role('_p'+i),role('_b'+i));
  const reserved=new Set([...originalIds,...expanded]);check(reserved.size===originalIds.length+expanded.length,'expanded deterministic role IDs collide before native staging');
  let serial=0;const temporary=():string=>{let value:string;do{check(++serial<=2048,'bounded temporary source/split context');value=role('_t'+serial);}while(reserved.has(value));reserved.add(value);return value;};
  const edgeResults=edges.map((edge,index)=>intersectCoplanarCurveWithLineSegment(c,edge,p,{evaluationId:role('_e'+index+'_eval'),derivedSpanIds:Array.from({length:breaks.length-1},(_,i)=>role('_e'+index+'_s'+i)),spanBindingIds:Array.from({length:breaks.length-1},(_,i)=>role('_e'+index+'_u'+i)),pointEventIds:Array.from({length:16},(_,i)=>role('_e'+index+'_p'+i)),overlapIds:Array.from({length:32},(_,i)=>role('_e'+index+'_o'+i)),overlapBindingIds:Array.from({length:32},(_,i)=>role('_e'+index+'_b'+i)),boundaryContactIds:Array.from({length:64},(_,i)=>role('_e'+index+'_c'+i))}));
  const axes=edgeResults[0].report.planeAxes;check(edgeResults.every(result=>same(result.report.planeAxes,axes)),'all native edges must bind the same actual Plane axes');
  const {verticesUV,orientation,convexityEvidence}=admitConvexNativeLineLoop(edges,axes,LABEL,p),sign=orientation==='ccw'?1:-1;
  const halfspaces=(uv:Point):number[]=>verticesUV.map((vertex,i)=>finite(sign*determinant(delta(verticesUV[(i+1)%verticesUV.length],vertex),delta(uv,vertex)).value));
  const admitted=(uv:Point):boolean=>inRectangle(uv,axes)&&halfspaces(uv).every(value=>value>=0);
  const spans:ConvexLoopClipSpan[]=edgeResults[0].parent.spans.map((span,index)=>{const curve=copyCadData(span.curve);curve.id=role('_s'+index);const uvCurve:Curve={kind:'curve',id:role('_u'+index),degree:curve.degree,knots:copyCadData(curve.knots),weights:copyCadData(curve.weights),controlPoints:curve.controlPoints.map(point=>uvOf(point,axes))};validateCurve(curve);validateCurve(uvCurve);return{spanId:curve.id,originalDerivedSpanId:span.spanId,domain:span.domain,curve,uvCurve,coordinateSystem:'uv'};});
  const contactGroups:{parameter:number;contributions:ConvexLoopContactContribution[]}[]=[];let contributionCount=0;
  const add=(contribution:ConvexLoopContactContribution):void=>{check(++contributionCount<=256,'aggregate finite boundary contribution capacity exceeded');let group=contactGroups.find(item=>item.parameter===contribution.parameter);if(!group){group={parameter:contribution.parameter,contributions:[]};contactGroups.push(group);}group.contributions.push(contribution);};
  for(const [edgeIndex,result]of edgeResults.entries()){
    for(const event of result.events)if(event.segmentDomainAdmitted&&event.planeDomainAdmitted)add({edgeId:edges[edgeIndex].id,edgeIndex,kind:'point-event',parameter:event.parameter,brackets:event.contributions.map(c=>c.bracket),evidence:event,overlapId:null});
    for(const contact of result.overlapContacts)if(contact.segmentDomainAdmitted&&contact.planeDomainAdmitted)add({edgeId:edges[edgeIndex].id,edgeIndex,kind:'overlap-contact',parameter:contact.parameter,brackets:contact.contributions.map(c=>c.bracket),evidence:contact,overlapId:null});
    for(const overlap of result.overlaps)for(const end of [0,1] as const){
      const approximation=overlap.endpointApproximations[end],parameter=overlap.domain[end];
      if(approximation!==null&&result.overlapContacts.some(contact=>contact.parameter===approximation.rootEstimate&&contact.segmentDomainAdmitted&&contact.planeDomainAdmitted))continue;
      const evidence=overlap.bindings[end===0?0:overlap.bindings.length-1];add({edgeId:edges[edgeIndex].id,edgeIndex,kind:'overlap-end',parameter,brackets:[[parameter,parameter]],evidence,overlapId:overlap.overlapId});
    }
  }
  contactGroups.sort((a,b)=>a.parameter<b.parameter?-1:a.parameter>b.parameter?1:0);check(contactGroups.length<=128,'aggregate polygon contact capacity exceeded');
  const contacts:ConvexLoopClipContact[]=contactGroups.map((group,index)=>{const pointMM=evaluateCurve(c,group.parameter),planeUV=uvOf(pointMM,axes);return{contactId:role('_c'+index),parameter:group.parameter,pointMM,planeUV,loopDomainAdmitted:admitted(planeUV),halfspaces:halfspaces(planeUV),originalCurveD1:d1(c,group.parameter),contributions:group.contributions};});
  const pieces:ConvexLoopClipPiece[]=[],outsideIntervals:ConvexLineLoopClipResult['outsideIntervals']=[];
  for(const span of spans){
    const partitions:{parameter:number;contact:ConvexLoopClipContact|null}[]=[{parameter:span.domain[0],contact:contacts.find(contact=>contact.parameter===span.domain[0])??null},{parameter:span.domain[1],contact:contacts.find(contact=>contact.parameter===span.domain[1])??null}];
    for(const contact of contacts)if(contact.parameter>span.domain[0]&&contact.parameter<span.domain[1])partitions.push({parameter:contact.parameter,contact});partitions.sort((a,b)=>a.parameter<b.parameter?-1:a.parameter>b.parameter?1:0);
    for(let i=1;i<partitions.length;i++){
      const left=partitions[i-1],right=partitions[i];check(left.parameter<right.parameter,'distinct native polygon contact order unresolved');
      const brackets=(part:typeof left):[number,number][]=>part.contact===null?[]:part.contact.contributions.flatMap(c=>c.brackets);
      const leftBrackets=brackets(left),rightBrackets=brackets(right),low=leftBrackets.length?Math.max(...leftBrackets.map(b=>b[1])):left.parameter,high=rightBrackets.length?Math.min(...rightBrackets.map(b=>b[0])):right.parameter;
      check(low<high,'different native polygon contact brackets overlap; no close merge');
      const mid=finite(left.parameter+finite(right.parameter-left.parameter)/2);check(mid>left.parameter&&mid<right.parameter,'polygon interval midpoint not represented');const midUV=uvOf(evaluateCurve(c,mid),axes);
      if(!admitted(midUV)){outsideIntervals.push({spanId:span.spanId,domain:[left.parameter,right.parameter],midpoint:mid,halfspaces:halfspaces(midUV)});continue;}
      check(low<mid&&mid<high,'inward native brackets leave no represented polygon interval');for(const t of [low,high])check(admitted(uvOf(evaluateCurve(c,t),axes))&&admitted(evaluateCurve(span.uvCurve,t)),'inward original/UV endpoint violates a convex loop halfspace');
      check(pieces.length<128,'aggregate native piece capacity exceeded');const index=pieces.length,pieceDomain:[number,number]=[low,high],xyz=restrict(span.curve,pieceDomain,role('_p'+index),temporary),uv=restrict(span.uvCurve,pieceDomain,role('_b'+index),temporary);
      const bindings:ConvexLoopPieceObservation[]=[low,mid,high].map(parameter=>{const originalPointMM=evaluateCurve(c,parameter),piecePointMM=evaluateCurve(xyz.curve,parameter),planeUV=evaluateCurve(uv.curve,parameter),originalPlaneUV=uvOf(originalPointMM,axes);check(admitted(planeUV)&&admitted(originalPlaneUV),'actual restricted native binding violates a polygon halfspace');const planePointMM=evaluateSurface(p,planeUV[0],planeUV[1]),originalPieceDifferenceMM=finite(Math.hypot(...delta(originalPointMM,piecePointMM))),surfaceBindingDifferenceMM=finite(Math.hypot(...delta(originalPointMM,planePointMM))),dimensionlessBindingDifference=finite(Math.hypot(...delta(originalPlaneUV,planeUV)));check(originalPieceDifferenceMM<=TOL&&surfaceBindingDifferenceMM<=TOL&&dimensionlessBindingDifference<=TOL,'actual original/restricted XYZ/UV/Plane binding exceeds local policy');return{parameter,originalPointMM,piecePointMM,planeUV,originalPlaneUV,planePointMM,originalPieceDifferenceMM,surfaceBindingDifferenceMM,dimensionlessBindingDifference,halfspaces:halfspaces(planeUV),originalCurveD1:d1(c,parameter),pieceCurveD1:d1(xyz.curve,parameter)};});
      const boundaryBindings:ConvexLoopBoundaryBinding[]=[];
      for(const [edgeIndex,result]of edgeResults.entries())for(const overlap of result.overlaps)if(low>=overlap.domain[0]&&high<=overlap.domain[1]){
        const line=edges[edgeIndex],chart=result.report.lineUV,lineDomain=curveDomain(line),monotonicity=result.spans.find(s=>s.spanId===overlap.spanId)?.monotonicity;check(monotonicity!==undefined&&monotonicity!==null,'actual edge overlap monotonicity proof required');
        const observations:CurveLineBinding[]=bindings.map(observation=>{const planeUV=observation.originalPlaneUV,differenceUV=finite(planeUV[chart.dominantAxis]-chart.start[chart.dominantAxis]),s=finite(differenceUV/chart.direction[chart.dominantAxis]),lineParameter=mapParameter(lineDomain,s);check(differenceUV===0||s!==0,'nonzero native edge coordinate underflowed to zero');check(s===0||s===1||lineParameter>lineDomain[0]&&lineParameter<lineDomain[1],'native edge parameter rounded across an endpoint');check(s>=0&&s<=1,'actual boundary overlap Line coordinate outside native domain');const linePointMM=evaluateCurve(line,lineParameter),difference=finite(Math.hypot(...delta(observation.originalPointMM,linePointMM)));check(difference<=TOL,'actual original polygon piece/edge Line binding exceeds local policy');return{parameter:observation.parameter,pointMM:observation.originalPointMM,planeUV,lineCoordinate:s,lineParameter,segmentDomainAdmitted:true,planeDomainAdmitted:true,linePointMM,planePointMM:observation.planePointMM,lineBindingDifferenceMM:difference,surfaceBindingDifferenceMM:observation.surfaceBindingDifferenceMM,dimensionlessSupportResidual:Math.abs(determinant(chart.direction,delta(planeUV,chart.start)).value),originalCurveD1:observation.originalCurveD1,lineD1:d1(line,lineParameter)};});
        check(overlap.orientation==='forward'?observations[0].lineParameter<observations[observations.length-1].lineParameter:observations[0].lineParameter>observations[observations.length-1].lineParameter,'inherited boundary overlap orientation not represented in original Line domain');
        boundaryBindings.push({edgeId:line.id,edgeIndex,overlapId:overlap.overlapId,lineDomain,lineRange:[observations[0].lineParameter,observations[observations.length-1].lineParameter],orientation:overlap.orientation,derivativeNumeratorBernstein:monotonicity.derivativeNumeratorBernstein,observations});
      }
      const approximation=(part:typeof left,t:number):ConvexLoopEndpointApproximation|null=>part.contact===null?null:{parameter:t,rootEstimates:part.contact.contributions.map(c=>c.parameter),parameterOffsets:part.contact.contributions.map(c=>finite(t-c.parameter)),brackets:brackets(part),halfspaces:halfspaces(uvOf(evaluateCurve(c,t),axes)),policy:'represented-inward-contact-bracket-endpoint'};
      const relevantEdges=edges.filter((_,i)=>boundaryBindings.some(binding=>binding.edgeIndex===i)),file=adopt(xyz.curve,relevantEdges,p,temporary());pieces.push({pieceId:xyz.curve.id,spanId:span.spanId,domain:pieceDomain,classification:boundaryBindings.length?'boundary':'interior',curve:file.model.objects[0] as Curve,uvCurve:uv.curve,coordinateSystem:'uv',orientation,boundaryBindings,bindings,endpointApproximations:[approximation(left,low),approximation(right,high)],provenance:{xyz:xyz.provenance,uv:uvProvenance(uv.provenance)},...file,sourceVersion:0});
    }
  }
  const isolatedContactIds=contacts.filter(contact=>contact.loopDomainAdmitted&&!pieces.some(piece=>contact.parameter>=Math.min(piece.domain[0],...(piece.endpointApproximations[0]?piece.endpointApproximations[0].rootEstimates:[]))&&contact.parameter<=Math.max(piece.domain[1],...(piece.endpointApproximations[1]?piece.endpointApproximations[1].rootEstimates:[])))).map(contact=>contact.contactId),boundaryPieceCount=pieces.filter(piece=>piece.classification==='boundary').length,kind:ConvexLineLoopClipResult['kind']=pieces.length?isolatedContactIds.length||outsideIntervals.length||boundaryPieceCount>0&&boundaryPieceCount<pieces.length?'mixed':boundaryPieceCount?'boundary-pieces':'pieces':isolatedContactIds.length?'isolated-contacts':'disjoint',file=adopt(c,edges,p,options.evaluationId);
  const result:ConvexLineLoopClipResult=copyCadData({kind,curve:file.model.objects[0] as Curve,loop,plane:file.model.objects[file.model.objects.length-1] as Surface,options,...file,sourceVersion:0,orientation,verticesUV,convexityEvidence,edgeResults,spans,contacts,pieces,outsideIntervals,report:{family:'own-curve-convex-native-line-loop-clip',kind,evaluationId:options.evaluationId,loopId,curveId:c.id,planeId:p.id,orientation,edgeCount:edges.length,spanCount:spans.length,contactCount:contacts.length,pieceCount:pieces.length,boundaryPieceCount,contributionCount,outsideIntervalCount:outsideIntervals.length,isolatedContactIds,authority:'original-curve-native-lines-and-plane',geometricValidity:'not-certified',topologyCertified:false,solid:false,numericPolicy:{exactParameterDedupOnly:true,pointBindingComparisonMM:TOL,convexityProof:'every-nonadjacent-vertex-strict-directed-halfspace',convexityUnsafeThreshold:'64-epsilon-scaled-determinant',uvBindingUnits:'dimensionless-not-mm-source',parameterWidthTarget:1e-12,maximumRootSteps:64},limits:{maximumEdges:8,maximumSpans:8,maximumContacts:128,maximumPieces:128,maximumContributions:256,maximumTemporaryPoles:16,snapshotValues:262144,snapshotDepth:28,arrayElements:2048,recordFields:48,resultIdPrefixCharacters:20}}});
  return snapshot(result,true) as ConvexLineLoopClipResult;
}
/** Original geometry/context rebuild; supplied contact/piece/UV/edge lineage is never adopted. */
export function validateConvexLineLoopClip(input:ConvexLineLoopClipResult):ConvexLineLoopClipReport {
  const owned=snapshot(input,true) as ConvexLineLoopClipResult;check(owned!==null&&typeof owned==='object'&&!Array.isArray(owned),'owned convex loop clip result required');const expected=clipCurveWithConvexLineLoop(owned.curve,owned.loop,owned.plane,owned.options);check(same(owned,expected),'owned original loop/order/UV/contact/interval/edge-binding/lineage/source/report mismatch');return copyCadData(expected.report);
}
