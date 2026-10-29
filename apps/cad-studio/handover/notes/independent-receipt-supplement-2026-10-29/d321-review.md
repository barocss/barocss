# D321 / #2242 Stop ownership: source and receipt review

**APPROVE_BOUNDED_AUTHOR_RECEIPTS.** The selected final source and author evidence support origin-bound Stop with refusal of unrelated pending edits. No new actionable regression was established. **Independent execution: NOT_RUN.** No guard, build, test, browser, server or native instrumentation was started.

Exact reviewed commit: `a386c8705beda2c72d215da61a55fd6119351ca2`. Product repo: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`. Product/evidence reads used explicit `git -C … show COMMIT:path`. Dispatch HEAD was `a5d1acfa7e6834951819eaaeeaf6da314cae9b8f`; GPU and note/roadmap WIP were preserved. D322 later changes App, so this is not current-HEAD acceptance.

## Original symptom and selected policy

The earlier independent audit at `5463dbf32af5dd10670badd0d334c68504615292` held actual native Worker result/mass messages before client delivery, then discarded them on native termination. Public model Apply created D1, Grid accepted D2, and Stop restored D1 instead of D0: the later Grid edit was taken back while the originating model edit remained. Undo/Redo stayed usable. `research/studio003-peer-review.md` accepted that narrow wrong-edit rollback. It did not prove permanent loss, natural slow computation or current-HEAD failure.

D321 chooses the permitted refusal policy: unsupported independent undoable document edits are refused **before acceptance** while main work is pending. The final test does not accept Grid and then discard it. It checks Grid twice and Drawing Sheet size refuse without accepted document/recovery changes; camera and workspace navigation stay usable. This matches the earlier issue’s allowed completion criteria.

## Exact source and ownership

Line references below are for a386, not later mutable files.

- `apps/cad-studio/src/App.tsx:382–414` captures acceptance scope/base document, rejects stale/pending writers, clears staged Undo intent before mutation, and reserves history only after admission. `970–1018` gates generic, Render, print and Drawing writers before history/dirty follow-ups. Other named document writers follow the same admission route. Ordinary `whole=true` does not grant replacement permission.
- `src/state/workOwnership.ts:16–35` separates accepted reservation, evaluation run and uncommitted candidate. Origin requires exact after-document, generation and changed evaluated-input identity. Initial/view-only/candidate work cannot borrow previous Undo. Candidate completion permission applies only to the current opaque candidate token and is consumed by acceptance.
- `App.tsx:854–855` settles display-only reservations against the exact unchanged evaluated input. `868–878,925–947` binds the dynamic current-run token, keeps refused candidate state on its accepted base, removes completion permission in finally, and finishes only its own captured run. `workOwnership.ts:36–41` stops an old finally/cleanup from finishing a newer run. Failure does not call generic Undo.
- `workOwnership.ts:43–47` requires exact generation, current document, evaluated input and **top history entry identity** for rollback. `App.tsx:1821–1839` captures and invalidates ownership before restart resolves pending work. No run means an early return before worker/cache/history changes. With a target, Stop captures an immutable local Redo entry, removes one owned Undo entry and restores the origin document/marker, dirty=true. Without a target, document/history stay and the view is explicitly stale.
- `App.tsx:1815–1819,1841–1852,2000–2007` separates Undo/Redo and whole-document replacement invalidation from Stop replay. It does not use the old latest-Undo cancellation behavior.
- `App.tsx:1828–1832` clears worker-bound result/handoff/mass/body caches and synchronously increments worker-session identity before restart. Placed loops check that ref before submission, after await and before installation (`1072–1092`). Undo/Redo alone does not pretend to replace the backend. Worker-session state reruns placed work, not the main evaluation effect.
- Unchanged `src/engine/client.ts:48–79,86–94` still guards epoch delivery, resolves pending requests as stopped, clears transport caches and starts a new Worker. That existing protection complements App ownership; it alone did not select the right history owner.

The exact completed-run/click race, no-origin/variant/parameter UI matrix and other repair-stage restart paths remain unqualified. Ownerless Stop does not necessarily resubmit unchanged main input; stale display remains explicit until an existing trigger changes. No generalized restart/recovery contract follows.

## Artifact and source identity

Schemas were read before resolving paths. Parent/consumer manifests map artifact-relative names to bytes/SHA; the source manifest wraps its map under `artifacts`. Consumer paths resolve under `consumers/`. Profile `path` identifies captured source, while `gzip` resolves to its evidence capsule. Absolute source paths were normalized only for immutable Git comparison, not read from WIP.

- Parent **109/109**, source **25/25**, consumer **69/69** byte/hash matches. This is **203 overlapping references and 109 unique artifact files**, not tests.
- Qualification final source **6/6** matches a386. Final D321 and D318 regression each retain five matching compressed/decompressed capsules: App, workOwnership, unchanged EngineClient, browser driver and Worker helper. All source bytes match a386. These five-file profiles are not complete imported/dependency input audits.
- Qualification `baseline=e1f2…` describes pre-fix source ancestry. Final source binding is App SHA `fe99a2a25719148774ee15e69c9493c743c3e88226289cf1dcb89333a3149a1b`, helper SHA `d95db66ed196df304ce29d2b6d497b589eca361160812cb5cbca30da376f6ed8` and the final capsules.
- Focused execution used helper SHA `316181a696ea5be4a4555e75ddfa17b90d6edeaeda686c79f855a4ad4f6d93fc`, not final d95. Reversing only the final unused parameter rename `_state`→`state` reproduces that exact tested hash. The unit file itself matches final source. This supports identifier-only receipt reuse; it is not an exact-final-source rerun.

## Author actual proof

Final raw browser log reports selected D321 **1 PASS / 0 FAIL / 0 SKIP**, exit 0, plus separate starter smoke. Fourteen raw state snapshots support the selected flow:

- D1 has four nodes and is client-pending. Both Grid refusals and Drawing refusal retain exact D1 and recovery strings. **Render history keys are omitted in all three snapshots**, so their undefined equality is not full Undo-history evidence. Drawing and Model-return history strings are present and compare unchanged. Source pre-history admission and actual Undo/Redo transitions remain distinct evidence. Follow-up evidence completion condition: actually record the Render history field, assert its presence and type first, then compare it. This is an evidence gap, not a product regression.
- Stop restores exact D0, dirty=true, completed D0 local recovery, fresh/massReady one-body state, volume 1000 mm³ within the driver’s 1e-7 readiness tolerance.
- Trace binds a new epoch-2 D0 submission, source node IDs and delivered successful result to subsequent mass readiness. Exact native provider/viewport geometry identity is not exposed.
- Source-bound assertions verify public Redo returns exact D1/two fresh bodies/2000 mm³; normal Grid Undo/Redo submits no additional main evaluation (6 before/6 after); second normal Stop and subsequent normal Box Apply/Undo work. These are substages of one selected flow, not multiple unique tests.

Derived from final raw trace: first native result arrives 44.8 ms after submission, then client delivery is held 3294.4 ms until termination; four retained events are discarded. Second is 48.6 ms then 1487.7 ms; two are discarded. Both old workers have zero client deliveries after claim. The helper forwards actual native source/results/transfers and retains original events FIFO. There is no payload replacement or replay/release path. This is controlled delivery scheduling, not natural long computation or isolated kernel timing.

Dirty/recovery proof is UI plus localStorage recovery string/JSON. D321 has no native saved-file/autosave byte roundtrip. Separate D318 saved/reopened `.bcad` fixtures and selected PASS belong to its regression; do not transfer that file proof to D321. Full Undo depth and exact viewport geometry provenance remain unexposed.

Focused raw log reports **17 PASS**: 13 new helper cases plus four existing lane cases. Root raw Studio log reports **389 PASS / 0 FAIL / 0 SKIP**, exit 0, including the focused tests. Do not sum them. Later D322398 uses different source. Consumer lint has **45 warnings, 0 errors**. Types/lint/docs remain author evidence. Cleanup reports owned browser/server/context closures and returned gates; this review did not inspect or alter user processes.

## Retained failures and stop boundary

First author browser attempt used intermediate App b862 and failed a cross-workspace History DOM assertion (`undefined` versus `short_text`) before Stop. Its full original driver/helper source is **NOT_RETAINED**. First intermediate App bytes are reconstructed but match the recorded original hash. This does not restore a complete first-run replay capsule.

Second attempt used intermediate App 09e4. Refusals and owned Stop/new-epoch D0 passed; public Redo then timed out after 30 seconds. Post-Redo raw document/trace is **NOT_RETAINED**. Failure log, screenshot and exact intermediate source remain. This is a historical product regression, not a final a386 failure. Final App captures the immutable Redo entry before queued update/ref reassignment; the final source-bound driver passes its original Redo assertions.

First production lint’s unused argument failure is retained. The identifier-only fix and focused-source difference remain explicit.

No independent runtime, natural timing, whole browser suite, completed-result Stop race, full Undo/New/Open invalidation matrix, async-image matrix, all assembly/repair restart paths, other browser/DPR, full history/viewport provenance, release or current-HEAD acceptance is claimed. No new issue is raised.

Next checkpoint: return to D323 author source/receipt review when its exact commit and qualification/manifest are supplied. GPU003 remains paused until the GPU owner commits and a fresh immutable snapshot is available. No duplicate test is proposed. This finite source/receipt cycle ends here.
