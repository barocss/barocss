---
"@barocss/cad": minor
---

A STEP import may be up to 32 MiB (`CadPartLimits.stepBytes`; it was the part document's 4 MiB), and `exportStep` shares identical directions as it already shared points. A modelled M8 × 30 hex bolt (23,523 faces) exports in 18.9 MB instead of 23.6 MB and reopens with the same volume, faces and names. The 32 MiB keeps a solid's build near half a gigabyte (about 17 times its text while it is built).
