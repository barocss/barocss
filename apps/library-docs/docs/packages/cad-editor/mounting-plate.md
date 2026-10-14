# Build a mounting plate with a through-hole

**Level:** beginner → intermediate · **Workspace:** local CAD Editor `#/model` · **Units:** millimetres.

This exercise makes a rectangular plate with one circular through-hole, changes the hole size and location, and checks what the resulting native model can—and cannot—certify. It uses the editor's existing **Mounting plate with a through-hole** example; you do not have to write source programs, topology IDs, or document JSON.

## Open the modeling workspace

From a configured Node 22+ repository workspace:

```sh
pnpm --filter @barocss/cad-editor build:library
pnpm --filter @barocss/cad-editor-app dev
```

Open `http://127.0.0.1:52010/#/model` (or the actual Vite port followed by `#/model`). The page heading is **Model a part**. Wait for **Accepted model**.

1. Open **Modeling examples** and its **Choose an example** menu.
2. Select **Mounting plate with a through-hole**.
3. If an earlier model exists, save anything important, then check **Replace accepted model and discard its history and pending dimensions**.
4. Choose **Load example**. Selecting the menu option alone does not replace the model.

## Understand the model before editing

The preset starts with an origin-aligned **80 × 40 × 8 mm** rectangular plate and a circular through-hole of **radius 5 mm**, centered at XY `[40,20]`. Z extrusion runs from 0 to 8 mm. The six numeric drivers correspond to `width`, `depth`, `height`, `centerX`, `centerY`, and `radius`. Here `depth` means the plate's Y dimension—not the hole's drilling depth.

The authoring chain is **rectangle sketch → +Z extrusion → qualified hole**. Its two named outputs remain saved:

| Output | Meaning | Actual native result |
| --- | --- | --- |
| `blank` | Original uncut rectangular plate | `convex-planar`; exact certified volume **25,600 mm³** |
| `plate` | Plate with one stored-rational hole | `stored-rational-plate-hole`; **Certified volume unavailable** |

Under **Visible output body** choose **plate** to inspect the hole, or **blank** to compare with the intact parent. The preset selects `plate` on load. Changing visibility does not remove the other saved output, alter dimensions or add an Undo history step. A generic Open chooses the last validated saved output; inspect the selected output name rather than relying on what was visible before saving.

## Resize the hole

1. Under **Named dimensions**, change `radius` from `5` to `2.5` mm.
2. Before committing, the status **Dimension changes pending** indicates a draft. The accepted geometry remains unchanged.
3. Select **Apply dimensions**. Once the status returns to **Accepted model**, inspect `plate` in the viewport.
4. Use **Undo** to restore the original accepted state and **Redo** to repeat the valid edit. To abandon an unaccepted value, choose **Discard draft**.

This radius change was measured in the existing native provider fixture and later in a [source-pinned browser/WebGL2 run](./manual-browser-1803). The screen's sampled opening is only an approximate view of the native boundary.

To move the narrowed hole off-center, try the separate accepted parameter batch `centerX: 32.5`, `centerY: 18.75` (mm), then **Apply dimensions**. The native provider fixture accepts this combination after the radius-2.5 edit. Treat it as a subsequent edit, not an instruction to change all dimensions before the first acceptance.

## Learn to handle an intentional refusal

The stored-rational qualification is intentionally strict. The existing native example records a candidate `width:81` after the radius-2.5 edit that **refuses** with a geometry-qualification cause. This is a bounded provider fixture, not a promise that every integer width behaves similarly or a generic restriction on rectangular plates.

From the accepted off-center state, changing `radius` to `18.75` reaches the plate boundary and refuses strict containment. A refused **Apply dimensions** must leave the previous accepted model and saved authored state intact. Review the actual diagnostic, then correct the field or choose **Discard draft**; do not silently clamp the radius, approximate an intersection, or delete the accepted result.

## Save, open, and edit again

Open **Save or open a model**.

1. Choose **Download model** to initiate `part.cad.json`. Verify the browser actually saved it.
2. Choose **Choose model file** and select the saved file. This stages decoded UTF-8 in **Saved model data**; **file selection is not model acceptance**.
3. Review the text. Check **Replace accepted model and discard its history and pending dimensions**, then select **Open saved model**.
4. After acceptance, select `plate` under **Visible output body** and try another supported `radius` edit.

The file reader refuses empty files, malformed UTF-8 and content larger than **262,144 bytes**. Reading does not replace the model or advance history; native validation only occurs on explicit Open. Saving preserves the authored sketch, extrusion, hole and numeric parameters—not the viewport screenshot or derived triangle mesh.

## Native qualification versus display preview

This distinction is essential:

- The `plate` native output has a qualified stored-rational genus-one boundary, with **7 native faces, 10 vertices, 15 edges, 9 loops and 30 directed edge uses**, for one material component. This is a bounded stored-coefficient claim, not unrestricted curved-solid CAD support.
- The separately sampled preview has **256 display vertices and 128 triangles**; display counts must not be mistaken for native B-Rep topology.
- Its preview retains `solid:false` and `topologyCertified:false`. Those flags concern the derived mesh; they do not undo the separately qualified native boundary.
- **Certified volume unavailable** for `plate` is neither zero nor empty. The exact **25,600 mm³** belongs to `blank`, before cutting the hole. No certified ideal-cylinder subtraction or manufacturing/mass claim follows.
- Approximate viewport face picking is not exact persistent topology identity, manufacturing certification, or a material-classification proof.

The authoritative details and the executable public TypeScript sample remain in [Mounting plate with a through-hole](../cad/modeling#mounting-plate-with-a-through-hole).

## Evidence status

**Source-backed here:** preset name, dimensions and named outputs, native provider receipt, accepted parameter edits/refusals, current UI controls, stage-before-Open semantics, and qualified versus sampled geometry distinctions.

**Later independent check:** the [source-pinned physical browser receipt](./manual-browser-1803) records actual radius 5→2.5 edits, off-center strict-containment refusal, `blank` versus uncertified `plate`, keyboard focus, WebGL2 readback and original screenshots. The [earlier plate receipt](https://github.com/barocss/barocss/wiki/CAD-Mounting-Plate-Physical-QA-2026-10-14) has its own source pin. The plate-specific physical download and fresh Open were not rerun in this documentation change; the L-bracket file flow was. Site deployment and release remain separate.

[First model: underside pocket](./first-model) · [Round post](./round-post) · [CAD Editor overview](./) · [Advanced modeling API](../cad/modeling)
