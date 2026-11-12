# D770 — Qualify Studio geometry and selection after a same-body edit

P4 B10-01, rows 05, 16, 20 and 32. SMALL qualification. Parent `fa35be1e22d8857cb91de7325110cc0abbf30bfa`. [B10 v1 evidence ledger](../../roadmap-tracks/17-b10-evidence-ledger.md) · [D524 cache repair](../gpu-mesh-input-ownership-2026-11-05/README.md).

- Freeze seven B10 groups for desktop Studio, the existing Viewer facade and CAD React. B03 positive tapped data and B06 PDF remain held. Select the first available B10 group under P4.
- **PASS** — Actual Studio creates a 64 × 32 × 8 mm box and edits its Extrude to 12 mm. The logical body key stays the same. The input vertices and prepared surface change. Actual public pointer picks select the current body, face and straight edge. Undo and Redo restore the matching native input and clear removes selection. Reviewed the selected 64 mm edge in Studio.
- **PASS** — Four independent Python checks compare the full input/prepared bounds and current Worker volume to the rectangular solid formula. Volumes are 16,384 and 24,576 mm³. The relative volume limit is 1e-9. There are nine desktop states, seven observed `setBodies` calls, 40 vertex/index uploads and 335 frozen files. Zero page errors, console errors or downloads. The selected profile has no observed signature collision.
- **PASS** — Studio 47/47 focused checks, Model type check, driver syntax and diff check.
- **FAIL** — None in this run.
- **NOT_RUN** — GPU readback, broader native signature-collision reachability, curved edges, clipping, Viewer facade and CAD React groups, full suites, builds and mobile.

```sh
D524_SOURCE_FROZEN=1 node apps/cad-studio/test/mesh-reuse-current-studio-browser.mjs "$EVIDENCE/studio-first"
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test mesh-reuse-ownership instance-pose selection-edge
pnpm --dir packages/barocss-cad-model type-check
node --check apps/cad-studio/test/mesh-reuse-current-studio-browser.mjs
git diff --check
```

B10 has 1/7 current groups. Initial scenarios remain 7/10. Whole CAD and core readiness remain **NOT_MEASURED**. D771 checks a public Viewer same-ID native source replacement and its current frame, pick and selection.
