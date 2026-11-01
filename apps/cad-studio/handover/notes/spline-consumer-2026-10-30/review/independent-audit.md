# D351 independent audit (claude-opus-5-5 sub-agent, 2026-10-30)

The auditor read and ran the implementation worktree (old HEAD plus the D351 diff). The base was exported from its HEAD. Probes are in [../audit](../audit). Raw outputs were not saved; the numbers below are the auditor's reported observations.

**Verdict: CHANGES_REQUIRED (low).** One claim was false. No regression was found.

## F1 (low, in scope): fit points are not always kept bitwise

At metre scale, measured from `arcOf`'s centre, the unrounded biarc joints still turn by about 1e-9 to 1e-8 rad. The inferred tangent solve therefore takes steps and moves the clicked points slightly. The 1e-6 snap is then refused because the solve took steps.

[repro.ts](../audit/repro.ts):

| Case | Points moved | Max move | Base max move |
|---|---|---|---|
| D: 12 points ≈ 2.5 m | 11/12 | 2.37e-6 mm | 3.84 mm, 5 equal-radius pairs |
| A: 16 points ≈ 200 mm | — | 1.33e-8 mm | 0.174 mm |

Rate: about 2 in 1800 random closed splines ([snap.ts](../audit/snap.ts), seeds 777 and 99). It was 0 of 600 in [fuzz.ts](../audit/fuzz.ts).

**Root disposition:** the claim is narrowed. The clicked points stay bitwise exact whenever the closing solve takes no step, which covers every fuzz case and 1798 of 1800 random cases. Otherwise they move by solver-scale amounts. Case D was added as a test asserting a move of at most 1e-5 mm, a turn of at most 1e-9 rad and no relations. Recording tangents without solving was rejected: the drawn joints at that scale exceed the kernel's own 1e-9 rad tangent tolerance, so the solve is what makes them meet it.

## Fuzz and downstream (auditor's runs)

- [fuzz.ts](../audit/fuzz.ts), N=60, 11 generators: 600 closed and 60 open cases with 3–40 points. The generators covered on- and off-grid points, ±10000 coordinates, tiny shapes, collinear runs and near-duplicates. Results:
  - 0 fit points not bitwise;
  - 0 relations added;
  - 0 `profileOf` failures;
  - 0 settle errors;
  - turns above 1e-9 rad only for near-duplicates (25 of 60). Those turns are already in the raw outline, and 50 of the 60 cases fail kernel evaluation anyway.
- [fuzzraw.ts](../audit/fuzzraw.ts): kernel admission failures on the raw outline were identical on new and base in every category, with base-known reasons (arc centre beyond ±10000, radius < 0.01, self-crossing). Raw turns above 1e-9: new 0, base 60 of 60.
- [snap.ts](../audit/snap.ts): 0 joints re-snapped and 0 turns made worse in 1800 cases. No exact-equality check relied on the old rounding:
  - the snap applies only after a no-step solve;
  - `inferredHV` compares straight spans between fit points;
  - `ringsOverlap` works on samples.
- [scope.ts](../audit/scope.ts): `settleShape` infers only for a just-closed shape, and `App.updateShape` is its only caller.
  - A hand-drawn outline keeps its equal-radius pair; a flagged spline gets none.
  - Dropping the flag in `corner.ts` and `carryPolygon` cannot affect settle.
  - Not storing the flag in the document loses nothing: the stored tangents remain, and reopening does not settle.

## Tests

The new tests passed 10/10 on new and 1/10 on base, failing for the stated reasons. Each half of the change is needed:

- unrounded spline with the base settle: 6 failures;
- flagged settle with the rounded spline: 9 failures.

Weak names: for the open case and for 17 or 20 points, the "points kept / no relations" checks hold trivially (open shapes are not settled; the solver refuses past its size limit), and the scale never reached F1. **Root:** the names were adjusted with a comment, and the 2.5 m case was added.

## Side notes (all present on base too; not D351)

1. The biarc's straight-line fallback can leave a 90° corner (13 points about 3 mm across).
2. Closed splines with 17 or more points get no tangent constraints (the solver's 64-point limit), so a later edit can kink them.
3. One 8-point set gives "would collapse an edge to a point".
4. At model level, an open spline continued with Line and closed moves points 0.83 mm, but the UI cannot reach that path.
