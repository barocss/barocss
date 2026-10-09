# First observations and repairs

The first dirty22-case campaign passed numeric/refusal/repeat and cost checks. Read-only review then found an untested three-hit tie chain violating the already frozen input-order-independent rule. The exact failing forward/reverse inputs and results are in first-tie-failure.json. The repair anchors eligibility to the global minimum, then chooses lexicographic ID; candidate and independent scene selection both change. A three-order regression control now checks this boundary.

Review also found the matrix assumed exactly unit q while admission allows norm error1e−12. Evaluation now uses2/normSquared, matching the independent Hamilton q*v*qInverse rotation while preserving original q bytes. New near-unit control verifies geometry and source copies. No authored primary scene, tolerance, cap or output target changed.

Other proof repairs: require analytic-hit presence, compare IDs/errors and all sidecar fields as well as original F64 repeat bytes, and use the specified single-campaign warmup. First timing used100warm campaigns and is not the canonical frozen warmup receipt. All first data remain saved.

A pre-execution file-generation script used a duplicated directory segment and failed FileNotFoundError before writing binary/run modules; the corrected destination fixed generation. No numeric output came from that tooling failure.

Two candidate paper URLs were unavailable during lookup (timeout/oversized payload). No algorithm correctness or performance claim relies on them. The reference and separating-plane argument are explicitly checked within this authored experiment; no external kernel is imported.
