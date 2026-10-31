# Independent audit, round 1, FULL tier: instance looks (roadmap 10 ①, #2233)

Verdict: **CHANGES_REQUIRED**

Probes are in this folder: probe.test.ts (13 tests) and probe2.test.ts (2 tests). They are bundled with `node build.mjs <ts> <mjs>` and run with `node --test` under the gate. The raw output is in probe.out and probe2.out. The implementer's tests also pass: cad-model instance-looks 16/16 and cad-studio instance-looks 9/9.

## Findings

1. **HIGH: a material override is not seen by result freshness.** At `team/freshness.ts:61-63`, `partMaterial` digests `materialInput(i.doc)` and ignores `i.looks`. A BOM result taken before p2 is set to steel still reads `current` afterwards, even though the BOM total mass changed. Probe M1: expected `stale`, actual `current`.
2. **HIGH: the team bundle mass disagrees with the BOM.** `massResult(doc, …, 'p2')` reads `partDoc`, which is `i.doc` (`freshness.ts:92,225`). For p2 it gives 5.4 g (aluminium). The BOM line for p2 gives 15.7 g (steel). Probe M2. `standardResults` in the bundle uses this mass. `materialsOf` (`team/bundle.ts:40-46`) lists p2's material as null (default) instead of steel (probe M3).
3. **HIGH: robot inertia and masses ignore the override.** `robot/verbs.ts:52-54 partsOf` and `apps/cad-studio/src/robot/useRobotExports.ts:47-76` pass `i.doc` to `treeInertia`, `linkMasses`, URDF and MJCF. The p2 link mass is 0.0054 kg; with steel it should be 0.0157 kg (probe M4). `team/parts.ts:83` (per-part OVER_BUDGET) also reads `inst.doc`.
4. **MEDIUM: a split side that vanishes in a revision is never held.** `looks.ts:141-146 keyExists` checks only that node n<serial> exists. It ignores the side and whether a body still has that key. The part was split, so b1_negative had an override. The revision removes the split. The result: `offered.held = []` and `heldLooks = []`, and the override silently applies to nothing (probe R1).
5. **MEDIUM: a merge re-aims an override.** The revision adds `union(left n3, right n1)`, so one body takes key b3. b1's override is not held (n1 still exists), and b3's brass now covers b1's former 2000 mm³ as well. The BOM mass is 21.25 g; the old split was 9.65 g aluminium plus brass. The person is not told (probe R2). A fix would check each key against the keys the revision's evaluation actually produces, which needs an evaluation in `offerRevision` and `acceptRevision`.
6. **MEDIUM: nested face colours do not reach the folded mesh.** `lookTargetsOf` (`looks.ts:109-118`) maps the body key back to the nested part, but face names are left as the part's own (`n1.side0`). The folded mesh of the second nested part names its faces `n3.side0…`. So these face colours never paint on WebGPU (`instanceLook.ts:31-36 faceColorsOfMesh`) or in 3MF (`export3mf.ts:46-48`). This covers the definition's face colours and the occurrence's own. Probe P1, nested p2. It works only for the first nested part, whose shift is 0.
7. **LOW: Open is looser than set_part_look.** `migrate.ts:176` accepts unknown look fields (`{colour: …}`, probe V1) and unknown material ids (probe V2). For `unobtainium` the BOM then shows material "unobtainium" at the default density, 5.4 g (probe V4). `checked()` refuses both cases.
8. **LOW: face colours accept any face name.** `setInstanceLook` takes `faces: {'n9.nowhere': …}` without a check (probe P2), while an unknown body key is refused.
9. **LOW (WebGL2): hidden bodies still show section hatch and thread rings.** At `renderer.ts:996`, the hatch loop and thread rings skip no hidden body. On WebGPU, `it.threads.visible` likewise ignores hidden bodies.

## Checked and found sound

- An override survives `acceptRevision`, `makeIndependent` and dismiss.
- Pattern copies take the seed's overrides and refuse their own (PATTERN_DRIVEN).
- Provenance is tracked per field and per face, and resetting one field works.
- A nested part's saved overrides read as "definition", and Reset is not offered for them. This is consistent; a "sub-assembly" label would be clearer but is not a defect.
- For documents without looks, 3MF output through the Studio path is byte-identical, including nested-mate (probe M5). `bomViewOf` and `checkAssembly` return the very same doc.
- In the BOM, a material override splits lines, and colour or hidden overrides do not.
- WebGL2 skips hidden bodies in surface, edge, silhouette, face pick and edge pick, and has no per-frame allocation (a uniform per draw).
- WebGPU makes a hidden surface `visible = false` and `pickable = false`. Caps and casters filter on `visible`, and capPick filters on `pickable`.
- In `bindShares`, a copy with a different colour or with face colours gets a private copy. When the colour goes back, it shares again and the private geometry is disposed. Copies with the same non-first colour do not share with each other: one geometry per copy, which is acceptable.
- A render appearance still wins over the occurrence's colour.
- WebGL2 having no face colours is an acceptable stated limit.
- Hidden bodies are still counted in clearance, which is acceptable: hidden only changes the display.
