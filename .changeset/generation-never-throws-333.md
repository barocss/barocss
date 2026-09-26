---
"@barocss/kit": patch
"@barocss/server": patch
"@barocss/browser": patch
---

Generation never throws on unusual class input: a theme lookup that resolves to a non-scalar value (such as a colour palette with no shade) counts as no value, and a class whose generation fails contributes nothing while the other classes still generate.
