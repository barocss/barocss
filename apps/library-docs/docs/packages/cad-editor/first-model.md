# First CAD model: edit an underside pocket

This is the **UI-first** path through the local CAD Editor. You will load an authored sample, change a named dimension, inspect the retained native part, undo an accepted edit, and save/reopen the model. No CAD file schema, graph IDs, source dialect, or programming is required.

If you want to **write** CAD from TypeScript rather than use the editor, start with the [modeling API quickstart](../cad/quickstart) and [complete modeling guide](../cad/modeling). If you want to **embed** the reusable editor component, continue to the [session quickstart](./quickstart).

> **Availability:** This is a source-backed walkthrough of the current local `#/model` UI, **not** a published product or independently verified browser tutorial. Existing provider, mocked-Worker and CPU receipts do not establish that these actions have passed a fresh live browser/GPU/file-download run on your machine. Use the local app and report any mismatch.

## 1. Start the workspace

From a repository checkout with its existing workspace dependencies installed, use Node 22+:

```sh
pnpm --filter @barocss/cad-editor build:library
pnpm --filter @barocss/cad-editor-app dev
```

Open `http://127.0.0.1:52010/#/model` (or the host/port printed by Vite, followed by `#/model`). The host dispatches this route to **Model a part**; it is distinct from the original Surface/Curve editor and Boolean-extrusion workbench. The app's **← Projects** link returns to the project route.

Expected heading: **Model a part**. Wait for the status **Accepted model** before modifying values. **Computing native geometry in a dedicated worker… You can cancel.** means a native/display candidate is still being evaluated; it is not yet an accepted edit.

## 2. Load a pocket sample without losing another model

1. Open **Modeling examples**, then **Choose an example**.
2. Select **Cut an underside pocket**.
3. If a model is already accepted, deliberately check **Replace accepted model and discard its history and pending dimensions**. This is a destructive *workspace replacement*, not a parameter edit.
4. Choose **Load example**, then wait for **Accepted model**.

Changing the example selector alone does **not** load or modify the existing model. Canceling/refusing a replacement should leave the accepted model unchanged. Save important existing work before acknowledging replacement.

The sample starts with a 32 × 24 × 8 mm plate. Its rectangular cutting tool also starts at Z=0 and removes material upward from the **underside**. The baseline `depth` is 4 mm; this is neither a top-opening pocket nor an arbitrary buried cavity.

## 3. Change one named dimension

Under **Named dimensions**, locate `depth`. Change its numeric value from **4** to **8**.

- Before choosing **Apply dimensions**, the input is only a draft; the previous native model remains accepted.
- Choose **Apply dimensions** and wait for acceptance. At 8 mm the recess reaches the top: this is a **through-window**.
- Use **Undo** to recover the 4 mm pocket; **Redo** to restore the 8 mm through-window. Undo/Redo are unavailable while draft fields are pending: choose **Apply dimensions** or **Discard draft** first.

**Expected native results from the existing qualified fixture** (not measurements taken from a newly executed browser flow):

| Accepted `depth` | Native interpretation | Retained `part` volume |
| --- | --- | ---: |
| 4 mm | Underside pocket | 5632 mm³ |
| 8 mm | Through-window | 5120 mm³ |

Check **Output bodies** for the selected `part`. A volume value is native evidence for this bounded integer-cell sample, **not** a calculation from preview pixels or a general geometric accuracy certificate. Source and exact fixture: [CAD modeling guide](../cad/modeling#cut-an-underside-pocket-or-through-window).

## 4. Choose the visible output, not the saved contents

Use **Visible output body** → **Choose one output to inspect**. The sample has three named outputs: `part` (cut result), `plate` (uncut parent), and `tool` (cutter).

Choose **part** to inspect the opening. Choosing **plate** or **tool** changes the display only; it does not delete other outputs, modify history, or remove them from the saved model.

The preset selects `part` initially. However, the authored save has the canonical order `part,plate,tool`; a **generic Open** initially selects the last validated output, `tool`. **If the pocket appears to disappear after reopening, choose `part` again** before assuming the cut was lost.

A viewport click is an approximate display-face selection. It is not proof of certified shape measurements or a persistent topological face ID.

## 5. Save the authored part and reopen it

Open **Save or open a model**.

1. Choose **Download model** to initiate a browser download named `part.cad.json`. Confirm that your browser actually saved the file; starting a download is **not** proof of filesystem persistence and does not by itself prove successful storage. **Show saved model** is also available if you prefer to inspect or copy the accepted authored text.
2. Choose **Choose model file** and pick the saved `part.cad.json` from your computer. This **only stages** its UTF-8 text inside **Saved model data**; it does not parse or accept the file, replace the model, change history, or alter the viewport.
3. Review the staged text, then check **Replace accepted model and discard its history and pending dimensions** and choose **Open saved model**. Only this explicit action asks the model controller to validate, rebuild and accept the authored geometry. If it refuses, the previous accepted model remains.
4. After acceptance, use **Visible output body** to choose `part` again. Find `depth` under **Named dimensions** and make another supported edit to verify the model remains editable.

You can alternatively paste complete saved text directly into **Saved model data**, then confirm **Open saved model**. The model editor's **Choose model file** is distinct from the original Surface/Curve host's **File → Open** action; both have their own authority and document formats.

### File-picker safety boundaries

The staging reader enforces **262,144 UTF-8 bytes maximum**, and checks that decoded text is nonempty and within its 262,144-character input limit. A larger file, invalid UTF-8, empty file, or failed file read shows **Cannot read model file** while keeping the previous staged text and the accepted model. A syntactically readable file is **not** necessarily a valid CAD model: it is parsed and qualified only when you explicitly choose **Open saved model**.

Choosing a new file clears the previous replacement acknowledgment. A newer picker selection or user text edit supersedes an older pending read, so late asynchronous file contents cannot silently overwrite the newly staged input. This is a source-supported design contract, not yet a verified cross-browser file-picker test.

`cad.load()` rebuilds authored operations and native geometry; the file is not a saved mesh, screenshot, GPU cache, or display-camera snapshot.

## 6. Recover from a refused edit

A useful failure drill: after returning to the 4 mm sample, enter `depth: 0` and choose **Apply dimensions**. A non-positive extrusion depth is outside the supported profile. The accepted model should be retained; correct or **Discard draft** rather than inventing a valid alternative shape.

| What you see | What it means | What to do |
| --- | --- | --- |
| **Dimension changes pending** | Text is staged, not native geometry | **Apply dimensions** or **Discard draft** |
| **Computing native geometry in a dedicated worker…** | Candidate evaluation/display work is pending | Wait for acceptance; **Cancel computation** is available |
| Error/refusal after Apply | The candidate did not pass the supported geometry/display contract | Keep the previous accepted part; inspect the actual error, correct or discard the draft |
| Wrong body shown after Open | The visible output may be `tool`, not `part` | Choose `part` under **Visible output body** |
| **Load example** disabled | Replacement acknowledgment is required when a model is accepted | Save first, then check the explicit replacement box |
| **Undo** disabled | A draft is pending or no accepted undo history exists | Resolve the draft; do not expect opening an example to retain the old history |

A successful **Apply dimensions** is not implied by typing, preview, or a successful save button. Preserve actual error codes and causes when reporting a failure; do not round coordinates, change the tool silently, or substitute approximate mesh geometry to make an edit appear successful.

## What this tutorial does not promise

The pocket is a bounded rectangular **underside** cut in the qualified modeling family. It does **not** establish arbitrary 3D Boolean subtraction, fillets, fully constrained sketches, multi-body manufacturing certification, persistent topology naming, or universal CAD file interchange. The [CAD capabilities](../cad/capabilities) and [modeling API guide](../cad/modeling) describe other *separately* admitted cases; not every API operation is available in this UI.

The accepted authored model is separate from a preview mesh, a local browser presentation, a downloaded file, an integrated product release, and an npm-published package. The [CAD Editor limits](./limits) and [CAD modeling boundaries](../cad/modeling#evidence-and-current-availability) distinguish those stages.

## Source and verification record

This page tracks the UI labels and behavior in `packages/barocss-cad-editor/src/react/modeling-editor.tsx`, the route in `apps/cad-editor/src/app.tsx`, and the existing pocket fixture documented in [the modeling guide](../cad/modeling#cut-an-underside-pocket-or-through-window). Its app-local `scripts/check-cad-editor-first-model.mjs` provides a read-only string/navigation drift check when run from the repository root:

```sh
node apps/library-docs/scripts/check-cad-editor-first-model.mjs
```

**Unrun for this documentation-only change unless separately recorded:** VitePress production build, fresh Chromium interactions, GPU readback, physical browser download/reopen and release deployment. Those gates cannot be inferred from source inspection or a static checker.

**Next exercise:** [Create a round post](./round-post) to learn diameter-driven circular geometry, inspect a non-certified output, and practise another safe save/reopen cycle.

[CAD Editor overview](./) · [Developer quickstart](./quickstart) · [CAD modeling reference](../cad/modeling)
