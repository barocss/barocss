# D919 — verify the remaining rounded inset refusal cases

2026-11-13 · SMALL · P1 rows 09 and 16 · [#2232](https://github.com/barocss/barocss/issues/2232).

This completes the six-row bounded acceptance in [D918](../rounded-inset-detached-source-lifecycle-2026-11-13/README.md). The admitted workflow is one numeric XY tangent rounded rectangle, one linked inset, and one direct Extrude. The issue's remaining refusals retain the supported part instead of choosing an alternative geometry or reference.

## Verification

- **PASS** Actual Studio File Open refused 15 cases: missing source, self-reference, forward reference, duplicate source ID, compound source, retired arc Chamfer, dependent inset, unsupported arc constraint, zero distance, reversed arc, broken native circle, ambiguous output, concave outline, crossing outline and non-tangent arc. The malformed files retained the accepted document, title, dirty state, body, selection and history.
- **PASS** The Delete key refused removal of the linked solid. The first Redo reached the accepted 2.5 mm sharp state, and Undo returned to the original 1 mm rounded state. Both had exact expected native volumes and side names. Zero and nonfinite distances remain refused by the linked contract, as [D910](../rounded-rectangle-inset-plan-2026-11-13/README.md) verifies at Model. The distinct prior-reader unknown-kind refusal and malformed Project Open evidence are in [D912](../rounded-inset-stored-recipe-2026-11-13/README.md).
- **PASS** The existing planar-face inset tests cover missing, ambiguous and composite face/source binding, as well as ordering. [D868](../associative-inset-open-admission-2026-11-13/README.md) and [D869](../associative-inset-target-delete-2026-11-13/README.md) record actual File/Project refusal and separate target protection. The rounded sketch recipe has no face binding.
- **PASS** 105 Model tests, 119 Studio tests, driver syntax and diff checks. The focused source is the D917 product with browser driver changes only.
- **FAIL** The first observer waited for the generic edit warning while the Model returned the specific Delete refusal. The accepted document was retained and the corrected run matched that refusal.
- **NOT_RUN** Whole suites, mobile, additional dependent features, free-form offsets and damaged-file repair.

All six bounded issue requirements are adjudicated. The evidence maps to coverage and choice, analytic fixture, side identity, direct Extrude and source edit, negative and legacy controls, and detach with independent source editing. The ordinary independent Offset retains its previously measured behavior.

[Commands and receipt hashes](qualification.json).
