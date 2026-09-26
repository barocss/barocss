import { functionalModifier } from "../../core/registry";
import { functionalArgument, pseudoClassOf } from "./utils";

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
    const inner = m ? pseudoClassOf(m[1], context) : null;
    if (m && !inner) return null; // #335: unknown inner variant emits nothing
    return {
      selector: inner ? `&:not(${inner})` : selector,
      flatten: false,
      wrappingType: 'rule',
      source: 'attribute'
    };
  }
); 