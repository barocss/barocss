---
"@barocss/cad": patch
---

Mass and area of curved B-reps are more accurate and no longer depend on where the body sits:
- The integrals are taken about the middle of the body's surfaces and moved to the world origin afterwards,
  so integration error is not magnified by the body's distance from the origin.
- On faces trimmed by Booleans, the curved strip between each edge and its chord in the face's parameters is
  integrated too, so the remaining error falls with the cube of the step and is extrapolated as such (beside a
  surface's pole, still with its square).

Examples:
- A box with its top edges filleted now matches its closed form to 1e-8 (before 5e-6).
- An oblique split of a holed plate matches to 5e-7 per half (before 9e-6).
- Countersunk holes match to 1e-9.
