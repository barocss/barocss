# Troubleshoot CAD modeling without losing an accepted part

This is the **user-facing** recovery guide for the local CAD Editor's `#/model` route. It describes the current *bounded* modeling workbench, not every other Surface/Curve/Boolean feature workspace.

## First: which state do you have?

| Screen or symptom | Meaning | Safe next action |
| --- | --- | --- |
| **Accepted model** | Native and display admission completed for the last successful part | Continue editing or **Download model** |
| **Dimension changes pending** | A field contains draft text; accepted geometry has not changed | **Apply dimensions** to try the edit; **Discard draft** to abandon it |
| **Computing native geometry in a dedicated worker…** | A candidate is pending, not yet accepted | Let it finish, or use **Cancel computation** |
| Error after **Apply dimensions** | Invalid parameter, unsupported geometry, failed native qualification or display admission | Read the reported error; keep the previously accepted part and correct or discard the draft |
| **Undo** or **Redo** disabled | History unavailable or draft fields need resolving | Apply/discard pending dimensions, then inspect history availability |
| **Load example** unavailable | Replacing an accepted model needs confirmation | Save important work, check **Replace accepted model and discard its history and pending dimensions**, then load |
| Model looks wrong after reopen | The editor may be displaying another saved output | Under **Visible output body**, select the named result you intended to inspect |

**Critical distinction:** text entry, file selection, candidate preparation, GPU preview and an accepted authored model are different stages. A visual change or button click is not proof of accepted geometry or durable storage.

## My part disappeared after opening a file

First expand **Visible output body** and inspect **Choose one output to inspect**. Saved files can have multiple named outputs, and generic Open chooses the last validated saved output, not necessarily the result you were viewing.

For the accepted underside-pocket example, saved outputs include `part`, `plate`, and `tool`; generic Open can show `tool`. Choose `part` to inspect the pocket. Changing only the visible output does not erase authored geometry or change Undo/Redo history.

See [your first model](./first-model) for a repeatable example.

## I selected a file, but nothing opened

Under **Save or open a model**, **Choose model file** loads a file's UTF-8 text into **Saved model data**. This is a *staging step*, not CAD parser acceptance or a replacement of the currently accepted model. Review the text, check **Replace accepted model and discard its history and pending dimensions**, and select **Open saved model**.

The reader refuses file data larger than **262,144 bytes**, empty/whitespace-only content and malformed UTF-8. A successfully decoded text file can still fail native parser or geometry admission when you explicitly open it. A failed read retains previously staged text and previously accepted geometry. Choosing a newer file or editing the text supersedes an older asynchronous file read; stale read completion cannot authorize replacement.

**Download model** initiates a browser download, but does not certify that a file was written successfully. Confirm the actual downloaded file before relying on it for recovery.

## Invalid geometry: why won't it just approximate?

The authoring engine deliberately refuses operations that cannot be represented or qualified by their supported native family. Examples from source-backed fixture evidence include:

- An underside-pocket with a non-positive cutter depth, or a cutter that violates its required coverage/bounded representation.
- An L-bracket union where the two pieces meet only along an edge, or remain disconnected despite the single-body result requirement.
- A circular post whose diameter makes the radius zero or otherwise violates exact stored-rational geometry admission.
- A mounting-plate hole that touches a plate boundary or has dimensions that fail exact stored-coefficient qualification.

These are examples of **specific** workflows. They do not mean that every arbitrary Boolean, circular sketch, fillet, assembly or CAD exchange operation exists in this editor. Do not silently heal/round geometry, change operation semantics or substitute a preview mesh for native acceptance.

For source-qualified shapes and useful refusals, see [CAD modeling reference](../cad/modeling) and [capabilities](../cad/capabilities).

## Why is volume unavailable when a shape appears on screen?

A native `convex-planar` or admitted `orthogonal-cell` family may expose a qualified volume. The `stored-rational-circle-prism` and `stored-rational-plate-hole` examples instead show **Certified volume unavailable**. This is **not zero**, not an empty part, and not permission to use an ideal-cylinder volume as certified mass.

The displayed mesh has sampled vertices and triangles. Its approximate picks, displayed normals, camera pose and pixels are *derived presentation*, not automatically exact B-Rep topology or measurement authority.

## File or display failure: preserve evidence

When reporting a reproducible problem, record the exact example name, starting accepted dimensions, attempted edit, error text/code and whether you had pending drafts. If safe to share, provide the **authored** saved file (not only a screenshot). Identify the source commit and whether the result came from a TypeScript/native fixture, mocked Worker, local browser, or real GPU/file dialog.

Avoid putting private paths, user files or unredacted secrets into public GitHub issues. Save a recoverable accepted copy before destructive replacement.

## Validation boundary

This guide is checked against the current repository's UI labels/file-reader contract and the existing CAD modeling guide. **UNRUN here:** live browser interaction, physical file picker, GPU pixels, complete VitePress build, or device-specific behavior. Do not mistake a static documentation check for a successful browser/device test.

[CAD Editor overview](./) · [First hands-on model](./first-model) · [Developer session quickstart](./quickstart)
