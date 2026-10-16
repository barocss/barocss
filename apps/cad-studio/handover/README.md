# cad-studio hand-over — 2026-10-16

Hand-over from the Claude account that ran the 2026-10-16 cad-studio work (organization NAVER_TEAM_17,
then the next one) to whoever continues it. Session transcripts do not move between accounts; this folder,
the git history and the QA report are the record. Everything is **local only**: nothing was pushed, no PR,
no npm publish.

## 1. Where the work is

| What | Value |
|---|---|
| Integration branch | `claude/cad-studio-2026-10-16` |
| Its tip at hand-over | the commit that adds this folder (`git log -1 -- apps/cad-studio/handover`); code tip `d476654c`. Every merge is `merge(cad-studio): …` |
| Worktree it is checked out in | `.claude/worktrees/barocss-naver-team-17-cfd156` |
| Cut from | `review/cad-gpu-engine-2026-10-14` @ `c73bf909` (the earlier single-engine/cad-studio line) |
| Relation to `develop` | ~1,380 commits ahead, 2 behind (`57ad0fd0`, `1edc9026` — Integration's docs/viewer commits) |
| Also on | `review/cad-gpu-engine-2026-10-14` was fast-forwarded to the hand-over tip on 2026-10-16 (owner's choice), so it and `claude/cad-studio-2026-10-16` point at the same commit. It is checked out in `.claude/worktrees/barocss-cad-gpu-review-efbb2c` (untracked drafts there kept). Merging into local `develop` (owned by Execute Integration per AGENTS.md) was not done. |

Feature branches (all merged into the integration branch; each has its own worktree under `.claude/worktrees/`):

| Lane | Branch | Worktree | Owns |
|---|---|---|---|
| Sketch constraints & dimensions | `claude/studio-constraints-371737` | `studio-constraints-371737` | `src/sketch/*`, `ui/ConstraintTools.tsx`, `ui/SketchMarks.tsx`, `ui/constraints.css` |
| Assembly mates | `claude/studio-mates` | `studio-mates-cbde0e` (checked out on `claude/studio-mates`) | `src/assembly/*`, `ui/MatePanel.tsx` |
| 2D drawings | `claude/studio-drawings-cd772f` | `studio-drawings-cd772f` | `src/drawing/*`, `ui/DrawingWorkspace.tsx`, kernel `brep-hidden-line.ts` |
| Chat-driven modeling | `claude/studio-chat` | `great-einstein-3ea69b` | `src/chat/*`, `server/*`, `ui/ChatPanel.tsx`, `ui/chat.css` |
| QA tester (report only) | `claude/studio-tester-412a82` | `studio-tester-412a82` | `test/qa/*` |
| Integration + core fixes | `claude/cad-studio-2026-10-16` | `barocss-naver-team-17-cfd156` | merges, `engine/errors.ts`, `app/measure.ts`, kernel `edge-finish.ts` / `part-model.ts` fixes |

`.claude/worktrees/amazing-euler-c18b94` is a stopped duplicate chat session (no commits); it can be removed.
Per-lane notes written by each session are copied in [`notes/`](notes/).

## 2. Run and verify

```bash
export PATH=$HOME/.nvm/versions/node/v22.19.0/bin:$PATH        # Node 22; Node 18 breaks the gpu tests
pnpm install --no-frozen-lockfile --prefer-offline              # the lockfile lags apps/cad-studio; never commit pnpm-lock.yaml
(cd packages/barocss-cad && pnpm build:library)                 # never bare tsc there (it overwrites dist)
(cd packages/barocss-gpu && pnpm build:library)
cd apps/cad-studio
pnpm dev                                                         # http://127.0.0.1:52020
pnpm test && pnpm type-check                                     # unit tests (node --test via esbuild)
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
PW_DIR=/Users/user/.npm/_npx/e41f203b7505f1fb/node_modules/playwright \
node test/browser-flow.mjs /tmp/cad-studio-flow                  # real Chromium, WebGPU, ~5 min, a screenshot per step
pnpm chat                                                        # optional: chat server on 127.0.0.1:52021 (uses the local `claude` CLI login)
```

Kernel suite: `cd packages/barocss-cad && pnpm build:library && pnpm test`. One test,
`actual native Split source produces validated scoped Face reference resolutions`, always fails here: the
example demo it runs pins Node 22.23.3 and this machine has 22.19.0. It is environmental, not a regression.

Last verified state at hand-over:
- `pnpm test` 123/123 and `pnpm type-check` clean on the hand-over tip (the QA probes in `test/qa/` are excluded
  from the type-check; they run through esbuild).
- Browser flow 44/44 on WebGPU: run by the integrator on `8e2c4b17`, and by the drawings session on `a2243e58`,
  whose tree is identical to the drawings merge `85f5e6ed` (later merges add only `test/qa/` and this folder).
- Kernel suite 826 pass / 1 environmental fail on `d5fa5fa6`; hidden-line tests 10/10 on `a2243e58`.

QA probes (from the tester lane, now in `test/qa/`, report in `test/qa/REPORT.md`):
`node test/qa/run-engine-probe.mjs [probe.ts]` (engine level, seconds) and
`PW_DIR=… CHROME=… node test/qa/ui-probe.mjs /tmp/cad-studio-qa [case-regex]` (real app, ~10 min).

## 3. What cad-studio does now (added 2026-10-16)

- **Sketch**: sketch on faces (flat, side, sloped), XY/XZ/YZ planes with offset and angle. Explicit
  constraints (H, V, parallel, perpendicular, coincident/fix, equal) and driving dimensions (length, radius,
  ΔX/ΔY, angle, point distances, circles placed from outline corners/edges and from each other), all
  refused with a reason when redundant or conflicting. They are kept in the sketch node (`outline`), drive the
  feature editor, and a finished sketch reopens for editing. Sketch-level undo/redo while sketching.
- **Assembly**: part instances with mates: coincident, distance, angle, concentric, tangent
  (round–flat, round–round), wedge between two round faces, origin planes, lock; grounded parts;
  sub-assemblies (an inserted file's own instances); remaining freedom shown; mates re-solve when parts change.
- **Drawing workspace**: third/first-angle standard views and isometric from an exact hidden-line projection
  (kernel `projectBrepHiddenLines`); centre marks and centrelines; tangent edges (optional); section A–A;
  linear, diameter/radius and angular dimensions that follow the model, with tolerances (±, deviations, fit
  codes); notes with leaders; title block (fields fit their cells);
  instances on the sheet; SVG and PDF export.
- **Chat modeling**: chat panel, with each turn run by the local `claude` CLI against the studio's own tools
  only (an MCP server over the real command builders; no file/shell tools). It covers parts, assemblies
  (instances, placement, mates), image attachments, and bitmap → relief or inflated 3D figure. The server binds
  127.0.0.1 and refuses cross-site requests.
- **Core fixes from QA**: pipe angle; unreadable STEP keeps the open part; draft/revolve refusal reasons; exact arc
  length; removed-features count; overlapping sketch shapes refused (no silent cut); fillet/chamfer wider than
  its wall refused; unions touching only at an edge/point refused; honest message for curved-face union failures.

### Usability pass (2026-10-17, `review/cad-gpu-engine-2026-10-14`, local commits only)

The owner's bar: cad-studio should feel like a commercial CAD tool (mouse-driven handles everywhere, no
beginner-ish tools, one consistent icon set). What landed, one commit each (`git log 134071aa..`):
- **Handles everywhere**: every shape (box … prism) has a puck to slide it and arrows for its sizes, when made
  and when edited (a shape's solid remembers its command and values, `made`, and edits as itself — Edit Box,
  Edit Sphere); hole centre puck, blind depth, counterbore size/depth; shell wall; split plane; linear pattern
  spacing and count; circular pattern axis puck and spread arc; revolve angle arc; fillet/chamfer limits.
  Picking a face or edge edits the feature it came from (each of several holes).
- **Shapes**: sphere, cone/frustum, torus, tube, wedge, polygon prism beside box and cylinder, in a top
  shapes bar; a shape follows the pointer onto the ground or an upward face until a click, or is dragged from
  the bar and dropped.
- **Faces as inputs**: Extrude on a picked flat face (push/pull, its outline fitted back to lines and arcs,
  holes too); Fillet/Chamfer on a picked face take all its edges; Align puts a face on another body's face
  (turning by quarter turns when needed) or a body on the floor; Mirror across any face's plane.
- **Bodies**: Browser panel at the left (eye, colour dot, rename, sketches, parts, curves); per-body name,
  colour and visibility (`StudioDoc.bodies`, keyed by the body's first feature, so they survive added
  features and renumbering); right-click Hide / Show only this / Show all / Delete; Delete key; Duplicate (⌘D)
  as a separate body; patterns can make separate bodies.
- **Inspect and view**: view cube; section view (kernel split, display only, cut faces lit); interference
  check; centre of mass and surface area; `?` lists keys and mouse.
- **Sketch**: object snaps (ends, middles, centres, quadrants, model corners/edge middles/hole centres in the
  plane, origin).
- **Speed and fixes**: dragging a handle on a feature under fillets previews the part up to that feature
  while moving and the whole part on pause; command previews have their own kernel cache and no mass
  properties; selections follow re-evaluation by name; the key listener always sees the newest selection;
  New part clears instance/direct/measure picks; F stays Fit view, Fillet is Shift F.
- **Icons**: one generated system in `src/ui/cadIcons.tsx` (shared isometric projection, opaque three-tone
  faces mixed into `--icon-bg`, accent `--icon-ac`); check them with `test/qa/icon-sheet.tsx` (renders a sheet).

Later the same night (`ab879125..`): previews tint the bodies a command adds; the command HUD sits at the
right (the Selection panel's place) so it no longer covers the model; arrow keys nudge the picked body
(Shift 10 mm, PgUp/PgDn for Z, one history step per run); ⌘C/⌘V copy and paste bodies; sketch construction
shapes (X: dashed references kept with the sketch, never sent to the kernel); sketch tool and history icons in
the CAD set; right-click a history step to edit, edit its sketch, roll back or delete it; the sketch hint bar at
the top; the rail hidden in Drawing.

Then: double-click picks a whole body and F frames what is picked; **standard fasteners stage 1** (#2094): a
catalogue (`src/app/fasteners.ts`, ISO 4017/4762/4032/7089 nominal sizes M3–M12 with sources), simple shapes,
a cosmetic thread kept with the part and shown in the Body panel (no helical geometry), placement that takes a
round hole's axis and rim, editing size/length in place (a multi-step shape remembers `made.nodes`), one history
entry per part. Stages 2–4 of #2094 (verified size/length tables with versions, explicit assembly placement,
real threads) are not started; nothing was posted to the issue.

Verified at the last commit of the pass: unit 167/167, type-check and lint clean, browser flow 64/64 (WebGPU),
QA probe 70/73 before its helper fix (the three remaining were the helper; U4x/U5x pass after it).
The flow takes `FLOW_ONLY=<regex>` to run the first step and the matching ones. The QA probe
(`test/qa/ui-probe.mjs`) was brought to the new flows (shape labels, Finish then E, Mirror's default plane);
note that it hot-reloads if sources change while it runs, and its cases depend on the ones before them.

Still open from this pass: kernel fillet ~140 ms per evaluation (dragging a fillet's own radius waits on it;
two thirds of it is `edge-finish.ts` `joinTouching` unioning the corner-mitred tools one by one);
the sketch solver's 16-point admission limit is part of the kernel's frozen `bounded-length-angle-v0`
contract (a test checks it), so it was left for the kernel owner;
a GPU clipping plane would make the section view instant; sketch trim/offset/construction lines; the
QA `test/qa/ui-probe.mjs` predates the new sketch flow (Finish no longer opens Extrude).

## 4. Open items (not done)

QA stopped after its fifth pass on `d5fa5fa6` (see `test/qa/REPORT.md`): every routed finding is fixed there and
nothing regressed; `8e2c4b17` and later (lock mates, chat assembly tools, circles from edges, drawing
tolerances/notes) were not QA-tested.

Closed on `review/cad-gpu-engine-2026-10-14` after the hand-over (2026-10-16, one commit each, unit +
type-check + browser flow 45/45, kernel suite where `packages/barocss-cad` changed):
- **S4** a dimension that pushes an attached circle across the outline's edge or off it is refused; Finish
  also catches crossings whose sample lands exactly on the edge (`aa5e88aa`).
- **A3** a flat mate with an origin plane lines the planes up by default; Flip opposes them (`157d3d48`).
  Mates saved before with Flip on an origin plane now read as opposed.
- **U4** New part and Open close an open sketch and tool first (`f5eecae6`).
- **U5** the dev/preview server answers `/api/chat/status` with `{ enabled: false }` when no chat server
  listens, so no 502 is logged (`61c546e8`).
- **U1** Delete feature in the feature editor (and the Delete key); mates, drawing dimensions and render keys
  are renumbered, dimensions of a removed feature dropped with a toast; Undo restores (`a3c0d7ab`).
- **D2** a STEP with several solids opens as that many bodies (kernel `import` `each`, node `solids`, sides
  `part<k>`); files opened before stay one body (`3f2e02b4`).
- **D1, D4** curved B-rep mass by quadrature over the exact surfaces (`8bc8f295`): STEP re-open of torus,
  pipe and loft, and fillets at any radius, exact to ~1e-11; Booleans with real intersection trims ~1e-5.

Open, with IDs as in the report:
- **W5 (kernel)** narrowed: overlapping tori with different tube or ring radii join (5/4, 5/4.9, R31 vs R30);
  only *congruent* tori turned about a line through the ring centre fail ("edge … has 4 uses"). Their
  intersection passes where both tori's patch boundaries (the inner equators) cross, and a piece there is
  found by two neighbouring patch pairs. Joining marched branches at tangential crossings did not fix it
  (tried, reverted). Next step: dedupe cut pieces that lie on a patch boundary shared by two face pairs in
  `analytic-boolean.ts` `cutPair`/`march`.
- **E15 (kernel)** the kernel still accepts a `holes` loop that crosses the outer loop (the app refuses it).
- **W1 (rest)** overlapping shapes in one sketch are refused; an actual union of them is not implemented.
- **X1** interference between bodies of the part: done (Inspect › Interference); between placed instances still not.
- Sketch solver: about 16 points per outline; each placed circle costs helper points, so two fully placed
  holes nearly reach it ("Too many points…").
- Drawings: one section only (parallel to the front view), no dimensions on the section or iso view.

Chat backlog (from the chat session): threads/springs/involute gears/helical surfaces need kernel features;
Booleans with lofted bodies are slow (~7 s) and bump-onto-loft unions can fail; smooth loft ≤ 5 sections and
≤ 64 segments per loop; image → 3D only inflates the front silhouette; every tool call re-evaluates the part
(24-step turn cap); buildings beyond massing are out of scope; image tracing checked on one cartoon only.

Deferred earlier (owner said docs later, cad-studio first): library-docs shader demo hosts still on app-owned
WebGL2 (an uncommitted WGSL draft `packages/barocss-gpu/src/engine-uv-material-wgsl.ts` sits in the
`barocss-cad-gpu-review-efbb2c` worktree); docs screenshots from removed renderers; gpu `test:consumer`
fails because the package `files` include `src`.

## 5. Ways of working that held up

- One integrator merges every lane serially (`git merge --no-ff`, message `merge(cad-studio): …`), then runs
  unit + type-check + the browser flow (and the kernel suite when `packages/barocss-cad` changed) before the
  next merge. Lanes merge the integration tip into their branch before new work.
- Lanes keep logic in their own new files; shared files (`App.tsx`, `Viewport.tsx`, `engine/doc.ts`,
  `browser-flow.mjs`) get thin wiring only, and each lane adds flow steps at its own anchor.
- The QA tester never edits product code; findings are tagged `[sketch-constraints]`, `[assembly-mates]`,
  `[drawing]` or `[core]` and routed to the owning lane.
- Git identity `easylogic <cyberuls@gmail.com>`; commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  Read `AGENTS.md` (owner decisions) before merging anything into `develop` or touching root/workspace files.
- The owner prefers replies in Korean; code, commits and notes in English. cad-studio is the single app on
  the one `@barocss/gpu` viewer engine (old cad-editor/render-editor were folded in and deleted).

## 6. Starting prompt for the next account

> Continue cad-studio from `apps/cad-studio/handover/README.md` on branch `claude/cad-studio-2026-10-16`
> (worktree `.claude/worktrees/barocss-naver-team-17-cfd156`). Verify the tip with section 2 first, then ask
> me which open item in section 4 to take next.
