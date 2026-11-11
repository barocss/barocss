# D720 — Keep section planes inside thin model spans

P0, rows 16 and 20. FEATURE qualification for desktop Studio. Parent `679dcee9726277709da23f928b9ee3dd74944449`. [#2407](https://github.com/barocss/barocss/issues/2407).

On the parent, the toolbar's Y section, a Z axis section and the third cut-out plane used `0 mm` for a native `0.1–0.3 mm` span. A top-face section started correctly at physical Z `0.2 mm`, kept the negative side and displayed a 24 mm³ half. The drag's inverted range moved it to physical Z `-0.2 mm`. Opening another part also kept the previous part's section active.

Toolbar, axis selection and cut-out defaults now use the unrounded interior midpoint. The handle uses the same finite projected span on an axis or a general unit normal. A span at or below 1 mm uses one-tenth margins and continuous motion. Larger ranges keep the half-mm snap where a grid point fits and use continuous motion otherwise. A stationary drag keeps its start. An invalid or unrepresentable range cannot install a plane and the section controls show the reason. A successful document replacement or document-boundary history operation clears the live section and cancels its result lane.

## Qualification

- **PASS** — Desktop Chrome WebGPU, 20 states and 838 frozen inputs through cleanup. The translated thin-Y and thin-Z slabs start at `0.2 mm`. A real face-picked drag preview used physical Z `0.12928769899473086 mm`, released at `0.12 mm`, and reversed to `0.28 mm`. Flip, both box handles, two and three planes, both cut-out forms and hatch passed. The 20 × 12 × 8 mm control moved to `9.5 mm`, retaining the half-mm step. The original document, body and feature history did not change.
- **PASS** — Strict native B-rep and independent cap polygons. The 20 × 12 × 0.2 mm slab retained `24.000000000000007 mm³` and its midplane cap measured `240 mm²`. The general normal `(0,1,200)/sqrt(40001)` at the midpoint gave native volume `24 mm³` and cap area `240.00299998125024 mm²`. The actual handle moved it to `66.8/sqrt(40001) mm`. The CPU clipping preview gave `1.3520015808745238 mm³` and the strict native result gave `1.352000000000001 mm³` with cap area `104.00129999187509 mm²`. Independent slab integration gave `1.352000000000002 mm³` and `104.00129999187516 mm²`. Native witnesses used `1e-8` in their measured units. The displayed multi-plane and CPU volumes used `1e-5 mm³`. Sol High independently checked the axis and general-normal split fixtures.
- **PASS** — Held actual Section worker reply 27 across Open and delivered it after the replacement. The new part stayed unsectioned until its own section was enabled. Cancel, New part, invalid empty bounds, Undo and Studio project Save plus fresh Open passed. The native saved SHA-256 is `d5aed626652f09d755a65e2fae23b0df8102e13dc6c76f9d839ff3813136c0e3`. No downloads, page errors or console errors.
- **PASS** — Studio 28/28 focused geometry, gizmo, section and lane tests, both type-checks, affected lint, build, driver syntax and diff checks passed.
- **FAIL** — Parent initialization and drag left the thin bounds, and Open retained the previous section. An early fixed driver targeted the handle during its face click and used a tighter display-volume bound than its three-plane cut-out display can provide. The final driver uses a separate face point and checks native cap and volume independently.
- **NOT_RUN** — Full suites, mobile, and new native tolerance, point snapping, saved sections, hatch-accuracy guarantees, or general plane intersections.

Run with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate. Use the baseline switch with the parent production source.

```sh
D720_SOURCE_FROZEN=1 node apps/cad-studio/test/thin-section-span-browser.mjs "$EVIDENCE/studio"
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test section-span section-planes section-view section-cutout section-hatch gizmo o9-lanes
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint apps/cad-studio/src/App.tsx apps/cad-studio/src/ui/{SectionBar,ViewDisplayControls}.tsx apps/cad-studio/src/viewport/{sectionView,sectionSpan,useSectionEvaluation}.ts apps/cad-studio/test/section-span.test.ts
node --check apps/cad-studio/test/thin-section-span-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D721 checks reflected planar DXF TEXT underlay orientation in Studio. [#2424](https://github.com/barocss/barocss/issues/2424). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
