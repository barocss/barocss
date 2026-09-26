import { functionalModifier } from "../../core/registry";

// --- Universal selector variants ( 4.x style, supports chaining/:is wrapping) ---
functionalModifier(
  (mod) => mod === '*',
  () => {
    // Tailwind: `:is(.cls > *)` — the direct children, not the element itself.
    return { selector: ':is(& > *)', wrappingType: 'rule', source: 'universal' };
  },
  undefined,
);

functionalModifier(
  (mod) => mod === '**',
  () => ({ selector: ':is(& *)', wrappingType: 'rule', source: 'universal' }),
  undefined,
); 