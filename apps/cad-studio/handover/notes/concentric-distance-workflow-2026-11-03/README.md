---
work_id: D458
artifact_type: concentric-distance-workflow
status: qualified
owner_role: executor
source_request: "Continue the core CAD roadmap autonomously, one bounded category at a time"
last_updated: 2026-11-03
---

# C4-3 ordinary concentric and distance workflow

Qualify seven public action groups for one unrotated pin/bore assembly. No product or repository test source changes. Baseline is `cda34a21e17b2c07f54fb202e53c3ee993589fd7`; [qualification.json](qualification.json) records commands, numeric bounds and provenance. Core readiness remains NOT_MEASURED; legacy43% is frozen.

## Existing proof and declared case

Retained QA UM1–5 observations exercise the native/control route with pick-state mutation hooks. They are not public Reference-picker proof. The existing starter recipe is a64×32×8 holder with a centered R4 through bore at[32,16]; its pin is the existing R4×20 cylinder recipe. A scratch source-authored document embeds both; public construction is explicitly NOT_RUN. No delivered tool is recreated.

Public Concentric chooses base n2.side0 and pin n1.side0. It aligns pin position to[32,16,0], leaving one slide and one turn. Public Distance chooses base n1.top and pin n1.bottom. Distance0 moves the pin to Z8; editing to3 moves it to Z11, leaving one turn and no slide. Native holder volume is16384−128π, centroid[32,16,4], genus1. Pin volume is320π, genus0; its centroid is[32,16,10] after Concentric and[32,16,18+d] after Distance d. Native bounds, named cylinder families, axis/plane geometry and strict closed solids agree. Original1e-9 volume-relative and native centroid/bounds/cylinder/plane absolute targets remain unchanged.

## Refusal, history and files

Appending another Distance5 on the same faces conflicts with the accepted Distance3. The provider attributes its2 mm residual to the new mate and keeps the prior solved position. Public Studio reports that specific earlier-Distance reason; faces-pending or unrelated refusal cannot pass. The accepted document, IDs, references, visible history and Z11 remain exact.

The first Undo follows the failed attempt and Cancel. It returns the exact prior Distance0/Z8 document; one Redo returns Distance3/Z11. This directly proves the refusal adds no undo entry. Public Save to one owned OPFS project, Close, same-context reload and Open retain Distance3. A post-Open edit back to0 exactly restores the earlier document.

Every current state checks accepted document and public Instance XYZ/freedom, then native geometry of that same stored input and a separate solver result. Eight native bindings use three new inspector calls and five exact-document reuses, with current source/test pins checked again for reuse. All eight independent oracle checks pass. The three prospective provider/oracle states and one solver-only conflict probe were completed before the actual run; none is substituted for public product proof.

## Provenance, result and limits

PASS: seven actual groups, twelve screenshots, eight current native/oracle bindings and three prospective states. Root viewed six final images. All2367 pinned files match before/frozen/after/cleanup/current. The owned project is absent; context/browser/server closed, own wrapper PID absent and gate lease released. Downloads and page/console errors are zero. The first preflight wrapper did not run a provider because load45.53 exceeded40; it acquired no lease. A later admitted batch passed. Driver01 was prepared but never executed; Driver02 adds public render/effect waits without changing numeric limits or product behavior.

The historical UM6 X45 case was a real accept-then-placement failure. Ancestor28cfdab95 fixed that rotation route; retained N9/M09/M10 and the QA fixed report are separate positive evidence. Original raw failure remains unchanged. The classification records source/commit provenance limits; no fresh arbitrary-angle accuracy result is claimed or silently inferred from this unrotated profile.

FAIL: none in the executed D458 native/actual checks. NOT_RUN: new unit/build/types or full kernel because no repository source/test or B-rep core changed; D456 checks and D433 full kernel remain retained. Negative distances and unequal radii are accepted constraints by existing contract, not refusal controls. General contradictions, arbitrary-angle accuracy, full constraint, fit/contact safety, Motion/Physics, export/download, performance and raster precision remain separate.

Inventory/driver/source review used GPT-6.1 Sol Medium; native solver/math/oracle preparation used GPT-6.1 Sol High. Root owned execution, freeze, cleanup and image review. #538 remains open. Next is D459/C4-4: inventory related assembly drawings, source revision and model-update evidence before selecting a missing ordinary profile. All owner HOLDs remain unchanged.
