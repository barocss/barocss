---
"@barocss/browser": patch
"@barocss/kit": patch
---

Runtime keeps Tailwind variant order (#254): each injected rule is inserted at its sorted position (base/state < max-* desc < min-* asc < @max-* desc < @min-* asc < dark/print/orientation/forced-colors, nested at-rules compared level by level) with one `insertRule` at a binary-searched index, so `lg:px-8` seen before `sm:px-6` no longer wins below its breakpoint's successors. Kit: `leading-*` now also sets a registered, non-inheriting `--baro-leading` and `text-<size>` line-height reads `var(--baro-leading, …)` (Tailwind's `--tw-leading`), so `leading-*` beats responsive `text-*` regardless of rule order.
