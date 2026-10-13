# Cut a through-slot in an L-bracket

**Level:** intermediate · **Workspace:** CAD Editor `#/model` · **Units:** millimetres

The [L-bracket exercise](./l-bracket) joined two rectangular extrusions. This lesson continues the idea with a different **built-in example**: it retains a qualified bracket, then cuts an editable rectangular through-slot from that *owned union result*. You will edit slot width, compare named outputs, and save a reusable authored model.

> **Evidence boundary:** This guide follows the currently implemented local editor and previously accepted native fixtures. It does not claim new browser/GPU pixel verification, physical file persistence, unrestricted Boolean modeling or manufacturing certification.

## 1. Load the composite example

In a Node 22+ repository checkout with its normal workspace dependencies installed, start the editor:

```sh
pnpm --filter @barocss/cad-editor build:library
pnpm --filter @barocss/cad-editor-app dev
```

Visit `http://127.0.0.1:52010/#/model` (or use the Vite-reported port with `#/model`).

1. Wait for **Accepted model** under **Model a part**.
2. Expand **Modeling examples** → **Choose an example**. Select **Cut a slot in a bracket**, **not** the simpler **Fuse an L-bracket** preset.
3. If another model is accepted, first save any work you need; acknowledge **Replace accepted model and discard its history and pending dimensions**.
4. Choose **Load example**, then wait for **Accepted model**. Selecting a different preset without loading does not change the accepted part.
5. Under **Visible output body** choose `slotted` if you are viewing the uncut `bracket`.

The operation sequence is *rectangle → extrude* for the base, *rectangle → extrude* for the leg, **union**, *rectangle → extrude* for the cutter, then **difference on the union**. The bound is an admitted **eight-node composed graph**, not an unrestricted nested Boolean feature tree.

## 2. Understand the five numeric controls

The base is a 32 × 8 × 8 mm box; the leg initially extends 8 × 24 × 8 mm. Both start at Z=0, and the through-slot's cutter spans the same 8 mm Z thickness.

| Inspector field | Initial value | Meaning |
| --- | ---: | --- |
| `legWidth · leg X width` | 8 mm | Width of the fused vertical leg |
| `slotX · slot origin X` | 16 mm | Cutter lower X coordinate |
| `slotY · slot origin Y` | 2 mm | Cutter lower Y coordinate |
| `slotWidth · slot X width` | 8 mm | Width of the removed opening in X |
| `slotSpanY · slot Y span` | 4 mm | Cutter Y length, **not** its Z height |

The cutter's XY maximum is derived by adding `slotWidth` to `slotX` and `slotSpanY` to `slotY`. Changing one of these does not rename native source faces or independently edit Z. The saved file retains five named parameters and their bounded owned arithmetic, not an arbitrary user formula parser.

The preset keeps **two named outputs**. The uncut `bracket` is still available for comparison; `slotted` is the cut result. Neither output is merely a screenshot or triangulated preview.

## 3. Make the opening wider

1. With the initial accepted model, select **Visible output body** → **Choose one output to inspect** and choose `slotted`.
2. Under **Named dimensions**, change the `slotWidth` field from **8** to **12**.
3. **Dimension changes pending** means this is draft text only. Choose **Apply dimensions**, then wait for **Accepted model**. If the operation is refused, keep the previous accepted shape and correct the value or choose **Discard draft**.
4. Use **Undo** and **Redo** to compare the two accepted states. Resolve any pending draft before using history.
5. Switch **Visible output body** between `bracket` and `slotted`. This only changes the display, not the feature graph, numeric parameters or saved output inventory.

The values below come from the **original qualified native provider fixture**, not from newly sampled browser pixels:

| Native output / accepted state | Certified restricted integer-cell volume |
| --- | ---: |
| `bracket` — baseline union | **3072 mm³** |
| `slotted` — baseline slot width 8 | **2816 mm³** |
| `slotted` — accepted slot width 12 | **2688 mm³** |

The cutter removes 256 mm³ in the baseline fixture, and 384 mm³ in the width-12 fixture; these differences follow from the **same measured accepted states**. They are **not** measurements made by ray-picking the viewport. Do not assume every other slot setting admits geometry or a certificate.

## 4. Know what is refused

This composition has a narrow shared Z=0..8 rectangular-material profile. The present receiving/display contract admits this particular union → third-box difference chain and requires a qualifying single material result. An edit that empties the cut part, disconnects material, violates safe integer/geometry restrictions, or exceeds its finite work limits can refuse. **Do not silently heal**, select only one disconnected component, truncate mesh panels, or keep an unqualified candidate as though it were accepted.

The admitted composed preview has a finite envelope: up to **8 operation nodes**, **16 occupied/decomposed cells**, **64 vertices**, **144 edges**, and **64 complete panels per body** (plus its documented support-plane limits). The separately represented preview triangles and approximate picks are *derived* from native authority, not a substitute for material qualification, exact persistent face IDs, CAD interoperability, or manufacturing tolerances.

The reference records other provider recovery/cold edit states (3328 and 3200 mm³), but does not make them new UI promises for an unspecified sequence. When reproducing a refusal, report the exact preceding accepted parameters and actual diagnostic rather than inventing a generic error code.

## 5. Save, reopen, then re-edit

Open **Save or open a model**.

1. Choose **Download model**. The browser initiates a `part.cad.json` download; confirm the file was actually written before using it as a backup.
2. Choose **Choose model file** to load its raw UTF-8 into **Saved model data**. This is *staging only*. It does **not** accept native geometry or change the current viewport.
3. After reviewing the text, check **Replace accepted model and discard its history and pending dimensions**, then choose **Open saved model**.
4. After acceptance, inspect **Visible output body** to ensure `slotted` is selected, then make another supported parameter edit.

Both `bracket` and `slotted` are still authored after Save/Open. Generic Open chooses the last validated saved output, **not** a serialized view selection; do not conclude that a part was lost simply because the displayed output changed. The editor's staging reader rejects empty or invalid UTF-8 and files over **262,144 bytes**; native Open subsequently validates the authored model and may still refuse. Accepted geometry and history are kept on a refusal.

## 6. Separate native proof from display evidence

The actual provider constructed a qualified `orthogonal-cell` material output and recorded exact integer volume. A separate bounded consumer recorded real baseline Surface packets for both results, including the 14 bracket panels added to the previously retained slot data; their native provenance and original winding/UV data were preserved.

The consumer's **edited-state** display/controller tests intentionally reuse a **baseline mock** rather than claiming a newly tessellated width-12 model. Even a real visible triangle hit reports only a context-specific approximate sample; it does not prove a permanent B-Rep face name or certify manufacturing fitness.

**UNRUN here:** fresh browser/React interaction, device/GPU pixels, physical Download → file picker → cold Open, and screenshot capture. The [browser evidence protocol](./browser-evidence) defines the additional proof needed. The detailed [native union-to-slot modeling reference](../cad/modeling#cut-a-slot-in-a-bracket) retains the exact operation and separate provider/consumer receipts.

**Next:** [learn top-entry pockets and constrained dimensions](./learning-path) after their separate manual PR is adopted.

[Previous: L-bracket union](./l-bracket) · [CAD Editor learning path](./learning-path) · [CAD capabilities](../cad/capabilities)
