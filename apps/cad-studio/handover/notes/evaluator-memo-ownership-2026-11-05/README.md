---
work_id: D527
artifact_type: bounded-evaluator-cache-fix
status: done
owner_role: executor
last_updated: 2026-11-05
---

# D527 — Keep evaluation results with their evaluator

Priority P0-R07, rows12/16. Parent `2f5724eeaad9bed034e9698df25599244f42f3cb`. [Roadmap](../../roadmap.md) · [Qualification](qualification.json).

## Original ownership failure

The module-global kept Map used only the document evaluationKey. Although rememberedEvaluate already created per-callback wrappers, two distinct evaluators shared pending and completed results, and one callback's LRU traffic could evict another's success. Original13-case baseline has7 PASS/6 FAIL: distinct callback success/pending, three late refused/null/rejected-versus-other-success cases and cross-callback LRU. Every case has unique document content except its intended A/B comparison; no private reset hook or unsettled test job hides the failure.

The private correction allocates kept once per new rememberedEvaluate wrapper and passes it to the existing evaluation/eviction helpers. Content keys, KEEP16, LRU refresh, exact-promise failure eviction, WeakMap wrapper ownership and wrapper idempotence remain. Same-callback equivalent documents still reuse pending/success results; distinct callbacks compute their own. No API shape, geometry, tolerance, schema, source/provenance or evaluator-equivalence policy is added.

Capacity is now16 per live callback, rather than16 globally. New arrow identities no longer obtain unsafe shared hits. The existing WeakMap owns wrapper/cache lifetime. This is an ownership correction, not a memory or latency improvement claim; total live retention and hit rates may differ.

## Verification and consumer boundary

Tier SMALL; implementation/tests GPT-6.1 Sol Medium. No independent audit is required for the private repair. Prior source preflight and root's final inspection are separate from execution.

PASS:13 new ownership cases plus59 related Model memo/reference/transaction/script/rebase/context tests and9 Studio document-file tests,81 total/0 FAIL/0 cancelled/0 skipped. Positive controls retain same-callback content/pending reuse, wrapper idempotence, refused/null/rejected eviction,16-entry LRU refresh and older pending failure versus same-key replacement. Studio types, final Model types after the last test edit, existing browser-driver syntax and diff pass.

Root runs the existing reference-open-browser.mjs unchanged in full mode, with REFERENCE_OPEN_HINT_ONLY unset. Its historical receipt qualification label remains D399_REFERENCE_OPEN; the new current-source run and custody are pinned here. Actual public valid signed-band Open retains3 bodies. Lost/renamed/moved references hold the feature, retain2 bodies and original source edge names, and expose References guidance. Each accepted held Doc is written externally as a fixture and Opens again in a fresh context. Unrelated zeroheight remains an ordinary refusal rather than being silently held. All8 states/8 contexts pass; root views original valid01/renamed02/unrelated04 PNGs.

The754-path runtime/inspector capsule includes the changed evalMemo.ts and remains unchanged through cleanup. Page/console errors, worktree changes and downloads are zero. All8 contexts, Chrome and Vite close. The consumer exercises current reference Open; it does not force distinct private callback semantics. That contract is established by the controlled cases. No actual native Save/export occurs; held-Doc reopens are prewritten accepted fixtures.

FAIL retained: the six original ownership assertions. No controlled cancellation, current check failure or actual Studio failure occurs.

NOT_RUN: actual chat/apply_ops/history mutation or Save/UndoRedo replay in this driver (history consumers have focused tests), broad memory/latency profiling, physical/native geometry oracle, general reference compatibility or raster/fit certificate, whole-kernel/production build, CI, mobile, release and develop integration. Whole CAD/core remains NOT_MEASURED. Next MAIN D528/P0-R08 qualifies CAD React settled Worker failure and explicit caller-owned retry through the existing Viewer and returned-Doc Studio consumer.

## Commands

Node22.19.0; each heavy run is serial under gate.sh acquire heavy60 and released on exit. All worktree writers freeze for actual Studio. Use a new external output. Model runner handles its own package cwd; Studio document-file runs from apps/cad-studio.

```sh
TEST_CONCURRENCY=1 node packages/barocss-cad-model/scripts/test.mjs evalMemo-ownership
TEST_CONCURRENCY=1 node packages/barocss-cad-model/scripts/test.mjs evalMemo references transactions script rebase-moves-ops bearing-housing-context
# From apps/cad-studio
TEST_CONCURRENCY=1 node scripts/test.mjs document-file
pnpm --filter @barocss/cad-studio-app run type-check
pnpm --filter @barocss/cad-model run type-check
node --check test/reference-open-browser.mjs
REFERENCE_OPEN_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node test/reference-open-browser.mjs /tmp/barocss-d527-studio-reference01
# REFERENCE_OPEN_HINT_ONLY must be unset for the recorded full case matrix.
git diff --check
```

qualification.json pins source, original/current logs, actual receipt and reviewed screenshots. Raw evidence stays outside Git. Hashes establish custody, not numerical correctness.
