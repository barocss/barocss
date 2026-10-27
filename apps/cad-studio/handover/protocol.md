---
work_id: cad-review-continuation-20261022
artifact_type: handover-protocol
status: in_progress
owner_role: CAD Coordinator
source_request: "Current chat: make future handovers resumable and preserve separate implementation Works."
last_updated: 2026-10-23
---

# Handover protocol

## Owner operating rules (2026-10-23)

These rules preserve the current protocol, state file and three Works. The
coordinator records current state. Each Work implements its assigned feature.

- Use `codex/cad-coordinator-handover-20261022` as the only integration branch.
  Review each immutable feature checkpoint and merge it with `git merge --no-ff`.
  Record the branch as `adopted` in `state.yaml`, with the adopted tip, merge SHA
  and evidence boundary. A later branch tip is not adopted automatically.
- Keep active or incomplete source as WIP. If an unmerged branch is discarded,
  record its name, last SHA and reason in state. Do not delete its checkpoint.
  Keep earlier cherry-pick records as history; do not rewrite history to change
  the integration method.
- Do not modify, merge, delete or reset these branches or their worktrees:
  `review/cad-gpu-engine-2026-10-14`, `claude/cad-outer-lane-531d5a`, and
  `claude/gpu-viewer-pose-clip-2026-10-21`. Claude owns their later integration.
- Use the project's TypeScript implementation. Do not add WASM or runtime
  dependencies. Do not create nested functions in per-frame or per-element paths.
- Return a typed refusal instead of an incorrect result. Never relax tolerances.
- Do not embed standard tables or standard source text. Keep rows rule (b): the
  agent may load rows only from a file that the person supplied in the conversation,
  with its source recorded. Refuse rows written by the agent.
- CAD agent tools use v2 group actions only. Keep the per-turn tools list plus
  prompt at or below 25,000 characters. Do not bundle icon fonts.
- Stop only processes owned by the current Work. Coordinate with another owner
  to stop that owner's processes. Keep the existing serial execution/load gates.
- Push, PR, publish and release require an explicit owner request for that action.
  Use Git author and committer `easylogic <cyberuls@gmail.com>`.
- Write documents and commits in English. Report to the owner in clear Korean.

Routine work within the approved roadmap continues without another approval.
The rules above do not start the handback procedure.

## Read order

1. `state.yaml`: current baseline, Works, checks, blockers and the next task.
2. `roadmap.md`: scope, dependencies and measurable exits.
3. The latest dated coordinator handover referenced by state.
4. The lane's latest README handover block and final D/O/G decision records.

The current state has one writer: the coordinator. A dated note is an immutable
snapshot of the commit it names. Earlier next-task and unpushed/merged statements
remain historical when a newer state supersedes them.

## Separate Works

- Kernel owns the CAD kernel and the declared wiring for new kernel kinds.
- Model owns the UI-free document/domain package and declared app UI/server work.
- GPU owns GPU/viewer, viewport glue and declared app call sites.
- Coordinator owns current handover records, path contracts, serial adoption and
  verification. It does not implement a lane's feature in the verify worktree.

Use the Work identities and exact paths in state. Name a cross-lane file and the
intended change before editing it. Do not reset, stash, amend or rebase another
Work's checkout. Preserve inherited files and old checkpoints.

## Checkpoint receipt

Every implementation checkpoint reports:

```text
work_id / task_id / owner
baseline_commit / task_commit / tested_commit
owned_paths / changed_paths / dirty_paths_to_preserve
behavior_before / behavior_after / supported_limits
checks: command, cwd, result, count, environment, artifact_path
first_failure: exact command and result, or none_observed
not_run: each required check not executed and its reason
blockers: dependency owner, required artifact, resume condition
next_action: one task, its entry condition and its measurable exit
```

Record receipts and logs under `evidence/<tested-commit>/` when they are committed.
Record the evidence commit separately if it follows the tested code. A receipt
must describe actual results; pending checks have no invented count or pass state.
Keep readable summaries beside machine-readable receipts when the result needs
an explanation. Do not add a second manually maintained current status table.

## Feature delivery assignments

Apply `feature-orchestrator` to goals, ownership, dependencies and handoffs.
Apply `company-delivery-owner` to usable delivery slices and implementation order.
Keep the existing handover brief and three Work identities; do not create a second
planning tree or extra Works for each specialist phase.

Assign one functional result with its exact baseline, owned paths, required
consumer/UI connection, completion criteria and relevant checks. Include necessary
tests in that implementation task. Test scaffolding or preparation alone is not
feature completion. A separate investigation is appropriate for a demonstrated
failure or dependency, and it must state what implementation it unblocks.

Use the existing CAD document, Canvas, commands, selection and history. Make the
required native, actual screen/file and integrated acceptance boundaries explicit.
Keep package checks and fresh evidence; this rule does not waive required checks.
Reserve heavy checks serially without blocking independent source implementation.
The coordinator records transport acceptance separately from recipient acknowledgment.

The owner's latest priority is usable roadmap implementation. Keep each lane on
its assigned feature through its consumer connection and output. Do not replace
that work with repeated legacy-test maintenance or full-suite runs. Resolve a
failure within the feature it blocks, preserve the first failure, and continue
independent implementation. Batch aggregate checks at a functional adoption
milestone. Pending checks remain pending; this scheduling rule does not lower
accuracy, approval, provenance or completion requirements.

## Coordination window

1. Confirm the checkpoint's exact base, changed paths, ownership and dependencies.
2. Inspect actual evidence and retain failed and passing results.
3. Adopt one immutable delta at a time into the coordinator's local branch.
4. Run relevant affected checks; batch the remaining window flow at a functional
   adoption milestone in an unchanged checkout. Keep its unrun scope explicit.
5. Update state with the adopted commit and the actual verification commit.
6. Reply promptly and assign the next ready functional task. Preserve a checkpoint
   at each handoff; do not park independent feature implementation behind a broad run.

Use Node 22 and the source handover's load/concurrency rules. Build the local CAD
and GPU libraries before consumers. Each worktree has its own dependencies and
outputs. Kill only owned PIDs. Source/software, real browser/file/device,
integration, remote merge and release results remain separately named.

Several Works can implement independently. Heavy package suites, full kernel
runs and browser/benchmark runs need a shared scheduling window: start one at a
time and record the running Work in state. Load below the limit is an entry
condition, not permission for every Work to start a long run together. If a run
is stopped for machine load, preserve its partial log and mark it interrupted;
do not infer a final pass count from completed subtests.

Browser load1m<20 and load5m<25 are entry gates, as specified by the source
handover. Do not turn a short20-25 rise after valid entry into an immediate
abort. For current serial operations, sustained high load means load1m>=40
in two observations15seconds apart; stop only the owned process group.
Record load with timing results and retain timing failures. Product criteria
and numerical tolerances do not change. A restarted run must pass entry again.

During a long run, continue to observe machine load. If it greatly exceeds the
budget, stop only the identified owned processes and preserve their partial logs.
Record a resource interruption separately from a product failure. New check
launches, including builds and type checks, can be held across the three Works
while source implementation and review continue. Resume checks only after load
recovers and the coordinator grants a narrower serial slot.

On STOP, preserve the checkout and record running jobs, stopped checks, artifacts
and the exact restart point. Do not resume old automations or supervisors merely
because the next account can read their history.

## Response and instruction loop

The owner supplied a [message example](notes/coordination-message-pattern-2026-10-22.md)
and clarified the working method. When a Work responds, the coordinator checks
its result and evidence, decides acceptance/correction/hold, sends a concrete
reply with the next bounded task, relays cross-lane dependencies, and promptly
shows the owner what was received and what was sent. Do not let a ready Work
remain idle only because a periodic heartbeat has not fired. While an active
verification runs, use cursor-based waits and act on new checkpoints. Between
active turns, the existing heartbeat resumes collection. Tool acceptance is not
proof that a recipient read or acknowledged a message.

The example is an operating pattern. Its historical technical results are not
current test results or new assignments. Keep the monitor active after the first
three checkpoints; follow the approved roadmap until completion or owner stop.

## Handback when the owner says "마무리"

1. Stop new feature dispatch and pause the `cad-work` heartbeat. Ask each Work
   to stop its active checks using only its own PIDs. Stop coordinator-owned
   checks. Record the command, tested SHA, PID/group, partial logs, last completed
   step and exact restart step in state. Preserve dirty files and WIP commits.
2. Collect each Work's final checkpoint and D/O/G decision record. Review any
   ready adoption serially. Preserve unverified work as WIP. Freeze the final
   integration code commit before starting the final verification window.
3. Run builds, package and Studio tests, TypeScript checks, lint and the full
   browser flow on that exact integration commit. Use the existing load gates
   and one executor. Keep the checkout unchanged during the window. For each
   check, record its command, environment, tested SHA, result, log and first
   failure. Mark a check that did not execute `not run`, with the reason. Record
   a stopped check as interrupted, with its completed scope. Do not substitute
   older passes for the final commit. A load or environment block does not allow
   a pass claim and must not prevent an accurate handback.
4. Write `notes/codex-handback-<YYYY-MM-DD>.md` using the Asia/Seoul date. Include:
   final integration SHA and last fully verified commit; completed items and the
   exact next first step per Work; unverified WIP and its commit or dirty paths;
   open defects and owner decisions needed; each Work's thread, actual worktree,
   branch and checkpoint; final verification results and every `not run` item.
5. Check `decisions.md` (Kernel D), `decisions-outer.md` (Model O) and
   `decisions-gpu.md` (GPU G). Record the latest relevant IDs and commits in state.
   Keep unresolved decisions explicit. Do not claim that an unread record is current.
6. Commit the handback and state in English. Record the tested code SHA separately
   from the later documentation commit. Do not label the documentation HEAD as
   tested or attempt to put its own commit hash in its contents. Confirm that
   another agent can identify the next action and all blockers using only the
   handback note and state. Keep the heartbeat paused until the owner resumes work.
