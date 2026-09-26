> **DRAFT — not for publication until approved.** Issue #378. This is a proposal only; `README.md` is NOT edited.

```diff
@@ README.md (after the intro paragraph)
+## Why BaroCSS
+
+Tailwind only styles the classes it sees at build time. BaroCSS styles the ones that arrive later, from
+AI models, CMS content, or widgets in a shadow root, alongside your build.
+
+- Shadow DOM under strict CSP: parity 1.000, 0 host damage (#364, 0.10.0)
+- CMS blocks under strict CSP / in shadow roots: 1.0 (#347, #355)
+- Real model-written specs in a built app: 0.859 of elements match, vs 0.163 build-only (#231)
+- Full match at SSR first paint with `@barocss/server` (#266)
+
+**Don't use it** when your class set is known in advance (pre-generate instead, #218), or for a
+no-build page where the official `@tailwindcss/browser` already works (#198).
+See [the measured comparison](docs/launch/comparison.md).
```
