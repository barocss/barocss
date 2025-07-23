import { functionalModifier } from "../../core/registry";

// not-[]: functionalModifier for arbitrary negation
functionalModifier(
  (mod: string) => /^not-\[.*\]$/.test(mod),
  ({ selector, mod, variantChain, index }) => {
    const m = /^not-\[(.+)\]$/.exec(mod.type);
    if (m) {

      if (m[1].startsWith('.')) {
        return {
          selector: `&:not(${m[1]})`,
          flatten: false,
          wrappingType: 'rule'
        };
      }

      return {
        selector: `&:not([${m[1]}])`,
        flatten: false,
        wrappingType: 'rule'
      };
    }
    
    return selector;
  },
  undefined,
  { order: 200 }
);

// not-: functionalModifier for pseudo-class negation
functionalModifier(
  (mod: string) => /^not-/.test(mod),
  ({ selector, mod }) => {
    const m = /^not-(.+)$/.exec(mod.type);
    return {
      selector: m ? `&:not(:${m[1]})` : selector,
      flatten: false,
      wrappingType: 'rule'
    };
  },
  undefined,
  { order: 200 }
); 