---
work_id: D528
artifact_type: bounded-react-worker-recovery
status: done
owner_role: executor
last_updated: 2026-11-05
---

# D528 — Report settled Worker failure and retry the current declaration

Priority P0-R08, C5/row16. Parent `18776c7ff912c97c3d952fde8aeed76b0eb46fb5`. [Roadmap](../../roadmap.md) · [Qualification](qualification.json).

## Failure and correction

After a successful frame, EnginePort.onFailure retired the adapter ticket and set its phase to failed. Without a pending submit promise, ModelHost's local error stayed null. read() therefore reported pending, with no current native result, while Inspector remained Updating over the stale previous frame. Original controlled Host checks have4 PASS/3 FAIL and original DOM checks0 PASS/7 FAIL. Three later controls were added before the fixed run; the original14 and final17 are different matrices.

ModelHost.read now includes the current adapter failure, retaining compiler-local error precedence. Error and existing FriendlyError title/hint/detail remain readable, including an empty Error message. No engine restart or submission occurs merely from reading the failure.

The private App/ProfileApp examples accept an optional caller-owned onRestart callback. Only a successful callback refreshes the existing Part checkpoint. It preserves host, Viewer, current props and IDs; it does not key-remount the App or reset parameters. A refused/thrown restart reports its message inside Inspector, so failure feedback cannot accidentally rerender Part and resubmit. Inspector retires that local message on host/status/error change. A Viewer startup failure has no connected host and exposes no Worker Retry. Reset still changes only the example parameter. EnginePort and borrowed-engine ownership are unchanged; R09 observation ownership remains separate.

## Verification

Tier FEATURE. Implementation/test author and independent source reviewer use GPT-6.1 Sol Medium. Final independent review APPROVED. Root executes all checks and both actual runs; other writers freeze during browser execution.

PASS:8 new controlled Host cases and9 real ReactDOM/jsdom example cases,17 total. They cover settled/inflight failure, late result/disposal suppression, readable refusal/rejection/empty Error, compiler precedence, default and nondefault parameters in both examples, same Part/IDs/host/sink on success, false/throw without submission, absent callback, startup without a host, and retirement of older retry feedback after a later caller repair. Viewer and EnginePort are controlled in these DOM checks. Another22 related Host/adapter/React/Viewer-sink tests pass; controlled total39,0 FAIL/0 skipped/cancelled. Documentation samples185 PASS separately. React/consumer/Studio/final Model types, explicit example types, lint, browser-driver syntax and diff pass.

Root actual baseline repro05 uses a production bundle of the exact ProfileApp, EngineClient, module Worker and existing @barocss/viewer. Radius6 then8 reaches Ready. One deliberately malformed wire request to the owned real Worker raises native onerror, then actual EngineClient.onFailure. No ErrorEvent, callback, result or status is fabricated. The old visible frame remains stale; host.native is null, adapter.failed is true, requests stay2, and Inspector remains Updating. The harness PASS records this PRODUCT FAIL.

Root actual fixed01 repeats the same native fault: Inspector shows Error with the actual readable message and real Retry control. Clicking it calls the caller's EngineClient.restart once, creates a new Worker and submits request3 from unchanged radius8/Doc. Existing Viewer reaches Ready with the same bounded pixel digest. The returned current Doc is written externally, then fresh public Studio Open and Frame retain exact Doc and one settled body. This is an Open consumer smoke, not native Save/export or an independent physical oracle. Root views original failure03, recovered04 and Studio06 PNGs.

Both qualified runs pin1231 source paths, unchanged through cleanup. Fixed run has6 states/2 contexts; baseline has3 states/1 context. Unknown page/console errors, source changes and downloads are zero. All owned contexts, Chrome, static HTTP and Studio Vite close. Raw images, logs, bundles and document fixtures remain external.

FAIL retained: original10 controlled assertions; initial repro01–03 had only development WebSocket/console infrastructure noise after reaching the product failure. Repro04 failed custody because a late driver filename edit followed its ready/freeze report. Its product source stayed unchanged, but the run is not qualified. Repro05 freezes the final driver and passes. Removing HMR by actual production bundling does not stub a client or filter unknown errors. An extra external example-tsconfig attempt missed the existing Node type root and produced11 configuration errors; explicit existing typeRoots repairs the check without installation. Earlier failures remain separate from the passing final checks.

NOT_RUN: organic Worker fault incidence, native browser false/throw/startup/disposal GUI races (controlled only), packed/published consumer, whole Studio production build, numerical/geometry certificate, general CAD React breadth, whole kernel, CI/mobile, release or develop integration. Whole CAD/core remains NOT_MEASURED. R01–R08 now have bounded closeouts; R04 native collision stays UNKNOWN. Next MAIN D529/P0-R09 establishes the owned observation boundary without cloning immutable owner identities or unknown custom sink values.

## Commands

Node22.19.0. All heavy commands run serially under gate.sh acquire heavy60 and release on exit. Use a fresh external browser output and freeze every worktree writer.

```sh
node --test --test-concurrency=1 packages/barocss-cad-react/tests/settled-worker-failure.test.mjs packages/barocss-cad-react/tests/example-retry.test.mjs
node --test --test-concurrency=1 packages/barocss-cad-react/tests/model-host.test.mjs packages/barocss-cad-react/tests/polygon-model-host.test.mjs packages/barocss-cad-react/tests/pieces-observation.test.mjs packages/barocss-cad-react/tests/adapter.test.mjs packages/barocss-cad-react/tests/react-host.test.mjs packages/barocss-cad-react/tests/viewer-sink.test.mjs
pnpm --filter @barocss/cad-react run type-check
pnpm --filter @barocss/cad-react run test:types
pnpm --filter @barocss/cad-react run lint
node apps/library-docs/samples/run.mjs
pnpm --filter @barocss/cad-studio-app run type-check
pnpm --filter @barocss/cad-model run type-check
# Explicit example check extends the existing React tsconfig, includes examples/**/*.ts(x),
# and points typeRoots to the existing worktree node_modules/@types; no dependency download.
node node_modules/typescript/bin/tsc --noEmit -p /tmp/barocss-d528-fixed-checks01/examples-tsconfig.json
node --check packages/barocss-cad-react/tests/engine-failure-current-browser.mjs
node --check packages/barocss-cad-react/tests/native-worker-failure-observer.mjs
D528_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node packages/barocss-cad-react/tests/engine-failure-current-browser.mjs /tmp/barocss-d528-worker-repro05 --expect=repro
D528_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node packages/barocss-cad-react/tests/engine-failure-current-browser.mjs /tmp/barocss-d528-worker-fixed01 --expect=fixed
git diff --check
```

Repro mode describes the original parent product; it is not expected to pass against the fixed source. All39 controlled checks and185 docs checks pass at the candidate. qualification.json pins product/drivers and external evidence. Hashes establish custody, not correctness. #541 remains open because this bounded recovery proof does not complete its nine required features.
