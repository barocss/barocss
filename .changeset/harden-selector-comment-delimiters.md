---
"@barocss/kit": patch
---

Harden selector serialization against comment delimiters: a rule whose final selector or at-rule prelude contains a comment opener or closer (outside CSS escapes) is no longer emitted.
