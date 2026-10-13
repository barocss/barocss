# Choose the right CAD Editor workspace

BaroCSS currently contains **several bounded CAD authoring workflows**, not one universal command ribbon. This guide helps you start in the right place before changing a model.

> **Availability:** This is based on the current application/package source. It does not claim that the full flow has passed new live browser, GPU or physical-file testing. For per-operation limits, see [feature coverage](./feature-coverage).

## What do you want to create?

| Your job | Start here | What it edits | Important boundary |
| --- | --- | --- | --- |
| Change the height, cut depth, radius, or width of a supported mechanical part | **Model a part**, at `#/model` | Named parameters in a `cad.model()` authored recipe and named outputs | Predefined admitted part families—not arbitrary freehand solids |
| Build a post, perforated plate, or joined L-bracket | **Model a part** → **Modeling examples** | Round-post, mounting-plate and L-bracket presets | Follow exact supported input/refusal rules; [four lessons](./learning-path) |
| Move an original Curve or Surface control point or change a weight | The separate **Curve/Surface document editor** | Original asset/body-qualified coefficients and native source | Not a general solid feature-history editor |
| Change a Boolean between two coplanar Faces and extrude the result | **New Boolean extrusion** workbench | An authored Face → Boolean → extrusion dependency graph | This is **not** a general Boolean of arbitrary closed solids |
| Assemble arbitrary parts with mates or create STEP manufacturing output | No general certified user workflow yet | Product roadmap, not a current standard command | Do not promise assembly mates, STEP exchange, 2D production drawings or arbitrary fillets |

## Working in Model a part

1. Open `http://127.0.0.1:52010/#/model` in the running local CAD Editor app.
2. Under **Modeling examples**, choose an example; choose **Load example** to adopt it. If there is an accepted model already, review and explicitly confirm replacement.
3. Edit a value under **Named dimensions**. A changed input is a **draft**, not new geometry.
4. Choose **Apply dimensions**. Only a successfully admitted result becomes the accepted native model. **Discard draft** drops edits not yet accepted.
5. Inspect the required **named output** rather than assuming every intermediate tool/operand is the finished part. Undo and Redo operate on accepted history.
6. Choose **Download model** for authored model bytes. **Choose model file** stages raw text only; review it and explicitly select **Open saved model** to parse/admit a replacement. A download notification does not certify that bytes persisted on disk.

For exact actions and examples: [first pocket](./first-model), [round post](./round-post), [mounting plate](./mounting-plate), [L-bracket](./l-bracket). For a supported named convex output, use the [STL export versus editable CAD Save guide](./export-stl): **Download model** preserves modeling intent, whereas **Download STL** writes approximate facet bytes. For accepted/draft confusion or a refused edit: [troubleshooting](./troubleshooting).

## Working with original Curve and Surface assets

The separate document editor has native Curve/Surface objects with asset-qualified identities. Select an original control point, stage supported coordinate/weight fields, and **Apply** through native qualification before treating the edit as accepted. A display mesh is only a view of that source. The original native file retains complete source/asset relationships, even where the displayed set contains fewer bodies.

Its saved native document format is **not interchangeable by assumption** with every `cad.model()` envelope or the Boolean extrusion feature graph. Open the document in the corresponding workflow; do not relabel a mesh export as editable native data.

For developer and file-contract details use the [CAD Editor guide](./guides) and [API reference](./api).

## Working in the Boolean extrusion workbench

Use **File → New Boolean extrusion** for the admitted authored **two-Face → Boolean → normal extrusion** graph. This workbench has Face/dependency selection, a Boolean operation (union/intersection/difference), parameter/length editing, Apply/Discard and accepted-graph Save/Open. The geometries here are admitted native Face/extrusion profiles; this tool is **not** evidence that arbitrary nonconvex/curved closed-solid Boolean operations work.

For native qualification details and bounded operations, consult [CAD capabilities](../cad/capabilities).

## How to interpret success

**Accepted model**, **native exactness**, **displayed pixels**, **saved disk file** and **published product availability** are different assertions. The browser might show an accepted view without proving a certified volume; a download may start without a verified physical roundtrip. See [browser evidence protocol](./browser-evidence) before describing a model or tool as device-tested.

**Roadmap:** [CAD Editor product scope](https://github.com/barocss/barocss/issues/1029) · [CAD commercial goal](https://github.com/barocss/barocss/issues/503) · [Manual parent](https://github.com/barocss/barocss/issues/1247).
