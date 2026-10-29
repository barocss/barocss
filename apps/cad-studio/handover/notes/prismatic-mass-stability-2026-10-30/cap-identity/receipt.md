# D343 cap source identity repair

Source FROZEN; heavy gate RELEASED. Kernel full build PASS, focused8 PASS, related105 PASS, Kernel type-check PASS, narrow ESLint PASS. Root owns the full Kernel run, Model/Studio gates and actual browser run03; these are NOT_RUN by this owner. No commit/push, Model change, mass formula change, schema, dependency, geometry tolerance or slab merge change.

Base3177950c40077de5b91c9965376636769417d830. Owned source/test hashes in owned-sha256.json. The only product change is in src/features/prismatic-solid.ts:267: cap provenance selection now requires cp.z===z instead of Math.abs(cp.z-z)<=tol. The existing region membership predicate and first-containing source order are unchanged.

## Reproduction and authority

Actual run02 accepted recipe replay is baseline.json, its raw authored source is inside that artifact. Public names were[n1.side0,n1.bottom,n1.bottom], while two native cap physical names were n1.bottom#1/#2. Lowlevel-baseline.json independently reconstructs the same source/tool profiles and Boolean; raw retained cap sources are[(.3456789,n1.bottom),(.34567890000000023,n6.bottom)]. The old selector chose the original lower source for the new upper cap because the two stored heights are within geometry tolerance.

The public PrismaticCapSource contract states caps at height z take the source tag. normalize already preserves cap sources only when their exact stored height is a surviving endpoint, and Boolean/transform preserve the source endpoint arithmetic. Provenance therefore follows stored-level identity, not nearby geometry. Same-height overlapping authors keep existing first-containing precedence. A missing exact-level source keeps the existing generated fallback name.

## After and unchanged behavior

After.json replays the original actual recipe against the fixed build. Public names are[n1.side0,n1.bottom,n6.bottom], unique3 logical groups. Four native physical faces remain. Lowlevel-after.json retains the exact two cap source records. geometry-mass-comparison.json confirms: identical solid records, identical lowlevel mass scalars/tensor, identical native B-rep except name fields, identical actual recipe, and identical actual native B-rep except name fields. This is a naming repair; no claim of broader native quadrature accuracy.

The Model nativeOffsetFace helper hash remains2112393a89e38f9ff02e6fc3aaa2be6446e9bca31e87f1b2d4129c83b083c847. Frozen Core mass source remains19ec118c7f6096f738d246e5ca46095b42dd9bf7f67e341bcc6f735690141eac.

## Tests and first failures

New registered test/prismatic-cap-identity.test.mjs covers positive/reflected4ulp levels, small ordinary gaps, ordinary intervals, independent rounded-pi volume guide, strict one solid/closed shell, public native-facing selectors, the actual captured source/tool Boolean, same-level noncontaining-first/first-containing precedence, and nearby-only source fallback. Every test uses owned inputs and verifies no source mutation where applicable.

focused-before.log is the pre-fix1PASS7FAIL capture: close cap identity failures plus a test typo expecting prism.top instead of the existing prismatic.top fallback. build-first.log/focused-first.log used unchanged old product because a package-relative edit failed with FileNotFoundError; first-build-note.md preserves this harness boundary. build-second.log is the actual candidate full build, PASS. focused-second.log3PASS5FAIL was a test-only exact arithmetic assumption: native integrated circle area differs1–2ulp from rounded9*pi. The guide now allows8machine-epsilon relative arithmetic error, without changing geometry or production tolerance. focused-third.log8PASS. related-third.log105PASS across prismatic-solid, prismatic-mass-stability, part-model, api-part and api-query-snapshot. types-third.log/lint-third.log have exit0 and no diagnostics.

No name assertion was removed and no arbitrary force-renaming was introduced. Actual Save/Open references and browser/product proof remain root/Model acceptance work.
