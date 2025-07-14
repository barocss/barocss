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
  handleBareValue: ({ value }) => /^-?\d+$/.test(value) ? value : null,
  handle: (value) => [decl('z-index', value)],
  description: 'z-index utility',
  category: 'layout',
});

// --- Layout: Aspect Ratio ---
staticUtility('aspect-square', [['aspect-ratio', '1 / 1']]);
staticUtility('aspect-video', [['aspect-ratio', 'var(--aspect-ratio-video)']]);
staticUtility('aspect-auto', [['aspect-ratio', 'auto']]);
functionalUtility({
  name: 'aspect',
  prop: 'aspect-ratio',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: 'aspect-ratio utility (theme, arbitrary, custom property 지원)',
  category: 'layout',
});

// --- Layout: Columns ---
staticUtility('columns-auto', [['columns', 'auto']]);
staticUtility('columns-3xs', [['columns', 'var(--container-3xs)']]);
staticUtility('columns-2xs', [['columns', 'var(--container-2xs)']]);
staticUtility('columns-xs', [['columns', 'var(--container-xs)']]);
staticUtility('columns-sm', [['columns', 'var(--container-sm)']]);
staticUtility('columns-md', [['columns', 'var(--container-md)']]);
staticUtility('columns-lg', [['columns', 'var(--container-lg)']]);
staticUtility('columns-xl', [['columns', 'var(--container-xl)']]);
staticUtility('columns-2xl', [['columns', 'var(--container-2xl)']]);
staticUtility('columns-3xl', [['columns', 'var(--container-3xl)']]);
staticUtility('columns-4xl', [['columns', 'var(--container-4xl)']]);
staticUtility('columns-5xl', [['columns', 'var(--container-5xl)']]);
staticUtility('columns-6xl', [['columns', 'var(--container-6xl)']]);
staticUtility('columns-7xl', [['columns', 'var(--container-7xl)']]);
functionalUtility({
  name: 'columns',
  prop: 'columns',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => /^-?\d+$/.test(value) ? value : null,
  description: 'columns utility (theme, arbitrary, custom property 지원)',
  category: 'layout',
});

// --- Layout: Break After ---
staticUtility('break-after-auto', [['break-after', 'auto']]);
staticUtility('break-after-avoid', [['break-after', 'avoid']]);
staticUtility('break-after-all', [['break-after', 'all']]);
staticUtility('break-after-avoid-page', [['break-after', 'avoid-page']]);
staticUtility('break-after-page', [['break-after', 'page']]);
staticUtility('break-after-left', [['break-after', 'left']]);
staticUtility('break-after-right', [['break-after', 'right']]);
staticUtility('break-after-column', [['break-after', 'column']]);

// --- Layout: Break Before ---
staticUtility('break-before-auto', [['break-before', 'auto']]);
staticUtility('break-before-avoid', [['break-before', 'avoid']]);
staticUtility('break-before-all', [['break-before', 'all']]);
staticUtility('break-before-avoid-page', [['break-before', 'avoid-page']]);
staticUtility('break-before-page', [['break-before', 'page']]);
staticUtility('break-before-left', [['break-before', 'left']]);
staticUtility('break-before-right', [['break-before', 'right']]);
staticUtility('break-before-column', [['break-before', 'column']]);

// --- Layout: Break Inside ---
staticUtility('break-inside-auto', [['break-inside', 'auto']]);
staticUtility('break-inside-avoid', [['break-inside', 'avoid']]);
staticUtility('break-inside-avoid-page', [['break-inside', 'avoid-page']]);
staticUtility('break-inside-avoid-column', [['break-inside', 'avoid-column']]);

// --- Layout: Box Decoration Break ---
staticUtility('box-decoration-slice', [['box-decoration-break', 'slice']]);
staticUtility('box-decoration-clone', [['box-decoration-break', 'clone']]);

// --- Flex/Grid Order ---
staticUtility('order-first', [['order', '-9999']]);
staticUtility('order-last', [['order', '9999']]);
functionalUtility({
  name: 'order',
  supportsNegative: true,
  themeKeys: ['--order'],
  handleBareValue: ({ value }) => /^-?\d+$/.test(value) ? value : null,
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
  handleBareValue: ({ value }) => /^-?\d+$/.test(value) ? value : null,
  handle: (value) => [decl('grid-column', value)],
  description: 'grid-column utility',
  category: 'grid',
});
staticUtility('col-span-full', [['grid-column', '1 / -1']]);
functionalUtility({
  name: 'col-span',
  handleBareValue: ({ value }) => /^-?\d+$/.test(value) ? value : null,
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
  handleBareValue: ({ value }) => /^-?\d+$/.test(value) ? value : null,
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
  handleBareValue: ({ value }) => /^-?\d+$/.test(value) ? value : null,
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
  handleBareValue: ({ value }) => value ? value : null,
  description: 'background-color (theme, arbitrary, custom property, negative, fraction 지원)',
  category: 'color',
});

// --- 추가 유틸리티는 아래와 같이 선언적으로 등록 가능 ---
// functionalUtility({ ... });
// staticUtility('inline-block', [['display', 'inline-block']]); 