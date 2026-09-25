# BaroCSS — Autonomous Operating Protocol

Read, in order: this file → the contract your step names (§1) → your mode's inputs (below).
Read nothing else until your mode requires it.

## 1. Pick your mode (deterministic)

A contract lives in `.ai/work/<id>.yaml` (the work store, one file per work item) or in
`.ai/EXPERIMENT.yaml` (the legacy single slot: finish the contract in it, never start a new one
there). "The contract" below is the one file your step names.

1. `git fetch origin`. If your instruction names a step (`EXECUTE <id>`, `REVIEW <id>`,
   `PLAN`), that is your pass. Otherwise run
   `python3 tools/ai-supervisor/sup.py observe --out -` and take its `work next` step; if that is
   a WAIT, BLOCKED, HUMAN_REQUIRED or IDLE step, STOP. EXECUTE is EXECUTION of that contract,
   REVIEW is the STRATEGY review of it (§2A, the Judge), and PLAN is STRATEGY choose (§2B, the
   Planner); PLAN names no contract, so go straight to §2. A `MERGE #<n>` step is a merge already
   decided: merge that PR if §6 allows it, then STOP.
2. Read the contract from `origin/develop`. If its status is `ready` or `running` and its
   `branch` exists on origin, read it from `origin/<branch>` instead. That copy is
   authoritative, because the result lives there until Strategy merges it.
3. Confirm the step against its `status`. If they disagree, STOP without changes:

| status                        | mode      | job                                              |
|-------------------------------|-----------|--------------------------------------------------|
| `ready`, `running`            | EXECUTION | run the frozen contract, propose a verdict, open PR |
| `done`, `blocked`             | STRATEGY  | review the experiment PR: verdict and merge decision (Judge) |
| `none`, `evaluated`, missing  | STRATEGY  | choose the next question, write the contract     |

One session = one mode = one pass, then STOP. Never switch modes inside one
context. If the harness keeps you running, start the next mode in a fresh
context (a new session, or a subagent that sees only its mode's inputs).

Why: the builder must not judge its own work, and the judge must not pick up
implementation detail, because that anchors it on nearby technical work.

**Authority:** only Strategy accepts an experiment and decides whether its PR
merges. Carrying out a decided merge is mechanical (§6). Execution never merges
anything.

## 2. STRATEGY

Inputs: `.ai/VISION.md`, `.ai/STATE.yaml`, the open contracts (`.ai/work/*.yaml`
not yet `evaluated`, and `.ai/EXPERIMENT.yaml` until it is), `git log --oneline
-15 -- .ai`. When reviewing, also the experiment PR's diff and CI. Product
source only to answer a specific factual question, with a few targeted
searches. No product code edits.

**A. Review, the Judge** (status `done` or `blocked`). Check out `branch`, then:
1. Run `python3 .ai/check.py --role execution --base origin/develop` (add
   `--work <id>` for a work-store contract). If it fails (contract edited, or
   changes outside scope), reject the experiment.
2. Review each of these on its own terms: the frozen `evidence.proves_yes`,
   `proves_no` and `level_required`; `result.evidence`, rerunning an L2
   command when it's cheap; `git diff origin/develop...HEAD`; CI
   (`gh pr checks <pr>`); and the proposed verdict. Judge against the
   criteria, not the executor's narrative.
3. Set `review.accepted_verdict`. It is at most what the evidence supports;
   downgrade freely, never upgrade.
4. Merge decision (`review.merged`). This is a separate question from the
   verdict:
   - Evidence-only PR (no product code): merge it, whatever the verdict.
     Negative evidence is knowledge too.
   - Product-code PR: merge only if CI is green, the diff is the minimum the
     contract allowed, and the evidence shows the merged capability is needed
     (it closes the cited gap). That is normally a PROVEN verdict; a PARTIAL
     one qualifies only when the part being merged is itself demonstrated. A
     PROVEN experiment may still discard its implementation. Say which in
     `review.reason`. Otherwise don't merge, and keep the branch as a reference.
5. Record the outcome: set `review` and `status: evaluated`, update
   `STATE.knowledge`, `STATE.now` and, if direction changed,
   `STATE.decisions`. Commit this on the experiment branch as
   `ai(strategy): review E-00N <VERDICT>`, rerun `check.py` (structure only),
   and push. If merging, the merge happens once required checks pass (§6). If
   not merging, close the PR with its one-line reason; the next Planner pass
   copies the record onto `develop` (B.0). The review pass ends here. Choosing
   next work is a separate Planner pass.

**B. Choose and contract, the Planner.** Starting from the updated
`origin/develop`, on branch `ai/strategy-E-00N`:
0. If a judged result isn't on `develop` (its review says `merged: false`),
   first copy its contract, result, review and `STATE` updates from its branch.
1. Pick one question for the active outcome: the unresolved assumption whose
   answer most changes what BaroCSS should build or stop building. Run the
   gates in §5 first.
2. Write the contract as `.ai/work/<id>.yaml` (the next E-id; the file name is
   the id) with its `branch`, and set `status: ready`. Write more than one only
   for independent questions that each pass the rules below, and declare what
   a scheduler can't infer: `depends_on` (ids that must be judged first),
   `locks` (shared runtime resources, e.g. `port:5173`), `observes` (paths
   whose behavior the item measures), optional integer `priority`. Writing no
   contract is valid when no open question is worth one: set
   `STATE.now.idle_since` to the `origin/develop` sha you planned from and
   `STATE.now.idle_reason` to why, in one line. Idle is a state, not a
   failure: the supervisor stays idle until a strategic input changes (VISION,
   `STATE` outside `now`, any contract). Remove both fields when you write a
   contract. Update `STATE.now`.
3. Integrate it yourself. Run `python3 .ai/check.py --role strategy --base
   origin/develop`, commit `ai(strategy): …`, push and open a PR; it merges
   once required checks pass (§6). If the check fails or CI is red, fix it or
   record a blocker in `STATE.now.blockers`. STOP.

Strategy may also switch the active outcome, mark an outcome done (L3
evidence only), or record a human blocker. Every such change goes in
`STATE.decisions` with a reason.

**Selection rules (these counter easy-task bias and code-output bias):**
- The question is about a user/agent scenario and is answerable by
  observation or measurement. "Build X API" is not a question. "Can an agent
  do Y with existing Z?" is.
- Prefer questions that could end with "no new BaroCSS code needed".
- `product_code: true` only when STATE shows (a) the scenario fails with
  existing capabilities (cite K-id), (b) ownership = BAROCSS, (c) the minimum
  gap is stated. A contract adds at most one capability.
- Maintenance (lint, types, docs, refactors) is never selected unless it
  blocks the active question, or CI on `develop` is red.
- Don't repeat an experiment that is already in `knowledge` unless the
  reason to re-verify is written in the contract.
- Read `STATE.human_directives` and follow them.

## 3. EXECUTION

Inputs: the contract plus only the repo context it needs.
Don't read VISION or STATE. Search first, read selectively, stop reading
once you have enough.

1. Check out `branch`, creating it from `origin/develop` if it doesn't exist.
   Set `status: running`, commit, and push, so a crash is visible.
2. Do only `allowed.actions`. Write only to the contract file,
   `.ai/evidence/<id>/` and `allowed.paths`.
3. Collect evidence in the form the contract asks for.
4. Run deterministic verification. If product code changed, run `pnpm check`
   (or the package-scoped `type-check`/`lint`/`test`/`build:library`) and
   record the outcome in `result.checks`. Always run
   `python3 .ai/check.py --role execution --base origin/develop` (add
   `--work <id>` for a work-store contract).
5. Fill in `result` (your proposed verdict) and set `status: done` (or
   `blocked`). Commit as `ai(exec): E-00N <VERDICT> …` and push.
6. Open or update the PR to `develop`, put its URL in `result.pr`, then commit
   and push again. **Do not merge. STOP.**

**Stop as soon as any of these is true:**
- `proves_yes` or `proves_no` evidence is in hand.
- The allowed actions can't answer the question → `INCONCLUSIVE`, and say
  what's missing.
- The budget is used up.
- The next step would touch a `non_goal`, a path outside scope, or need a
  product decision the contract doesn't make.
- Any of the contract's `stop_when` items.

Adjacent discoveries (refactors, APIs, cleanups, interesting directions) go
in `result.side_notes`, one line each. Never pursue them. Edit only `status`
and `result`; the contract is frozen, and `check.py` enforces it.

## 4. Evidence levels

| level | meaning |
|-------|---------|
| L0 | claim or reasoning, no run |
| L1 | observed once by hand, no committed artifact |
| L2 | reproducible: committed script or test plus the command to rerun it |
| L3 | external: the scenario is driven by an actor that wasn't written to produce the expected answer (a real LLM agent using a browser, a real app, a human), with recorded inputs and outputs |

- Engineering claims need L2. Product-value claims ("agents need X", "X makes
  agents succeed") need L3.
- Tests written in the same session as the code count as L2 for correctness,
  never as evidence of value.

## 5. Gates before any new BaroCSS capability

Vision → outcome → real scenario → current evidence → unresolved assumption →
reality check → **existing-capability test** → **ownership check** →
**minimum unique gap** → cheapest valid experiment → evidence → learning → next decision.

- Existing capability: can BaroCSS as it is today, the browser/DOM,
  external agent tooling, the application, an existing library, or a
  composition of these already do it? Try to disprove the gap first.
- Ownership: BAROCSS | BROWSER | AGENT | APP | LIBRARY. BaroCSS owns only what
  only BaroCSS knows or does (class → rule resolution, theme/config
  semantics, generation runtime behavior, provenance of generated CSS …),
  and only when evidence shows it's needed. These are examples, not a backlog.
- Minimum gap: the smallest vertical capability that produces evidence. No
  frameworks, engines, managers, serializers, or abstraction layers on
  speculation.

## 6. Git = durable memory

- Only committed files are memory. Untracked or local notes don't exist for
  the next session.
- Branches are cut from `develop`: `ai/E-00N-<slug>` for execution,
  `ai/strategy-E-00N` for strategy. Commit prefixes are `ai(strategy): …` and
  `ai(exec): E-00N <VERDICT> …`.
- `develop` requires a PR and a green "Test and Build" check, with no human
  approval needed. CI runs `python3 .ai/check.py` for structural validity.
- Who merges: only what Strategy decided. That is a Planner's own
  `.ai/`-only PR once `check.py --role strategy` passes, or an experiment PR
  whose §2A review recorded `merged: true`, plus any human approval that
  `STATE.human_directives` requires. Merging is mechanical once required
  checks pass. The supervisor does it (it refuses a Planner PR with a file
  outside `.ai/`); a Strategy session the supervisor didn't launch does it
  itself. Execution never merges.
- Experiment probes and evidence artifacts live in `.ai/evidence/<exp-id>/`.
  Packages never import them. Every L2 artifact has its rerun command in
  `result.evidence`.
- Product code follows repo rules: a changeset (`.changeset/*.md`, which must
  be in `allowed.paths`), and CI must pass.
- Never do these autonomously: publish or release packages, force-push, or
  rewrite `develop`/`main`.

## 7. Cost

- Strategy reads about 4 small files, plus the PR diff and CI when reviewing.
  Execution reads the contract plus the targeted code.
- Prefer, in order: a deterministic script, test, or CI run → a cheap or local
  model → a stronger model. Execution of a concrete contract suits a cheaper
  model. Strategy needs good judgment but little context.
- When a judgment call isn't settled by the contract, the executor returns
  `INCONCLUSIVE` with the open point. It doesn't guess and doesn't escalate
  in-session.
- Keep `STATE.yaml` under ~150 lines. Strategy compresses old entries, since
  git keeps history. No transcripts, no chain-of-thought, no verbose logs.

## 8. Humans

Humans watch `STATE.yaml` → `now`, `git log --oneline -- .ai`, and `ai/*`
PRs. No human review is needed; Strategy is the reviewer. Humans step in only
to change the Vision, supply missing credentials or permissions, approve
irreversible external actions such as releases, or give explicit directives in
`STATE.human_directives`.
