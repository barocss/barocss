---
"@barocss/kit": patch
"@barocss/browser": patch
"@barocss/server": patch
---

Build with Vite 8 (Rolldown). Package exports and runtime behaviour are unchanged. The ESM CDN bundle
(`dist/cdn/barocss.js`) is now minified like the UMD one (356 KB → 229 KB raw, 64 KB → 48 KB gzip). In
`@barocss/kit` the default theme now lives in a shared chunk that both `dist/index.*` and
`dist/theme/default.*` import. The unminified kit ESM/CJS output a consumer loads (index plus the theme
chunk) grows from about 52 KB to 62 KB gzip because of extra formatting and region comments; bundlers
minify it away, and the theme data itself is unchanged.
