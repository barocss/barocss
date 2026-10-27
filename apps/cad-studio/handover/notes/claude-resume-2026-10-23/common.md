# Common brief — barocss CAD lanes, resumed by Claude on 2026-10-23

You are one of three implementation lanes (kernel, outer, GPU) of the barocss CAD work (packages/barocss-cad,
packages/barocss-cad-model, packages/barocss-gpu, apps/cad-studio). A coordinator session (Claude; its session title is
"barocss-cad/gpu 엔진 리뷰") reviews your checkpoints and merges lanes into the integration branch `review/cad-gpu-engine-2026-10-14`.
Find it with ListAgents and message it with SendMessage.

## How we got here
- 2026-10-22: the previous Claude account handed over. `apps/cad-studio/handover/notes/coordinator-handover-2026-10-22.md`
  and README §0 lane blocks describe that state.
- 2026-10-22/23: Codex continued the same roadmap on `codex/*` branches, then stopped at the owner's request.
  - Its hand-back: `apps/cad-studio/handover/notes/codex-handback-2026-10-23.md`.
  - Its state: `apps/cad-studio/handover/state.yaml`. Its working rules: `protocol.md` and `roadmap.md` in the same folder.
- 2026-10-23: the coordinator brought Codex's final tree into integration as one commit, `99da385a1`.
  - Evidence and receipt folders were left out; the owner had them deleted.
  - Codex's per-commit history stays on the local `codex/*` branches. SHAs in Codex's documents resolve there.
  - Do not delete those branches.
- From now on we work the Claude way:
  - each lane's current block at the top of README §0;
  - the decision logs: `decisions.md` (kernel, D-ids, next **D176**), `decisions-outer.md` (outer, O-ids),
    `decisions-gpu.md` (GPU, G-ids).
  - Codex's `state.yaml` is frozen as history. Do not maintain it.

## Taking over Codex WIP that is not in integration
- Port only source and test changes:
  - `git cherry-pick -n <sha>` (or `git show <sha> -- <paths> | git apply`);
  - then drop every `**/evidence/**` and `**/receipts/**` path before committing.
- **Never commit evidence again:** no logs, screenshots, archives or raw receipts.
  - Put the numbers and the exact commands in the decision record.
  - Keep raw artefacts in your session scratchpad.
- Review WIP before adopting it. Codex marked what it did not verify.

## Standing rules (owner decisions; also in memory)
- Code:
  - own TypeScript only: no WASM, no new runtime dependencies (commit pnpm-lock.yaml only with a deliberate new dependency);
  - no functions defined inside functions on hot paths (per frame, per element, per sample): hoist to module level;
  - typed refusals over wrong results; never loosen a tolerance or change an expected value to make a test pass;
  - expected-value changes need an independent oracle and a decision record.
- Data and agent tools:
  - no built-in standards tables or standards text; sizes come from user rows;
  - rows rule (b): the agent loads rows only from a file the person supplied in the conversation, with its source
    recorded; agent-written rows are refused (ROWS_NOT_FROM_PERSON);
  - v2 agent actions only; the per-turn tools list plus prompt stays at or under 25,000 characters.
- Contracts: saved documents keep resolving. Version a node or contract change; never rename silently.
- Other lanes' files: before changing one, name the file and the change to the coordinator.
- Git:
  - integration branch: never amend, rebase or reset; a correction is a new commit;
  - identity `easylogic <cyberuls@gmail.com>`; commit messages end with
    `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - no push, PR, publish or release unless the owner asks.
- Environment:
  - Node 22: `export PATH=$HOME/.nvm/versions/node/v22.19.0/bin:$PATH`;
  - `pnpm build:library` in packages/barocss-cad and packages/barocss-gpu before tests that use them;
  - kill only your own PIDs, never by script name;
  - check `sysctl -n vm.loadavg` before long runs (wait above 40);
  - one heavy run at a time across lanes: ask the coordinator before a full suite or a full flow.
- Disk: it ran full on 2026-10-22/23.
  - Long runs go in a detached scratch worktree under your session scratchpad, removed when done.
  - Never leave checkouts or flow outputs behind.
  - Check `df -h /System/Volumes/Data` before a long run (keep about 10 GB free).
- Verification (owner v2/v3):
  - every checkpoint: lint and type-check of the changed packages (after the last edit to a test file; cad-model's
    tsc covers test/) and the touched package suite;
  - `FLOW_ONLY=<regex>` only for the steps the change runs plus their prerequisites; rerun only a failing step and
    its prerequisites;
  - the full kernel suite (`--test-concurrency=4`) only when brep core changes;
  - RB and properties at track boundaries or every 4th kernel checkpoint;
  - don't edit files while a flow runs from your worktree;
  - every checkpoint names its tier and lists what ran and what did not.
- Flow command, from apps/cad-studio:
  `CAD_STUDIO_CHAT_PORT=<your port> CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" PW_DIR=$HOME/.cache/barocss-playwright/node_modules/playwright FLOW_ONLY=<regex> node test/browser-flow.mjs <out-dir>`.
  Ports: kernel 52491, outer 52391, GPU 52691, coordinator 52591.
- Language: reports to the owner in Korean; code, commits, documents and peer messages in English.

## Working loop
- One step per checkpoint:
  1. implement with its tests;
  2. run the checks;
  3. write the decision record;
  4. update your README §0 block;
  5. commit;
  6. send the coordinator the SHA, tier, counts, and what didn't run.
- Then continue with the next step in your queue. Wait only if the coordinator asked you to, or the next step needs
  something you do not have.
