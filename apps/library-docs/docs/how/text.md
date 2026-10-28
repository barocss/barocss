# Text from original font outlines

**Text** makes a new, independent solid from a supplied static TrueType font. The document keeps the original
text, font bytes and dimensions. Editing the feature rebuilds its geometry from that source.

![ABeeZee text after applying a Text feature in Studio](/shots/studio/features/text-applied.png)

This is one authored feature and one output. Separate letters, dots and Korean components can remain separate
physical bodies within that output. Text does not join an existing body automatically.

**Text relief** is a separate modifier. It embosses or engraves the same source outlines on one supported +Z
planar top face, and requires one physical solid before and after the operation.

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

## Emboss or engrave a top face

![Original-font text engraved into a selected top face](/shots/studio/features/text-relief-engrave.png)

![Nanum Myeongjo text after engraving and portable Save/Open](/shots/studio/features/text-relief-korean.png)

Choose one uniquely named flat top face facing +Z, then start **Text relief**. Load the original **Font file**,
enter **Text**, **Em size**, **Depth**, **Curve tolerance**, **Tracking**, **Baseline X** and **Baseline Y**. Choose
**Emboss** or **Engrave** under **Operation**. Changes update the candidate preview; use **Apply** or **Cancel**.
The baseline values are world XY coordinates in the part, not distances from the picked face's corner.

The supported target is one closed, strict-valid physical solid with one native upright Z slab and line-only
boundaries. Its material may have holes or concave boundaries. The selected face must be one exact unmerged
name at the current slab top. Side, bottom, tilted and curved faces, several physical bodies and multi-slab
sources are refused. A second relief on the first relief's multi-slab result is outside this initial profile.

Em size, tracking and font conversion follow the standalone Text rules above. Depth is positive. Emboss raises
material by that depth above the current top and requires a positive, representable seat. Engrave removes that
depth below the top; it must leave a bottom web thicker than the existing native linear tolerance. Tool levels
must remain representable and inside the CAD coordinate bounds. The selected cap follows an ordinary upstream
height edit when it keeps the same authored face; the recipe does not store an absolute top Z.

In code, select the top face with the existing face query:

```js
import { readFile } from 'node:fs/promises';
import { fontFromBytes, part } from '@barocss/cad-model/api';

const font = await fontFromBytes(new Uint8Array(await readFile('./ABeeZee-Regular.ttf')), {
  filename: 'ABeeZee-Regular.ttf',
});
const plate = part('label plate').box({ w: 40, d: 30, h: 10 });
const raised = plate.textRelief(b => b.faces().facing('+z'), font, 'A', {
  size: 10, depth: 2, at: [5, 5], mode: 'emboss', tolerance: 0.002,
});
const pocket = plate.textRelief(b => b.faces().facing('+z'), font, 'A', {
  size: 10, depth: 2, at: [5, 5], mode: 'engrave', tolerance: 0.002,
});
```

Both operations use the unchanged `plate`. For this fixed ABeeZee A, the independent straight-outline area is
148797 design units squared at units-per-em 1000. The reference volumes are 12029.7594 mm³ for emboss and
11970.2406 mm³ for engrave: `40*30*10 ± 148797*(10/1000)^2*2`. These values describe this supplied font and input.
They do not certify arbitrary glyphs or placements. See [the API options](/packages/api#text-relief-on-a-top-face).

### Every stroke must fit

The kernel checks the complete filled polygon of every component, including its local holes, against both the
actual slab material and the selected B-rep face's oriented trim. An outer bounding box, sampled points or total
tool overlap cannot establish support. A target hole inside a letter's stroke is a refusal even when all outer
stroke vertices fit inside the plate.

Each component needs a boundary clearance above the requested outline flatness plus the existing native linear
policy. The sum is rounded upward; native vertex tolerance is not increased to the outline tolerance. Pair checks
allow for both component approximation bounds. Distinct components that overlap, touch or are too close are
refused. This can include a glyph with unsupported component contact or a tracking value that makes letters meet.

All support checks run against the original target before constructing a result. Each component must have
complete positive support and the intended positive material change. Emboss builds the admitted slabs directly;
engrave uses one batched planar difference. The resulting oriented pocket frontier must match the source
boundary minus all component boundaries, including counters, before it is accepted. The result must remain one
closed physical solid and pass strict B-rep checks. Exact polygon/slab/B-rep volume audits and bounded reported
mass error check the signed change. These are finite-input checks; volume agreement alone is not a set-equivalence
proof or a universal geometry certificate.

The current Model fixture admits Nanum Gothic and Nanum Myeongjo `가한` in both modes at em size 10,
baseline `[5,5]`, depth 2 and tolerance **0.01 mm**. This is the default tolerance. The tighter Nanum Myeongjo
engrave fixture at **0.002 mm** is explicitly refused with `INPUT` when it exceeds the unchanged boundary/Boolean
work budget. The recipe retains `0.002`; no tolerance is automatically increased. A tighter request is not
guaranteed to succeed, and the 0.01 result does not qualify the 0.002 stress case.

The relief accepts at most 64 components and uses one generated sketch per component plus one native relief
feature within the part's 512-feature budget. Original scalar/font/profile work and coordinate limits still apply.
The recipe retains text, font source, dimensions, selected face and its signature. Save/Open, edits and parameter
bindings reuse the Text asset paths. Missing selected-face signatures are structurally readable but refused with
`BAD_REFERENCE` when evaluated; the editor/API captures the signature when creating a modifier.

## Current scope and evidence

This is scalar layout without shaping, kerning, bidi processing, Unicode normalization or hinting. Use
precomposed Korean syllables when testing Korean. Combining sequences are not composed or reordered. Browser
font rendering is not a source of CAD geometry. The bounded +Z Text relief modifier is described above. Relief
on general or curved faces, rational/smooth surface wrapping and text wrap are not implemented.

The selected originals are ABeeZee Regular, Nanum Gothic Regular and Nanum Myeongjo Regular. Focused tests use
independent font observations and native geometry checks. Actual desktop Chrome/WebGPU flows created and
reopened Latin and precomposed Korean Text. Latin source editing was also checked. These checks cover selected strings and
glyphs, not every glyph or arbitrary fonts. Composition-Enter guards were checked with synthetic events;
native operating-system IME input was not run.

Runtime checkpoint `62069bbd1` passes the full kernel suite (1994 pass/0 fail/6 existing skips), Model1822/1822,
Studio365/365, both type checks and changed-source lint. Focused kernel19/19, Model75/75 and Studio35/35 pass.
Actual desktop Chrome/WebGPU relief flows check Latin A emboss/engrave, refused outside placement, History edit,
Undo/Redo, original-font Save/Open and re-edit. Both Korean originals check 가한 emboss/engrave and Save/Open at
explicit default tolerance0.01. A tighter Myeongjo pocket at0.002 remains an explicit work-budget refusal and keeps
its original tolerance. The earlier standalone Text flows remain separate evidence.

One local kernel benchmark pair preserves both fixed-case B-rep fingerprints and shape checks. Rounded medians
are7→6ms for emboss and6→6ms for engrave. This pair does not establish a stable speedup or Studio latency change.
Native OS IME, the full browser/GPU matrix and arbitrary fonts/all glyphs are not qualified.
