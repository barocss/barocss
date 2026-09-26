---
"@barocss/kit": patch
"@barocss/browser": patch
"@barocss/server": patch
---

Build with Vite 8 (Rolldown). Package exports and runtime behaviour are unchanged. The ESM CDN bundle
(`dist/cdn/barocss.js`) is now minified like the UMD one (356 KB → 229 KB raw, 64 KB → 48 KB gzip). In
`@barocss/kit` the default theme now lives in a shared chunk that both `dist/index.*` and
`dist/theme/default.*` import.
