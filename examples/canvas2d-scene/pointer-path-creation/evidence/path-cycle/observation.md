# Status: PASS — bounded Alt-click path selection

#1557 lets a user select a covered authored path with Alt-click. It uses the existing public `hitTestAll(point,16)` result. The source adds one selection helper, one Alt branch in the existing canvas body handler, and one facade entry. The ordinary control, creation, and capture branches remain unchanged. The UI adds one instruction sentence. No listener, Scene operation, history entry, or renderer is added for selection.

The real Chrome155 flow opened the prior #1547 API snapshot once with separate physical chooser and upload commands. A normal canvas click selected top Q3. A trusted Alt-click at the same point selected covered Q1. A second Alt-click wrapped to Q3. The native event rows retain the actual modifier, target, button, primary flag, client coordinates, and canvas rectangle. The public top-first path stack remained Q3,Q1; top hit stayed Q3 while Q1 was selected. Three public-point/manual-pose/native-handle proofs matched within 1 CSS pixel.

All 2457600 frame bytes, the whole Scene, history, view, generation, asset bytes, accepted canvas/tree/renderer identities, and native draw/resource/callback/observer/capture rows stayed exact. Only the existing canvasSelections count reached3. Verification readPixels calls are excluded from draw-row invariance. There were zero Scene commits.

After Root viewed the actual screenshot, the flow selected C2/c2 and typed an unapplied coordinate draft. Alt-click on the only eligible C path preserved the complete Observe state, c2 slot, raw draft, native rows, frame, asset, and identities. Alt-click on protected Marker also preserved all state. The receipts contain actual before/after rows for both guards. Outside and pending guards are source-reviewed and runtime UNRUN.

The API document snapshot is3446B and byte-exact to the input. It is API serialization only. The flow has no UI Save, download, new genuine file, or second Open. It did not run the previous duplicate, paint, order, geometry, origin, or camera producers.

Before page closure, all2 actual GL contexts had exact native populations of4 shaders,2 programs,3 buffers,2 VAOs,1 texture,0 FBOs each. Every tracked resource was deleted and native live counts were0; GL error was0 and contexts were not lost. All30 PRODUCT callback identities, host26 plus core4, were removed once. The observer disconnected once with no targets. File.text and file input each occurred once; hashes settled. URL/download and capture counts were0. The retained CPU asset was cyan before Dispose. Late trusted input, disposed cycle with DISPOSED/Editor disposed, repeat Dispose, and disabled controls were verified.

External Window audit listeners remain separate until page closure. The receipt does not claim that all global DOM listeners were released by Dispose. Native image, decoder, and font resources are uninstrumented. Tracked2D and ImageBitmap populations were0. Element capture/release APIs were tracked and remained0.

Root source/build/types review, actual screenshot review, and complete terminal review passed. Review references are `/tmp/c2d1557-root-source-review.json`, `/tmp/c2d1557-root-screenshot-review.json`, and `/tmp/c2d1557-root-terminal-review.json`. Raw phase logs and JSON are in `/tmp/c2d-path-cycle-runtime`. No first runtime failure occurred. The preparation and screenshot-stop records in browser-observations are historical; current status is PASS.

Only sessionc2d-path-cycle was closed, with exit0. The exact own Python server PID98724 and source directory were checked before SIGTERM. The server returned intentional exit143. Port31457 has no listener. Other lane sessions and servers were preserved.

All1095 unowned fixed files,7 genuine native files, and10 API seeds kept their SHA256, byte lengths, and protected mtimes. Source, driver, and config hashes stayed frozen. Global1254/674, mixed operation acceptance, integration, and Release are outside this proof. NO_FURTHER_WRITER.
