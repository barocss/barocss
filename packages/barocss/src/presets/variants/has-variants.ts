import { functionalModifier, getModifier, type ModifierRegistration } from "../../core/registry";
import type { Context } from "../../core/context";
import type { ParsedModifier } from "../../core/parser";
import { attributeVariantSelector, decodeArbitrarySelector, functionalArgument } from "./utils";

/** A bracketed selector that opens with an at-rule is not a selector: the variant does not match. */
const startsAtRule = (bracket: string) => /^[\s_]*@/.test(bracket);

// has-[]: functionalModifier
functionalModifier(
  (mod: string) => /^has-\[.*\]$/.test(mod) && !startsAtRule(mod.slice(5)),
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

/**
 * `has-<v>` / `in-<v>` for a simple variant `<v>` whose selector is `&<compound>` (hover, focus, checked, first,
 * open, data-*, aria-*, …): `&:has(*<compound>)` / `:where(*<compound>) &`, as Tailwind 4.1.13 emits them; `<v>`'s
 * wrap (hover's `@media (hover: hover)`) is kept. `in-[sel]` → `:where(*:is(sel)) &`.
 * Tokens reach here only after the #220 variant-scope guard in the parser / jsonToAst.
 */
type HasIn = { kind: string; compound: string; inner?: ModifierRegistration };

function innerCompound(variant: string, ctx: Context): Omit<HasIn, 'kind'> | undefined {
  const attr = attributeVariantSelector(variant);
  if (attr) return { compound: attr };
  if (/^(has|in|not|group|peer)-|[^a-z0-9-]/.test(variant)) return undefined;
  const inner = getModifier(ctx).find((m) => m.match(variant, ctx));
  if (!inner?.modifySelector || inner.astHandler) return undefined;
  const out = inner.modifySelector({ selector: '&', fullClassName: '', mod: { type: variant } as ParsedModifier, context: ctx });
  const list = typeof out === 'string' ? [{ selector: out }] : Array.isArray(out) ? out : [out];
  if (list.length !== 1) return undefined;
  const sel = list[0].selector;
  // one compound on `&` only: no combinator, no top-level list, no second `&`
  if (!/^&[:[]/.test(sel) || sel.slice(1).includes('&') || /[\s,>+~]/.test(sel.replace(/\([^()]*\)/g, ''))) return undefined;
  return { compound: sel.slice(1), inner };
}

function resolveHasIn(mod: string, ctx: Context): HasIn | undefined {
  const m = /^(has|in)-(.+)$/.exec(mod);
  if (!m) return undefined;
  const [, kind, v] = m;
  if (kind === 'in' && /^\[.+\]$/.test(v)) {
    if (startsAtRule(v.slice(1))) return undefined;
    const sel = decodeArbitrarySelector(v.slice(1, -1));
    return { kind, compound: sel.startsWith('&') ? sel.slice(1) : `:is(${sel})` };
  }
  if (kind === 'has' && (v.startsWith('[') || /^(data|aria)-/.test(v))) return undefined; // handled above
  const r = innerCompound(v, ctx);
  return r && { kind, ...r };
}

const hasInSelector: ModifierRegistration['modifySelector'] = ({ selector, mod, context }) => {
  const r = resolveHasIn(mod.type, context);
  if (!r) return { selector };
  return {
    selector: r.kind === 'has' ? `&:has(*${r.compound})` : `:where(*${r.compound}) &`,
    flatten: false,
    wrappingType: 'rule',
    source: 'attribute'
  };
};

// Two registrations: the engine applies any `wrap` it finds, so only inner variants that wrap get one.
functionalModifier(
  (mod: string, ctx: Context) => !!resolveHasIn(mod, ctx)?.inner?.wrap,
  hasInSelector,
  (mod, context) => resolveHasIn(mod.type, context)!.inner!.wrap!({ ...mod, type: mod.type.replace(/^(has|in)-/, '') }, context),
);
functionalModifier(
  (mod: string, ctx: Context) => { const r = resolveHasIn(mod, ctx); return !!r && !r.inner?.wrap; },
  hasInSelector,
);
