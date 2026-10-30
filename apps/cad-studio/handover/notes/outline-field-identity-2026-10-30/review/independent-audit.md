# D348 independent audit (claude-opus-5-5 sub-agent, 2026-10-30)

Scope given: the fixed `outlineFields.ts` `set` and the new Model test, read and run in the implementation worktree; base comparisons on a scratch copy of the fixed `src` with only `set` reverted (the base worktree received the fix mid-audit, so later base comparisons did not use it). Probes are kept in [../audit](../audit); their raw outputs were not saved, and the numbers below are the auditor's reported observations.

**Verdict: PASS**, with one pre-existing consumer limitation and one weak test name.

## Findings

- **F1 (low–medium, pre-existing, consumer scope).** For a new sketch, Finish orders loops `[...done, shape]`, so a loop drawn before an outline that carries an attached circle is stored before that circle (`holes: [triangle, circle]`). The field edit rebuilds with `profileOf([outline, ...done])`, which places attached circles first, so the holes return as `[circle, triangle]`. Tagged nodes are unaffected (ids travel with loops; [p4-order-tagged.ts](../audit/p4-order-tagged.ts): volume 16376.7567 → 16976.7567, fillet resolves). A node without `sideTags` (pre-R10a positional names) breaks: fillet `n1.hole0.side0|n1.hole0.side1` after len0 60→62 fails with "The selected edge no longer exists" ([p2-loop-order.ts](../audit/p2-loop-order.ts), [p2b-silent.ts](../audit/p2b-silent.ts)). Loud refusal, not a silent wrong edge; the unfixed code fails identically.
  **Root disposition:** retained as a recorded limit. Documents track the latest schema (no legacy migration); the source comment and test 4's name were narrowed so they no longer claim that positional names stay valid in every layout.
- **F2 (low).** Test 4's name claimed positional names stay valid, but it only asserted that no `sideTags` were gained. Test 1 checked `suppressed`/`id` but not `held`/`bought`/`rematched`/`sigs`. **Root disposition:** test 4 renamed; test 1 now also asserts `held`, `bought`, `rematched` and `sigs` survive.

## Checked and fine (auditor's runs)

- Composition ([p3-misc.ts](../audit/p3-misc.ts)): kind, profile, sideTags, id, suppressed, rematched, sigs, held, bought, on and plane are kept; no new keys or stale holes/regions. `association` is not carried (linked sketches store no outline, so no outline fields).
- No conversion to `profile:'rectangle'` (fromRectangle is not stored in the outline), same as reopen→Finish.
- Construction ids that collide with loop ids, or are missing, leave sideTags and construction unchanged.
- A mismatched shorter `sideTags.outer` gets fresh outer ids and keeps hole ids (same as the reopen path).
- Parameters: get/set work under params; `param()`/`bind()` return null for these multi-leaf fields; unchanged by the fix.
- Downstream across dimension kinds ([p1-downstream.ts](../audit/p1-downstream.ts)): a fillet on side edges plus 23 edits (len, rad, dist, dx, dy, ang, cdx, cdy, cdist, cedge, ccdx, ccdy, cdia; polygon and loop; attached-circle holes): fixed 0 failures (id n0, sideTags identical); unfixed 23 failures (id dropped).
- New tests against the unfixed `set`: 1 pass / 4 fail for the stated reasons (id dropped; renumbered `side[e11]`; outer tags e9…; sideTags gained). Test 5 passes on both by design.

## Side notes (outside D348)

- S1 (code reading only, L0): Studio reopen→Finish (`useSketchActions.ts` Finish) copies only `id` onto the rebuilt node: it may drop suppressed/rematched/sigs/held/bought, and `on` for a non-associative sketch drawn on a body.
- S2: the associative inset path (`engine/part.ts`) copies extras explicitly; fine.
- S3: if another region was drawn before the constrained outline, the outline is not the main profile; its constraints are not stored and no outline fields appear.

## Commands the auditor reported

Fixed tree, Model: `node scripts/test.mjs sketch-outline-field-identity` 5/5; `editFields fields.test` 6/6; `TEST_CONCURRENCY=4 node scripts/test.mjs sketch-` 24/24. Studio `constraints.test` 24/24. Scoped `tsc` on the two files: no errors.
