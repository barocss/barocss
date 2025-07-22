import { functionalModifier } from "../../core/registry";

// has-[]: functionalModifier
functionalModifier(
  (mod: string) => /^has-\[.*\]$/.test(mod),
  ({ selector, mod, variantChain }) => {
    const m = /^has-\[(.+)\]$/.exec(mod.type);
    const isSingle = !variantChain || variantChain.length === 1;
    return m ? {
      selector: `${selector}:has(${m[1]})`,
      flatten: !isSingle,
      wrappingType: isSingle ? 'rule' : 'style-rule'
    } : selector;
  },
  undefined,
  { order: 200 }
); 