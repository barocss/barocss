import { functionalModifier } from "../../core/registry";
import { functionalArgument, negatableSelectorOf, negatedAtRuleOf } from "./utils";

// #352: not-<at-rule variant> (not-md, not-max-md, not-min-[…], not-print, not-motion-safe, not-supports-[…]):
// the at-rule with its condition negated. Registered before the selector negation below.
functionalModifier(
  (mod: string, context) => /^not-(?!@)/.test(mod) && !!negatedAtRuleOf(mod.slice(4), context),
  () => '&',
  (mod, context) => {
    const node = negatedAtRuleOf(mod.type.slice(4), context);
    return node ? [node] : [];
  }
);

// not-[]: functionalModifier for arbitrary negation
functionalModifier(
  (mod: string) => /^not-\[.*\]$/.test(mod),
  ({ selector, mod }) => {
    const m = /^not-\[(.+)\]$/.exec(mod.type);
    if (m) {

      if (!/^[a-zA-Z0-9_-]+(=.+)?$/.test(m[1])) {
        return {
          selector: `&:not(${functionalArgument(m[1])})`,
          flatten: false,
          wrappingType: 'rule',
          source: 'attribute'
        };
      }

      return {
        selector: `&:not([${m[1]}])`,
        flatten: false,
        wrappingType: 'rule',
        source: 'attribute'
      };
    }
    
    return {
      selector,
      source: 'attribute'
    };
  }
);

// not-: functionalModifier for pseudo-class negation. not-@… is container-query negation (container-queries.ts);
// anything it does not accept (e.g. not-@container) emits nothing, like Tailwind 4.3.3 (#311).
functionalModifier(
  (mod: string) => /^not-/.test(mod) && !mod.startsWith('not-@'),
  ({ selector, mod, context }) => {
    const m = /^not-(.+)$/.exec(mod.type);
    const inner = m ? negatableSelectorOf(m[1], context) : null;
    if (m && !inner) return null; // #335: unknown inner variant emits nothing
    return {
      selector: inner ? `&:not(${inner})` : selector,
      flatten: false,
      wrappingType: 'rule',
      source: 'attribute'
    };
  }
); 