# #458 exact corpus launch packet

**Status:** preparation only. No new #458 corpus Codex dispatch has run. This packet is for independent pre-launch Review of the clean task commit and frozen plan. It is not an approval record.

## Fixed generation boundary

- Ten exact scenarios and names are in `plan.mjs`. Row 01 is the accepted #460 prompt-v2 pair; two earlier #460 calls are charged separately. A static digest map in `launch.mjs` checks the accepted prior artifacts. The maximum is 20 aggregate reservations: 4 prior and at most 16 new.
- Each new row uses a distinct Codex CLI session. A valid first response permits one same-session `save` follow-up. A failed or invalid first response never dispatches its follow-up. An invalid final JSON is retained and counted; there is no repair, retry, replacement, fallback, or prompt edit.
- The CLI settings come from the accepted #460 bridge: Codex CLI 0.156.1, `gpt-6-sol`, high reasoning, `profile-form-v2` prompt contract, the strict output envelope schema, disabled web search and network, existing ChatGPT CLI login, 180-second per-call and 360-second per-session limits. Unexpected tool events stop the transport. The corpus has a 3,600-second whole-run limit. The native CLI transport stores bounded observable events and private raw finals. It does not collect hidden reasoning or credentials.
- `launch.mjs` requires a clean exact task commit, a byte-matching `frozen-plan.json`, a matching private approval, unchanged accepted #460 artifacts, the pinned CLI version, and an unused one-use claim. It writes the claim before collection. It writes a durable reservation before each new dispatch. A crash or ambiguous outcome consumes its reservation and cannot restart this claim. It stops the batch on approval denial, login/quota uncertainty, ambiguous completion, timeout, provenance loss, or isolation cleanup failure.
- Only synthetic prompts and names are sent. Generated data cannot edit the repository, evaluator, renderer, or content rubric. The CLI scratch and home are isolated under `/Users/user/.barocss-ai/v3`; the installed CLI bridge uses native restrictions. Model calls are serial. No OpenAI API, new dependency download, public deployment, or package publish is in this path.

## Pre-launch Review evidence

From the task worktree root, run the no-model commands in [README](README.md). The frozen plan binds scenario bytes, rubric, CLI profile/transport/schema, both renderer adapters, package contract, lockfile, and this packet's relevant source. Review must inspect the exact task commit and plan digest, then place an English ACCEPT with its own verification and limits on Issue #458.

The launch approval must be a new mode-0600 JSON file named `/Users/user/.barocss-ai/v3/private-458-corpus-approval-ID.json`, with exactly:

```json
{
  "kind": "barocss-458-corpus-launch",
  "issue": 458,
  "taskCommit": "EXACT_REVIEWED_TASK_COMMIT",
  "frozenPlanSha256": "EXACT_FROZEN_PLAN_SHA256",
  "ownerDecisionRef": "https://github.com/barocss/barocss/issues/458",
  "reviewUrl": "https://github.com/barocss/barocss/issues/458#issuecomment-REVIEW_ID",
  "priorDispatches": 4,
  "newDispatchCeiling": 16,
  "aggregateCeiling": 20
}
```

The placeholder values are filled from the actual accepted Review and frozen plan. `ownerDecisionRef` is an audit link, not proof of permission by itself. No approval file is created before Review ACCEPT. The only live invocation is:

```sh
/Users/user/Library/pnpm/nodejs/22.19.0/bin/node scripts/barocss-render-corpus/launch.mjs --approval /Users/user/.barocss-ai/v3/private-458-corpus-approval-ID.json
```

After collection, run `verify.mjs --claim` and `replay.mjs --claim` from README. Actual-corpus replay itself requires successful lineage verification and rechecks each consumed final against the verified raw digest. An authored or calibration manifest is labelled separately and cannot stand in for an actual verified #458 corpus. Save actual status counts, private paths, digests and redacted per-row findings. Do not put raw model JSON, private diagnostics, or screenshots in public Issue text. Independent final Review must ACCEPT the saved evidence before local `develop` integration and Issue closure.
