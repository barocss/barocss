# Files and exports

## The .bcad document

**Save** writes the part as a `.bcad` file. It holds the model's history, so it reopens editable. A document with no
mesh blob references is written as plain JSON. This includes older documents with mesh arrays stored inline. When a
document references mesh blobs, Save writes a binary container, `BCADPACK`, with the document and the referenced
arrays. Each blob is named by its SHA-256, and the name is checked when the file is read. Both kinds open.

The file reader reads schemas 3 and 4 after checking the file. When **Open** fills missing fields, **Opened an older
model** lists the changes. The file stays unchanged until you save. An older or newer schema or unknown feature is
refused. This does not guarantee compatibility between all unreleased versions. See
[Document schema](/reference/document#schema-version).

Keep a `.bcad` copy for later edits. Use an export for the receiving CAD system or slicer; it does not replace the
saved document's feature history, mates and settings.

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

STEP checks declared SI length prefixes before opening solids or meshes. An unsupported prefix, such as
NANO, is refused with `NOT_READ`; it is not treated as an undeclared millimetre file. A supported declaration
elsewhere in the file does not hide that refusal. The accepted part and its edits remain unchanged. Supported
unit scaling and the millimetre fallback for files with no declared length unit retain their existing behavior.

A STEP file that holds only meshes (AP242 tessellated, from scans or other systems) is read like an STL. A mesh that
isn't closed and clean goes through the **mesh repair** dialog before it opens:

- it lists what is wrong with the mesh;
- the repair steps are **Fill holes**, **Orient**, **Drop degenerate triangles**, **Drop fins** and **Drop tiny pieces**,
  all on to start, each of which you can turn off;
- **Check the repair** runs it and reports the triangles and area it adds and what is still open;
- **Apply the repair** keeps it as a step on the mesh, which the badge in the **Browser** lets you change later.

Keep the original exchange file before importing or repairing it. STEP opens as imported geometry, not the source
system's feature history. Saving the imported result as `.bcad` keeps the edits made here; it does not recover that
earlier history. A mesh import also requires the correct unit before its dimensions can be used.

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
| **Export STEP** | Exact solids and mesh bodies in the selected STEP representation |
| **Export IGES** | Visible curves and untrimmed surfaces; a visible trimmed surface refuses the whole export |
| **Export STL** | Triangles in millimetres, one file per body, with no colours, names or exact curves |
| **Export 3MF** | For a slicer: bodies, materials, colours and the print orientation |

Hidden trimmed surfaces do not block IGES export of the other visible geometry.
Use **Untrim** only when you intend to remove a surface's trims.

### Choose how STEP writes mesh bodies

When the evaluated part contains a mesh body other than infill, **Export STEP** opens **Mesh bodies in the STEP file as…**. Select a representation, or select **Cancel** to close the dialog without exporting.

| Choose | What it writes |
|---|---|
| **Auto** | Closed mesh bodies with up to 5,000 triangles per body use planar faces. Larger ones use AP242 tessellated faces. |
| **Tessellated (AP242, compact)** | Mesh bodies use AP242 triangulated faces. Check that the receiving app supports this representation. |
| **Planar faces (compatible)** | Closed mesh bodies use triangles as planar B-rep faces, merged where flat. More than 250,000 triangles in one body is refused. |

Open mesh sheets always use AP242, including when you select **Planar faces (compatible)**. A body with both exact
and mesh faces can use only AP242; selecting planar faces is refused. Its exact faces are sampled at 64 segments
per quarter. Planar files can be large. Older CAD, CAM and slicer apps may not read AP242 tessellated faces.

See [STEP mesh options and format limits](/packages/cad/formats#step) before choosing a representation for another app.

### Choose an STL quality

1. Wait for the current design to finish evaluating. Fix any evaluation error before exporting.
2. Choose **Export STL**. **Quality** starts at **Automatic** each time the dialog opens.
3. Use the table below to choose a quality, then choose **Export**. Choose **Cancel** to stop preparation.
4. Read the export message. If it names bodies written from the on-screen mesh, review those files before use.
   Keep the downloaded `.source.json` beside the STL files.

| Situation | Choose or do this |
|---|---|
| You do not need a specific sampling setting | Use **Automatic**. It leaves the quality option unset. |
| You need a specific setting for B-rep bodies | Use **Draft 8**, **Standard 16** or **Fine 32**. These set `segmentsPerQuarter` to 8, 16 or 32. They are dimensionless sampling settings, not millimetre error tolerances or guaranteed geometric error bounds. |
| The output includes a mesh body | Use **Automatic**. An explicit quality is refused. |
| Pieces touch only at an edge or point | Use **Automatic**. It splits the display mesh into one STL per piece. |
| The document has visible placed instances | Open the part's own document before using an explicit quality. |
| Automatic reports use of the on-screen mesh | The kernel returned no STL bytes (`null`), so the display mesh supplied the bytes. This fallback does not mean the kernel export succeeded. |
| Explicit quality cannot produce bytes | No STL or source sidecar is downloaded. Read the message; use **Automatic** only if its display-mesh fallback is acceptable. |
| Export reports an error | Read and correct the reported problem, then export again. A worker error stops both Automatic and explicit export; it does not select the fallback. |
| The design changes during preparation | Wait for the current design to evaluate, then open **Export STL** again. The stale request downloads nothing. |

All STL bytes and the source sidecar are prepared before downloads start. **Cancel** during preparation discards
the pending export without downloading either. Changing quality does not change the on-screen mesh or save a
quality setting in the document.

STL coordinates follow the millimetre convention, but the file stores no unit.
Confirm the scale in the receiving app before using the mesh.

![STL export flow: quality selection, preparation, current-design check and download](/diagrams/stl-export-flow.svg)

If dimensions read from an image or drawing remain unconfirmed, STEP and STL still export.
The message identifies the export as a draft and lists the open dimensions.

For 3MF, pieces that touch only at an edge or point remain separate objects to avoid welding them in a reader.


**Sources.** Each export names the document revision it was made from:

- STEP writes it in its `FILE_DESCRIPTION`;
- 3MF writes it as `barocss:SourceRevision` metadata;
- a drawing writes it as an **SRC** line in the title block.

STL and USD get a `<name>.source.json` record beside them, and the URDF, MJCF and SDF zips hold a
`robot.source.json`. See [Revisions and sources](/guide/concepts#revisions-and-sources).

Keep source records beside the files they name when you send or archive an export. A source record identifies the
input document revision and its canonical-content SHA-256; it is not a checksum of the exported file's bytes.
After a document change, export again to produce files and source information for that revision.

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
