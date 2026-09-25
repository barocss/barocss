---
"@barocss/browser": patch
---

`BrowserRuntime` now applies kit's default preflight (`preflight: true`, full) when the config doesn't set `preflight`, matching kit's documented default. Previously a default start injected no preflight. If you relied on having no preflight, pass `preflight: false` in the runtime config.
