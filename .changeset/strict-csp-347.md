---
"@barocss/browser": minor
"@barocss/server": patch
---

Strict-CSP support (#347): new `BrowserRuntimeOptions.nonce` sets a CSP nonce on every `<style>` element the runtime creates (preflight, theme variables, rule partitions, Shadow DOM fallback elements), and `constructable: true` puts the document-mode CSS into `document.adoptedStyleSheets` (no nonce needed), falling back to `<style>` elements where unsupported. Default behaviour is unchanged. `generateCssForHtml` docs point to `ssrStyleTag(css, { nonce })`.
