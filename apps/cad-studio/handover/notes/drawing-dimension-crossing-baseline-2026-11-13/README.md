# D951 — measure the current dimension-ruler crossing

2026-11-13 · P2 rows 11 and 16 · SMALL desktop baseline · [#2335](https://github.com/barocss/barocss/issues/2335)

- **PASS** Desktop Studio opened a 64 × 32 × 8 mm plate with two authored linear dimensions in the same 1:1 Top view. Both rulers remain continuous through (183,125.5) paper mm. Each dimension keeps two arrowheads, two extensions and its original model value.
- **PASS** Independent reads of the actual SVG and DXF found one continuous ruler per dimension and zero centerline gap. The DXF DIMENSION measurements are 64 mm and 32 mm and their anonymous blocks carry the same lines. Driver syntax and diff check pass.
- The current model has text clearance and ASME text gaps, and supports a separate broken-view setting. The selected crossing has no user-owned break setting. A future optional display policy needs an explicit selection identity and consumer contract. Applying it before existing label layout would cause the split line to resemble an existing text gap.
- **NOT_RUN** A new crossing-break implementation, public setting or schema, 3D annotation changes, production build, full suites, PDF and mobile. #2335 remains research. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
