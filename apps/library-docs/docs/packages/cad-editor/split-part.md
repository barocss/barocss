# Split a CAD part into lower and upper bodies

**Level:** intermediate · **Workspace:** local CAD Editor `#/model` · **Unit:** millimetres

**Split** divides one native solid at a qualified plane into two separately named solid bodies. This hands-on tutorial uses the existing **Split a part** example. Moving the split plane changes the volumes of `lower` and `upper` without trimming a mesh and pretending it is authored geometry.

> This guide uses source-backed results from a prior qualified native fixture; it does **not** claim a fresh browser/GPU verification, screenshot, or physical file round-trip. The example is bounded to the supported operation and geometry profile.

## 1. Load the Z-axis split preset

From a Node 22+ workspace that already has its dependencies:

```sh
pnpm --filter @barocss/cad-editor build:library
pnpm --filter @barocss/cad-editor-app dev
```

Open `http://127.0.0.1:52010/#/model` (or Vite's actual port followed by `#/model`).

1. Wait for **Accepted model** in **Model a part**.
2. Under **Modeling examples** → **Choose an example**, select **Split a part**.
3. Under **Split axis for the new example**, keep **Z · lower / upper**. The axis selector configures a **new example**; changing it does *not* turn the previously accepted part or its Undo history into another axis.
4. If another accepted model exists, save anything valuable, check **Replace accepted model and discard its history and pending dimensions**, then choose **Load example**.
5. Wait for **Accepted model**. Under **Visible output body**, select `lower` or `upper` for inspection.

The source-backed Z profile starts with one direct convex XY pentagon sketch, extruded to height `height=8` mm, and a Z split coordinate `splitHeight=2` mm. The saved outputs are two **real qualified native solids**, not two views of the same unsplit body.

## 2. Move the split plane

Under **Named dimensions**, locate `splitHeight`. This is a Z coordinate in millimetres, not a percentage, volume ratio, screen pixel, or camera offset.

1. Leave `height=8` and `splitHeight=2` initially. The lower result has Z bounds **[0,2]**; the upper has **[2,8]**.
2. Enter **4** for `splitHeight`. Until **Apply dimensions**, the status **Dimension changes pending** represents a draft only.
3. Select **Apply dimensions** and wait for **Accepted model**. Switch **Visible output body** between `lower` and `upper`.
4. Use **Undo** and **Redo** to compare the two accepted states. Use **Discard draft** to abandon an unaccepted value first.
5. In a separate accepted state, set `splitHeight=6`. After saving/reopening the split-at-4 model, the existing provider's cold re-edit fixture demonstrates this edit as well.

The accepted **native** volumes are:

| Accepted Z split | `lower` | `upper` | Total |
| --- | ---: | ---: | ---: |
| `splitHeight=2` | **1792 mm³** | **5376 mm³** | 7168 mm³ |
| `splitHeight=4` | **3584 mm³** | **3584 mm³** | 7168 mm³ |
| `splitHeight=6` | **5376 mm³** | **1792 mm³** | 7168 mm³ |

The interface's `lower`/`upper` labels reflect the Z coordinate relative to the plane. Both closed solids share a boundary plane, but their interiors are disjoint. The conserved **7168 mm³** is qualified for these measured fixtures; it is not inferred by counting display triangles.

## 3. Refuse an empty requested side

The current two-output recipe requires **`0 < splitHeight < height`** so that both named outputs have positive volume. If you change `splitHeight` to **0** (the bottom face), the `lower` side is empty and the *two-output* authoring operation refuses. The provider identifies the failure as `CadModelError` **SELECTION**, operation `split`, including a native cause.

The current UI must keep the earlier accepted `lower`/`upper` bodies and history on a refusal. Correct the value or use **Discard draft**. Do not silently discard the empty output, select a different result or infer successful native geometry from a still-visible previous frame. The low-level API may separately return one unchanged side for another output contract; **this** example requires both.

## 4. Save the two authored outputs and reopen them

Under **Save or open a model**, choose **Download model** to initiate `part.cad.json`, and verify that the browser saved it.

Choose **Choose model file** and select that file. This only stages text in **Saved model data**; it does not update the accepted native state. After inspecting the text, check **Replace accepted model and discard its history and pending dimensions** and choose **Open saved model**. The editor re-evaluates the sketch, extrusion, split plane and named output bindings.

After acceptance, choose **Visible output body** → `lower` or `upper`, and make another supported `splitHeight` edit to confirm authored intent survived reopening. File selection and download clicks alone are not physical file-recovery evidence; the browser/device flow requires independent verification.

## 5. What about X, Y and beveled parts?

The same **Split a part** example picker can instead initialize **X · negative / positive** or **Y · negative / positive**. Those are **different new-example recipes**, not an axis toggle on a current accepted Z-split part.

For X/Y, `negative` is the material at coordinates **≤ `at`**, and `positive` at **≥ `at`**. The provider's separate X/Y fixtures measure **4096 / 3072 mm³** at `splitAt=16`, then **5888 / 1280 mm³** at `splitAt=24`; their source-pinned native authority remains [in the advanced guide](../cad/modeling#choose-an-x-or-y-split-plane). An exact crossing can refuse if its native XYZ/UV rational representation is not supported, rather than approximate the plane.

**Split a beveled part** is another specialized preset with qualified parent/result rules. A previously chamfered parent is not permission to chamfer any resulting split side or to stack arbitrary Boolean operations. General oblique planes, repeated/nested splits, general fillets and persistent face naming remain outside this beginner workflow.

## Native versus presentation

The native split creates two independently owned accepted Solids. Each `bodies.lower` or `bodies.upper` is authoritative native geometry for the supported family. The Viewer displays derived triangles and provides approximate picks; viewport visibility does not rename, remove, or certify either output.

The [typed public Z-split source and frozen native evidence](../cad/modeling#split-a-part-into-lower-and-upper-bodies) record the actual accepted baseline/edit/cold re-edit results. The editor CPU receiving tests reuse those genuine baseline bodies with a **mocked Worker** and do not constitute a fresh native campaign, a GPU readback or physical file test.

**Still UNRUN for this documentation change:** real browser interactions, GPU pixel verification, actual download/fresh-file Open, and screenshots. See the [browser evidence protocol](./browser-evidence) before claiming device acceptance.

[Previous: two chamfers](./two-chamfers) · [CAD Editor examples](./examples) · [Modeling API reference](../cad/modeling)
