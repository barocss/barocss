import { functionalModifier } from "../../core/registry";
import { atRule } from "../../core/ast";
import { attributeVariantSelector, decodeArbitrarySelector, functionalArgument, pseudoClassOf } from "./utils";
import type { Context } from "../../core/context";
import { startsAtRule } from "./has-variants";

// `group-has-[@…]` / `peer-has-[@…]`: an at-rule is not a selector, the variant does not match (as has-[…]).
const atRuleHas = (mod: string) => /^(group|peer)-has-\[/.test(mod) && startsAtRule(mod.slice(mod.indexOf("[") + 1));

// `group-x/name` → ['x', '.group\/name']; the name is a plain identifier, as Tailwind requires.
function splitGroupName(kind: 'group' | 'peer', variant: string): [string, string] {
  const named = /^(.+)\/([a-zA-Z0-9_-]+)$/.exec(variant);
  return named ? [named[1], `.${kind}\\/${named[2]}`] : [variant, `.${kind}`];
}

// group-hover / peer-hover (optionally named): like `hover:`, only where hover is real (`@media (hover: hover)`).
// Registered before the generic group-/peer- handlers so it matches first.
functionalModifier(
  (mod: string) => /^(group|peer)-hover(\/[a-zA-Z0-9_-]+)?$/.test(mod),
  ({ mod }) => {
    const kind = mod.type.startsWith('group') ? 'group' : 'peer';
    const [, base] = splitGroupName(kind, mod.type.slice(kind.length + 1));
    const tail = kind === 'group' ? ' *' : ' ~ *';
    return { selector: `&:is(:where(${base}):hover${tail})`, wrappingType: 'rule', source: kind };
  },
  () => [atRule('media', '(hover: hover)', [])],
);

// `group-not-[x]` / `peer-not-[x]` → `:not(*:is(x))`; `group-not-focus` → `:not(:focus)`.
function negated(value: string, ctx: Context): string | null {
  const v = value.slice(4);
  if (v.startsWith('[') && v.endsWith(']')) return `:not(*:is(${decodeArbitrarySelector(v.slice(1, -1))}))`;
  const inner = pseudoClassOf(v, ctx);
  return inner ? `:not(${inner})` : null;
}

// --- group/peer/parent/child extensions (examples: group-focus, peer-active, etc.) ---
functionalModifier(
  (mod: string) => /^group-(.+)$/.test(mod) && !atRuleHas(mod),
  ({ selector, mod, context }) => {
    const raw = /^group-(.+)$/.exec(mod.type);
    const [variant, base] = splitGroupName('group', raw?.[1] ?? '');
    const m = raw ? [raw[0], variant] as const : null;
    const g = `:where(${base})`;

    // group-data-[state=open] / group-aria-[…] → `:where(.group)[data-state="open"] *`
    const attr = m ? attributeVariantSelector(m[1]) : undefined;
    if (attr) return { selector: `&:is(${g}${attr} *)`, wrappingType: 'rule', source: 'group' };

    if (m?.[1].startsWith('[') && m?.[1].endsWith(']')) {
      const value = m?.[1].slice(1, -1).replace(/_/g, '');
      return {
        selector: `&:is(${g}:is(${value}) *)`,
        wrappingType: 'rule',
        source: 'group'
      };
    }

    if (m?.[1]?.startsWith('not-')) {
      const neg = negated(m[1], context);
      return neg ? { selector: `&:is(${g}${neg} *)`, wrappingType: 'rule', source: 'group' } : null;
    }

    if (m?.[1]?.startsWith('has-')) {
      const pattern = /^has-\[([a-zA-Z0-9_-]+)\]$/.exec(m?.[1]);
      if (pattern) {
        const value = pattern[1];
        return {
          selector: `&:is(${g}:has(:is(${value})) *)`,
          source: 'group'
        };
      }
      return {
        selector: `&:is(${g}:has(${functionalArgument(m[1].slice(5, -1))}) *)`,
        source: 'group'
      };
    }

    if (m?.[1]?.startsWith('aria-')) {
      const pattern = /^aria-\[([a-zA-Z0-9_-]+)(?:=([^\]]+))?\]$/.exec(m?.[1]);
      if (pattern) {
        const value = pattern[1];
        if (pattern[2]) {
          return {
            selector: `&:is(${g}[aria-${value}="${pattern[2]}"] *)`,
            source: 'group'
          };
        } else {
          return {
            selector: `&:is(${g}[aria-${value}] *)`,
            source: 'group'
          };
        }
      }
    }

    const pc = m ? pseudoClassOf(m[1], context) : null;
    if (m && !pc) return null; // #335: unknown inner variant emits nothing
    return m ? {
      selector: `&:is(${g}${pc} *)`,
      wrappingType: 'rule',
      source: 'group'
    } : {
      selector,
      source: 'group'
    };
  },
  undefined,
);

functionalModifier(
  (mod: string) => /^peer-(.+)$/.test(mod) && !atRuleHas(mod),
  ({ selector, mod, context }) => {
    const raw = /^peer-(.+)$/.exec(mod.type);
    const [variant, base] = splitGroupName('peer', raw?.[1] ?? '');
    const m = raw ? [raw[0], variant] as const : null;
    const g = `:where(${base})`;

    // peer-data-[state=open] / peer-aria-[…] → `:where(.peer)[data-state="open"] ~ *`
    const attr = m ? attributeVariantSelector(m[1]) : undefined;
    if (attr) return { selector: `&:is(${g}${attr} ~ *)`, wrappingType: 'rule', source: 'peer' };

    if (m?.[1].startsWith('[') && m?.[1].endsWith(']')) {
      const value = m?.[1].slice(1, -1).replace(/_/g, '');
      return {
        selector: `&:is(${g}:is(${value})~*)`,
        wrappingType: 'rule',
        source: 'peer'
      };
    }

    const value = m?.[1];

    // has-xxxx, not-xxxx, aria-xxxx

    if (value?.startsWith('has-[') && value.endsWith(']')) {
      return { selector: `&:is(${g}:has(${functionalArgument(value.slice(5, -1))}) ~ *)`, source: 'peer' };
    }

    if (value?.startsWith('has-')) {
      const pc = pseudoClassOf(value.slice(4), context);
      if (!pc) return null;
      return {
        selector: `&:is(${g}:has(${pc})~*)`,
        source: 'peer'
      };
    }

    if (value?.startsWith('not-')) {
      const neg = negated(value, context);
      if (!neg) return null;
      return {
        selector: `&:is(${g}${neg} ~ *)`,
        source: 'peer'
      };
    }
    
    if (value?.startsWith('aria-')) {

      let pattern = /^aria-([a-zA-Z0-9_]+)$/.exec(value);
      if (pattern) {
        const key = pattern[1];
        return {
          selector: `&:is(${g}[aria-${key}]~*)`,
          source: 'peer'
        };
      }

      pattern = /^aria-\[([a-zA-Z0-9_-]+)(?:=([^\]]+))?\]$/.exec(value);
      if (pattern) {
        const key = pattern[1];
        const value = pattern[2];

        if (pattern[2]) {
          return {
            selector: `&:is(${g}[aria-${key}="${value}"]~*)`,
            source: 'peer'
          };
        } else {
          return {
            selector: `&:is(${g}[aria-${key}]~*)`,
            source: 'peer'
          };
        }
      }
    }

    const pc = m ? pseudoClassOf(value!, context) : null;
    if (m && !pc) return null; // #335: unknown inner variant emits nothing
    return m ? {
      selector: `&:is(${g}${pc}~*)`,
      source: 'peer'
    } : {
      selector,
      source: 'peer'
    };
  },
  undefined,
);

// --- parent/child extensions (not in the actual spec, but extensibility example) ---
functionalModifier(
  (mod: string) => /^parent-(.+)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^parent-(.+)$/.exec(mod.type);

    if (m?.[1].startsWith('[') && m?.[1].endsWith(']')) {
      return {
        selector: `.parent\\:\\[${m[1].slice(1, -1)}\\] &`,
        wrappingType: 'rule',
        source: 'parent'
      };
    }

    return m ? {
      selector: `.parent:${m[1]} &`,
      source: 'parent'
    } : {
      selector,
      source: 'parent'
    };
  },
  undefined,
);
functionalModifier(
  (mod: string) => /^child-(.+)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^child-(.+)$/.exec(mod.type);

    if (m?.[1].startsWith('[') && m?.[1].endsWith(']')) {
      return {
        selector: `& > .child\\:\\[${m[1].slice(1, -1)}\\]`,
        wrappingType: 'rule',
        source: 'child'
      };
    }
    return m ? {
      selector: `& > .child:${m[1]}`,
      source: 'child'
    } : {
      selector,
      source: 'child'
    };
  },
  undefined,
); 