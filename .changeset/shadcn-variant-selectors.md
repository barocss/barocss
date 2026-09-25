---
"@barocss/kit": patch
---

Arbitrary and data variants used by shadcn/ui now emit Tailwind 4.1.13's selectors: `_` in `[&_…]` is a descendant space, `[&>*]` no longer nests an unscoped rule, `group-data-[…]`/`peer-data-[…]` (including named `/group`) target the ancestor's attribute, `has-data-[…]` is supported, and `has-[a,b]`/`not-[a,b]` accept a selector list inside the pseudo-class while the generated selector stays a single member.
