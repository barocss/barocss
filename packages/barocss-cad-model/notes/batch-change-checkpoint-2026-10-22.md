# Batch document changes: approval and persistence

Scope: the first Model/Outer P1 checkpoint only. Baseline:
`c3ae0d5de60ecb250350b597552fb0203b41d43e`. The new chat's clean detached
worktree initially had `57ad0fd09b6919e20133657c0739f87d10e81ecb`; the task
branch `codex/cad-model-batch-change-c35f` was created at the requested baseline.
Author/committer: `easylogic <cyberuls@gmail.com>`.

## Decision

`treeDiff` describes features, parameters and requirements. It does not cover
every persisted document field. It remains the tool's descriptive diff.
`apply_ops` and `run_script` now compare the complete final document with the
initial document using the existing `canonical` function. There is no new field
allowlist, hash or dependency. Transaction ids and session policy are outside
the document comparison. A net-zero document change remains a no-op.

This makes `runTool`'s existing approval gate and MCP's existing save, version
and `captureOp` paths run for document-only changes. No approval policy or MCP
production code changed.

## Reproduction and regression coverage

Before the production edit, `node packages/barocss-cad-model/scripts/test.mjs
batch-changes` reproduced three failures (2 passed, 3 failed):

- Direct `add_part {name: 'Shaft'}` needed approval. The same batch succeeded
  with an empty feature diff and `changed: false`.
- `fastener(... insert: 'instance')` needed approval directly, but its script
  succeeded with an empty feature diff. A batch wrapping a script is covered too.
- A brief-only batch changed its document but reported `changed: false`.

The final regression files cover approval equivalence at L2/L3/L4 for assembly
and drawing, script assembly changes, human proposal acceptance and file
roundtrip, brief/material/frame-row changes, retries, empty scripts, net-zero
changes, dry runs, and atomic failure preservation. The MCP tests exercise both
the real state-file store and `.bcad` store, including version increments,
captured effects, a fresh session, and unchanged file bytes after no-ops or
refusals. Evaluation uses the actual `evaluateDoc`.

## Verification

Node `v22.19.0`. All installs were offline, frozen and ignored lifecycle scripts.
The primary worktree and the detached verification worktree each installed
their own dependencies; no other worktree's `dist` was used. Verification copy:
`/tmp/c35f-cad-model-batch-verify`, at the baseline plus the task's three source
and test files, with matching SHA-256 values.

Tier: scoped lane checkpoint under the hand-over's v2/v3 rules. Full package
suites and affected browser steps ran; this is not a coordinator merge window.

| Working directory / command | Result |
| --- | --- |
| Primary and verify roots: `pnpm install --offline --frozen-lockfile --ignore-scripts` | Both passed; no downloads |
| Primary and verify roots: `pnpm --filter @barocss/cad build:library` | Both passed |
| Verify root: `pnpm --filter @barocss/gpu build:library` | Passed |
| Primary root: `pnpm --filter @barocss/cad-model type-check` | Passed after the final model test edit |
| Primary root: `pnpm --filter @barocss/cad-model lint` | Passed, 0 errors, 17 warnings in untouched tests |
| Primary root: `pnpm --filter @barocss/cad-studio-app type-check` | Passed after the final studio test edit |
| Primary root: `node packages/barocss-cad-model/scripts/test.mjs batch-changes transactions script` | 15/15 before adding the human-acceptance test; the final full suite includes that added test too |
| `GOMAXPROCS=4 node /tmp/c35f-run-tests.mjs /tmp/c35f-cad-model-batch-verify/packages/barocss-cad-model` | 807/807; 0 skipped; includes all 6 new model tests |
| `GOMAXPROCS=4 node /tmp/c35f-run-tests.mjs /tmp/c35f-cad-model-batch-verify/apps/cad-studio` | 215/215; 0 skipped; includes both new MCP tests |
| Primary root: `git diff --check` | Passed |

The temporary suite runner uses the existing `scripts/test.mjs` bundling and
test inventory, with the package directory explicit, `cwd` set to that package,
and Node's `--test-concurrency=4` added. `GOMAXPROCS=4` also bounds esbuild's Go
workers. It does not filter out a test. To rerun the committed regressions
without the temporary runner: `node packages/barocss-cad-model/scripts/test.mjs
batch-changes`, then `pnpm --filter @barocss/cad-studio-app test`.

Test-name inventories were saved to `/tmp/c35f-model-passing-names.txt` (807)
and `/tmp/c35f-studio-passing-names.txt` (215). Every name in the earlier focused
model run is in the final full suite. No existing test file or name was edited
or removed. No older commit's suite was rerun.

Browser command, from the verification worktree's `apps/cad-studio`:

```sh
export PATH=$HOME/.nvm/versions/node/v22.19.0/bin:$PATH
CAD_STUDIO_CHAT_PORT=52791 \
CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
PW_DIR=$HOME/.cache/barocss-playwright/node_modules/playwright \
FLOW_ONLY='autonomy L2|A5[.]2:|A6[.]1:' \
node test/browser-flow.mjs /tmp/c35f-cad-model-batch-verify/output/playwright/batch-change
```

Result: **4/4** (steps 1, 99, 207, 219): starter; L2 first build/value edit/Undo
and refused two-feature batch then proposal; script apply/Undo/atomic refusal;
brief readback and user confirmation. No served file changed during the flow.
Pre-flow `vm.loadavg` was `{29.64 43.36 39.80}`: below the Outer lane's 40
start threshold. The coordinator's stricter full merge-window flow gate and
full flow remain separate. Only scripted local agent fixtures ran.

Final source-copy SHA-256:

- `src/chat/tools.ts`: `9a6793e238377cf17c572f723c68375c964eabd22e30328a6c933e31ea42cf0a`
- `test/batch-changes.test.ts`: `6de6134fb4f40a6540ca1633872bcf99067c3afefe9b8a826ddb6987f06dcb63`
- studio `test/batch-changes-mcp.test.ts`: `62182dc41e069717874b763e1c94843fc86228fba8f7e191fd656f255036d4ce`

One unconstrained full model suite was stopped during shared-machine overload
(47 passing results emitted, no completed suite verdict). Only the process tree
rooted at this task's known PID 89614 was terminated. This is an interrupted run,
not a passing or failing full-suite result. The previous lint run returned zero
errors and 17 existing `no-explicit-any` warnings in untouched tests.

The first test drafts also exposed test-fixture errors (a synchronous evaluator
where `Evaluate` takes a Promise, section-row argument names, a protected stated
brief field, and the expected brief payload's version). These were corrected
before the final runs; no production behavior was changed for them.

Not run: kernel full suite, GPU suite, RB/properties, full browser flow,
performance measurements, or A9 WIP acceptance. No kernel/GPU/viewport/shared
root code changed. Complete-document comparison is linear in document size;
this checkpoint makes no performance claim.

## Deferred work (not implemented here)

- Next P1, waiting for a new instruction: `team/freshness.ts` `modelInput`,
  `revision.ts` `REVISION_FIELDS`, and `digest.ts` `partDigests` omit geometry
  inputs including `frames.sections`. Coordinator reproduction: a 300 mm member
  changed from 40x40x3 to 50x30x4, mass 359.64 g to 466.56 g; the old result,
  revision, base digest and baseline verification remained current/intact.
- P2 backlog: `wireDoc`'s evaluated-part payload omits `frames.welds`.
  Coordinator reproduction: 3 bodies (including a 360 mm3 bead) become 2 after
  WireSender/Receiver, with the same evaluation key.
- A9 follow-up features and earlier WIP acceptance remain with the coordinator.
  This checkpoint does not certify those items or an integrated merge window.

No push, PR, merge, publish, deployment, live LLM call or external data download.
Stop after this checkpoint; do not start the deferred P1 automatically.
