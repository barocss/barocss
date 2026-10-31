# Independent audit round 1 (FULL tier): row 10 ②a nested references (#2180)

**Verdict: CHANGES_REQUIRED**

Probes: p1-mapping, p2-consumers, p3-positional, p4-before (`*.test.ts`); rerun with `node run.mjs <file>`.

## Findings

**H1 (high): the positional form is now accepted, advertised and silently re-aimed.**
- Where: `assembly/faces.ts` tablesFor (host branch) and `chat/assembly.ts:85` (`faces_of: "p1"`).
- tablesFor('p1') now returns the whole folded table, and get_assembly lists the nested faces under their positional names (`n3.top`, …).
- Probe p3 test 2: `addMate({b: {part: 'p1', face: 'n3.bottom'}})` is stored as given. After the earlier nested sibling gains a feature, solveDoc reports no problem, and the sub-assembly moves from z = 5 to z = 15. The mate silently aimed at another face.
- Before this change (probe p4), tableOf of the raw sub-assembly held only the origin planes, so this mate was refused with MATE_FACE_UNKNOWN. The change therefore opens, in the model, chat and facade, the exact fragility it set out to remove.
- Expected: a host-id ref whose `faceOriginOf` path is not empty is converted to `p1/p2` + own name, or refused, naming that form. A saved one becomes a solve problem. The host table and `faces_of` list only the sub-assembly's own faces.

**H2 (high): consumers of `MateRef.part` that still assume a top-level id.**
- `robot/joints.ts:239`: `placed.has(m.a.part)` drops path mates. Probe p2 test 1: joints `[]`, while the equivalent folded-name mate gives prismatic joints. The robot, URDF, poses and the DOF view lose the joint without saying so.
- The same class, found by reading:
  - joints.ts 242–409 (`placed.get(m.x.part)`).
  - `robot/loop.ts:59,129–145`: an identity pose for a path part.
  - `team/rebuild.ts:66–72`: loops grouped by the raw path.
  - `team/assembly.ts:76` declaredContact. Probe p3 test 1 returns null, so the interference check reports PARTS_TOUCH for a mated pair.
  - Studio `MatePanel.tsx:35,92`: `tables.get(path)` is undefined, so the label shows the raw path and the kind switcher shrinks to the current kind.

**M3 (medium): editing a part ignores path mates.**
- Chat `delete_part` (`chat/assembly.ts:165`) keeps path mates as orphans. Probe p2 test 2: m1 survives the deletion of p1.
- `placePart` grounding (`assembly/edit.ts:112`) misses the mate. Probe p2 test 3: no PART_MATED refusal. The mate becomes a "fixed" problem afterwards.
- The chat `place_part` note (`chat/assembly.ts:152`) also misses it.
- Studio's `without` was fixed; these were not.

**M4 (medium): the facade `#end` (`api/assembly.ts:186–197`).**
- Any `/` forces path parsing. A part named `Bracket A/B` (addPart allows that name) can no longer be mated by name: `[PART_UNKNOWN] no part Bracket A` (probe p2 test 4). This is a regression.
- Each segment matches a name or an id, first in array order. In probe p2 test 5, part p1 is named "p2" and p2 is the sub-assembly. `p2/p1` resolves to the plain part and is refused with the misleading "no part p1 inside p1". With a sub-assembly there instead, the wrong part would be mated without a word.
- Expected: the top segment by name only, as `idOf` does; a whole-name match first; an ambiguity refused.

**L5 (low): an instance id containing `/` read from a file.**
- `readStudioDoc` accepts it. Its plain mate now reports "One of its parts was removed." (probe p2 test 6).
- Expected: refuse `/` in instance ids on read, or say why.

## Checked and correct
- **Round trip (p1):** every face and `a|b` edge name comes back to itself. Cases: depth 3, a hidden sibling at depth 2, own nodes first, nextId gaps, a pattern inside the sub-assembly. Folded names equal `placedBase`'s.
- **Geometry and refusals:** depth-3 table geometry is right (z = 50); a hidden depth-2 part is refused; `pat1-1/p2` works as the fixed side (z = 20).
- **Hole callout owner:** on real nested silhouette edges it gives `p1/p2/n2`, as the top-level baseline does. Both give null on `x|y` edges; that predates this change.
- **Names:** top-level and base drawing names are unchanged; the pattern scan uses hostOf; refusals are typed, in plain words.

## What I ran
The four probes; `node scripts/test.mjs nested-references` (11/11 pass); `tsc --noEmit` on cad-model (no errors). Studio was read only, no browser.
