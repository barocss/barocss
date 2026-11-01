# D384 — Row 10 ②a: stable references to parts inside sub-assemblies

Tier: **full**, because it changes reference semantics and the public API: three audit rounds with mutation, and one actual run. Owner order "Go to row 10", 2026-10-31. Issues: #2180; epic #538 stays open. [Qualification](qualification.json).

## The defect

Folding a sub-assembly renumbers its nested parts' features by position. In the run below, Block B's `n1.top` became `n3.top`, then `n4.top` once an earlier sibling gained a feature.

Studio mates and drawing names kept those positional names. So editing, hiding or reordering an earlier sibling silently broke them, or aimed them at another face.

The model API did not fold sub-assemblies at all, so it could not see nested faces.

## The fix

- **Paths.** A part inside a sub-assembly is named by its path (`sub1/p2`) and its own face names. Mates and drawings use that form, and so do the agent tools, the facade and Studio picks.
- **Name mapping.** It comes from the same plan the fold uses, so the two cannot drift apart.
- **Unresolvable references.** A reference that no longer resolves is refused or reported with words that ask for the face to be picked again. It is never re-aimed.
- **Assembly code.** Robot joints, loops, contact and the Mates panel look parts up by the host instance. The panel shows "Sub › Block B · Top face".

## Audits ([1](review/audit-round1.md), [2](review/audit-round2.md), [3](review/audit-round3.md))

**Round 1** found two high-severity defects:
- the change itself let the model, chat and facade store fragile folded names;
- several consumers ignored path mates.

It also found two medium and one low defect. All were fixed with tests.

**Round 2** found one high defect: editing a stored mate re-aimed it. It was fixed. Plain assemblies' robot and URDF outputs were byte-identical to HEAD, and six mutants were killed.

**Round 3**, a targeted re-check, returned ACCEPT.

## Verification

- **Tests:** model 2299/2299 (nested references 20/20); Studio 572/572. Type checks and the docs tables pass.
- **Actual run, [run04](run04/receipt.json):**
  1. A Studio pick inside the sub-assembly was stored by its path.
  2. A new revision moved the folded name and raised Block B. The mate was not re-aimed, and Pin followed to z 15.
  3. Undo, Redo, Save and a fresh Open all kept that.
  4. The independent oracle passed at each step.

## Limits

- A nested part's own origin planes are not mateable by path.
- In Studio's linked readFaces mode, path tables are empty.
- The BOM does not yet descend into sub-assemblies: that is ②b.
- Nested selection and path display are ②c.
- CI and release NOT_RUN.
