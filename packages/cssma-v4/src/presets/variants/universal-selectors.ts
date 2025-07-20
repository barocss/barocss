import { functionalModifier } from "../../core/registry";

// --- Universal selector variants (Tailwind 4.x style, supports chaining/:is wrapping) ---
functionalModifier(
  (mod) => mod === '*',
  ({ selector, fullClassName }) => {
    // Tailwind 4.x: :is(.class > *)
    const result = `:is(.${fullClassName} > *)`;
    return result;
  },
  undefined,
  { order: 60 }
);

functionalModifier(
  (mod) => mod === '**',
  ({ selector, fullClassName }) => {
    // Tailwind 4.x: :is(.class *)
    const result = `:is(.${fullClassName} *)`;
    return result;
  },
  undefined,
  { order: 61 }
); 