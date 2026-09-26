> **DRAFT — not for publication until approved.** Issue #378. This is a proposal only; `README.md` is NOT edited.

```diff
@@ README.md (after the intro paragraph)
+## Why BaroCSS
+
+Tailwind only styles the classes it sees at build time. BaroCSS styles the ones that arrive later, from
+AI models, CMS content, or widgets in a shadow root, alongside your build.
+
+- Real model-written specs in a built app: 0.859 of elements match, vs 0.163 build-only (#231)
+- Shadow DOM under strict CSP: parity 1.000, 0 host damage (#347, #364)
+- Full match at SSR first paint with `@barocss/server` (#266)
+
+**Don't use it** when your class set is known in advance (pre-generate instead, #218), or for
+no-build prototypes, where `@tailwindcss/browser` has higher parity (#198).
+See [the measured comparison](docs/launch/comparison.md).
```
