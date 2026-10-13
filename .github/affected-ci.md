# Affected workspace CI

Issue [#1933](https://github.com/barocss/barocss/issues/1933), following the timing
and runner-shutdown investigations in #1924 and #1872.

`Test and Build` remains the always-running required aggregate. A failed,
canceled, skipped or missing planner/selected job cannot make it green. Selection
is printed in the plan job summary and retained as a same-run artifact.

- Package-local source/tests select the owner and transitive reverse consumers
  from all four workspace dependency categories. Selected checks keep the exact
  existing `type-check`, `lint` and `test` commands, including nested generation.
- A single topological build produces their forward prerequisites and all four
  packed-release roots. Partial builds are serial; full recursive commands are bounded to two tasks
  by pnpm 9 configuration (verified before execution). Package checks use at most two isolated
  runners. Every process inherits a 2 GiB Node heap and one Rayon thread.
- Plain library-docs Markdown uses the existing example generation, VitePress
  build, docs, CAD impact/evidence and API checks. Both old and new text are
  inspected. Static fences are allowed; frontmatter, HTML/Vue, imports, includes,
  interpolation and unknown containers take the full route. Unknown doc assets
  and scripts also take the full route.
- Shared/root inputs, manifests, configuration/build paths, public index/types/
  codecs and uncertain ownership take the full route. Audited undeclared Kit /
  Browser / Server test imports and CAD-app fixture readers also take it. Unknown
  workspace patterns, cycles, local references and graph changes fail closed.
- Release-target pushes/PRs and manual dispatch always run full regression.
  Full mode retains `pnpm check`, the three Viewer lifecycle checks and every
  root release/export check. The protocol checker runs before every plan.

PR paths are computed from the merge base of trusted event base/head SHAs; the
workspace graph comes from the actual checked-out merge tree and comparison
base. Both event parents must be ancestors of the checkout. Push `before` must
be a real ancestor of the checked-out `after`; unavailable/non-ancestor/forced
history selects full. No event title, branch name or package script string is
interpolated into shell code.

Partial jobs consume a build artifact from this run only. Its manifest binds the
run ID, exact checkout SHA and plan hash, lists every expected nonempty `dist`
directory, and hashes each file. Missing, extra, duplicate, unsafe, symlinked or
corrupt outputs fail before use. Repository-relative layout is preserved.
Package scripts that intentionally regenerate prerequisites continue doing so;
this scope does not remove the CAD interop rebuild or alter package commands.

Run the deterministic planner/aggregate/artifact tests with:
`node --test .github/scripts/affected-ci.test.mjs`.
The initial workflow change takes the full fallback route. A first real CI result
and later package-only jobs are required before claiming measured acceleration.
This reform does not itself diagnose GitHub runner shutdowns or lower physical
browser/device acceptance requirements.

GitHub semantics used: [PR merge checkout and event SHAs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows),
[always-running dependent jobs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs).
