import {extractSurfaceBoundary,evaluateCurveD1,evaluateSurfaceD1} from '@barocss/cad';
import type {Surface,SurfaceBoundary} from '@barocss/cad';
import type {SurfaceQueryResult} from './surface-query';
import {surfaceQueryParameters} from './surface-query';
export const surfaceBoundaries=['v-min','u-max','v-max','u-min'] as const;
export interface SurfaceBoundaryQueryForm {boundary:SurfaceBoundary;parameter:string}
export interface SurfaceBoundaryQueryResult extends Pick<SurfaceQueryResult,'version'|'objectId'|'surfaceId'|'sourceVersion'|'source'|'acceptedRevision'|'frame'|'lengthUnit'> {
 boundary:SurfaceBoundary;parameter:number;domain:[number,number];varyingAxis:'u'|'v';orientation:'increasing'|'decreasing';
 surfaceParameters:{u:number;v:number};pointMM:[number,number,number];tangentMMPerParameter:[number,number,number];signedSurfacePartialMMPerParameter:[number,number,number];
}
/** Query IDs are private temporary geometry, never inserted in a native Model. */
export function queryAcceptedSurfaceBoundary(surface:Surface,request:unknown,binding:{objectId:string;source:string;acceptedRevision:number}):SurfaceBoundaryQueryResult {
 if(!request||typeof request!=='object'||Object.getPrototypeOf(request)!==Object.prototype)throw Error('Own boundary/parameter query required');
 const keys=Reflect.ownKeys(request),fields=Object.getOwnPropertyDescriptors(request);
 if(keys.length!==2||!['boundary','parameter'].every(k=>Object.hasOwn(fields,k)&&'value'in fields[k]&&fields[k].enumerable))throw Error('Exactly own boundary/parameter data fields required');
 const boundary=fields.boundary.value,parameter=fields.parameter.value;
 if(!surfaceBoundaries.includes(boundary))throw Error('Choose one original Surface parameter boundary');
 if(typeof parameter!=='number'||!Number.isFinite(parameter))throw Error('Finite numeric original boundary parameter required');
 const ud:[number,number]=[surface.knotsU[surface.degreeU],surface.knotsU[surface.controlPoints.length]],vd:[number,number]=[surface.knotsV[surface.degreeV],surface.knotsV[surface.controlPoints[0].length]],variesU=boundary==='v-min'||boundary==='v-max',decreasing=boundary==='v-max'||boundary==='u-min',domain=variesU?ud:vd,[a,b]=domain;
 if(parameter<a||parameter>b)throw Error('Boundary query lies outside the original native domain');
 let mapped=parameter;
 if(decreasing){if(parameter===a)mapped=b;else if(parameter===b)mapped=a;else{const difference=a-parameter;mapped=Number.isFinite(difference)?difference+b:a+(b-parameter);}}
 if(!Number.isFinite(mapped)||mapped<a||mapped>b||(parameter>a&&parameter<b&&(mapped===a||mapped===b)))throw Error('Reflected original boundary parameter is not representable');
 const surfaceParameters=surfaceQueryParameters(variesU?{u:mapped,v:boundary==='v-min'?vd[0]:vd[1]}:{u:boundary==='u-max'?ud[1]:ud[0],v:mapped},surface);
 const curve=extractSurfaceBoundary(surface,{boundary,id:'query_boundary'}),native=evaluateCurveD1(curve,parameter),d1=evaluateSurfaceD1(surface,surfaceParameters.u,surfaceParameters.v),partial=variesU?d1.du:d1.dv,sign=decreasing?-1:1;
 return{version:0,...binding,surfaceId:surface.id,sourceVersion:0,frame:'native-local-xyz',lengthUnit:'mm',boundary,parameter,domain:[...domain],varyingAxis:variesU?'u':'v',orientation:decreasing?'decreasing':'increasing',surfaceParameters,pointMM:[...native.point],tangentMMPerParameter:[...native.derivative],signedSurfacePartialMMPerParameter:partial.map(n=>n*sign) as [number,number,number]};
}
