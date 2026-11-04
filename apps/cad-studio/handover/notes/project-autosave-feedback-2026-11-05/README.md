---
work_id: D522
artifact_type: bounded-failure-feedback
status: done
owner_role: executor
last_updated: 2026-11-05
---

# D522 — Report current project recovery failures

Priority P0-R02, row12. Parent `b4f03462fc3f3fb461af47007476de520560d70b`. [Current roadmap](../../roadmap.md) · [Qualification](qualification.json).

## Original failure and correction

The original controlled baseline has7 PASS and5 FAIL across12 cases. Current permission/quota failures produce no warning; malformed recovery is ignored, and a recovery-only permission error makes an otherwise accepted project Open report failure. Root also reproduced silent autosave failure in actual desktop Studio: create and Save A through public UI into a fresh native browser project, make a genuine automatic recovery copy, edit Grid, and inject NotAllowedError at the actual native writable.write boundary. The real adapter aborts. No warning appears, dirty remains true, and prior recovery/saved bytes remain intact. The baseline runner PASS means the product defect was reproduced.

The private useProject hook now reports the actual normalized storage reason through the existing error callback. One warning is kept per current project/path outage across edits; an accepted successful autosave resets it. A new Open owns new warning state. Each failure must still belong to its original request, project session, store, path and App document scope; stale failures cannot consume the current warning. Ordered settlement prevents an older receipt from superseding a newer settled result. Native same-path serialization is retained; this is no new arbitrary-concurrency guarantee.

Unreadable or malformed recovery is reported without applying it or classifying the valid project file as unopened. The accepted file remains, and existing linked checks and Open-ready handling continue. Corrupt bytes are retained. App, storage/schema, codecs, public API, geometry and tolerances are unchanged. No saved callback or dirty/history change is added. The warning says the latest recovery copy could not be confirmed: a rejected postcommit tag lookup can occur after native bytes already committed, so rejection alone is not proof that nothing was written.

## Verification and limits

Tier FEATURE. Implementation and test authoring use GPT-6.1 Sol Medium. One independent Sol Medium source review is APPROVED, with no blocking finding. Root runs all heavy checks and actual Studio.

PASS:13 new controlled tests plus86 affected existing tests,99 total/0 FAIL/0 cancelled/0 skipped; Studio types; final Model types after the last test edit; browser/scheduler syntax; diff. Cases cover permission/quota outage, previous-byte retention, repeat suppression, success/reset, same-path fresh Open, stale edit/Open B/folder/close/detach errors, valid recovery offers, malformed/permission recovery Open and stale recovery reads.

Root reruns the same repaired browser driver with fixed expectations. The first native abort shows one warning; dismissal and another failure show none; a later real native commit stores the current Doc; the next outage shows a new warning. Dirty remains true throughout automatic saving and failures. Prior valid recovery and explicit Save bytes survive each injected aborted write. Root views original baseline02 and fixed02/03/05 PNGs. Both qualified executions retain290 Studio/helper source paths through cleanup; the only producer delta is useProject.ts. Page/console errors, worktree changes and downloads are zero. Context, Chrome and Vite close.

FAIL retained: first browser attempt omitted the public Scene tab; second used an active-path selector hidden by Render. Both receipts remain external. The latter already captured the real failure, but is not counted as a passing flow. The final driver reports that hidden path as NOT_OBSERVABLE_IN_RENDER and checks current file name plus actual owned native paths. It does not cache an old path as a current observation.

NOT_RUN: separate actual stale-error or corrupt/permission recovery Open GUI flows; a dedicated linked-part recovery-error test (continuation source-reviewed); actual host permission/quota exhaustion; global toast-priority semantics; numerical geometry oracle; full kernel, production build, CI, mobile, release and develop integration. This is injected-error product-flow proof, not a host quota certificate. Whole CAD/core remains NOT_MEASURED. #530 has broader unmet document requirements and stays open. Next MAIN is D523/P0-R03 current-assembly 3MF export.

## Commands and custody

Run storage tests from apps/cad-studio. Node22.19.0; each heavy execution is serial under gate.sh acquire heavy60 with release on exit. All worktree writers are frozen throughout actual Studio. No dependency download or paid live service occurs.

```sh
node scripts/test.mjs project-autosave-feedback
TEST_CONCURRENCY=1 node scripts/test.mjs project-autosave-feedback project-version-ownership project-open-ownership late-save-ownership storage
pnpm --filter @barocss/cad-studio-app run type-check
pnpm --filter @barocss/cad-model run type-check
node --check test/project-autosave-feedback-browser.mjs
node --check test/autosave-native-failure-scheduler.mjs
D522_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node test/project-autosave-feedback-browser.mjs /tmp/barocss-d522-studio-repro03 --expect=repro
D522_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node test/project-autosave-feedback-browser.mjs /tmp/barocss-d522-studio-fixed01 --expect=fixed
git diff --check
```

Use a new external output directory for every attempt. qualification.json pins raw receipts/logs and reviewed screenshots by SHA256; raw files stay outside Git. Hashes establish custody, not geometry accuracy.
