# D352 independent audit (claude-opus-5-5 sub-agent, 2026-10-30)

Audited the uncommitted D352 tree on base 4c78656bd, read-only. Probes are in [../audit](../audit), run with `node run.mjs <probe>.ts`. Raw outputs were not saved; the numbers below are the auditor's reported observations.

**Verdict: CHANGES_REQUIRED.**

## Holds

- **Accepted definitions:** [fuzz.ts](../audit/fuzz.ts), 4 × 3000 definitions:
  - handle off by more than 1e-9: 0;
  - NaN: 0;
  - fit-point drift: 0;
  - wrong piece counts: 0;
  - post-settle kinks: 0;
  - kernel evaluation: 260 runs ok, 1 failure (F2).
- **Side ids:** [sideids.ts](../audit/sideids.ts): with spline + extrude + fillet on `n1.side[e4]|n1.top`, handle and fit edits keep the side tags and the fillet evaluates.
- **Old documents:** [reopen.ts](../audit/reopen.ts) (a): documents without `spline` round-trip unchanged.
- **Consistency:** `outlineFields`, D349 reopen→Finish and `profileOf` all go through `outlineOf`/`splineMatches`. No chat or agent path writes `outline`. The kernel's ±10000 bound caps the scaled tolerance at 1e-4 mm.
- **Panel flow:** [panelflow.ts](../audit/panelflow.ts) (respline → settle against the settled shape): 900 cases, almost all kept. 5 settle errors relate to F2.

## Findings and root disposition

| # | Severity | Finding | Disposition |
|---|---|---|---|
| F1 | medium | `splineEditError`'s dot rule refused valid handles, including the automatic value itself: 932/3000 star definitions refused, and all 2055 star refusals were actually smooth. Repro: [typing.ts](../audit/typing.ts). | fix round |
| F2 | medium | Accepted edits failed later. Near-straight handles gave R 22500, so the kernel refused "centre within ±10000" ([nearstraight.ts](../audit/nearstraight.ts)). A fit-point edit led to a settle error ([fitedit.ts](../audit/fitedit.ts)). | fix round |
| F3 | medium | A dimension or lock at its measured value kept the spline, and a later handle edit silently deleted the dimension ([dimkeep.ts](../audit/dimkeep.ts)). | fix round |
| F4 | low/medium | The panel applied every keystroke, so some angles (170, −170, 190) could not be typed. | fix round |
| F5 | low | Stale `splineError` after the section unmounts. | fix round |
| F6 | low | SPLINE edits made while drawing were lost (the Viewport re-emits from its ref). | fix round |
| F7 | low | Near-parallel tangents lost precision through catastrophic cancellation in `d`; handles differing by ≤0.01° dropped the spline ([parallel.ts](../audit/parallel.ts), [parallel2.ts](../audit/parallel2.ts)). | fix round (stable form) |
| F8 | low | A malformed stored `spline` threw on reopen ([reopen.ts](../audit/reopen.ts) b–d), and handle marks were drawn for a non-matching spline. | fix round |
| F9 | low | 1/500 closings lost the definition (bulge diff 1.38e-9 > 1e-9) ([closescale.ts](../audit/closescale.ts)). | fix round |

Side note: accepted handles can add a self-crossing the automatic outline lacked (7/3000); this was not verified further.

## Tests (mutation)

- **Caught:** 6 mutants.
- **Survived:** `respline` dropping ids (the side-name test was vacuous), and the removed `carryPolygon`/`roundCorner` deletes (harmless while settle and outlineOf guard).
- **Misleading:** the refusal test's name.
- **Gaps:** the panel flow, near-parallel and near-straight cases.
