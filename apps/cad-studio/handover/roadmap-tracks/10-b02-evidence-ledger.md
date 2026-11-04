# B02 v1 — Parametric enclosure with a mounting rail

[Baseline](04-product-baseline.md) · [P1 queue](02-core-workflows.md) · [D539 record](../notes/parametric-enclosure-2026-11-05/README.md)

**Status: accepted11/11 scoped groups at D539.** Three actual creation bindings from Studio01 join nine remaining bindings from Studio02 after a reproduced Edges-filter fix. Preserve the original first selection FAIL; this is not one uninterrupted all-PASS run or general enclosure acceptance. The input and eleven-group matrix below were frozen before execution.

## Input and declared intent

Use the actual D449 Shell input `/tmp/barocss-d449-category-run01/shell-edited.bcad`,582 bytes,SHA-25617351eb2ad01ffbafcf9c76d21e2da5030b794600ca80a55a41a0928fdbaf6c9. The constrained stock is[-20,-20]..[60,20], Extrude10, Shell Wall3, parentn1 and openingn1.top. Set Wall3→2 through the existing public field as necessary setup. This does not claim a new Shell authoring run.

Candidate composition, all upright:

- True Shell of outer width W, depth40 and height10, openingn1.top, wall t.
- Public Box rail[0,-3,1]..[30,3,6], then explicit Union with the Shell. Box inherently creates a new body; it has no New/Operation selector.
- Through Hole on the actual captured positive-Z rail top, radius1, initial center[5,0], row count3 and step[10,0]. The centers5/15/25 lie in real material. Model Hole row is the pattern; a Linear CUT feature pattern on a Hole is unsupported and is not substituted.
- Four original outer vertical corners receive R1 last. Use actual confirmed native names/signatures; never invent a picked face or ordinal alias.

The rail's top stays at absolute Z6. Its free height6−t deliberately changes when the floor grows. Rail/floor overlap is180mm³ at t2 and360mm³ at t3, so neither join is contact-only. All rail and Hole locations stay fixed while the outer width grows; they remain clear of the cavity walls. This is declared mounting-height intent, not an implicit constant height above the floor.

Selected positive states: A(W80,t2,count3), B(W90,t2,count3), C(W90,t3,count3), D(W90,t3,count2). This is not every Cartesian combination. D follows a post-Open Copies3→2 edit and keeps the first two original centers5/15. All nine controlled admission rows and eight independent positive-state checks pass. All twelve joined actual consumer bindings pass at their recorded source scopes.

## Eleven accepted action groups

| ID | Required result | Existing evidence / current gap |
| --- | --- | --- |
| B02-01 | Retain the true Shell, open top, source dimensions, wall authority and editable ancestry. | PASS: exact D449 input and public Wall setup retained; D539 composed Width/Wall and native opening checks. |
| B02-02 | Public Box rail and real ordered body picks produce a positively overlapping Union. | PASS: Studio01 public Box and ordered real Union; two outputs before Union, one after; positive overlap and actual `.made` retained. |
| B02-03 | Actual rail-top pick produces the declared Through Hole row in real material. | PASS: Studio01 real rail-top pick and row creation; current native/Worker/Python source and bore boundaries agree. |
| B02-04 | Four original outer vertical R1 Fillets retain the opening, rail and Hole row. | PASS after repair: original Edges-filter vertex override FAIL retained; Studio02 repeats identical world/pixel/eye, picks all four edges and Applies R1. |
| B02-05 | Source Width80→90 regenerates the whole enclosure and retains intended references. | PASS: Studio02 Width80→90, exact downstream ancestry and independent B quantities. |
| B02-06 | Wall2→3 regenerates shared floor/void and retains positive rail attachment and all bores. | PASS: Studio02 Wall2→3, shared floor/cavity/overlap and bore boundaries independently agree. |
| B02-07 | Independent dimensions/mass/native boundaries agree with actual source, current Worker and stable ownership. | PASS: eight preserved controlled native states and twelve fresh actual Worker/Python joins; original graph/trim/carrier/rational/finite-pcurve checks, unchanged budgets. |
| B02-08 | Source Width4 at Wall3 refuses because Shell leaves no hollow, retaining accepted Doc/body/history. | PASS: actual NodeEditor Width4 Apply; Worker PARAMETER and friendly reason, accepted Doc/body/history exact. Separate exact rejected evaluationDoc native read identifies n2. |
| B02-09 | Close the refused editor, then FIRST document Undo reaches B; Redo restores C exactly. | PASS: close refused NodeEditor, FIRST document Undo reaches exact B, Redo restores exact C. |
| B02-10 | Own project Save/Close/reload/fresh Open restores exact C and editable references. | PASS: own UUID project Save C, Close/same-context reload/Open exact C. Namespace removed/absent; cold process remains NOT_RUN. |
| B02-11 | Post-Open Hole Copies3→2 changes only intended pattern state, retaining downstream finish and source intent. | PASS: post-Open Copies3→2 preserves rail provenance, downstream finish and first two centers; final D is dirty, not resaved. |

B02 v1 is accepted11/11 at this declared profile. These groups do not add eleven equal units to a whole-CAD denominator. B01 v1 remains accepted12/12; B03–B10 remain unadjudicated and whole CAD/core NOT_MEASURED. No aggregate baseline percentage is published.

## Admission and observed current consumer sequence

First perform controlled NON_UI admission. Author typed recipe geometry without .made, capture every raw Doc and every original native output before assertions, and confirm the actual rail face/corner identities before using them. Actual public Box later produces its own .made metadata. Keep both source Docs as returned; do not remove or fabricate producer provenance to force equality.

Native stages: known Shell setup, separate rail, Union, Hole row, finished A; then B/C/D and invalid Width4. Stop at the first failed stage. A mesh fallback or typed unsupported composition does not count as genuine native BRep support. No geometry, tolerance or profile substitution is authorized by a failed candidate.

Only after native admission, root actual Studio creates the rail/Union/Hole/finish on this same Shell, edits Width then Wall, checks collapse retention/FIRST Undo/Redo, Saves/Opens and changes Copies. Twelve final/creation consumer bindings are observed: rail-new(2 outputs), Union, Hole row, finish A, B, C, refusal-retained C, Undo B, Redo C, Save C, Open C, post-Open D. Observed: three prefix bindings plus nine remaining bindings; seven positive native captures and five exact whole-Doc native reuses. Setup Shell and continuation Open are antecedents. Run01 has fifteen snapshots; Run02 has twenty-four. See the decision for exact source/custody boundaries.

## Independent physical expectations

These formulas apply only after validating the actual source and admitted material boundaries. Let n be the row count and r=1:

`Vc=(W−2t)(40−2t)(10−t)`

`S=400W−Vc`, `R=180(6−t)`, `F=10(4−π)`, `Q=6nπr²`

`V=S+R−F−Q`

`Mx=(W/2−20)(S−F)+15R−6πr² Σ(i=0..n−1)(5+10i)`

`My=0`

`Mz=2000W−Vc(10+t)/2+R(t+6)/2−5F−3Q`

Centroid is M/V, density1 mass is V/1000g, and bounds are[-20,-20,0]..[W−20,20,10]. Expected genus after the through bores is n; the open-top Shell itself is a closed material body of genus0. Validate the original cavity, rail ledge Z6, bore rims Z0/Z6 and four R1 corner carriers. Untrimmed carrier poles are not material bounds.

Existing native relative-volume1e-9 and absolute centroid/bounds/boundary1e-9mm budgets remain. Source constraints use their existing separate budgets. Finite rational/trim witnesses are not full-domain or general periodic proofs. These original graphs contain pcurves and pass finite lift checks (maximum1.464821375527116e-14mm). Optional absence in another case must be reported as unexercised, not zero-error UV qualification.

## Alternatives and limits

The existing built-in enclosure-base has genuine shared wall expressions, but no current Studio L/W/w editor was found. Its lip also uses a contact-only join and it lacks the composite rail/Hole/finish. It is authored context, not a substitute for the selected true-Shell lifecycle. No library UI work or new downloaded catalog is introduced.

D453 body patterns, D498/D500 Hole branches, D533 Hole+Chamfer and D534 Difference CUT patterns remain their own documents. They cannot be stitched into one accepted enclosure. Preserve D501's earlier custody/runner failures. All fitter/public-thicken/#2266, manufacturing, nonzero-cone, UI redesign, Physics/Motion, schema migration, download, paid-live and release gates remain.
