/** A small, explicit sample. It is not a coverage or compatibility percentage. */
export const fixtures = [
  { name: 'display', candidate: 'block', expected: 'match' },
  { name: 'display', candidate: 'hidden', expected: 'match' },
  { name: 'layout', candidate: 'overflow-hidden', expected: 'match' },
  { name: 'typography', candidate: 'text-center', expected: 'match' },
  { name: 'spacing', candidate: 'p-4', expected: 'different' },
  { name: 'negative spacing', candidate: '-mt-4', expected: 'different' },
  { name: 'theme color', candidate: 'bg-red-500', expected: 'match' },
  { name: 'arbitrary color', candidate: 'bg-[#ff0000]', expected: 'match' },
  { name: 'state variant', candidate: 'focus:block', expected: 'different' },
  { name: 'state variant', candidate: 'hover:block', expected: 'different' },
  { name: 'responsive variant', candidate: 'md:block', expected: 'different' },
  { name: 'grid', candidate: 'grid-cols-2', expected: 'match' },
  { name: 'v4 utility', candidate: 'inset-ring-2', expected: 'different' },
  { name: 'form utility', candidate: 'field-sizing-content', expected: 'match' },
  { name: 'mask utility', candidate: 'mask-linear-from-50%', expected: 'different' },
] as const;
