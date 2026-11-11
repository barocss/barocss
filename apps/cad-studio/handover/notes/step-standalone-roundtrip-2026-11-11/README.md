# D691 — Export and reopen a standalone STEP part in Studio

P2 B07, row 13. Parent `6c15c76f34c7ded5c75719de30c1b757803ac818`. SMALL verification-only change. Use the [D404](../exchange-profile-2026-11-01/README.md) 80 × 50 × 10 mm rectangle and extrusion. [D531](../public-step-loss-report-2026-11-05/README.md) retains independent native readback for the earlier public API bytes. D691 verifies the actual Studio-generated file. The product writer, reader and geometry code stay the same.

## Actual desktop Studio

**PASS.** Open the authored box in Chrome WebGPU at 1440 × 900. The STEP panel reports AP214, B-rep geometry and mm. Its loss list matches the real Worker reply and identifies loss of native feature history. The panel also states the profile limits for semantic PMI and named datum systems. The simple box has no such metadata or bound parameter to transfer. [D683](../step-variant-roundtrip-2026-11-11/README.md) covers the selected parameterised assembly loss case separately.

Click Export. The test captures one real `step-part.step` Blob at the local file boundary. All 6,531 bytes match the preview Worker's payload and carry source revision `5fb56d552edc7088`. The original document remains exact after export.

The independent Python readers inspect those bytes. They find 152 entities with resolved references, one AP214 product, one manifold-solid record, one mm length declaration and eight corners within 1e-6 mm of the analytic box. Its bounds are [0, 0, 0] to [80, 50, 10] mm within 1e-7 mm. The checked appearance, assembly and semantic datum entities are absent. The Part 21 reader passes both positive controls and detects all five negative controls for references, duplicate IDs, altered coordinates, unit and schema.

Open the exact captured bytes in a fresh Studio context. The accepted document has one import node with the original STEP text, mm units and no authored sketch or extrusion. Studio reports one solid, 40,000 mm³ and centre of mass [40, 25, 5] mm. Those two quantities match the analytic box within 1e-6 mm³ and 1e-6 mm respectively. The volume and centroid comparison is a Studio self-read against analytic values. The independent readers check the actual exported graph, units and corners.

## Verification

Use Node 22.19.0 and the existing `PW_DIR` and `CHROME`. Run one heavy job at a time through `gate.sh acquire heavy 180 <label>`.

- **PASS.** From Studio run `D691_SOURCE_FROZEN=1 node test/step-shown-variant-browser.mjs "$EVIDENCE" --part-round-trip`. Final receipt SHA-256 `4acd3ab73e61050862ebb6dc00f9176379ff66088abbf02391f8584dff618290`. Actual export and Open SHA-256 `d3ce0e0d94a755a211b63150f5cbae41ef688a11e0d6359fc6850c3543893fa9`. Reviewed both screenshots. All 328 frozen paths matched through cleanup.
- **PASS.** The same driver passes D683's `--round-trip` with `D683_SOURCE_FROZEN=1` and D678's preview mode with `D678_SOURCE_FROZEN=1` and no mode argument. Receipt SHA-256 values are `8297589e47dc3a22dafdbd15a5d2d056c513cb70c6c3427a1c006f1690cfdf86` and `dc445ef878c335d2bc60c2bbf65db693e2bf83b107f3900b17f58b14fb69facf`. Browser downloads, page errors, console errors and watched source changes were zero in all three final runs.
- **PASS.** `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test step-export-preparation step-metadata document-file assembly-linked-faces` passed 31/31. `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test step-profile-losses api-step-report step-units` passed 29/29. Driver syntax, scoped ESLint, Studio and final Model type checks, and Git whitespace passed.
- **FAIL.** None in this scope. **NOT_RUN.** Third-party geometric import of these new bytes, browser-managed download, broader STEP profiles and whole B07. [#2263](https://github.com/barocss/barocss/issues/2263) and [#539](https://github.com/barocss/barocss/issues/539) remain open.

Next D692 reopens the exact root-plate STL produced in [D689](../stl-assembly-loss-2026-11-11/README.md) in a fresh Studio context and checks the explicit millimetre choice, mesh dimensions and omitted Cube.
