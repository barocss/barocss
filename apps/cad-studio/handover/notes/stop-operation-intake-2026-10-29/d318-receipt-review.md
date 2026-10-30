# D318 skeleton receipt review

Status: **FIXED_AUTHOR_RECEIPTS_VERIFIED**, limited to the committed source and retained author receipts. Independent audit runtime, browser and image review: **NOT_RUN**. No product source, tests, builds, browser, installation, Git mutation or external message was run for this review.

## Exact identity and integrity

- Fix and receipt commit: `b1a9ed8c9dbbbe463fae1600151041870914937d`; parent: `73c6085171f7d9b6931c395917742211f0266cbb`.
- All Git reads used explicit author worktree `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`. Status at review: only `?? .claude/`. This chat checkout was not used for Git identity.
- Receipt root: `apps/cad-studio/handover/notes/skeleton-file-admission-2026-10-29/`.
- `qualification-artifacts.json`: **48/48** entries match byte length and SHA-256 of the exact commit blobs. Manifest SHA-256: `b8766c10800cf9406b01f8a6035039255a3724ebedd7e404e673675c600e5d34`.
- `consumers/artifact-manifest.json`: **28/28** entries match exact commit blobs. These entries overlap the 48 above; they are not 28 extra unique artifacts. Manifest SHA-256: `a7d9290bbb8a0887ed3345f35ee970a95ad623a2fc07ceba7ad8b08365f66f89`.
- Tree inventory: all receipt-root files are covered by the 48-entry manifest except that manifest itself. No omitted receipt was found.
- `source.sha256`: **4/4** source/test hashes match exact Git bytes. `browser-flow.mjs` separately matches `validation.json` hash `d14ae123da215d6189addc73ea89ce518462a5ff467586ae7c1e9af8022b0d6f`.
- `qualification.json` SHA-256: `2f0c8281b7f22c04fdc71fce344a6df6ed7f183f408b878958d1793fa5569572`. `consumers/validation.json` SHA-256: `8f3bdb7f1af13656ed6d3d6545ac2f384c8a5d4f0e81a21f0cc9f4ec3ed73469`.

## Actual consumer wiring and source result

`App.tsx:2128-2131` reads the file bytes with `readStudioFile`, returns on reader error, then calls `replaceDoc`. `container.ts:87-99` decodes, invokes `readStudioDoc`, and refuses missing blobs. `migrate.ts:23,46-56` now admits skeleton and calls raw structural validation before stable-ID/default construction. This is the actual Open path. The unknown-kind check and schema maximum remain in place; schema4 still passes the existing route-bundle admission guard. Save uses `encodeStudioFile` through `App.tsx:1928-1936`.

`App.tsx:3664` routes the actual history action to `skel.begin(i)`. `useSkeletonEditor.tsx:97-104` records the accepted node index and copies its draft. The actual Apply path at `114-128` uses `skeletonSessionNode`, solves before commit, checks follower safety, and replaces exactly the selected node in `doc.nodes.map`; only a new session uses `withNode`. The helper copies previous metadata and ID, replaces points/segments, and removes constraints when the new list is empty. A refusal returns before commit. The Open error path also returns before replacement. This establishes source-level document refusal atomicity for these paths; a malformed-file UI matrix was not run. It does not certify blob-store rollback or unrelated async Open races.

Reader validation is structural. It checks finite numeric or own finite parameter coordinates, segment indices, supported constraints and references, nested vectors, and skeleton-following frame caches. It uses an iterative nested-document worklist and document-local parameters. It preserves authored source fields, follower indices and caches; it does not solve or rewrite the stored geometry. Nonempty constraints require numeric points. Required frame caches support endpoint pairs, through-point and center forms. Other frame categories and a full recursive unknown-node-kind contract are outside the new check. No new point/segment count limit is claimed. Nested instance/pending-part traversal exists in source; the focused receipt explicitly exercises a malformed nested instance, not all nested combinations.

## Retained author evidence

The counts are unique focused author tests. Do not add them to the independent audit 95.

- Model: **41 unique** = 34 existing affected passes retained from the initial run + final reader **7/7**, zero fail/skip.
- Studio: **7 unique** = 6 existing skeleton-tool passes + final Apply identity test **1/1**, zero fail/skip. The first combined Studio log already includes the helper test; repeated helper results are not additional coverage.
- Model/Studio type and changed-file lint logs are empty final logs, with author exit0 declarations. They are retained author outcomes, not an independent execution.
- Original reader baseline: 4 tests, 1 pass/3 fail, unknown skeleton kind. The initial Apply initializer observation fails with `undefined !== n7`; it followed behavior-preserving extraction of the initializer, not a baseline browser run.
- First affected Model run: 40 tests, 38 pass/2 fail. Invalid new fixtures omitted the schema4 route bundle and the frame cache arrays. Final fixtures use the required data; negative cases retain refusal coverage.
- Initial type fixture failures cover nextId optionality, suppressed optional-true typing and tuple inference. They remain separate from final type exit0. Both retained browser-script syntax checks have exit0; no browser syntax failure is shown.
- Browser first failure: an authored follower fixture had empty outputs while evaluation generated four valid refs. Full-document equality failed. The final fixture explicitly supplies those refs; equality and numeric assertions remain.
- Final retained flow: exit0, Chrome WebGPU, DPR1, Node22.19.0; starter plate and selected D318 check pass. Two fresh contexts were used. The consumer says four PNGs were viewed. This review checked their hashes only.

The actual browser flow creates a one-point/zero-segment skeleton through the UI, Save downloads it, a fresh context opens the file, and the history editor reapplies it with its ID. It also creates the 3-point, 2-segment, 5-constraint polyline through the UI and saves it. Two frame followers are then authored into that file fixture, not created through frame UI. A second fresh context opens the follower file. History editing changes Length40 to50 and applies to the original `n0`; all follower raw fields and `nextId` remain. Undo/Redo compares the complete before/after documents. Save then New/Open restores the accepted edited document. This last New/Open uses the second context again; it is not a third fresh context.

Retained raw volume records have four fresh, mass-ready bodies. Summing recorded volumes gives 6719.999999999989 before and 7839.999999999988 after, compared with 6720/7840 mm³ at author tolerance 1e-6. The source also checks per-producer area-times-length sums. This is a check of retained numeric records and assertions, not independent geometry execution or solver qualification.

## Original failure file and remaining proof limits

The original audit file `runs/studio-001/skeleton/skeleton.bcad` still hashes to `09a1e09a23c191b4ea0e0a62688b2bf208cbb16ff3512f02c76635ec9e4c7a98`. It is a four-point closed rectangle with IDn0 and no constraints. The new browser receipt files are different documents: the final polyline has three points/two segments/five constraints. They are neither semantically equal to that original file nor raw-byte replacements. Source inspection covers its basic skeleton form; replay of that exact original file on the fix is **NOT_RUN**.

Saved-file semantic equality in the author flow is explicit. Original downloaded bytes are retained and hashed. Equality of bytes between separate saves is **NOT_ASSERTED**. The final edited file retains node IDs n0/n1/n2, nextId3, original follower caches and output refs, with the expected skeleton length edit; there is no appended duplicate skeleton in that retained file.

Limits: full Kernel/Model/Studio suites, independent audit runtime/browser/image review, other browsers/DPR, actual schema4 UI, bound-parameter skeleton UI, malformed-file UI matrix, all structural combinations, nonlinear solver correctness, union/interference/manufacturing acceptance, remote acceptance and release are **NOT_RUN** or not certified by this review. Unknown node/schema guards remain in source; their global completeness is not established by D318. This result closes the observed current skeleton Save/Open and edit-identity cause at source/author-receipt scope only.
