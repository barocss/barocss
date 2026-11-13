# D928 — pin the distance between two opposite native caps

2026-11-13 · FEATURE · P1 rows 07 and 16 · [#2337](https://github.com/barocss/barocss/issues/2337)

Inspect → Measure can pin a fresh pair of opposite caps on one plain positive rectangular Extrude on the default XY plane. Initial picks must match the current authored document, body mesh and native face. Later reads require the same feature and source sketch IDs, authored output, unmerged cap names, expected support planes and outward normals. The panel is session state. It permits ordinary selection and History editing.

- **PASS** Desktop Studio kept the original 8 mm pin while selecting and clearing another face. A numeric edit changed it to 13.25 mm. Undo and Redo returned 8 and 13.25 mm. The viewport label matched each panel value, and the native volumes matched the D927 independent box dimensions.
- **PASS** Hiding the body removed the overlay and marked the result unavailable. Undo restored the visible body and the current 13.25 mm value. Clear kept the accepted document. A same-ID replacement through File Open retired the pin, and ordinary Measure worked in that part.
- **PASS** Independent Sol High source review confirmed the narrow current-owner and cap-role contract. The context-menu Measure entry remains transient. 52 Model and 14 Studio focused checks, both type checks, driver syntax and diff check passed. WebGPU visual review and the final receipt show the edited readout and hidden state with no errors or downloads.
- **FAIL** The first type check used an array method outside the Studio target. The first browser run refused a valid pin because a mass update created a different body array for the same meshes. The final code uses the existing ordered mesh-identity check.
- **NOT_RUN** Broader plane or feature families, context-menu pinning, live worker restart, held replies, native Save, Project Close, full suites, production build and mobile. The research issue remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
