import { staticUtility, functionalUtility } from '../core/registry';
import { decl } from '../core/ast';

// --- Layout: Display ---
staticUtility('block', [['display', 'block']]);
staticUtility('hidden', [['display', 'none']]);
staticUtility('flex', [['display', 'flex']]);
staticUtility('inline-block', [['display', 'inline-block']]);
staticUtility('inline', [['display', 'inline']]);
staticUtility('table', [['display', 'table']]);
staticUtility('table-row', [['display', 'table-row']]);
staticUtility('table-cell', [['display', 'table-cell']]);
staticUtility('table-caption', [['display', 'table-caption']]);
staticUtility('table-header-group', [['display', 'table-header-group']]);
staticUtility('table-footer-group', [['display', 'table-footer-group']]);

// --- Layout: Isolation ---
staticUtility('isolate', [['isolation', 'isolate']]);
staticUtility('isolation-auto', [['isolation', 'auto']]);

// --- Layout: Z-Index ---
staticUtility('z-auto', [['z-index', 'auto']]);
functionalUtility({
  name: 'z',
  supportsNegative: true,
  themeKeys: ['--z-index'],
  handleBareValue: ({ value }) => /^\d+$/.test(value) ? value : null,
  handle: (value) => [decl('z-index', value)],
  description: 'z-index utility',
  category: 'layout',
});

// --- Flex/Grid Order ---
staticUtility('order-first', [['order', '-9999']]);
staticUtility('order-last', [['order', '9999']]);
functionalUtility({
  name: 'order',
  supportsNegative: true,
  themeKeys: ['--order'],
  handleBareValue: ({ value }) => /^\d+$/.test(value) ? value : null,
  handle: (value) => [decl('order', value)],
  description: 'order utility',
  category: 'layout',
});

// --- Grid Column ---
staticUtility('col-auto', [['grid-column', 'auto']]);
functionalUtility({
  name: 'col',
  supportsNegative: true,
  themeKeys: ['--grid-column'],
  handleBareValue: ({ value }) => /^\d+$/.test(value) ? value : null,
  handle: (value) => [decl('grid-column', value)],
  description: 'grid-column utility',
  category: 'grid',
});
staticUtility('col-span-full', [['grid-column', '1 / -1']]);
functionalUtility({
  name: 'col-span',
  handleBareValue: ({ value }) => /^\d+$/.test(value) ? value : null,
  handle: (value) => [decl('grid-column', `span ${value} / span ${value}`)],
  description: 'grid-column span utility',
  category: 'grid',
});

// --- Grid Column Start ---
staticUtility('col-start-auto', [['grid-column-start', 'auto']]);
functionalUtility({
  name: 'col-start',
  supportsNegative: true,
  themeKeys: ['--grid-column-start'],
  handleBareValue: ({ value }) => /^\d+$/.test(value) ? value : null,
  handle: (value) => [decl('grid-column-start', value)],
  description: 'grid-column-start utility',
  category: 'grid',
});

// --- Grid Column End ---
staticUtility('col-end-auto', [['grid-column-end', 'auto']]);
functionalUtility({
  name: 'col-end',
  supportsNegative: true,
  themeKeys: ['--grid-column-end'],
  handleBareValue: ({ value }) => /^\d+$/.test(value) ? value : null,
  handle: (value) => [decl('grid-column-end', value)],
  description: 'grid-column-end utility',
  category: 'grid',
});

// --- Background Color (bg) ---
functionalUtility({
  name: 'bg',
  prop: 'background-color',
  themeKey: 'colors',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsNegative: true,
  description: 'background-color (theme, arbitrary, custom property, negative, fraction 지원)',
  category: 'color',
});

// --- 추가 유틸리티는 아래와 같이 선언적으로 등록 가능 ---
// functionalUtility({ ... });
// staticUtility('inline-block', [['display', 'inline-block']]); 