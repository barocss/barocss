# D1259 — Inspect straight box fillet interfaces

2026-11-14 · FULL · P5, row 24 · [#537](https://github.com/barocss/barocss/issues/537), [#2043](https://github.com/barocss/barocss/issues/2043)

The read-only native continuity inspector recovers missing parameter lines for a straight tangent joint on the qualified single-fillet box profile. Admission checks the analytic Boolean output's solid, shell and face layout. It recognizes six affine box planes and one rational quarter-cylinder. It matches the canonical edge to a unique cylinder generator and to the adjacent plane within a roundoff bound. The inspector checks both positions and first derivatives at the eight samples. It keeps authored parameter curves and applies the existing checks to them. Recovered parameter lines are temporary.

- **FAIL before change.** Studio created a constant R2 fillet on the top-front edge of a 30 × 12 × 20 mm box. Both straight joins refused with `missing-pcurve` because neither face use supplied a stored binding. The baseline runner confirmed both refusals.
- **PASS, actual desktop Studio.** Authored the same fillet with the viewport and command. Inspected both interfaces from the native joint list. The side join measured 5.089e−14° and the top join reached 1.439e−13° across eight samples each. The independent normals give 0° on each. Both curved end joins still refused. Undo and Redo restored the accepted documents and cleared the prior readout.
- **PASS, shape and numerical checks.** The strict B-rep has 7 faces, 15 edges and 10 vertices. Its complete fingerprint matches before and after the change. Native and Studio volume agree with the analytic result of 7174.247779607694 mm³ within 1e−7 mm³. A separate audit compared the native cylinder boundary and its axial derivative against the two opposite canonical edge directions. Its maximum point differences are 4.44e−16 and 6.66e−16 mm.
- **FAIL, intermediate review.** The first candidate flipped both generator normal directions. The audit checked the native arc end tangents and the candidate was corrected before the final Studio run.
- **PASS, focused verification.** 28 kernel and 15 Model tests. Unrelated missing bindings, curved ends, modified rational weights, non-affine plane input and invalid stored bindings refuse. Turning off recovery fails the new straight joint case. Type checks, code shape, scoped lint, browser syntax, Vite build and links pass.
- **NOT_RUN.** Full suites, other fillet profiles, general recovery, G2/G3, full-edge certification, live AI and mobile. The broader continuity epic and design reference remain open.

D1260 exposes native joint discovery and sampled continuity as a read-only CAD agent query. Use an explicit body and native edge ID, pin the tool session's revision, and compare local MCP with Studio on the same fillet.

[Commands and receipt hashes](qualification.json).
