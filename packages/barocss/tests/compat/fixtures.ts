/** The first 15 measured inputs are defined in the machine-readable catalog. */
import { compatibilityBaseline } from './catalog';

export const fixtures = compatibilityBaseline.cases
  .filter(({ origin, cssStructure }) => origin === 'tailwind' && ['match', 'different', 'unsupported'].includes(cssStructure))
  .map(({ family, input, cssStructure }) => ({
  name: family,
  candidate: input,
  expected: cssStructure,
  }));
