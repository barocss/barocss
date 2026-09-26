---
"@barocss/kit": patch
---

Reject unbalanced selectors and fix nested arbitrary-variant parsing: the serializer drops any rule whose final selector or at-rule prelude has unbalanced brackets, parens or braces, and malformed or empty variant bracket groups now generate nothing.
