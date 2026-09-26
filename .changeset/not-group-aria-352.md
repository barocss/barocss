---
"@barocss/kit": patch
"@barocss/browser": patch
"@barocss/server": patch
---

Negated and group-aria variants match Tailwind 4.3.3 (#352): `not-data-*`/`not-aria-*` (`:not([aria-checked="true"])`), `not-has-*` (`:not(:has(…))`), `not-supports-[…]` (`@supports not (…)`), `not-<breakpoint>`/`not-max-*`/`not-min-[…]` and `not-dark`/`not-print`/`not-motion-*`/`not-portrait` and similar (`@media not (…)`), and bare `group-aria-<state>`/`peer-aria-<state>` (including `/name`) as `[aria-<state>="true"]`. Negated media sorts with base rules in the runtime rule order, as Tailwind orders `not-*`.
