---
work_id: D446
artifact_type: develop-integration-qualification
status: done
owner_role: executor
source_request: "Push all completed CAD work into the updated develop branch, then provide Claude handoff"
last_updated: 2026-11-02
---

# Develop integration through D445

The owner explicitly authorized integration of all completed CAD work, asked to include the changed develop branch, and requested a Claude handoff after the remote update. This integration preserves published history with ordinary merges. No new CAD feature, Physics feature, release, npm publication or deployment is activated. [D445](../core-cad-priority-2026-11-02/README.md) sets core-CAD priorities; [Claude handoff](../claude-handoff-2026-11-02/README.md) sets the next task.

## Inputs and preservation

CAD parent `b5decfd9e53b72c8f69094ddd2dd6c1dc7999ab9` includes D421–D444 product/evidence changes and D445 documentation. Develop parent is `8a24d6f778133b460ece7a0220d5db747debe121`. Merge-base is `12411c89b9a0f9de7e5066a5ea8f3d292c9476a8` (D420/PR #2274). Normal local integration commit is `2b5cf9ef92338ebf7ddae9d10911e7a63123d750`, tree `bd75bc00592f89342701b194a57781d823cd25db`.

The branches change disjoint paths: CAD152 and develop9529 when rename detection is disabled (develop9517 displayed changes with default rename detection). Develop's14 intentional deletions are preserved. A merge-base-aware per-path blob/mode comparison proves the candidate exactly combines both parents' changes, without an extra product edit. The initial scratch checker wrongly required a raw union of both parent path lists; it flagged those14 intentional deletions. Correcting the checker, not the merge, yields zero unexpected changes. Logs and inventories remain in /tmp, not git.

Before publication the worktree was found detached at the exact local/cad-dev commit. `git switch local/cad-dev` reattached the same tree before D445 commit. No WIP was removed; no other worktree was checked out or edited. Git author and committer are easylogic <cyberuls@gmail.com>.

## Compatibility scope

Sol High reviewed the sole develop CAD Model change, `src/robot/motion.ts`: finite-input guards precede existing timing/interpolation; valid arithmetic and local imported dependencies are unchanged. Studio/Model do not import Physics. Physics consumes CAD, so its new official provider-generator build is checked against the merged CAD. Root manifests, lockfile and workflows are unchanged on develop. No local install or new download is needed.

The batch includes translated native mass/inertia conditioning, relative CPU/GPU coordinates and small-body camera/quantity behavior, scoped STEP precision/admission/loss corrections, and source-only roadmap organization. Original failures and declared acceptance limits remain in their canonical records. D433 is the last full-kernel checkpoint; no B-rep core changes are introduced by this merge. D444 receipts remain source-identical and retain their original scope. A merged-head Studio smoke is an integration check, not complete C1-1 acceptance or general Physics qualification.

## Validation and publication

Local validation PASS: nine build/type commands (CAD, GPU, Physics, Model, Studio and interop), Model42/42, Studio5/5 and GPU42/42 unique scoped tests. Initial lint found9 unused named imports in3GPU tests/fixtures; only those imports were removed, and non-import text is byte-identical. Node syntax3/3 and targeted88-file lint pass. The initial GPU invocation omitted its required `--import ./tests/cad-dist.mjs` loader; preserve that harness failure. Corrected official invocation passes42, including6 explicitly repeated payload cases. No production source repair or lint-policy change was needed.

Actual Studio run01 PASS has six snapshots: ordinary public Open/Fit/selection, extrusion6→8 (volume2160→2880), exact Undo/Redo, native Save and fresh Open/Fit, then a saved robot motion's finite seek. It downloads exactly one existing product-generated Save file; no remote dependency/media download occurs. Local-project OPFS is NOT_RUN. Selecting the saved robot motion and seeking freezes that motion and triggers its existing automatic budgeted contact check, which remains uncertified at1.294s. The driver performed no explicit Check path or Play action. Its draft limit saying “no contact sweep” is too broad; the actual visible refusal is retained. Finite seek at0.0172294546434637s of1.7229454643463709s and finite joint readouts do not certify contact safety or dynamics.

Root viewed fresh-open and robot screenshots and checked1345 before/after/cleanup source hashes against current files,1083 fixed inputs, zero page/console/file-change errors and closed resources. WrapperPID39684 is absent and gate is empty. Actual receipt SHA256 is `5a70d26bf6abd3593fe7ede71b7f406d4c848f08e12d8ac74174e35e4f78fa27`. The generic helper has no runtimeModules capture; a root metadata reader's initial optional-field assumption was corrected without a new browser run. Raw artifacts stay under `/tmp/barocss-d446-consumer` and `/tmp/barocss-d446-checks`.

D444's1042 frozen source paths remain exactly equal to current files; reuse only its original bounded scope. Physics provider generation introduced no tracked difference. Temporary OCP reader/source/build directories remain absent. The candidate is qualified locally; final remote acceptance is the required-CI result and merge/ancestry receipt in the PR and owner handoff prompt. Verify those live instead of treating a pre-merge commit as a self-referential final merge receipt.

Read [qualification.json](qualification.json) for exact commands, results, actual receipt and publication evidence. The final PR and remote ancestry must be verified before announcing completion. Required CI covers its reported lint/types/build checks; it does not imply local runtime suites or WebGPU browser qualification.

The first required CI on `5899e6304694cc10dc905cc8306f5daa291ea29b`, [run41457311423](https://github.com/barocss/barocss/actions/runs/41457311423), passes repository types, root/additional app lint, libraries, apps and documentation builds. Its documentation check fails IV001 because the retained public inventory still says Float32Array where current source also supports Float64Array. This failure is preserved; regenerate the inventory from current source rather than weakening the checker or narrowing the product. [Loader run41457311477](https://github.com/barocss/barocss/actions/runs/41457311477) passes. The regenerated canonical inventory changes exactly10 type strings: lines/positions on four existing MeshData exposures and edgeLines/positions on DisplayMesh. No exports, structure, checker, policy or runtime code changes. Local check:docs PASS (73pages/55shots/940labels); inventory drift fixtures84/84 PASS. The initial narrow optional-field guard stopped before a worktree write and was corrected after reviewing non-optional coordinate types. The same generated candidate was adopted. The corrected final [PR #2281](https://github.com/barocss/barocss/pull/2281) head must pass required CI before merge; native/runtime proofs are reused because product source remains identical.

Next feature: C1-1 ordinary part workflow evidence audit, expected decision D447. Reuse D349/D377/D380 first. Legacy43% remains frozen; core readiness is NOT_MEASURED. General exchange/robustness and research issues retain open scope, so this integration alone closes none. Existing fitter/public-thicken, manufacturing, new CAD Motion/Physics, schema, browser CI, download and release gates remain.
