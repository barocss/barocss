---
"@barocss/server": patch
---

Cache per-class generation in `ServerRuntime` (#272): warm `generateCss` reuses each class's rules, sort key and referenced vars plus the parsed theme var map, with byte-identical output. The cache is per runtime (so per config), LRU-bounded by the new constructor option `new ServerRuntime(config, { cacheSize })` (default 10000, `0` turns caching off, fixed at construction). The new `setConfig(config)` method rebuilds the context and clears the caches. Both are documented in the Server Runtime API page.
