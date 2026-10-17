---
"@barocss/cad": patch
---

The mass of a curved body is quicker: the quadrature over each curved face computes the surface tangents and normal as scalars, with no callbacks or temporary vectors per quadrature point (the same numbers, bit for bit).
