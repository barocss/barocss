# D757 — Preview a replacement edge for an unresolved drawing dimension

P0, rows 11 and 16. FEATURE qualification. Parent `8ef00d6a6dca8d9de8b98d7839f01310972226ce`. [#2311](https://github.com/barocss/barocss/issues/2311).

Show dimension still requires one resolved display value. Preview candidate draws only the visible pieces of one uniquely named edge in the current projection. The existing status includes the candidate number, view and original failure reason. Preview is bound to the current document, drawing workspace and sheet. Escape, a sheet switch or collapsing the Browser retires the preview. Use candidate remains the existing explicit reference edit.

## Qualification

- **FAIL (parent)** — Two real 40 × 30 × 20 mm bodies expose current Top lines at Y10 and Y20. The stored endpoint originally lay at Y15. The existing matcher offers `n3.side2|n3.top` and `n5.side0|n5.top`. The native dimension is unresolved and Studio refuses Candidate 1 and shows no overlay at the old early return. Two baseline WebGPU desktop states across 872 frozen files. Fixture SHA-256 `ded2040a6a16b2dfccf546d67a16a4d21e803aec2f66b69efb6bc8654a9bfa1d`.
- **PASS** — Both actual candidate lines match the corresponding nominal projected endpoints within 0.01 client px. The inspection keeps the original lost endpoint, signature, reference problem, exact document, dirty state and history. Escape, Browser collapse and Model preview retire the drawing overlay. Model preview selects one displayed edge. Use candidate 2 replaces the reference and resolves the actual 30 mm dimension. Undo and Redo restore exact documents. Local-project Save, Close, reload and Open restore the accepted drawing and dimension. Saved SHA-256 `5b926f402a986a37945b29381f0ec8b3a9d7167536d31945948dc64aa38109ca`.
- **PASS** — A held real successful Worker projection shows the busy refusal with no overlay. Sheet changes retire the pending and settled previews. A later Open retires the old overlay. Shared dimension ID across two sheets and hidden view each give a specific refusal. Show dimension still highlights the resolved marked 40 mm dimension. Ten fixed WebGPU desktop states across 873 frozen files. No browser errors or downloads.
- **PASS** — Model 49/49 and Studio 30/30. Focused projection checks verify missing names, multiple same-name edges, empty pieces, all-hidden pieces and mixed visibility. Both type checks, affected lint, driver syntax, production build and diff check pass.
- **FAIL (driver only)** — The first fixed browser run treated a straight horizontal SVG group as visible for Playwright. The next read the Model selection from the wrapper instead of its selection field. Both observations and the subsequent exact-coordinate and Model selection proofs remain retained.
- **NOT_RUN** — Full suites, mobile, and browser reproduction of malformed projected-edge lists. The last boundary has focused source tests. No reference matcher, geometry or file-schema change.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D757_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-reference-candidate-browser.mjs "$EVIDENCE/baseline" --baseline
D757_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-reference-candidate-browser.mjs "$EVIDENCE/studio-final"
D757_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-reference-candidate-browser.mjs "$EVIDENCE/guards-final" --guards
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test references.test drawing-current-contract drawing-issues
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test drawing-reference-candidate drawing-commit-roundtrip document-file stop-work-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint apps/cad-studio/src/App.tsx apps/cad-studio/src/ui/{DrawingWorkspace,ReferenceDecisions}.tsx apps/cad-studio/src/ui/drawing/referenceCandidate.ts apps/cad-studio/test/drawing-reference-candidate.test.ts
node --check apps/cad-studio/test/drawing-reference-candidate-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D758 defines the finite B05 static assembly evidence matrix and runs the first current Studio placement and linked-definition check. Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
