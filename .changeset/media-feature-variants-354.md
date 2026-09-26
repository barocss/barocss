---
"@barocss/kit": patch
---

Media and feature variants match Tailwind 4.3.3: `not-[@media …]`, `not-[@supports …]` and `not-[@container …]` negate the at-rule condition, and every other at-rule-led `not-[@…]` form emits nothing; built-in `contrast-more:`, `contrast-less:` and `noscript:`; named `supports-<feature>:` and Tailwind's `supports-[…]` condition rules (`supports-[display]` → `(display: var(--tw))`).
