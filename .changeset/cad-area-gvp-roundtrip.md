---
"@barocss/cad": minor
---

Surface area, STEP validation properties and STEP name repeats:
- `brepSurfaceArea(brep)` and every part output's `surfaceArea()` integrate the exact surfaces, like mass.
- `exportStep` writes the part's CAx-IF geometric validation properties (volume, surface area, centroid,
  bounding box) unless `validationProperties: false` is given.
- `stepValidationProperties(text)` reads them back, and `compareValidationProperties` checks a model
  against them within CAx-IF's limits.
- A STEP file whose bodies repeat face or edge names imports with the repeats numbered `name#1`, `name#2`
  in file order, keeping the B-rep's names unique.
