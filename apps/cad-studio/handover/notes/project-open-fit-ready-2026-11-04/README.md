---
work_id: D491
artifact_type: project-open-fit-ready
status: qualified
owner_role: executor
source_request: "Reproduce and fix the existing project Open auto-fit contract after its own linked-source offer"
last_updated: 2026-11-04
---

# D491 — Project Open fits after its own linked-file follow-up

SMALL C1/C5 correctness fix for rows05/12/16 on parent `cafc0900fb342ca50e5cb728e46ad48427461356`. The original actual run confirms a product auto-fit failure; the same public workflow after the fix passes2/2 selected automatic-fit/public-F conditions. All40 declared assembly-box corners fit automatically at the unchanged criterion. The accepted document, pending offer, root Worker summary and four instance bounds remain exact across original/fixed evidence.61 focused tests, scoped lint, Studio types and final Model types pass. High final **PASS_BOUNDED_SAVED_COORDINATE_FIX_AUDIT** passes27 bounded saved checks with0 failures,737 native/Model source pins unchanged and six reviewed-image hashes intact; SHA`822db51a0d9fbcec37c79b5e01c7c19e0c75425acb992fbeaed34e10f217ec14`. It performs no SUT/native/oracle rerun. [Qualification](qualification.json) keeps the original failure and corrected evidence separate.

## Original product failure and finite control

D490 observed a heavily cropped assembly after returning from its small linked source. D491 reuses its exact linkedH10 assembly, SHA`b7f042e1335704c8c7a8b7c13ef0d7431ee2ceac6600081c2614ea0eb0b5ca65`, and sourceH10, SHA`ef0d5b2325b775af58f07d6811373bff83a045a60f8b1ee0a095fefa032625fa`. These retain D490's separately pinned source-link setup; no new pattern/link construction is claimed. Public sourceH14 Save and assembly Open produce a waitingH14 offer while the four accepted cubes remainH10.

Original receipt `/tmp/barocss-d491-repro-run01/receipt.json`, SHA`b5911ae935b84af29f74a730fb19085795f8e056b18858294b3c915c0347b0c2`, is FAIL. After1500ms quiescence and a250ms stability observation with0 screen drift, automatic Open leaves34/40 corners outside XY and14 outside projected depth. Minimum CSS clearance is−115323.46474763786px. The small-source public F baseline passes with78.17000562216901px minimum clearance. Public F on the exact same pending assembly restores0 XY/depth violations and147.6532462676929px clearance without changing Doc/pending/Worker/bounds. This confirms the bounded product contract failure before implementation, rather than classifying the crop from one image alone.

Root original review SHA is `2f319c5ce0afe75e63319b3de511efed98340010739a5691c5b8c2cab4a852e7`. The separate original High brief SHA is `26109ed22d57233b97711920d813fdfaba20755c8a77ae917b58a4e094f64574`. Both retain the product failure and same-document public-F control.

## Narrow private ownership correction

Previously App's project `onOpened` scheduled Fit at300ms against its accepted Open scope. The same Open then read its log/autosave and checked linked files. Its legitimate `onLinked` offer committed a document through ordinary `commitParts`/`setDoc`, which invalidated that accepted scope; the delayed Fit could therefore lose ownership.

The private project hook now announces `onOpenReady` after its log, autosave and automatic linked work. Only the automatic Open caller may accept an explicitly returned scope from its own synchronous linked callback. It then rechecks request, project session, store, path and App scope before announcing readiness. App schedules the existing300ms delayed Fit from that completion point. Ordinary document dispatch still invalidates Open ownership; `commitParts` only gains a success boolean, with its guards intact. Informational `Check placed parts` does not adopt that scope or announce readiness/Fit.

Files changed are App.tsx, storage/useProject.ts, private app/projectOpenFit.ts and the two ownership/Fit test files. This adds no public SDK API and changes no GPU/Viewport or CAD/Model/B-rep source. No camera epoch or snapshot guard is added; no such existing user-camera guard is claimed. Unit tests cover stale Open/edit/Close/unmount scope cancellation. They are not an actual UI user-camera takeover proof.

The original timer branch is not instrumented in the browser. Source-path tracing, focused ownership tests and the corrected actual result support this bounded cause and correction; they do not constitute a separate runtime trace of that timer or a general geometry-readiness guarantee. The300ms delay is unchanged and no readiness retry/polling policy is introduced.

## Fixed actual result and unchanged criteria

Fixed receipt `/tmp/barocss-d491-fixed-run02/receipt.json`, SHA`13ecd6ee73b94d6c31e75ce5fe0a5c995908838c1dc4359e130a8ec4da83a694`, is PASS. Root runs `run-fixed03.sh` after a separate prelaunch wrapper correction. Automatic Open and public F both have0/40 XY violations,0 depth violations,0 drift and minimum clearance147.6532462676929px. The small-source F control also passes. Original-to-fixed Doc/pending/Worker/four-instance-bounds equality is exact. Root fixed review SHA is `e58287dbd333ba394164f308d00a44d73cd343ffc2b004a1e5a9929fc959dd6a`.

The three driver/helper mjs files are byte-identical from original01 to fixed02; only sealed config/source pins and owned namespace change. The criterion remains one CSS pixel at local client coordinates cross-checked against the page CSS rect, without DPR multiplication; projected depth must remain in[−1,1]. Quiescence remains1500ms, stability250ms and allowed stability drift0.25px. Both original and fixed observations actually have0 drift. Forty probes are eight corners each of the unchanged base and four acceptedH10 cubes. clip-W and true-behind classification are NOT_MEASURED. Palette/dock occlusion is outside the canvas-coordinate criterion; no complete unobscured workspace claim follows.

## Checks, custody and boundaries

Root runs `node scripts/test.mjs project-open-ownership.test.ts project-open-fit.test.ts late-save-ownership.test.ts edit-in-place.test.ts`:61 PASS. Scoped lint, Studio tsc and final Model tsc after the final test edit pass. Receipt `/tmp/barocss-d491-checks01/receipt.json`, SHA`ff32abe0f5d3f447334b8e0286e5f6f325fb9794fcd71b99da3e63b24496880c`, retains exact command statuses. Its scope description contains inherited no-product-change/type-reuse boilerplate. Root preserves the raw receipt and records the corrected scope from actual commands/pins in `/tmp/barocss-d491-root/final-check-summary01.json`, SHA`51c0883a521e7261792be6ba6d66e6d1cd15a96d5fae7d7e9bc8e3c27f5d615c`: this is an App/private-hook product fix with three product sources and two test files,61 actual focused tests and newly run lint/types. No test or result is repeated or changed. D484's unchanged CAD semantic build and737 unchanged D490 CAD/Model source pins are reused separately. Native evaluation and full kernel are NOT_RUN; this camera fix adds no B-rep qualification.

The first postfix wrapper used the driver01 config path with the driver02 expected hash. `/tmp/barocss-d491-root/actual-wrapper02/prelaunch-failure.json` preserves `FAIL_BEFORE_GATE_AND_BROWSER`: no gate, browser, SUT run or test rerun occurred. Root corrects only wrapper paths in `actual-wrapper03`/`run-fixed03.sh`. The original product failure remains distinct from this prelaunch harness failure.

Root reviews six images, three original and three fixed. Original wrapper1844/helper1845 pins were equal through cleanup and the pre-fix root review; the five declared source/test changes then implement the correction. PID42978 is absent. Fixed wrapper1850/helper1851 pins remain equal through cleanup and final review; PID51773 is absent. Both owned project namespaces are removed and absent; contexts, browsers and servers close. Errors, console errors, downloads and watched changes are0. Sol Medium implements the private fix and tests; root owns sealed runs/custody/images; Sol High reviews the original failure and final saved evidence. A separate Medium source review returns APPROVE_BOUNDED; helper predicate tests, actual-hook paused-store tests and root before/after browser evidence keep their distinct proof scopes.

This closes only the reproduced project Open auto-fit failure after its own linked offer. The original D490 cropped checkpoints retain their original observation limits. No redesign, user-camera epoch policy, general geometry readiness, physical mass, nested/Motion/Physics, export, manufacturing or standards admission follows. #538 stays OPEN and#2180 CLOSED without changes. Core readiness is NOT_MEASURED, legacy43% is frozen, all HOLDs and the owner PDF deferral remain; mobile/downloads/develop/release are not selected.

Next is **D492: the selected four-case profile-solid exact mechanical extraction** from current part-model1348 lines. Move only the94-line Extrude/Revolve/Sweep/Loft cases behind private helpers; preserve APIs, exports, algorithms, native output and existing profiling. First establish source/AST equivalence and reuse the retained D473 Loft profile rather than replaying construction. Do not include sweep-curve, which has live profiling, or admit new geometry. Root assigns implementation after D491 is pushed.
