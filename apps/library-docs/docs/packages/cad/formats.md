# Exchange formats

## STEP

- **Writing.** An output's `exportStep(options)`, or `exportStep(brep | breps, options)`, writes the exact B-rep as STEP
  AP214: planes, B-spline surfaces and curves. Its options:
  - `name`: the product's name.
  - `timestamp`: the header's time; the default is now.
  - `description`: the header's `FILE_DESCRIPTION` entries. The default is `'BaroCSS CAD part'`; the studio adds its
    source revision.
  - `validationProperties`: CAx-IF geometric validation properties (volume, area, centroid and bounding box), written
    by default so a reader can check what it imported.
  - `meshes`, for mesh bodies:
    - `tessellated`: AP242 triangulated faces, compact;
    - `planar`: the triangles as planar faces, readable by any STEP reader, but large;
    - `auto` (the default): planar up to 5,000 triangles a body, tessellated above.

    Planar faces past 250,000 triangles a body are refused.
- **Reading.** `importStep(text)`, or the `import` feature in a part, reads B-rep solids:
  - **surfaces:** planes, cylinders, cones, spheres and tori as exact rational patches, B-spline surfaces as they are,
    and surfaces of linear extrusion and of revolution;
  - **curves:** lines, circles and ellipses as rational arcs, and B-spline curves.

  A face that goes once round its axis is cut along a new edge. Entities it doesn't take, such as offset surfaces,
  are refused by name. `stepMeshes(text)` reads a file of AP242 tessellated meshes only.

<<< @/../samples/cad-formats.test.mjs#step

With `each: true`, the `import` feature makes each solid in the file its own part (`id/k`), in file order.

## IGES

`exportIGES` writes curves and surfaces as rational B-spline entities (126 and 128). `importIGES` reads the same profile:
untransformed rational B-spline curves and surfaces in IGES 5.3. It gives typed diagnostics for anything else.

In the studio, IGES is for curves and surfaces you edit directly, not solids. See [Files and exports](/studio/files).

## STL

- **Writing.** An output's `exportStl({ segmentsPerQuarter })` writes its display tessellation as binary STL, in
  millimetres. `encodeBinaryStl(positions, indices)` writes any triangle mesh.
- **Reading.** `readStl(bytes)` reads binary or ASCII STL triangles, and `readObj` reads OBJ. The `mesh` feature takes
  triangles as a faceted body.

STL carries triangles only: no units, colours, names or exact curves.

## DXF

`writeDxf(document, { version })` writes a 2D drawing:

- **The input** is a plain document of layers, line types, text styles, blocks and entities.
- **The versions** are DXF 2000 (`AC1015`, the default) and R12 (`AC1009`).
- **Same document, same file.** The output has no time stamps, so the same document always gives the same bytes.
- **R12's limits.** R12 has no ellipses, splines, hatches or multi-line text:
  - polylines and text are rewritten exactly;
  - ellipses and splines become polylines only within a chord tolerance you give;
  - anything else is refused, typed.

  The report counts every such change, so nothing is approximated silently.

<<< @/../samples/cad-formats.test.mjs#dxf

Sheet metal's flat pattern has its own DXF writer, `flatPatternDxf`. Reading a DXF sketch is the document model's
job: see [@barocss/cad-model](/packages/cad-model/).
