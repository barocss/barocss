# Export one CAD output as STL without losing the editable model

**Level:** intermediate · **Workspace:** CAD Editor `#/model` · **Unit convention:** mm · **Output:** one named, accepted convex body

**Save a model** and **export STL** are deliberately different operations. **Download model** retains authored sketches, feature operations and named parameters for a future edit. **Download STL** exports one qualified solid as *approximate binary Float32 triangles* for a downstream tool. An STL file cannot be reopened as editable `cad.model()` history by **Open saved model**.

This is a source-backed walkthrough of the current **experimental local editor**, not proof of a physical browser download, slicer compatibility, watertightness or manufacturing readiness. See the [workspace selection guide](./choose-workspace) before using another CAD file mode.

## Choose the format that meets your goal

| Your goal | Use | What is retained | What is **not** retained |
| --- | --- | --- | --- |
| Change dimensions and feature history tomorrow | **FILE → Save or open a model → Download model** | Accepted authored JSON (`part.cad.json`), named parameters, operations and outputs | Uncommitted drafts, GPU frame, camera or runtime mesh cache |
| Hand one supported shape to a triangle/facet consumer | **FILE → Export accepted STL → Download STL** | Binary facets for **one** selected accepted `convex-planar` output (`<outputName>.stl`) | Authoring tree, units metadata, native IDs, Surface trims, UV topology, editable feature history |
| Reopen and edit the model | **Choose model file** → review **Saved model data** → **Open saved model** | Rebuilt admitted native model from authored source | Neither a shortcut from STL triangles to CAD operations nor an automatic file conversion |

A browser notification such as "Download requested" means an action began. **Check the downloaded bytes on disk** before relying on any exported file.

## 1. Start with a known supported CAD output

From a workspace with Node 22+ and existing installed dependencies:

```sh
pnpm --filter @barocss/cad-editor build:library
pnpm --filter @barocss/cad-editor-app dev
```

Visit `http://127.0.0.1:52010/#/model` (or your Vite port plus `#/model`). In **Model a part**, wait for **Accepted model**.

For a reproducible two-output exercise, use the actual [saved translated-gusset fixture](https://github.com/barocss/barocss/blob/31ad07d5234326bf68b937c070000e94d2c45501/packages/barocss-cad/test/modeling-translation-evidence/initial.cad-model.json) or generate it with the [typed public example](../cad/modeling#open-and-space-two-translated-gussets). The fixture contains named `left` and `right` outputs in the admitted `convex-planar` family; it is **not** a built-in example picker entry.

Use **FILE → Save or open a model → Choose model file** to stage that saved JSON. Verify the text appeared in **Saved model data**. If another model is already accepted, first preserve what you need, then check **Replace accepted model and discard its history and pending dimensions**. Select **Open saved model**, and wait for **Accepted model**. Choosing a file alone does *not* parse or accept the model.

This workflow accepts **authored model JSON**, not `.stl` bytes, a screenshot or a mesh export. The staged file reader checks a **262,144-byte** limit, valid UTF-8 and nonempty contents; a readable file can still fail the separate native Open qualification.

## 2. Pick the output to export independently of the viewport

1. In the **FILE** menu, choose **Export accepted STL**. This opens the **Output bodies** panel, which contains **Export accepted geometry**.
2. Under **STL output**, select **right · convex-planar**. You must choose one named output; **Choose an accepted output** is the initial placeholder.
3. Do not assume that **Visible output body** or the selected face controls the exported file. Those are display/selection choices. The STL selector is an independent explicit selection.
4. If you have a pending numerical edit marked **Dimension changes pending**, use **Apply dimensions** or **Discard draft** first. STL export is unavailable while the editor is busy or has pending drafts.
5. Select **Download STL**. Its bytes come from the **accepted native output**, not from a screenshot or the triangles currently shown in the viewport.

The selected `right` output belongs to a valid native Solid. The editor's source, parameters, history, visible output and face selection are **not modified** by a successful read-only export. The output file name is derived from the qualified output name, e.g. `right.stl`; selecting `left` requires a separate explicit choice.

### What to expect for the retained provider sample

The accepted **right-gusset** provider capture records **684 bytes**, **12 facets**, authored XYZ bounds **[48, 0, 0]–[88, 24, 8] mm** and **0 mm measured Float32 vertex displacement** for this particular integer-coordinate model. A genuine [right-gusset STL example](../cad/modeling#export-the-right-gusset-as-stl) is available in the underlying reference.

The result banner reports `<outputName>.stl`, byte length, triangle/facet count, **maximum vertex displacement** and **Browser download requested**. Check it against the *actual* accepted source and independent provider receipt; a correct-looking banner is **not** proof that the browser wrote a file to disk.

Every export has a bounded limit of **at most 40 facets / 2,084 bytes**. The bytes use **authored XYZ coordinates without a scene-axis conversion**. The millimetre value is a **caller/report convention** because binary STL does **not** store length units. Other models can have nonzero binary64-to-Float32 coordinate loss; never generalize the measured zero-loss gusset to arbitrary CAD shapes.

## 3. Keep your editable source separately

Open **FILE → Save or open a model** and choose **Download model**. This starts a separate `part.cad.json` download preserving accepted modeling intent. Confirm the file on disk and retain it as your edit/rebuild source.

To check the intended distinction, use **Choose model file** on that JSON, explicitly review and confirm **Open saved model**, then re-edit the `spacing` named dimension if present. The existing source-backed gusset recipe admits **spacing 48 → 64 mm** with separate accepted `left`/`right` native outputs. The editable file does not store a previously chosen STL output, browser selection, GPU image or a private runtime cache.

**Do not feed `right.stl` into Open saved model.** STL is a facet handoff, not a `cad.model()` JSON envelope. This editor does not provide an automatic STL → editable B-Rep/source-history import in this workflow.

## 4. Unsupported bodies and recovery

The STL selector refuses or disables unsupported outputs. The current bounded export is for an accepted **primary `convex-planar`** body. A qualified `stored-rational-circle-prism` (round post), `stored-rational-plate-hole` (through-hole), or `orthogonal-cell` (Boolean union/difference) output **does not become exportable just because you can see its mesh**. Legacy compatibility sources also cannot be exported through this action. Do not silently approximate unsupported families or relabel their preview as certified STL.

If the native Worker is unavailable, the button becomes **Recover accepted model and export STL**. This is an **explicit user action**, not a silent retry. It rebuilds the existing accepted authored source, checks that its saved source/summary still match, and requests the qualified export without changing model history or display. A stale/cancelled/invalid Worker reply produces **no download**. If recovery fails, preserve the accepted authored JSON rather than treating a reconstructed mesh as new source authority.

An STL with numeric vertices and consistent facet normals still is **not** a warranty that a downstream slicer will accept it or that global topology/tolerances survived Float32 quantization. No millimetre metadata, exact native face IDs, manufacturing certification, CAD interchange guarantees, or generic Boolean export is promised.

## Evidence and verification boundary

**Existing provider evidence:** the [named convex-output STL receipt](https://github.com/barocss/barocss/tree/5c6dc223a9b9e6b88bc8134651366b23147bc7c4/packages/barocss-cad/test/modeling-stl-evidence) records the retained source, native parent validation and sample file bytes. The [native modeling reference](../cad/modeling#download-stl-from-the-model-editor) distinguishes this provider evidence from browser downloads. The Editor's focused test replays retained genuine bytes with mocked provider/Worker responses. They do not rerun the native provider or prove actual browser interaction.

**UNRUN for this documentation-only change:** fresh React/device/browser clicks, physical file download and cold reopen, GPU readback, downstream slicer, screenshot authenticity and site publication. To upgrade this evidence, follow the [browser evidence protocol](./browser-evidence). In particular, the required physical file roundtrip must be executed and recorded, not inferred from clicking **Download STL**.

[CAD learning path](./learning-path) · [Workspace selection](./choose-workspace) · [Feature coverage matrix](./feature-coverage) · [Troubleshooting](./troubleshooting)
