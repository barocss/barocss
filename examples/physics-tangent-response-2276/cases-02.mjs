// Explicit corrected execution profile. Original case data remain unchanged.
import { cases as originalCases, gates, budget as originalBudget } from './cases.mjs';
export { gates };
export const cases = Object.freeze(originalCases.flatMap(c => c.id === 'high-friction'
 ? [Object.freeze({ ...c, expectedError: 'INVALID_CONFIG' }),
    Object.freeze({ ...c, id: 'upper-supported-friction', muS: 2, muD: 1 })]
 : [c]));
export const budget = Object.freeze({ ...originalBudget, definedCases: 21, creationRefusals: 1 });
