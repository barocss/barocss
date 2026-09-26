---
"@barocss/kit": patch
---

Hardened class scoping against unusual separator characters: such code points in class names are now hex-escaped in selectors, and the serializer drops any style rule that is not scoped to its generating class.
