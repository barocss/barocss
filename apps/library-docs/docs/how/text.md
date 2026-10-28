# Text from original font outlines

**Text** makes a new, independent solid from a supplied static TrueType font. The document keeps the original
text, font bytes and dimensions. Editing the feature rebuilds its geometry from that source.

![ABeeZee text after applying a Text feature in Studio](/shots/studio/features/text-applied.png)

This is one authored feature and one output. Separate letters, dots and Korean components can remain separate
physical bodies within that output. Text does not join an existing body automatically.

## Supply the original font

In Studio, choose **Text** and load a `.ttf` file in **Font file**. There is no built-in font or operating-system
font lookup. The same original bytes travel with the `.bcad` file, including after Save and Open.

For code, import `fontFromBytes` from `@barocss/cad-model/api`, then pass its result to
[`part().text(font, text, options)`](/packages/api#text-from-a-font-file). The source descriptor stores the byte
content key, original `filename`, and optional supplied `source` and `license` strings. Supplied metadata is kept
unchanged; the app does not infer their values.

The reader accepts bounded static sfnt fonts with TrueType `glyf` outlines, Unicode cmap format 4 or 12, and a
limited set of XY-positioned composite glyphs. Variable fonts, CFF, WOFF, font collections, point-attached
composites and unsupported composite flags are refused. A missing glyph is refused; no substitute font or
missing-glyph shape is inserted. A font may contain both admitted and unsupported glyphs.

## Set the dimensions

| Field | Meaning |
|---|---|
| **Text** | A single run of 1–256 printable Unicode scalars. Spaces keep their advance. A run with no drawable component is refused. |
| **Em size** | The font em height in mm. This is not the height of the visible ink bounding box. |
| **Height** | Positive extrusion distance along the text plane normal, in mm. |
| **Curve tolerance** | Explicit upper bound on quadratic outline-to-chord deviation, in mm. It must be at least `1e-7` and no greater than one eighth of the em size. |
| **Tracking** | Additional spacing between scalars, in mm. No tracking is added after the last scalar. |

Studio starts with em size 10, height 2, curve tolerance 0.01 and tracking 0. The code API requires `size` and `h`;
its omitted tolerance is 0.01 and its omitted tracking is zero. Sizes and placed coordinates must stay within
the native 10,000 mm range. A smaller tolerance can exceed the fixed work budget or minimum edge length and
cause a refusal. The implementation does not increase the requested tolerance to make a result succeed.

Text starts on the XY plane. The code API can supply a plane with `origin`, `normal` and `xAxis`; extrusion follows
its normal. The original plane values stay in the recipe. For dimensions bound to parameters, change the number
in **Parameters**. The text edit HUD preserves those bindings and does not replace them with numeric fields.

## From quadratics to solids

1. Read an independent snapshot of the original font bytes. Map each scalar to a glyph and read its advance,
   bearing and unhinted on/off-curve points.
2. Insert implied quadratic points, scale by `size / unitsPerEm`, and place each glyph using its advance and
   tracking. Split quadratics into line chords until the explicit deviation bound is met.
3. Check boundary separation and classify the admitted contours with the kernel's nonzero-fill planar
   arrangement. Keep each outer component with its own holes. An island inside a hole remains a separate
   component; it is not removed by a global holes list.
4. Make one sketch and positive extrusion per component. Combine them through the existing native union path.
   The last generated feature keeps the authored Text ID. A single component gets an identity placement with
   that ID. Internal faces map back to the Text feature for history and editing.

The native feature budget is 512 for the complete part, including generated sketches, extrusions and unions.
There are also bounds on glyph expansion, subdivision work and profile loops. Unsupported topology, unsafe
boundary proximity, short generated edges and exceeded budgets produce explicit refusals. Valid TrueType data
alone does not guarantee an admitted CAD profile.

## Edit and save

Choose the Text feature in history to edit its original text and dimensions. Changes update the live preview;
use **Apply** or **Cancel**. Undo and Redo use the existing document workflow. Editing Text preserves later
independent features.

Save writes the original font as a byte blob in `BCADPACK` version 1. No new document schema or container version
is introduced. Blob content-address checks verify saved-byte integrity; they are separate from geometry tests.
Open reconstructs the source and allows the Text feature to be edited again. Recovery, worker messages and open
prepared text proposals keep referenced font blobs through the existing asset paths.

Studio templates currently refuse documents that contain font sources, including an open prepared Text proposal.
Use `.bcad` Save and Open for this workflow. Existing stored template entries are preserved.

## Current scope and evidence

This is scalar layout without shaping, kerning, bidi processing, Unicode normalization or hinting. Use
precomposed Korean syllables when testing Korean. Combining sequences are not composed or reordered. Browser
font rendering is not a source of CAD geometry. Embossing, engraving and wrapping text onto a face are not part
of this Text feature.

The selected originals are ABeeZee Regular, Nanum Gothic Regular and Nanum Myeongjo Regular. Focused tests use
independent font observations and native geometry checks. Actual desktop Chrome/WebGPU flows created and
reopened Latin and precomposed Korean Text. Latin source editing was also checked. These checks cover selected strings and
glyphs, not every glyph or arbitrary fonts. Composition-Enter guards were checked with synthetic events;
native operating-system IME input was not run.
