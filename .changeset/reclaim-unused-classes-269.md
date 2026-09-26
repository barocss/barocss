---
"@barocss/browser": patch
"@barocss/kit": patch
---

Browser runtime reclaims rules for classes no element uses any more (#269). `observe()` keeps a per-class
refcount of the elements inside the root; a class whose count stays 0 for `gcGraceMs` (default 3000 ms) and that a
live-DOM re-check no longer finds has its rules deleted (the #254 order keys stay in sync). Classes passed to
`addClass()`, classes a pre-existing stylesheet defines, and root/@property/preflight rules are never reclaimed.
Optional `maxRules` evicts unused classes early; `gc: false` restores the old keep-everything behaviour. Kit adds
`IncrementalParser.unmarkProcessed()`.
