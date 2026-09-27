# #447 live-model study preparation

Preparation only. No live calls or downloads were made. Read [APPROVAL-PLAN.md](APPROVAL-PLAN.md) for exact model candidates, unknown billing facts, phase sizes and conservative token-charge ceilings. Read [RUBRIC.md](RUBRIC.md) before interpreting any replay.

Use Node 22.22.0 and the existing #446 installed dependencies. Run the commands recorded in Issue #447. Capture defaults to a deterministic synthetic provider; only an explicit `--live` plus a matching owner approval and verified account facts enables the direct API adapter. Never count synthetic outcomes as model quality.

```sh
node --test scripts/json-render-447/budget.test.mjs scripts/json-render-447/capture.test.mjs scripts/json-render-447/provider.test.mjs scripts/json-render-447/plan.test.mjs
node scripts/json-render-447/capture.mjs --freeze > /tmp/barocss-447-frozen-plan.json
node scripts/json-render-447/capture.mjs --phase pilot-b --output /tmp/barocss-447-dry-valid
JR_ROOT=/Users/user/.barocss-ai/v3/wt/issue-446/scripts/json-render-446/scratch/jr PW_DIR=/Users/user/github/real-ime/real-ime/node_modules/.pnpm/playwright-core@1.60.0/node_modules CHROME='/Users/user/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration node scripts/json-render-447/replay.mjs --input /tmp/barocss-447-dry-valid/rows.json --output /tmp/barocss-447-dry-valid/replay.json
node scripts/json-render-447/verify.mjs /tmp/barocss-447-dry-valid
```

Use a fresh output directory for each dry rerun. The manifest is exclusive; a run never silently overwrites evidence. `rows.json` contains every scheduled cell and complete sent messages/raw responses. `ledger.json` contains durable reservations; pending, blocked or locked ledgers require explicit reconciliation. `response-NNN.json` preserves each received response before accounting settlement; final statuses are in `rows.json`. Browser outputs are written separately and include screenshots. Build-only control has no additional model responses.

The initial offline run passed 21 Node tests and produced 72 synthetic captures plus 96 browser/control observations. Final independent Review is required before local integration. The frozen plan hash includes code, prompts, rubric, order, model settings and pricing assumptions; update it after any preparation fix.

The approval hash follows transitive local imports and includes the browser entry, pinned runtime bundle, host CSS, repository dependency lock and the copied #446 npm dependency lock (including package integrity records). Replay must use the already approved #446 dependency installation; no install is authorized. Dependency or runtime changes require a new frozen plan and review. Session success requires all four anchors; later cells keep their independent scores after a prior failure.
