---
"@barocss/kit": patch
---

The serializer scope check is stricter: a class name that appears only inside a quoted string or an attribute selector no longer counts as scoping a rule to its generating class. Class names inside selector functions such as `:is()` and `:where()` still count, so generated CSS is unchanged.
