import {coupledContactTarget,coupledStaticTarget,type CoupledInput,type CoupledResult} from '../emitted/entry.js';
export const dynamic: (input:CoupledInput)=>CoupledResult=coupledContactTarget;
export const originalStatic=coupledStaticTarget;
export function tag(result:CoupledResult):string{return result.status;}
