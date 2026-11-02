---
work_id: D445
artifact_type: claude-handoff
status: ready_for_build
owner_role: executor
source_request: "Prepare a Claude handoff prompt after all current work is pushed into develop"
last_updated: 2026-11-02
---

# Claude handoff — core CAD continuation

Read this document completely, then the [current roadmap](../../roadmap.md), [D445 priority decision](../core-cad-priority-2026-11-02/README.md), and the [previous handoff §5 operating rules](../codex-handoff-2026-11-01/README.md). This handoff and the latest owner directions supersede the previous execution order. Preserve its operating rules and explicit HOLDs. Current status stays only in roadmap.md; this document is a starting procedure.

## Checkout and integration

Only use `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, branch `local/cad-dev`. Do not edit the main checkout or other worktrees. Set `export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH`; verify Node v22.19.0. Run `git fetch origin develop local/cad-dev`, inspect status and compare HEAD with both remote refs. Preserve unexpected WIP and investigate any difference; do not reset, rebase or overwrite it. Git author and committer must be `easylogic <cyberuls@gmail.com>` before each commit.

Product baseline before this docs update is `087369e8a01095585db90d2473e5b9c280a4ec56` (D444). Do not check out that old commit to resume. The owner explicitly authorized all completed CAD work to be integrated with the changed develop branch. D446 will record the integration and current qualified merge candidate. Read that record and verify remote refs before starting a feature. Earlier D420 merged through D419 in PR #2274. Integration approval does not authorize release, npm publishing or deployment.

## Next CAD item

Start **C1-1 reliable everyday part workflow** after D446 integration; expected next decision is **D447**, but check decisions.md first. Audit the ordinary bracket/bearing-support loop in D445: sketch constraints/dimensions → extrude/revolve → combine/hole/fillet → upstream width edit and reference retention → quantities/Undo/Redo/refusal retention → local-project Save/fresh Open/re-edit. Inventory source and retained D349/D377/D380 proofs first; run uncovered or affected steps only. D378 is GPU integration, not a Save proof. Do not rebuild already delivered basic tools. Fix the first reproducible blocker as one item, use the required validation tier, leave one decision and actual Studio proof, then push normally.

Core workflow readiness is **NOT_MEASURED**. The old 43% is a frozen equal-row estimate at D444, not core-CAD completeness. When starting an item, tell the owner its C-priority, original row IDs, concrete task and honestly bounded progress. UI redesign and nonzero-cone expansion are deferred. The abandoned nonzero-cone D445 proposal was source-only: no product changes, build, actual run, process or gate lease remains from it. Published D445 is this roadmap/handoff decision.

## Retained proof and unresolved scope

D444 qualifies only exact parsed-zero direct conical frustums, unchanged native output and atomic refusal of nonzero underflow. Its recorded CAD161 + Model12 tests, independent25 cases +8 semantic mutants and actual three-state flow remain bounded. Importer SHA256 `3b93a1c9ebaf951f16033aed146a77a3a64abad9baf4c6adcc1e6f6f1cb2eccf`; emitted importer `3defca5eace8d3e842c6b40439c2e7aef4605babbfed95347640803bf9e3e085`. Read the canonical [D444 record](../step-cone-zero-offset-2026-11-02/README.md) rather than treating hashes as geometric truth. D433 remains the latest full-kernel checkpoint (2066 PASS, 0 FAIL, 2 existing SKIP). No C1-1 complete run is claimed here.

D434 qualifies six declared relative GPU frame/pick/line/grid profiles, not universal precision. D440's current single original fuzz case passes; D423's historical denominator cause remains UNKNOWN. Preserve original failures and refusal limits. Temporary OCP reader/source/build environments were removed; no new download or install is authorized.

Keep #2258 fitter/public-thicken, #2266 widening, manufacturing P2/PG11, new CAD Physics/Motion, browser CI local-only and schema3/4-only boundaries. Retain research/epic issues open; close an issue only after every acceptance criterion is evidenced. Existing develop Physics history must be preserved; integration is not a new Physics task.

## Operating checklist

Use short Korean owner replies and English code, commits, decisions and issues. Report PASS, FAIL and NOT_RUN separately. No stash, amend, rebase, reset or force push. Add named paths only; never commit .claude/, raw logs/screenshots/archives or large evidence. New dependencies/downloads and paid live runs need explicit owner permission each time. No new runtime dependency/WASM in CAD/Model/GPU; no unit suffix identifiers or new closures in hot/per-element loops.

Heavy runs use `/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh`, one at a time, load below40, sole own holder confirmed. Freeze every worktree writer during actual Studio, including builds and checkout, until cleanup/source-equality checks finish. Only terminate PIDs you started. Use the existing Studio flow-helper, PW_DIR `/Users/user/.cache/barocss-playwright/node_modules/playwright`, CHROME `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, and chat port52391. Do not relink node_modules to another tree.

Follow small/feature/full validation tiers; full kernel only after B-rep core changes. Final Model tsc follows the last test edit. Reuse valid exact-scope receipts; do not repeat passing baselines without a change or unresolved concern. General implementation/tests use GPT-6.1 Sol Medium; difficult Boolean/B-rep/tolerance/geometry work goes to GPT-6.1 Sol High. Record models actually used.
