---
"@barocss/kit": patch
---

Unknown bare values (`text-balanc`, `bg-notacolor`, `border-foo`, `p-foo`, ...) no longer emit an invalid declaration; like Tailwind 4 they produce no rule. A class matched by several registrations now falls through to the next one when the first rejects the value, so `text-balance` resolves to `text-wrap: balance` instead of a colour.
