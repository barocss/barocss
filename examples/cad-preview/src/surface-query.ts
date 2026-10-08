import {evaluateSurfaceD1} from '@barocss/cad';
import type {Surface} from '@barocss/cad';
export interface SurfaceQueryForm {u:string;v:string}
export interface SurfaceQueryResult {
 version:0;objectId:string;surfaceId:string;sourceVersion:0;source:string;acceptedRevision:number;
 frame:'native-local-xyz';lengthUnit:'mm';parameters:{u:number;v:number};
 domain:{u:[number,number];v:[number,number]};pointMM:[number,number,number];
 duMMPerParameter:[number,number,number];dvMMPerParameter:[number,number,number];
}
/** Admit own data before evaluation. Getters and implicit coercion are not inputs. */
export function surfaceQueryParameters(request:unknown,surface:Surface):{u:number;v:number}{
 if(!request||typeof request!=='object'||Object.getPrototypeOf(request)!==Object.prototype)throw Error('Own U/V query record required');
 const keys=Reflect.ownKeys(request),fields=Object.getOwnPropertyDescriptors(request);
 if(keys.length!==2||!['u','v'].every(k=>Object.hasOwn(fields,k)&&'value'in fields[k]&&fields[k].enumerable))throw Error('Exactly own enumerable U/V data fields required');
 const u=fields.u.value,v=fields.v.value;
 if(typeof u!=='number'||typeof v!=='number'||!Number.isFinite(u)||!Number.isFinite(v))throw Error('Finite numeric original U/V parameters required');
 const ud=[surface.knotsU[surface.degreeU],surface.knotsU[surface.controlPoints.length]],vd=[surface.knotsV[surface.degreeV],surface.knotsV[surface.controlPoints[0].length]];
 if(u<ud[0]||u>ud[1]||v<vd[0]||v>vd[1])throw Error('U/V query lies outside the original native domain');
 return{u,v};
}
export function queryAcceptedSurface(surface:Surface,request:unknown,binding:{objectId:string;source:string;acceptedRevision:number}):SurfaceQueryResult{
 const parameters=surfaceQueryParameters(request,surface),result=evaluateSurfaceD1(surface,parameters.u,parameters.v);
 return{version:0,...binding,surfaceId:surface.id,sourceVersion:0,frame:'native-local-xyz',lengthUnit:'mm',parameters,
 domain:{u:[surface.knotsU[surface.degreeU],surface.knotsU[surface.controlPoints.length]],v:[surface.knotsV[surface.degreeV],surface.knotsV[surface.controlPoints[0].length]]},
 pointMM:[...result.point],duMMPerParameter:[...result.du],dvMMPerParameter:[...result.dv]};
}
