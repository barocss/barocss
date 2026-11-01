---
work_id: D433
artifact_type: planar-inertia-conditioning
status: qualified-bounded-polyhedral-centroidal-mass
owner_role: executor
source_request: "Continue autonomously; fix reproduced accuracy defects first"
last_updated: 2026-11-02
---

# Far planar inertia — bounded qualification

D433 corrects a native accuracy defect found while preparing the GPU follow-up to [D432](../camera-query-precision-2026-11-02/README.md). It belongs to rows 13 and 16; overall progress remains about 43%. [Source hashes, exact commands, budgets and results](qualification.json).

A locally generated analytic box was exported to STEP and reimported. Both B-reps are valid: six faces, twelve edges, eight vertices and zero boundary gaps. Their represented spans are 0.001999999978579581 mm near [999000,-998000,997000]. At density 1 g/cm³, the recorded central inertia diagonal was [3.637978807091713e-15,-1.8189894035458565e-15,0] g·mm² instead of about 5.33333305e-18 on each axis. A negative diagonal for this nondegenerate positive-mass box is invalid. Signed off-diagonal entries alone are not an error. The original wrong values and exact fixture remain preserved.

The local central second moments near 2.67e-15 mm⁵ were converted to world raw moments near 7984 mm⁵, whose binary64 spacing is about 9.09e-13 mm⁵. Subtracting the world centroid terms could not recover the lost digits. The repair privately retains the existing local moment vector and origin through centralization, restores only the world centroid and transfers the native-SI mass basis. The exported world-raw integral array, area/cache behavior and zero-origin arithmetic remain unchanged. No tensor clamping, density conversion, geometry tolerance or public API changes occur.

Scope is the positive polyhedral branch: admitted straight-edged planar and facet B-reps. Curved quadrature and mesh fallback remain unchanged; an unchanged fallback can also report method `planar-exact`, so that label alone does not qualify its precision. The generic world-raw integral API retains its inherent conditioning limit. Extra local moments are retained privately; no general memory or speed qualification is claimed.

PASS: 49 focused checks (14 new, 35 existing), independent 9 checks, four clean assertion-killed mutants (three physical, one SI-provenance), CAD build/types/lint/code shape and final Model types. Seven targeted Model mass wire/deferred/longitudinal checks also pass. The old source fails 10 of the 14 new physical checks cleanly. Twelve other declarations, public raw-array bytes/cache/area and the curved/fallback tail are independently verified unchanged.

The current full kernel run is **2066 PASS / 0 FAIL / 2 existing GEAR_SURVEY SKIP**, 2068 tests in 952.289 s. D423's historical separate-fuzz failure cause remains unresolved; this later run does not explain or erase it. A source-certificate parser initially failed to find a const arrow function. Only that temporary parser was corrected; the original tool error is preserved, and product tests were not rerun for it.

Before any browser started, source review caught an expected-identity mismatch: offline STEP uses default `step_` IDs while the real feature import uses `n0_` at every hierarchy level and prefixes every face/edge name alias. The original preflight is NOT_RUN, with no browser or lease. Cases now preserve both identities and the exact source-derived mapping, including intact pipe-compound edge strings. The independent mapping audit and final driver/Model recheck pass. No numeric helper or tolerance changed.

The first actual Studio run passes three profiles: original far STEP, centered STEP with bit-identical represented spans, and a NEW simple 30×12×6 source fixture. This ordinary box is distinct from D429's holed 64×32×8 bracket. Genuine body-tree selection opens the public properties panel. Real eager reads, accepted evaluation and matched deferred mass patches supply the unrounded fields; an inspector export or second evaluator is not used as product evidence.

| Profile at density 2.7 g/cm³ | Maximum inertia error (g·mm²) | Fixed per-entry allowance (g·mm²) | Displayed central diagonals |
| --- | ---: | ---: | --- |
| Far box | 3.90411192e-34 | 1.30967230e-29 | 1.44e-17 · 1.44e-17 · 1.44e-17 |
| Center box | 2.69107672e-33 | 1.30967230e-29 | 1.44e-17 · 1.44e-17 · 1.44e-17 |
| New ordinary box | 2.99138492e-13 | 4.61463060e-10 | 87.5 · 455 · 507 |

The table reports independently recomputed exact-rational errors. The driver compares a rounded reference with an explicit half-ULP reserve; its smaller differences are recorded separately. The exact-rational oracle uses the original represented corners and density conversion to grams, not nominal far dimensions. Its predeclared 4096 EPS local physical-scale reserves include absolute budgets for expected-zero products and a centroid world-ULP allowance. Both eager states plus three accepted states pass 75 scalar comparisons, including 45 tensor entries; all 18 rounded UI tensor labels match. All tensors are symmetric and positive definite for these boxes. Far actual diagonals are 1.4399999228864926e-17 g·mm², with maximum centroid exact-rational error 5.82076610e-11 mm inside the fixed reserve. Nonzero mixed products have focused facet-tetrahedron coverage, not a new actual rotated-body claim.

Native Float64 positions/edges, corners, mapped IDs/names, exact documents and post-view arrays remain intact. All 763 frozen/after/cleanup entries match, errors/changes/downloads are 0, and all 21 required source routes yield 144 passive runtime responses with none missing. Three contexts, browser and server close and the own gate releases. Root viewed all three screenshots, including the far body's positive property tensor and its still blank viewport. Independent final actual audit passes all 75 scalar comparisons and identity/protocol/unit/UI/source/cleanup checks; its hashes are recorded in qualification.json. Raw evidence stays under /tmp.

Next is D434, the coherent relative GPU raster frame on rows 6/13/16. GPU/GL rendering, hardware picking and nonempty-edge raster precision are NOT_RUN/HOLD in this mass task; prior D432 far failures remain unresolved. Issue #2263 stays open because complete exchange acceptance is absent. No download, dependency, further develop integration or release is included.
