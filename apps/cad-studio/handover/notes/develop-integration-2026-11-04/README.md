---
work_id: D516
artifact_type: develop-integration
status: done
last_updated: 2026-11-04
---

# D516 — Merge the new develop into the active CAD branch

The owner explicitly requested this integration. Develop `0a838f9543a29a864df5917ac2bb877540c8aa73` is merged into `local/cad-dev` by normal merge `4d733c0f622dadf0b8d84d4395b696779e9b1e84`. The 33 unfinished D509 paths were first preserved in checkpoint `04f1f8b710beac437f5c4c0c4c8d0b00ce007963`, with two explicit PARTIAL checkpoint notes. This is not D509 feature completion.

The incoming delta has 3445 paths. Only the documentation sidebar overlaps the unfinished work. The automatic merge retains the Physics Host integration topic and all six new React component links. Independent Sol Medium source review verifies the exact two-parent tree union. All other 34 checkpoint paths retain their bytes. No CAD, Model, GPU, Viewer or CAD React product source is changed by the develop delta. All 467 recorded native producer inputs remain exact; its 465 workspace inputs have zero incoming changed-path intersection. Source intersection is not a new physical certificate.

Fresh verification passes **24 drag-wall tests and seven sidebar tests**, Studio types, Studio Vite build, final Model types and diff. Nineteen earlier D513/D514 tests are reused at exact current source closure: 1633 old pins plus renderer/test hashes were verified. Preserve the raw checks report's inaccurate descriptive 1684 label; it never controlled eligibility. The numeric map and root review record 1633.

Root ran one actual desktop Studio flow on the merged source, shared with D515's current cadence measurement. The existing 51-node/48-hole part reaches whole preview Worker times above120ms, shows rolled previews during the drag and restores the exact original document after Escape. No Apply or Save. All 1614 outer source inputs and 290 helper inputs remain exact through cleanup and two root-reviewed PNGs. Context, Chrome and Vite server close, with zero page/console errors, source changes or downloads. See [D515](../slow-drag-cadence-current-2026-11-04/README.md) for the separate numerical interpretation; this is one shared execution, not two runtime proofs.

## Commands and evidence

```sh
git merge --no-ff --no-commit 0a838f9543a29a864df5917ac2bb877540c8aa73
git commit -m "Merge origin/develop into local/cad-dev"
zsh /tmp/barocss-d516-integration-root01/run-checks01.sh
zsh /tmp/barocss-d516-integration-root01/run-studio01.sh
```

- checks: `/tmp/barocss-d516-integration-checks01/receipt.json`, SHA256 `1c6f4e27e31d2621d4d40e40d4c5fb017d4b61a1da0025d5473add55279f046c`.
- Studio: `/tmp/barocss-d516-d515-studio-run01/receipt.json`, SHA256 `9e14f7a3906994ae158fbc5a08e632f3504345fcf36042176cd3711febdc7ef9`.
- rootReview: `/tmp/barocss-d516-integration-root01/root-actual-review.json`, SHA256 `31ffb06a300e3859f937cae4b03064f97a2e96907289e554deb0b0f2e99e8406`.
- independentSourceReview: `/tmp/barocss-d516-feature-integration-review01/review.json`, SHA256 `d2ca5faa4fa21a218d5831fb5264ff2339658d189309053dfa13bdf0235b15bd`.
- nativeSourceIntersection: `/tmp/barocss-d509-integration-checkpoint01/native467-develop-intersection.json`, SHA256 `0bb15e4bfde0ef6b19631d13898ac3aa75a33838cba5455a59cd4d9334a0db10`.
- initialInventory: `/tmp/barocss-d516-integration-root01/inventory.json`, SHA256 `f88b892ee20aa0e520f0a9f7460237c63b69433435e442ca281e9ec09c88c1f5`.


Tier FEATURE: independent source audit plus actual Studio. General preparation used GPT-6.1 Sol Medium; root executed Studio and reviewed original images. Physics runtime certification, full CAD kernel, mobile, release, deployment and npm are NOT_RUN. Core completion stays NOT_MEASURED and existing HOLDs remain. CAD React reconciliation, all30 documentation fence types, docs/build and 26-route preview remain separate unfinished D509 work. No raw evidence is committed.
