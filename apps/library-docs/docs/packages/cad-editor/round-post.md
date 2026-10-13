# Model a round post in CAD Editor

**Level:** beginner · **Workflow:** local CAD Editor `#/model` · **Unit:** millimetres · **Output:** named `post`

This lesson builds a circular post, edits its diameter and extrusion height, and saves an **editable native model**. It teaches a crucial CAD distinction: the renderer can show a rounded wall even when its displayed triangles are not the authoritative geometry and its mass properties are **not certified**.

This lesson documents the local, experimental workspace implementation; it is not a claim of an npm-published CAD product or a live browser validation. For the underlying TypeScript model, read the [round-post section of the CAD modeling guide](../cad/modeling#create-and-edit-a-round-post).

## Start with the actual modeling workspace

Use an existing Node 22+ workspace checkout with dependencies already installed:

```sh
pnpm --filter @barocss/cad-editor build:library
pnpm --filter @barocss/cad-editor-app dev
```

Open `http://127.0.0.1:52010/#/model` (or use the port printed by Vite). The heading is **Model a part**, not the original native Surface/Curve session or Boolean-extrusion workbench.

1. Expand **Modeling examples** and open **Choose an example**.
2. Select **Create a round post**. If an earlier model is accepted, save what you need and check **Replace accepted model and discard its history and pending dimensions**.
3. Select **Load example**. A picker change alone never replaces your accepted part. Wait until the status shows **Accepted model**.
4. In **Visible output body**, confirm the named output `post`. A single round-post preset creates one saved output; there is no hidden subtractive tool.

Do not use a reference object or internal document schema. The preset owns one circular sketch, its native extrusion, and named millimetre parameters.

## Identify the driving dimensions

The modeling inspector displays **Named dimensions**. This exact preset presents two prominent fields:

| Visible field | Authored parameter | Initial value | Geometric meaning |
| --- | --- | ---: | --- |
| **Diameter** | `diameter` | 8 mm | Full width of the circle, not radius |
| **Extrusion height** | `height` | 6 mm | Positive distance from Z=0 along +Z |

Expand **Optional center coordinates** to see `centerX = 2` and `centerY = -3` mm. These values position the circular sketch on the XY plane. Changing the center does **not** change the radius.

Internally, the owned dimension is `radius = diameter × 0.5`. There is **no independent radius field or formula-text editor** in this preset. The relation belongs to saved authoring intent, so a future diameter edit updates the radius.

## Perform two accepted edits

1. Set **Extrusion height** to `9`. The status **Dimension changes pending** means the input is still draft text; the native model is unchanged. Select **Apply dimensions** and wait for **Accepted model**.
2. Set **Diameter** to `4`, then select **Apply dimensions** again. The new radius is 2 mm while the center stays (2, −3) mm.
3. Use **Undo** and **Redo** to examine the accepted changes. If a draft is pending, choose **Apply dimensions** or **Discard draft** first. Changing the viewport or viewing output does not edit native geometry.

The following are **source-backed native bounds from the existing provider fixture**, not measurements derived from a new screenshot or current GPU pixels:

| Accepted model | Native XYZ lower bound (mm) | Native XYZ upper bound (mm) |
| --- | --- | --- |
| Initial diameter 8, height 6 | `[-2,-7,0]` | `[6,1,6]` |
| Height 9, diameter 4 | `[0,-5,0]` | `[4,-1,9]` |

Check that the round post appears narrower and taller in the viewport, but do not infer exact bounds, CAD precision or topology from the visible mesh. The editor's approximate face selection and native XYZ coordinates serve different purposes.

## Save, reopen and re-edit

Under **Save or open a model**, choose **Download model** to start downloading `part.cad.json`. Verify that the file actually exists on your computer: a browser click alone does not certify durable storage.

Choose **Choose model file** and select the saved JSON file. This reads UTF-8 bytes into **Saved model data** for review; it does **not** replace the accepted model or advance history. Check the explicit **Replace accepted model and discard its history and pending dimensions** acknowledgment, then select **Open saved model**. After acceptance, verify that the named output is still `post` and you can edit **Diameter** again.

The staging reader refuses files over 262,144 bytes, empty text and malformed UTF-8. A decodable file can still be rejected during native **Open saved model** validation. In both cases, the previous accepted model remains available. This user-level workflow is separate from the developer's `cad.load(savedText)` API; both preserve authored intent instead of merely saving sampled triangles.

## Inspect a refusal without corrupting the model

After accepting an ordinary valid post, try staging a **Diameter** of `0`, then select **Apply dimensions**. Its computed radius is zero, outside the qualified positive-size circle domain. Expect a refusal, **not** a successfully healed or clamped post. Keep the previous accepted state and choose **Discard draft** or enter a supported positive diameter.

The current circle profile requires radius and extrusion height in the admitted range **0.001..10,000 mm**; additional exact stored-boundary checks may reject apparently reasonable decimal inputs. A rejected candidate is not a partial CAD save. Capture the actual error message and cause when reporting an unexpected failure; do not assume one universal error code for every invalid dimension.

## Understand what the result proves

The output family is `stored-rational-circle-prism`. It retains a rational circle and a qualified **stored boundary** rather than proving an ideal infinitely smooth mathematical cylinder.

- **Certified volume unavailable:** the editor explicitly reports this. Do not read the numeric volume of an ideal cylinder, a triangle-mesh estimate or the number zero as a certified native volume.
- **Derived display:** the current baseline preview uses a fixed mesh sampling profile with **98 vertices, 64 triangles, and 3 face ranges**. Those are display data, not newly authored native faces or a topology/mass certificate.
- **Bounded operations:** in this admitted slice a circular post is **not** a valid parent for cut, intersection, union, mounting-hole, split, chamfer or persistent edge selection. A visible round wall does not establish those workflows.
- **Refusal is intentional:** exact native/chart/UV and GPU-display admission are independent; a native edit can be refused without approximation.

See [the measured round-post native fixture and limitations](../cad/modeling#create-and-edit-a-round-post) and the [broader CAD capability boundary](../cad/capabilities). Those references have their own source pins and verification scopes; this lesson does not silently upgrade them.

## Verification and screenshots

**Documented from source:** the `#/model` route; labels `Create a round post`, `Optional center coordinates`, `Diameter`, `Extrusion height`, `Apply dimensions`; staged and accepted history; text-only file chooser; supported native fixture bounds and non-certification.

**Not verified in this documentation change:** a fresh live Chromium run, actual GPU pixels, click/keyboard interaction on a real device, physical Download → picker → Open, or screenshot correctness. Until that independent acceptance is recorded, **do not add synthetic screenshots** or describe a mocked-Worker frame as observed browser output.

A future browser evidence pass should capture the initial post, taller/narrower accepted view, a refused draft with retained geometry, and a reopened named `post`—each labeled with exact source SHA, expected native state and recorded browser result. This is a verification requirement, not a claim that the screenshots already exist.

[Previous: first model lesson](./first-model) · [CAD Editor overview](./) · [Editor developer quickstart](./quickstart) · [Native modeling guide](../cad/modeling)
