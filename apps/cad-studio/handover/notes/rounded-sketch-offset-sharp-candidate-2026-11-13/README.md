# D908 — verify sharp inset candidate documents and their side IDs

2026-11-13 · SMALL · P1 rows 09 and 16 · [#2232](https://github.com/barocss/barocss/issues/2232) stays open.

Desktop Studio opened four independently authored native candidates in the sequence 1 → 2 → 2.5 → 1 mm. The source is the same 20 × 10 mm rounded rectangle with R2 corners and 10 mm Extrude. The 2 mm and 2.5 mm candidates supply one sharp rectangular hole. The four straight sides keep tags `e9, e11, e13, e15`. The inner arc tags `e10, e12, e14, e16` are absent from the sharp solids and present when Studio reads the original 1 mm candidate again. All eight outer side tags remain.

| Inset | Hole | Independent ring volume | Strict native ring volume |
| --- | --- | ---: | ---: |
| 1 mm | 18 × 8 mm, R1 | 534.2477796076939 mm³ | 534.247779607693 mm³ |
| 2 mm | 16 × 6 mm | 1005.6637061435918 mm³ | 1005.6637061435913 mm³ |
| 2.5 mm | 15 × 5 mm | 1215.6637061435918 mm³ | 1215.663706143591 mm³ |

Both sharp candidates have four outer cylinders, 14 named faces and 24 cap vertices. Native and Worker volumes match the independent area difference at 1e-7 mm³, and positions match at 1e-8 mm. Local-project Save and fresh Open preserve the exact 2.5 mm candidate and its tags. The candidate files contain independent geometry and no association. The ordinary Offset action continues to refuse 2 mm and 2.5 mm.

## Results

- **PASS** Desktop Studio WebGPU, strict native inspection, D906 desktop regression, 80 Model tests, 4 Studio identity tests, driver syntax and diff checks.
- **FAIL** None in the measured candidate reader and existing Offset scope.
- **NOT_RUN** Parametric regeneration, direct downstream features on absent arc IDs, transition history, recipe persistence, other profiles, full suites and mobile.

[Commands, numeric results and receipt hashes](qualification.json).
