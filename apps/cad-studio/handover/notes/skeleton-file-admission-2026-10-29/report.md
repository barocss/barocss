# Skeleton file admission — D318 / #2235 (2026-10-29)

Baseline HEAD: `73c6085171f7d9b6931c395917742211f0266cbb`. Node22.19.0; checks used the existing heavy gate serially.
This report covers the local source and focused checks. Browser/product proof belongs to the consumer's separate run.

## Contract and implementation

The current schema3 reader now admits `skeleton`. Schema4 still requires an actual valid route bundle; no schema,
version or migration was added. Private module-level helpers in `engine/migrate.ts` check saved structure without
solving, normalizing, defaulting or rewriting points, constraints, parameters or references. No new Model export exists.
The only solver-module runtime import is the pure `sketch3dRefusal` validator; no `frames/skeleton`/evaluate cycle was added.

- Preserve single-point and zero-segment UI drafts, empty constraint lists, and existing parameter coordinates.
  Only a nonempty constraint list requires numeric points, matching the existing evaluator boundary.
- Check finite coordinates/own finite parameter values, segment integer indices/range, every constraint kind,
  its references and bound values, and nested fixed/axis/plane vectors. Nonunit vectors remain supported when their
  norm is finite and positive. Fixed `at` remains optional. No new point/segment cap was added.
- Keep redundant/conflicting constraints and self segments/duplicate point coordinates as authored. Structural
  admission is not a successful solve or physical-frame qualification.
- Preserve IDs, nextId, metadata, forward skeleton follower indices, and stale cached frame geometry. A skeleton
  follower has exactly one discriminator. Its required cached points/segments are checked in their existing
  ModelFrameSegment forms: pairs, through-point objects and center objects. Values need not equal the source skeleton.
- FrameNode's points/segments are required by `engine/doc.ts` (the frame union); the public add/edit author writes
  them with `withFollowed` (`chat/part/features.ts`). `bodyNotes.ts` also reads the cache's segment array. Missing or
  malformed arrays are therefore refused, not filled. Other frame categories were not brought into this validation.
- Validate nested instance/pending-part skeletons with an iterative worklist. Each document uses its own parameters.

The Studio Apply path uses `skeletonSessionNode`: preserve the previous ID and node metadata, replace the geometry,
and explicitly remove the old constraint list when the edited draft has none. Point-copy callbacks and raw validation
helpers are at module scope; the new validation loops do not create per-point closures.

## Original failures and repairs

1. `reader-baseline.log`: 4 tests, 1 pass/3 fail, exit1. Valid saved skeletons fail as an unknown feature. The one
   malformed-input test passes at this baseline only because the unknown-kind gate rejects it first.
2. `editor-baseline.log`: 1 test, 0 pass/1 fail, exit1; `undefined !== 'n7'`. For this observation, the existing Apply
   node initializer was first extracted into the actual helper call without changing its behavior. The failing test
   calls that same initializer; this is a source-level regression observation, not browser proof.
3. `model-focused-first-failure.log` (also retained as `model-focused.log`): 40 tests, 38 pass/2 fail, exit1.
   One new fixture incorrectly asserted that schema4 without a route bundle should open; the existing route guard
   correctly refused it. The other constructed a frame follower without the cache fields required by FrameNode,
   causing `bodyNotes` to read an undefined segment array. The fixtures now use a real route bundle and authored
   cached arrays; separate negative tests protect explicit refusal of missing cache data.
4. `model-types-first-failure.log`: the fixture's inferred required nextId was narrower than StudioDoc.
   `studio-types-first-failure.log`: the fixture used suppressed:false, while its typed field is optional true.
   Both fixture types were corrected. `model-types-second-failure.log` preserves the later tuple-inference error;
   the skeleton constant now has its actual ModelNode skeleton type. No expected geometry or tolerance was loosened.

## Final focused evidence

| Scope | Result | Log |
|---|---|---|
| Existing affected Model checks: migrate/container/frame-skeleton/r4-skeletons/drawing-current-contract/route-bundle-admission | 34 pass in the first affected run; retained without repetition | `model-focused.log` |
| Final new skeleton reader checks | 7/7 pass, 0 fail/skip; exit0 | `reader-final.log` |
| Existing Studio skeleton-tool checks | 6 pass in the first affected run; retained | `studio-focused.log` |
| Final Studio Apply identity/metadata/constraint-removal check | 1/1 pass, 0 fail/skip; exit0 | `editor-final.log` |
| Model types, including new tests | exit0 | `model-types.log` |
| Studio types, including the new Apply test | exit0 | `studio-types.log` |
| Changed production/test files lint | exit0 | `lint.log` |

Final acceptance set: **41 unique Model tests** (34 existing +7 new), **7 unique Studio tests** (6 existing +1 new).
Do not sum the repeated reader/Apply runs as extra coverage. The new reader tests were rerun after fixture repairs
and after the final cache/closure refinements. `reader-fixture-repair.log` preserves the earlier repaired 7/7 run.
The final run reuses the unchanged 34/6 existing successes. Empty type/lint logs are preserved; exit codes above were
captured by the calling shell. All gate slots were released.

The reader tests include actual JSON and codec reopening, a real schema4 route bundle, unsupported nested data,
and shared two-frame followers. Independent member volumes are A times L: square tubes width10/20, wall1, radius0,
length100 then a public edit to150. IDs and authored source arrays/constraints/parameter references are compared
directly. These checks compare raw document fields; they do not claim raw file-byte identity for regenerated JSON.

## Commands and limits

From `packages/barocss-cad-model`, with Node22.19.0 prepended to PATH:

```sh
node scripts/test.mjs skeleton-reader migrate container frame-skeleton r4-skeletons drawing-current-contract route-bundle-admission
node ../../apps/cad-studio/scripts/test.mjs skeleton-session-node skeleton-tool
node scripts/test.mjs skeleton-reader
node ../../apps/cad-studio/scripts/test.mjs skeleton-session-node
node ../../node_modules/typescript/bin/tsc --noEmit -p .
node ../../node_modules/typescript/bin/tsc --noEmit -p ../../apps/cad-studio
node ../../node_modules/eslint/bin/eslint.js src/engine/migrate.ts test/skeleton-reader.test.ts ../../apps/cad-studio/src/skeleton/useSkeletonEditor.tsx ../../apps/cad-studio/test/skeleton-session-node.test.ts
```

Final owned-file hashes are in `source.sha256`; raw logs above remain unchanged. Runtime browser Save/fresh-context
Open/re-edit/UndoRedo, whole Model/Studio/Kernel suites, docs/generated inventory, remote push and release were
NOT_RUN by this worker. The root coordinates browser proof, final qualification, commit and push.
