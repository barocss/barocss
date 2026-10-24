# Files and exports

## The .bcad document

**Save** writes the part as a `.bcad` file. It holds the model's history, so it reopens editable. A part with no mesh
bodies is written as plain JSON. A part with mesh bodies is written as a small binary container, `BCADPACK`, that
holds the document and each mesh array. Each array is named by its SHA-256, and the name is checked when the file is
read. Both kinds open.

Documents follow the latest schema. The studio is unreleased, so there is no migration between its versions.

With a project open, **Save** writes into the project's folder instead of downloading, and you can keep versions of
the part. See [Projects and versions](/studio/projects).

## Opening files

**Open** reads:

| File | Opens as |
|---|---|
| `.bcad`, `.json` | The part, with its history |
| `.step`, `.stp` | The exact solids, one body for each solid. The toast says the file's length unit; a file that declares none is read as millimetres. |
| `.stl`, `.obj` | A mesh body. You first choose the file's unit in **Mesh units**. |
| `.igs`, `.iges`, `.barocad` | Curves and surfaces you can edit directly |
| `.dwg` | Refused: **DWG files are not read** |

A file that can't be read leaves your part unchanged. A file whose extension Open doesn't read, such as another
program's `.cad`, is refused as **Can't open** with its name, and the toast lists what Open reads. A file with no
extension is tried as a model.

A STEP file that holds only meshes (AP242 tessellated, from scans or other systems) is read like an STL. A mesh that
isn't closed and clean goes through the **mesh repair** dialog before it opens:

- it lists what is wrong with the mesh;
- the repair steps are **Fill holes**, **Orient**, **Drop degenerate triangles**, **Drop fins** and **Drop tiny pieces**,
  all on to start, each of which you can turn off;
- **Check the repair** runs it and reports the triangles and area it adds and what is still open;
- **Apply the repair** keeps it as a step on the mesh, which the badge in the **Browser** lets you change later.

![The mesh repair dialog for a cup with an open top: one hole, the repair steps and the checked repair's numbers](/shots/studio/files/mesh-repair.png)

**Insert part** places another `.bcad` part in this one as an instance; see [Assemblies](/studio/assemblies).
**Templates** starts a part from **Empty part**, **Plate with a hole** or a template you saved. Your templates are kept
in this browser.

## Unsaved work

While a part is unsaved, a recovery copy is written in this browser a moment after each change. After a reload or a
crash, **Unsaved work** offers it back: **Restore** or **Discard**. The copy is cleared when you save or replace the
part. It is kept only in this browser, so it is no substitute for saving. In a project, the work since the last save
is kept in the project instead.

- **Mesh data first.** A part's mesh data is stored before the copy that names it. So a copy is offered only when its
  meshes were kept too. If they are gone by the time you restore, for example because the browser's data was cleared,
  **Could not restore** asks you to open the mesh file again.
- **When no copy can be kept,** the studio says so once:
  - **No recovery copy:** the browser doesn't keep one, in private browsing or with full storage.
  - **Crash recovery is off for this document:** the part is too large for the browser's storage.

  In both cases, save to keep your work.

## Exports

| Export | What it writes |
|---|---|
| **Export STEP** | The exact solids, for other CAD |
| **Export IGES** | The visible curves and surfaces, when the part has some |
| **Export STL** | Triangles in millimetres, one file per body, with no colours, names or exact curves |
| **Export 3MF** | For a slicer: bodies, materials, colours and the print orientation |

- **Touching pieces.** A body whose pieces touch only along an edge or at a point is written as one STL file per piece,
  and as separate 3MF objects, because a reader would weld them otherwise.
- **The display mesh.** When the kernel can't mesh a body for STL, its display mesh is written instead, and the toast
  names the body.
- **Drafts.** If the part has dimensions read from an image or drawing that aren't confirmed yet, STEP and STL still
  export, and the toast says it is a draft and which dimensions are open.
- **Not up to date.** A part that is still evaluating, or that failed to evaluate, isn't exported. Fix it, or wait,
  and export again.

**Sources.** Each export names the document revision it was made from:

- STEP writes it in its `FILE_DESCRIPTION`;
- 3MF writes it as `barocss:SourceRevision` metadata;
- a drawing writes it as an **SRC** line in the title block.

STL and USD get a `<name>.source.json` record beside them, and the URDF, MJCF and SDF zips hold a
`robot.source.json`. See [Revisions and sources](/guide/concepts#revisions-and-sources).

From the **Drawing** tab, **Export SVG**, **Export PDF** and **Export DXF** write the sheet, with DXF as 2000 or R12;
see [Drawings](/studio/drawings). **Quote package** writes STEP, the manufacturability report and the request in one
zip; see [BOM and quotes](/studio/bom).

## Robot files

The **Joints** card exports the robot; see [Robots](/studio/robots).

| Export | File |
|---|---|
| **Export URDF** | A zip of `robot.urdf`, its meshes and `robot.source.json` |
| **Export MJCF** | A zip of `robot.xml`, its meshes and `robot.source.json` |
| **Export SDF** | A zip of `robot.sdf`, its meshes and `robot.source.json` |
| **Export USD** | A `.usda` file, and its `.source.json` beside it |
