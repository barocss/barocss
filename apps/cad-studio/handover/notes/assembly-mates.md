# Assembly mates (session studio-mates) — hand-over

Branch: `claude/studio-mates` (worktree `.claude/worktrees/studio-mates-cbde0e`), cut from 1ff129f2.

## New files (no merge risk)
- `apps/cad-studio/src/assembly/mates.ts` — types (`Mate`, `MateRef`, `MateFace`) + analytic solver `solveAssembly`.
- `apps/cad-studio/src/assembly/faces.ts` — exact face table from the kernel B-rep (`faceGeometry`), snapped to 1e-9.
- `apps/cad-studio/src/assembly/faces.worker.ts`, `faceClient.ts` — a separate worker (the engine worker is untouched).
- `apps/cad-studio/src/assembly/useAssembly.ts` — hook: face tables, re-solve effect, Add-mate picks, edit/delete/ground,
  dev hook `window.__studioPickInstanceFace(instanceId, faceName)`.
- `apps/cad-studio/src/ui/MatePanel.tsx`, `apps/cad-studio/test/mates.test.ts`.

## Shared-file edits (thin)
- `engine/doc.ts`: `StudioDoc.mates?: Mate[]`, `PartInstance.grounded?: boolean`, one type import.
- `App.tsx`: imports; `commitAssembly` + `useAssembly(...)` next to `commitInstances`; `onPick` first asks
  `assembly.pick(hit)`; Escape cancels a mate draft; selection/instance highlight while picking; MatePanel after
  InstancePanel; Selection card hidden while picking; instance Remove also drops its mates; `onGround` for InstancePanel.
- `ui/InstancePanel.tsx`: optional `onGround` prop + "Fix in place"/"Unfix" button.
- `viewport/gpuRenderer.ts`, `renderer.ts`, `Viewport.tsx`: `pickInstanceFace` (instance + display face by the hit
  triangle); `onPick` hit gains optional `instanceFace`.
- `test/browser-flow.mjs`: one step 'mate the copy to the fixed bracket by its faces' right after
  'place another part as an instance'.
- No styles.css, commands.ts, kernel, manifest or lockfile changes (pnpm-lock.yaml is dirty locally from install; not committed).

## Semantics
- `a` stays, `b` moves. Base part never moves; `grounded` instances never move. Picks: 1st stays, 2nd moves (swapped if 2nd is fixed).
- coincident/distance: flat faces, normals opposed (flip: same way), offset along a's normal. concentric: round faces,
  axis sense "either way" by default (flip false = same, true = reversed).
- Re-solve runs on every instance/mate/base-part change and replaces the doc in place (no undo entry).
  Failing mates are flagged (warn colour + reason) and their instance stays put.

## Commits (on claude/studio-mates, base 1ff129f22)
- 612fb0c6b feat(cad-studio): analytic assembly mate solver
- 23637a450 feat(cad-studio): add, edit and delete assembly mates
- f1ad14240 fix(cad-studio): keep both mate picks when they come before a re-render
- 652bf8bf6 test(cad-studio): flow step for mating an instance by its faces

Verified: `pnpm test` 57/57, `pnpm type-check` clean, `vite build` ok, browser flow 32/32 on WebGPU (no page errors).
Note for flow merges: the new step is #31; it leaves `bracket` grounded at Z 5 and one coincident mate on the copy.
Under-constrained directions keep the smallest move: moving a fixed part along a free direction does not drag mated parts along it.

## Round 2 (on top of claude/cad-studio-2026-10-16 @ 2d9c79bc, fast-forwarded)
- 23dfc8b4a feat(cad-studio): mated parts move with the part they are mated to (mates.ts here also already holds the angle solver code)
- 108aef9be feat(cad-studio): angle mate between flat faces (UI, flow step extension)
Shared files touched: none beyond apps/cad-studio/src/assembly/*, ui/MatePanel.tsx, test/mates.test.ts, test/browser-flow.mjs (mates step only).
Verified: unit 67/67, type-check clean, flow 33/33 on WebGPU.

- 7205e684d feat(cad-studio): tangent mate between a round face and a flat face (tangent mate; unit 68/68, flow 33/33)
- 144af00ef feat(cad-studio): tangent mate between two round faces (round-to-round tangent; unit 69/69, flow 33/33)

## QA fixes (on integration tip 356c3a7f via merge 68011f019)
- 28cfdab95 A1: any X/Y rotation placed exactly (rotationSteps in assembly/mates.ts, used by placedDoc in engine/doc.ts); angles snapped to 1e-6 deg
- 994f611a3 A2: History chip clears instance/curve selection and mate picking (App.tsx, one line); flow asserts it
Verified: unit 84/84, type-check clean, flow 37/37 on WebGPU. X1 (interference) untouched as asked.
- 2e0b072b5 feat(cad-studio): show mate faces on instances and the base part (mate faces highlighted; unit 84/84, flow 37/37)
- 084ccd0b0 feat(cad-studio): a part wedged against two round faces (wedge between two round faces; unit 85/85, flow 37/37)
- e5a96d43d feat(cad-studio): show what a mated part can still do (remaining freedom shown; unit 86/86, flow 37/37)
- 350f90a60 feat(cad-studio): mate to a part's origin planes (origin plane mates; unit 87/87, flow 37/37)
- 0044a62e8 feat(cad-studio): lock mates and sub-assemblies (lock mate + sub-assemblies: assembly/flatten.ts, placedDoc uses it, insertPart keeps instances; unit 89/89, flow 37/37)
