# Split a beveled part and keep its cut centered

**Level:** intermediate → advanced · **Workspace:** CAD Editor `#/model` · **Unit:** mm

You can combine two supported operations—**Chamfer** followed by **Split**—without turning display triangles into authoritative geometry. You can also make the split plane follow a part's width using a *saved parametric dimension*. This exercise compares **two different built-in models**, not a switch that converts an existing model between free and formula-driven splits.

For the simpler prerequisites, use [the CAD modeling reference for two chamfers](../cad/modeling#chamfer-two-owned-edges-in-sequence) and [the plain split guide](../cad/modeling#split-a-part-into-lower-and-upper-bodies).

> **Verification status:** Source-backed local experimental workflow. All volume and refusal figures below come from previously executed, source-pinned CAD provider fixtures. This documentation change has **not** executed a fresh browser/GPU/file-roundtrip campaign, and it does not certify manufacturing quality.

## 1. Start the actual Modeling workspace

From a repository checkout with existing dependencies, using Node 22+:

```sh
pnpm --filter @barocss/cad-editor build:library
pnpm --filter @barocss/cad-editor-app dev
```

Open `http://127.0.0.1:52010/#/model` or the local Vite port with `#/model`. Wait until **Model a part** shows **Accepted model**.

To load a different preset, expand **Modeling examples**, use **Choose an example**, and select the desired entry. An existing accepted model requires the explicit **Replace accepted model and discard its history and pending dimensions** checkbox before **Load example** is enabled. Merely changing the picker or axis selector does not change your accepted geometry.

## 2. Split the finished, twice-beveled part

Choose **Split a beveled part**, keep **X · negative / positive** under **Split axis for the new example**, acknowledge replacement, and press **Load example**.

This model uses a **32 × 24 × 8 mm** direct rectangular extrusion. Its first top-edge chamfer has `frontDistance=1` mm; the second top-edge chamfer has `backDistance=2` mm. The second chamfer's selector belongs to the **actual first chamfer result**. Only *after both* bevels are accepted does the model split the finished result.

There are three exposed drivers under **Named dimensions**:

| Field | Initial value | Meaning |
| --- | ---: | --- |
| `frontDistance · front bevel distance` | 1 mm | Physical setback on the first supported top edge |
| `backDistance · back bevel distance` | 2 mm | Physical setback on a distinct top edge of the first result |
| `splitAt · selected-axis split coordinate` | 16 mm | Actual X coordinate of the split plane, not a bevel distance |

The outputs are independently named `negative` and `positive`, meaning the lower-X and higher-X occupied sides of the plane. Select each result with **Visible output body** → **Choose one output to inspect**; hiding one does not remove it from authored data.

### Execute the measured edit sequence

1. At `splitAt=16`, inspect both accepted outputs.
2. Change `splitAt` to **8**, then press **Apply dimensions**. While the status is **Dimension changes pending**, only draft text has changed. Wait for **Accepted model** before interpreting a new result.
3. From that accepted X8 state, change `backDistance` from 2 to **3** and apply again.
4. Use **Undo** and **Redo** to review accepted states. If text is pending, choose **Discard draft** or apply it first.

| Accepted state in the source-pinned native sequence | `negative` volume | `positive` volume |
| --- | ---: | ---: |
| X16, front1/back2 | **3032 mm³** | **3032 mm³** |
| X8, front1/back2 | **1516 mm³** | **4548 mm³** |
| X8, front1/back3 | **1496 mm³** | **4488 mm³** |
| Cold reopen of saved X8/front1/back3 | **1496 mm³** | **4488 mm³** |
| Reopened model, X16/front1/back3 | **2992 mm³** | **2992 mm³** |

For quick comparison with the frozen provider's `negative / positive` notation: **X16 = 3032 / 3032**, **X8 = 1516 / 4548**, **X8/back3 = 1496 / 4488**, and **reopened X16/back3 = 2992 / 2992** (all mm³).

These figures are qualified only within the **bounded convex-planar family** of the measured fixture. They are **not** reconstructed from browser pixels or guaranteed for unrelated imported models.

Moving only `splitAt` can reuse the unchanged model features leading to the finished chamfered part. Editing `backDistance` changes the second chamfer **and** the subsequent split. Feature reuse counts are not timing or total native-call benchmarks; the app still regenerates display geometry from accepted outputs.

### Another axis is a new model, not an edit

This preset also offers **Z · negative / positive** when you load a **new** example. The separate source-backed Z4 fixture yields **3072 / 2992 mm³**. The two-chamfer preset does **not** offer Y; the plain **Split a part** preset has different X/Y/Z choices and output names.

**Split axis for the new example** resets example replacement acknowledgment. It does *not* convert a currently accepted X model into Z or preserve the old example's history. Save any existing work before acknowledging a new load.

## 3. Load a different, automatically centered split

Now select **Keep a beveled split centered** from **Modeling examples**, acknowledge replacement, then choose **Load example**. This is a new authored recipe with the same kind of two serial edge bevels but with **no editable `splitAt` field**.

The model owns a derived X coordinate:

```text
split X = width × 0.5 + offset
```

Its only user-editable **Named dimensions** are `width`, `offset`, `frontDistance`, and `backDistance`. The UI describes `width · rail X size` and `offset · X displacement from center`. **`offset` is a millimetre displacement, not a normalized fraction or the width of the bevel.**

The expression is authored by the preset using the public `model.dimension.scale` and `model.dimension.add` operations. It is saved as a model-owned formula tree; the editor does **not** offer a formula text editor, general JavaScript evaluator, or a switch that retrofits the independent `Split a beveled part` model with this expression.

### Change the offset, then change the width

1. Starting from `width=32` and `offset=0`, the X plane is at 16 mm.
2. Edit `offset` from 0 to **4** and choose **Apply dimensions**. The cut moves to X20.
3. From that accepted state, edit `width` from 32 to **40**. The plane becomes X24 automatically, even though the offset stays 4.
4. On the accepted width40 model, set `offset` back to **0** to recenter at X20. Use **Undo**/**Redo** to compare prior accepted states.

| Accepted source-pinned model state | Computed split X | `negative` / `positive` native volume |
| --- | ---: | --- |
| width32 / offset0 | 16 mm | **3032 / 3032 mm³** |
| width32 / offset4 | 20 mm | **3790 / 2274 mm³** |
| width40 / offset4 | 24 mm | **4548 / 3032 mm³** |
| width40 / offset0 | 20 mm | **3790 / 3790 mm³** |
| Cold reopened width40 / offset0 | 20 mm | **3790 / 3790 mm³** |
| Reopened width40, offset4 | 24 mm | **4548 / 3032 mm³** |

Each table row describes its own qualified native state, not a new live browser observation. Notice that **changing width also changes total material volume**, so keeping the split plane centered does not mean the positive/negative volumes remain equal after adding a nonzero offset.

## 4. Safely test an unsupported split

In the *direct-coordinate beveled model*, after reaching the accepted X8 state, a `splitAt=40` edit requests an empty `positive` side. The existing provider fixture refuses with `CadModelError` **SELECTION / split**, reporting the outside positive side. The previous X8 accepted snapshot remains usable.

In the *derived centered model*, from the accepted **width40/offset4** state, `offset=40` would place the plane at X60: again one requested output is empty and the measured provider refuses **SELECTION / split**. In the fixture, retrying `offset=0` from the **last accepted** state succeeds. Do not continue editing a failed candidate as if it were accepted.

The editor must keep previously accepted native bodies, authored text and history on refusal; correct the field or use **Discard draft**. Preserve actual failure diagnostics. Do not silently snap a plane into the part, drop one named output, weld disconnected material or treat a stale viewport image as proof of success.

## 5. Save, reopen, and re-edit the actual recipe

Open **Save or open a model** and choose **Download model** to initiate `part.cad.json`. Confirm the browser really saved the file; clicking Download is not durable-storage evidence.

Choose **Choose model file** to stage the saved UTF-8 text in **Saved model data**. File selection does not accept geometry, update the viewport or grant replacement permission. Review the staged text, check **Replace accepted model and discard its history and pending dimensions**, then choose **Open saved model**.

After acceptance, select `negative` or `positive` in **Visible output body** as needed. Generic Open chooses the last validated authored output, **not** your previously displayed output. Re-edit the split coordinate for the direct model, or `offset` for the centered model, to establish that authored intent survived a cold rebuild. The saved file contains the expression tree and numeric drivers, **not** cached meshes, private feature reuse frames, camera pose or GPU pixels.

The staging reader refuses invalid UTF-8, empty text and inputs over **262,144 bytes**. A readable text file still undergoes independent native validation during explicit Open; no parser acceptance is implied by the file chooser.

## 6. Hard boundaries and evidence tiers

The source has a bounded profile: one supported sketch/extrusion, **up to two serial owned chamfers**, then **one supported split**. The split parent must descend from the original extrusion through that admitted chamfer chain; arbitrary sibling jumps, cut-rooted chamfer trees, repeated/nested splits, arbitrary oblique planes, general fillets and persistent topology naming are unsupported.

The centered preset's formula grammar admits only model-owned **add** and **scale**, with no string expression parser or general evaluation language. The existing formula limit is **32 expression nodes, depth 6**; all intermediate/resolved dimensions must be finite and within **±10,000 mm**. Native exactness and displayed-mesh admission remain distinct. Being under the formula budget does not guarantee successful geometric representation.

**Provider evidence:** the [beveled split fixture](../cad/modeling#split-a-finished-beveled-part) executed its admitted X/Z native states and cold rebuild/re-edit; the [owned derived dimension fixture](../cad/modeling#keep-a-beveled-split-centered-as-width-changes) separately executed its width/offset and refusal cases. Their source pins and precise counters belong to those references.

**Consumer limitation:** the editor's tests replay source-qualified baseline transport through a **mocked Worker**. Edited-state display geometry, full browser React interactions, real GPU pixel capture, and physical Download/Open were not freshly demonstrated for this guide. **UNRUN** here means unverified, not passed. Follow the [browser evidence protocol](./browser-evidence) before upgrading a manual claim.

[CAD Editor reference navigation](./reference) · [Troubleshooting](./troubleshooting) · [CAD modeling source reference](../cad/modeling)
