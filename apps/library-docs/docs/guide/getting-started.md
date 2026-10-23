# Getting started

This page takes you from a fresh checkout to a first part: a plate with holes, a change made by the agent, a saved
file and the usual exports.

## Run the studio

You need Node 22 and pnpm. From the repository root:

```bash
pnpm install
cd apps/cad-studio
pnpm dev
```

The studio opens at `http://127.0.0.1:52020`. It compiles the packages' TypeScript sources directly, so there is
nothing to build first.

The chat panel needs the chat server, which runs each turn through the `claude` command-line tool you are signed in
to. Start it in a second terminal:

```bash
cd apps/cad-studio
pnpm chat
```

It listens on `127.0.0.1:52021`; the studio forwards its chat requests there. Without it the studio works as
before, and the chat panel says **Chat is off**.

::: tip Which renderer
The viewport draws with WebGPU when the browser has it and falls back to WebGL2 otherwise. Add `?renderer=webgl2` to
the address to force WebGL2. A few analyses draw only with WebGPU; see [Limits](/reference/limits).
:::

## A first part

The studio opens on a starter plate with one Ø8 hole. Start your own part instead:

1. Click **New part**.
2. Press <kbd>B</kbd> for a box. The heads-up display (HUD) shows its fields; set **Width X** 64, **Depth Y** 32 and
   **Height Z** 8. The viewport previews it as you type.

   ![The box's fields in the HUD, previewed in the viewport](/shots/guide/getting-started/box-hud.jpg)
3. Press <kbd>Enter</kbd>. The history shows `Box 64×32×8` and the **Browser** one body.
4. Click **Top** in the view buttons, then click the top face. The properties panel shows `SELECTION · FACE`.
5. Press <kbd>H</kbd> for a hole. Set **Diameter** 8, **Centre X** 32 and **Centre Y** 16, wait for the HUD to say
   `preview`, and press <kbd>Enter</kbd>. The **Browser** lists `Hole Ø8`.

   ![The hole's preview on the top face, seen from the top, with its fields in the HUD](/shots/guide/getting-started/hole-preview.jpg)

A tapped hole needs thread sizes, and the studio has none built in: sizes come from a rows file you load. Try it:

1. Select the top face again, press <kbd>H</kbd> and set **Type** to **Tapped**. The HUD refuses:
   `[FASTENER_SIZE_ROW] no row for M6 …`.

   ![The HUD refusing the tapped hole: no row for M6](/shots/guide/getting-started/tapped-refused.png)
2. Press <kbd>Escape</kbd>, open **Library**, and click **Load sample fastener sizes**. **Fastener sizes loaded**
   now reads `M3, M4, M5, M6, M8, M10, M12`. These are example rows that ship with `@barocss/cad-model`, each value
   with its source. Check them against your own supplier before you rely on them.

   ![The library with the sample fastener sizes loaded](/shots/guide/getting-started/library-rows.jpg)
3. Close the library and add the tapped hole again, away from the first hole. It now takes the M6 row: a Ø5 tap
   drill and an `M6×1` thread.

   ![The tapped hole's fields with the M6 row: an M6×1 thread](/shots/guide/getting-started/tapped-hole.png)

[Shop rows](/studio/rows) explains the rows rule and the other row kinds.

## Ask the agent for a change

With the chat server running, click **Chat** and describe the change, for example "make the plate 10 mm thick".

- A change to values, such as the dimensions of one feature, applies directly, as long as every hard requirement
  you have set still passes.
- A change to the part's structure, such as a new feature, a deleted one or a feature built on something else,
  comes back as a proposal. Its card has **Preview** to see the result, **Accept** to apply it and **Reject**.

This is the default autonomy level. [Proposals and autonomy](/agent/proposals) describes the others.

## Save, open and export

- **Save** downloads the document as a `.bcad` file. **Open** reads a `.bcad` back, and also STEP, STL, OBJ and
  IGES files.
- **Export STEP**, **Export IGES**, **Export STL** and **Export 3MF** download the part in those formats.
- The **Drawing** tab at the top switches to the drawing workspace: the part's sheet with views, dimensions and the
  title block, with **Export SVG**, **Export PDF** and **Export DXF**.

![The Drawing tab: the part's views, the title block and the sheet settings](/shots/guide/getting-started/drawing.jpg)

[Files and exports](/studio/files) has the details of each format.
