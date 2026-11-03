---
work_id: D482
artifact_type: vertical-contact-refusal
status: qualified
owner_role: executor
source_request: "Correct only the exact accepted curve-spacing6 strict-native failure reproduced by D481"
last_updated: 2026-11-04
---

# D482 — Refuse the reproduced non-manifold contact

FULL bounded correctness change for C2, rows08/16/30. The existing prismatic cap guard now includes the half-circle equality case. The exact spacing6 result from [D481](../curve-contact-admission-2026-11-04/README.md) is refused before a native output exists. Actual Studio preserves the accepted spacing8 document, history and geometry, including an own-project Save/reload/Open. This is a safe-refusal correction, **not a repaired manifold spacing6 solid** or wider pattern support. [Qualification](qualification.json) separates current PASS, original FAIL and NOT_RUN.

Parent is `28881bb137c54de334ad9ff4e1e1b248ffa9ca97`. Proof uses two known CAD candidates plus five independent Viewer WIP files. Only the two CAD files and this decision/navigation are included in D482; the separate JSX/Viewer item remains pending D483. The original D481 product FAIL is immutable.

## Exact guard and compatibility boundary

At x24,y10,z0..10, two removed prisms meet and remaining material occupies opposite NW/SE right-angle sectors. Exactly8 of the existing16 angular midpoint samples lie in material. The old `> 0.5` guard misses this pinched boundary; `>= 0.5` refuses it. The guard still requires distinct native vertex identities at one cap XY point. A source proof verifies that only this comparator and one comment change in the prismatic implementation.

The sampler, radius, region logic, error reason/code, IDs, strict validator and tolerances stay unchanged. No vertices are welded. The two unsafe spacing6 positive test expectations become an explicit direct-evaluation/reevaluation/facade refusal and document/B-rep/cache retention regression. Other accepted recipes now request strict checkBrep. The native error remains BrepError GEOMETRY; the existing facade maps this final-output error to EVALUATION. No public error mapping is added.

This is conservative compatibility tightening for the observed equality bucket. It does not establish a universal contact classifier; shares below half and broader contact variants are not investigated. D195 crescent/internal tangency and D194/D204/D274/D275 assertions remain intact and pass.

## Full checks, original harness failure and continuation

Root runs `bash /tmp/barocss-d482-root/run-checks01.sh`. CAD full lint/code-shape and semantic build pass. Full kernel:2169 tests, **2167 PASS,0 FAIL,2 existing gear-survey SKIP**,980.783 seconds. The new refusal/cache/facade regression passes. Model parameter/curve tests pass12/12. Primary receipt SHA is `069711c6ce975615897e65235c58f59d14a7e6c33c6d66038d7d6e9a4a50d711`.

The primary aggregate is **FAIL**, not PASS: root invoked the Studio runner from the repository root, so five candidates tests read an incorrect `.claude/packages/...` fixture path and fail ENOENT before geometry assertions. Seven direct-curve tests pass. No product change addresses this invocation error. Root preserves the failed receipt and verifies2472 source pins/PID13197 cleanup. The full-lint command actually runs `node scripts/tool.mjs lint` in `packages/barocss-cad`; the wrapper's initially recorded argv omitted that cwd correction, which the root review explicitly records.

Root continuation `bash /tmp/barocss-d482-root/run-checks02.sh` reruns only `node scripts/test.mjs candidates` in `apps/cad-studio`, five PASS. It then completes the previously NOT_RUN native/control/mutation gates, StudioTSC, final ModelTSC after the last Viewer test edit, and diff check. Eight continuation commands pass; SHA is `41b063862f5ab71c5ffa090b30aa133bcbc06d6584d623cfa9f7744692c847a7`. No full-kernel or passed7/12 tests are replayed. Only three declared independent Viewer files changed between primary and continuation, with their separate fresh semantic/71-test receipt; CAD/Model source remains exact. Aggregated final-checks SHA is `33110a960e2155a2a34dad0eb1ff0896a219d8ed0b5e651551aa7a2515a4a440`.

## Independent native and original-condition mutation

Current and original-predicate bundles use the same source graph, overriding only the exact preimage guard for the negative control. Both save all raw source/reader/native outputs before the independent Fraction oracle. Current8 B-rep, strict report and mass match both the negative-control8 and the original D481 actual8 exactly. Current6 throws the existing GEOMETRY error before output. The original `>` condition recreates the original strict-invalid6 B-rep with two cap-loop self-touch issues; this is a detected negative control, never geometry6 PASS.

Native/mutation oracle SHA is `3596463c640c91d4e2a46f183d1fad7a4faed399f33df8123bf97c3fcb4f61df`. Independent High saved-data review accepts the exact source/native/mutation boundary, SHA `7af1ccb2f9da3340024054c271f81af6cf4251244df7645904694c2382051744`. It does not run a full mutant test suite or new variant.

## Root actual desktop flow

Root runs `bash /tmp/barocss-d482-root/run-studio01.sh`, config SHA `1a200b1410d73c17b35230db5213df54551162601ce7a6e24550864461a35cbb`. Input is the retained actual D481 Open8 document, byte-identical to its source-authored seven-node antecedent SHA `d4a5c90325944f10c5ac20de9229466e0d7db6130a26e7b0dbb4de5121e1636a`; no public construction replay is claimed.

Three groups pass: current Open8; public Parameters6 refusal with exact document/history8 retention and original GEOMETRY reason; own project Save/Close/same-context reload/Open8. The actual field returns to8 and the refusal toast is visible. One whole-native capture and two exact-document reuses support three fresh independent Python/current-Worker bindings. Actual receipt SHA is `5e31c7144639e4ff01ced8c713d55550a6de91c6018da9a6c5e4d80bcfbe9f41`.

Spacing8 remains V23600, C=[8894/295,5931/295,5], bounds[0,0,0]..[60,40,10]. Maximum native V absolute/relative errors are2.9103830456733704e-11/1.2332131549463435e-15 and centroid absolute error5.684341886080802e-14; bounds/corners/carriers/support/cap-area errors0. Current Worker V/C errors are0. Original physical budgets remain relative-V1e-9 and absolute1e-9.

Root reviews six images. The pre-qualification reopen image is transiently empty; the final qualified image shows the retained plate. The open palette partly occludes it, so full preview fit is NOT_MEASURED. Wrapper2498/helper2499 source pins stay equal through cleanup/current; one helper-only key is an alias of the already-pinned native inspector. PID59118 is absent; owned D482-path-run01 is removed/absent; context/browser/server close and gate/freeze release. Errors, console errors, watched changes and downloads are0. Root review SHA is `99d4a0a3251f8eec4cbec1d5f52df868d6dfda3787f5f5272a1b76ffb551edef`.

Sol High final saved-data review accepts the three retained8 bindings and their source/cleanup/physical boundaries, SHA `484011aaf249edd238285d0705e4b8b102dc50fa907b6399e9fae530685ca9d6`. No product or oracle runs occur in that audit.

No other geometry variant, repaired6 solid, export, browser restart, CI, release or mobile test occurs. Mobile is NOT_RUN_OWNER_RULE. Sol High owns source/geometry/native audits, Sol Medium the actual driver, root all CAD execution/custody/images. Issue#534 stays open; this does not fulfill its whole feature checklist. D476 historical first-pass closeout, core NOT_MEASURED, legacy43% frozen, PDF owner deferral and all HOLDs remain.

Next D483 completes the already requested existing-Viewer JSX proof against this final CAD source, then queued profile/detail maintenance. Prototype proof is separate from a released cad-react package.
