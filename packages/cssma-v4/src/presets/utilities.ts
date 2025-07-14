import { staticUtility, functionalUtility } from '../core/registry';
import { decl } from '../core/ast';

// --- Layout: Isolation ---
staticUtility('isolate', [['isolation', 'isolate']]);
staticUtility('isolation-auto', [['isolation', 'auto']]);

// --- Layout: Z-Index ---
staticUtility('z-auto', [['z-index', 'auto']]);
functionalUtility({
  name: 'z',
  supportsNegative: true,
  supportsArbitrary: true, // z-[999], z-[calc(var(--index)+1)] 등 지원
  supportsCustomProperty: true, // z-(--my-z) 지원
  // Tailwind는 themeKey: 'zIndex'이나, 실제 theme lookup은 ctx.theme에서 처리됨
  handleBareValue: ({ value }) => /^-?\d+$/.test(value) ? value : null, // 정수만 허용
  handle: (value) => [decl('z-index', value)],
  description: 'z-index utility (Tailwind CSS 호환)',
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
  supportsFraction: true,
  description: 'aspect-ratio utility (theme, arbitrary, custom property, fraction 지원)',
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
  supportsFraction: true,
  handleBareValue: ({ value }) => /^-?\d+$/.test(value) ? value : null,
  description: 'columns utility (theme, arbitrary, custom property, fraction 지원)',
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

// --- Layout: Box Sizing ---
staticUtility('box-border', [['box-sizing', 'border-box']]);
staticUtility('box-content', [['box-sizing', 'content-box']]);

// --- Layout: Display ---
staticUtility('block', [['display', 'block']]);
staticUtility('inline', [['display', 'inline']]);
staticUtility('inline-block', [['display', 'inline-block']]);
staticUtility('flow-root', [['display', 'flow-root']]);
staticUtility('flex', [['display', 'flex']]);
staticUtility('inline-flex', [['display', 'inline-flex']]);
staticUtility('grid', [['display', 'grid']]);
staticUtility('inline-grid', [['display', 'inline-grid']]);
staticUtility('contents', [['display', 'contents']]);
staticUtility('table', [['display', 'table']]);
staticUtility('inline-table', [['display', 'inline-table']]);
staticUtility('table-caption', [['display', 'table-caption']]);
staticUtility('table-cell', [['display', 'table-cell']]);
staticUtility('table-column', [['display', 'table-column']]);
staticUtility('table-column-group', [['display', 'table-column-group']]);
staticUtility('table-footer-group', [['display', 'table-footer-group']]);
staticUtility('table-header-group', [['display', 'table-header-group']]);
staticUtility('table-row-group', [['display', 'table-row-group']]);
staticUtility('table-row', [['display', 'table-row']]);
staticUtility('list-item', [['display', 'list-item']]);
staticUtility('hidden', [['display', 'none']]);

// --- Layout: Float ---
staticUtility('float-right', [['float', 'right']]);
staticUtility('float-left', [['float', 'left']]);
staticUtility('float-start', [['float', 'inline-start']]);
staticUtility('float-end', [['float', 'inline-end']]);
staticUtility('float-none', [['float', 'none']]);

// --- Layout: Clear ---
staticUtility('clear-left', [['clear', 'left']]);
staticUtility('clear-right', [['clear', 'right']]);
staticUtility('clear-both', [['clear', 'both']]);
staticUtility('clear-start', [['clear', 'inline-start']]);
staticUtility('clear-end', [['clear', 'inline-end']]);
staticUtility('clear-none', [['clear', 'none']]);

// --- Layout: Object Fit ---
staticUtility('object-contain', [['object-fit', 'contain']]);
staticUtility('object-cover', [['object-fit', 'cover']]);
staticUtility('object-fill', [['object-fit', 'fill']]);
staticUtility('object-none', [['object-fit', 'none']]);
staticUtility('object-scale-down', [['object-fit', 'scale-down']]);

// --- Layout: Object Position ---
staticUtility('object-top-left', [['object-position', 'top left']]);
staticUtility('object-top', [['object-position', 'top']]);
staticUtility('object-top-right', [['object-position', 'top right']]);
staticUtility('object-left', [['object-position', 'left']]);
staticUtility('object-center', [['object-position', 'center']]);
staticUtility('object-right', [['object-position', 'right']]);
staticUtility('object-bottom-left', [['object-position', 'bottom left']]);
staticUtility('object-bottom', [['object-position', 'bottom']]);
staticUtility('object-bottom-right', [['object-position', 'bottom right']]);

functionalUtility({
  name: 'object',
  prop: 'object-position',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: 'object-position utility (arbitrary value, custom property 지원)',
  category: 'layout',
});