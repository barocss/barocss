---
"@barocss/browser": patch
---

Kit diagnostics stay silent in the browser runtime unless `config.debug` is set, which the runtime passes through to the kit (#230).
