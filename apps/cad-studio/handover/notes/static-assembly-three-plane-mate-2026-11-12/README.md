# D759 — Verify the three-plane linked assembly mate

P3 B05-03, rows 10, 12 and 16. SMALL qualification. Parent `ee6a5cfec39786d7bbc1da4d725070907c6bf88b`. [B05 v1 evidence ledger](../../roadmap-tracks/15-b05-evidence-ledger.md) · [D493 retained case](../fully-constrained-mate-workflow-2026-11-04/README.md).

Use D758's two linked 30 × 12 mm rectangular extrusions. Ground the first occurrence at [20, 0, 0]. The current desktop flow uses the native face picker and public origin-plane choices.

## Qualification

- **PASS — Three public Coincident mates.** `inst1/n1.top` to `inst2/n1.bottom` places the copy at [75, 20, 6] mm with two slides and one turn. The XZ planes bring it to [75, 0, 6] mm with one slide. The YZ planes bring it to [20, 0, 6] mm, fully placed. The rotation stays [0, 0, 0].
- **PASS — Conflicting distance.** Adding a 3 mm Distance on the same native faces is refused. The existing status names Coincident 1, 2 and 3 and the 3 mm residual. The exact accepted document, pose, dirty state and Undo/Redo controls stay at the prior state. Cancel restores the fully placed controls.
- **PASS — Linked revision and persistence.** Public source depth changes from 6 to 8 mm. A pending Rev B keeps both accepted Rev A geometries and Z6. Accept retains the three exact mate records and grounds the same instance. The copy moves to [20, 0, 8] mm and stays fully placed. First Undo restores Rev A, Z6 and the waiting offer. Redo restores Rev B and Z8. Local-project Save, Close, reload and Open retain the exact accepted document and full placement.
- **PASS — Native and viewport checks.** Eight independent Python bindings check source volumes of 2160 or 2880 mm³, local centroids, current world bounds, exact native mate endpoints and required coplanar offsets. Relative volume and absolute coordinate limits are 1e-9. Ten WebGPU desktop states across 797 frozen files. No page errors, console errors or downloads. The mated assembly SHA-256 is `6bc6255c90e598e437c1263e91b6b72b1c611be7485442fe2dda064a96d91faf` at Rev A and `33ea3e5095a0fcf361e2f0a77a16117b8c360d006cce7620331960ef3b595335` at Rev B.
- **PASS** — Model 23/23 and Studio 19/19 focused tests, driver syntax and diff check. D758 also passes seven current desktop states after the shared driver change.
- **FAIL** — None observed.
- **NOT_RUN** — Full suites, build and type checks, mobile, arbitrary rotated mates, collision certification, Motion and Physics. Product code is unchanged.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D759_SOURCE_FROZEN=1 node apps/cad-studio/test/static-assembly-linked-placement-browser.mjs "$EVIDENCE/studio" --planar
D758_SOURCE_FROZEN=1 node apps/cad-studio/test/static-assembly-linked-placement-browser.mjs "$EVIDENCE/d758-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test mates.test definitions.test
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test storage.test assembly-linked-faces mate-pattern-commit.test
node --check apps/cad-studio/test/static-assembly-linked-placement-browser.mjs
git diff --check
```

B05 v1 is pending at 3/7 current groups. Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**. [#538](https://github.com/barocss/barocss/issues/538) remains open. Next D760 verifies the ordinary concentric and distance mate lifecycle from D458.
