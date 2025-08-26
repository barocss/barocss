import { staticUtility, functionalUtility } from "../core/registry";
import { decl } from "../core/ast";
import {
  parseFractionOrNumber,
  parseNumber,
} from "../core/utils";

// Import layout utilities
import "./layout";
import "./flexbox-grid";
import "./spacing";


// --- Sizing: width (w-*) and size (size-*) ---
//  width documentation

// w-* static values
[
  ['w-auto', 'auto'],
  ['w-px', '1px'],
  ['w-full', '100%'],
  ['w-screen', '100vw'],
  ['w-dvw', '100dvw'],
  ['w-dvh', '100dvh'],
  ['w-lvw', '100lvw'],
  ['w-lvh', '100lvh'],
  ['w-svw', '100svw'],
  ['w-svh', '100svh'],
  ['w-min', 'min-content'],
  ['w-max', 'max-content'],
  ['w-fit', 'fit-content'],
  ['w-3xs', 'var(--container-3xs)'],
  ['w-2xs', 'var(--container-2xs)'],
  ['w-xs', 'var(--container-xs)'],
  ['w-sm', 'var(--container-sm)'],
  ['w-md', 'var(--container-md)'],
  ['w-lg', 'var(--container-lg)'],
  ['w-xl', 'var(--container-xl)'],
  ['w-2xl', 'var(--container-2xl)'],
  ['w-3xl', 'var(--container-3xl)'],
  ['w-4xl', 'var(--container-4xl)'],
  ['w-5xl', 'var(--container-5xl)'],
  ['w-6xl', 'var(--container-6xl)'],
  ['w-7xl', 'var(--container-7xl)'],
].forEach(([name, value]) => {
  staticUtility(name, [['width', value]]);
});

// w-* functional: spacing scale, fraction, arbitrary, custom property
functionalUtility({
  name: 'w',
  prop: 'width',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsFraction: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) {
      return `calc(var(--spacing) * ${value})`;
    }
    if (parseFractionOrNumber(value)) return `calc(${value} * 100%)`;
    return null;
  },
  description: 'width utility (spacing, fraction, arbitrary, custom property, container scale, static 지원)',
  category: 'sizing',
});

// size-* static values
[
  ['size-auto', ['auto', 'auto']],
  ['size-px', ['1px', '1px']],
  ['size-full', ['100%', '100%']],
  ['size-dvw', ['100dvw', '100dvw']],
  ['size-dvh', ['100dvh', '100dvh']],
  ['size-lvw', ['100lvw', '100lvw']],
  ['size-lvh', ['100lvh', '100lvh']],
  ['size-svw', ['100svw', '100svw']],
  ['size-svh', ['100svh', '100svh']],
  ['size-min', ['min-content', 'min-content']],
  ['size-max', ['max-content', 'max-content']],
  ['size-fit', ['fit-content', 'fit-content']],
].forEach(([name, [w, h]]) => {
  staticUtility(name as string, [['width', w], ['height', h]]);
});

// size-* functional: spacing scale, fraction, arbitrary, custom property
functionalUtility({
  name: 'size',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsFraction: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) {
      return `calc(var(--spacing) * ${value})`;
    }
    if (parseFractionOrNumber(value)) return `calc(${value} * 100%)`;
    return null;
  },
  handle: (value) => {
    // arbitrary, custom property, etc.
    return [
      decl('width', value),
      decl('height', value),
    ];
  },
  handleCustomProperty: (value) => [
    decl('width', `var(${value})`),
    decl('height', `var(${value})`),
  ],
  description: 'size utility (spacing, fraction, arbitrary, custom property, static 지원)',
  category: 'sizing',
});

// --- Sizing: height (h-*) ---
//  height documentation

// h-* static values
[
  ['h-auto', 'auto'],
  ['h-px', '1px'],
  ['h-full', '100%'],
  ['h-screen', '100vh'],
  ['h-dvh', '100dvh'],
  ['h-lvh', '100lvh'],
  ['h-svh', '100svh'],
  ['h-min', 'min-content'],
  ['h-max', 'max-content'],
  ['h-fit', 'fit-content'],
].forEach(([name, value]) => {
  staticUtility(name, [['height', value]]);
});

// h-* functional: spacing scale, fraction, arbitrary, custom property
functionalUtility({
  name: 'h',
  prop: 'height',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsFraction: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) {
      return `calc(var(--spacing) * ${value})`;
    }
    if (parseFractionOrNumber(value)) return `calc(${value} * 100%)`;
    return null;
  },
  description: 'height utility (spacing, fraction, arbitrary, custom property, static 지원)',
  category: 'sizing',
});

// --- Sizing: min-height (min-h-*) ---
//  min-height documentation

// min-h-* static values
[
  ['min-h-0', '0px'],
  ['min-h-px', '1px'],
  ['min-h-full', '100%'],
  ['min-h-screen', '100vh'],
  ['min-h-dvh', '100dvh'],
  ['min-h-lvh', '100lvh'],
  ['min-h-svh', '100svh'],
  ['min-h-min', 'min-content'],
  ['min-h-max', 'max-content'],
  ['min-h-fit', 'fit-content'],
].forEach(([name, value]) => {
  staticUtility(name, [['min-height', value]]);
});

// min-h-* functional: spacing scale, fraction, arbitrary, custom property
functionalUtility({
  name: 'min-h',
  prop: 'min-height',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsFraction: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) {
      return `calc(var(--spacing) * ${value})`;
    }
    if (parseFractionOrNumber(value)) return `calc(${value} * 100%)`;
    return null;
  },
  description: 'min-height utility (spacing, fraction, arbitrary, custom property, static 지원)',
  category: 'sizing',
});

// --- Sizing: max-height (max-h-*) ---
//  max-height documentation

// max-h-* static values
[
  ['max-h-px', '1px'],
  ['max-h-full', '100%'],
  ['max-h-screen', '100vh'],
  ['max-h-dvh', '100dvh'],
  ['max-h-lvh', '100lvh'],
  ['max-h-svh', '100svh'],
  ['max-h-min', 'min-content'],
  ['max-h-max', 'max-content'],
  ['max-h-fit', 'fit-content'],
  ['max-h-none', 'none'],
].forEach(([name, value]) => {
  staticUtility(name, [['max-height', value]]);
});

// max-h-* functional: spacing scale, fraction, arbitrary, custom property
functionalUtility({
  name: 'max-h',
  prop: 'max-height',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsFraction: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) {
      return `calc(var(--spacing) * ${value})`;
    }
    if (parseFractionOrNumber(value)) return `calc(${value} * 100%)`;
    return null;
  },
  description: 'max-height utility (spacing, fraction, arbitrary, custom property, static 지원)',
  category: 'sizing',
});

// --- Sizing: min-width (min-w-*) ---
//  min-width documentation

// min-w-* static values
[
  ['min-w-auto', 'auto'],
  ['min-w-px', '1px'],
  ['min-w-full', '100%'],
  ['min-w-screen', '100vw'],
  ['min-w-dvw', '100dvw'],
  ['min-w-dvh', '100dvh'],
  ['min-w-lvw', '100lvw'],
  ['min-w-lvh', '100lvh'],
  ['min-w-svw', '100svw'],
  ['min-w-svh', '100svh'],
  ['min-w-min', 'min-content'],
  ['min-w-max', 'max-content'],
  ['min-w-fit', 'fit-content'],
  ['min-w-3xs', 'var(--container-3xs)'],
  ['min-w-2xs', 'var(--container-2xs)'],
  ['min-w-xs', 'var(--container-xs)'],
  ['min-w-sm', 'var(--container-sm)'],
  ['min-w-md', 'var(--container-md)'],
  ['min-w-lg', 'var(--container-lg)'],
  ['min-w-xl', 'var(--container-xl)'],
  ['min-w-2xl', 'var(--container-2xl)'],
  ['min-w-3xl', 'var(--container-3xl)'],
  ['min-w-4xl', 'var(--container-4xl)'],
  ['min-w-5xl', 'var(--container-5xl)'],
  ['min-w-6xl', 'var(--container-6xl)'],
  ['min-w-7xl', 'var(--container-7xl)'],
].forEach(([name, value]) => {
  staticUtility(name, [['min-width', value]]);
});

// min-w-* functional: spacing scale, fraction, arbitrary, custom property
functionalUtility({
  name: 'min-w',
  prop: 'min-width',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsFraction: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) {
      return `calc(var(--spacing) * ${value})`;
    }
    if (parseFractionOrNumber(value)) return `calc(${value} * 100%)`;
    return null;
  },
  description: 'min-width utility (spacing, fraction, arbitrary, custom property, static 지원)',
  category: 'sizing',
});