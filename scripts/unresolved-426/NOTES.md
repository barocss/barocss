# #426 Unresolved-class rate in AI corpora; existing-capability test

Rerun from the repository root (Node 22; the first command installs locked packages):

    pnpm install --frozen-lockfile
    pnpm --filter @barocss/kit build:library
    node scripts/unresolved-426/run.mjs

The script defaults to this checkout's `packages/barocss/dist/index.js` and `node_modules/tailwindcss`.
Optional positional arguments override those paths. It requires Tailwind 4.3.3 and writes `result.json`.
The measurement itself uses no browser or network.

Committed source corpora: [`#182`](../json-render-probe/specs.json), [`#199`](../mcp-model-outputs/outputs),
[`#209`](../mcp-model-outputs/outputs-tw), [`#253`](../cms-probe/blocks), and [`#364`](../o5-probe/blocks).

Method: the script pulls every `class="…"`/`className` token from the committed corpora. It resolves each unique token
with `generateCss(token, createContext(cfg))`, where `cfg` is the corpus's own recorded config: the inline Play-CDN
`tailwind.config` in 4 of the #209 files, and the site `theme.extend` for #253. Everything else uses the default config.
"Unresolved" means the output is empty. Each miss is then checked against Tailwind 4.3.3 `compile().build([token])`,
using a fresh compiler per token and comparing against the empty build. Categories use CSS selectors, dynamic string
fragments, and utility-name patterns. Inline config is parsed as literal data and never executed. Counts are unique
per corpus; the haiku and opus columns overlap and must not be added together. The extractor reads literal
double-quoted `class`/`className` attributes from the source HTML; it does not evaluate JavaScript or render the DOM.

## Result (unique tokens, 2026-09-27)

| corpus | unresolved / N | rate | app custom | extraction fragment | invented utility | haiku | opus |
|---|---:|---:|---:|---:|---:|---:|---:|
| #182 json-render specs | 0/93 | 0% | 0 | 0 | 0 | n/a | n/a |
| #199 MCP-App, unprompted (plain CSS) | 124/127 | 97.6% | 123 | 1 | 0 | 58/60 | 70/71 |
| #209 MCP-App, Tailwind-prompted | 18/311 | 5.8% | 4 | 13 | 1 | 11/159 | 7/225 |
| #253 CMS blocks (site theme) | 0/211 | 0% | 0 | 0 | 0 | 0/124 | 0/148 |
| #364 O5 widget blocks | 0/161 | 0% | 0 | 0 | 0 | 0/87 | 0/125 |

Categories (all corpora):
- App custom class or app selector hook: 127. This includes `row`, `col`, `place`, `select-input`, and `text-input`
  from #199, which are defined in that output's CSS. `theme-opt` in #209 is an app JavaScript selector hook.
- Extraction artifacts (JS template or string concatenation fragments): 14, including `cls` and `alignCls` in #209.
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

When models are asked for Tailwind, this corpus has 1 invented utility (`text-md`) among 683 unique tokens counted
within #209/#253/#364. These corpora have 18 raw misses in #209, but 17 are app classes or source extraction
fragments. #182 has no misses. The unprompted #199 output mostly uses its own CSS. An agent can already list its no-op
classes with the public API snippet above. Ownership: AGENT/APP. **No new BaroCSS code needed**, and no parity finding.
L2 for the counts. The model outputs are L3-recorded inputs from earlier issues, with no new runs.
