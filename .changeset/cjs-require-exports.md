---
'@barocss/kit': patch
'@barocss/browser': patch
'@barocss/server': patch
---

CommonJS consumers can now `require()` every documented entry point: `@barocss/kit/theme/default` and `@barocss/browser` gain `require` export conditions (browser ships a new `dist/index.cjs`), and every entry has matching `.d.cts` declarations. The `@barocss/server` ESM declarations now resolve under `moduleResolution: node16`.
