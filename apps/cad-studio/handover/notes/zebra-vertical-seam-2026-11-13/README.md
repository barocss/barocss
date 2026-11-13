# D1017 — show Zebra stripes on vertical seams

2026-11-13 · FEATURE · P0 rows 05, 15 and 16 · [#2446](https://github.com/barocss/barocss/issues/2446)

- **FAIL, baseline** In actual desktop WebGPU Studio, two flat vertical faces and 35 points across the tangent R4 vertical Fillet all return the same Zebra level in isometric orthographic projection. For a vertical surface the reflected Z component is constant because the normal has zero Z.
- **PASS, fixed** The shader uses a tilted environment axis so that the reflected horizontal components contribute. The original sharp seam changes abruptly between two tones. The tangent R4 edge shows repeated stripes in both orthographic and perspective views. The two sampled tangent joins agree in tone. Pixel level range is 145.33/255 in the three checked comparisons.
- **PASS** The R4 volume matches 32 × 32 × 16 − 16(16 − 4π) mm³ within 1e-7 mm³. Cycle Zebra to Curvature and off. The document and history stay unchanged.
- **PASS** Visual review, 50 focused Studio tests, both type-checks, driver syntax and diff check.
- **FAIL, trials** Two candidate stripe axes restored contrast but placed a stripe transition between one pair of tangent-join samples. The final fixed axis passes both join samples.
- **NOT_RUN** Other orientations, other radii, alternate renderers, production build, full suites and mobile.

D1010–D1016 cover the issue's source ownership, visibility, independent sketch copy, initial Section position, and reported measurement failures. D1017 completes the listed Zebra check. #2446 is ready for evidence-based closure. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
