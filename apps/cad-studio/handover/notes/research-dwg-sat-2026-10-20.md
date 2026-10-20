# DWG / SAT import S0 — demand against effort (2026-10-20, O61)

This is research and a decision only, with no product code. It is roadmap README §4: "Late … DWG/SAT import, only after an S0 that weighs demand against effort, recorded either way."

I read public HTML only and downloaded nothing. Where a specification exists only as a PDF, it is named below and was not read.

## What we already cover

| Path | Ours today | Where |
|---|---|---|
| DXF read | 2D profile geometry as a sketch draft: LINE, ARC, CIRCLE, LWPOLYLINE (bulges), POLYLINE/VERTEX; $INSUNITS. Annotation (TEXT, MTEXT, DIMENSION, HATCH, POINT, SOLID) is left out and listed. SPLINE, ELLIPSE, blocks and 3D entities are refused, typed. | `src/sketch/dxfRead.ts` (A6.4, O28) |
| DXF write | Drawing sheets, sections and sketches. AC1015 by default with an R12 option; layers, DIMENSION with its block, HATCH, a title block as a block. | `src/drawing/dxf.ts` through the kernel's `writeDxf` (R11b, O1) |
| STEP import | Solids through the tolerance and validation gate. PLANE, CYLINDRICAL/CONICAL/SPHERICAL/TOROIDAL_SURFACE, (RATIONAL_)B_SPLINE_SURFACE_WITH_KNOTS, SURFACE_OF_REVOLUTION / LINEAR_EXTRUSION; LINE, CIRCLE, ELLIPSE, B_SPLINE_CURVE_WITH_KNOTS, TRIMMED_CURVE. | kernel `step-import.ts` |

These are exactly the surface and curve kinds a SAT body's analytic and B-spline geometry would map onto.

## Specifications and licence terms

- **DWG: the ODA *Open Design Specification for .dwg files*.**
  - It covers AutoCAD R13 to 2018 (AC1032), per the Library of Congress format description.
  - It is a PDF only (`OpenDesign_Specification_for_.dwg_files.pdf`, v5.4.1, © 1998–2018). Not read.
  - Its notice, as the search summarised it, says "informational use only", "as is", and "subject to change". No implementation grant was found.
  - The 2010 Autodesk–ODA settlement is confidential. It allows interoperable software and the .dwg extension.
  - → Building from it needs the owner's or a legal reading of that notice.
- **DWG: LibreDWG.** GPL-3.0+, beta. The decoder is "done" but skips some advanced R2010+ entities; the writer is "good enough for R1.1–R2000".
  - Reference-only as recorded: its code is never read. Its format knowledge is a spec file inside its source tree, which therefore can't be read either.
- **DWG/DXF: acadrust** 0.6.5 (2026-10-18), MPL-2.0.
  - Reads and writes DXF and DWG R12–2018+; 48 entity types, ACIS SAT/SAB parsing, failsafe reading with diagnostics.
  - Its docs point to a list of known fidelity gaps.
  - Per the owner (2026-10-18) it is read for the formats only, never copied or ported. It could serve as a test-only oracle in tooling.
- **ACIS SAT: Spatial's *SAT Save File Format*.**
  - Public as a PDF only (`sat.pdf`, linked from paulbourke.net/dataformats/sat; a chapter copy circulates on Scribd). Not read.
  - Secondary summaries: header, entity records with integer pointers, `#`-terminated records, `.sat` text and `.sab` binary with the same data.
  - **Versions:** save versions up to 700 match Spatial ACIS. AutoCAD writes modified formats from 20800 on (2004: 20800, 2007: 21200, 2010: 21500, 2013: 21800), which Spatial ACIS itself can't read without conversion (ODA's Teigha note).
  - So the SAT inside a DWG/DXF 3DSOLID is Autodesk ShapeManager's variant, and no public document describes it.
- **Converters users already have:**
  - ODA File Converter: GUI and command line; Windows, macOS, Linux; batch DWG ↔ DXF across versions. Its EULA was not checked.
  - Every AutoCAD-family program saves DXF.
  - SolidWorks and Inventor export STEP AP214/AP242 as well as SAT.

## Demand against effort, per item

### 1. DWG R2000–R2018+ 2D entities as a drawing or underlay: **defer**

- **Demand.** Real but indirect. AEC and shop drawings arrive as DWG. Every producer can also write DXF, and the ODA converter batch-converts for free. We have no user evidence yet (L0) of a scenario that fails for DWG alone.
- **Effort.** Large, several weeks of our own TypeScript:
  - the R2000 bit-coded stream;
  - R2004+ sectioned and compressed files with an encrypted header;
  - R2007's separate encoding;
  - the R2010+ object map, class handling and code pages;
  - on top of all that, the entity set (blocks, MTEXT, HATCH, DIMENSION, SPLINE, layouts).
- **Spec access.** The ODS is a PDF whose terms need reading first.
- **What is worth doing first, inside the outer lane:**
  - (a) the DXF reader as an underlay or drawing as well as a profile source: SPLINE, ELLIPSE, INSERT/BLOCK, TEXT/MTEXT shown rather than refused. This is what a DWG user gets after "Save as DXF";
  - (b) a `.dwg` dropped on the studio refused, typed, with the route: save as DXF, or the ODA File Converter.
  - Both are small. They are not this S0's to do: each needs its own S0 if wanted.
- **Revisit when:** a recorded user or agent scenario fails because only DWG exists and conversion is not acceptable; or the owner clears the ODS terms.

### 2. ACIS SAT/SAB solids into our B-rep: **defer (no-go for now)**

- **Demand.** Low and falling. The CAD systems that write SAT (SolidWorks, Inventor, older ACIS-based tools) all write STEP, which we import. Most SAT seen today sits inside DWG/DXF 3DSOLIDs, and that SAT is the undocumented ShapeManager variant (≥ 20800), not the ≤ 700 text the spec describes.
- **Effort.** Moderate for the ≤ 700 text format, about 1.5–3 weeks in the kernel lane:
  - the record parser and pointer graph;
  - topology (body/lump/shell/face/loop/coedge/edge/vertex);
  - analytic surfaces (plane; cone, which covers the cylinder; sphere; torus);
  - spline surfaces and intcurves. Most are procedural (blends, offsets, sweeps, intersections) and carry an approximating B-spline with a fit tolerance, so they would come in at that tolerance;
  - then through the STEP import's gate.
  - SAB binary is the same data and small extra work. The AutoCAD variant can't be scoped without a document.
- **Spec access.** `sat.pdf` only.
- **If it ever becomes go:** the implementation is the kernel lane's (its import path), as recorded.
- **Revisit when:** a scenario brings SAT-only files (a legacy archive with no STEP), or 3DSOLIDs in customer DXF become common enough that the ShapeManager variant has to be faced.

### 3. DWG writing of drawings: **no-go**

- **Demand.** Our DXF writer (R11b) already serves every consumer that would read a DWG drawing: AutoCAD and its family, LibreCAD, ODA tools, laser and CNC software.
- **Effort and risk.** All the reading complexity again, plus checksums, version-specific encodings and AutoCAD's own checks on files it did not write, all to deliver nothing DXF doesn't.
- **Revisit when:** a recorded consumer accepts DWG only.

## Evidence level

L0 to L1. These are reasoning and public statements. The demand side has no user data behind it, so each "revisit when" names the evidence that would reopen the item.

## Sources (HTML read)

- loc.gov — DWG format description: https://loc.gov/preservation/digital/formats//fdd/fdd000445.shtml
- Digital Engineering 24/7 on the ODS update: https://www.digitalengineering247.com/article/open-design-alliance-updates-open-design-specification-for-dwg-files
- GNU LibreDWG: https://www.gnu.org/software/libredwg/
- acadrust on docs.rs: https://docs.rs/acadrust
- ODA, "Working with .sat and .sab Files in Teigha": https://www.opendesign.com/node/1285
- Paul Bourke, SAT Save File Format (an index page linking `sat.pdf`): https://paulbourke.net/dataformats/sat/index.html
- Bricsys forum on SAT versions: https://forum.bricsys.com/discussion/comment/20943
- ODA File Converter: https://www.opendesign.com/guestfiles/oda_file_converter.md

PDFs named, not read: `OpenDesign_Specification_for_.dwg_files.pdf` (ODA, v5.4.1) and `sat.pdf` (Spatial/ACIS). Neither is needed while every item is deferred or no-go.
