# Make and edit a solid plate

Start with `cad.model()`, give dimensions names, and build a named native Solid. All values are millimetres. No document version, native IDs or revision counters are needed.

<<< ../../../scripts/snippets/modeling-api.ts#imports
<<< ../../../scripts/snippets/modeling-api.ts#plate

`makePlate()` returns an immutable accepted snapshot. Its `bodies.part` is the actual native Solid. `width` and `depth` describe the XY rectangle; `height` is its positive Z extrusion. A build evaluates every authored operation and requires at least one named output.

## Edit, save and reopen

<<< ../../../scripts/snippets/modeling-api.ts#edit-plate

This function uses the imports and `makePlate` function above. Read `editPlate().bodies.part.certificate.volumeMM3` for the exact native volume. `withParameters` returns a new snapshot only after the whole candidate succeeds. Keep `original` or the last accepted snapshot if an edit throws `CadModelError`; no partial candidate is accepted. `save()` returns authored text, and `cad.load()` rebuilds it. Your application owns storage and file dialogs.

## Next: cut and chamfer a part

Continue with the [complete modeling guide](./modeling) for a convex polygon, through-slab cut, unique edge selection, real component chamfer, atomic parameter edits and save/load/re-edit. It includes the supported/refused shapes, error handling and initial resource limits.

This API is bounded: convex XY line sketches, positive +Z extrusions, one X/Y through-slab cut and one admitted cardinal-edge chamfer. Native exactness and tool-coverage rules still apply. It does not establish arbitrary Boolean modeling, persistent topology naming or commercial CAD parity.

For Curve/Surface text programs or older saved feature documents, use the [advanced language reference](./language) and [historical compatibility links](./modeling#advanced-and-historical-compatibility). Source package imports need a TypeScript-capable transformer; built ESM/declarations, registry publication and deployed editor support are separate stages. See the [evidence boundary](./modeling#evidence-and-current-availability).

[Overview](./) · [Model a part](./modeling) · [Capabilities](./capabilities) · [Guides](./guides) · [API](./api)
