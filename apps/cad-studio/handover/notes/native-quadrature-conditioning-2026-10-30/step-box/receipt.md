# D344 actual STEP bounding metadata classification

READ_ONLY; product/test edits, build, browser and benchmark NOT_RUN. Basefbf8a7afb555ee7302bd3c6a6ed9e034a9a8b51a. Short Node22 probes completed, heavygate RELEASED. Every inspected source hash before/after is unchanged. Actual downloaded02-original-step.step is copied byte-for-byte as download.step; full raw point entities, strict imported B-rep and provider observations are retained.

## Classification

METADATA_ORACLE_OVERRESTRICTION for the ordinary cylinder. Actual metadata box upperZ5.345768900000001 is1ULP above native cap5.3457689 (difference8.881784197001252e-16). It is not an observed changed cap. Strictimport from the actual downloaded bytes passes:1solid,1closed shell,4faces; namesmatch source. Imported vertex, complete boundary-curve poles and full support normallevels remain exactly[.3456789,5.3457689]. Both planar caps have exactly those levels. No geometric departure was found in this scoped probe.

Actual imported brepBounds exactly equals the downloaded metadata box, including maximumZ. The Node original-source B-rep happens to produce maximumZ exactly5.3457689; its source and actual Chrome-exported lower-half arc coefficients/weights differ by runtime rounding; source-import-curve-comparison.json records the exact differences while all normal levels remain exact. Do not demand metadata exact-equality with the Node endpoint interval across these evaluated-bound computations.

A concrete source and imported side0#2 evaluator witness at(u=.1875,v=1) returns5.345768900000001. All upper-column native normal poles are5.3457689, weightspositive. Independent Fraction computation at that stored parameter gives exactly5.3457689. rational-boundary-proof.json records this. It proves evaluation rounding is possible at an unchanged exact native boundary; it is not a globally rigorous conservative-bounds certificate. The actual metadata box encloses this body's native endpoint interval.

## Raw file versus geometry

raw-cartesian-points.json lists exact fileentity strings/decoded points. The metadata maximum point is#108. Rawvertex and rationalcurve/surface normalpoints remainlo/hi. The file also has#87=(0,0,0), a representationorigin used by#88placement; this is not a material vertex/cap and must not be included in a naive rawpoint materialbox. Imported native geometry resolves the relevant material references independently.

step.ts204–221 writes geometric validation properties. Its bounding property comes directly from brepBounds at211, separately from mass/centroid provider. brep-bounds.ts71–84 starts with actual vertices, then grows by curveextrema and wholepatch surface sampling/golden search; planar supports addnothing. surfaceEvaluator computes absolute homogeneous sums before projection atcore/math.ts243–263; it restores globally constant coordinates only. A ruled side has two normallevels, so its fullnet is not globally constant even on an exact boundaryV=1. This source path explains oneULP evaluation-based outwardgrowth without a cap edit.

## Appropriate bounded test correction

Only metadata-box assertions should require finite ordered bounds, exact endpoint enclosure and outward expansion no larger than the existing1e-7 linearpolicy for these fixtures. Actual native/import caplevels and the captured4ULP interval must retain EXACT assertions. Existing mass/source/name/strictgeometry checks stay. No productCore/STEPchange is justified by this failure. Root/Medium own the harness-only change and actual browser rerun. No post-change browserPASS is claimed here.

first.log preserves a probe harness error: brepBounds is not exported from the root entry. probe-first.mjs preserves it. second.log uses the existing internal dist/brep/brep-bounds.js entry, runs publicstrictimport, checks exactnativelevels/names/ownership and writes result.json. No productionexport was added.
