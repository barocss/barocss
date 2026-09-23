import { functionalUtility, staticUtility } from '../core/registry';
import { parseFraction, parseNumber } from '../core/utils';

for (const [name, property] of [
  ['inset-s', 'inset-inline-start'],
  ['inset-e', 'inset-inline-end'],
  ['inset-bs', 'inset-block-start'],
  ['inset-be', 'inset-block-end'],
] as const) {
  for (const [suffix, value] of [
    ['0', '0px'],
    ['auto', 'auto'],
    ['full', '100%'],
    ['px', '1px'],
  ] as const) {
    staticUtility(`${name}-${suffix}`, [[property, value]], { category: 'layout' });
  }
  staticUtility(`-${name}-full`, [[property, '-100%']], { category: 'layout' });
  staticUtility(`-${name}-px`, [[property, '-1px']], { category: 'layout' });

  functionalUtility({
    name,
    prop: property,
    supportsNegative: true,
    supportsFraction: true,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handleBareValue: ({ value }) => {
      if (parseNumber(value)) return `calc(var(--spacing) * ${value})`;
      if (parseFraction(value)) return `calc(${value.replace('/', ' / ')} * 100%)`;
      return null;
    },
    handleNegativeBareValue: ({ value }) => {
      if (parseNumber(value)) return `calc(var(--spacing) * -${value})`;
      if (parseFraction(value)) return `calc(calc(${value.replace('/', ' / ')} * 100%) * -1)`;
      return null;
    },
    category: 'layout',
  });
}
