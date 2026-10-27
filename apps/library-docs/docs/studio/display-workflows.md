# Inspect a model and make an image

## Goal

Inspect the model with display modes, sections and previews.
Choose a live raster image or a frozen path-traced still when you need a picture.
Keep the editable model and any report separately from that picture.

## Before you start

- Have a part or assembly open in the viewport.
- Decide whether you need an inspection view, an analysis preview or an image file.
- Use WebGPU for Render, analysis maps and path tracing.
- Keep a saved model copy if the result must remain editable.

On WebGL2, unavailable maps are disabled with a reason.
The Render panel explains that rendering needs WebGPU.

## Inspect the live model

1. Open Display and choose CAD display mode.
   Use shaded surfaces, visible edges, hidden lines, wireframe or X-ray as needed.
2. In an assembly, use Isolate selection to fade the other parts.
   Use Restore view to bring them back.
3. Turn on Section view to inspect the inside.
   Choose the section mode, then adjust a plane offset or its handle.
   The section changes the view; it does not cut the model geometry.
4. Use Preview & analysis for one preview at a time.
   Select CNC, Print, Clearance or Analysis for the task.
   Read a map's legend and any unavailable-feature message.
5. Return the preview switch to None when you no longer need it.

![Existing Display example: a section plane reveals a box and its hole](/shots/studio/display/section.jpg)

This image is reused from the Display guide.
It shows a section view, not a new analysis result.

## Choose the image workflow

1. Open Render and set the appearance, lights, background and camera.
   These settings change the picture, not the model geometry.
2. For the current live view, select Raster as Render method.
   Pause playback and choose the view, then use Export image to download a PNG.
   Export image does not pause the timeline for you.
3. For a frozen still, select Path tracing and then Start.
   Wait for at least one sample before using Export image.
   Stop ends sampling; Denoise still controls noise reduction for preview and export.
4. After camera or scene edits, stop sampling and select Start again.
   The new session uses those edits; the previous still does not update with them.

## Check the results

- Confirm which display mode, section and preview are active.
- Check that a map is available on the current renderer.
- Confirm Render method before downloading an image.
- With Raster, inspect the live view that you chose.
- With Path tracing, inspect the sample count and the frozen still.
- Keep the model revision and animation time separately if you need that context.

The frozen still includes surfaces, materials, tone mapping and colour grading.
Bloom, depth of field, outlines, overlays and shadow catchers stay in the live view.
Do not expect the frozen still to reproduce those live effects.

## Keep these limits in view

A section view is not a manufacturing cut in the saved geometry.
A CNC preview is a display estimate marked NOT FOR PRODUCTION.
It has no G-code, feeds, speeds or collision check.
An image does not keep feature history or establish manufacturing or physical validation.
Focus and blur are display effects, not physical camera calibration.
The PNG has no document revision or animation time written by this export path.

## Continue with the detailed guides

- [Display modes and sections](/studio/display)
- [Preview and analysis choices](/studio/display#preview-analysis)
- [Live rendering and raster export](/studio/rendering#exporting-an-image)
- [Frozen path-traced stills](/studio/rendering#path-tracing)
- [Focus and blur](/studio/rendering#focus-and-blur)
- [Manufacturing preview limits](/studio/manufacturing#previews-in-the-viewport)
- [Save and export model files](/studio/files)
