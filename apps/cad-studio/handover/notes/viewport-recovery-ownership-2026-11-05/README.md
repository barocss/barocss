---
work_id: D525
artifact_type: bounded-recovery-feedback
status: done
owner_role: executor
last_updated: 2026-11-05
---

# D525 — Report GPU recovery under its current viewport owner

Priority P0-R05, rows06/20/32. Parent `facb5e88ac710c73cf75440661ff716f6f8deae7`. [Roadmap](../../roadmap.md) · [Qualification](qualification.json).

## Original runtime and candidate eligibility

Root original desktop Studio creates an unsaved64×32×8 Box, changes camera and selects the actual body. The existing Viewer test method destroys only its owned real GPUDevice. Native lost(reason=destroyed), Viewer restart and actual onRecover produce a new ready device, but no Studio recovery notice. Doc, dirty state, camera, selection and public Undo/Redo pass. Root views baseline03 PNG. Baseline runner PASS means the new feedback acceptance is FAIL; it is not evidence of lost work. Original helper-controlled tests are NOT_RUN because no helper existed. An absent import would not be runtime reproduction.

The preserved D517 candidate is selectively reused from /tmp/barocss-d517-recovery-candidate01, manifest/patch pinned in qualification.json. Its early-installation and notice-ownership gaps are corrected before adoption. The original raw candidate stays untouched. Its old gpuRenderer.ts is never copied over D524; full mesh-cache ownership remains present. This record supersedes the current candidate-only R05 boundary without rewriting historical D517 evidence.

## Current-owner recovery and notice semantics

A private observer exists before createViewer awaits. It buffers generic diagnostics while retaining the original console diagnostic. On attachment it reconciles actual ready/recovery state and existing stats.deviceLosses, including completed pre-attach recovery. Generic diagnostics with a ready/no-loss source do not become a recovery failure. It retains the remembered current device while the real public computeDevice getter returns null during recovery.

Restored requires the same current source/device/generation after a rendered frame and successful device-queue completion. Source attachment, device/work generation, disposal and abandoned startup suppress old callbacks. A failed GPU creation disposes its observer/available Viewer before fallback. Existing Viewer device recreation and retained geometry remain the owners; no GPU library API, schema, B-rep or tolerance changes.

Viewport attachment predicates travel with private notices and are checked again when React applies the functional updater. The updater is idempotent under replay, fills an empty slot or replaces an admitted recovery notice, and preserves unrelated error/Undo notice identity and action. There is no global toast framework, automatic reload or document write. New fallback/startup/lifecycle ownership cases are controlled; no broad initial-attach GUI campaign is implied.

## Verification

Tier FEATURE. Implementation/tests and one independent source review use GPT-6.1 Sol Medium; review APPROVED, no blocking finding. Root owns all heavy checks and actual Studio.

PASS:24 new recovery/ownership cases plus57 related renderer/shadow/map cases,81 total/0 FAIL/0 cancelled/0 skipped; Studio types; final Model types after the last test edit; browser/observer syntax and diff. Cases include startup pending/terminal/completed loss, diagnostic-only negative, real computeDevice-null behavior, frame/queue gating and rejection, repeated loss, source replacement, disposal/abandoned startup, host replay, unrelated error/Undo action preservation, updater replay and queued attachment ownership.

Root fixed success flow uses the original public/native prefix. DOM mutation records Restoring viewport then Viewport restored; Doc/dirty/camera/body selection and public Undo/Redo remain. Recovery is fast: fixed02 PNG already shows restored, so progress is timeline evidence rather than a claimed progress screenshot. A second deliberate loss holds the return of an actually acquired native replacement device. Public invalid .bcad Open supplies a newer ordinary error. After releasing the same device and completing its real frame/queue, that error remains and no completion toast replaces it. Root views fixed02/03/09.

Root separately runs terminal failure: destroy the owned actual device, inject exactly one replacement requestDevice rejection with a declared sentinel, then observe actual onRecoverError and Viewport unavailable with Save/reload guidance. The Doc and dirty state remain through failure. Public Save produces the exact accepted Doc and may legitimately mark it clean. Root views terminal02/03. The existing native console diagnostic is preserved as exactly1 expectedConsoleErrors entry; unexpected console/page errors are zero. This is deliberately injected acquisition failure, not an organic host failure rate or fake recovery callback.

All three runs keep source capsules unchanged through cleanup:291 original paths,292 in each fixed flow because the private helper is added. Four existing runtime producers change (App, Viewport, GPU renderer, private renderer interface), plus the new helper; the driver/observer add fixed-only cases after the original prefix. Worktree writes are zero during every run. Context, Chrome and Vite close. One terminal local .bcad artifact download is expected; no network dependency or paid live run occurs.

FAIL retained: original feedback contract has no Studio notice despite actual successful device replacement. No controlled import failure is fabricated, and no tool failure occurs in these three actual runs. The terminal injected rejection and its expected diagnostic are a passing refusal/retention case, separate from unexpected errors.

NOT_RUN: actual startup/fallback/disposal/renderer-replacement GUI, organic hardware failure, actual Undo-action toast (controlled only; plain public Undo/Redo is actual), GPU memory readback, fresh numerical oracle, whole-kernel/production build, CI, mobile, release and develop integration. The current-viewer observer temporarily wraps callback getter identity and restores it before context close; it does not prove GUI disposal ownership. Whole CAD/core stays NOT_MEASURED; #541 broader acceptance remains open. Next MAIN D526/P0-R06 is the Model public density guard under FULL checks.

## Commands and custody

From apps/cad-studio with Node22.19.0. Every heavy execution is serial under gate.sh acquire heavy60 and released on exit; every writer freezes for actual Studio. Each output directory is new and outside Git.

```sh
TEST_CONCURRENCY=1 node scripts/test.mjs viewport-recovery mesh-reuse-ownership instance-pose selection-edge render-shadow-consumer analysis-maps
pnpm --filter @barocss/cad-studio-app run type-check
pnpm --filter @barocss/cad-model run type-check
node --check test/viewport-recovery-current-studio-browser.mjs
node --check test/native-device-recovery-observer.mjs
D525_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node test/viewport-recovery-current-studio-browser.mjs /tmp/barocss-d525-studio-repro01 --expect=repro
D525_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node test/viewport-recovery-current-studio-browser.mjs /tmp/barocss-d525-studio-fixed01 --expect=fixed
D525_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node test/viewport-recovery-current-studio-browser.mjs /tmp/barocss-d525-studio-terminal01 --expect=fixed --case=terminal
git diff --check
```

qualification.json pins raw logs, receipts, reviewed screenshots, saved Doc and retained candidate hashes. Raw evidence remains external. Source custody and screenshots do not establish geometry accuracy.
