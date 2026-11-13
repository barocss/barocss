# D917 — edit a linked rounded inset source width

2026-11-13 · FULL · P1 rows 09 and 16 · [#2232](https://github.com/barocss/barocss/issues/2232) remains open pending its lifecycle audit.

The direct Extrude editor exposes the source width. The width edit moves the right support and the two right arc centers. It preserves the source radius, left and Y supports, authored indices, constraint values, side tags, inset recipe, Extrude and canonical output. The native candidate check runs before the new document is installed.

## Verification

- **PASS** Desktop Studio drew and rounded the source, created the linked extrusion and changed the source width from 20 to 24 mm at 2.5 mm inset. The accepted solid has R2 outer arcs and a 19 × 5 mm opening. The right cylinder axes are at (22, 2) and (22, 8) mm; the left axes stay at (2, 2) and (2, 8) mm. The eight opening vertices matched the independent cap coordinates. Measured native volumes were 1215.6637061435915 and 1415.6637061435924 mm³. Both agree with the independent values within 1e-7 mm³.
- **PASS** Width 5 mm retains a valid source outline but closes the opening. Studio refused it and preserved the accepted document, body, selection, history, dirty state and available Redo. Undo, Redo, Save, fresh File Open and a second width edit back to 20 mm restored the exact expected documents. Distance edit and detach regressions passed.
- **PASS** 105 Model tests, 119 Studio tests, both type checks, Studio build, scoped lint, driver syntax and diff checks. Model controls cover line-first and arc-first source sequences. Independent geometry review covered the arc and cap witnesses. Eight mutation control tests passed and detected five stored-recipe omissions.
- **FAIL** The first Model type check found that the new test assumed an ID on the general sketch type. The corrected test checks ID presence before comparing its value. Whole-file App lint reports the same preexisting unused `_k` diagnostic as the parent.
- **NOT_RUN** Linked radius or height editing, post-detach source edit in Studio, new dependent features, whole suites and mobile.

[Commands and receipt hashes](qualification.json).
