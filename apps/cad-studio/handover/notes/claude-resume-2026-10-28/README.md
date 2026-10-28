# Hand-over (2026-10-28)

The owner asked: "지금까지 하던거 멈추고 인수인계 할 수 있도록 해줘". This note lets the next session continue the
kernel and cad-model work of the session that ran on `local/cad-dev` from 2026-10-27 to 2026-10-28.

## Latest resume checkpoint — Codex, 2026-10-28

- PR #2226 merged as `a780578a2` after the reviewed API-inventory fix `111b7d58c`. Only that CI fix was pushed.
- `local/cad-dev` fast-forwarded to develop in this worktree. The main checkout was not changed.
- CG1.3, one polynomial guide on ruled height sections, is complete through Model/API/chat/Studio. See D288.
  Implementation checkpoint: `89fb7bf76`; the following completion commit adds the final geometry check and records.
- Verification: full kernel 1963 pass / 0 fail / 6 skip before retiring its one source-only hash test; 84 targeted
  tests pass after retirement. Final model 1716/1716, Studio 352/352, current-source guide 6/6; docs pass.
  Desktop Chrome/WebGPU: guided preview, Apply, Undo/Redo, Save/Open; legacy unguided Loft also passes.
- The guide source returned to inherited content three times. The writer is not identified. The owner confirmed no
  other writer or open editor tab. The current source was reapplied with the file-edit tool; no recurrence was
  observed during final full verification. D288 records the diagnostic limits. Do not replace geometry oracles with
  source checksum pins.
- No feature push, new PR or release. Local `.claude/` remains untracked.
- D289 adds the exact end run for an adjacent polynomial Bezier face (degree2–5, one clamped span). The quintic
  loft case passes an independent swept-corner volume oracle, Model/API/codec and actual Studio preview/apply/
  Undo/Redo/Save/Open. Final whole checks: kernel1968 pass/0 fail/6 skip, Model1718/1718, Studio352/352; docs pass.
  D291 below adds one bounded non-adjacent replacement. General pairs and multi-span/rational end extension remain open.
- The owner delegated choosing several open-source fonts. Unmodified ABeeZee, Nanum Gothic and Nanum Myeongjo TTFs
  plus their OFL originals are saved in apps/cad-studio/test/fixtures/fonts, commit `9fe4be221`. Fixed upstream URLs and binary
  metadata are recorded there. Font originals alone do not imply shaping, emboss or wrap support.
- D290 adopts one cached-boundary early return. Paired median7 runs improve the two fixed thread workloads12–14%;
  B-rep fingerprints, shape/names/counts and every mass-property bit stay unchanged. Whole kernel1968 pass/0 fail/
  6 skip; focused Model23/23; docs pass. The earlier whole Model/Studio/browser results above retain D289's scope.
- D291 qualifies the bounded plane/Bezier corner replacement from WIP `37da7011f`/`f6e265886`: exact support
  admission, complete conservative Boolean sources, disk-strip checks, protected representative coordinates and
  strict post-checks. Kernel focused19/19, Model3/3 and desktop Chrome/WebGPU preview/apply/Undo/Redo/Save/Open pass.
  The first candidate missed the high-order planar support; the second found a4.3e-14 representative drift while
  surface/curves were unchanged. Exact incidence matching and existing-bound coordinate restoration resolve it.
- D292 qualifies WIP `cf3d02151`'s static TrueType data reader in engine/font/trueType.ts. Independent fontTools
  observations and authored malformed/recursion/budget fixtures pass10/10. Coordinates remain in font units;
  the existing export wildcard exposes the engine module, but no Doc/font asset, text profile or Studio text
  command is connected.
- Combined final whole window: kernel build/lint,1981 pass/0 fail/6 existing skips (1987 total), Model tsc/changed
  lint and1729/1729, Studio tsc and352/352. Generated-tools/refusals/docs pass:67 pages,50 shots,829 labels, after
  the reviewed inventory refresh (eight new reader exposures;446 equivalent notation fields). See D291/D292 for
  exact proof boundaries.
- Latest Text implementation checkpoint: `0f836e8f2`. D293 carries original u8 font bytes through existing blob,
  worker/recovery/proposal and BCADPACK paths. D294 adds bounded line profiles from original quadratic outlines;
  D295 connects standalone editable Text recipes, the public API and Studio upload/HUD. No new document/container
  version or top-level font registry is added. One authored output may contain several physical bodies.
- Latest focused verification: Model 63/63 and Studio 15/15. Actual desktop Chrome/WebGPU 1440x900/DPR1 startup and
  flows 34/35 pass. ABeeZee ` A `→` AA ` changes volume 29.7594→59.5188, preserves the later Box, passes Undo/Redo and
  raw-TTF BCADPACK Save/Open/re-edit. Gothic/Myeongjo `가한` at em 20/tolerance 0.002/h 2 create and reopen. Original
  browser evidence and its limits are in `../text-solid-2026-10-28/README.md`; the public Latin shot is unchanged.
  Synthetic composition-Enter guards passed; native OS IME is NOT RUN. No arbitrary-font/all-glyph certification.
- Latest whole qualification on `0f836e8f2`: kernel build/lint and1981 pass/0 fail/6 existing skips (1987 total),
  Model tsc and1792/1792, Studio tsc and364/364. Changed-source lint, generated tools/refusals and docs pass:68 pages,
  51 shots,838 labels. Reviewed inventory6697→6729 adds32 and changes19 fields intentionally; no removals or unexpected
  differences. Original upload ENOENT, Model type/lint and COMMAND_DOCS boot failures remain recorded in D293/D295.
- D296 is the current bounded +Z Text relief integration. Initial kernel WIP `acead9d16` build/lint,13/13 focused,
  19/19 related and whole 1994 pass/0 fail/6 existing skips predate the final helper. Final helper uses cached exact
  orientation, one-scale dyadic area/3D audit, directed-endpoint boundary fast path/exact fallback, direct emboss
  slabs and one batched engraving difference with complete oriented-frontier proof. No numeric/work limit rises.
- Current focused results: final kernel 19/19, Model tsc second pass+75/75, Studio tsc+35/35. Both Korean fonts'
  가한 emboss/engrave fixtures use em 10/at [5,5]/depth 2/tolerance 0.01. The tighter Myeongjo engrave0.002 is explicitly
  refused by the existing 1m work budget and retains node tolerance 0.002. No automatic relaxation or tighter-case
  success is claimed. Raw missing signatures still refuse BAD_REFERENCE at expansion; source-height edits may
  track the same authored cap at its new top.
- Runtime source is `62069bbd1`; final kernel build/lint and2000 total/1994 pass/0 fail/6 existing skips,
  Model1822/1822 and Studio365/365 pass. Model/Studio types and changed lint pass with0 errors; existing chat any
  warnings32 remain. Actual Chrome/WebGPU startup+Latin36 at0.002 and Korean37 at0.01 pass, including preview/apply,
  History edit/Undo/Redo and original-font Save/Open. New public shots and evidence are unchanged actual captures.
  Generated tools/refusals/inventory and docs pass:68 pages/53 shots/4488 KiB/852 labels. One paired RUNS7 perf gives emboss7→6ms/engrave6→6ms, B-rep fingerprints
  and strict shape/name/count/volume/centroid SAME; rounded medians do not establish stable/Studio speedup.
  Inventory6737 keys is reviewed:8 new/0 removals/duplicates,53 existing-row fields(12 semantic+41 union notation),
  one top-level kind addition,847 prior members+9,212 checks pass. Failures/path mistake remain in D296.
  Evidence: `../text-relief-2026-10-28/README.md`; separate paired performance report includes limits.
- Read-only next-provider design: `../research-text-wrap-2026-10-28.md`. No wrap code/test is adopted by D296.
- D297 private cylindrical map/curve foundations (2026-10-29) keep original native U and stored poles. Build/lint,
  focused34/34 and whole2022 total/2016 pass/0 fail/6 existing skips pass; generated checks pass. No wrapped
  solid/Part/Model/API/Studio feature or new browser evidence. Original failure/reviews are preserved in
  `../cylindrical-wrap-foundation-2026-10-29/README.md`. Next is D298 native topology/mass provider.
- D296 follow-up (2026-10-29) registers text-relief in edit-time face rematching. Both new matcher tests
  fail before the one-line fix; final focused53/53, Model types/lint and whole Model1824/1824/Studio365/365
  pass. These do not add a new browser/native-renaming flow or qualify concurrent wrap WIP. See
  `../text-relief-rematch-2026-10-29/README.md`. The static audit's15 NOT_REPRODUCED candidates are attached
  to existing roadmap areas; original07→08→09 order and active wrap work remain unchanged.
- D298 runtime `0edecf9d5` (2026-10-29) adds private native-source consistency, rectilinear original-UV factor2
  shell diagnostics and separate added-band raw-moment bounds. Build/lint, focused49/49 and whole2049 total/
  2043 pass/0 fail/6 existing skips pass; generated checks pass. The ring+stroke is strict-valid with28 vertices,
  42 edges,19 faces,22 loops,84 coedges/genus0 and185431 operations under200k. Physical-solid, full mass,
  global evaluator and general text flags remain false; no native Part/Model/API/Studio or new browser flow.
  See `../cylindrical-wrap-native-2026-10-29/README.md` for unchanged original failures and moment width limits.
  The original inverse is not loosened: nativeR100/tolerance0.01 remainsBUDGET. D299 must address diagonal
  projected-chart embedding and complete native error/mass before product wiring.
- D299 runtime`901b4ce45` (2026-10-29) qualifies private stored projected curve pairs: exact complete
  nonadjacent box cover/shared-endpoint cones, one unchanged200k/8192-bit ledger, frozen original data.
  Focused34/34, kernel2074 pass/0 fail/6 existing skips, Model1824/1824 and Studio365/365 plus types/lint/generated
  checks pass. UNRESOLVED is registered; the reviewed existing tuple/derived-union baseline is the only API
  inventory change. Full loops/native trims/solid/mass remain unqualified. Original failures and boundaries:
  `../cylindrical-wrap-chart-2026-10-29/README.md`. Next D300: whole projected components before native wiring.
- D300 runtime`225005fd5` (2026-10-29) qualifies complete private stored projected components: sense-selected
  closure, all pair coverage, exact upward-ray winding, orientation and hole containment under one fixed32/200k
  ledger. Original pair cap2 stays unchanged. First build/lint/focused57/57 and whole kernel2097/0/6 existing
  skips plus code-shape/generated checks pass. Native diagonal triangle8892 operations; no physical solid,
  native trim/error/mass or product binding. Model/Studio/browser/performance NOT RUN for D300. See
  `../cylindrical-wrap-component-2026-10-29/README.md`. Next D301: native trim/error/radial-side/mass binding.
- D301 runtime`8ecc692bc` (2026-10-29) binds actual base/outer/degree(3,1) side coefficient data to
  authentic D300 components in their original live ledger. Exact factor2 sides are regular/injective and
  share only prescribed radial joins; retained-face closure/physical solid/mass/native evaluation remain false.
  First build/lint/focused63/63 and whole kernel2103/0/6 existing skips plus code-shape/generated checks pass.
  Actual native4-side proof10669 operations excludes its earlier67093-operation assembly. D300 selected
  receipts/counts stay unchanged. Model/Studio/browser/performance NOT RUN. See
  `../cylindrical-wrap-side-family-2026-10-29/README.md`; next D302 is the unchanged native D0 bound.
- D302 runtime`2f727cdd6` (2026-10-29) certifies existing native D0 whole-domain error for explicit
  one-span degree1..3 Curve /degreeU1..3 by V1 Surface templates. Existing math evaluator is unchanged.
  First build/lint/focused22/22, kernel2113/0/6 existing skips and code-shape/generated checks pass. Actual
  quarter bound9.39e-12 uses43306 operations separately; no full wrap/pcurve binding/mass proof.
  Model/Studio/browser/performance NOT RUN. See `../native-d0-bound-2026-10-29/README.md`. Next D303:
  one actual-native family envelope/two-span support, then complete coedge/reference/mass integration.
- D303 runtime`4e8516b78` (2026-10-29) adds one actual-native D0 family envelope: original quadratic
  half-wall spans, preserved repeated IDs by ordered slots/full data, one64-object/512-pole/200k ledger.
  First build/lint/focused29/29 and kernel2120/0/6 existing skips plus code-shape/generated checks pass.
  Native63-object/214-pole fixture bound3.44e-11 uses57349 operations, excluding assembly67093 and all
  coedge range/Lipschitz/residual/mass work. Five old standalone full receipts/counts stay equal.
  Model/Studio/browser/performance NOT RUN. See `../native-d0-family-2026-10-29/README.md`. Next D304:
  actual coedge/vertex native binding, then closed reference/mass/product integration.
- Next: roadmap07's remaining wrap provider and broader face-fillet/thread ranges, then08,09. General/curved,
  rational/smooth wrapping, shaping, kerning, bidi and normalization remain unimplemented. D291's broader
  free-form pairs/concave/multi-span ranges stay open. No feature push, new PR or release. Next decision:D304.

The original hand-over below records the earlier stop. D288 closes its bounded CG1.3 unfinished list.

**Read first:**
1. this note;
2. `../claude-resume-2026-10-24/README.md` §1–§3 (where things are, tooling, verification windows) and
   `../claude-resume-2026-10-23/common.md` (standing rules) — still current except where this note says otherwise;
3. `../../roadmap.md` rows 07, 08, 09, 16 and 22 (the work in order);
4. `../../decisions.md` from D282 on (this session's decisions; the next free id is **D304**).

## 0. State at the stop

- **Worktree:** `.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, branch `local/cad-dev` (tracks
  `origin/local/cad-dev`).
- **develop:** PR [barocss/barocss#2225](https://github.com/barocss/barocss/pull/2225) (71 commits of this branch)
  merged as `bfc0eca33` on 2026-10-28.
- **Local, not pushed** (6 commits on top of that merge):

| Commit | What | Verified |
|---|---|---|
| `294cdda93` | D285: the surface march refuses only what it cannot place; 13 refusal codes listed | kernel full suite, model, studio |
| `02834c6b2` | D286: a chain ending at a tangent touch on a box side ends at the touch; 2 more refusal codes; docs formula box wraps | kernel full suite, model, studio |
| `5fc822642` | native-split demo accepts any Node 22 | that test |
| `7edace60d` | F2 re-measured (docs only) | — |
| `f7120e8bf` | D287: a whole turn of one cylinder's pieces joined in two halves | kernel full suite (1 conformance case renamed, rerun alone), model 1711/1711, studio 351/351, bench shape |
| `bbc921cf7` | **WIP** CG1.3 general loft guide (below) | kernel `loft-nurbs-guide.test.mjs` 6/6 and tsc only |

- **Kernel baseline:** the 28 failures kept as a baseline before this session all pass now (D285–D287 and the Node
  pin). A full kernel run should show 0 failures; anything failing is new. (Last full run: before `bbc921cf7`.)
- Push, PR and release only when the owner asks (memory `no-push-for-now`, `local-batch-then-merge`).

### 0.1 Pushed and going into develop (owner, 2026-10-28: "push", then "develop 에 머지 해줘")

- `local/cad-dev` is pushed. The remote branch had been deleted when #2225 merged (the repository deletes merged head
  branches), so the push created it again; nothing was overwritten.
- PR [barocss/barocss#2226](https://github.com/barocss/barocss/pull/2226) → develop holds the commits above plus this
  note and `6908675ca`, a merge of `origin/develop` into the branch (develop requires an up-to-date branch; it only
  brought #2225's merge commit, a zero-line diff). **Auto-merge is on (merge commit)**: GitHub merges it when the
  required "Test and Build" check passes. At the time of writing CI was still running — it was **not merged yet**.
- **First thing on resume:** `gh pr view 2226 --json state,mergedAt,statusCheckRollup`.
  - Merged: switch to develop (or keep `local/cad-dev` and merge develop into it), then continue §1.
  - A failed check: read its log (`gh run view --log-failed`), fix on `local/cad-dev` with new commits (no amend,
    rebase or force push), push; auto-merge stays on. After a merge, a later push to `local/cad-dev` creates the branch
    again; open a new PR for the next batch.
- **What develop then contains that is not finished:** the CG1.3 WIP commit `bbc921cf7`. The kernel side is done and
  tested; the Studio Loft command still cannot use a nurbs guide (it builds framed sections, which refuse it). Existing
  Bézier guides behave as before. Nothing user-facing claims the new guide works in Studio.
- **Not run on the WIP commit:** the kernel full suite, cad-model and studio suites (their last full pass is
  `f7120e8bf`), and the docs table checks (`agent-tools.mjs --check`, `refusals.mjs --check`). Only
  `loft-nurbs-guide.test.mjs` 6/6, kernel and cad-model tsc and eslint ran. CI's "Test and Build" is the first full
  run; if it fails there, that is where to start.

## 1. In progress: CG1.3 general loft guide (roadmap 07, "일반 가이드 로프트")

**Done in the kernel** (`packages/barocss-cad/src/features/loft-nurbs-guide.ts`, `loft.ts`, `part/part-model.ts`):
- `guide: { kind: 'nurbs', degree 1–5, knots (clamped), controlPoints }` on sections stacked by z (the ruled path, 2–8
  sections). The guide must pass through a vertex of each section; each section is turned to start there.
- Each span's side = ruled side + (guide − its chord), exact: the chord raised into the guide's basis by its Greville
  abscissae. Control points must rise strictly along the normal (so every slice is a translated plane section at its
  own height: as simple as the ruled loft).
- The guide is cut at each inner section's crossing (bisection on the monotone height; a crossing at an existing knot
  is taken as that knot — bisected, it landed an ulp beside it and left a zero-length piece).
- Mass: Gauss with 2p + 2 points per knot interval (`guidedSpanMoments`).
- Part model: a `nurbs` guide with `{sketch, z}` sections takes the z path, the guide converted from world into the
  sketch frame (`guideInFrame`). With framed sections it still goes to the framed path, which refuses a nurbs guide.
- Refused: smooth sections, a guide missing a section vertex, one not rising, one not ending on the top section.
- Existing Bézier guides are untouched (their path and arithmetic unchanged; weights now sized by control points,
  the same number for them).

**Done in cad-model (type-checked only):** `chat/features.ts` `loft-guide` accepts a nurbs guide; `api/part.ts`
doc comment.

**Left, in this order:**
1. `app/loftGuides.ts` `copyLoftGuide`: keep one Bézier span (degree 2/3) as today; otherwise copy a polynomial
   B-spline (degree 1–5, equal weights) as `{ kind: 'nurbs', … }`.
2. `app/profileCommands.ts` `loftCommand`: a nurbs guide builds **z sections** (`loftSections`, as the unguided
   branch), not `framedLoftSections`; its steps text says the guide must pass through a vertex of each section.
3. Tests: cad-model (`api` loft with a nurbs guide; copyLoftGuide of a multi-span curve), studio chat/tool schema
   (`apps/cad-studio/test/chat.test.ts` covers tool docs vs HUD), and a browser check of the Loft command with a
   direct curve as guide (Studio dev server, see the 10-24 note §2).
4. Run the kernel full suite, cad-model, studio; `node apps/library-docs/scripts/agent-tools.mjs --check` and
   `refusals.mjs --check` (regenerate in the same commit if they differ).
5. Decision record **D288** (semantics above, the oracles in the test) and roadmap row 07 (`일반 가이드 로프트` → done
   for one guide; two guides / smooth / framed sections stay open). Docs page if the loft page lists guide kinds.
6. Follow-ups noted, not started: two guides (similarity per slice), a guide with smooth sections, nurbs guides on
   framed (non-z) sections, rational guides.

## 2. Next, in the owner's order ("순서대로 진행해줘", 2026-10-28)

1. **07 remaining:** face fillet on free-form faces; face thread evaluation time (0.6–2.4 s); text / wrap needs the
   owner's decision on a font source first.
2. **08** direct editing and surfaces: face move/delete/replace, curve and fill patterns, thicken/offset/knit/trim/
   extend remaining ranges.
3. **09** advanced sketch: spline handles, conics, sketch text/blocks, constraint diagnostics in the UI.

Smaller items found this session:
- D287: the pin over a round has one edge more than the bare pin (71 vs 70); faces and volume equal.
- Roadmap 22 leftovers: snapshot 37 places, `no-loop-func` 55 outside hot folders, code-shape limits to 0.
- 5 NURBS demos under `examples/cad-nurbs` that need a build kept elsewhere or import TS sources (excluded from
  `test/nurbs-demos.test.mjs`).
- Roadmap 16's concrete kernel/robot items were checked and found done (revolve admission, robot export notes,
  R7.7b renames); what remains there is scope text, not tasks.

## 3. How this session worked (tools that matter)

- **Node 22** (`/Users/user/Library/pnpm/nodejs/22.19.0/bin/node`); build the kernel with
  `node scripts/tool.mjs build` in `packages/barocss-cad` before its tests (they read `dist/`).
- **Heavy runs through the gate** (memory `machine-load-limits`):
  `G=~/.claude/local-mods/barocss-lanes-guard/bin/gate.sh; $G acquire heavy 1800 "label" && (…; $G release)`,
  run in the background. Kernel: `node --test --test-concurrency=4 test/*.test.mjs`; cad-model and studio:
  `node scripts/test.mjs` in their folders.
- **Perf A/B:** `scripts/perf-bench.mjs` (`BASE=… save|compare` bit fingerprints, `SHAPE=… shape-save|shape-compare`)
  and `scripts/perf-profile.py self|under|callers` on `node --cpu-prof` output (memory `kernel-perf-tools-and-rules`).
  Bench case `tee60-over-round` is the face-fillet-over-round workload.
- **Docs site:** VitePress `apps/library-docs`, launch config `library-docs` (port 52161); "How it works" pages under
  `docs/how/`, figure components under `docs/.vitepress/components/algorithms/`, their kernel ports checked by
  `samples/how-ports.test.mjs`. Desktop only (owner: no mobile checks).
- Replies to the owner in Korean, every message (memory `reply-in-korean`); code, commits and records in English.
