export type CoverageRole = 'representative' | 'boundary' | 'combination';

export type CoverageCase = {
  id: string;
  axis: string;
  family: string;
  role: CoverageRole;
  classes: string[];
  source: string;
};

type CoverageGroup = {
  axis: string;
  family: string;
  source: string;
  representative?: string[];
  boundary?: string[];
  combination?: string[][];
};

// Each input is an exact class candidate, not a claim about its whole family.
// Sources are Tailwind's official documentation or the v4.3 release notes.
const groups: CoverageGroup[] = [
  { axis: 'layout', family: 'display', source: 'https://tailwindcss.com/docs/display', representative: ['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'hidden', 'contents', 'flow-root'] },
  { axis: 'layout', family: 'position-and-inset', source: 'https://tailwindcss.com/docs/position', representative: ['static', 'fixed', 'absolute', 'relative', 'sticky', 'inset-0', 'top-4', 'left-2'], boundary: ['inset-x-2', 'top-[10%]'] },
  { axis: 'layout', family: 'overflow', source: 'https://tailwindcss.com/docs/overflow', representative: ['overflow-auto', 'overflow-hidden', 'overflow-scroll', 'overflow-x-scroll', 'overflow-y-auto', 'overflow-visible'], boundary: ['overscroll-contain', 'overflow-clip'] },
  { axis: 'sizing', family: 'width-and-height', source: 'https://tailwindcss.com/docs/width', representative: ['w-0', 'w-full', 'w-screen', 'w-1/2', 'min-w-0', 'max-w-sm', 'h-0', 'h-full', 'min-h-screen', 'size-12'], boundary: ['w-[37px]', 'aspect-square'] },
  { axis: 'spacing', family: 'padding-and-margin', source: 'https://tailwindcss.com/docs/padding', representative: ['p-4', 'px-4', 'py-2', 'm-4', 'mx-auto', 'mt-2', 'gap-4', 'gap-x-2'], boundary: ['p-0', 'p-px', 'p-[3px]', 'pt-[3px]', 'm-0', 'm-auto', '-mt-4', 'gap-0'] },
  { axis: 'flex-and-grid', family: 'flexbox', source: 'https://tailwindcss.com/docs/flex', representative: ['flex-row', 'flex-col', 'flex-wrap', 'flex-1', 'flex-none', 'grow', 'shrink-0', 'items-center', 'justify-between', 'self-end'], boundary: ['order-last', 'basis-1/2'] },
  { axis: 'flex-and-grid', family: 'grid', source: 'https://tailwindcss.com/docs/grid-template-columns', representative: ['grid-cols-2', 'grid-cols-12', 'grid-rows-2', 'col-span-2', 'row-span-2', 'auto-cols-fr'], boundary: ['grid-cols-none', 'col-start-1'] },
  { axis: 'typography', family: 'type-and-text', source: 'https://tailwindcss.com/docs/font-size', representative: ['text-xs', 'text-base', 'text-xl', 'font-normal', 'font-semibold', 'leading-none', 'text-center', 'text-right', 'uppercase', 'italic', 'underline', 'truncate'], boundary: ['text-[14px]', 'leading-[1.7]', 'whitespace-nowrap', 'break-all'] },
  { axis: 'backgrounds', family: 'background', source: 'https://tailwindcss.com/docs/background-color', representative: ['bg-red-500', 'bg-transparent', 'bg-cover', 'bg-center', 'bg-no-repeat', 'bg-linear-to-r', 'from-red-500', 'to-transparent'], boundary: ['bg-[#ff0000]', 'bg-red-500/50'] },
  { axis: 'borders', family: 'border-and-outline', source: 'https://tailwindcss.com/docs/border-width', representative: ['border', 'border-2', 'border-red-500', 'rounded', 'rounded-lg', 'rounded-full', 'outline', 'outline-2'], boundary: ['border-0', 'rounded-[8px]', 'outline-offset-2'] },
  { axis: 'effects', family: 'shadow-and-opacity', source: 'https://tailwindcss.com/docs/box-shadow', representative: ['shadow', 'shadow-md', 'opacity-50', 'mix-blend-multiply', 'ring-2', 'inset-ring-2'], boundary: ['opacity-0', 'opacity-100', 'shadow-[0_4px_8px_#0002]'] },
  { axis: 'filters', family: 'filter-and-backdrop', source: 'https://tailwindcss.com/docs/filter', representative: ['blur', 'blur-sm', 'brightness-50', 'grayscale', 'backdrop-blur-sm'], boundary: ['grayscale-0', 'blur-[3px]', 'backdrop-brightness-50'] },
  { axis: 'transforms', family: 'transform', source: 'https://tailwindcss.com/docs/transform', representative: ['rotate-45', 'scale-95', 'translate-x-2', 'skew-x-6', 'origin-center'], boundary: ['-translate-y-1', 'rotate-[13deg]', 'scale-0'] },
  { axis: 'transitions', family: 'transition-and-animation', source: 'https://tailwindcss.com/docs/transition-property', representative: ['transition', 'transition-colors', 'duration-300', 'ease-in-out', 'delay-150', 'animate-spin'], boundary: ['duration-0', 'transition-none'] },
  { axis: 'interactivity', family: 'interaction', source: 'https://tailwindcss.com/docs/cursor', representative: ['cursor-pointer', 'pointer-events-none', 'select-none', 'touch-pan-x', 'scroll-smooth', 'resize-none'], boundary: ['cursor-not-allowed', 'pointer-events-auto'] },
  { axis: 'svg-and-accessibility', family: 'svg-and-screen-reader', source: 'https://tailwindcss.com/docs/fill', representative: ['fill-red-500', 'stroke-red-500', 'stroke-2', 'sr-only', 'not-sr-only'], boundary: ['fill-none', 'stroke-[3px]'] },
  { axis: 'variants', family: 'state-and-structural', source: 'https://tailwindcss.com/docs/hover-focus-and-other-states', representative: ['hover:block', 'focus:block', 'active:block', 'disabled:opacity-50', 'group-hover:block', 'peer-checked:block', 'first:block', 'last:block', 'odd:bg-red-500', 'dark:bg-red-500'], boundary: ['focus-visible:block', 'not-hover:block', 'has-[input:checked]:block'] },
  { axis: 'variants', family: 'responsive-and-arbitrary', source: 'https://tailwindcss.com/docs/responsive-design', representative: ['sm:block', 'md:block', 'lg:block', 'max-md:hidden', 'md:hover:block'], boundary: ['hover:focus:block', '[&>p]:block', 'md:focus-visible:block'] },
  { axis: 'syntax', family: 'arbitrary-and-negative', source: 'https://tailwindcss.com/docs/adding-custom-styles', representative: ['min-w-[13px]', 'h-[27px]', 'border-[#ff0000]', 'grid-cols-[1fr_2fr]', 'inset-[3px]', 'mt-[-2px]'], boundary: ['-translate-x-1/2', 'bg-(--custom-color)'] },
  { axis: 'syntax', family: 'important-modifier', source: 'https://tailwindcss.com/docs/styling-with-utility-classes', representative: ['bg-red-500!', 'p-4!'], boundary: ['!bg-red-500', '!p-4'] },
  { axis: 'v4.2-and-v4.3', family: 'logical-properties', source: 'https://tailwindcss.com/blog/tailwindcss-v4-3', representative: ['pbs-4', 'mbs-6', 'inline-full', 'block-24', 'inset-bs-2', 'inset-e-4'] },
  { axis: 'v4.2-and-v4.3', family: 'new-utilities', source: 'https://tailwindcss.com/blog/tailwindcss-v4-3', representative: ['scrollbar-auto', 'scrollbar-thin', 'scrollbar-none', 'scrollbar-gutter-stable', '@container-size'], boundary: ['@container-size/sidebar', 'font-features-["tnum"]', 'scrollbar-thumb-red-500'] },
  { axis: 'v4.2-and-v4.3', family: 'scrollbar-width-variants', source: 'https://tailwindcss.com/docs/scrollbar-width', representative: ['md:scrollbar-auto', 'hover:scrollbar-thin'], boundary: ['scrollbar-[3px]'], combination: [['scrollbar-none', 'overflow-auto']] },
  { axis: 'v4.2-and-v4.3', family: 'scrollbar-gutter', source: 'https://tailwindcss.com/docs/scrollbar-gutter', representative: ['scrollbar-gutter-auto', 'scrollbar-gutter-both'] },
  { axis: 'v4.2-and-v4.3', family: 'scrollbar-gutter-variants', source: 'https://tailwindcss.com/docs/hover-focus-and-other-states', representative: ['hover:scrollbar-gutter-stable'] },
  { axis: 'v4.2-and-v4.3', family: 'scrollbar-color', source: 'https://tailwindcss.com/docs/scrollbar-color', representative: ['scrollbar-thumb-transparent', 'scrollbar-track-red-500'] },
  { axis: 'v4.2-and-v4.3', family: 'size-container', source: 'https://tailwindcss.com/docs/responsive-design', representative: ['@container-size/card'], boundary: ['@container-size/card-grid', '@container-size/'] },
  { axis: 'v4.2-and-v4.3', family: 'zoom', source: 'https://tailwindcss.com/docs/zoom', representative: ['zoom-0', 'zoom-75', 'zoom-100', 'zoom-125'], boundary: ['zoom-[1.1]', 'zoom-[80%]', 'zoom-(--scale)', 'zoom-1.5', 'zoom-auto'], combination: [['zoom-100', 'hover:zoom-125'], ['zoom-75', 'tab-2']] },
  { axis: 'v4.2-and-v4.3', family: 'tab-size', source: 'https://tailwindcss.com/docs/tab-size', representative: ['tab-0', 'tab-2', 'tab-4'], boundary: ['tab-[12px]', 'tab-(--size)', 'tab-1.5', 'tab-none'], combination: [['tab-2', 'md:tab-4']] },
  { axis: 'combinations', family: 'same-element-classes', source: 'https://tailwindcss.com/docs/styling-with-utility-classes', combination: [['block', 'p-4'], ['flex', 'items-center', 'gap-4'], ['bg-red-500', 'hover:bg-red-500'], ['hidden', 'md:block'], ['rounded-lg', 'border', 'shadow-md'], ['p-0', 'p-4']] },
  { axis: 'combinations', family: 'scrollbar-gutter-and-overflow', source: 'https://tailwindcss.com/docs/scrollbar-gutter', combination: [['overflow-auto', 'scrollbar-gutter-stable'], ['overflow-scroll', 'scrollbar-gutter-both']] },
];

export const coverageCases: CoverageCase[] = groups.flatMap(({ axis, family, source, representative = [], boundary = [], combination = [] }) => [
  ...representative.map((input) => ({ id: `${family}:${input}`, axis, family, role: 'representative' as const, classes: [input], source })),
  ...boundary.map((input) => ({ id: `${family}:${input}`, axis, family, role: 'boundary' as const, classes: [input], source })),
  ...combination.map((classes) => ({ id: `${family}:${classes.join('+')}`, axis, family, role: 'combination' as const, classes, source })),
]);

// These routes need different harnesses. Keeping them explicit prevents the
// utility-only CSS run from being mistaken for full Tailwind coverage.
export const coverageBacklog = [
  { axis: 'base styles', topic: 'Preflight reset and defaults', source: 'https://tailwindcss.com/docs/preflight', status: 'unverified' },
  { axis: 'theme', topic: 'Default theme and custom theme variable combinations', source: 'https://tailwindcss.com/docs/theme', status: 'unverified' },
  { axis: 'directives', topic: '@apply and @reference', source: 'https://tailwindcss.com/docs/functions-and-directives', status: 'unverified' },
  { axis: 'directives', topic: '@utility with static, functional, and default values', source: 'https://tailwindcss.com/docs/adding-custom-styles', status: 'unverified' },
  { axis: 'directives', topic: '@variant with stacked and compound selectors', source: 'https://tailwindcss.com/blog/tailwindcss-v4-3', status: 'unverified' },
  { axis: 'build input', topic: 'Source scanning and @source', source: 'https://tailwindcss.com/docs/detecting-classes-in-source-files', status: 'unverified' },
  { axis: 'build input', topic: 'Plugins, transforms, and integration paths', source: 'https://tailwindcss.com/docs/installation/using-vite', status: 'unverified' },
  { axis: 'composition', topic: 'Class ordering, conflicting utilities, and specificity', source: 'https://tailwindcss.com/docs/styling-with-utility-classes', status: 'unverified' },
  { axis: 'browser', topic: 'Computed styles and pixels for new CSS differences', source: 'https://tailwindcss.com/docs/hover-focus-and-other-states', status: 'unverified' },
  { axis: 'browser', topic: 'Firefox, WebKit, modes, viewports, and runtime lifecycle', source: 'https://tailwindcss.com/docs/responsive-design', status: 'unverified' },
] as const;
