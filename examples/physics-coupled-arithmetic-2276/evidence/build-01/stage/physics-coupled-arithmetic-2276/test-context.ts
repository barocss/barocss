/** Private test admission. Not imported by the production entry or its closure. */
import {createArithmeticContext} from './math-core.js';
import {PRODUCTION_LIMITS,type ArithmeticLimits} from './limits.js';

type LowerKey='bits'|'rationals'|'integerOps'|'gcdSteps'|'subdivisions'|'exponent';
export type LowerLimits=Partial<Pick<ArithmeticLimits,LowerKey>>;
export class TestLimitError extends Error {}
const keys:ReadonlyArray<LowerKey>=Object.freeze(['bits','rationals','integerOps','gcdSteps','subdivisions','exponent']);

export function createTestArithmeticContext(request:unknown) {
  const limits:ArithmeticLimits={...PRODUCTION_LIMITS};
  if(request!==undefined){
    if(request===null||typeof request!=='object'||Array.isArray(request)
      ||(Object.getPrototypeOf(request)!==Object.prototype&&Object.getPrototypeOf(request)!==null))throw new TestLimitError('TEST_LIMIT_INVALID');
    for(const key of Reflect.ownKeys(request)){
      if(typeof key!=='string'||!keys.includes(key as LowerKey))throw new TestLimitError('TEST_LIMIT_INVALID');
      const descriptor=Object.getOwnPropertyDescriptor(request,key);
      if(!descriptor||!('value' in descriptor))throw new TestLimitError('TEST_LIMIT_INVALID');
      const value:unknown=descriptor.value,k=key as LowerKey;
      if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>PRODUCTION_LIMITS[k])throw new TestLimitError('TEST_LIMIT_INVALID');
      limits[k]=value;
    }
  }
  const frozen=Object.freeze(limits);
  return {context:createArithmeticContext(frozen),limits:frozen};
}
