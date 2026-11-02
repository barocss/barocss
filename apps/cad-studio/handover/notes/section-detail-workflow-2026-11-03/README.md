---
work_id: D455
artifact_type: section-detail-workflow
status: qualified
owner_role: executor
source_request: "Continue the core CAD roadmap autonomously, one bounded category at a time"
last_updated: 2026-11-03
---

# C3-2 ordinary section, detail and source update

One ordinary section/detail workflow qualifies eight action groups, with seven checks of native geometry, actual Worker data and visible SVG. No product or repository test source changes. Baseline is `17a3991813a679f1406debf6ec09c76578b834c5`. Commands, hashes and proof boundaries are in [qualification.json](qualification.json).

## Existing provider and declared geometry

The whole retained D355 fixture is a 60 by 40 by H plate, R5 through-bore centered [15,20], with the original far-corner vertical R3 fillet at [60,40]. No feature is removed or recreated. Public A3 drawing settings create Full Section A at Y = 23 and a Top Detail B centered [15,20], clip radius 6 and absolute scale 2. The plain front section uses the existing drawing.section field; adding another named section would reserve B and change the detail letter.

The drawing provider uses native B-rep split/projection and analytic line/circle payloads. It is not the BodyResult display mesh. For this cut, bore offset 3 gives chord 8 at x11 and x19. The far fillet only affects Y at or above37, so the cap has two straight rectangular regions [0,11] by [0,H] and [19,60] by [0,H]. Native area is 52H: 520, 624 and 728 at heights 10, 12 and 14. Captured cap vertices remain on world Y = 23; strict native validity, native edge names and projected inner-boundary roles agree. Top bore radius 5 stays inside clip radius 6; at scale 2 its visible paper radius is 10, distinct from the radius 12 clip.

Targets of 1e-9 apply only to this bounded native analytic payload, following the retained line/circle family. General visibility/curves use sampling, curved section hatches use 16 samples per quarter and detail hatching uses a 512-gon. Those approximations do not receive a native exact-area claim. SVG has its separate 1e-4 coordinate formatter; the per-coordinate comparison envelope is 5.0001e-5 sheet mm, with maximum observed error 3.74315355e-5. No native tolerance changes.

## Actual Studio flow and binding

Real public controls create Section A and two-click Detail B. The original Extrude height changes 10 to 12; authored Undo/Redo restores 10/12; an identical-click zero-radius detail attempt refuses without changing accepted document/history; own project Save, Close, same-context reload and Open retain the section/detail; post-Open height 14 updates them. Only the original or exact current-height signature cache of the known vertical fillet edge may differ. Every other authored node, reference, ID and setting remains exact.

A driver-only passive observer reads real Worker requests/replies. It preserves native Worker objects and forwards original message receiver, arguments, transfer list, return and exceptions. Real WireDoc added nodes are cloned before transfer and cached only after native post succeeds. Drawing pairs are keyed by page generation, Worker and request id. The reconstructed whole source and Y = 23 options match the native inspector; current Section A and Top payloads match with zero-only comparison normalization. Nothing is sent back, rewritten or fabricated.

Readonly actual placements and inverse SVG transforms connect those payloads to the rendered sheet. The unique section cap group excludes the Top cut-line annotation. Its actual inner lines map to x11/19. Detail B contains two R10 half-arcs around the expected center, with reversed diameter endpoints; the R12 clip is excluded. Independent Python checks physical closed forms and actual XML geometry. The observer adds timing overhead, so no performance acceptance is inferred.

## First failure, reuse and verification

Run01 created the real section/detail, then FAILed because JS deep comparison distinguishes Worker -0 from inspector JSON +0. No nonzero numeric difference was observed. Raw V8 evidence is retained; structured comparison copies change only signed zero. Other finite/nonfinite values and undefined fields are not rounded, dropped or coerced. Later cap-group and half-arc parser assumptions were corrected against the retained actual SVG before another Studio run. Prepared drivers02/03 were never executed and are not additional failures.

The continuation publicly Opens the exact accepted actual section/detail file, reuses the public creation evidence, completes the failed H10 native/Worker/SVG qualification and runs the remaining steps. No creation clicks or native preflight baseline are repeated. Oracle v2 changes only consumer XML checks; an exact reversal certificate preserves all native assertions. An offline parser check uses the immutable real run01 Worker/SVG data, not another SUT run.

PASS: three provider/independent preflight cases; all eight actual action groups; seven current native/Worker/SVG checks. Run02 has 12 screenshots; root viewed six final images and the original created sheet. All 2351/2407 source capsules match at their cleanup/current checks. Observer errors, downloads and page/console errors are zero. The own project namespace is removed; runtime closed, wrapper PIDs absent and gate leases released. Independent High evidence review finds no remaining issue within the selected scope.

FAIL: the original comparison-tool signed-zero failure remains immutable. NOT_RUN: new unit/build/types and full kernel because no repository source/test or B-rep core changed; D454 checks and D433 full-kernel authority remain retained. Export/download, standards, new drawing dimensions, general curve clipping/visibility/hatch accuracy and performance remain unqualified. A possible narrow-root ellipse scan issue is source-only NOT_PROVEN_PRODUCT and is not silently counted as a defect or fixed profile.

Public inventory and driver work used GPT-6.1 Sol Medium; native/math/oracle work used GPT-6.1 Sol High. Root owned execution, freeze, cleanup and visual review. Core readiness remains NOT_MEASURED, legacy 43% frozen. #540 remains open. Current bounded exchange evidence remains at its recorded scope; the next priority is C4 basic static assemblies, with Motion/Physics and all existing HOLDs unchanged.
