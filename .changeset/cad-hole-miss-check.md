---
"@barocss/cad": patch
---

Holes in curved (B-rep) bodies are faster: whether a hole misses the body is read from the result (none of the hole's faces) instead of measuring the body's volume before and after, which tessellated it twice per hole. Sixteen cross and vertical holes in a plate evaluate in half the time (2.9 s → 1.4 s).
