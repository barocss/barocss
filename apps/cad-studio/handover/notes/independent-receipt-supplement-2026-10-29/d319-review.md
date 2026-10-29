# D319 Viewer lifetime receipt review

Status: **FIXED_AUTHOR_RECEIPTS_VERIFIED**, limited to A03 / #2238 Presenter-owned Geometry replacement and clear in the recorded SDK profile.

Review method: exact Git-object source inspection and retained-evidence hash checks. Independent audit runtime, tests, build and browser: **NOT_RUN**. No author-success check was rerun. No product source, active HandleStoreOPFS WIP, other research file, process or Git state was changed.

## Source identity and artifact integrity

- Author fix: `9916bda9f4d8b74e2d34f14cfabb6822e412b93e`, parent `b1a9ed8c9dbbbe463fae1600151041870914937d`.
- Repository used explicitly for every Git read: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`. This review does not infer a HEAD from the audit directory or bind live WIP to the receipt.
- Evidence root in that commit: `apps/cad-studio/handover/notes/presenter-geometry-lifetime-2026-10-29/`.
- Recomputed SHA-256 and byte length from commit blobs for all entries in `artifact-manifest.json` (36), `consumers/artifact-manifest.json` (34), and `qualification-artifacts.json` (75): **145 entry checks, zero mismatch**. These manifests overlap. They are provenance checks, not test counts.
- All **580/580** final browser source-input hashes and byte lengths match this exact commit. All are tracked product inputs inside the specified worktree. After resolving metafile keys relative to `packages/barocss-viewer`, its 580 paths and byte lengths exactly match the input receipt. No outside product source was found.
- Final Presenter SHA-256: `96ce81cb3be6bc06060a7114a518a0b9925f139c7ce71ce9e7fab3ca0a8a3892`.
- Both retained gzip bundle payload hashes match their declared uncompressed bundle hash. The after bundle has 580 input entries, all matching commit blobs. The baseline has 581 entries: 580 match current commit blobs; the current Presenter path has the expected pre-fix hash. The baseline also includes the separately archived Presenter.
- All 11 archived tracked source/config inputs match the parent commit byte for byte. The two archived GPU dist outputs are hash-bound retained artifacts; they are not tracked Git blobs. Six final source/test hashes in `verification.json` match commit blobs. Its two generated Viewer dist hashes are declared build-output hashes, not independently verified Git-source bindings.
- The final browser harness SHA-256 is `1e955b886c0990a939df2d5727df6149ba8c9d16407959be6de8af318df2a1cf`. Reversing only the declared local-variable rename gives the actual-run hash `31a6e572957e61226a5705ac41db1ba680561d6c79ba479c3f8b233f1cd0e41b`. Both hashes match `local-name-equivalence.json`. Source behavior equivalence is independently checked by this exact textual reversal; author syntax/lint receipts cover the final name cleanup. Browser rerun after this cleanup: **NOT_RUN**.

## Ownership and consumer route

The actual consumer is the public SDK: browser harness `serve()` bundles `packages/barocss-viewer/src/index.ts` and serves it as `/viewer.js`; the browser imports public `createViewer`. The D319 case requires Chrome, Playwright and an actual adapter. It has no capability-SKIP branch. This is not a full `apps/cad-viewer` UI run.

Source route at the fix commit:

- Public `setPackets` enters acceptance/presentation; `index.ts:747` calls `Presenter.show`.
- `orbit`, `pan` and `zoom` call `setView` (`index.ts:2085–2107`). The ordinary scene route calls `present` again (`:2082`). Public `clear` presents an empty drawing (`:1399–1402`).
- `Presenter.addOwned` explicitly creates Geometry, adds a Mesh with that Geometry, and tracks the successful Mesh (`presenter.ts:168–171`). Every triangle, line and dot path uses this helper (`:195,203,207`). Drawing inputs contain geometry data; they do not accept a caller Geometry object.
- Replacement removes each tracked Mesh before disposing its Geometry (`presenter.ts:177`). Mesh removal releases instance/material/map state while preserving Core shared-Geometry semantics (`gpu/src/viewer/viewer.ts:760–772`). Geometry disposal releases its own geometry/scalar buffers, excludes the shared zero-UV buffer, clears its GPU object, and calls Core `forget` (`gpu/src/viewer/scene.ts:247–257`; `viewer.ts:776`).
- If add throws after Geometry creation, the helper disposes that new Geometry and rethrows the same error. If a later drawing item fails, earlier successful items remain tracked until the next show, as before. This does not add rollback or prove natural OOM behavior.
- Presenter final disposal calls Core final disposal (`presenter.ts:246–249`). Core releases remaining registered geometry and Mesh buffers and clears both collections (`gpu/src/viewer/viewer.ts:2213–2223`).

No Core create/add/remove/clear policy changes are in this fix. Explicit caller Geometry remains reusable by multiple Meshes and after Mesh removal. Presenter replacement does not dispose borrowed Geometry or external ImageTexture. Core final disposal keeps its prior ownership policy. Caller arrays are still prepared afresh on each admitted drawing; in-place edits followed by public re-admission remain supported.

## Retained execution evidence

| Lane | Author result | Boundaries |
| --- | --- | --- |
| Focused actual Core methods/classes with recording buffers | Before retained `1→33→33→0`; after `1→1→0→0`. Mesh-construction failure retained `1→0` before/after. | No WebGPU device. Recording destruction calls are not driver allocation measurements. |
| Viewer package type/build and affected tests | Build PASS; 40 affected tests PASS / 0 FAIL / 0 SKIP. Final strengthened texture test PASS / 0 FAIL / 0 SKIP overlaps the 40. Final changed-source/harness lint PASS. | No new independent audit test count. Seven new ownership tests belong to the affected set. |
| Actual SDK browser | Selected 1 PASS / 0 FAIL / 0 SKIP; Chrome `156.0.8078.48`, actual default Apple `metal-3` adapter, DPR 1; errors empty. | Other existing browser test unselected. SDK flow only. |

The final actual receipt contains **122 labelled frame readbacks** and **124 count snapshots**. All snapshots independently satisfy retained Geometry = non-null `Geometry.gpu` objects = active Mesh. Surface and curve stages stay at 1. The qualified native plane plus 256 dots stays at 2. Removing dots returns to 1. Created, public clear and final disposal are 0. Clear has zero covered pixels. Each recorded frame is 307200 bytes. The harness also performs an unlabelled comparison readback before the source edit; 122 is the recorded-frame count, not a claim that every readPixels invocation was counted.

The recorded flow includes 64 orbit/pan/zoom cycles, 3 direct setView readbacks, 16 packet replacements, 16 curve camera updates and 16 dot updates. Public surface pick returns `lifetime/lifetime_patch`; public curve pick returns `native_loader_demo/reference_edge`. The same packet/position-array edit changes captured pixels after re-admission. Public fluid dots change pixels. Five PNG artifacts are hash-bound. This review relies on retained readback/author visual-review evidence and does not claim a new independent image inspection or browser execution.

## Historical baseline and first failures

The author historical browser receipt is byte-identical to audit `runs/viewer-001/receipt.json`, SHA-256 `13812f7c7c34783ed52af6defd50a3396030e6ecb3fe27c2aa9368d2a78d3c8d`. Original audit source `5463dbf32af5dd10670badd0d334c68504615292` has the same Viewer index and GPU Core Viewer source as the fix commit. Its Presenter equals the archived pre-fix Presenter. This establishes the relevant ownership-path identity. It does not establish equality of the historical 577-input and current 580-input whole bundles.

Historical actual browser result remains: 32 orbits retain/upload `1→33` while Mesh stays 1; three further camera views plus clear retain/upload 36 with Mesh 0; final dispose returns all counts to 0. Do not substitute the CPU harness empty-scene baseline 33 for that browser clear result 36.

First failures remain failures:

- Initial pre-fix unit log: 7 FAIL. Six are ownership regressions. One is an initial fault-harness timing error. The corrected pre-fix injection log separately fails with retained 1 versus expected 0.
- First browser run: FAIL, `RangeError: Fluid layer requires a qualified native scene`. The fixture used legacy `loadNative`; the repair uses existing public `loadModelSetUrls` before `setFluidFrame`. The first run has no returned full receipt and is not a partial PASS.
- The older non-D319 browser case still has environment/adapter conditional SKIP branches. Its presence does not supply coverage. D319 itself requires prerequisites and records zero skips.
- `verification.json` retains the earlier `CONSUMER_LANE_PENDING` state. The later `consumers/validation.json`, raw final browser log and `qualification.json` record completion. Treat the pending field as a prior lane checkpoint, not the final browser result.

## Disposition

Accept the author fix and retained receipts for the bounded Presenter Geometry-retention finding. Keep **FIXED_AUTHOR_RECEIPTS_VERIFIED** separate from independent audit execution, remote CI/push, release, or whole commercial acceptance.

Driver bytes, VRAM, heap/GC, allocation pressure, natural OOM, device-loss/recovery, other adapter/browser/DPR profiles, extended soak, full Viewer app UI, GPU-pick equivalence and a performance speedup are **NOT_RUN / NOT_PROVEN**. A08 frustum/pick policy and A09 rollback remain separate. The GPU Core.clear Mesh-buffer policy candidate is also separate; this receipt does not close it. Do not add author 40+1 or browser counts to audit 95, and do not treat this fix as general GPU cleanup completion.
