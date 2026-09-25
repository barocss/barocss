---
"@barocss/browser": patch
---

`getRuntime`/`baroStart` now apply a passed `config` to an already-created runtime via `updateConfig`, so an early `getRuntime()` no longer drops a later `baroStart({ config })`.
