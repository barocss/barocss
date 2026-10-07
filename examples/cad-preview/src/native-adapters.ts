import * as cad from '@barocss/cad';
import {signedJson} from './scene-document';
import type {AxisRectangleFeatureDocumentV0,XYCirclePrismDocumentV0,OwnPlateCircularHoleRequest} from '@barocss/cad';
export type BoxIntent={kind:'box';document:AxisRectangleFeatureDocumentV0};
export type CircleIntent={kind:'circle-prism';document:XYCirclePrismDocumentV0};
export type PlateIntent={kind:'plate-hole';request:OwnPlateCircularHoleRequest};
export type NativeIntent=BoxIntent|CircleIntent|PlateIntent;
export function nativePayload(intent:NativeIntent){return intent.kind==='plate-hole'?intent.request:intent.document;}
export function nativeKindName(intent:NativeIntent|NativeIntent['kind']):string {const kind=typeof intent==='string'?intent:intent.kind;return kind==='box'?'Box':kind==='circle-prism'?'Cylinder':'Plate with hole';}
export type NativeEvaluation=ReturnType<typeof evaluateNative>;
export function newNative(kind:NativeIntent['kind'],id:string):NativeIntent{
 if(kind==='plate-hole')return{kind,request:{bodyId:id+'_plate',featureId:id+'_cut',parameterIds:{width:id+'_width',height:id+'_depth',thickness:id+'_thickness',centerX:id+'_hole_x',centerY:id+'_hole_y',radius:id+'_radius'},widthMM:80,heightMM:40,thicknessMM:8,centreMM:[40,20],radiusMM:5}};
 if(kind==='box')return{kind,document:{format:'barocss-axis-rectangle-feature',version:0,id:id+'_doc',lengthUnit:'mm',parameters:[{id:'_rect_ox',type:'length',valueMM:0},{id:'_rect_oy',type:'length',valueMM:0},{id:'_rect_w',type:'length',valueMM:30},{id:'_rect_h',type:'length',valueMM:24},{id:'_rect_d',type:'length',valueMM:20}],profile:{id:id+'_profile',kind:'xy-rectangle',originX:'_rect_ox',originY:'_rect_oy',width:'_rect_w',height:'_rect_h'},feature:{id:id+'_extrude',kind:'axis-rectangle-extrude',profileId:id+'_profile',bodyId:id+'_body',distance:'_rect_d'}}};
 return{kind,document:{format:'barocss-xy-circle-prism-feature',version:0,id:id+'_doc',lengthUnit:'mm',sketch:{format:'barocss-xy-arc-sketch',version:0,id:id+'_sketch',lengthUnit:'mm',workplane:'xy',profiles:[{id:id+'_circle',kind:'circle',centerId:id+'_center',centerMM:[0,0],radius:{id:id+'_radius',valueMM:10},seamId:id+'_seam'}]},feature:{id:id+'_extrude',kind:'xy-circle-extrude',profileId:id+'_circle',shellId:id+'_shell',height:{id:id+'_height',valueMM:24}}}};
}
export function evaluateNative(intent:NativeIntent){
 if(intent.kind==='plate-hole')return{kind:'plate-hole' as const,result:cad.buildOwnPlateCircularHole(intent.request)};
 if(intent.kind==='box')return{kind:'box' as const,result:cad.evaluateAxisRectangleFeatureDocument(intent.document)};
 return{kind:'circle-prism' as const,result:cad.evaluateXYCirclePrismDocument(intent.document)};
}
export function nativeDimensions(intent:NativeIntent):Record<string,number>{
 if(intent.kind==='plate-hole'){const p=intent.request;return{width:p.widthMM,depth:p.heightMM,thickness:p.thicknessMM,holeX:p.centreMM[0],holeY:p.centreMM[1],radius:p.radiusMM};}
 if(intent.kind==='box'){const p=intent.document.parameters;return{width:p[2].valueMM,depth:p[3].valueMM,height:p[4].valueMM};}
 return{radius:intent.document.sketch.profiles[0].radius.valueMM,height:intent.document.feature.height.valueMM};
}
export function editNative(intent:NativeIntent,values:Record<string,number>):NativeIntent{
 if(intent.kind==='plate-hole')return{kind:intent.kind,request:{...structuredClone(intent.request),widthMM:values.width,heightMM:values.depth,thicknessMM:values.thickness,centreMM:[values.holeX,values.holeY],radiusMM:values.radius}};
 if(intent.kind==='box')return{kind:'box',document:cad.editAxisRectangleFeatureDocument(intent.document,[{parameterId:'_rect_w',valueMM:values.width},{parameterId:'_rect_h',valueMM:values.depth},{parameterId:'_rect_d',valueMM:values.height}]).document};
 return{kind:'circle-prism',document:cad.updateXYCirclePrismDocument(intent.document,{radiusMM:values.radius,heightMM:values.height}).document};
}
export function serializeNative(intent:NativeIntent):string{
 if(intent.kind==='plate-hole')return signedJson(intent.request);
 return intent.kind==='box'?cad.serializeAxisRectangleFeatureDocument(intent.document):cad.serializeXYCirclePrismDocument(intent.document);
}
export function admitNative(kind:unknown,document:unknown):NativeIntent{
 if(kind==='plate-hole')return{kind,request:cad.buildOwnPlateCircularHole(document as OwnPlateCircularHoleRequest).bundle.request};
 if(kind==='box')return{kind,document:cad.evaluateAxisRectangleFeatureDocument(document as AxisRectangleFeatureDocumentV0).document};
 if(kind==='circle-prism')return{kind,document:cad.evaluateXYCirclePrismDocument(cad.parseXYCirclePrismDocument(signedJson(document))).document};
 throw Error('Unsupported native object kind');
}
