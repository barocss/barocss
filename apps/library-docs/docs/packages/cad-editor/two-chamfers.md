# Chamfer two edges of a part

**Level:** intermediate · **Workspace:** local CAD Editor `#/model` · **Unit:** millimetres · **Output:** `part`

Chamfering removes material along a chosen edge to form a bevel. In this exercise, the **Two chamfers on a part** preset uses two *serial* operations: the second bevel is applied to the accepted result of the first. It is not a general fillet tool or arbitrary multi-edge chamfering workflow.

> This is a source-backed description of an experimental local UI. The exact native volumes below come from the previously executed provider fixture. New browser/GPU interaction, pixels, downloaded files and screenshots are **UNRUN for this documentation change**.

## 1. Load the model

In a prepared Node 22+ repository workspace with dependencies already installed:

```sh
pnpm --filter @barocss/cad-editor build:library
pnpm --filter @barocss/cad-editor-app dev
```

Open `http://127.0.0.1:52010/#/model` (or Vite's actual port plus `#/model`).

1. Under **Model a part**, wait for **Accepted model**.
2. Expand **Modeling examples**, open **Choose an example**, and select **Two chamfers on a part**.
3. If you already have an accepted part, save anything important and check **Replace accepted model and discard its history and pending dimensions**.
4. Click **Load example**, wait for **Accepted model**, and choose the named `part` under **Visible output body**.

Simply choosing another option in the example list does **not** alter the accepted model. Loading an example replaces the previous accepted example and its undo history only after explicit acknowledgment.

## 2. Understand the two setbacks and edge location

The starting block is **32 × 24 × 8 mm**, with an exact initial native volume of **6144 mm³**. Its sketch lies in XY and extrusion goes along +Z.

| Numeric driver in **Named dimensions** | Initial value | What it controls |
| --- | ---: | --- |
| `frontDistance · front bevel distance` | 1 mm | Equal physical setback along both planes next to the first front/top edge |
| `backDistance · back bevel distance` | 2 mm | Second bevel setback on the **first chamfer's result** |
| `backY · edge-selection Y coordinate` | 24 mm | Y coordinate identifying the second top edge; **not** another bevel width |

The first edge is the unique X-parallel edge at Y=0, Z=max in the original block. The second selector is resolved **against the first chamfered body**, at the authored `backY` and Z=max. **Equal setback** is the offset on each incident face, not the diagonal width of the resulting bevel. A selector that does not uniquely identify a supported edge refuses rather than picking the nearest visual edge.

## 3. Edit and compare qualified results

1. Keep `frontDistance=1`, `backDistance=2`, `backY=24` and inspect the named `part`.
2. Change **`backDistance` from 2 to 3**. The status **Dimension changes pending** means the edit is still draft text. Select **Apply dimensions**, then wait for **Accepted model**.
3. Use **Undo** to restore the prior accepted bevel and **Redo** to reapply the second distance. With pending text, choose **Apply dimensions** or **Discard draft** before history changes.
4. As another *separate* accepted edit, change `frontDistance` from 1 to 2 while `backDistance` stays 3.

Expected **qualified native** values from the accepted provider campaign—not new measurements from the preview:

| Accepted state | After first chamfer | Final `part` volume |
| --- | ---: | ---: |
| Front 1, back 2 | 6128 mm³ | **6064 mm³** |
| Front 1, back 3 | 6128 mm³ | **5984 mm³** |
| Front 2, back 3 | 6080 mm³ | **5936 mm³** |

The original blank remains 6144 mm³ in these measured cases. The lower final volume after a greater setback represents more removed material, but a visible bevel is still **derived display geometry**, not a universal native guarantee for arbitrary values.

## 4. See what a refused edit means

Only the **previously accepted** original part can serve as the safe reference when an invalid candidate is rejected. From a state with `frontDistance=1`, the provider verifies these *different* refusal causes:

- `backY=0` attempts to select the first front/top edge that the first chamfer has already removed. It refuses with `CadModelError` **SELECTION** (operation `chamfer`), rather than retargeting a nearby edge.
- `backY=1` selects a resulting bevel/top edge with non-cardinal adjacent support; this refuses with **NATIVE / METRIC** for `chamfer`.
- `backDistance=0` violates the positive-distance requirement and refuses with **PARAMETER / chamfer**.

The editor must leave the accepted shape, history and authored file state unchanged when a candidate fails. Read the actual diagnostic before correcting or selecting **Discard draft**. Do not silently clamp, approximate or manufacture a new topology ID.

## 5. Save the editable model

Open **Save or open a model** and choose **Download model** to start saving `part.cad.json`. Verify that the browser actually wrote the file; a Download click alone is not proof of persistence.

To reopen, choose **Choose model file**. This only stages the UTF-8 text in **Saved model data**. Review it, check **Replace accepted model and discard its history and pending dimensions**, then click **Open saved model**. A successful Open rebuilds the authored sketch, extrusion, two chamfers and three named drivers; it does **not** restore an old screenshot or camera.

The file staging reader rejects malformed UTF-8, empty content and files larger than **262,144 bytes**. A valid text decode is not proof of valid native geometry; explicit Open may refuse, preserving the previous accepted model. After reopening, re-edit `backDistance` to demonstrate the saved intent remains parametric.

## Qualification and limits

This lesson proves a *bounded* serial pair of cardinal-edge chamfers on one directly extruded rectangle. The second selector and parent belong to the **first result**, not the original block. It does not support a third chamfer, sibling chamfer branches, arbitrary curved edges, generic fillets, unrestricted topology naming, or combinations with unverified other feature families.

The [advanced two-chamfer source and native evidence](../cad/modeling#chamfer-two-owned-edges-in-sequence) has a real public typed example and immutable provider receipts. Controller tests reuse genuine baseline data through mocked Worker paths; their display of changed values cannot be upgraded to newly measured native tessellations or browser/device success.

**Still UNRUN for this lesson:** real React/Chromium workflow, GPU pixels, physical Download → file picker → Open, and screenshot provenance. Use the [CAD browser evidence protocol](./browser-evidence) before reporting these as complete.

[Next: split the part](./split-part) · [Modeling API guide](../cad/modeling) · [CAD Editor examples](./examples)
