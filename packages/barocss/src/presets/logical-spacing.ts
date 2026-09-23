import { functionalUtility, staticUtility } from '../core/registry';
import { parseNumber } from '../core/utils';

for (const [name, property] of [
  ['pbs', 'padding-block-start'],
  ['pbe', 'padding-block-end'],
] as const) {
  staticUtility(`${name}-0`, [[property, '0px']], { category: 'spacing' });
  staticUtility(`${name}-px`, [[property, '1px']], { category: 'spacing' });
  functionalUtility({
    name,
    prop: property,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handleBareValue: ({ value }) =>
      parseNumber(value) ? `calc(var(--spacing) * ${value})` : null,
    category: 'spacing',
  });
}

for (const [name, property] of [
  ['mbs', 'margin-block-start'],
  ['mbe', 'margin-block-end'],
] as const) {
  staticUtility(`${name}-0`, [[property, '0px']], { category: 'spacing' });
  staticUtility(`${name}-auto`, [[property, 'auto']], { category: 'spacing' });
  staticUtility(`${name}-px`, [[property, '1px']], { category: 'spacing' });
  staticUtility(`-${name}-px`, [[property, '-1px']], { category: 'spacing' });
  functionalUtility({
    name,
    prop: property,
    supportsNegative: true,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handleBareValue: ({ value }) =>
      parseNumber(value) ? `calc(var(--spacing) * ${value})` : null,
    handleNegativeBareValue: ({ value }) =>
      parseNumber(value) ? `calc(var(--spacing) * -${value})` : null,
    category: 'spacing',
  });
}
