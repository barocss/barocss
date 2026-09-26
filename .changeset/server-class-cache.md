---
"@barocss/server": patch
---

Cache per-class generation in `ServerRuntime` (#272): warm `generateCss` reuses each class's rules, sort key and referenced vars plus the parsed theme var map, with byte-identical output. The cache is per runtime (so per config), LRU-bounded (`new ServerRuntime(config, { cacheSize })`, default 10000, 0 disables) and cleared by the new `setConfig(config)`.
