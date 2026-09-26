---
"@barocss/kit": patch
---

`generateCss(..., { minify: true })` now minifies root at-rules (`@property`) and the `:root,:host` variable block, so minified output contains no newlines or tabs. Non-minified output is unchanged.
