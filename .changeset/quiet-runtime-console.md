---
"@barocss/browser": patch
---

The browser runtime no longer writes to the console in production. Per-batch and init logs, and partition insert warnings, now only appear when the debug flag is on (`debug: true` in config or `setDebug(true)`).
