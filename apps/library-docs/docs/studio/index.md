# Studio

Studio is the visual app for building parts, placing them in assemblies, preparing drawings and making images.
It edits the CAD Model document and shows the result in the viewport. Start with a task below, then use the
linked pages for the individual controls.

If you have not opened the app, follow [Getting started](/guide/getting-started). The
[studio tour](/studio/tour) explains the workspace, selection, commands and keys.

![The Studio layout from the tour: viewport in the centre, chat at the left and the document dock at the right](/shots/studio/tour/layout.jpg)

## Choose a task

| Task | Start here | What you produce |
| --- | --- | --- |
| Build or change one part | [Modeling](/studio/modeling) | Sketches, solid features and editable dimensions |
| Place parts and control their movement | [Assemblies and robots](/studio/assembly-workflows) | Instances, placements, mates and supported motion settings |
| Describe a part for production | [Drawings and manufacturing](/studio/drawing-workflows) | Drawing views, dimensions, BOMs and process reports |
| Inspect the model or make an image | [Display and rendering](/studio/display-workflows) | Section views, analysis displays and rendered images |
| Save, exchange or revise work | [Files and projects](/studio/file-workflows) | Editable documents, exchange files and project versions |

The left menu follows these tasks. Each group has an overview and links to its detailed pages. You can open a
group without leaving the current page.

## Follow one design

For a part that will go into an assembly, use this sequence:

1. Make its geometry. Create a sketch or start with a solid primitive, then add the required features.
2. Give important dimensions parameter names. Check the part after changing a parameter or configuration.
3. Save the editable part. Insert it as an instance when another document needs it.
4. Position the instances and add the supported mates. Check the remaining movement before making a motion path.
5. Prepare views and dimensions in the drawing workspace. Read the BOM or process report for the current design.
6. Export the required exchange files. Keep the editable document and its versions separately.

For a single part, you can go directly from modeling to drawing, inspection or export. You do not need to make
an assembly first.

## Check an edit before the next task

A command can show a preview before it changes the document. Apply the command to keep the edit, or cancel it
to keep the previous document. A refusal gives a reason; it is not a successful edit.

The shape can update before its mass properties arrive. The inspector shows `…` while those values are pending.
Wait for the values you need. Do not read a pending value as zero. See the [layout and inspector](/studio/tour#the-layout).

For information tied to an earlier design, read the source or status shown with that information. A saved image,
export or historical calculation does not become a new result when you change the model. The detailed task pages
explain the relevant update and file rules.

## Use Studio with the APIs

Choose the entry point that matches your work:

- [CAD](/packages/cad/) explains the geometry kernel and its modeling operations.
- [CAD Model](/packages/cad-model/) explains the editable document, evaluation and higher-level data.
- [GPU](/packages/gpu/) explains the rendering SDK and its scene inputs.
- [Object API](/packages/api) shows the code facades over these packages.
- [Viewer](/packages/viewer/) explains the separate review SDK.

These pages describe different interfaces. A code option is not automatically a Studio control. A review file is
not automatically an editable Studio document. Use the task pages to find the controls and files that Studio supports.

## Know the result's limits

An image shows the displayed result. It does not establish geometric accuracy or manufacturing suitability.
A process report uses the materials, rows and rules supplied to it. Check its issues and sources before using its
numbers. [Limits](/reference/limits) gathers the supported scope, and
[How it is verified](/reference/verification) explains the available checks.
