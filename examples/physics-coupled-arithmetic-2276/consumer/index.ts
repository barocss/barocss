import{coupledContactTarget,coupledStaticTarget,type CoupledInput,type CoupledResult}from'../emitted/physics-coupled-arithmetic-2276/production-entry.js';
import{runArithmeticTest,type ArithmeticTestRequest,type ArithmeticTestResult}from'../emitted/physics-coupled-arithmetic-2276/test-entry.js';
export const production:(input:CoupledInput)=>CoupledResult=coupledContactTarget;
export const staticControl=coupledStaticTarget;
export const privateTest:(request:ArithmeticTestRequest)=>ArithmeticTestResult=runArithmeticTest;
import*as productionAPI from'../emitted/physics-coupled-arithmetic-2276/production-entry.js';
export const productionInputHasNoLowerLimitHook:('lowerLimits' extends keyof CoupledInput?true:false)=false;
export const productionEntryHasNoTestMethod:('runArithmeticTest' extends keyof typeof productionAPI?true:false)=false;
