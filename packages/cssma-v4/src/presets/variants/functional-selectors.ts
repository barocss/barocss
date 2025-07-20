import { functionalModifier } from "../../core/registry";

// --- Functional selector variants ---
functionalModifier(
  (mod: string) => /^is-\[.*\]$/.test(mod),
  ({ selector, mod }) => {
    const m = /^is-\[(.+)\]$/.exec(mod.type);
    return m ? `${selector}:is(${m[1]})` : selector;
  },
  undefined,
  { order: 200 }
);
functionalModifier(
  (mod: string) => /^where-\[.*\]$/.test(mod),
  ({ selector, mod }) => {
    const m = /^where-\[(.+)\]$/.exec(mod.type);
    return m ? `${selector}:where(${m[1]})` : selector;
  },
  undefined,
  { order: 200 }
); 