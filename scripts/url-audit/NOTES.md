# #346 phase 1: url() safe-mode audit

Probes: `packages/barocss/tests/fuzz/url-audit.test.ts` (form table, report-only),
`P5` in `tests/fuzz/fuzz.test.ts` (report-only count), `scripts/url-audit/csp-probe.mjs` (Chromium CSP).

## Forms that emit a resource function from class input (all arbitrary; no theme value emits url)
Loads a resource: `bg-[url()]`, `mask-[url()]`/`mask-image-[url()]`, `cursor-[url(),auto]`,
`content-[url()]` (via `--baro-content`), `[prop:url()]` for any property, `[--x:url()]` (usable via `var()`),
`[background-image:image-set()]`. Emitted but inert (invalid property for url): `list-image-[url()]`
(list-style-type), `border-image-[url()]` (border-color), `font-[url()]` (font-family). Fragment-only:
`filter-[url(#f)]`, `fill-[url(#g)]`. Dropped already: `bg-[image:url()]`, `bg-[image-set()]`, `bg-[URL()]`,
escaped `u\72l(`. Selector/at-rule preludes never carry `url(` (#335).

## Results
- P5 on seed 319 (25000 inputs): 116.
- CSP `img-src 'self'` (and `default-src 'self'`) blocked all 8 loading forms with 8 violations, incl. cursor,
  mask, list-style-image, content, image-set and custom-property indirection.
- Host pre-filter `/(url|image-set|image|cross-fade|element|src)\s*\(/i` on the raw class string is reliable:
  the kit does not decode CSS escapes in values (escaped forms emit nothing), and `var()` indirection still
  requires a literal `url(` in some class.

Recommendation: document the CSP + pre-filter recipe and close; no `allowArbitraryUrls` option.
If built later, the single place is `isSafeDecl` in `packages/barocss/src/core/astToCss.ts`.
