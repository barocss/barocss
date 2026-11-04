---
work_id: D521
artifact_type: bounded-defect-fix
status: done
owner_role: executor
source_request: "Continue the revised roadmap without stopping; P0-R01 version completion ownership"
last_updated: 2026-11-05
---

# D521 — Keep delayed version work with its original project document

Priority P0-R01, rows12/16. Parent `bb40861ac364e06eb68d8031843c3ff31e057327`. [Current roadmap](../../roadmap.md) · [Qualification](qualification.json).

## Original failure

Root reproduced the source-audited defect before changing product code. A controlled hook/storage run has17 failing stale-completion cases and2 passing current-owner controls. In actual desktop Studio, public UI creates A (10×10×10) and B (12×13×14), saves their separate native project/version files, then switches A to A-other while only the real native close return is held after the log commits. Public Open B settles before release.

Releasing A replaces B's Doc, visible history, version list and branch with A: B-version/main/clean becomes A-version/A-other/dirty, while file name and active path remain B/B.bcad. Root viewed both original PNGs. Native B bytes are unchanged at this point, but a subsequent Save could overwrite B with A. The baseline runner PASS means the defect was observed; product safety was FAIL. Original receipts are preserved.

## Correction and precise semantics

The private useProject hook captures request, session, store, path and App document scope before asynchronous version work. Log/tag publication, conflict reload and error feedback require the same project owner. Branch switch/merge additionally require the same App scope before returning a replacement Doc to VersionsPanel. makeVersion captures ownership before its preliminary Save and cannot borrow a later Open or edit to create a log.

An already completed native A write is not cancelled or rolled back. A same-path document edit may retain its legitimately persisted log/tag/current branch, but cannot receive the older replacement Doc. The controlled tests verify the subsequent edited version's branch and snapshot, not only a successful tag. Conflict-reload rejection is handled inside the hook, including the fire-and-forget chat.back path. App, VersionsPanel, storage codec, public API, schema, geometry and tolerances are unchanged.

## Verification

Tier SMALL; implementation and test authoring used GPT-6.1 Sol Medium. Root ran all commands and both actual Studio executions. No independent audit is required for this private bounded repair.

PASS:29 final new ownership tests;57 related existing tests retained from current-source runs,86 unique controlled tests total; Studio types, final Model types after the last test edit, browser-driver syntax and diff. The affected matrix covers five version-write consumers across Open B/close/detach; intervening edits; preliminary Save ownership; current and stale storage-conflict reload; permission/reload failures; current successful switch/merge and usable subsequent version tags/snapshots.

Root reran the same unchanged real-OPFS branch-to-B driver with fixed expectations. B's actual Doc, versions, branch, history, dirty state, name and active file stay equal through A's old completion. A subsequent public Save B succeeds and preserves native B/version bytes. Root viewed fixed06/fixed07 PNGs. Each execution retains1420 outer source hashes and292 helper hashes unchanged through cleanup. The only runtime-producer delta from the original run is useProject.ts. Page errors, console errors, worktree changes and downloads are zero. Context, Chrome and Vite server close.

FAIL retained: initial controlled harness cancellation (9 product assertions failed,10 cancelled), then17 actual stale assertions on corrected baseline; a new conflict-reload test originally paused the earlier metadata read; a root test command used the wrong cwd for an existing fixture; and the new positive merge test initially lacked TypeScript conflict narrowing. These tool/test corrections do not hide the original product failure. Final changed/failed checks pass; unchanged successful files are not rerun merely to increase counts.

NOT_RUN: separate actual GUI merge/close/detach/intervening-edit cases, whole-kernel/production build, new numerical oracle, full-fit/raster certification, mobile, CI, release and develop integration. This repairs the declared version-completion boundary, not every file/recovery/concurrent-version policy. #530 remains open: its8 broad document requirements are not all satisfied; automatic-save/recovery visibility is next P0-R02/D522.

## Commands and external evidence

Run controlled tests from apps/cad-studio when they consume cwd-relative fixtures. Every heavy command below was serial under `gate.sh acquire heavy 60 <label>` with release on exit and Node22.19.0. All writers were frozen for actual Studio. The selected packages remain installed; no download, external service or paid live run occurs.

```sh
# Original product, corrected baseline controls (root cwd)
TEST_CONCURRENCY=1 node apps/cad-studio/scripts/test.mjs project-version-ownership
# Final changed file (apps/cad-studio cwd); related storage file ran in checks02
TEST_CONCURRENCY=1 node scripts/test.mjs project-version-ownership
TEST_CONCURRENCY=1 node scripts/test.mjs project-version-ownership storage.test
pnpm --filter @barocss/cad-studio-app run type-check
pnpm --filter @barocss/cad-model run type-check
node --check test/project-version-ownership-browser.mjs
# Actual Studio (root cwd); each output must be unused and outside Git
D521_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node apps/cad-studio/test/project-version-ownership-browser.mjs /tmp/barocss-d521-studio-repro01 --case=branch-to-B --expect=repro
D521_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node apps/cad-studio/test/project-version-ownership-browser.mjs /tmp/barocss-d521-studio-fixed01 --case=branch-to-B --expect=fixed
git diff --check
```

Exact logs/receipts and SHA256 pins are in qualification.json. Raw screenshots/logs/native files stay outside Git. Hashes establish source/evidence custody, not a physical geometry oracle. The native close scheduler changes timing only and does not call product actions or replace storage results. Actual UI reads use the existing read-only Dev observations. Whole CAD/core readiness stays NOT_MEASURED; one R01 closeout does not turn the twelve-item reliability backlog into a CAD percentage.
