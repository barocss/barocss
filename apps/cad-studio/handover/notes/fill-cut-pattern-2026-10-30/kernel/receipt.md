# D335 Kernel/API receipt

Worktree /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b, local/cad-dev base 9229acb83c77fa56d4b1649df84e412d05e8e4df.
Node /Users/user/Library/pnpm/nodejs/22.19.0/bin/node. All heavy commands used gate acquire/release.

- Full CAD build PASS: build.log; final full build after narrowed public builder declaration PASS: build-final.log.
- Type-check PASS: types.log.
- Lint PASS: lint.log (code-shape unchanged).
- Initial focused suite 28 total, 23 PASS / 5 FAIL: focused.log. First failure was test helper treating body.shells string IDs as shell objects. All five failures shared that mistaken assertion. The helper now checks brep.shells; no geometry source change fixed that fixture failure.
- Affected fill-only rerun 10/10 PASS: fill-rerun.log. Related linear/rectangular/curve tests were 18/18 PASS in the initial focused run and were not repeated.
- git diff --check PASS.

Source scope: API type/spec/Part/backend, Core feature union/operation, one shared exact XY mask adapter, README and focused new test. No schema, dependencies, WASM, commits, push or browser work.

Tests establish base 22500 centroid [4559/150,607/30,5], spacingY12 22800 centroid [61/2,765/38,5], notch16 22650 centroid [9159/302,6127/302,5]; all expected cell corners/names, omitted masked cell names, strict valid closed single solid; CW/CCW parity; Save/Open; source parameter edits; input snapshot ownership; no-op source admission; typed count/spacing/region failures; finite64 cap before mask; tiny spacing; no cumulative offset cap; boundary/nextafter and exact rational sum distinction from Number-rounded sum.

Source capsule: source-sha256.txt. A final part-model comment-only correction followed the final build. Product browser, full package test suite and remote status remain NOT_RUN by this worker.
