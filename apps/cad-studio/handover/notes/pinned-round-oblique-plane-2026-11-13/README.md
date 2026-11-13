# D904 — verify pinned Round on a translated oblique plane

2026-11-13 · SMALL · P1 rows 09 and 16 · [#2282](https://github.com/barocss/barocss/issues/2282) stays open for the remaining refusal matrix.

The existing pinned line-to-arc Round and downstream Extrude work on this oblique plane without a product code change. The final fixture uses origin `[3, 4.5, 6]`, normal `[0, 0.6, 0.8]` and local X `[1, 0, 0]`. This covers both a 7.5 mm normal offset and a 3 mm in-plane translation. An earlier successful fixture covered only the normal offset.

## Verification

- **PASS** Desktop Studio WebGPU used a canvas point pick to create R3, accepted R4 in the panel, and restored exact documents through Undo, Redo, local-project Save and fresh Open. R10 was refused with the accepted document, visible history, dirty state and R4 outline intact. A subsequent R5 edit and history replay passed.
- **PASS** The independent planar contact and volume calculation was mapped with the explicit orthonormal frame. It checked both cylinder axis lines, both radii, the five vertices on each cap and retained side IDs. The native B-rep and Studio Worker agreed with the independent volume to 1e-7 mm³. World coordinate tolerance was 1e-8 mm.
- **PASS** Independent geometry review, 64 affected Model tests and driver syntax and diff checks.
- **NOT_RUN** Other oblique frames, oblique reverse traversal, native Measure on an oblique cylinder, full suites and mobile.

[Commands, numeric results and receipt hashes](qualification.json).
