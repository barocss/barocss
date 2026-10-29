# Viewer review files

`@barocss/viewer` is experimental and unreleased.

`@barocss/viewer` can capture and restore a review of a loaded CAD scene: its camera, visible geometry and selected
geometry. The host app supplies file Save/Open. Opening a review does not load CAD geometry or modify the CAD model.

![Viewer review flow: load the matching CAD scene, save review JSON, validate it and restore the view](/diagrams/viewer-review-flow.svg)

## Capture and apply

| API | Result |
|---|---|
| `viewer.captureReviewState()` | A detached, JSON-safe `ViewerReviewStateV1` snapshot |
| `viewer.applyReviewState(input: unknown)` | Validates and applies the review; returns `void` or throws |

Serialize the captured object with `JSON.stringify`. Later, parse the host's file text and pass the resulting
`unknown` value to `applyReviewState`. Changing a captured snapshot does not change the Viewer. Do not save the
whole `getState()` object as a review file.

The example loads the CAD document before exposing review Save/Open functions. The caller supplies original CAD
document JSON and 1..4 existing body IDs. The declared authored XYZ basis must match the Viewer's right-handed
Y-up millimetre basis; the option is an assertion, not a coordinate conversion.

`createViewer` requires `background`: three finite RGB components, each from 0 to 1.

```ts
import { createViewer } from '@barocss/viewer';
import { parseBaroCadDocument } from '@barocss/cad-interop/document';

async function createReviewHost(
  canvas: HTMLCanvasElement,
  cadDocumentText: string,
  bodyIds: string[],
) {
  const viewer = await createViewer(canvas, {
    mmToSceneUnit: 0.15,
    background: [0.025, 0.04, 0.065],
  });
  try {
    viewer.loadDocument(parseBaroCadDocument(cadDocumentText), {
      native: {
        sourceVersion: 0,
        countU: 8,
        countV: 8,
        unitsPerMillimeter: 1,
        curveDisplay: {
          version: 1,
          chordToleranceMM: 0.02,
          maxSegments: 512,
          maxDepth: 16,
        },
      },
      basis: 'authored-xyz-matches-rhyup',
      bodyIds,
    });
  } catch (error) {
    viewer.dispose();
    throw error;
  }

  return {
    viewer,
    saveReview(): string {
      return JSON.stringify(viewer.captureReviewState(), null, 2);
    },
    openReview(text: string): void {
      const input: unknown = JSON.parse(text);
      viewer.applyReviewState(input);
    },
  };
}
```

The host writes the returned text to a file and supplies file text to `openReview`. It handles JSON parsing,
read/write errors and file-size limits. It also disposes the Viewer when finished. Loading and applying can throw;
show the error and keep the review file for correction rather than treating a failed Open as a new accepted view.

## Pointer and keyboard controls

Call `viewer.attachPointerControls(options)` or `viewer.attachKeyboardControls(options)` on the existing Viewer.
Each accepts an optional plain options object with only `onError?: (error: unknown) => void`.
The methods return a `ViewerPointerControls` or `ViewerKeyboardControls` handle, respectively.
Keep each handle and call its `dispose()` to remove the listeners it installed.
See [Host lifetime](#host-lifetime) for the cleanup order.

| Adapter | Input | Action |
|---|---|---|
| Pointer | Primary-button drag | Orbit the camera |
| Pointer | Shift + primary-button drag | Pan the camera |
| Pointer | Wheel | Zoom |
| Keyboard | Unmodified F | Fit the currently visible displayed geometry |
| Keyboard | Escape | Clear the current Surface or Curve selection |

Keyboard controls listen only on the Viewer canvas. Give the canvas `tabIndex=0` and let the host or user focus it.
The adapter does not set focus. It ignores modified, repeated and composing keys.

Pointer controls capture one primary pointer and use canvas CSS pixels.
The host owns the canvas's `touch-action` CSS and click-to-select behavior.
After a successful drag moves more than 3 CSS pixels from its start, releasing the pointer suppresses the next click.
A click without such a drag still reaches the host's selection handler.
The pointer adapter does not select geometry or change native measurements or display poses.

Unsupported options are refused when attaching a control.
Event-handling failures go to the optional `onError` callback.
A failed keyboard action does not prevent the browser's default action.

## Host lifetime

The host owns the Viewer and any pointer or keyboard control handles it attaches. Before removing the canvas
or replacing its Viewer, stop the host's callbacks, dispose each control handle, then call `viewer.dispose()`.
Disposing the Viewer does not remove the listeners installed by those separate control handles.

Scene replacement, `viewer.clear()` and Viewer disposal release the Geometry owned by the SDK drawing,
including its vertex/index buffers. Camera changes keep ownership bounded to the current drawing.
If you use the GPU Core directly with shared Geometry, each caller still owns that Geometry:
removing one Mesh leaves it available to other Meshes and later reuse; dispose it when that sharing ends.

Both control-handle disposal and `viewer.dispose()` can be called again without repeating their cleanup.
After Viewer disposal, `getState().status` is `disposed`; `captureReviewState()` and `applyReviewState()` refuse
that instance. Create and load a new Viewer before offering review Save/Open again.

A host can keep this cleanup callback with its canvas owner:

```ts
import type { Viewer, ViewerPointerControls, ViewerKeyboardControls } from '@barocss/viewer';

export function reviewCleanup(
  viewer: Viewer,
  pointer: ViewerPointerControls,
  keyboard?: ViewerKeyboardControls,
): () => void {
  return () => {
    pointer.dispose();
    keyboard?.dispose();
    viewer.dispose();
  };
}
```

## What the file binds to

The format is `schema: 'barocss-viewer-review'`, `version: 1`. Its fields are `scene`, `camera`, `visibleGeometry`
and `selectedGeometry`. The scene pins come from the accepted loaded scene:

- document or assembly kind, ID and revision;
- the exact `mmToSceneUnit` scale;
- the loaded body or instance inventory, including original document/asset revision references, in its original order.

Load that same revision and subset before applying the file. A different scene, revision, member order, subset or
scale is refused. Do not reorder or edit `scene.members` to make another scene match. The CAD producer must advance
revisions when CAD data or assembly placements change. Pins identify declared revisions; they do not authenticate
source contents or provide file integrity.

The file contains no geometry, preview packets, CAD source, motion, materials, measurements or simulation layers.
Save those inputs separately when the host needs them. Applying the review restores only camera, visibility and
selection; it does not restore those other values.

## Supported scenes and visibility

Review files support revisioned primitive CAD document and assembly scenes with the existing 1..4 loaded-object
limit. All loaded objects may be hidden: `visibleGeometry` can be empty, with `selectedGeometry: null`.
Otherwise, the selection must name visible geometry. Visibility references must be unique members of the loaded
inventory. Existing material and layer restrictions can also refuse visibility or selection changes.

Empty or disposed Viewers, native-source-only and model-set-only loads, Shell, mixed-depth and qualified Face
scenes are outside this review profile. A review file is not a general serialization of every Viewer mode.

## Refusal and recovery

`applyReviewState` checks the complete candidate before presentation. Unsupported fields, stale pins, invalid
camera data, unknown or duplicate geometry and hidden selections are refused. Invalid input leaves the accepted
state and drawing unchanged. The input must contain plain data; accessors and unsupported object shapes are not
accepted as file fields.

For an admitted candidate, the Viewer draws before committing the new CPU camera, visibility and selection.
If presentation throws, it keeps the accepted CPU state and attempts to redraw the prior state. If recovery also
fails, an `AggregateError` reports both errors. This recovery attempt cannot guarantee pixels after a device
failure. Successful apply does not mutate the caller's object, CAD data or hierarchy.

The repository's `examples/viewer-review` shows host controls for saving JSON and opening a real file. Its 32 KiB
file-read limit belongs to that example host, not to the SDK review schema.
