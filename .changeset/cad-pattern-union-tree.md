---
"@barocss/cad": patch
---

Patterns are faster: copies unite in a balanced tree, upright copies are checked once (at the end) for lumps that only touch, that check skips lumps whose boxes are apart, and a similarity transform of an upright solid no longer re-checks its slabs for merging. A stepped body patterned twelve times evaluates in about a third of the time (1.27 s → 0.45 s); names and volumes are unchanged.
