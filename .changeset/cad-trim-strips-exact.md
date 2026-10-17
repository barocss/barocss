---
"@barocss/cad": patch
---

Mass and area of Boolean-trimmed curved faces are exact at the default quadrature:
- Every boundary chord's curved strip is integrated, each in one Gauss–Legendre pass over the region between the chord and its edge.
- A thin face (a sliver where an edge grazes a wall) is no longer measured on its coarse mesh.

Examples:
- An upright cylinder ∩ a box turned 80.79° about X now matches an independent exact integration to 2e-10 (before 8.7e-4).
- The difference of the same pair now matches to 2e-11 (before 6.8e-5).
- That body's centroid through STEP now moves 5e-11 mm (before 9e-6).
