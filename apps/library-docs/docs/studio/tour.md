# Tour of the studio

## The layout

- **The top bar** holds the mode, the document's commands and the tools that open panels:
  - **Model**, **Render** and **Drawing** switch the workspace. Model is where you build. Render sets the look and
    camera for images without changing the model. Drawing is the sheet workspace.
  - **Chat** opens the agent's panel, and **Undo** and **Redo** step through the history.
  - **New part**, **Templates**, **Open**, **Save** and **Insert part** (another `.bcad` placed as an instance).
  - **Library** (catalogue parts and shop rows), **Parameters** (named sizes and saved configurations) and **BOM**.
  - **Export STL**, **Export 3MF**, **Export STEP** and **Export IGES**.
- **The outliner** lists the bodies, the placed parts and their features. Its summary line counts them, for example
  `1 body`.
- **The history** lists the features in the order they were made. Click one to edit it.
- **The properties panel** shows what is picked, such as `SELECTION · FACE`, with its measurements and the actions
  that apply to it.
- **The heads-up display (HUD)** appears while a command runs. It shows the command's fields and a status: `preview`
  while the result is shown, or `refused` with the reason.
- **The viewport** carries the view buttons (**Top** and the others), the view cube, and **Display**, the popover for
  display modes, sections and previews.
- **The shapes strip** offers the shapes and features as buttons; **More shapes** opens the rest.

## Commands and keys

Press <kbd>Space</kbd> to find any command by name, or <kbd>?</kbd> to see every key. A command's key starts it:

| Key | Command | Key | Command |
|---|---|---|---|
| <kbd>S</kbd> | Sketch | <kbd>E</kbd> | Extrude |
| <kbd>B</kbd> | Box | <kbd>Y</kbd> | Cylinder |
| <kbd>H</kbd> | Hole | <kbd>C</kbd> | Chamfer |
| <kbd>Shift</kbd> <kbd>F</kbd> | Fillet | <kbd>P</kbd> | Linear pattern |
| <kbd>M</kbd> | Mirror | <kbd>A</kbd> | Align |
| <kbd>G</kbd> | Move | <kbd>R</kbd> | Rotate |
| <kbd>U</kbd> / <kbd>D</kbd> / <kbd>I</kbd> | Union / difference / intersection | <kbd>Shift</kbd> <kbd>M</kbd> | Measure |

While a command runs:

- <kbd>Enter</kbd> applies it.
- <kbd>Shift</kbd> <kbd>Enter</kbd> applies it and starts the same command again, for another hole or another shape.
- <kbd>Esc</kbd> cancels. With no command running, it clears the selection.

The general keys:

| Key | What it does |
|---|---|
| <kbd>⌘</kbd> <kbd>Z</kbd> / <kbd>⇧</kbd> <kbd>⌘</kbd> <kbd>Z</kbd> | Undo / redo |
| <kbd>⌘</kbd> <kbd>S</kbd> | Save |
| <kbd>⌘</kbd> <kbd>D</kbd> | Duplicate a body |
| <kbd>⌘</kbd> <kbd>C</kbd> / <kbd>⌘</kbd> <kbd>V</kbd> | Copy a body / paste a copy beside it |
| <kbd>Del</kbd> | Delete what is picked |
| Arrow keys | Nudge the picked body 1 mm in X or Y (<kbd>Shift</kbd>: 10 mm) |
| <kbd>PgUp</kbd> / <kbd>PgDn</kbd> | Nudge it in Z |
| <kbd>F</kbd> | Fit the view to what is picked, or to everything |

## Picking and the view

| Mouse | What it does |
|---|---|
| Click | Pick a face or an edge |
| Shift-click | Add to the pick |
| Drag | Window select: left to right picks what is inside, right to left what it touches |
| Double-click a face | Pick the whole body |
| Double-click an edge | Pick its tangent chain |
| Double-click a name | Rename a body |
| Right-click | Show what can be done here |
| Right-drag or Alt-drag | Orbit |
| Middle-drag or Shift-right-drag | Pan |
| Wheel | Zoom |

Moving or rotating a placed part shows a gizmo with handles; drag a handle, or type the value in the HUD.

## WebGPU and WebGL2

The viewport uses WebGPU when the browser has it and WebGL2 otherwise. Add `?renderer=webgl2` to the address to force
WebGL2. Both draw the model, the display modes, sections, overlays and placed parts. Two things draw only with WebGPU:

- the analysis maps (wall thickness, draft and 3-axis access);
- the mould's parting line and halves.

On WebGL2 their buttons are disabled and say so.
