import { functionalUtility } from '../core/registry';

// Tailwind CSS 4.3 uses an integer suffix as a percentage for zoom.
functionalUtility({
  name: 'zoom',
  prop: 'zoom',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => /^\d+$/.test(value) ? `${value}%` : null,
  category: 'transform',
});

// A bare tab suffix is an integer; arbitrary values can use a CSS length.
functionalUtility({
  name: 'tab',
  prop: 'tab-size',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => /^\d+$/.test(value) ? value : null,
  category: 'typography',
});
