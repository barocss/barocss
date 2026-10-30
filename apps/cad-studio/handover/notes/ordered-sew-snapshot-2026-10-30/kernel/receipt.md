# D339 Kernel handoff receipt

Status: source frozen. Kernel lint is **PENDING Model/root serial run**.

Worktree: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`.
Base: `fec23cf2acef80210c28092981f54e6191e90eeb`. No commit or push.

## Owned changes

Only the eight files below were edited by this lane. Other agents own Model and Studio changes.

| File (under packages/barocss-cad) | SHA-256 |
| --- | --- |
| `src/api/surface-snapshot.ts` | `36dfef04303454f0a5c1e5bdca98dd031f77528e43564ae4c33d26afb957e2ba` |
| `src/api/spec.ts` | `43dbb3a4dd43e8bedc9b2e23367ecd081ebcb94be7636d6801714b3f19425aa0` |
| `src/api/part.ts` | `a5e5e7f832e923eabcdea4f6ab637456afa07066a052f8d5eda656cb7638e324` |
| `src/api/kernel.ts` | `1c7e5ed7ea371feba58b7fccb2f8c05ee87cf9c950ce89b278d0364a1678f00b` |
| `src/api/index.ts` | `e8c4d1af5d23c2f5917dd98c26079ddad0af174ec21c7d0c9e39756b0bf31a7a` |
| `README.md` | `ab095e637ee74c1342fc7d04f1db30ad683d1de4d13c35346aa0cdfe4050c1af` |
| `test/api-sew.test.mjs` | `6b1d39ce99b1ae6bbb8224913c08afb481d1f7ccbbe697686c9b974b28ae5fda` |
| `test/api-sew-types.mts` | `c56b7098e5f72caf02487fda6d3a38f1319e00e2fa49f828131818a5ae5cfee9` |

## Contract

`Part.sew(surfaces: readonly RawNurbsSurface[], options?: SewOptions): this`; `SewOptions = { tol?: number }`; public `sewSpec` returns the owned ordered surfaces plus `values: { tol: number }`.
The strict six-field snapshot helper now has an internal diagnostic label. Its default preserves existing Thicken messages. Sew adds a strict plain dense own-data 2..64 list. No sorting, deduplication, reorientation, native geometry changes or Sew BINDS entry.
Omission/0 omits native tolerance; explicit finite positive values <=1 are copied exactly. Invalid tolerance refuses VALUE. The existing backend rejects known parameter binding. Unknown parameter lookup stays at the existing Part boundary.
Sew uses #make: existing chosen body stays chosen; Boolean callback focus follows the new sewn body. Raw API has no source-hiding action.

## Evidence

- Full Kernel build: PASS, `build-1.log` (empty success output), Node 22.19.0.
- New runtime: 7/7 PASS, `tests-final.log`.
- Related existing controls: 18/18 PASS in `tests-1.log` (Thicken 6, Sew 4, API Part 5, API Parameters 3).
- Declaration checks: PASS, `types-1.log`, new Sew and existing Thicken .mts cases.
- Kernel lint: **PENDING Model/root**, expected receipt `lint-1.log`; no PASS claimed.
- `git diff --check`: PASS for owned changes.
- Heavy gate released after final measurement. No more runtime is scheduled in this lane.

`observations.json` records actual values: volume14400, centroid[30,9,9], area4080, one valid closed solid shell, 8V12E6F. Native/public name sets both `sew1.surface0..5`. Auto vertex/edge tolerance is0.05. Ordered and reversed inputs both retain their physical surface-to-name relation. Witness420, focus and Boolean tool behavior pass. Native semantic recipe/B-rep roundtrip passes for tol0.01,0.02,0.
Open/duplicate/disconnected errors were observed as public `GEOMETRY`, `details.kernelCode: GEOMETRY`, `where: evaluate`. Known Param gives `PARAMETER_UNBINDABLE`; unknown Param gives `PARAMETER_UNKNOWN`.

## First failures and limits

All first failures remain in `/tmp/d339-kernel`. `tests-1.log` used an incorrect test assumption that a body shell ID was a Shell record. `tests-2.log` repeated that failure after an edit command used the wrong relative path and made no change. `tests-3.log` assumed optional Kernel FaceInfo.area existed. Tests now use the actual shell table, native surfaceAreaOf and planar face tessellation. No production change was needed for those failures.
`tests-4.log` is the first new7/7 PASS. `tests-final.log` also checks actual native tolerance and observed mapped errors.
Browser/Studio proof, full Kernel suite, release/publication and arbitrary curved sewing certification are NOT_RUN in this lane.
