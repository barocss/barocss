---
work_id: D658
artifact_type: bounded-product-qualification
status: verified-existing-behavior
last_updated: 2026-11-11
---

# D658 — Verify a lost face on one nested occurrence

P0 automation evidence, rows 04, 12 and 16. SMALL qualification of the existing Studio and local MCP behavior.

Both nested leaves have the same authored definition and feature names after the user approves the original 14 mm → 12 mm width repair. Studio saves the approval evidence. The next native project revision changes only the left sketch from a rectangle to a triangle, which removes `n1.side3` and leaves `n1.side1`. Studio uses the current occurrence's geometry for its new check and continues to show the historical approval against its saved versions.

| Check | Result | Evidence |
| --- | --- | --- |
| Actual desktop Studio | PASS | After project Save and fresh Open, `p1/p1` displayed `WIDTH · Unknown` and named the missing `n1.side3` without a measurement. `p2/p1` still showed 12 mm and Pass. Switching back restored the left diagnosis. The original 14 mm → 12 mm approval remained visible with the same stored evidence and original snapshots. |
| Exact MCP and retained-result freshness | PASS | The old revision pin was refused without an artifact. The current left result was unsupported, with no number or verdict. The current right result passed at 12 mm. Rechecking the older left result found exactly one gone face with no candidate. The older sibling result stayed current. |
| Independent geometry | PASS | The fixture's polygons have areas of 48 and 96 mm². At 4 mm extrusion, native volumes were 192 and 384 mm³. The named side existed only on the right. The original approval file checksum and original passing result matched. |
| Focused checks | PASS | Model 24 and Studio 26 passed, with zero failures or skips. Model TypeScript and the browser driver syntax passed. |
| Paid model, mobile and whole CAD suites | NOT_RUN | The run used desktop Studio and local stdio MCP. |

The existing product satisfied this case. This checkpoint adds the browser regression driver and its independent oracle. The external design revision entered through the normal Studio project Open and version Save controls.

- Use Node 22.19.0. From `apps/cad-studio`, run `D658_SOURCE_FROZEN=1 node test/nested-lost-face-evidence-browser.mjs "$EVIDENCE/desktop"` with `gate.sh acquire heavy 180 d658-desktop` and `gate.sh release heavy`. Receipt SHA-256 `19a090978f1d1ee2452c7bd90efafed321141c538cd8d860d5616155de19666f`. The flow checked 969 source files through cleanup and recorded zero source changes, page errors, console errors or downloads.
- Independent command `python3 -I "$EVIDENCE/desktop/nested-lost-face-evidence-oracle.py" < "$EVIDENCE/desktop/independent-lost-face-oracle-input.json"`. Result SHA-256 `3e92b7f2e9f68e9c7e8ed155d12df7543a15885a86ef76ed3dc96e0893ae93cc`.
- Run `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test team-freshness requirement-evidence approved-version-evidence` and `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test approved-requirement-compare nested-selection version-tools-mcp` from the repository root.
- Run `pnpm --dir packages/barocss-cad-model exec tsc --noEmit`, `node --check apps/cad-studio/test/nested-lost-face-evidence-browser.mjs` and `git diff --check`.

Initial scenario acceptance stays at 4/10 and B09 at 9/9. Whole CAD readiness remains **NOT_MEASURED**. D659 connects the exact current diagnosis to a user-selected Studio chat turn. [#2279](https://github.com/barocss/barocss/issues/2279) remains open.
