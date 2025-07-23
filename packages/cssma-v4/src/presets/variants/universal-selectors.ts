import { functionalModifier, escapeClassName } from "../../core/registry";

// --- Universal selector variants (Tailwind 4.x style, supports chaining/:is wrapping) ---
functionalModifier(
  (mod, ctx) => mod === '*',
  ({ selector, fullClassName, variantChain }) => {
    const isSingle = !variantChain || variantChain.length === 1;
    return {
      selector: `:is(.${escapeClassName(fullClassName)} > *)`,
      flatten: true,
      wrappingType: isSingle ? 'rule' : 'style-rule'
    };
  },
  undefined,
  { order: 60 }
);

functionalModifier(
  (mod, ctx) => mod === '**',
  ({ selector, fullClassName }) => {
    return {
      selector: `:is(.${escapeClassName(fullClassName)} *)`,
      flatten: false,
      wrappingType: 'style-rule'
    };
  },
  undefined,
  { order: 61 }
); 