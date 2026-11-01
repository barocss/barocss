---
work_id: D424
artifact_type: display-inversion-qualification
status: qualified-bounded
owner_role: executor
source_request: "Continue the roadmap and report the row and overall progress"
last_updated: 2026-11-01
---

# Local-coordinate display inversion — bounded qualification

D424 fixes a reproduced display inversion refusal on rows 13 and 16. The current source passes the full kernel run and two actual Studio STEP Opens with native mass adoption. Overall progress remains about 43%. [Counts, commands, source hashes and limits](qualification.json).

The exact STEP request succeeds in Node warm/cold wire replay but fails in genuine Chrome workers, both cold and warm. Separate recomputation in those same worker realms produces an unchanged native B-rep that also fails direct tessellation. Capturing that native data as binary64 and replaying it in Node reproduces the same refusal. Compared with fresh Node geometry, only nine surface weights differ by one ULP. Replacing only those nine values in an otherwise identical plain clone changes success into the same boundary refusal. This establishes represented-input sensitivity, not the source of the runtime weight difference.

A scratch-only witness runs after the unchanged refusal predicate and still throws the original error. Direct local surface evaluation, local seed points and local targets find a UV whose original world residual is 1.6464e-10 mm, below the unchanged 9.9900e-6 mm bound. The old inverse residual is 1.2709e-5 mm. Exact rational analysis bounds the represented surface perturbation below 1.906e-18 mm under positive-weight basis assumptions; this is not an evaluator or convergence certificate.

The correction conditions inversion in one exact common frame over every surface control point and every actual ring target. Original world seed membership, UV order, iteration settings, completion threshold and world output/binding authority stay fixed. Unsafe axes retain zero shift; the all-zero frame retains the original path. No input, weight, tolerance, public API, dependency or D422 normal-helper change. Independent removal of the approved delta recovers the exact previous tessellator source.

The pre-fix generated q8 regression fails with the original typed refusal. Final focused tests pass 37/37, including 11 new tests: q8/q12 world binding, published world evaluation, shared edge samples, finite/domain UVs, input immutability, separated-face refusal, zero/positive/negative/wide/mixed frames and out-of-net ring targets. Independent source/math review and isolated regression pass. Three mutations are caught: local inversion removal, wrong target frame and target-specific world-guard bypass. A world-evaluated-then-shifted seed mutant survives 11/11; current behavior tests do not prove direct-local seeds necessary for this fixture. That limit remains recorded.

Stable CAD build/types, lint, unchanged code-shape counts and final Model types pass. One full kernel run gives 2052 PASS / 0 FAIL / 2 SKIP. Actual Studio accepts the original compound-far sphere and centered control, using the unchanged D423 driver and fixtures. Genuine eager read and evaluate/deferred patches, default density 2.7 and adopted volume/centroid pass the finite literal budgets. Far volume relative error is 2.004e-8, area 4.283e-8 and maximum diagonal-inertia error 4.360e-8. Its centroid is exactly [999000, -998000, 997000]. All 746 source hashes match before, after and after cleanup; page/console errors, source changes and downloads are zero. Both contexts, browser and server close.

Root inspects both actual screenshots. The far tiny shape is not discernible and the centered shape is only a point; no tiny-shape rendering or GPU-precision acceptance follows. Volume, mass, area and bounds labels display zero in the UI. D425 addresses quantity rounding on rows 15 and 16 and separately captures the raw display-mesh bounds; this D424 receipt alone did not establish their source values. The areaBasis exact field identifies the native source, not a mathematical error certificate. Runtime module URLs and local-inversion tokens establish provenance, not universal transformed-source equivalence.

The original D423 full-kernel 2040 PASS / 1 FAIL / 2 SKIP remains unexplained and is not relabelled as flaky or as a regression. Both original D423 Studio failures remain preserved. Current D424 source has fresh bounded flow and full-suite PASS; it does not erase earlier failures. Raw captures, logs, bundles and screenshots stay under /tmp. OCP remains removed. No broader STEP admission, spherical OFFSET extension, develop integration or release follows.
