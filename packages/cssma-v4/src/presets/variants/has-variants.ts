import { functionalModifier } from "../../core/registry";

// has-[]: functionalModifier
functionalModifier(
  (mod: string) => /^has-\[.*\]$/.test(mod),
  ({ selector, mod }) => {
    const m = /^has-\[(.+)\]$/.exec(mod.type);

    if (m && m[1].startsWith('.')) {
      return {
        selector: `&:has(${m[1]})`,
        flatten: false,
        wrappingType: 'rule'
      };
    }

    return m ? {
      selector: `&:has(${m[1]})`,
      flatten: false,
      wrappingType: 'rule'
    } : selector;
  },
  undefined,
  { order: 200 }
); 