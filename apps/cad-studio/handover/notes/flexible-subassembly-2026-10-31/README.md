# D389 — Row 10 ④: flexible sub-assemblies

Tier: **full**, because it adds a document field and changes how sub-assemblies fold: two audit rounds with mutation, and one actual run. RS7.4; owner order "Go to row 10". [Qualification](qualification.json).

## Before

Every occurrence of a sub-assembly was rigid at its saved pose, so two occurrences could not differ.

## Now

**Joint values per occurrence**
- Each occurrence keeps its own values for its sub-assembly's joints (`joints`). The values are offsets from the saved pose.
- The sub-assembly is posed by forward kinematics before it is folded, so two hinges from one definition can stand at 0° and 90°.
- Everything that uses the folded shape sees the pose: the viewport, drawings, STEP and 3MF, clearance, explode, and the parent's mates to `sub1/lid`.
- With no values, or all zero, the occurrence is exactly the saved document, as before.

**Where to set them**
- **Studio:** the Instance panel has a JOINTS (this occurrence) section with Reset.
- **Other entry points:** the API, the facade, and the chat tool `place_part` with `joints`.

**Problems**
- An unknown key, a value past a limit, a non-finite value, or a tree with problems leaves the occurrence rigid and reports why.
- Open refuses malformed values.
- A pattern copy is driven by its seed: its joints are refused, and it copies the seed's.

## Audits ([1](review/audit-round1.md), [2](review/audit-round2.md))

**Round 1.** The pose maths matched independent kinematics to 3e-13. Five defects were found, all fixed:
- joints set on a pattern copy were silently lost;
- Open accepted non-finite values;
- a problem named the wrong occurrence;
- a stale zero key went unreported;
- a code comment was wrong.

**Round 2: ACCEPT.** 623 fixtures open, and all four mutants were killed.

## Verification

- **Tests:** model 2329/2329; Studio 588/588.
- **Actual [run02](run02/receipt.json):**
  1. Hinge 2 was set to 90°, and its lid matches independent rotation while Hinge 1 stays as saved.
  2. Undo, Redo, Save and a fresh Open all kept the pose.
  3. Reset returned it to the saved pose.
  4. The root reviewed the screenshot.

## Follow-ups

- The robot view and `world_bounds` leave out a sub-assembly's nested parts. This predates ④.
- Only the immediate sub-assembly level can be posed.
- Gear pairs inside a sub-assembly are not coupled when it is posed.
