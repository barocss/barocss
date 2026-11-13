# D1045 — preserve the gap between selected and hovered edges

2026-11-13 · SMALL · P0 rows 06, 20 and 21 · [#2451](https://github.com/barocss/barocss/issues/2451)

Use independent 2 CSS px strokes for individual edge selection and hover in both renderers. Keep the existing body and direct-object selection strokes. The WebGPU renderer owns and disposes separate non-pickable hover and selection lines. The WebGL2 line shader uses separate width uniforms.

- **FAIL** At 1440 × 900, DPR 1, WebGPU dark, the 0.454 mm physical gap projects to 4.00 CSS px. The hover changes two central scanline pixels alone and four next to a selected edge. No clear gap pixel remains when one edge is selected and the other hovered, or when both edges are selected.
- **PASS** WebGPU and WebGL2 preserve clear gap pixels in the same 4 CSS px fixture at 1440 × 900 dark/DPR 1 and 1024 × 800 light/DPR 2. Hover's scanline coverage is equal with and without the opposite selection in each profile. The four profiles leave 2/6/2/4 device pixels of the original gap, respectively. Both edges and each front face are independently selectable through the public filters. The source document stays exact.
- **PASS** Visual review, nine focused Studio tests, Studio type-check, driver syntax and diff checks.
- **NOT_RUN** Selection on placed edges or direct geometry, other gaps, production build, full suites and mobile.

The four desktop profiles satisfy the reported #2451 criteria. Desktop QA advances to 14/54, initial scenarios are 8/10, and whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
