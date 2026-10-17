---
"@barocss/cad": patch
---

Booleans where an edge grazes a curved wall:
- A sliver too thin to give its shell a reliable volume sign is placed by how the other shells nest it. Before,
  it was refused as "a cavity lies in no outer shell".
- Planar faces take their normal from their corners, so a sliver's plane is written to STEP untilted and reads
  back with the same volume.
