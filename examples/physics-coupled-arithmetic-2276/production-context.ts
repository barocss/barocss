import {createArithmeticContext} from './math-core.js';
import {PRODUCTION_LIMITS} from './limits.js';
/** No caller-supplied limits and no test import. */
export function createProductionContext(){return createArithmeticContext(PRODUCTION_LIMITS);}
