# Save a model and share its outputs

## Goal

Keep an editable model and prepare the files that another application needs.
Use project versions to keep past document states.
Keep export source records beside the files they describe.

## Before you start

- Decide where to keep the editable `.bcad` document.
- Check the file formats accepted by the receiving application.
- Keep the original exchange file before importing or repairing it.
- Check the units of mesh files before using their dimensions.

A saved model, an exchange export, a source record and a project version serve different purposes.
Do not use one as a substitute for all the others.

## Save or open the model

1. Use Save to keep the model as `.bcad` with its editable history.
   Without a project, Save downloads the file.
   With a project open, Save writes into that project.
2. Use Open to read a supported model or exchange file.
   STEP opens as imported geometry, not the source system's feature history.
   STL and OBJ open as mesh bodies after you choose Mesh units.
3. Review any mesh repair before applying it.
   Save the imported result as `.bcad` to keep edits made in Studio.
   This does not recover the original application's feature history.

## Prepare an exchange export

1. Choose the format for the recipient: STEP, IGES, STL or 3MF.
   Use the format guide to check what each file retains.
2. For STEP with mesh bodies, review the representation dialog.
   Confirm that the recipient can read AP242 tessellated faces when selected.
3. For STL, wait for evaluation and correct evaluation errors first.
   Choose a quality, read the export message and keep the `.source.json` sidecar.
   Use Automatic for mesh bodies; explicit quality is refused for those bodies.
4. Confirm the STL scale in the receiving application.
   Its coordinates follow millimetres, but the STL file stores no unit.
5. After a document change, export again for that document revision.
   Keep each source record beside the exported files it names.

## Keep and compare project versions

1. Open Project & versions and choose a project location.
   Open folder uses a disk folder in supported browsers.
   Keep in this browser uses that browser's storage only.
2. Use Make version to save the document and keep that state.
   Use Compare to inspect changes from a version to the working document.
3. Use Restore to bring a version back as the working document.
   A later Make version adds a new version; it does not delete the earlier ones.

![Existing Projects example: a saved version compared with the working document](/shots/studio/projects/compare.jpg)

This image is reused from the Projects guide.
It illustrates version comparison, not a new check of file compatibility.

## Check the results

- Keep the editable `.bcad` file as well as the exchange output.
- Read export warnings and check the format and scale in the receiving application.
- Keep STL source sidecars beside the STL files.
- Check whether Save downloaded a file or wrote into the open project.
- Use the project version list to find the state that you intended to keep.

## Keep these limits in view

A source record identifies the input revision and its canonical-content SHA-256.
It is not a checksum of the exported file's bytes.
An exchange file does not replace the saved document's history, mates and settings.
Browser recovery is temporary local storage, not a substitute for saving.
If a project file changed elsewhere, Save refuses to overwrite it.
Open it again, or save under another name.
A downloaded file alone does not establish manufacturing approval.

## Continue with the detailed guides

- [Model files and supported imports](/studio/files)
- [STEP mesh representation](/studio/files#choose-how-step-writes-mesh-bodies)
- [STL preparation and quality](/studio/files#choose-an-stl-quality)
- [Source revisions and records](/guide/concepts#revisions-and-sources)
- [Project locations and versions](/studio/projects)
- [Drawing files](/studio/drawings#export)
- [PNG images and frozen stills](/studio/rendering#exporting-an-image)
