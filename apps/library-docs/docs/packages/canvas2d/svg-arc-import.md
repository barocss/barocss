# Import an SVG arc and edit its cubic controls

[Open SVG arc import](/examples/library#svg-arc-import) to import a bounded SVG, inspect its generated cubic commands and edit one control point. The [playground link](/playground#svg-arc-import) opens the same API example.

![Edited native cubic path on the left and unchanged original SVG reference on the right](/examples/svg-arc-import.jpg)

The actual image shows the first +12 edit: the left Canvas2D path has `c1x:141.39134040641824`, while the right image retains the original SVG. The views describe different inputs. This comparison establishes neither initial pixel equality nor pixel parity.

This guide uses experimental `@barocss/canvas2d` version `0.0.0-experimental` at fixed source profile `94a2a776254a73b496431ab6cbb49ea07900bef7`. The public operation is `importSVGArcElement`. Use the matching TypeScript-capable browser consumer. Source availability is separate from the browser results described for this example and from package publication. The older [SVG export](./svg-export) and [radial SVG export](./radial-svg-export) examples retain their own providers and direction of conversion.

The native Canvas2D preview requires WebGL2. The original SVG reference uses the browser image decoder.

## Complete initial SVG

```xml
<svg xmlns="http://www.w3.org/2000/svg" id="ArcImportExample"
     width="320" height="200" viewBox="0 0 320 200">
  <path id="Background" fill="#101820"
        d="M 0 0 L 320 0 L 320 200 L 0 200 Z"/>
  <g id="ArcGroup" transform="translate(24 18) rotate(5)">
    <path id="ArcPath" fill="#2266cc" fill-rule="nonzero"
          stroke="#eef2ff" stroke-width="3"
          stroke-linejoin="bevel" stroke-linecap="butt"
          d="M 20 100 L 140 100 A 20 40 90 0 1 100 80 L 20 80 Z"/>
  </g>
</svg>
```

The viewport is 320×200 logical pixels. `Background` is a separate solid path. `ArcGroup` translates by `(24,18)` and rotates by 5°. `ArcPath` has blue nonzero fill and a 3-pixel pale bevel/butt stroke. Its arc starts at `(140,100)` and ends at `(100,80)`, with radii 20 and 40, rotation 90° and flags `0,1`.

## Import, edit, save and reopen

1. Select **SVG arc import** to load the complete SVG above. The native canvas displays the normalized path; the reference image displays the original SVG.
2. Select **Move first cubic control +12 px**. The host changes the first C command's `c1x` by 12 in local coordinates. The editor then contains complete Scene29 JSON. Original import provenance remains available for comparison only.
3. Select **Save editable JSON** to download `svg-arc-import.scene.json` from the accepted scene.
4. Select **Reset example**, then open that saved JSON through the File chooser once. Fresh Open constructs a new native session. It has no original SVG image or import provenance.
5. Select **Move first cubic control +12 px** again to edit the restored cubic through its new handles.

After the first C edit, the original SVG reference stays unchanged. The two views intentionally describe different inputs. A submitted Scene29 JSON update or a fresh JSON Open drops the original SVG, Scene5 and importer diagnostics. The active editor format is shown by the host; do not parse reopened JSON as SVG.

## Read an endpoint arc

The uppercase SVG command is:

```text
A rx ry rotation largeArcFlag sweepFlag x y
```

The preceding open path command supplies the starting point. `rx` and `ry` are ellipse radii in local SVG coordinates. `rotation` is the ellipse-axis rotation in degrees. The two flags must be spelled exactly `0` or `1`. `largeArcFlag` chooses the large or small sweep; `sweepFlag` chooses its direction in the SVG coordinate system. `x,y` is the endpoint. This importer accepts explicit uppercase `M`, `L`, `Q`, `C`, `A` and `Z`; it is not a general SVG path parser.

The importer can enlarge positive radii when the endpoints cannot fit the stated ellipse. A zero radius converts the arc to a line. Coincident endpoints add no arc command. Negative radii, positive radii below .001, rotation magnitude above 360° and unrepresentable derived coordinates refuse. The flags are lexical: `1.0` is not the accepted flag spelling `1`.

A nondegenerate arc becomes one or more cubic `C` commands. Each segment spans at most 45°, with at most eight segments per arc. The generated controls approximate the ellipse. They are not exact conic coefficients, a rational CAD Curve or a universal error certificate. The final cubic endpoint uses the authored endpoint; internal controls are derived Number values.

## Keep the viewport, groups and paint

The public importer returns a validated Scene5 and diagnostics. It creates a transparent clipping Frame sized to SVG `width` and `height`, with a child group that applies `viewBox` translation and scaling. It keeps nested source groups, local transforms, path IDs, child order and path paint. Coordinates remain logical pixels; rotation fields in the native transform are radians.

The application constructs a separate editable tree with public constructors. It does not rename Scene5 to Scene29 or flatten away the clipping Frame. This distinction matters because `createDisplayTreeFromScene` cannot directly reconstruct Scene5.

The following complete bridge uses only public constructors:

```ts
import {
  Canvas2DError, createCanvas2D, createDisplayTree, importSVGArcElement,
  parseSceneJSON, stringifySceneJSON,
} from '@barocss/canvas2d';
import type { SceneV5, StageHandle, ContainerHandle, FrameHandle } from '@barocss/canvas2d';

export const svgText = String.raw`<svg xmlns="http://www.w3.org/2000/svg" id="ArcImportExample"
     width="320" height="200" viewBox="0 0 320 200">
  <path id="Background" fill="#101820"
        d="M 0 0 L 320 0 L 320 200 L 0 200 Z"/>
  <g id="ArcGroup" transform="translate(24 18) rotate(5)">
    <path id="ArcPath" fill="#2266cc" fill-rule="nonzero"
          stroke="#eef2ff" stroke-width="3"
          stroke-linejoin="bevel" stroke-linecap="butt"
          d="M 20 100 L 140 100 A 20 40 90 0 1 100 80 L 20 80 Z"/>
  </g>
</svg>`;

export function importEditableSVG(svgText: string) {
  if (new TextEncoder().encode(svgText).byteLength > 1024 * 1024) {
    throw new Canvas2DError('SCENE_LIMIT', 'This application limits SVG text to 1MiB');
  }
  const xml = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (xml.querySelector('parsererror') || xml.doctype) {
    throw new Canvas2DError('INVALID_SCENE', 'SVG must be well-formed without a doctype');
  }
  const imported = importSVGArcElement(xml.documentElement);
  const source = parseSceneJSON(stringifySceneJSON(imported.scene));
  if (source.version !== 5) {
    throw new Canvas2DError('INVALID_SCENE', 'The SVG bridge requires the imported Scene5');
  }
  const tree = createDisplayTree(source.contextId);
  type Parent = StageHandle | ContainerHandle | FrameHandle;
  function attach(parent: Parent, nodes: SceneV5['nodes']) {
    for (const node of nodes) {
      if (node.kind === 'group') {
        const handle = tree.createContainer({
          id: node.id, layer: node.layer, transform: structuredClone(node.transform),
          visible: true, alpha: 1, hitMode: 'auto',
        });
        parent.addChild(handle); attach(handle, node.children);
      } else if (node.kind === 'frame') {
        const handle = tree.createFrame({
          id: node.id, layer: node.layer, transform: structuredClone(node.transform),
          visible: true, alpha: 1, hitMode: 'auto',
          width: node.width, height: node.height,
          fill: structuredClone(node.fill), clip: node.clip,
        });
        parent.addChild(handle); attach(handle, node.children);
      } else if (node.kind === 'path') {
        parent.addChild(tree.createPath({
          id: node.id, layer: node.layer, transform: structuredClone(node.transform),
          visible: true, alpha: 1, hitMode: 'auto',
          commands: structuredClone(node.commands),
          ...(node.fill ? { fill: structuredClone(node.fill) } : {}),
          ...(node.stroke ? { stroke: structuredClone(node.stroke) } : {}),
        }));
      } else {
        throw new Canvas2DError('UNSUPPORTED_FEATURE', 'This SVG bridge requires Frame, group and Path');
      }
    }
  }
  attach(tree.stage, source.nodes);
  return { imported, tree, editableScene: tree.snapshot() };
}

export function prepareImportedSVG(freshCanvas: HTMLCanvasElement, svgText: string) {
  const candidate = importEditableSVG(svgText);
  const renderer = createCanvas2D(freshCanvas, {
    logicalSize: candidate.imported.diagnostics.viewport, dpr: 2,
  });
  try {
    renderer.updateScene(candidate.editableScene);
    renderer.render();
    return { ...candidate, renderer };
  } catch (error) {
    renderer.dispose();
    throw error;
  }
}

const freshCanvas = document.createElement('canvas');
export const preview = prepareImportedSVG(freshCanvas, svgText);
document.body.append(freshCanvas);
// The owner calls preview.renderer.dispose() before removing its canvas.
```

The bridge explicitly supplies current `visible:true`, `alpha:1` and `hitMode:auto` defaults for imported Frame, group and Path nodes. Public Path construction supplies the current stroke defaults where the older imported paint omits them. The tree snapshot is a derived Scene29 with new editable handles. Keep `imported.scene`, diagnostics and original SVG text separately if your application needs import provenance. The snapshot does not replace that original data. `prepareImportedSVG` renders into a caller-owned fresh canvas; adopt that canvas only after it returns. The returned owner must call `renderer.dispose()` on teardown.

## Edit one C control without losing paint

A generated `C` has two controls, `c1x,c1y` and `c2x,c2y`, plus endpoint `x,y`. Editing a cubic control sculpts the normalized path. It no longer means “change the original ellipse radius.”

To move the first cubic's first control 12 logical pixels along its local X axis, copy the accepted tree and pass the full paint back:

```ts
import { Canvas2DError, createDisplayTreeFromScene } from '@barocss/canvas2d';
import type { SceneV29 } from '@barocss/canvas2d';

export function moveFirstCControl(accepted: SceneV29, pathId: string) {
  const candidate = createDisplayTreeFromScene(accepted);
  const path = candidate.get(pathId);
  if (!path || path.kind !== 'path') {
    throw new Canvas2DError('INVALID_SCENE', 'The selected Path is missing');
  }
  const paint = path.data;
  const commands = structuredClone(paint.commands);
  const firstC = commands.find(command => command.kind === 'C');
  if (!firstC || firstC.kind !== 'C') {
    throw new Canvas2DError('INVALID_SCENE', 'The selected Path has no cubic command');
  }
  firstC.c1x += 12;
  path.setPath({
    commands,
    ...(paint.fill ? { fill: structuredClone(paint.fill) } : {}),
    ...(paint.stroke ? { stroke: structuredClone(paint.stroke) } : {}),
  });
  return { tree: candidate, scene: candidate.snapshot() };
}
```

`setPath` replaces path paint. Supplying only commands can remove the existing fill and stroke. The copied candidate retains the Frame clip, transformed parent groups, IDs, layers, other commands and unrelated paths. Parent transforms and viewBox scaling can make a 12-pixel local edit move by a different amount on the screen.

Render the candidate in a new off-screen session before replacing the accepted canvas. A `setPath` or renderer refusal must not commit the candidate tree. A numeric edit is not evidence of a successful visible frame by itself.

### Numeric result for this input

Public import and the explicit constructor bridge produced five nodes, two Paths and two C commands. In `ArcPath`, the first C is command index 2. Its `c1x` is `129.39134040641824`. One +12 edit changes it to `141.39134040641824`; after saving and reopening the normalized document, a second +12 edit changes it to `153.39134040641824`.

The selected CPU flow retained the complete Scene, paint, Frame and parent hierarchy except that selected field. Its document is version 1 with zero assets. Invalid flag `2` and negative radius both produced `INVALID_SCENE` while accepted data remained intact. These results used a browser-like DOM for CPU admission and public document parsing; they do not establish a native browser frame, image comparison or renderer cleanup.

### Recorded browser outcome

The development-browser flow imported this SVG, made the first +12 edit and saved one physical 2118-byte editable JSON file. After Reset, one FileChooser delivery and one public document-staging call reopened that file. A fresh edit reached `c1x:153.39134040641824`; original SVG, Scene5 and importer diagnostics were null. Running the reopened JSON also retained its edited scene.

A bad SVG flag and JSON `c1x:null` both produced `INVALID_SCENE` and retained the complete displayed accepted report. Its captured-frame checksum remained part of that report; raw pixel-array equality was not measured.

The terminal application-call snapshot recorded six completed renderer sessions and six disposal calls, twelve matching listener attachment/removal calls, three reference-image URL creation/revocation pairs and zero pending candidates. A later mount exposed that prior snapshot. These counters describe application calls; they do not measure native WebGL object deletion or certify another session's cleanup. The physical saved file was verified even though the download-event observation timed out; no second Save or Open was used.

## Save normalized curves and open a fresh session

Use `serializeCanvasDocument` on the accepted Scene29. This sample's paths refer to no bitmap assets, so the asset lookup returns null. Copy the accepted scene before an asynchronous Save, then confirm the same session is still current before returning its file.

```ts
import { createDisplayTreeFromScene } from '@barocss/canvas2d';
import { parseCanvasDocument, serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';
import type { SceneV29 } from '@barocss/canvas2d';

export async function saveNormalizedArc(accepted: SceneV29) {
  const scene = structuredClone(accepted);
  return serializeCanvasDocument(scene, () => null);
}

export async function openNormalizedArc(text: string, freshCanvas: HTMLCanvasElement) {
  const parsed = await parseCanvasDocument(text);
  if (parsed.scene.version !== 29 || parsed.assets.size !== 0) {
    throw new Error('This arc example requires a zero-asset Scene29 document');
  }
  const viewport = parsed.scene.nodes[0];
  if (parsed.scene.nodes.length !== 1 || viewport.kind !== 'frame'
      || viewport.width !== 320 || viewport.height !== 200 || !viewport.clip) {
    throw new Error('Retain the 320×200 clipping Frame');
  }
  function checkVectorNodes(nodes: SceneV29['nodes']) {
    for (const node of nodes) {
      if (node.kind === 'frame' || node.kind === 'group') checkVectorNodes(node.children);
      else if (node.kind !== 'path') throw new Error('This example admits vector Frame, group and Path nodes');
    }
  }
  checkVectorNodes(parsed.scene.nodes);
  const tree = createDisplayTreeFromScene(parsed.scene);
  const arc = tree.get('ArcPath');
  if (!arc || arc.kind !== 'path' || !arc.data.commands.some(command => command.kind === 'C')) {
    throw new Error('ArcPath must retain a cubic command');
  }
  const staged = await stageCanvasDocument(text, freshCanvas, {
    logicalSize: { width: 320, height: 200 }, dpr: 2,
  });
  return { ...staged, tree };
}
```

Open must use a fresh canvas, renderer and tree. Apply the host's declared view again if it differs from the default. Promote only after rendering and validating the candidate; dispose a stale or failed session. The returned owner must dispose the staged renderer when finished.

The JSON preserves the accepted normalized C commands, full paint and native Frame/group hierarchy. It does not save the original SVG text, Scene5, importer diagnostics or `A` radii/rotation/flags. On Open, those import-provenance fields are unavailable. Re-edit the restored C commands through the new handles. Do not run a stale SVG draft to reconstruct an earlier path over the reopened edits.

The original SVG comparison image belongs to its original import session. A restored document can render its current native Scene29; it cannot recover the original SVG reference merely from those saved cubic coefficients. A Canvas document is not an SVG import/export round trip.

## Candidate adoption and cleanup

The application must finish parsing, public admission, bridge construction, candidate rendering and any original SVG image decode before adoption. Keep the accepted tree, renderer, canvas, report and reference image until that process succeeds. Check a generation token after each asynchronous boundary. Reset, sample changes and disposal invalidate pending candidates.

Create the original SVG image Blob URL only after its source passes admission. Retain it while its reference image is in use; clear the image source and revoke that exact URL when the candidate is rejected, superseded or disposed. Remove exact native context-loss/restoration listeners from every retired canvas. A stale decode or File read must not restore disposed DOM or replace a newer accepted session.

Save owns a separate snapshot and download Blob URL. Revoke the download URL after delivery. The File input must clear its value after capturing the chosen File so the same filename can be selected again later. Count one FileChooser delivery and one actual Open for the selected physical flow; a duplicate upload is a separate observation, not a successful single delivery.

A view of the original SVG next to the Canvas2D rendering is a comparison, not a pixel-parity or general SVG-accuracy proof. Public frame capture and a screenshot also have different roles. Exact byte retention requires actual before/after pixel-array comparison; equal screenshots or checksums alone do not establish it.

## Limits and genuine refusals

| Input boundary | Supported scope |
| --- | --- |
| Root | SVG namespace, integer width/height 1..8192, required positive viewBox; no DOCTYPE |
| Aspect ratio | `xMidYMid meet` or `none` |
| Elements | SVG root, groups and paths; no foreign namespace, text content or unsupported children |
| Transforms | `translate`, `rotate`, `scale` in that order when present; each kind at most once |
| Paint | Hex `#RRGGBB` or `none`; nonzero/evenodd fill; separate fill/stroke opacity; object opacity must be 1 |
| Stroke | Positive width up to 1000; bevel join; optional butt cap |
| Application SVG text | At most 1MiB UTF-8 before DOM parsing; separate from public DOM admission |
| DOM work | 1024 visited nodes, depth 16, 255 elements, 32 paths, 16 attributes per element |
| Attribute data | 1MiB combined UTF-8 names/values; each attribute string at most 1,048,576 UTF-16 units |
| Path work | 256 explicit commands, 2048 tokens and 256 normalized commands per path |
| Numeric input/output | Finite magnitude at most 1e6; source numeric −0 refuses |

`UNSUPPORTED_FEATURE` reports unsupported elements, attributes, path syntax or transform/paint features. `INVALID_SCENE` reports invalid admitted values, flags, IDs or unrepresentable arc calculations. `SCENE_LIMIT` reports the bounded DOM, attribute or command capacity. Malformed XML is an application parse failure before public import.

A flag `2` or a positive radius `.0001` is a meaningful refused SVG candidate. Test it against the complete accepted input, then retain the accepted tree and visible frame. A zero radius is a valid line fallback and must not be labelled a refusal. This importer does not add gradients, general CSS, relative commands, animation, arbitrary resources or editable ellipse handles.

[Canvas2D guides](./guides) · [Path control editing](./path-editing) · [SVG display export](./svg-export)
