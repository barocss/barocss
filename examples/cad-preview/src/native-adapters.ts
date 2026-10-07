import * as cad from '@barocss/cad';
import {signedJson} from './scene-document';
import type {AxisRectangleFeatureDocumentV0,XYCirclePrismDocumentV0,OwnPlateCircularHoleRequest,Surface,SurfacePoleEdit} from '@barocss/cad';
export type BoxIntent={kind:'box';document:AxisRectangleFeatureDocumentV0};
export type CircleIntent={kind:'circle-prism';document:XYCirclePrismDocumentV0};
export type PlateIntent={kind:'plate-hole';request:OwnPlateCircularHoleRequest};
export type SurfaceIntent={kind:'surface';sourceVersion:0;source:string};
export type NativeIntent=BoxIntent|CircleIntent|PlateIntent|SurfaceIntent;
export type {SurfacePoleEdit} from '@barocss/cad';
export function nativePayload(intent:NativeIntent){return intent.kind==='surface'?{sourceVersion:intent.sourceVersion,source:intent.source}:intent.kind==='plate-hole'?intent.request:intent.document;}
export function nativeKindName(intent:NativeIntent|NativeIntent['kind']):string {const kind=typeof intent==='string'?intent:intent.kind;return kind==='surface'?'NURBS Surface':kind==='box'?'Box':kind==='circle-prism'?'Cylinder':'Plate with hole';}
/** Original literal source is authority; this adapter accepts one directly authored open patch. */
export function surfaceGeometry(intent:SurfaceIntent):Surface {
 const descriptors=Object.getOwnPropertyDescriptors(intent),keys=Reflect.ownKeys(intent);
 if(Object.getPrototypeOf(intent)!==Object.prototype||keys.length!==3||!['kind','sourceVersion','source'].every(k=>Object.hasOwn(descriptors,k)&&'value'in descriptors[k]&&descriptors[k].enumerable)||descriptors.kind.value!=='surface'||descriptors.sourceVersion.value!==0||typeof descriptors.source.value!=='string')throw Error('Only own Surface kind/sourceVersion0/source fields are supported');
 const source=descriptors.source.value as string;
 if(new TextEncoder().encode(source).length>262144)throw Error('Surface literal source exceeds256KiB');
 const compiled=cad.compileCadModel(source,{sourceVersion:0});
 if(!compiled.ok)throw Error('Surface source0 refused: '+compiled.diagnostics.map(d=>d.message).join('; ').slice(0,768));
 if(compiled.constructions.length||compiled.model.objects.length!==1||compiled.model.objects[0].kind!=='surface')throw Error('Surface intent requires exactly one directly authored Surface and no constructions');
 const surface=compiled.model.objects[0];
 // Native619 performs bounded own-data, degree/grid/range/weight admission and
 // independently verifies complete original coefficient/domain/-0 fidelity.
 return cad.editSurfaceControlNet(surface,{poleEdits:[{uIndex:0,vIndex:0,xMM:surface.controlPoints[0][0][0]}]}).original;
}
export function editSurfaceIntent(intent:SurfaceIntent,poleEdits:SurfacePoleEdit[]):SurfaceIntent {
 const result=cad.editSurfaceControlNet(surfaceGeometry(intent),{poleEdits});
 return {kind:'surface',sourceVersion:result.sourceVersion,source:result.source};
}
export type NativeEvaluation=ReturnType<typeof evaluateNative>;
export function newNative(kind:NativeIntent['kind'],id:string):NativeIntent{
 if(kind==='surface'){const surface:Surface={kind:'surface',id:id+'_surface',degreeU:2,degreeV:2,knotsU:[0,0,0,1,1,1],knotsV:[0,0,0,1,1,1],controlPoints:[[[0,-0,0],[0,20,3],[0,40,0]],[[30,0,5],[30,20,18],[30,40,5]],[[60,0,0],[60,20,3],[60,40,0]]],weights:[[1,1,1],[1,1.5,1],[1,1,1]]};const result=cad.editSurfaceControlNet(surface,{poleEdits:[{uIndex:0,vIndex:0,yMM:-0}]});return{kind,sourceVersion:0,source:result.source};}
 if(kind==='plate-hole')return{kind,request:{bodyId:id+'_plate',featureId:id+'_cut',parameterIds:{width:id+'_width',height:id+'_depth',thickness:id+'_thickness',centerX:id+'_hole_x',centerY:id+'_hole_y',radius:id+'_radius'},widthMM:80,heightMM:40,thicknessMM:8,centreMM:[40,20],radiusMM:5}};
 if(kind==='box')return{kind,document:{format:'barocss-axis-rectangle-feature',version:0,id:id+'_doc',lengthUnit:'mm',parameters:[{id:'_rect_ox',type:'length',valueMM:0},{id:'_rect_oy',type:'length',valueMM:0},{id:'_rect_w',type:'length',valueMM:30},{id:'_rect_h',type:'length',valueMM:24},{id:'_rect_d',type:'length',valueMM:20}],profile:{id:id+'_profile',kind:'xy-rectangle',originX:'_rect_ox',originY:'_rect_oy',width:'_rect_w',height:'_rect_h'},feature:{id:id+'_extrude',kind:'axis-rectangle-extrude',profileId:id+'_profile',bodyId:id+'_body',distance:'_rect_d'}}};
 return{kind,document:{format:'barocss-xy-circle-prism-feature',version:0,id:id+'_doc',lengthUnit:'mm',sketch:{format:'barocss-xy-arc-sketch',version:0,id:id+'_sketch',lengthUnit:'mm',workplane:'xy',profiles:[{id:id+'_circle',kind:'circle',centerId:id+'_center',centerMM:[0,0],radius:{id:id+'_radius',valueMM:10},seamId:id+'_seam'}]},feature:{id:id+'_extrude',kind:'xy-circle-extrude',profileId:id+'_circle',shellId:id+'_shell',height:{id:id+'_height',valueMM:24}}}};
}
export function evaluateNative(intent:NativeIntent){
 if(intent.kind==='surface')return{kind:'surface' as const,result:{surface:surfaceGeometry(intent),sourceVersion:intent.sourceVersion,source:intent.source}};
 if(intent.kind==='plate-hole')return{kind:'plate-hole' as const,result:cad.buildOwnPlateCircularHole(intent.request)};
 if(intent.kind==='box')return{kind:'box' as const,result:cad.evaluateAxisRectangleFeatureDocument(intent.document)};
 return{kind:'circle-prism' as const,result:cad.evaluateXYCirclePrismDocument(intent.document)};
}
export function nativeDimensions(intent:NativeIntent):Record<string,number>{
 if(intent.kind==='surface')return{};
 if(intent.kind==='plate-hole'){const p=intent.request;return{width:p.widthMM,depth:p.heightMM,thickness:p.thicknessMM,holeX:p.centreMM[0],holeY:p.centreMM[1],radius:p.radiusMM};}
 if(intent.kind==='box'){const p=intent.document.parameters;return{width:p[2].valueMM,depth:p[3].valueMM,height:p[4].valueMM};}
 return{radius:intent.document.sketch.profiles[0].radius.valueMM,height:intent.document.feature.height.valueMM};
}
export function editNative(intent:NativeIntent,values:Record<string,number>):NativeIntent{
 if(intent.kind==='surface')return structuredClone(intent);
 if(intent.kind==='plate-hole')return{kind:intent.kind,request:{...structuredClone(intent.request),widthMM:values.width,heightMM:values.depth,thicknessMM:values.thickness,centreMM:[values.holeX,values.holeY],radiusMM:values.radius}};
 if(intent.kind==='box')return{kind:'box',document:cad.editAxisRectangleFeatureDocument(intent.document,[{parameterId:'_rect_w',valueMM:values.width},{parameterId:'_rect_h',valueMM:values.depth},{parameterId:'_rect_d',valueMM:values.height}]).document};
 return{kind:'circle-prism',document:cad.updateXYCirclePrismDocument(intent.document,{radiusMM:values.radius,heightMM:values.height}).document};
}
export function serializeNative(intent:NativeIntent):string{
 if(intent.kind==='surface')return intent.source;
 if(intent.kind==='plate-hole')return signedJson(intent.request);
 return intent.kind==='box'?cad.serializeAxisRectangleFeatureDocument(intent.document):cad.serializeXYCirclePrismDocument(intent.document);
}
export function admitNative(kind:unknown,document:unknown):NativeIntent{
 if(kind==='surface'){
  if(!document||typeof document!=='object'||Array.isArray(document)||Object.getPrototypeOf(document)!==Object.prototype)throw Error('Own Surface source record required');
  const d=Object.getOwnPropertyDescriptors(document),keys=Reflect.ownKeys(document);
  if(keys.length!==2||!['sourceVersion','source'].every(k=>Object.hasOwn(d,k)&&'value'in d[k]&&d[k].enumerable)||d.sourceVersion.value!==0||typeof d.source.value!=='string')throw Error('Only sourceVersion0 and literal source supported');
  const intent:SurfaceIntent={kind,sourceVersion:0,source:d.source.value};surfaceGeometry(intent);return intent;
 }
 if(kind==='plate-hole')return{kind,request:cad.buildOwnPlateCircularHole(document as OwnPlateCircularHoleRequest).bundle.request};
 if(kind==='box')return{kind,document:cad.evaluateAxisRectangleFeatureDocument(document as AxisRectangleFeatureDocumentV0).document};
 if(kind==='circle-prism')return{kind,document:cad.evaluateXYCirclePrismDocument(cad.parseXYCirclePrismDocument(signedJson(document))).document};
 throw Error('Unsupported native object kind');
}
