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
  Non-adjacent free-form replacement and multi-span/rational end extension are still open.
- The owner delegated choosing several open-source fonts. Unmodified ABeeZee, Nanum Gothic and Nanum Myeongjo TTFs
  plus their OFL originals are saved in test/fixtures/fonts, commit `9fe4be221`. Fixed upstream URLs and binary
  metadata are recorded there. No parser, text shaping, emboss or wrap support is implied.
- Next: roadmap07's non-adjacent free-form face fillet needs conservative Boolean face provenance before acceptance.
  Thread speed baseline (median5, same local Node): shaft628ms, tapped hole609ms. A profile identifies repeated cached
  boundary-distance scans; no speed change has been adopted yet. Then text/wrap, 08, 09. The next decision is D290.

The original hand-over below records the earlier stop. D288 closes its bounded CG1.3 unfinished list.

**Read first:**
1. this note;
2. `../claude-resume-2026-10-24/README.md` §1–§3 (where things are, tooling, verification windows) and
   `../claude-resume-2026-10-23/common.md` (standing rules) — still current except where this note says otherwise;
3. `../../roadmap.md` rows 07, 08, 09, 16 and 22 (the work in order);
4. `../../decisions.md` from D282 on (this session's decisions; the next free id is **D288**).

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
