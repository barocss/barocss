# D340 Model source preparation

Status: SOURCE_PREPARED_API_PROVISIONAL; runtime/typecheck/lint/build/tests NOT_RUN.
Fixed worktree: /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b.
Owned files: cad-model direct.ts, direct-trim-split.test.ts, related direct-trim-guards.test.ts and direct-trim-reverse.test.ts assertions, cad-model README.md.

Provisional required Kernel exports: splitTrimmedSurfaceAtParameter and TrimmedSurfaceParameterSplitError.
Result fields consumed: source; components[].surfaceId, side, componentIndex, trimLoops.
The existing untrimmed producer and naming remain unchanged.
All output sidecars are copied before the single add call. Zero components on a side add no object.
Original and unrelated objects/sources are retained. Duplicate selected trimmed IDs refuse DIRECT_PICK.

Prepared checks: public stored160 inside/outside component count, authority-chart polygon area/centroid against guide values, material probes, empty side, both axes/fractional/CWCCW, Kernel sidecar parity, hidden original and independent component ownership, native Save/Open and rename/reopen, invalid profiles/ambiguous ID atomic refusal and valid retry. Existing remaining Region/Extend/intersection/IGES guards remain; empty/untrimmed Split coverage remains.

Pending: exact Kernel API/error/report freeze; root grant for focused tests/typecheck/lint. Actual stored-loop Fraction oracle and report-bound field checks must be added once frozen. Source guide area comparisons do not replace an independent exact stored-loop oracle or browser qualification. No commit/push/browser/new dependencies/schema/lock changes performed.
