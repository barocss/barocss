# D1009 — preserve endpoint radii when a Fillet edge is replaced

2026-11-13 · FEATURE · P0 rows 05, 15, 16 and 21 · [#2445](https://github.com/barocss/barocss/issues/2445)

- **FAIL, baseline** File Open refused a displaced varying-radius Fillet before it could offer a reference decision. The current document survived.
- **PASS, fixed** Desktop WebGPU Studio held the Fillet on 11,800 mm³ stock and offered the straight edge at Y=0.5 mm. It applied R1 at X=0 and R3 at X=40 only after confirmation. Native geometry retained the four independently predicted endpoint contacts within 1e-8 mm. Displayed and native volumes matched the analytic removal within 1e-7 mm³.
- **PASS** Undo restored the held choice. Redo and native File Open of the accepted document retained the exact reference and authored endpoint radii.
- **PASS** When both authored points were equidistant from both ends, Studio held the feature, identified the endpoint ambiguity and offered no candidate. The stock remained 11,800 mm³.
- **PASS** Visual review, 76 focused Model tests, 15 focused Studio tests, Model and Studio type-check, driver syntax and diff check. GPT-6.1 Sol High reviewed the native fixture and endpoint assignment.
- **NOT_RUN** Varying History repick, curved or shared edges, parameterized endpoint radii, more than two stations, project Save on this varying fixture, production build, full suites and mobile.

The added recovery covers one individually signed, straight native edge with two numeric endpoint radii. Endpoint distances must identify different ends before the candidate is offered. Full evaluation is still required on confirmation.

[#2445](https://github.com/barocss/barocss/issues/2445) stays open. D999 qualifies refusal at the stored linked-inset v1 boundary, but its live downstream finish path remains unqualified. The verified History repick is limited to a terminal single-edge constant finish. Desktop issue acceptance remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
