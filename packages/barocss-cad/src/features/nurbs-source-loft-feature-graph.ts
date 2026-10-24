import { editSourceCurveControlPolygon, SourceCurveControlPolygonError } from '../nurbs/source-wide/source-curve-control-polygon.js';
import type { SourceCurveControlPolygonResult } from '../nurbs/source-wide/source-curve-control-polygon.js';
import type { CurveControlPolygonEdits } from '../nurbs/curves/curve-control-polygon.js';
import { buildPiecewiseRationalLoftSurface, PiecewiseRationalLoftError } from './piecewise-rational-loft.js';
import type { PiecewiseRationalLoftOptions, PiecewiseRationalLoftResult } from './piecewise-rational-loft.js';
import { compileCadModel } from '../model-compiler.js';
import { parseCadDocumentOwnJson, cadDocumentOwnUtf8Bytes } from '../cad-document.js';
import type { Model, Curve } from '../types.js';
import { KernelError } from '../core/barocss-error.js';

export const NurbsSourceLoftFeatureGraphDiagnosticCode = Object.freeze({INPUT:'INPUT',VERSION:'VERSION',IDENTITY:'IDENTITY',REVISION:'REVISION',BUDGET:'BUDGET',SOURCE:'SOURCE',REFERENCE:'REFERENCE',DEPENDENCY:'DEPENDENCY',BASIS:'BASIS',STATIONS:'STATIONS',NATIVE:'NATIVE',REPRESENTABILITY:'REPRESENTABILITY',CODEC:'CODEC',OWNED:'OWNED'} as const);
export type NurbsSourceLoftFeatureGraphDiagnosticCode = typeof NurbsSourceLoftFeatureGraphDiagnosticCode[keyof typeof NurbsSourceLoftFeatureGraphDiagnosticCode];
export class NurbsSourceLoftFeatureGraphError extends KernelError {
  readonly code:NurbsSourceLoftFeatureGraphDiagnosticCode;
  constructor(code:NurbsSourceLoftFeatureGraphDiagnosticCode,detail:string,cause?:unknown) {super(('NURBS Source Loft feature graph: '+detail).slice(0,1024),cause===undefined?undefined:{cause});this.name='NurbsSourceLoftFeatureGraphError';this.code=code;}
}

type Source = {sourceId:string;sourceVersion:0;source:string};
type SourceEditNode = {
  id:string;kind:'source-curve-edit';
  input:{sourceId:string;previousNodeId:string|null};
  curveId:string;edits:CurveControlPolygonEdits;
};
type SectionRef = {nodeId:string;sourceId:string;curveId:string};
type LoftNode = {
  id:string;kind:'piecewise-rational-loft';outputSourceId:string;
  sections:[SectionRef,SectionRef,SectionRef];
  parametersV:[number,number,number];suppressed:boolean;
  options:PiecewiseRationalLoftOptions;
};
export interface NurbsSourceLoftFeatureGraphV0 {
  format:'barocss-nurbs-source-loft-feature-graph';version:0;
  id:string;revision:number;lengthUnit:'mm';
  sourceFrame:'authored-xyz-no-axis-conversion';
  sources:Source[];nodes:(SourceEditNode|LoftNode)[];
}
export interface NurbsSourceLoftFeatureGraphOptions {
  maximumSources:3;maximumSourceEdits:3;
  maximumFeatureEvaluations:4;maximumLoftSections:3;
}
export interface NurbsSourceLoftFeatureGraphEdits {
  expectedRevision:number;revision:number;
  nodeEdits:{nodeId:string;edits:CurveControlPolygonEdits}[];
  loftSuppressed:boolean|null;
}
type CompiledSource={sourceId:string;sourceVersion:0;source:string;model:Model};
type EvaluatedNode={nodeId:string;sourceId:string;previousNodeId:string|null;
  curveId:string;evaluation:SourceCurveControlPolygonResult};
type LoftState={nodeId:string;outputSourceId:string;status:'active'|'suppressed';
  recipe:LoftNode;evaluation:PiecewiseRationalLoftResult|null};
type NodeBinding={graphId:string;revision:number;nodeId:string;sourceId:string;
  sourceModelName:string;curveId:string;previousNodeId:string|null};
type LoftBinding={graphId:string;revision:number;nodeId:string;outputSourceId:string;
  modelName:string;surfaceId:string;status:'active'|'suppressed';
  sections:NodeBinding[]};
export interface NurbsSourceLoftFeatureGraphResult {
  document:NurbsSourceLoftFeatureGraphV0;options:NurbsSourceLoftFeatureGraphOptions;
  originalSources:CompiledSource[];evaluatedNodes:EvaluatedNode[];
  loft:LoftState;bindings:{nodes:NodeBinding[];loft:LoftBinding};
  report:NurbsSourceLoftFeatureGraphReport;
}
export interface NurbsSourceLoftFeatureGraphReport {
  schema:'barocss-nurbs-source-loft-feature-graph';version:0;
  graphId:string;revision:number;sourceIds:string[];sourceModelNames:string[];
  nodeOrder:string[];
  dependencies:{nodeId:string;dependencyNodeIds:string[]}[];
  sourceNamespaces:{sourceId:string;modelName:string;objectIds:string[]}[];
  loftNodeId:string;loftOutputSourceId:string;loftSurfaceId:string;loftModelName:string;
  loftStatus:'active'|'suppressed';sectionRefs:SectionRef[];
  receiptCounts:{originalSourceModelCount:number;sourceEditReceiptCount:3;
    activeLoftReceiptCount:0|1;sourceEditPatchCount:number;
    sourceEditRequestedFieldCount:number};
  lengthUnit:'mm';sourceFrame:'authored-xyz-no-axis-conversion';
  authority:'complete-authored-source-and-explicit-source-node-qualified-recipes';
  reconstruction:'whole-current-document-and-options-no-operation-history';
  workScope:'retained-result-receipts-not-operation-constructor-call-counts';
  fileSizes:{authored:{utf16:number;utf8:number};result:{utf16:number;utf8:number}};
  quality:{completeOriginalSourcesRetained:true;unrelatedSourceGeometryPreserved:true;
    sourceQualifiedCurveBindings:true;independentWeightsPreserved:true;
    ownedRebuild:true;affectedOnlyUpdates:true;
    originalMixedSourceLoftOutput:false;smoothLoft:false;G1:false;G2:false;
    persistentTopologyBinding:false;topologyCertified:false;solid:false;
    globalBinary64ErrorCertified:false;manufacturing:false;editorDisplay:false;
    publication:false;ownership:'independent-copied-cpu-data-gc'};
  limits:{maximumSources:3;maximumSourceEdits:3;maximumNodes:4;maximumLoftSections:3;
    maximumSelectedUDegree:5;maximumSelectedUPoles:16;maximumRevision:1000000000;
    maximumAggregateOriginalSourceUTF16:262144;maximumAggregateOriginalSourceUTF8:262144;
    maximumSourceUTF16:262144;maximumSourceUTF8:262144;maximumModelObjects:16;
    maximumAuthoredFileUTF16:1048576;maximumAuthoredFileUTF8:1048576;
    maximumResultFileUTF16:2097152;maximumResultFileUTF8:2097152;
    maximumWrapperPoleEdits:192;maximumWrapperRequestedFields:768;
    ownValues:1048576;ownDepth:64;arrayElements:8192;recordFields:64;
    keyCharacters:128;stringCharacters:262144;
    authoredCodecDepth:12;authoredCodecValues:65536;
    authoredCodecRecordFields:16;authoredCodecDecodedStringCharacters:262144};
}
export interface NurbsSourceLoftFeatureGraphTransactionReport {
  schema:'barocss-nurbs-source-loft-feature-graph-transaction';version:0;
  graphId:string;previousRevision:number;revision:number;noOp:boolean;
  requestedNodeIds:string[];changedRecipeNodeIds:string[];
  affectedSourceEditNodeIds:string[];reusedSourceEditNodeIds:string[];
  loftNodeId:string;loftAffected:boolean;suppressionChanged:boolean;resumed:boolean;
  loftAction:'rebuilt'|'retained'|'suppressed';
  directCounts:{priorOwnedValidationCount:1;sourceCompilationCount:0;
    sourceEditEvaluationCount:number;loftEvaluationCount:0|1;
    curvePointEvaluationCount:0;curveDerivativeEvaluationCount:0;
    surfacePointEvaluationCount:0;surfaceDerivativeEvaluationCount:0};
  nativeCalls:'actual-selective-wrapper-producer-calls';
  workScope:'prior-owned-validation-and-producer-internal-work-excluded';
  fileSizes:{update:{utf16:number;utf8:number}};
  atomic:true;unchangedNativeReceiptsCopied:true;
}
export interface NurbsSourceLoftFeatureGraphTransaction {
  request:{previousDocument:NurbsSourceLoftFeatureGraphV0;
    options:NurbsSourceLoftFeatureGraphOptions;edits:NurbsSourceLoftFeatureGraphEdits};
  report:NurbsSourceLoftFeatureGraphTransactionReport;
}
export interface NurbsSourceLoftFeatureGraphUpdateResult {
  result:NurbsSourceLoftFeatureGraphResult;
  transaction:NurbsSourceLoftFeatureGraphTransaction;
}
const CODE=NurbsSourceLoftFeatureGraphDiagnosticCode;
const LIMITS:NurbsSourceLoftFeatureGraphReport['limits']={maximumSources:3,maximumSourceEdits:3,maximumNodes:4,maximumLoftSections:3,maximumSelectedUDegree:5,maximumSelectedUPoles:16,maximumRevision:1000000000,maximumAggregateOriginalSourceUTF16:262144,maximumAggregateOriginalSourceUTF8:262144,maximumSourceUTF16:262144,maximumSourceUTF8:262144,maximumModelObjects:16,maximumAuthoredFileUTF16:1048576,maximumAuthoredFileUTF8:1048576,maximumResultFileUTF16:2097152,maximumResultFileUTF8:2097152,maximumWrapperPoleEdits:192,maximumWrapperRequestedFields:768,ownValues:1048576,ownDepth:64,arrayElements:8192,recordFields:64,keyCharacters:128,stringCharacters:262144,authoredCodecDepth:12,authoredCodecValues:65536,authoredCodecRecordFields:16,authoredCodecDecodedStringCharacters:262144};
function check(condition:boolean,code:NurbsSourceLoftFeatureGraphDiagnosticCode,detail:string):asserts condition {if(!condition)throw new NurbsSourceLoftFeatureGraphError(code,detail);}
function record(input:unknown,fields:string[],code:NurbsSourceLoftFeatureGraphDiagnosticCode=CODE.INPUT):Record<string,unknown> {check(input!==null&&typeof input==='object'&&!Array.isArray(input),code,'An own record is required');const data=input as Record<string,unknown>;check(Object.keys(data).length===fields.length&&fields.every(field=>Object.hasOwn(data,field)),code,'Exact own fields are required');return data;}
function id(input:unknown):string {check(typeof input==='string'&&input.length<=48&&/^[A-Za-z_][A-Za-z0-9_-]*$/.test(input),CODE.IDENTITY,'ASCII identity1..48 is required');return input;}
function revision(input:unknown):number {check(typeof input==='number'&&Number.isInteger(input)&&input>=0&&input<=1000000000&&!Object.is(input,-0),CODE.REVISION,'Revision must be an integer0..1e9 without negative zero');return input;}
function snapshot(input:unknown,owned=false):unknown {
  const code=owned?CODE.OWNED:CODE.INPUT,budget=owned?CODE.OWNED:CODE.BUDGET;let remaining=1048576;const ancestors=new Set<object>();
  const copy=(value:unknown,depth:number):unknown=>{
    check(--remaining>=0&&depth<=64,budget,'Own value/depth budget exceeded');if(value===null||typeof value==='boolean')return value;
    if(typeof value==='number'){check(Number.isFinite(value),code,'Finite own numbers are required');return value;}
    if(typeof value==='string'){check(value.length<=262144,budget,'Own string budget exceeded');return value;}
    check(typeof value==='object'&&!ancestors.has(value),code,'Acyclic own data is required');
    const array=Array.isArray(value),prototype=Object.getPrototypeOf(value),keys=Reflect.ownKeys(value),descriptors=Object.getOwnPropertyDescriptors(value);
    check(array?prototype===Array.prototype:prototype===Object.prototype||prototype===null,code,'Plain own prototypes required');
    check(keys.length<=(array?8193:64)&&keys.every(key=>typeof key==='string'&&key.length<=128&&'value'in descriptors[key]&&(array&&key==='length'||descriptors[key].enumerable===true)),code,'Bounded enumerable fields without getters/symbols/hidden data required');
    ancestors.add(value);let result:unknown;
    if(array){const length=descriptors.length.value as number;check(Number.isInteger(length)&&length>=0&&length<=8192&&keys.length===length+1,code,'Dense bounded arrays required');result=Array.from({length},(_,index)=>{check(Object.hasOwn(descriptors,String(index)),code,'Sparse/extra array fields refused');return copy(descriptors[String(index)].value,depth+1);});}
    else result=Object.fromEntries((keys as string[]).map(key=>[key,copy(descriptors[key].value,depth+1)]));
    ancestors.delete(value);return result;
  };
  try{return copy(input,0);}catch(cause){if(cause instanceof NurbsSourceLoftFeatureGraphError)throw cause;throw new NurbsSourceLoftFeatureGraphError(code,'Own snapshot failed',cause);}
}
function same(a:unknown,b:unknown):boolean {if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>same(value,b[index]));if(a&&b&&typeof a==='object'&&typeof b==='object'){const x=a as Record<string,unknown>,y=b as Record<string,unknown>;return Object.keys(x).length===Object.keys(y).length&&Object.keys(x).every(key=>Object.hasOwn(y,key)&&same(x[key],y[key]));}return Object.is(a,b);}
function json(value:unknown):string {if(typeof value==='number'){check(Number.isFinite(value),CODE.REPRESENTABILITY,'Finite JSON numbers required');return Object.is(value,-0)?'-0':JSON.stringify(value);}if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(json).join(',')+']';check(value!==null&&typeof value==='object',CODE.INPUT,'Only owned JSON data may be encoded');return '{'+Object.entries(value).map(([key,child])=>JSON.stringify(key)+':'+json(child)).join(',')+'}';}
function utf8(text:string,code:NurbsSourceLoftFeatureGraphDiagnosticCode):number {try{return cadDocumentOwnUtf8Bytes(text,'JSON');}catch(cause){throw new NurbsSourceLoftFeatureGraphError(code,'Original UTF8 envelope refused malformed Unicode',cause);}}
function fileSize(value:unknown,limit:number):{utf16:number;utf8:number} {const text=json(value)+'\n';check(text.length<=limit,CODE.BUDGET,'Complete JSON UTF16 envelope exceeded');const bytes=utf8(text,CODE.CODEC);check(bytes<=limit,CODE.BUDGET,'Complete JSON UTF8 envelope exceeded');return {utf16:text.length,utf8:bytes};}
function edits(input:unknown):CurveControlPolygonEdits {
  const data=record(input,['poleEdits']);check(Array.isArray(data.poleEdits)&&data.poleEdits.length>=1&&data.poleEdits.length<=64,CODE.BUDGET,'Exactly1..64 selected pole edits required');const selected=new Set<number>();let fields=0;
  for(const value of data.poleEdits){check(value!==null&&typeof value==='object'&&!Array.isArray(value),CODE.INPUT,'An own pole edit record required');const pole=value as Record<string,unknown>,keys=Object.keys(pole);check(Object.hasOwn(pole,'index')&&keys.length>=2&&keys.length<=5&&keys.every(key=>['index','xMM','yMM','zMM','weight'].includes(key)),CODE.INPUT,'Existing index and nonempty scalar subset required');check(typeof pole.index==='number'&&Number.isInteger(pole.index)&&pole.index>=0&&!selected.has(pole.index),CODE.INPUT,'Unique nonnegative pole indices required');selected.add(pole.index);for(const key of keys)if(key!=='index'){check(typeof pole[key]==='number'&&Number.isFinite(pole[key]),CODE.INPUT,'Finite scalar replacements required');fields++;}}
  check(fields<=256,CODE.BUDGET,'Requested scalar budget256 exceeded');return input as CurveControlPolygonEdits;
}
type Admitted={document:NurbsSourceLoftFeatureGraphV0;options:NurbsSourceLoftFeatureGraphOptions;editNodes:SourceEditNode[];loft:LoftNode;order:(SourceEditNode|LoftNode)[]};
function dependencies(node:SourceEditNode|LoftNode):string[] {return node.kind==='source-curve-edit'?(node.input.previousNodeId===null?[]:[node.input.previousNodeId]):node.sections.map(ref=>ref.nodeId);}
function admit(documentInput:unknown,optionsInput:unknown):Admitted {
  const settings=record(optionsInput,['maximumSources','maximumSourceEdits','maximumFeatureEvaluations','maximumLoftSections']);check(settings.maximumSources===3&&settings.maximumSourceEdits===3&&settings.maximumFeatureEvaluations===4&&settings.maximumLoftSections===3,CODE.BUDGET,'Fixed wrapper budgets3/3/4/3 required before native calls');
  const data=record(documentInput,['format','version','id','revision','lengthUnit','sourceFrame','sources','nodes']);check(data.format==='barocss-nurbs-source-loft-feature-graph'&&Object.is(data.version,0),CODE.VERSION,'Only Source Loft graph format/version0 supported');id(data.id);revision(data.revision);check(data.lengthUnit==='mm'&&data.sourceFrame==='authored-xyz-no-axis-conversion',CODE.INPUT,'Explicit authored mm/XYZ frame required');
  check(Array.isArray(data.sources)&&data.sources.length>=1&&data.sources.length<=3,CODE.BUDGET,'Exactly1..3 complete sources required');const logical=new Set<string>([data.id as string]),sourceIds=new Set<string>();let units=0,bytes=0;
  for(const value of data.sources){const source=record(value,['sourceId','sourceVersion','source']),key=id(source.sourceId);check(!logical.has(key),CODE.IDENTITY,'Logical source/node/graph roles must be distinct');logical.add(key);sourceIds.add(key);check(Object.is(source.sourceVersion,0),CODE.VERSION,'Literal sourceVersion0 required');check(typeof source.source==='string',CODE.INPUT,'Complete original source text required');units+=source.source.length;bytes+=utf8(source.source,CODE.SOURCE);check(units<=262144&&bytes<=262144,CODE.BUDGET,'Aggregate original source UTF16/UTF8 limit262144 exceeded');}
  check(Array.isArray(data.nodes)&&data.nodes.length===4,CODE.BUDGET,'Exactly three edit nodes and one Loft node required');const nodes: (SourceEditNode|LoftNode)[]=[],editNodes:SourceEditNode[]=[];let loft:LoftNode|undefined,totalPoles=0,totalFields=0;
  for(const value of data.nodes){check(value!==null&&typeof value==='object'&&!Array.isArray(value),CODE.INPUT,'An own feature node required');const kind=(value as Record<string,unknown>).kind;
    if(kind==='source-curve-edit'){const node=record(value,['id','kind','input','curveId','edits']),input=record(node.input,['sourceId','previousNodeId']);id(node.id);id(node.curveId);id(input.sourceId);check(input.previousNodeId===null||typeof input.previousNodeId==='string',CODE.REFERENCE,'Explicit previousNodeId string/null required');if(input.previousNodeId!==null)id(input.previousNodeId);check(sourceIds.has(input.sourceId as string),CODE.REFERENCE,'Source edit must resolve its complete original namespace');const recipe=edits(node.edits);totalPoles+=recipe.poleEdits.length;totalFields+=recipe.poleEdits.reduce((count,pole)=>count+Object.keys(pole).length-1,0);const typed=node as unknown as SourceEditNode;editNodes.push(typed);nodes.push(typed);
    }else if(kind==='piecewise-rational-loft'){const node=record(value,['id','kind','outputSourceId','sections','parametersV','suppressed','options']);check(loft===undefined,CODE.BUDGET,'Exactly one Loft node required');id(node.id);id(node.outputSourceId);check(Array.isArray(node.sections)&&node.sections.length===3,CODE.REFERENCE,'Three ordered section refs required');for(const raw of node.sections){const ref=record(raw,['nodeId','sourceId','curveId']);id(ref.nodeId);id(ref.sourceId);id(ref.curveId);}check(typeof node.suppressed==='boolean',CODE.INPUT,'Boolean Loft suppression required');check(Array.isArray(node.parametersV)&&node.parametersV.length===3&&node.parametersV.every(v=>typeof v==='number'&&Number.isFinite(v)),CODE.STATIONS,'Three finite original V stations required');const stations=node.parametersV as number[];check(stations.every((v,i)=>i===0||v>stations[i-1]&&Number.isFinite(v-stations[i-1]))&&stations[2]>stations[0]&&Number.isFinite(stations[2]-stations[0]),CODE.STATIONS,'Original adjacent/full V spans must be finite and strictly positive');const options=record(node.options,['surfaceId','modelName','maximumSections','maximumUPoles','maximumPointObservations','maximumDerivativeObservations']);id(options.surfaceId);id(options.modelName);check(options.maximumSections===15&&options.maximumUPoles===16&&options.maximumPointObservations===87&&options.maximumDerivativeObservations===87,CODE.BUDGET,'Unchanged Loft fixed budgets15/16/87/87 required');loft=node as unknown as LoftNode;nodes.push(loft);
    }else check(false,CODE.INPUT,'Only source-curve-edit and piecewise-rational-loft nodes supported');
    const key=id((value as Record<string,unknown>).id);check(!logical.has(key),CODE.IDENTITY,'Logical node/source/graph roles must be distinct');logical.add(key);
  }
  check(editNodes.length===3&&loft!==undefined,CODE.BUDGET,'Exactly three edits and one Loft required');check(totalPoles<=192&&totalFields<=768,CODE.BUDGET,'Wrapper edit/scalar budgets192/768 exceeded');check(!logical.has(loft.outputSourceId),CODE.IDENTITY,'Loft output source must have its own logical role');logical.add(loft.outputSourceId);
  check(sourceIds.size===new Set(editNodes.map(node=>node.input.sourceId)).size,CODE.REFERENCE,'Every original source must be used');const byId=new Map(nodes.map(node=>[node.id,node]));
  for(const node of editNodes)if(node.input.previousNodeId!==null){const parent=byId.get(node.input.previousNodeId);check(parent!==undefined&&parent.id!==node.id&&parent.kind==='source-curve-edit',CODE.DEPENDENCY,'Predecessor must resolve to another Source edit node');check(parent.input.sourceId===node.input.sourceId,CODE.DEPENDENCY,'Predecessor must retain the SAME root source namespace');}
  check(new Set(loft.sections.map(ref=>ref.nodeId)).size===3,CODE.REFERENCE,'Loft must use all three distinct edit nodes once');for(const ref of loft.sections){const node=byId.get(ref.nodeId);check(node!==undefined&&node.kind==='source-curve-edit',CODE.REFERENCE,'Every Loft section must resolve an actual edit node');check(ref.sourceId===node.input.sourceId&&ref.curveId===node.curveId,CODE.REFERENCE,'Section source/node/selected Curve binding must match exactly');}
  check(new Set([...loft.sections.map(ref=>ref.curveId),loft.options.surfaceId]).size===4,CODE.IDENTITY,'Used original Curve IDs and new Surface ID must be distinct without relabeling');
  const pending=new Set(nodes.map(node=>node.id)),done=new Set<string>(),order:(SourceEditNode|LoftNode)[]=[];while(pending.size){const ready=nodes.find(node=>pending.has(node.id)&&dependencies(node).every(key=>done.has(key)));check(ready!==undefined,CODE.DEPENDENCY,'Cyclic Source/Loft feature dependencies');order.push(ready);done.add(ready.id);pending.delete(ready.id);}
  return {document:data as unknown as NurbsSourceLoftFeatureGraphV0,options:settings as unknown as NurbsSourceLoftFeatureGraphOptions,editNodes,loft,order};
}
function compileOriginals(document:NurbsSourceLoftFeatureGraphV0):CompiledSource[] {
  return document.sources.map(source=>{let compiled:ReturnType<typeof compileCadModel>;try{compiled=compileCadModel(source.source,{sourceVersion:0});}catch(cause){throw new NurbsSourceLoftFeatureGraphError(CODE.SOURCE,'Actual original Source0 compilation failed',cause);}if(!compiled.ok)throw new NurbsSourceLoftFeatureGraphError(CODE.SOURCE,'Actual complete original Source0 compilation refused',compiled);check(compiled.model.objects.length<=16,CODE.BUDGET,'Original Model object cap16 unchanged');return {sourceId:source.sourceId,sourceVersion:0,source:source.source,model:compiled.model};});
}
function selectedOriginals(a:Admitted,sources:CompiledSource[]):Curve[] {
  return a.loft.sections.map(ref=>{const source=sources.find(item=>item.sourceId===ref.sourceId),curve=source?.model.objects.find(item=>item.id===ref.curveId);check(curve!==undefined&&curve.kind==='curve',CODE.REFERENCE,'Qualified original selected ID must resolve an actual Curve');const node=a.editNodes.find(item=>item.id===ref.nodeId);check(node!==undefined,CODE.REFERENCE,'Actual selected edit node required');check(node.edits.poleEdits.every(pole=>pole.index<curve.controlPoints.length),CODE.INPUT,'Every requested index must bind an existing original pole');return curve;});
}
function commonBasis(curves:Curve[]):void {
  const first=curves[0];check(first!==undefined&&curves.length===3,CODE.BASIS,'Exactly three selected original bases required');for(const curve of curves){check(Number.isInteger(curve.degree)&&curve.degree>=1&&curve.degree<=5,CODE.BASIS,'Selected Udegree1..5 unchanged');check(curve.controlPoints.length>=2&&curve.controlPoints.length<=16,CODE.BUDGET,'Selected Ucount must fit unchanged Loft Surface axis2..16');check(Object.is(curve.degree,first.degree)&&curve.controlPoints.length===first.controlPoints.length&&same(curve.knots,first.knots),CODE.BASIS,'Original selected U degree/count/knot bits must match exactly');const left=curve.knots[curve.degree],right=curve.knots[curve.controlPoints.length];check(Number.isFinite(right-left)&&right>left,CODE.BASIS,'Original represented U domain span must be finite and positive');}
}
function writeNode(node:SourceEditNode,source:string):SourceCurveControlPolygonResult {
  try{return editSourceCurveControlPolygon({source,sourceVersion:0,curveId:node.curveId,edits:node.edits});}catch(cause){let code:NurbsSourceLoftFeatureGraphDiagnosticCode=CODE.NATIVE;if(cause instanceof SourceCurveControlPolygonError){if(cause.code==='TARGET')code=CODE.REFERENCE;else if(cause.code==='BINDING'||cause.code==='SOURCE')code=CODE.SOURCE;else if(cause.code==='BUDGET')code=CODE.BUDGET;else if(cause.code==='INPUT')code=CODE.INPUT;else if(cause.code==='IDENTITY')code=CODE.IDENTITY;else if(cause.code==='VERSION')code=CODE.VERSION;}throw new NurbsSourceLoftFeatureGraphError(code,'Actual complete-source Curve writer refused',cause);}
}
function buildLoft(curves:Curve[],loft:LoftNode):PiecewiseRationalLoftResult {
  try{return buildPiecewiseRationalLoftSurface(curves,loft.parametersV,loft.options);}catch(cause){let code:NurbsSourceLoftFeatureGraphDiagnosticCode=CODE.NATIVE;if(cause instanceof PiecewiseRationalLoftError){if(cause.code==='BASIS')code=CODE.BASIS;else if(cause.code==='STATIONS')code=CODE.STATIONS;else if(cause.code==='BUDGET')code=CODE.BUDGET;else if(cause.code==='SOURCE')code=CODE.SOURCE;else if(cause.code==='REPRESENTABILITY')code=CODE.REPRESENTABILITY;else if(cause.code==='IDENTITY')code=CODE.IDENTITY;else if(cause.code==='INPUT')code=CODE.INPUT;}throw new NurbsSourceLoftFeatureGraphError(code,'Actual independent-weight piecewise Loft refused',cause);}
}
function finish(a:Admitted,originalSources:CompiledSource[],evaluatedNodes:EvaluatedNode[],loftEvaluation:PiecewiseRationalLoftResult|null):NurbsSourceLoftFeatureGraphResult {
  const {document,options}=a;const status:LoftState['status']=a.loft.suppressed?'suppressed':'active';check(a.loft.suppressed?loftEvaluation===null:loftEvaluation!==null,CODE.REFERENCE,'Loft state must match actual suppression without a geometry cache');
  const nodeBindings:NodeBinding[]=evaluatedNodes.map(node=>({graphId:document.id,revision:document.revision,nodeId:node.nodeId,sourceId:node.sourceId,sourceModelName:node.evaluation.model.name,curveId:node.curveId,previousNodeId:node.previousNodeId}));
  const sectionBindings=a.loft.sections.map(ref=>{const binding=nodeBindings.find(item=>item.nodeId===ref.nodeId);check(binding!==undefined&&binding.sourceId===ref.sourceId&&binding.curveId===ref.curveId,CODE.REFERENCE,'Current graph revision/source/node binding required');return binding;});
  const loft:LoftState={nodeId:a.loft.id,outputSourceId:a.loft.outputSourceId,status,recipe:a.loft,evaluation:loftEvaluation};const bindings:NurbsSourceLoftFeatureGraphResult['bindings']={nodes:nodeBindings,loft:{graphId:document.id,revision:document.revision,nodeId:a.loft.id,outputSourceId:a.loft.outputSourceId,modelName:a.loft.options.modelName,surfaceId:a.loft.options.surfaceId,status,sections:sectionBindings}};
  const report:NurbsSourceLoftFeatureGraphReport={schema:'barocss-nurbs-source-loft-feature-graph',version:0,graphId:document.id,revision:document.revision,sourceIds:originalSources.map(source=>source.sourceId),sourceModelNames:originalSources.map(source=>source.model.name),nodeOrder:a.order.map(node=>node.id),dependencies:a.order.map(node=>({nodeId:node.id,dependencyNodeIds:dependencies(node)})),sourceNamespaces:originalSources.map(source=>({sourceId:source.sourceId,modelName:source.model.name,objectIds:source.model.objects.map(object=>object.id)})),loftNodeId:a.loft.id,loftOutputSourceId:a.loft.outputSourceId,loftSurfaceId:a.loft.options.surfaceId,loftModelName:a.loft.options.modelName,loftStatus:status,sectionRefs:a.loft.sections,receiptCounts:{originalSourceModelCount:originalSources.length,sourceEditReceiptCount:3,activeLoftReceiptCount:loftEvaluation===null?0:1,sourceEditPatchCount:evaluatedNodes.reduce((sum,node)=>sum+node.evaluation.patches.length,0),sourceEditRequestedFieldCount:evaluatedNodes.reduce((sum,node)=>sum+node.evaluation.report.requestedFieldCount,0)},lengthUnit:'mm',sourceFrame:'authored-xyz-no-axis-conversion',authority:'complete-authored-source-and-explicit-source-node-qualified-recipes',reconstruction:'whole-current-document-and-options-no-operation-history',workScope:'retained-result-receipts-not-operation-constructor-call-counts',fileSizes:{authored:fileSize(document,1048576),result:{utf16:0,utf8:0}},quality:{completeOriginalSourcesRetained:true,unrelatedSourceGeometryPreserved:true,sourceQualifiedCurveBindings:true,independentWeightsPreserved:true,ownedRebuild:true,affectedOnlyUpdates:true,originalMixedSourceLoftOutput:false,smoothLoft:false,G1:false,G2:false,persistentTopologyBinding:false,topologyCertified:false,solid:false,globalBinary64ErrorCertified:false,manufacturing:false,editorDisplay:false,publication:false,ownership:'independent-copied-cpu-data-gc'},limits:LIMITS};
  const result:NurbsSourceLoftFeatureGraphResult={document,options,originalSources,evaluatedNodes,loft,bindings,report};let stable=false;for(let step=0;step<8;step++){const size=fileSize(result,2097152);if(same(size,report.fileSizes.result)){stable=true;break;}report.fileSizes.result=size;}check(stable,CODE.BUDGET,'Complete Graph result size metadata must reach an exact fixed point');return snapshot(result,true) as NurbsSourceLoftFeatureGraphResult;
}
function run(a:Admitted,originalSources:CompiledSource[],prior?:NurbsSourceLoftFeatureGraphResult,affected?:Set<string>,rebuildLoft=true):NurbsSourceLoftFeatureGraphResult {
  commonBasis(selectedOriginals(a,originalSources));const evaluatedNodes:EvaluatedNode[]=[],byNode=new Map<string,EvaluatedNode>();
  for(const node of a.order){if(node.kind!=='source-curve-edit')continue;const source=node.input.previousNodeId===null?originalSources.find(item=>item.sourceId===node.input.sourceId)?.source:byNode.get(node.input.previousNodeId)?.evaluation.source;check(source!==undefined,CODE.REFERENCE,'Every edit must bind its actual complete predecessor/original source');let evaluation:SourceCurveControlPolygonResult;
    if(prior!==undefined&&affected!==undefined&&!affected.has(node.id)){const stored=prior.evaluatedNodes.find(item=>item.nodeId===node.id);check(stored!==undefined&&stored.sourceId===node.input.sourceId&&stored.curveId===node.curveId&&stored.previousNodeId===node.input.previousNodeId&&stored.evaluation.request.source===source&&same(stored.evaluation.request.edits,node.edits),CODE.REFERENCE,'Unaffected receipt must match complete actual input/recipe');evaluation=stored.evaluation;}else evaluation=writeNode(node,source);
    check(evaluation.curve.id===node.curveId,CODE.REFERENCE,'Actual writer must retain selected Curve identity');const value:EvaluatedNode={nodeId:node.id,sourceId:node.input.sourceId,previousNodeId:node.input.previousNodeId,curveId:node.curveId,evaluation};byNode.set(node.id,value);evaluatedNodes.push(value);
  }
  const curves=a.loft.sections.map(ref=>{const node=byNode.get(ref.nodeId);check(node!==undefined&&node.sourceId===ref.sourceId&&node.curveId===ref.curveId,CODE.REFERENCE,'Loft must consume actual selected source-node Curve');return node.evaluation.curve;});commonBasis(curves);let evaluation:PiecewiseRationalLoftResult|null=null;
  if(!a.loft.suppressed){if(prior!==undefined&&!rebuildLoft){const stored=prior.loft.evaluation;check(prior.loft.status==='active'&&stored!==null&&same(stored.request.sections,curves)&&same(stored.request.parametersV,a.loft.parametersV)&&same(stored.request.options,a.loft.options),CODE.REFERENCE,'Retained active Loft must bind its complete actual recipe/Curve inputs');evaluation=stored;}else evaluation=buildLoft(curves,a.loft);}
  return finish(a,originalSources,evaluatedNodes,evaluation);
}
/** Evaluate full authored sources, exact source-node dependencies and the actual active piecewise Loft. */
export function evaluateNurbsSourceLoftFeatureGraph(documentInput:NurbsSourceLoftFeatureGraphV0,optionsInput:NurbsSourceLoftFeatureGraphOptions):NurbsSourceLoftFeatureGraphResult {
  const data=record(snapshot({document:documentInput,options:optionsInput}),['document','options']),a=admit(data.document,data.options);fileSize(a.document,1048576);return run(a,compileOriginals(a.document));
}
function rebuild(input:unknown):NurbsSourceLoftFeatureGraphResult {
  const owned=record(snapshot(input,true),['document','options','originalSources','evaluatedNodes','loft','bindings','report'],CODE.OWNED) as unknown as NurbsSourceLoftFeatureGraphResult;let expected:NurbsSourceLoftFeatureGraphResult;
  try{expected=evaluateNurbsSourceLoftFeatureGraph(owned.document,owned.options);}catch(cause){throw new NurbsSourceLoftFeatureGraphError(CODE.OWNED,'Whole current authored Graph reconstruction refused',cause);}check(same(owned,expected),CODE.OWNED,'Owned sources/recipes/Curve/Loft/native observations/bindings/receipt counts/quality changed');return expected;
}
/** Reconstruct all current native receipts from authored authority; operation history is not graph authority. */
export function validateNurbsSourceLoftFeatureGraph(input:NurbsSourceLoftFeatureGraphResult):NurbsSourceLoftFeatureGraphReport {return snapshot(rebuild(input).report,true) as NurbsSourceLoftFeatureGraphReport;}
/** Validate the prior graph, then execute only the actually affected dependency closure. */
export function updateNurbsSourceLoftFeatureGraph(previousInput:NurbsSourceLoftFeatureGraphResult,editsInput:NurbsSourceLoftFeatureGraphEdits):NurbsSourceLoftFeatureGraphUpdateResult {
  const previous=rebuild(previousInput),data=record(snapshot(editsInput),['expectedRevision','revision','nodeEdits','loftSuppressed']),expectedRevision=revision(data.expectedRevision),nextRevision=revision(data.revision);
  check(expectedRevision===previous.document.revision&&nextRevision===expectedRevision+1,CODE.REVISION,'Expected actual revision and exact previous+1 required');check(Array.isArray(data.nodeEdits)&&data.nodeEdits.length<=3,CODE.BUDGET,'At most three unique existing node recipe replacements required');check(data.loftSuppressed===null||typeof data.loftSuppressed==='boolean',CODE.INPUT,'Explicit Loft suppression boolean/null required');check(data.nodeEdits.length>0||data.loftSuppressed!==null,CODE.INPUT,'At least one explicit recipe/suppression request required');
  const candidate=snapshot(previous.document) as NurbsSourceLoftFeatureGraphV0,requested=new Set<string>(),changed=new Set<string>();candidate.revision=nextRevision;
  for(const raw of data.nodeEdits){const change=record(raw,['nodeId','edits']),key=id(change.nodeId);check(!requested.has(key),CODE.INPUT,'Duplicate node edit target refused');requested.add(key);const node=candidate.nodes.find(item=>item.id===key);check(node!==undefined&&node.kind==='source-curve-edit',CODE.REFERENCE,'Existing Source edit node target required');const recipe=edits(change.edits);if(!same(node.edits,recipe)){changed.add(key);node.edits=recipe;}}
  const priorLoft=previous.document.nodes.find((node):node is LoftNode=>node.kind==='piecewise-rational-loft'),nextLoft=candidate.nodes.find((node):node is LoftNode=>node.kind==='piecewise-rational-loft');check(priorLoft!==undefined&&nextLoft!==undefined,CODE.REFERENCE,'Exactly one retained Loft recipe required');if(data.loftSuppressed!==null)nextLoft.suppressed=data.loftSuppressed;
  const a=admit(candidate,previous.options),ordered=a.order.filter((node):node is SourceEditNode=>node.kind==='source-curve-edit'),affected=new Set<string>();for(const node of ordered)if(changed.has(node.id)||node.input.previousNodeId!==null&&affected.has(node.input.previousNodeId))affected.add(node.id);
  const suppressionChanged=priorLoft.suppressed!==nextLoft.suppressed,resumed=priorLoft.suppressed&&!nextLoft.suppressed,loftAffected=affected.size>0||suppressionChanged,rebuildLoft=!nextLoft.suppressed&&(loftAffected||resumed);
  const result=run(a,previous.originalSources,previous,affected,rebuildLoft),edit=data as unknown as NurbsSourceLoftFeatureGraphEdits;
  const report:NurbsSourceLoftFeatureGraphTransactionReport={schema:'barocss-nurbs-source-loft-feature-graph-transaction',version:0,graphId:candidate.id,previousRevision:expectedRevision,revision:nextRevision,noOp:changed.size===0&&!suppressionChanged,requestedNodeIds:ordered.filter(node=>requested.has(node.id)).map(node=>node.id),changedRecipeNodeIds:ordered.filter(node=>changed.has(node.id)).map(node=>node.id),affectedSourceEditNodeIds:ordered.filter(node=>affected.has(node.id)).map(node=>node.id),reusedSourceEditNodeIds:ordered.filter(node=>!affected.has(node.id)).map(node=>node.id),loftNodeId:nextLoft.id,loftAffected,suppressionChanged,resumed,loftAction:nextLoft.suppressed?'suppressed':rebuildLoft?'rebuilt':'retained',directCounts:{priorOwnedValidationCount:1,sourceCompilationCount:0,sourceEditEvaluationCount:affected.size,loftEvaluationCount:rebuildLoft?1:0,curvePointEvaluationCount:0,curveDerivativeEvaluationCount:0,surfacePointEvaluationCount:0,surfaceDerivativeEvaluationCount:0},nativeCalls:'actual-selective-wrapper-producer-calls',workScope:'prior-owned-validation-and-producer-internal-work-excluded',fileSizes:{update:{utf16:0,utf8:0}},atomic:true,unchangedNativeReceiptsCopied:true};
  const transaction:NurbsSourceLoftFeatureGraphTransaction={request:{previousDocument:previous.document,options:previous.options,edits:edit},report},update:NurbsSourceLoftFeatureGraphUpdateResult={result,transaction};let stable=false;for(let step=0;step<8;step++){const size=fileSize(update,2097152);if(same(size,report.fileSizes.update)){stable=true;break;}report.fileSizes.update=size;}check(stable,CODE.BUDGET,'Complete update wrapper size metadata must reach an exact fixed point');return snapshot(update,true) as NurbsSourceLoftFeatureGraphUpdateResult;
}
/** Reconstruct the nonrecursive authored baseline and actual selective operation, comparing result and transaction. */
export function validateNurbsSourceLoftFeatureGraphUpdate(input:NurbsSourceLoftFeatureGraphUpdateResult):NurbsSourceLoftFeatureGraphTransactionReport {
  const owned=record(snapshot(input,true),['result','transaction'],CODE.OWNED),transaction=record(owned.transaction,['request','report'],CODE.OWNED),request=record(transaction.request,['previousDocument','options','edits'],CODE.OWNED);let expected:NurbsSourceLoftFeatureGraphUpdateResult;
  try{const previous=evaluateNurbsSourceLoftFeatureGraph(request.previousDocument as NurbsSourceLoftFeatureGraphV0,request.options as NurbsSourceLoftFeatureGraphOptions);expected=updateNurbsSourceLoftFeatureGraph(previous,request.edits as NurbsSourceLoftFeatureGraphEdits);}catch(cause){throw new NurbsSourceLoftFeatureGraphError(CODE.OWNED,'Whole baseline/selective-update reconstruction refused',cause);}check(same(owned,expected),CODE.OWNED,'Owned next graph/transaction/baseline/affected closure/actual counters/file sizes changed');return snapshot(expected.transaction.report,true) as NurbsSourceLoftFeatureGraphTransactionReport;
}
/** Serialize current authored intent only, with the unchanged strict grammar's file envelope. */
export function serializeNurbsSourceLoftFeatureGraph(document:NurbsSourceLoftFeatureGraphV0,options:NurbsSourceLoftFeatureGraphOptions):string {
  const accepted=evaluateNurbsSourceLoftFeatureGraph(document,options),text=json(accepted.document)+'\n';fileSize(accepted.document,1048576);return text;
}
/** Strict original JSON grammar, then actual current native Source/Loft reconstruction. */
export function parseNurbsSourceLoftFeatureGraph(text:string,options:NurbsSourceLoftFeatureGraphOptions):NurbsSourceLoftFeatureGraphResult {
  check(typeof text==='string',CODE.CODEC,'Authored JSON text required');check(text.length<=1048576,CODE.BUDGET,'Authored JSON UTF16 cap1MiB exceeded');check(utf8(text,CODE.CODEC)<=1048576,CODE.BUDGET,'Authored JSON UTF8 cap1MiB exceeded');let document:unknown;
  try{document=parseCadDocumentOwnJson(text);}catch(cause){throw new NurbsSourceLoftFeatureGraphError(CODE.CODEC,'Original strict authored JSON grammar refused',cause);}return evaluateNurbsSourceLoftFeatureGraph(document as NurbsSourceLoftFeatureGraphV0,options);
}
