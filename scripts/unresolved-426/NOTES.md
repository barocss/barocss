# #426 Unresolved-class rate in AI corpora; existing-capability test

Rerun (Node only, no browser, no network):

    node scripts/unresolved-426/run.mjs [barocss/dist/index.js] [node_modules/tailwindcss]

It defaults to `~/.barocss-ai/v3/integration` (the develop kit dist and Tailwind 4.3.3). It writes `result.json`.

Method: the script pulls every `class="…"`/`className` token from the committed corpora. It resolves each unique token
with `generateCss(token, createContext(cfg))`, where `cfg` is the corpus's own recorded config: the inline Play-CDN
`tailwind.config` in 4 of the #209 files, and the site `theme.extend` for #253. Everything else uses the default config.
"Unresolved" means the output is empty. Each miss is then checked against Tailwind 4.3.3 `compile().build([token])`,
using a fresh compiler per token and comparing against the empty build, and bucketed with simple regexes.

## Result (unique tokens, 2026-09-27)

| corpus | unresolved / N | rate | haiku | opus |
|---|---|---|---|---|
| #182 json-render specs | 0/93 | 0% | n/a (model not recorded) | n/a |
| #199 MCP-App, unprompted (plain CSS) | 124/127 | 97.6% | 58/60 | 70/71 |
| #209 MCP-App, Tailwind-prompted | 18/311 | 5.8% | 11/159 | 7/225 |
| #253 CMS blocks (site theme) | 0/211 | 0% | 0/124 | 0/148 |
| #364 O5 widget blocks | 0/161 | 0% | 0/87 | 0/125 |

Categories (all corpora):
- App custom class, defined in the output's own `<style>` and not a utility: 124. This includes `row`, `col`,
  `place` and `select-input` from #199, which the regex put under "typo" but are declared in their own CSS.
- Extraction artifacts (JS template fragments inside `class="${…}"`): 12.
- Real invented utility: 1 (`text-md`, haiku #209). Tailwind 4.3.3 doesn't know it either.
- Tailwind v3-only names: 0. Plugin utilities (typography/forms): 0. Invalid arbitrary values: 0.
- Valid 4.3 utility BaroCSS misses: **0**. Every miss is also a miss in Tailwind 4.3.3, so there are no parity candidates.

Without the recorded config, #209 would show 30 misses: `brand-*` colors and `animate-fadein`/`animate-floaty` defined in
`tailwind.config`. With the config passed, BaroCSS resolves them all.

## Existing-capability test (public API, 1 line of logic)

```js
import { createContext, generateCss } from '@barocss/kit';
const noOps = (classes, ctx) => [...new Set(classes.split(/\s+/).filter(Boolean))]
  .filter((c) => !generateCss(c, ctx).trim());
noOps(allClassesOfPage, createContext(myConfig)); // -> ['text-md', 'toggle-checkbox', ...]
```

Run on #209 it returns 18 tokens, the same as the script's count (`result.snippetCheck.match: true`).

## Conclusion

When models are asked for Tailwind, the rate of utility-like tokens that generate nothing is essentially 0: 1 of 683
unique tokens across the #209/#253/#364 Tailwind corpora, and 0 in #182. The remaining misses are the app's own classes
or template fragments, which correctly produce no utility CSS. An agent can already list its no-op classes with the 3
lines above. Ownership: AGENT/APP. **No new BaroCSS code needed**, and no parity finding.
L2 for the counts. The model outputs are L3-recorded inputs from earlier issues, with no new runs.
