---
"@barocss/cad": minor
---

`checkBrep(brep, { strict: true })` adds L0 geometric validation:
- edges must lie on the surfaces of their faces;
- loops must not cross or touch themselves or each other in a face's parameters;
- planar faces must not be slivers;
- tolerances must stay under 1e-3 of the model's size.

The report adds `maximumEdgeSurfaceGapMM`. Every part output has `validate()`, the strict report, worked out
on first use: an imported STEP body is reported rather than refused. The default `checkBrep` and the
builders' checks are unchanged.
