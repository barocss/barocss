# Prepare drawing and manufacturing files

## Goal

Make a sheet from the current model, check its references, and prepare files for a recipient.
Review the BOM and manufacturing report as separate results.

## Before you start

- Have the part or assembly open in Studio.
- Choose the material and manufacturing process needed for the report.
- Load your shop rows when a feature or rule needs them.
- Keep an editable `.bcad` copy of the model.

Rows must come from a file that a person supplies.
Sample rows are examples, not a built-in standard or supplier approval.

## Work through the document

1. Open the Drawing tab and choose Drawing scope.
   Select the base part, a placed part, or the assembly.
   Choose the scope before adding manual references.
2. Choose the sheet size, scale and projection.
   Review the front, top, right and isometric views.
   Show the hidden lines, tangent edges and centre lines that the sheet needs.
3. Use Auto under Dimensions to add automatic dimensions.
   It replaces its earlier automatic dimensions and keeps manual ones.
   Add the manual dimensions and notes that the sheet still needs.
4. Read Drawing issues after a model change.
   Review lost dimensions, unresolved datums and control frames.
   Apply a proposed fix only after you inspect the affected reference.
5. Open BOM and review quantities, sources and bought or made settings.
   Read estimate marks where a line has no shop row.
   Add the sheet's BOM table and balloons when the drawing needs them.
6. Check the selected process and its inputs in Library.
   Ask the agent to check the part for that process.
   Read each rule's value, limit, source and reason.
7. Export the sheet as SVG, PDF or DXF.
   Export a purchase list separately when the recipient needs bought quantities.
   Use Quote package for an injection-moulding request, then read its manifest.

![Existing Drawing example: automatic dimensions and a hole callout on a sheet](/shots/studio/drawings/auto-dimension.jpg)

This image is reused from the Drawings guide.
It illustrates a dimensioned sheet, not a new check of your model.

## Check the results

- Check the drawing title, REV and SRC line.
- If Revision out of date appears, review the model changes against that revision.
- Check Drawing issues as well as the marks on the exported sheet.
- Check PDF notes and title text if the export warns about `?` characters.
- Read `pass`, `warn`, `fail`, `unknown` and `n/a` separately in the process report.
- In a quote ZIP, read `open` and `complete`; check whether `part.step` is present.

`unknown` marks a missing input or measurement in the process report.
The purchase CSV is a quantity and sourcing list.
It is not a price calculation.
Do not add all displayed BOM line masses to recalculate the total.
Element mass is already included in its part's mass.

## Keep these limits in view

A scope change is refused while manual dimensions, datums, control frames
or notes with leaders remain on the sheet.
Keep that scope, or remove those references explicitly before changing it.
An exported sheet can still have unresolved drawing issues.
Tolerance annotations do not verify the part's geometric tolerances.
A quote ZIP can contain open items or omit a failed STEP export.
A complete quote request is not manufacturing approval.

## Continue with the detailed guides

- [Sheet views and scope](/studio/drawings#the-sheet)
- [Dimensions and notes](/studio/drawings#dimensions-and-notes)
- [Drawing issues and exports](/studio/drawings#issues)
- [BOM, mass and quote packages](/studio/bom)
- [Processes and manufacturing reports](/studio/manufacturing)
- [Load shop rows](/studio/rows#loading-rows-in-the-studio)
- [Save the editable model](/studio/files#the-bcad-document)
