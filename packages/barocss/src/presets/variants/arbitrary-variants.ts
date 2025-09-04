import { functionalModifier } from "../../core/registry";

// Master CSS-style arbitrary variant ([...]) support (order: 999, always last)
functionalModifier(
  (mod: string) => /^\[.*\]$/.test(mod),
  ({ selector, mod }) => {
    const m = /^\[(.+)\]$/.exec(mod.type);
    if (!m) return { selector };
    const inner = m[1].trim();
    // For attribute selectors (attr=val) or simple attributes ([open]), wrap with brackets
    if (/^[a-zA-Z0-9_-]+(=.+)?$/.test(inner)) {
      return { selector: `&[${inner}]`, wrappingType: 'rule', source: 'attribute' };
    }

    if (inner === '&>*') {
      return { selector: `${inner}`, wrappingType: 'style-rule', source: 'peer' };
    }

    if (inner.startsWith('&')) {
      return { selector: `${inner}`, wrappingType: 'rule', source: 'pseudo' };
    }

    return { selector: `${inner} &`.trim(), wrappingType: 'rule', source: 'base' };
  },
  undefined
); 