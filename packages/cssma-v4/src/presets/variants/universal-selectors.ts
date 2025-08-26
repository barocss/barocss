import { functionalModifier, escapeClassName } from "../../core/registry";

// --- Universal selector variants (Modern CSS 4.x style, supports chaining/:is wrapping) ---
functionalModifier(
  (mod) => mod === '*',
  ({ selector, fullClassName, variantChain }) => {
    const isSingle = !variantChain || variantChain.length === 1;
    return {
      selector: `:is(.${escapeClassName(fullClassName)} > *)`,
      flatten: true,
      wrappingType: isSingle ? 'rule' : 'style-rule',
      source: 'universal'
    };
  },
  undefined,
);

functionalModifier(
  (mod) => mod === '**',
  ({ selector, fullClassName }) => {
    return {
      selector: `:is(.${escapeClassName(fullClassName)} *)`,
      flatten: false,
      wrappingType: 'style-rule',
      source: 'universal'
    };
  },
  undefined,
); 