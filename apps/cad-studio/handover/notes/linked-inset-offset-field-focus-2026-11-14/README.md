# D1242 — keep the focused Offset distance visible

2026-11-14 · SMALL · P0 rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

- **FAIL, baseline** At 1024 × 800 with Chat and the overlay Dock open, the focused Offset distance reached Y802 against the Dock bottom at Y800. This occurred in a new linked sketch, after a Dock close and reopen, and in History > Edit sketch after native Save and fresh Open.
- **FAIL, first repair** Scrolling on focus alone did not handle new Linked Inset rows appearing above the field that already held focus.
- **PASS** Reveal the field on focus and after the link changes if the field still holds focus. All three desktop cases placed the field at Y779–797. The stored 2 mm inset and its History instruction remained visible. Enter on ordinary Offset at 3 mm retained focus and kept the document and association unchanged.
- **PASS** Finish, 4 mm New body Extrude, Undo, Redo, native Save and fresh Open retained the exact document. Studio ring volume was 416.0000000000003 mm³ against the rectangular area oracle of 416 mm³. Studio type-check, focused lint, production build, driver syntax and diff checks passed.
- **NOT_RUN** New strict B-rep inspection, assistive technology, mobile and full suites.

## Issue acceptance

| Requirement | Retained evidence |
| --- | --- |
| Show current source and editable scope | [D1212](../linked-inset-extrusion-prerequisite-2026-11-14/README.md), [D1222](../linked-inset-applied-and-draft-distance-2026-11-14/README.md), [D1228](../linked-inset-historical-reference-labels-2026-11-14/README.md) distinguish the current source, historical binding, stored distance and replacement prerequisites. |
| Show refusal reason and first recovery action | [D1220](../linked-inset-replacement-constraints-2026-11-14/README.md) covers Start Z and Move. [D1236](../linked-inset-history-recovery-focus-2026-11-14/README.md) covers closed openings from upstream edits. [D1237](../rounded-inset-authored-width-and-origin-2026-11-14/README.md) covers the round-width boundary. |
| Restore focus on close | [D1217](../linked-inset-delayed-refusal-focus-2026-11-14/README.md) and [D1218](../linked-inset-collapsed-history-focus-2026-11-14/README.md) qualify the recorded review and refusal paths. D1242 adds ordinary Offset field visibility. |

Keep #2481 open pending adjudication of the original whole-source and tilted/free sketch scenarios. Desktop QA checklist was 38/98 (39%) at review. Whole CAD readiness remains **NOT_MEASURED**.

[Commands and receipt hashes](qualification.json).
