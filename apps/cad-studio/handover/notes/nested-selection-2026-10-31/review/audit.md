# Independent audit: roadmap 10 ②c nested selection (feature tier, one round)

Verdict: **CHANGES_REQUIRED** (2 medium, 2 low).

## Findings

1. **Medium (performance regression).** App.tsx:1707 memoises `viewportInstanceSel` on the whole `doc`, and
   nestedSelection.ts:80 always returns a fresh array. Probe3 shows the result is never the input reference, even for `['p1']` or `[]`.
   Before this change the viewport received the stable `instanceSel` state. Now every commit, including an edit to the base part alone, re-runs
   `Viewport.setInstances` (Viewport.tsx:686). On WebGL2 that runs `paintInstanceFaces`, a per-vertex loop plus bufferSubData over every
   instance body. On WebGPU it re-hashes `signature` for every body and runs paintInstances. This holds with no selection at all.
   Expected: the same reference when no entry is nested, with deps on `doc.instances`.
2. **Medium (an action reaches the wrong part).** At App.tsx:1925 the Render panel turns a nested selection into `inst:<host>`.
   The outliner can still be clicked while rendering. If you pick `p1/p2` and change its appearance, the whole sub-assembly is recoloured,
   but the viewport outlines only p2 and the panel says "1 selected body". Expected: no key, with a hint, for a nested entry. Alternatively, a per-part key.
3. **Low (body mapping uses a different document than the bodies).** nestedSelection.ts:65 maps face names through `doc.instances`,
   but the bodies come from `shownDoc`. Under a variant component swap (`variantOf` replaces `inst.doc`), and in the window between a host edit
   and re-evaluation, the wrong body lights up and the card is inconsistent. Probe2 swaps the host document while the old bodies remain.
   `p1/p2` then lights the old cylinder, and the card reads title "Sub › A" (a 4000 mm³ slab) with volume 2356 mm³.
   In the same window, a host document that refuses flattening makes `bodiesWithin` and `nestedCard` throw inside App's render.
   Probe2 shows the `[BAD_REFERENCE] Route bundle…` refusal thrown. Fix: map through `instanceBodies.get(host).inst.doc`, the instance that was
   evaluated, and/or guard with try/catch.
4. **Low.** A nested part whose faces carry no feature id (an imported mesh, for example) shows Bodies 0 and Volume "0 mm³"
   (nestedSelection.ts:106). It should show "…" or "unknown". Separately, `nestedRows` has an inner `walk` closure. It is not on a per-frame path; this is a nit.

## Checked and found correct

- bodyOriginOf / bodiesWithin, probe1. These cases resolve correctly:
  - the sub-assembly's own body beside its parts: origins `['', 'p1', 'p2']`
  - the same after placedDoc with rotation and position: identical
  - a part with a hole, and a linear-pattern part
  - an inner sub-assembly that has its own body: `p2` gives [1, 2] and `p2/p1` gives [2]
  - a hidden sibling at depth
  - the card for `p1/p2/p1`: volume π·25·20, placed in Inner
- The sub-assembly's own features cannot use nested bodies, because flatten puts own nodes first. So no body can mix own faces with part faces.
- Readers of `instanceSel`:
  - gizmo, MatePanel and mate faces use `singleTop`.
  - InstancePanel and pattern delete find no instance for a path.
  - Delete, Ctrl+D, nudge, F and the context menu act only on the body selection, which a row pick clears.
  - Isolation uses the host.
  - Picking, clearance and chat never read the selection.
  - Nothing edits a nested placement.
- Stale paths (part removed or hidden, host deleted, undo) produce null or empty results with no error, apart from finding 3.
- Renderers: whole-id behaviour is unchanged. WebGL2 and WebGPU both use the same `instanceBodyLit` with `sourceBodies`, and there is no per-frame allocation.
- NestedPartPanel is read-only.
- The api-inventory diff only adds the 3 exports.

## Ran

- probe1.ts, probe2.ts, probe3.ts in this folder, bundled with esbuild and run on Node 22.
- Under the gate:
  - cad-model `body-origin`: 4 pass
  - cad-studio `nested-selection instance`: 16 pass
  - cad-studio `tsc --noEmit`: clean

Browsers were not run.
