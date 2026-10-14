// Kernel refusals are precise but written for kernel authors. Map them to what a designer can act on.
export interface FriendlyError { title: string; hint: string; detail: string }

const rules: { test: RegExp; title: string; hint: string }[] = [
  { test: /pole chart|not exactly representable|lift is not exact|exact whole-curve/i,
    title: 'This size isn’t supported yet',
    hint: 'The kernel only accepts sizes that divide the part evenly in binary (for example 64 × 32 with a 4 mm hole). Try a round power-of-two ratio such as 8, 16, 32 or 64 mm.' },
  { test: /requires a direct rectangular extrusion|Hole requires/i,
    title: 'Holes can only go on a plain rectangular plate',
    hint: 'Add the hole right after the first extrusion. Holes on Boolean results, cylinders or a second hole are not supported yet.' },
  { test: /authored rectangles|Integer-box Boolean/i,
    title: 'Booleans need two axis-aligned boxes',
    hint: 'Union and subtract currently work on rectangular extrusions with whole-millimetre corners. Cylinders and rotated bodies can’t be combined yet.' },
  { test: /operation count exceeded|count exceeded|cardinality|exceeds/i,
    title: 'The model is at the kernel’s size limit',
    hint: 'The kernel evaluates at most 6 features per part today. Remove or combine a feature, or start a new part.' },
  { test: /convex|concave/i,
    title: 'Sketch profiles must be convex',
    hint: 'Draw the shape as a convex outline (no inward corners) with 3–8 points, or build an L or T shape from two boxes and Union them.' },
  { test: /Third end supports must be perpendicular|\bchamfer\b/i,
    title: 'This edge can’t be chamfered here',
    hint: 'Chamfer works on up to two straight, axis-parallel edges of a plain box, and not next to an earlier chamfer.' },
  { test: /strictly below|must be positive|positive (length|radius|height)|non-?zero/i,
    title: 'Sizes must be greater than zero',
    hint: 'Every width, depth, height and radius needs a positive value.' },
  { test: /\bquarter\b|\brotation angle\b|\bangleDegrees\b|\bangle must\b/i,
    title: 'Only quarter turns are supported',
    hint: 'Rotate by 90°, 180° or 270° about X, Y or Z.' },
  { test: /terminal|edge queries|does not support/i,
    title: 'This result can’t be modified further yet',
    hint: 'Moved, rotated, mirrored and patterned copies are final in this version. Apply them as the last step.' },
];

export function friendly(message: string): FriendlyError {
  const detail = message.replace(/^(CAD model [a-z ]+:\s*)+/i, '').trim();
  for (const rule of rules) if (rule.test.test(message)) return { title: rule.title, hint: rule.hint, detail };
  return { title: 'The kernel could not build this', hint: 'Undo the last change, or adjust the values and try again.', detail };
}
