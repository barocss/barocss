# BaroCSS Work collaboration

Current development has two active roles: Planner and Execute. Existing Review is inactive;
its history and worktrees remain preserved. No automatic call or approval/wait dependency on Review.

Planner owns GitHub Issues, Wiki, Discussions, priorities and prepared scope/acceptance/tests.
Execute independently claims the highest-priority ready Issue, implements, verifies, commits,
merges locally as sole serial integrator, records completion and takes the next Issue.
Normal progress requires no role-to-role question, assignment or approval wait. Durable Issue bodies
and results carry routine coordination. Message only when a real scope/product decision, ownership
conflict, missing permission or unresolved safety failure blocks work; include Issue, evidence,
impact and the smallest decision needed. Continue safe independent work where possible.

Public API/CSS semantics and other consequential changes retain compatibility rationale and exact
commit/test evidence; they do not restore Review as an always-on role. Existing deterministic tests,
package guards and runtime fuzz remain mandatory according to affected scope.

Development/checkpoints stay in local git with commits and branch merges until final release.
Planner consolidates one release Issue with scope, completion conditions and candidate validation;
when ready, it records one handoff to existing Release Work 01a0f29f-0a94-751c-b710-7ec88d91c00a.
Release owns existing protected PRs/Actions; no bypass of branch protections. Its approved 0.12.2
work is already active and must not be interrupted, edited or dispatched again.

Keep GitHub/code/inter-Work records in English and user communication in Korean. Preserve automatic
approval rejections; never route a denied action through another Work. Private security repros and
unapproved launch material remain private. Paid experiments/new downloads still follow owner
authorization. Never kill another session's processes or restart the paused Claude supervisor.
