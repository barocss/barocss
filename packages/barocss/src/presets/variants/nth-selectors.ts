import { functionalModifier } from "../../core/registry";

// --- Nth-child, nth-last-child, nth-of-type, nth-last-of-type (숫자/패턴 기반) ---
functionalModifier(
  (mod: string) => /^nth-(\d+)$/.test(mod),
  ({ selector, mod }) => {
    const n = mod.type.match(/^nth-(\d+)$/)?.[1];
    return n ? {
      selector: `&:nth-child(${n})`,
      source: 'attribute'
    } : {
      selector,
      source: 'attribute'
    };
  },
  undefined
);
functionalModifier(
  (mod: string) => /^nth-last-(\d+)$/.test(mod),
  ({ selector, mod }) => {
    const n = mod.type.match(/^nth-last-(\d+)$/)?.[1];
    return n ? {
      selector: `&:nth-last-child(${n})`,
      source: 'attribute'
    } : {
      selector,
      source: 'attribute'
    };
  },
  undefined
);
functionalModifier(
  (mod: string) => /^nth-of-type-(\d+)$/.test(mod),
  ({ selector, mod }) => {
    const n = mod.type.match(/^nth-of-type-(\d+)$/)?.[1];
    return n ? {
      selector: `&:nth-of-type(${n})`,
      source: 'attribute'
    } : {
      selector,
      source: 'attribute'
    };
  },
  undefined
);
functionalModifier(
  (mod: string) => /^nth-last-of-type-(\d+)$/.test(mod),
  ({ selector, mod }) => {
    const n = mod.type.match(/^nth-last-of-type-(\d+)$/)?.[1];
    return n ? {
      selector: `&:nth-last-of-type(${n})`,
      source: 'attribute'
    } : {
      selector,
      source: 'attribute'
    };
  },
  undefined
); 