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
  so pass both for full coverage. A Shadow DOM `root` already uses adopted sheets.
- Pass `nonce` / `constructable` on the **first** `getRuntime()` / `baroStart()` call: a later call
  reuses the existing runtime and does not change how it injects styles.

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

### MCP Apps and embedded widgets

MCP Apps and other embedded UIs usually run under a CSP set by the host, not by you. Check the
host's `img-src` / `default-src` policy: it decides whether `url()` values in generated CSS can
load anything. If you host such widgets yourself, apply the policy above to the widget frame.

### Inline server CSS with `ssrStyleTag`

When inlining server-generated CSS into HTML, use `ssrStyleTag` from `@barocss/server` (#326)
rather than concatenating a `<style>` string yourself. It escapes the nonce attribute and adds a
second layer of end-tag protection on top of the generator's own guarantee.

### Shadow DOM `root` for embedded widgets

Pass a `ShadowRoot` as the browser runtime's `root` option (#327) to confine generated rules to the
widget: nothing is written to the document's stylesheets, so widget classes cannot restyle the
host page. See [Embedding AI widgets (Shadow DOM)](/guide/integration/shadow-dom).

### Optional class allowlist

If your app needs stricter control than "any valid utility", filter class strings before they
reach BaroCSS: for example drop arbitrary values (`[...]`), arbitrary variants or specific utility
families, or keep only classes that match a known list. BaroCSS generates CSS only for the classes
it is given, so a filter applied before rendering (or before server extraction) is sufficient.

## Release notes

Security fixes are announced in each package's `CHANGELOG.md` and in the GitHub Release notes.
Upgrading to the latest 0.x release is recommended.
