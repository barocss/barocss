/**
 * A small, explicit sample. It is not a coverage or compatibility percentage.
 * #312: compared structurally (flatRules) against Tailwind 4.3, so nesting / media-syntax / @property shape no longer
 * counts as 'different'. p-4 and -mt-4 stay 'different': the input's `@theme inline { --spacing }` makes Tailwind
 * inline the value, while BaroCSS keeps `calc(var(--spacing) * n)`.
 */
export const fixtures = [
  { name: 'display', candidate: 'block', expected: 'match' },
  { name: 'display', candidate: 'hidden', expected: 'match' },
  { name: 'layout', candidate: 'overflow-hidden', expected: 'match' },
  { name: 'typography', candidate: 'text-center', expected: 'match' },
  { name: 'spacing', candidate: 'p-4', expected: 'different' },
  { name: 'negative spacing', candidate: '-mt-4', expected: 'different' },
  { name: 'theme color', candidate: 'bg-red-500', expected: 'match' },
  { name: 'arbitrary color', candidate: 'bg-[#ff0000]', expected: 'match' },
  { name: 'state variant', candidate: 'focus:block', expected: 'match' },
  { name: 'state variant', candidate: 'hover:block', expected: 'match' },
  { name: 'responsive variant', candidate: 'md:block', expected: 'match' },
  { name: 'grid', candidate: 'grid-cols-2', expected: 'match' },
  { name: 'v4 utility', candidate: 'inset-ring-2', expected: 'match' },
  { name: 'form utility', candidate: 'field-sizing-content', expected: 'match' },
  { name: 'mask utility', candidate: 'mask-linear-from-50%', expected: 'match' },
] as const;
