---
work_id: D483
artifact_type: jsx-existing-viewer-bridge
status: qualified_bounded_prototype
owner_role: executor
source_request: "Use the existing Viewer to render actual JSX CAD and test screen updates from props in a separate agent"
last_updated: 2026-11-04
---

# D483 — Render a real JSX bracket with the existing Viewer

FULL public-API item for C5, row32 and row16 robustness. Actual nested `<Bracket width={width}/>` drives the real CAD Worker and existing `@barocss/viewer`. Public DOM Width80→100→80 changes and restores the current Viewer framebuffer and accepted document exactly. Two saved actual generated documents pass separate independent native physical checks against current D482 CAD code. [Qualification](qualification.json) records source/evidence hashes and boundaries.

Parent is `7cd412556afe5630856d1fdc4f7d4b98f538b5a3`. This commit adds the bounded Viewer input, regression coverage and API documentation. The React compiler/host remains an experimental local prototype, with source snapshots under `/tmp/barocss-cad-react-live-demo-2026-11-03/post-d482-attempt01/input-sources/`; a versioned/released cad-react package is not delivered by this item. No dependency, private GPU renderer, custom React reconciler, geometry provider or UI redesign is added.

## Existing rendering ownership

`Viewer.loadDisplayMeshes` accepts copied render-only Worker triangles: explicit Z-up/mm, revision and1..4 unique body IDs, at most4096 vertices/24576 indices. Viewer rotates [x,y,z]→[x,z,−y] once at its display boundary, then uses the existing Presenter/GPU, camera, fit/orbit/pan/zoom, control leases, readPixels, clear and disposal. The old Surface/native APIs and budgets retain their contracts.

This profile carries approximate body display authority; it creates no native Surface, Face or UV references. The CAD engine remains physical authority. Invalid input retains the accepted scene before presentation. A Presenter failure in display mode or a handoff from it causes terminal disposal because the existing Presenter has no rollback guarantee. Existing native appearance guards stay intact. One early source-review suspicion about direct appearance handoff proved unreachable behind those guards; the review stop is not a product defect.

The JSX source composes Target/Tools, Union/Difference, profile-based Extrudes, four keyed circular holes and a wall window. There are no manual feature IDs, fixture Doc injection, model setters or compile buttons in the measured flow. Ordinary React props/layout realization compiles20 nodes; the existing Model reader normalizes only logical output label `result` to body keyb19. Authored fields/IDs/references stay exact. The host checks current native owner and a separate Viewer sink's mounted/frame owner; EngineAdapter.freshPresentation remains false and is not used as Viewer presentation evidence.

## First failures and final checks

The initial actual host type check has three diagnostics: one isolated-checker ambient configuration issue and two new helper inference errors. Both causes are corrected; subsequent Viewer build/helper checks pass. An unfinished full-suite attempt is stopped for the later-disproved appearance review concern, recorded as REVIEW_STOP_NOT_PRODUCT_FAILURE. Its RUNNING partial receipt is not called a full PASS.

The first real JSX/browser run then passes at the original guard baseline. Source review subsequently identifies a real bounded input-preparation defect: typed-array subclasses can change length after the budget check. The isolated reproducer accepts4097 vertices despite the4096 limit and calls the overridden positions.length4100 times. This is retained as REPRODUCED_PUBLIC_DISPLAY_BUDGET_FAIL; it is an input-boundary observation, not an adversarial live-GPU render proof.

The final input guard requires exact typed-array prototypes and rejects own length/buffer/iterator overrides before reading metadata. A public Viewer regression checks zero getter/iterator calls and retention of the accepted scene/Geometry. Current-source checks pass: real host import-closure semantics0diagnostics, full semantic Viewer build, seven helper/strict-input tests, **71/71 full Viewer tests,0 FAIL/0 SKIP**, and named ESLint. Source14188 paths stay equal. Receipt SHA is `6fb8e733401a6a98df0d92547e82a09009b3c66b7dc02aa134e8081a87def3fb`. Root's D482 continuation provides final ModelTSC after that last test edit. Earlier17 injected adapter tests remain separate antecedents, not a new actual-GPU claim.

Final-helper mutation controls run only on temporary copies: normal4/strict3 baselines pass; missing rotation, aliased indices, missing budget, missing normal validation, missing exact-prototype guard and missing own-metadata guard all trigger intended assertion failures. Six finite faults are detected; this is not a general mutation score. Receipt SHA is `092722f2f06576bf9d8c6a91dcb3440c7f1d218f0ff3c25b45046d4662f9e4df`. Independent source and final guard-delta reviews accept their bounded scopes without runtime claims.

## Final current-source desktop proof

The separate Sol Medium agent runs `/tmp/barocss-cad-react-live-demo-2026-11-03/post-d482-attempt01/run-live.sh` with `CAD_REACT_D482_HEAD=7cd412556afe5630856d1fdc4f7d4b98f538b5a3` and `CAD_REACT_D482_RECEIPT=/tmp/barocss-d482-root/final-checks01.json`, Node22 and the serial gate. It uses existing Chrome without new GPU flags or downloads. Actual DOM input alone drives80→100→80; real Worker evaluation revisions1→2→3 and three authenticated mass merges align native and Viewer owners.

Each current frame has a nonempty1000×700 RGBA readback:107469,105457,107469 non-background pixels. Width80 framebuffer SHA is `6a75988648670bd0420310f69dbd0eef453d5719b1cb3b4f2545c5c60e5577b9`; Width100 is `93ef36c9cd07e214c8709d3f8d8bf9c1cac9b1e54ec2703c274ae21e06042350`; returned80 exactly restores the first SHA and accepted document bytes. This is canvas framebuffer equality; full-browser screenshots differ in input focus.

Final browser receipt SHA is `0e053c3379ce8e5aca240a440da4155ecc59a0edbbc584792417d069cc616a0c`, wrapper SHA `71ed813acebe366ab53c8675bd0a2b764c2f5617b4ea160cfd432f6702bbdcbd`. Source14178 sealed paths/server14180 paths remain equal through root review. Owned serverPID68678 and wrapperPID68491 are absent; real engine.worker close is observed, context/browser close and owned Vite IPC acknowledgement/exit0 bind its end receipt. Errors, console errors, downloads and external requests are0. Foreign gate holders are preserved.

## Fresh raw native proof

Root runs `bash /tmp/barocss-cad-react-actual-native02-root/run.sh`, rebuilding the capture bridge as `/tmp/barocss-d481-repro01/build02` from current D482 CAD. Old build01 is not reused. Two actual emitted Docs, canonical SHA`c7527fc13be3468475533404f2eb93542823d7ccc22ccd906d329ac22e03918c` and `05d8846bd001536f508103f1d9fab18aaf7223428a849198857c9e3864c843e3`, drive separate native captures. Returned80 supports exact-document reuse only.

Independent material integration gives V=660W−1680−216π, Cx=W/2, Cy=(27900W−95760−5832π)/V, Cz=(10380W−68880−648π)/V, bounds[0,0,0]..[W,60,56]. Actual V80/100=50441.41598682456/63641.415986824555. Both native shapes are strict-valid closed single solids of genus5, with four R3 floor-hole carriers and the expected clipped wall-window carriers. Independent de Boor/pcurve/reciprocal/topology/carrier checks pass at the sealed finite sampling budgets. Maximum V absolute error5.093170329928398e-11, centroid absolute error1.0658141036401503e-13, bounds0, radial error1.9095836023552692e-14, pcurve gap1.591302455776226e-14. Current Worker-native V/C differences are0. Budgets stay absolute V1e-6, C/bounds1e-8, carrier1e-7; inertia has no independent accuracy claim.

Native result receipt SHA is `74b4e83ee9b29c4dbad683adb173a92cfa569527c101aa7b0f5ce63fbd264196`; its equality to the earlier result is exact physical/document equality, not stale build reuse. Fresh wrapper SHA is `50ec83473f4ff267e88a1fd23fd87312b260d1e5d6378ac9a7e3e6d548c6fb60`;481 input pins remain equal and PID81648 is absent. Root reviews all three final images: bracket, four floor holes and wall window are fully visible, and the width control matches the changes. Root review SHA is `40a056f14b65af8c7be142a925a65b303b8194fa0c4a624456c6e6eab7beffbd`. Sol High final saved-data review accepts the declared physical/owner/frame boundaries, SHA `e2fd4105757edc240a2b79dc674d90a4cf14ed5c1caa25708cff9f16f0e11616`.

## Scope retained

This is one synchronous nested React bracket at two declared widths, with an implemented public Viewer display input and a local JSX host prototype. Arbitrary widths/components/Suspense, native Face/UV picks, inertia accuracy, persistent SDK integration, mobile, CI and release are NOT_RUN or unqualified. D482's separate root Studio3 proof covers the CAD workspace; this measured page is a Viewer demo, not a claimed new Studio workspace integration. #665 stays historically closed and is not reopened; #534 and row32 commercial scope remain open. Core NOT_MEASURED, legacy43% frozen, PDF deferral and all existing HOLDs remain. Next D484 is queued profile/detail structural maintenance, requiring fresh current public evidence when old input custody is unavailable.
