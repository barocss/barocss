# Resize a constrained CAD plate

**Lesson 6 · Level:** intermediate · **Workspace:** CAD Editor `#/model` · **Units:** mm

A rectangle can be drawn from four independent corner coordinates, or produced from a **constrained sketch** whose points must satisfy horizontal, vertical and fixed-point relationships. This lesson uses the second approach. You will drive the plate with width and height while the accepted model maintains the supported geometric constraints.

> This is a bounded source-backed learning exercise, **not** an interactive general-purpose sketch constraint solver. The published website, device/browser/GPU workflow, and physical file dialog are separate verification stages.

## 1. Load the actual constrained profile

In a workspace with Node 22+ and dependencies installed:

```sh
pnpm --filter @barocss/cad-editor build:library
pnpm --filter @barocss/cad-editor-app dev
```

Open `http://127.0.0.1:52010/#/model` (or the Vite port followed by `#/model`). In **Model a part**:

1. Open **Modeling examples** → **Choose an example** and select **Resize a constrained plate**.
2. If another accepted model exists, save it if needed and check **Replace accepted model and discard its history and pending dimensions**.
3. Select **Load example**; wait for **Accepted model**.
4. Select the named `part` under **Visible output body** if applicable.

The preset has one authored output (`part`), not separate stock/cutter outputs. Merely changing the example picker selection does not replace the current part.

## 2. Understand the visible numeric drivers

The inspector exposes **two friendly controls** for this exact preset:

| Inspector label | Named parameter | Initial value | Changes |
| --- | --- | ---: | --- |
| **Profile X width** | `width` | 32 mm | Horizontal X extent of the solved profile |
| **Profile Y height** | `height` | 24 mm | Vertical Y extent of the solved profile |

The plate's **extrusion thickness is fixed at 8 mm** along +Z in this example. **Profile Y height is not thickness**. The authored example contains an additional `lockY:0` value for a precise fixed-corner consistency condition, but it is intentionally **not exposed as an editable UI control**. Do not look for a free "lock Y" slider or ask this lesson to modify a different saved model's arbitrary constraint graph.

This is one exact constrained-polygon recipe. The authoring callback creates four points and ordered `fixed`, `horizontal`, `vertical` and another fixed constraint. The initial fourth-point X value of 1 mm is a **solver seed**, not a claim that the accepted outline has a sloping left side; the qualified solution resolves that X to 0. The solver's recorded baseline reports **rank 8, zero degrees of freedom**, with one consistent redundant corner constraint. Those statements describe this fixture, not all CAD sketches.

## 3. Resize, accept, undo

Start with the accepted 32 × 24 × 8 mm plate.

1. Change **Profile X width** to **40**. The status **Dimension changes pending** means you have only entered a draft; native geometry has not yet been accepted.
2. Choose **Apply dimensions**. After **Accepted model**, inspect the `part` output and its exact native volume.
3. Use **Undo** to return to the 32 mm-width plate. **Redo** returns to the accepted 40 mm width. A pending draft must first be applied or cleared with **Discard draft**.
4. From the **original accepted** 32 mm-width state (not the wider state), set **Profile Y height** to **16** and **Apply dimensions**. Observe a shorter in-plane Y profile without changing the fixed Z thickness.

These values come from the separately adopted native provider's executed fixture—not newly observed browser screenshots:

| Accepted native state | Width × Y height × Z thickness | Qualified `part` volume |
| --- | --- | ---: |
| Baseline | 32 × 24 × 8 mm | **6144 mm³** |
| Width edit from baseline | 40 × 24 × 8 mm | **7680 mm³** |
| Y-height edit from original baseline | 32 × 16 × 8 mm | **4096 mm³** |

The baseline provider separately recorded six native faces, eight topology vertices and twelve native edges. Its genuine preview uses **24 face-local vertices and 12 triangles**. Native topology and display vertices must not be conflated.

## 4. Know what can refuse

The provider fixture deliberately exercises a conflicting **internal** `lockY:1` edit and receives a native **CONFLICT** refusal. You cannot reproduce that exact control in this preset's UI because `lockY` is deliberately hidden. It proves that inconsistent fixed-point constraints should be rejected, **not** that the current editor has a general constraint authoring/dragging panel.

An unsupported dimension or failed profile/native/display qualification must preserve the previous accepted model, history and saved authored data. Keep the actual error, correct the draft, or choose **Discard draft**. Do not present a mocked editor response as a fresh native failure or tell users to bypass consistency by silently moving fixed points.

Even though the solution looks rectangular, it was authored as a **constrained polygon**, not as the engine's direct rectangle sketch. It therefore does **not** inherit rectangle-only hole, union, difference or Boolean shortcuts. This separate workflow cannot be repurposed as an unrestricted constraint-driven CAD feature graph.

## 5. Save, open and make another edit

Open **Save or open a model** and choose **Download model**. Verify the browser really saved `part.cad.json`. Use **Choose model file** to stage its UTF-8 text in **Saved model data**. File selection alone does not perform the native Open.

Check **Replace accepted model and discard its history and pending dimensions**, then select **Open saved model**. Once accepted, change **Profile X width** or **Profile Y height** again. The authored file retains points, constraints, named dimensions and the extrusion—not a cached solver preview or screenshots. The exact preset labels appear only for an authored graph matching its expected nodes/parameters, so a different imported graph may show generic numeric fields.

The file staging reader rejects empty input, malformed UTF-8 and data larger than 262,144 bytes; explicit Open separately validates the authoring contract. A refusal should preserve the last accepted state.

## What the evidence actually supports

The [native constrained-profile API and reference](../cad/modeling#resize-a-constrained-plate) cite adopted provider [#1835](https://github.com/barocss/barocss/issues/1835) and the real `modeling-constrained-profile.ts` public sample. The retained genuine baseline transfer is **292,980 bytes** and includes the actual six-face convex part and 24-vertex/12-triangle baseline preview.

The editor's receiving/controller tests reuse that baseline under a mocked Worker; edited-state meshes and responses are **mocks**, not fresh captures. These checks establish bounded software behavior and refusal retention, not real browser pixels, GPU compatibility or physical file persistence.

**External visual gate still open:** [constrained plate editor #1865](https://github.com/barocss/barocss/issues/1865) separately tracks physical/device acceptance. No synthetic screenshot, general sketch editor, global constraint solver, commercial CAD certification or mass/tolerance guarantee is implied by this lesson. Live browser/GPU/file tests are **UNRUN in this documentation change**.

[Previous: top-entry pocket](./top-entry-pocket) · [CAD learning path](./learning-path) · [Native constraints reference](../cad/modeling#resize-a-constrained-plate)
