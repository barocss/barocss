---
"@barocss/kit": patch
"@barocss/browser": patch
"@barocss/server": patch
---

Honour `config.prefix` in class parsing, matching Tailwind 4 `prefix(tw)`: with `prefix: 'tw'`, `tw:flex`, `tw:hover:bg-red-500`, `tw:!flex`, `tw:-mt-2` are styled and unprefixed classes generate nothing. The unused `prefix: 'barocss-'` entry is removed from `defaultConfig`.
