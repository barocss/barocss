# D901 — verify explicit and tangent-chain Fillet selections

2026-11-13 · SMALL · P1 rows 07, 08 and 16 · [#2285](https://github.com/barocss/barocss/issues/2285).

Desktop Studio WebGPU opened the exact native stadium prism with a 20 mm straight span, R4 semicircular ends, and height 6 mm. At the same world point, a real click selected one top edge and a double-click selected all four top rim edges. The two operations stored one and four original names respectively. A constant circular R1 Fillet extended the single seed along the full native tangent rim, so both results had the same four named blend faces. The accepted documents preserved the distinct authored selections through Undo and Redo. The four-edge document was saved to OPFS and reopened in a fresh context.

The independent stock-minus-swept-corner integral gives 1247.9164744094167 mm³ and centroid [10, 0, 2.9695921169948343] mm. An isolated straight cut would give 1257.300858012569 mm³. Both native and Studio results matched the full-rim oracle. The strict native body had two R1 X-axis cylinders and two rotational end patches with a 3 mm major radius and R1 meridian. Native tolerances were 1e-8 mm and 1e-7 mm³. The two native face maps agreed.

## Issue evidence

| Reference workflow | Current BaroCSS evidence | Boundary |
| --- | --- | --- |
| Plasticity selection and dimensional edit | [D895](../selected-extrude-versus-offset-2026-11-13/README.md) compares an absolute Extrude driver edit and an appended signed cap Offset, with equal height, distinct history and fresh Open. | The existing Offset operation owns a fixed footprint and plane. |
| Plasticity Offset/Push face | [D342](../offset-face-native-2026-10-30/README.md) covers native cap admission and refusal. [D898](../offset-face-handle-field-parity-2026-11-13/README.md) verifies signed handle and field equality. [D897](../offset-preview-document-replacement-2026-11-13/README.md) verifies pending preview retirement. | The operation applies to the qualified right-prism cap. General direct editing remains tracked in #2264. |
| Downstream reference and rebuild | [D896](../offset-cap-shell-reference-2026-11-13/README.md) verifies a stable cap and Shell. [D899](../offset-cap-reference-rematch-2026-11-13/README.md) verifies live refusal, marked cold rematch and explicit confirmation. [D900](../repaired-open-notice-ownership-2026-11-13/README.md) retires the obsolete failure notice. | The current bounded workflow meets the research acceptance. Associative offsets and new face-edit APIs are separate designs. |
| Plasticity fillet selection | D901 measures the distinct stored selections and the same expanded native result. | End-on radius interaction remains tracked in #2286. General blend continuity is outside this fixture. |

The first driver failed to resolve two package imports before Studio. After correction both desktop runs passed. Model 16/16, Studio 14/14, syntax and diff checks passed. The final browser run had zero page errors, console errors or downloads. Commands and hashes are in [qualification.json](qualification.json). Other profiles, full suites and mobile were NOT_RUN.
