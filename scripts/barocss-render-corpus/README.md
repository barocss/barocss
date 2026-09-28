# #458 saved Codex JSON corpus

The renderer is the private workspace package [`packages/barocss-render/`](../../packages/barocss-render/). This `scripts/` directory contains a bounded study runner and an offline replay. It does not define or publish another package.

The current plan has ten fixed profile-form rows. Row 01 is the already accepted #460 two-turn proof. Two earlier #460 attempts also count, so the aggregate starts at 4/20 dispatches. The runner can reserve at most 16 more turns. If every row from 02 through 09 succeeds twice, row 10 is recorded as skipped at the ceiling. An invalid initial response leaves that row's next turn unattempted. It does not trigger a replacement call.

## Before any new Codex CLI dispatch

The [launch packet](LAUNCH-PACKET.md) defines the exact gate. Independent Review must ACCEPT the clean task commit, frozen plan, counting, isolation, and launch entry point. A private approval record then binds that Review and the owner decision to the exact commit. Running tests, freezing the plan, checking prior evidence, and replaying saved data do not call a model.

```sh
NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
JR_ROOT=/Users/user/.barocss-ai/v3/wt/issue-446/scripts/json-render-446/scratch/jr \
PW_DIR=/Users/user/github/ai-based/abs/node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core \
REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration \
"$NODE" --test scripts/barocss-render-corpus/*.test.mjs
"$NODE" scripts/barocss-render-corpus/freeze.mjs --verify
"$NODE" scripts/barocss-render-corpus/verify.mjs --prior
```

After accepted launch and collection, these exact commands verify private lineage and replay only saved bytes. They do not dispatch Codex:

```sh
"$NODE" scripts/barocss-render-corpus/verify.mjs --claim
JR_ROOT=/Users/user/.barocss-ai/v3/wt/issue-446/scripts/json-render-446/scratch/jr \
PW_DIR=/Users/user/github/ai-based/abs/node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core \
REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration \
"$NODE" scripts/barocss-render-corpus/replay.mjs --claim
```

`verify.mjs` checks the prior four dispatches, each new durable reservation, frozen prompts and CLI arguments, raw final digests, same-session IDs, and every row/turn status. Actual-corpus replay enforces that verification again and compares the bytes it consumes with the verified hashes. `replay.mjs` reads each saved `specJson` without repair, validates it again, and sends that same JSON string to both the private renderer and the installed official json-render adapter. Each valid pair is replayed at 1200px and 390px. It measures the schema-valid root and every card by their actual node IDs, including a second help card. It records separate generation, parse/validation, and render-apply times, visible state/action results, layout properties, and screenshots. The fixed [content rubric](rubric.mjs) checks explicit requested fields; Korean language quality and row 10 help-text meaning remain marked for human review. Reports label actual verified corpus, accepted #460 calibration replay, and authored fixtures separately. Outputs and screenshots stay under the private V3 directory.

The study reports counts and per-row observations. One successful profile form cannot establish arbitrary UI support or renderer superiority. Updates use complete responses, not streaming.
