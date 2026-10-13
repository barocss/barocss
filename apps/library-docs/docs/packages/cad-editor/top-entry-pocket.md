# Cut a pocket from the top of a plate

**Lesson 5 · Level:** beginner → intermediate · **Workspace:** CAD Editor `#/model` · **Units:** mm

Make a real **top-entry recess** in a 32 × 24 × 8 mm plate, deepen it into a through-window, then save and reopen the authored part. This differs from [Lesson 1's underside-entry pocket](./first-model): the cutting tool starts at the *top*, not Z=0.

> This is a source-backed guide for the local experimental editor. The native provider measured the values below; this lesson has **not** independently captured browser screenshots, GPU output or a physical file round-trip.

## 1. Load the correct example

Use a repository workspace with Node 22+ and its existing dependencies:

```sh
pnpm --filter @barocss/cad-editor build:library
pnpm --filter @barocss/cad-editor-app dev
```

Open `http://127.0.0.1:52010/#/model` (or the port Vite printed, plus `#/model`). Under **Model a part**, wait for **Accepted model**.

1. Expand **Modeling examples** → **Choose an example**, then select **Cut a top-entry pocket**.
2. Save any earlier part you need. If a model is already accepted, check **Replace accepted model and discard its history and pending dimensions**.
3. Click **Load example** and wait for **Accepted model**. Choosing an example in the list alone does not replace the accepted model.
4. Under **Visible output body**, select `part` if needed.

The preset retains three named outputs: `plate` (original stock), `tool` (the rectangular cutter) and `part` (material left after the cut). Hidden outputs are still authored and validated.

## 2. Learn which direction the tool moves

The 8 mm-thick plate occupies Z=0..8. The tool's X range is fixed at **8..24 mm**. Its Y range comes from **Tool Y origin** and **Tool Y span**; their initial values are 8 mm each.

| Inspector label | Parameter | Starts at | Role |
| --- | --- | ---: | --- |
| **Pocket depth downward from top Z=8** | `depth` | 4 mm | How far the cutter enters from the top |
| **Tool Y origin** | `toolY` | 8 mm | Lower Y location of the cutter |
| **Tool Y span** | `toolSpanY` | 8 mm | Extent in Y, not depth |

The model owns the derived dimension **`from = 8 - depth`**. The cutter extrudes *upward* by positive `depth` starting at `from`, so its top stays at Z=8 while its bottom moves down. There is **no separate free-standing `from` field** in this preset; entering an offset in a generic imported graph is a different authoring contract. Unlike the underside pocket, this one leaves the lower plate face intact while the recess is shallow.

## 3. Deepen the recess

Change only the labeled **Pocket depth downward from top Z=8** field, one accepted step at a time:

1. With depth **4**, the pocket has a 4 mm-thick floor at **Z=4**. Inspect `part`, not the cutter.
2. Type **6**. **Dimension changes pending** means this is only a draft. Select **Apply dimensions**, wait for **Accepted model**, then inspect the deeper recess. Its floor is at **Z=2**.
3. Type **8** and **Apply dimensions**. The cutter now spans Z=0..8; the aperture becomes a **through-window** with no floor.
4. Use **Undo**/**Redo** to compare accepted steps. If a draft is pending, use **Discard draft** or apply it before asking for history changes.

These are **previously measured qualified native volumes** for the `part` output, not values inferred from new screen pixels:

| Accepted depth | Tool lower Z (`from`) | Result | `part` volume |
| ---: | ---: | --- | ---: |
| 4 mm | 4 mm | Recess with floor Z=4 | **5632 mm³** |
| 6 mm | 2 mm | Recess with floor Z=2 | **5376 mm³** |
| 8 mm | 0 mm | Through-window | **5120 mm³** |

The existing [native API recipe and accepted provider evidence](../cad/modeling#cut-a-top-entry-pocket) establish these particular dimensions. The viewport mesh is derived from accepted native data; it does not independently certify volume or exact material.

## 4. Understand an intentional refusal

One measured provider counterexample widens the through-cut across the plate and receives **two disconnected remaining components**. The single-result `part` authoring contract refuses that request instead of picking one component or welding them. This is a specialized fixture, **not a user-facing "width" slider on this preset**: X remains fixed at 8..24, so do not search for a missing width control.

The current UI can also refuse invalid or nonrepresentable tool dimensions, positive-height violations, geometry qualification, or the 64-panel display limit. A refused **Apply dimensions** preserves the previous accepted snapshot, history and authored text. Check the actual diagnostic, then correct or **Discard draft**. Do not infer that a native acceptance guarantees a GPU frame.

## 5. Save and reopen the authored model

Open **Save or open a model**. Choose **Download model** to initiate `part.cad.json` and verify that a file actually appears on disk. Then choose **Choose model file** and select it. File selection only places UTF-8 text into **Saved model data**; it neither evaluates geometry nor replaces an accepted document.

Review the text, check **Replace accepted model and discard its history and pending dimensions**, and select **Open saved model**. The model is rebuilt from the authored sketch, extrusion, derived lower-origin expression, cut, and named parameters—not a saved mesh or camera.

**Important:** the preset initially selects `part`, but generic Open chooses the last saved output in canonical order `part,plate,tool`, which is `tool`. Use **Visible output body** to choose `part` again before deciding the pocket disappeared. Editing depth after Open establishes an editable recipe; simply seeing an old preview does not.

The file reader refuses empty/malformed UTF-8 and files larger than 262,144 bytes; explicit model Open still performs its own native validation and may refuse a syntactically readable file. Failed staging/Open retains the old accepted model.

## Qualification and evidence

This is a bounded **integer-cell rectangular difference**, not a general curved Boolean or unrestricted cavity tool. A successful native result has one positive-volume connected material component and needs a supported exact representation. Source-receiver checks preserve original cut surfaces; no shortcut from displayed triangles to B-Rep identity or persistent face naming is implied.

The existing baseline provider retained **46 genuine `part` display packets**, with 184 vertices and 92 triangles for that baseline. It did **not** retain genuine meshes for every hidden operand or the depth-6 and through-window edited states. Their separate CPU controller/display exercises use explicitly mocked or topology-derived data; those are **not** fresh native captures.

**External validation remains open:** live React controls, changed-state browser/GPU pixels, physical download/reopen, and real screenshots are **UNRUN in this documentation change**. Track the dedicated [top-pocket device gate #1867](https://github.com/barocss/barocss/issues/1867) without marking it complete from the Manual. See the [browser evidence protocol](./browser-evidence).

[Previous lesson: L-bracket](./l-bracket) · [Next: constrained plate](./constrained-plate) · [Native modeling evidence](../cad/modeling#cut-a-top-entry-pocket)
