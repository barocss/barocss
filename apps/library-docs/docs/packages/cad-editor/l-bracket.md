# Fuse an L-bracket in CAD Editor

**Level:** beginner → intermediate · **Route:** local `#/model` · **Units:** millimetres

This hands-on lesson builds two rectangular extrusions into a connected **L-bracket** with the editor's qualified union operation. Unlike a generic Boolean modeling claim, the recipe is deliberately limited to supported integer-axis box material. The goal is to edit, inspect, save and reopen real authored geometry while distinguishing authoritative native evidence from viewport triangles.

## Load the existing L-bracket

In a configured workspace using Node 22+, run:

```sh
pnpm --filter @barocss/cad-editor build:library
pnpm --filter @barocss/cad-editor-app dev
```

Open `http://127.0.0.1:52010/#/model` (or your Vite port plus `#/model`).

1. Wait for **Accepted model** under **Model a part**.
2. Expand **Modeling examples**, then **Choose an example**.
3. Choose **Fuse an L-bracket**. If a model is already accepted, first save any work you need and check **Replace accepted model and discard its history and pending dimensions**.
4. Choose **Load example**. Merely choosing a preset does not replace the accepted model.

The recipe has five authored feature nodes: sketch → extrusion for `base`, sketch → extrusion for `leg`, then `base.union(leg)`. It preserves three separately named outputs: `base`, `leg`, and the union result `bracket`.

## Understand the dimensions

The fixed base is an XY rectangle **32 × 8 mm**, extruded **8 mm** in +Z. The leg is a separate rectangle running from minimum XY `[legMinX, legMinY]` to maximum `[legMinX + legWidth, 24]`, extruded by `legHeight`.

Under **Named dimensions**, the leg has four numerical drivers:

| Parameter | Initial value | Meaning |
| --- | ---: | --- |
| `legMinX` | −0 mm | Leg origin X |
| `legMinY` | −0 mm | Leg origin Y; moving it also changes leg length |
| `legWidth` | 8 mm | Leg X width |
| `legHeight` | 8 mm | Leg +Z extrusion height |

The initial negative zero is an intentional part of the authored native fixture, not a required typing trick for normal use. The leg's maximum Y stays at 24 mm; moving its starting Y **changes its length**, not only its position.

## Widen the leg and see the accepted result

1. Change `legWidth` from **8** to **12**.
2. The status **Dimension changes pending** indicates draft fields; the previously accepted geometry remains unchanged.
3. Select **Apply dimensions** and wait for **Accepted model**. Use **Visible output body** to select `bracket` if another output is visible.
4. Change `legMinY` from 0 to **8**, then **Apply dimensions** again to create the measured face-contact join.
5. Use **Undo**/**Redo** to review accepted changes. Choose **Discard draft** if you want to abandon an unaccepted value.

The following results are copied from the **existing qualified native provider fixture**, not a freshly executed browser, and the volumes belong to the complete `bracket` output:

| Accepted stage | Exact restricted native volume | Generated panels |
| --- | ---: | ---: |
| Initial L-bracket | 3072 mm³ | 14 |
| `legWidth:12` | 3584 mm³ | 14 |
| Then `legMinY:8` | 3584 mm³ | 14 |

The result is a bounded single-body `orthogonal-cell` native union. Exact integer-cell material volume is **not** a volume calculated from approximate rendering pixels.

## Learn why a union can refuse

Starting from the accepted face-contact state above, staging `legMinX:32` produces **edge-only contact** and the native provider fixture refuses with operation `union` and cause `CONTACT`. Starting instead from that same accepted state, `legMinX:40` leaves disconnected material, which the single-body authoring contract refuses rather than silently selecting one piece.

Do not apply these values as a new initial recipe; their known behavior is for the stated preceding accepted state. On refusal, the previous accepted `bracket`, saved authored text, visible output, and history remain authoritative. Correct or **Discard draft**. Refusal is safer than silently welding an edge, dropping a disconnected piece or pretending that all solid Booleans are admitted.

The tested recovery edits `legWidth:8, legMinY:-0` return the qualified native bracket to **3072 mm³**. After a fresh authored Open, changing `legHeight:16` yields the measured **4608 mm³** result with **20 generated panels**. These values are qualified provider evidence, not untested UI promises.

## Choose outputs and save without losing geometry

Under **Visible output body** → **Choose one output to inspect**, select `base`, `leg`, or `bracket`. This changes **only the view**, not the authored union graph or saved named outputs. All three are retained and validated.

Open **Save or open a model** and choose **Download model** to initiate `part.cad.json`; verify that the browser actually stores it. Choose **Choose model file** to stage its UTF-8 source in **Saved model data**. Then explicitly check **Replace accepted model and discard its history and pending dimensions** and choose **Open saved model**. File staging alone cannot accept a native model.

A generic Open initially selects the **last** validated saved output. The canonical saved order for this recipe is `base,bracket,leg`, so it initially shows `leg`. Select **bracket** again before concluding the union disappeared. Re-edit `legHeight` or another supported field to confirm that the stored recipe remains parametric.

## What this qualifies—and what it does not

- `bracket` belongs to the source-qualified `orthogonal-cell` family; the two original direct rectangular extrusion outputs belong to `convex-planar`.
- The baseline qualified result has three occupied cells, one body and shell, **14 generated panels**, **16 global native vertices** and **28 global native edges**. Do not count derived mesh triangles as native B-Rep edges or assume generated union face IDs remain stable after edits.
- The current consumer rejects unsupported edge-only joins and multiple disconnected components. The existence of this exact constrained operation does **not** establish arbitrary curved Boolean union, tolerance healing, general CSG, topology renaming, or manufacturing certification.
- Browser clicks provide approximate derived face selection. A face hit may report contributing native operand faces but does not certify persistent topology or exact material classification.

The developer reference [Fuse two rectangular extrusions](../cad/modeling#fuse-two-rectangular-extrusions) includes the runnable TypeScript source and fixed native provider evidence.

## Evidence status

**Source inspected:** current modeling preset, accepted numeric fixture and native report, saved output order, and staged-file UI. **Not executed in this documentation change:** Node source-drift script, site build, live Chromium/React interaction, GPU pixels, physical Download → Open and screenshots. These checks remain **UNRUN** until separately measured. A successful Markdown link check is not a substitute for a native or browser acceptance.

[First part](./first-model) · [CAD Editor overview](./) · [Native modeling reference](../cad/modeling)
