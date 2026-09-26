import { functionalModifier } from "../../core/registry";
import { attributeVariantSelector, functionalArgument } from "./utils";

// has-[]: functionalModifier
functionalModifier(
  (mod: string) => /^has-\[.*\]$/.test(mod),
  ({ selector, mod }) => {
    const m = /^has-\[(.+)\]$/.exec(mod.type);

    return m ? {
      selector: `&:has(${functionalArgument(m[1])})`,
      flatten: false,
      wrappingType: 'rule',
      source: 'attribute'
    } : {
      selector,
      source: 'attribute'
    };
  },
  undefined,
);

// has-data-[slot=x] / has-aria-[…]: `&:has(*[data-slot="x"])`, as Tailwind emits it
functionalModifier(
  (mod: string) => /^has-(data|aria)-/.test(mod) && !!attributeVariantSelector(mod.slice(4)),
  ({ mod }) => ({
    selector: `&:has(*${attributeVariantSelector(mod.type.slice(4))})`,
    flatten: false,
    wrappingType: 'rule',
    source: 'attribute'
  }),
  undefined,
);
