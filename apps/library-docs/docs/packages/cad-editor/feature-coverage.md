# CAD feature coverage: native engine versus editor

**Scope:** development snapshot of the BaroCSS CAD family. This is an entry point for deciding which workflows to try, **not** a completion percentage or a commercial CAD certification.

A feature is usable in the modeling workspace only when its **native provider accepts the required geometry**, the **Editor exposes that particular workflow**, and the user's actual device successfully renders/accepts it. Code presence or a passing docs check does not establish all three.

| Feature / user goal | Native implementation | Editor workflow | Authored save/reopen | Browser/GPU evidence for this manual |
| --- | --- | --- | --- | --- |
| Rectangle/polygon sketch → +Z extrusion | Qualified bounded `convex-planar` profiles | `#/model` named-parameter presets | Supported for admitted `cad.model()` recipes | **Not freshly run** for these lessons |
| Circle sketch → round post | `stored-rational-circle-prism`; exact stored boundary only | **Create a round post** preset | Authored radius relation and named post output | **Not freshly run**; **Certified volume unavailable** |
| Rectangular through-hole in plate | `stored-rational-plate-hole` family, strict placement/qualification | **Mounting plate with a through-hole** preset | Admitted model saved and rebuilt | **Not freshly run**; **Certified volume unavailable** for hole-part |
| Underside pocket or through-window | Restricted rectangular cutter, one accepted retained part | **Cut an underside pocket** preset | Preserves named `part`, `plate`, `tool` outputs | **Not freshly run** |
| Top-entry pocket (Z=8 downward) | Bounded owned positive extrusion with derived `from=8-depth`; integer-cell difference | **Cut a top-entry pocket** preset; [guided lesson](./top-entry-pocket) | Preserves `part`, `plate`, `tool` and authored derived Z origin | **Not freshly run**; depth4/6/8 based on native provider, edited preview mocked |
| Constrained polygon plate | Bounded native constrained sketch and +Z extrusion; not direct rectangular authoring | **Resize a constrained plate** preset; [guided lesson](./constrained-plate) | Authored points, constraints, `width`/`height` and fixed 8 mm thickness | **Not freshly run**; `lockY` internal, edited-state meshes mocked |
| Union of rectangular extrusions | Restricted connected `orthogonal-cell` material | **Fuse an L-bracket** preset | Preserves `base`, `leg`, `bracket` | **Not freshly run**; edge-only/disconnected refused |
| Convex intersection and through-slab cut | Bounded convex/native operation families | Available through admitted modeling examples | Bounded authored-graph save/rebuild | Per-feature evidence; no general browser guarantee |
| Cardinal-edge chamfer and some splits | Qualified restricted edges/planes | Admitted modeling presets, selected options | Bounded parameter edit and rebuild | Per-feature evidence; not arbitrary fillet/chamfer |
| NURBS Curve/Surface control edits | Original native coefficients, knots, weights, qualified operations | Separate Surface/Curve editor workspace | Original document files retained | Existing focused flows; not blanket device parity |
| Boolean-extrusion feature graph | Native Face/Boolean/extrusion graph, scoped parameter/feature transactions | Separate **New Boolean extrusion** workspace | Accepted native authored graph | Existing bounded flow receipts; not general solid Boolean |
| Assembly authoring | Selected native assembly contracts and bounded flows | Separate assembly workspace work exists | Case-specific | **Not established as general assembly/mate support** |
| General sketch constraints and drag solver | Some exact affine/radius/tangency increments | Specialized driving-sketch work | Case-specific | **Full interactive/global constraint solver unverified** |
| Arbitrary curved Boolean, fillet and topology naming | General solution not established | Not a generally supported modeling operation | Not generally supported | **Not established** |
| Binary STL export of a named convex output | Accepted `convex-planar` body, native revalidation and at most 40 Float32 facets | **FILE → Export accepted STL**, explicit **STL output**; [STL versus editable model](./export-stl) | STL is a *separate triangle handoff* with an mm convention, **not** authored Save/Open or native feature-history interchange | **Not freshly run** in this Manual; disk, slicer and device proof remain separate |
| STEP exchange and production 2D drawings | Commercial-grade target in roadmap | General workflow not established | Not generally supported | **Not established** |

## What the status labels mean

- **Qualified bounded** means source and provider evidence support only named input/operation families and the stated refusal rules.
- **Editor workflow** means an actual route, preset or tool exists; it does not certify every supported native operation is exposed through a single UI.
- **Save/reopen** means accepted *authored* intent is serialized and rebuilt for a specific format, not that meshes, viewport state or arbitrary CAD interchange are preserved.
- **Not freshly run** means these Manual changes have not performed new real-device browser/GPU/file validation. Consult [browser evidence requirements](./browser-evidence) before upgrading a status.

## Where to learn and verify

Start with the [CAD learning path](./learning-path), then consult [native modeling and specific refusal cases](../cad/modeling) and [native capability details](../cad/capabilities). The [CAD Editor developer guide](./guides) documents its separate session and React workflows.

When a new tool is merged, update **only the affected row** with its true native, UI, save and browser evidence. A completed Issue or exported function alone is not reason to mark the entire tool family complete. Keep source-adoption, local testing, actual browser/GPU and release/publication independently visible.

**Current verification status of this table:** source and repository documentation review only; live browser run, GPU readback, and physical file roundtrip remain **UNRUN** in this documentation change.
