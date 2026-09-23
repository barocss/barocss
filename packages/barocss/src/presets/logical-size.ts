import { functionalUtility, staticUtility } from '../core/registry';
import { parseFractionOrNumber, parseNumber } from '../core/utils';

const viewportSizes = [
  ['dvw', '100dvw'],
  ['dvh', '100dvh'],
  ['lvw', '100lvw'],
  ['lvh', '100lvh'],
  ['svw', '100svw'],
  ['svh', '100svh'],
] as const;

const sharedSizes = [
  ['auto', 'auto'],
  ['px', '1px'],
  ['full', '100%'],
  ['min', 'min-content'],
  ['max', 'max-content'],
  ['fit', 'fit-content'],
  ...viewportSizes,
] as const;

for (const [name, property, screen] of [
  ['inline', 'inline-size', '100vw'],
  ['block', 'block-size', '100vh'],
] as const) {
  for (const [suffix, value] of [...sharedSizes, ['screen', screen]] as const) {
    staticUtility(`${name}-${suffix}`, [[property, value]], { category: 'sizing' });
  }
}

for (const suffix of ['3xs', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl']) {
  staticUtility(`inline-${suffix}`, [['inline-size', `var(--container-${suffix})`]], { category: 'sizing' });
}

staticUtility('block-lh', [['block-size', '1lh']], { category: 'sizing' });

for (const [name, property] of [
  ['inline', 'inline-size'],
  ['block', 'block-size'],
] as const) {
  functionalUtility({
    name,
    prop: property,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    supportsFraction: true,
    handleBareValue: ({ value }) => {
      if (parseNumber(value)) return `calc(var(--spacing) * ${value})`;
      if (parseFractionOrNumber(value)) return `calc(${value.replace('/', ' / ')} * 100%)`;
      return null;
    },
    category: 'sizing',
  });
}
