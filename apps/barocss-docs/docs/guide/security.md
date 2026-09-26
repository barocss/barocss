# Using BaroCSS with untrusted class input

BaroCSS generates CSS at runtime from class strings. In many apps those strings are not written by
your developers: they come from AI model output, CMS content, user-edited templates or third-party
widgets. This page describes what BaroCSS guarantees for such input, what it cannot prevent, and
which controls the host page should add.

## Threat model

- **Untrusted:** class strings that reach generation (the browser runtime scanning the DOM, or
  `@barocss/server` extracting classes from HTML), from AI output, CMS content or end users.
- **Trusted by default:** your BaroCSS configuration and theme. If theme data comes from a CMS or
  another untrusted source, BaroCSS validates it too (see below), but treat it with the same care
  as any other stylesheet input.

## What BaroCSS guarantees

Each guarantee is covered by tests in `packages/barocss/tests/security/` (and the other test files
named below). Upgrade to at least the listed release.

| Guarantee | Issue | Release |
|---|---|---|
| A class cannot produce a selector that escapes the element carrying it; malformed arbitrary variants are rejected (`variant-scope.test.ts`) | #220 | 0.5.0 |
| Arbitrary and custom-property values that would change the structure of the generated CSS are rejected (`value-structure.test.ts`, `arbitrary-property.test.ts`) | #224 | 0.5.0 |
| Combined variant tokens cannot introduce a CSS comment delimiter into a selector or at-rule prelude (`comment-junction.test.ts`) | #273 | 0.6.0 |
| Theme variable names and values are validated before they reach the `:root` block, and generated CSS never contains a markup end-tag sequence that could close an enclosing `<style>` element (`theme-vars-323.test.ts`, `endtag-323.test.ts`) | #323 | 0.8.1 |
| Every emitted selector and at-rule prelude is structurally balanced; unbalanced rules are dropped (`balance-332.test.ts`) | #332 | 0.8.2 |
| Generation never throws: an invalid class produces no rule and the rest of the request is still generated (`never-throws-333.test.ts` in each package) | #333 | 0.8.2 |
| Class names are CSS-escaped, including names that start with a digit (`compat/digit-escape-334.test.ts`) | #334 | 0.8.2 |
| Every emitted selector is checked at the text level to stay scoped to the element carrying the class; out-of-scope rules are dropped (see [CSS text post-processing](#css-text-post-processing)) | #392, #396 | 0.10.3 (#392), next release (#396) |

A fuzz harness (`packages/barocss/tests/fuzz/fuzz.test.ts`, #319/#339) runs generated class inputs
against these invariants as an ongoing check.

## What BaroCSS does not prevent

- **Network requests from `url()` values.** Arbitrary values may contain `url(...)` (for example in
  background, content, mask or list-style image utilities). The browser fetches those URLs, exactly
  as it would for the same classes under Tailwind. An attacker who controls class strings can
  therefore make the viewer's browser contact a server of their choice, which can disclose the
  viewer's IP address and that the content was viewed. Restrict this with CSP (below).
- **Restyling within the power of CSS.** Allowing arbitrary classes means allowing arbitrary
  styling of the elements that carry them: content can be hidden, moved, overlaid or made to look
  like other UI. BaroCSS keeps each rule scoped to its element, but it cannot judge whether a
  visual result is misleading. Use an allowlist (below) if that matters for your app.
- **Untrusted configuration.** Theme and config are treated as trusted. Since 0.8.1 theme variable
  names and values are validated (#323), so CMS-sourced theme data can no longer break the
  structure of the emitted CSS, but it can still set any value a theme may legitimately hold.

## Host controls

### Content Security Policy

Limit where `url()` values can load from with fetch directives. A minimal header:

```http
Content-Security-Policy: default-src 'self'; img-src 'self' https://images.example.com; font-src 'self'; media-src 'self'; style-src 'self' 'nonce-{RANDOM}'
```

`img-src` covers background, mask, list-style and `content` images; `font-src` and `media-src`
cover fonts and media; `default-src` is the fallback for anything not listed.

**`style-src` and the browser runtime.** `@barocss/browser` inserts rules through the CSSOM
(`insertRule`, and constructable stylesheets via `adoptedStyleSheets`), which CSP does not restrict.
By default it also creates `<style>` elements, which a strict `style-src` blocks. Since #347 there are
two ways to run it without `'unsafe-inline'`:

- `nonce`: pass the page's per-response nonce; the runtime sets it on every `<style>` it creates
  (preflight, theme variables, rule partitions, and the Shadow DOM fallback elements).
- `constructable: true`: in the document mode, all CSS goes into constructable sheets adopted by
  `document.adoptedStyleSheets`, so no nonce is needed (even `style-src 'self'` works). Adopted
  sheets come after every document stylesheet in the cascade. Where the browser lacks
  `document.adoptedStyleSheets`, the runtime falls back to `<style>` elements (with `nonce` if given),
  so pass both for full coverage. A Shadow DOM `root` already uses adopted sheets for its own CSS;
  there `constructable` only makes the document-level `@property` sheet (#384) an adopted sheet
  instead of a `<style>`.
- Pass `nonce` / `constructable` on the **first** `getRuntime()` / `baroStart()` call: a later call
  reuses the existing runtime and does not change how it injects styles.
  If a later call asks for a different `nonce` / `constructable`, BaroCSS logs a one-time `console.warn`.

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{RANDOM}'; style-src 'self' 'nonce-{RANDOM}'
```

```html
<script nonce="{RANDOM}" src="/barocss.umd.js"></script>
<script nonce="{RANDOM}">
  BaroCSS.getRuntime({ nonce: '{RANDOM}', constructable: true }).observe(document.body, { scan: true });
</script>
```

Measured on the #253 CMS blocks under that policy (`scripts/csp-probe/run.mjs`): default runtime
0.03 block parity with 572 violations; `nonce` and `constructable` 1.00 with 0 violations
(`constructable` also under `style-src 'self'`). With `@barocss/server`, `ssrStyleTag(css, { nonce })`
adds the nonce to the emitted `<style>` tag.

### Limiting external `url()` loads

No theme value emits `url()`: every form that can load an external resource comes from an
arbitrary class value (#346 audit, `scripts/url-audit/NOTES.md`). That includes background and mask
images, cursors, `content`, arbitrary properties, `image-set()`, and a custom property set to a URL and
read through `var()`. Two host-side controls cover all of them, so BaroCSS has no extra "safe mode":

1. **CSP fetch directives.** `img-src 'self'` (or just `default-src 'self'`) blocked every loading form
   in the #346 measurement: 0 cross-origin requests and one violation per form. Allow only the
   origins you trust, e.g. `img-src 'self' https://images.example.com`.
2. **A pre-filter**, when you can't set CSP for the page (e.g. a widget inside someone else's app):
   drop class strings that request a resource before handing them to BaroCSS.

   ```ts
   const LOADS_RESOURCE = /(url|image-set|image|cross-fade|element|src)\s*\(/i;
   const safe = classes.filter((c) => !LOADS_RESOURCE.test(c));
   ```

   This is reliable because BaroCSS doesn't decode CSS escapes in arbitrary values (an escaped form
   emits nothing), and custom-property indirection still needs a literal `url(` in some class, which
   the filter catches.

Use both where you can: CSP for the page, and the filter for content you forward.

`img-src 'self'` still allows **same-origin** `url()` loads: in the #364 end-to-end probe (strict CSP,
published 0.10.0) a class with `url(/count/same)` reached the same-origin endpoint once, while every
cross-origin form was blocked. If a same-origin request can have side effects (a GET endpoint, a
tracking path), narrow `img-src` further or use the pre-filter above; with the filter the probe saw
0 violations and 0 requests.

### MCP Apps and embedded widgets

MCP Apps and other embedded UIs usually run under a CSP set by the host, not by you. Check the
host's `img-src` / `default-src` policy: it decides whether `url()` values in generated CSS can
load anything. If you host such widgets yourself, apply the policy above to the widget frame.

### CSS text post-processing

BaroCSS guarantees scoping on the CSS **text** it emits. Its text-level scope check (#392, #396) is the
authoritative guard: every selector in the output string has been verified before it is returned.

That guarantee holds for the text as emitted. If your server or SSR pipeline post-processes the CSS
(trimming, minifying, concatenating, re-serializing), either pass it through unchanged or use a
standards-compliant CSS tool that preserves escapes. Never trim or regex-edit selectors ad hoc:
removing or rewriting an escape can change what a selector matches.

The browser CSSOM path (sheets inserted by `@barocss/browser`) is covered separately by the browser
fuzz ratchet (#406, #412).

### Inline server CSS with `ssrStyleTag`

When inlining server-generated CSS into HTML, use `ssrStyleTag` from `@barocss/server` (#326)
rather than concatenating a `<style>` string yourself. It escapes the nonce attribute and adds a
second layer of end-tag protection on top of the generator's own guarantee.

### Shadow DOM `root` for embedded widgets

Pass a `ShadowRoot` as the browser runtime's `root` option (#327) to confine generated rules to the
widget: the only thing written to the document is one sheet of `@property` registrations
(#384; browsers ignore `@property` inside shadow roots), which carries the `nonce` or is an adopted
sheet with `constructable: true`. It holds no selectors, so widget classes cannot restyle the host page. See [Embedding AI widgets (Shadow DOM)](/guide/integration/shadow-dom).

### Optional class allowlist

If your app needs stricter control than "any valid utility", filter class strings before they
reach BaroCSS: for example drop arbitrary values (`[...]`), arbitrary variants or specific utility
families, or keep only classes that match a known list. BaroCSS generates CSS only for the classes
it is given, so a filter applied before rendering (or before server extraction) is sufficient.

## Release notes

Security fixes are announced in each package's `CHANGELOG.md` and in the GitHub Release notes.
Upgrading to the latest 0.x release is recommended.
