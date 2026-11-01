---
work_id: D420
artifact_type: develop-integration-qualification
status: done
owner_role: executor
source_request: "Merge all completed CAD work into develop, then continue the roadmap"
last_updated: 2026-11-01
---

# Develop integration through D419

The owner explicitly authorized this integration on 2026-11-01. [PR #2274](https://github.com/barocss/barocss/pull/2274) merged as `12411c89b9a0f9de7e5066a5ea8f3d292c9476a8`. It includes all 214 commits outstanding at the request, plus one integration lint repair. The local `local/cad-dev` worktree was synchronized by fast-forward and pushed. Other worktrees were not checked out or edited. GitHub automatically deleted the head branch after merge; an ordinary push restored it at the merged commit for continued work.

The final develop tree is `de1815d6a8272f0351a9d72e090436ad487374e7`, exactly the tree of checked candidate `cdc6c9878cd2067caaf097544070e971f824aa53`. Both the requested D419 snapshot and the repaired candidate are ancestors of develop. [Qualification](qualification.json) records commands, CI IDs and limits.

The first required CI passed repository types and root lint, then failed the broader app lint step on six errors in five browser drivers. Sol Medium removed only unused imports/bindings and a redundant escape. Decoded strings, assertion ASTs and timers remain identical; the awaited pattern check remains in place. Scoped lint is zero errors/warnings and Node syntax is 5/5 PASS. The first CI failure and its 214 existing warnings are preserved; no lint policy was weakened.

Exact-head [Test and Build](https://github.com/barocss/barocss/actions/runs/41297098274) and [Loader CPU/types](https://github.com/barocss/barocss/actions/runs/41297098129) pass. This covers repository types, lint, extra app lint, library/app/docs builds and documentation checks. It does not run package/runtime suites or a real WebGPU browser. No workflow was changed and local-only browser policy remains.

Product/runtime files and the eight D419 critical hashes are unchanged. The scoped D419 actual proof is reused, not rerun or relabelled as new execution. Its three states and 751-file before/after/cleanup equality retain their recorded scope, including the separately verified report-only oracle key update. This integration adds no new product acceptance.

The aggregate intentionally includes D360's legacy object/createCadModel/cad API retirement, additive drawing options and D417's owned mesh-header/knot restriction. It is not a blanket API compatibility or release claim. Historical code/evidence is preserved; new raw logs and inventories remain outside git. Manufacturing, Motion/Physics, download and release gates remain. The develop-merge approval is consumed for this completed batch; later feature integration remains owner-directed.

The active product lane remains row 13 with rows 12/16/30 alongside it. The next bounded item is D421: report applicable STEP header/product-name character replacement without changing the serializer, download basename or geometry. General STEP hierarchy/presentation/PMI/UCS and research issues remain open.
