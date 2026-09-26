import { functionalModifier } from "../../core/registry";
import { atRule } from "../../core/ast";

// --- At-rule variants ---

// #354: supports-[…] and named supports-<feature>, as Tailwind 4.3.3 builds the condition: a function-like
// value (`selector(…)`) is used as is, a value without `:` becomes `<value>: var(--tw)`, and the result is
// wrapped in parentheses unless it already is (`supports-grid` → `@supports (grid: var(--tw))`).
function supportsCondition(value: string): string {
  if (/^[\w-]*\s*\(/.test(value)) return value;
  let v = value.includes(':') ? value : `${value}: var(--tw)`;
  if (v[0] !== '(' || v[v.length - 1] !== ')') v = `(${v})`;
  return v;
}
functionalModifier(
  (mod: string) => /^supports-(?:\[.+\]|[a-zA-Z-][a-zA-Z0-9-]*)$/.test(mod),
  undefined,
  (mod) => {
    const m = /^supports-(?:\[(.+)\]|([a-zA-Z-][a-zA-Z0-9-]*))$/.exec(mod.type);
    if (!m) return [];
    return [atRule('supports', supportsCondition(m[1] ?? m[2]), [], 'supports')];
  }
);

// --- layer-[]: @layer 쿼리 variant ---
functionalModifier(
  (mod: string) => /^layer-\[.*\]$/.test(mod),
  undefined,
  (mod) => {
    const m = /^layer-\[(.+)\]$/.exec(mod.type);
    return m ? [atRule('layer', m[1], [])] : [];
  }
);

// --- scope-[]: @scope 쿼리 variant ---
functionalModifier(
  (mod: string) => /^scope-\[.*\]$/.test(mod),
  undefined,
  (mod) => {
    const m = /^scope-\[(.+)\]$/.exec(mod.type);
    return m ? [atRule('scope', m[1], [])] : [];
  }
); 