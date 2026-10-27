# Tour of the studio

## The layout

![The studio with the starter plate: the chat folded to its strip at the left, the Tools rail, the viewport with the history and view bar, and the dock at the right with the Browser, the inspector and Preview & analysis](/shots/studio/tour/layout.jpg)

The studio has three columns: the chat at the left, the stage in the centre (the top bar, the viewport and its bars),
and the dock at the right.

- **The chat column** runs the window's full height:
  - the agent's open proposals sit over the conversation, and the message box is at the bottom;
  - drag its right edge to set its width, from 320 to 520 px; the studio remembers the width in this browser;
  - closed, it is a strip of icons; **Open chat** opens it again;
  - while a proposal is open, the column shows it, whether the chat is open or not;
  - the chat opens in the Model workspace, not in Render or Drawing.

  See [Designing with the agent](/agent/).
- **The dock** holds the **Browser**, then the inspector, then **Preview & analysis**, the BOM and the other panels
  you open, one under another in one scrolling column. Nothing floats over another panel.
- **Narrow windows.**
  - When the window narrows past what fits (the chat, the dock and a centre at least 560 px wide), the chat folds to
    its strip once. You can open it again.
  - When there is no room for the dock beside the centre, it becomes a strip at the right edge. **Open the dock** opens
    it as a sheet over the viewport, and **Close the dock** puts it back.
- **The top bar** holds the shapes, the mode, the document's commands and the tools that open panels:
  - **The shapes**: buttons for the shapes you place with the pointer or drag onto the model. **More shapes** (`···`)
    opens the rest.
  - **Model**, **Sketch**, **Render** and **Drawing** switch the workspace:
    - Model is where you build.
    - Sketch starts a sketch, and shows its plane while you draw.
    - Render sets the look and camera for images without changing the model; see [Rendering](/studio/rendering).
    - Drawing is the sheet workspace.
  - **Chat** opens and closes the chat column, and **Undo** and **Redo** step through the history.
  - **New part**, **Templates**, **Open**, **Save** and **Insert part**, which places another `.bcad` as an instance.
  - **Library** (catalogue parts and shop rows), **Parameters** (named sizes and saved configurations) and **BOM**.
  - **Export STL**, **Export 3MF**, **Export STEP** and **Export IGES**.
- **The Tools rail**, at the viewport's left edge, holds the commands by group. While you sketch, it holds the sketch
  tools instead.
- **The Browser**, at the top of the dock:
  - It lists the bodies, the placed parts and their features, the drafts, the reference bodies and the design
    history.
  - Its title counts the bodies, for example `1 body`.
- **The inspector**, under the Browser:
  - It shows what is picked, such as `SELECTION · FACE`, with its measurements and the actions that apply to it.
  - With nothing picked, it shows the part's mass, centre of mass and bounds.
  - After an edit, the shape updates first. The mass, volume and centre of mass follow a moment later and read `…`
    until they arrive, never 0 or the previous values.
  - It also holds the command that is running, and the panels for measuring, joints and mates.
- **The heads-up display (HUD)** shows a running command's fields and a status: `preview` while the result is shown,
  or `refused` with the reason.
- **The history**, along the bottom of the viewport, lists the features in the order they were made. Click one to edit
  it. When the features don't fit in one row, a `+n` chip shows the rest, and **Less** folds them again.
- **The view bar** carries:
  - **Display**, the popover for the display mode and isolating parts;
  - the view buttons: **Iso**, **Top**, **Front**, **Right** and the others;
  - **Ortho**, **AO**, **Analyse** and **Maps**;
  - the selection filter and **Snap**.

  The view cube sits in the viewport's top corner.

## Commands and keys

Press <kbd>Space</kbd> to find any command by name, or <kbd>?</kbd> to see every key.

![The command palette, searching for fillet](/shots/studio/tour/palette.png)

A command's key starts it:

| Key | Command | Key | Command |
|---|---|---|---|
| <kbd>S</kbd> | Sketch | <kbd>E</kbd> | Extrude |
| <kbd>B</kbd> | Box | <kbd>Y</kbd> | Cylinder |
| <kbd>H</kbd> | Hole | <kbd>C</kbd> | Chamfer |
| <kbd>Shift</kbd> <kbd>F</kbd> | Fillet | <kbd>P</kbd> | Linear pattern |
| <kbd>M</kbd> | Mirror | <kbd>A</kbd> | Align |
| <kbd>G</kbd> | Move | <kbd>R</kbd> | Rotate |
| <kbd>U</kbd> / <kbd>D</kbd> / <kbd>I</kbd> | Union / Subtract / Intersect | <kbd>Shift</kbd> <kbd>M</kbd> | Measure |

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
