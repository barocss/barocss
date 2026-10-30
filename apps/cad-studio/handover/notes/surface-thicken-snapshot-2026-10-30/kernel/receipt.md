# D338 Kernel API receipt

Fixed checkout: /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b
Base: 8c0710d7ab0cce6e09d4fb9c8c7379dba1f3d717
Runtime: Node 22.19.0. Heavy gate acquired and released for each serial run.

Implementation: RawNurbsSurface, ThickenOptions, thickenSpec, inherited Part.thicken, Kernel feature write and thickness binding, one private snapshot module, focused runtime/type tests and Kernel README.

PASS: full package build (build-first.log).
PASS: package lint and unchanged hot code-shape totals (lint-first.log).
PASS: new emitted declaration consumer (types-retry1.log).
PASS: final api-thicken 6 and api-verbs 16 = 22/22 (focused-final.log).
PASS: existing api-part 5, api-parameters 3 and thicken-solid 1 = 9/9 in focused-first.log. These unaffected successful tests were not repeated after test-only fixture fixes.
PASS: exact r11-3 thicken fold control 1/1 (fold-control.log).
PASS: git diff --check at handoff.

Public initial malformed surface/side/t: VALUE. Unknown thickness parameter: PARAMETER_UNKNOWN. Numeric invalid parameter edits 0/-1: PARAMETER. Parameter 10001 is rejected earlier by existing native parameter-table admission: FORMAT. Existing facade fold code: OFFSET_FOLDS, where evaluate, details.kernelCode OFFSET_FOLDS. Native error code OFFSET_FOLDS and details.category CAPABILITY. Full own-property error observations: fold-errors-observed.json.

Planar nonunit fixture: normal/reverse/both t2 => volume 2400 (absolute tolerance 1e-6), centroid and bounds (absolute tolerance 1e-7). t3 both => volume3600, bounds z1.5..4.5. Existing native grouping actually creates73 named faces thicken1.facet0..72, identical for all three sides and t2/t3. Exact accepted names and full B-rep survive native save/read; semantic document equality is checked. No raw-byte file identity claim.

First failures retained in focused-first.log: exact floating bounds/mass assertions and inferred facade error mapping. Subsequent test-only corrections retained in focused-retry1..5.log: retry1 accidentally used unchanged tests after an incorrect edit cwd; observed actual73 faces and category mapping; existing parameter FORMAT; Location.at tuple API; stock test's y range. No production fix or geometry/tolerance change followed those failures. types-first.log retains an incorrect tsc launcher relative-path failure; corrected launcher passed.

Source hashes: owned-source-sha256.txt. No commit, push, browser, API expected-inventory mutation, Core geometry edit, schema/dependency edit or full Kernel suite. Model/Studio/product/remote qualification remains separate.
