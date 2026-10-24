# Decision records — drawings lane (DR-numbers)

The CG5 lane's records (owner, 2026-10-24: "CG5(도면) … 부터 로드맵 순서에 넣고 진행해줘"). The lane owns
`packages/barocss-cad-model/src/drawing/**` and the studio's Drawing workspace (`apps/cad-studio/src/ui/DrawingWorkspace.tsx`,
`ui/drawing/*`, `ui/useDrawingSheet.ts`), taken over from the outer lane (whose earlier drawing records are in
`decisions-outer.md`: R11b O1, R14 O2–O7, O148 X1–X3, O170–O178). Same format: what was decided, why, what it binds.
Newest last. Branch `claude/drawings-cg5`; the coordinator merges.

## DR-0 — the CG5 plan: eight steps, each a checkpoint with an independent oracle (2026-10-24)

- **What**: the order sent to the coordinator (full gap map in the session notes, `cg5-drawings-gap-map.md`):
  DR-1 detail views → DR-2 broken views → DR-3 half and offset (stepped) sections → DR-4 revolved and removed sections →
  DR-5 title-block templates and revision tables → DR-6 full GD&T (characteristics, modifiers, datum features on
  faces, datum targets) → DR-7 ISO/ASME presets and inch display → DR-8 drawing sets (several sheets, cross-sheet
  references).
- **Why this order**: the view kinds first (DR-1–DR-4), since sets, presets and GD&T all hang annotations on views; each
  view kind is a 2D operation on the kernel's exact projections and sections, so no kernel change is needed and each
  is checkable against closed forms.
- **Binds**: no new kernel API; agent capability through `set_drawing` (details in its v1 description, which
  `describe` serves; the v2 hint one line), the per-turn budget ≤ 25,000; presets are a few style values under neutral
  names, no standards tables.

## DR-1 — detail views: the parent's exact projection clipped to a circle, drawn at its own scale (2026-10-24)

- **What**: `src/drawing/detail.ts` (new) and the sheet, issues, reorient, options and agent paths.
  - **Settings**: `DrawingSettings.details?: DrawingDetail[]`, each `{ id, view, center, radius, scale?, at? }`:
    its letter (one namespace with the sections: `nextSectionId` takes the details' letters, set_drawing refuses a
    shared one, `DRAWING_DETAIL_LETTER`); its parent (`front` | `top` | `right` | `section:<letter>`; never the
    isometric view); the circle in the parent's view coordinates (model mm); the scale absolute (5 = 5:1; absent: the
    smallest standard scale at least twice the sheet's, `detailScale`; past 10:1 twice the sheet's); `at` its centre on
    the sheet (absent: laid out). Read permissively from files (`readDetails`: invalid entries dropped, letters unique).
  - **Geometry**: `clipProjectionToDisk` clips every piece of the parent's projection to the circle. Lines by the
    stable quadratic roots; circular arcs in closed form (A cos t + B sin t = K); elliptic arcs by sign changes over
    720 samples a turn, each bisected to the last bit; polylines into their inside runs. An edge with no pieces in
    the parent (on visible ink) is kept when an end or its centre is inside, as the parent keeps it. A section's cut
    rings are clipped by Sutherland–Hodgman against the inscribed 512-gon (2.5e-5·r off at most; hatch only, never
    measured). The detail's extent is the circle's square.
  - **Sheet**: on the parent, a thin circle and the bold letter up-right of it (`role: 'detail'`, `view` the parent);
    the detail itself (`role: 'detail'`, `view: 'detail:B'`) with hidden lines as the parent shows them (none for a
    section), the clipped hatch per body, and its circle; its dimensions (`DimView` gains `detail:B`) resolved on the
    clipped projection — values come from the model as everywhere, so a detail dimension reads the true size at k×
    the drawn length; the name `DETAIL B (5:1)` under them. Auto placement: the first free square (plus the name's
    7 mm) from the frame's top right, down then left, 4 mm clear of views, sections, texts and the title block; then
    balloons and tables keep clear of it. `Sheet.details` / `Sheet.detailsMissing` say what was drawn and why not.
  - **Issues**: `DETAIL_PARENT_MISSING` (error; fix `remove-detail`, which removes its dimensions too), `DETAIL_EMPTY`
    (warning; same fix), `DETAIL_NO_ROOM` (error, no automatic fix). Detail lines count as lines for
    `TEXT_OVER_LINES`, its square as another view's area.
  - **Reorient** (R14.3b): a detail on a view goes to the view showing the same axes, its centre carried through the
    model; on a section, it turns as the section's view does; its dimensions with it, checked to read the same against
    the parent's projection.
  - **Agent**: `set_drawing` takes `details` (list replaces; [] clears). Refused: bad shape (`DRAWING_OPTIONS`), a
    section's letter, a missing parent section (`DRAWING_DETAIL_PARENT`, also when a section is removed under one),
    changing a detail's parent, centre or radius while it has dimensions (`DRAWING_DETAIL_REFERENCES`); its scale and
    place may change. The v2 hint gains `details?: [{id,view,center,radius,scale?,at?}]`.
  - **Studio**: the Detail view tool (E): centre on a view or section (snapped), then a point the circle reaches (its letter the next free from B: A stays the front section's checkbox, as added sections leave it);
    the DETAILS card lists each with its scale (Auto shows what it is) and a remove button; a detail dragged anywhere
    in its square moves it (`at`); dimension tools work in a detail; `__studioDrawing().details` for the flow.
- **Why**: a detail is the parent's own projection restricted to a region, so clipping the exact curves is exact
  wherever the parent is — no new projection, no kernel call, nothing approximated except the hatch boundary.
- **Not in DR-1**: centre marks and thread marks inside details (the parent's centre lines would need clipping too),
  a jagged or rectangular detail boundary, details of the isometric view, details on other sheets (DR-8).
- **Files outside the lane, named to the coordinator**: `src/engine/refusal.ts` (three codes added to
  `CadModelCode`), `src/chat/groups.ts` (the drawing hint). The refusal table in the docs needs regenerating at the
  merge (`apps/library-docs/scripts/refusals.mjs`); the drawings page needs a "Detail views" section (docs lane).
- **Evidence** (oracles independent of the code): `test/drawing-detail.test.ts`, 13 tests —
  the segment crossings (t = 0.25/0.75; 0.3/0.7 for y = 3, r = 5); the two circles' crossing at π/3; an ellipse's four
  at acos(±√(5/12)) to 1e-12; polyline runs cut at (±3, ±4); the inscribed polygon's area (N/2)r² sin(2π/N); the
  starter plate's front detail at (36, 8) r 4 holding exactly the top edge X 32–40 and the hole's hidden side Z 4–8,
  drawn at 5:1 to the sheet point by hand; a top detail holding only the hole's rims, its Ø8 reading 8 with arrow
  tips 20 from the centre; a section's detail hatch clipped to the half-polygon's area; the issues and their fix;
  reorient to +X; and the DXF read back by ezdxf 1.4.5 (`~/.cache/barocss-ezdxf`, `dxf-oracle.py`): the circle r 20 at
  (330, 217), the line (310, 217)–(350, 217), the name and `Ø8`. Flow step 205 "detail views (CG5 DR-1)": the tool on a
  64 × 32 × 8 box's corner on A3 (auto 5:1 on the sheet's 2:1), its square 2·scale·r exactly, rescaled, dragged 20 mm, in
  the SVG, removed. Checks at the checkpoint: cad-model 1108/1108, studio 287/287, docs samples 49/49, tsc and eslint of
  both packages, FLOW_ONLY='DR-1' (steps 1, 205) on WebGPU. Not run: the full flow, WebGL2.

## DR-2 — broken views: a band along a model axis left out of every orthographic view that shows it (2026-10-24)

- **What**: `src/drawing/breaks.ts` (new); layout, `toSheet`/`fromSheet`, sheet, issues, options and agent paths.
  - **Settings**: `DrawingSettings.breaks?: DrawingBreak[]`, each `{ axis: 'x' | 'y' | 'z', from, to }` in model mm.
    Read permissively (`readBreaks`: valid ones, none meeting an earlier one on its axis); set_drawing refuses a
    reversed one or two that meet on one axis (`DRAWING_OPTIONS`).
  - **Model terms, not per view**: a break applies to every orthographic view (front, top, right) whose horizontal or
    vertical axis is the break's (`viewBreaksOf`, its interval cut to the view's extent), and to their principal
    sections, so the views and sections stay in projection; a view looking along the axis, the isometric view and
    aligned sections are not broken.
  - **Mapping**: a placement carries its breaks (`ViewPlacement.breaks`, view coordinates, each with `gap` =
    `BREAK_GAP` (6 sheet mm) / scale). `toSheet` maps a view point through them before the scale: past a band shifted
    back by the band less the gap, inside it squeezed linearly to the gap (so the map is continuous and `fromSheet`
    inverts it). Everything drawn through `toSheet` — dimensions, centre marks, datums, leaders, balloons, cutting
    planes, the 3D annotations through `fromSheet` — follows; a dimension across a break reads its true length while
    drawn shorter.
  - **Curves**: the views' and sections' pieces are clipped outside each band (`clipProjectionOutside`): lines by their
    parameter at the band's sides, arcs (circles and ellipses alike) where A cos t + B sin t = w − c in closed form,
    polylines into runs; cut rings split at each band by half-planes (`clipRingsOutside`).
  - **Layout**: the column and row spans are computed per candidate scale through the breaks (the gap in model mm
    depends on it), so Auto takes the larger scale a broken part allows; without breaks the layout is as before.
  - **Marks**: at each side of each gap a thin line across the view, 2 mm past its box, with a small zig-zag at the
    middle.
  - **Issues**: `BREAK_NO_VIEW` (warning; fix `remove-break`) when a break shortens no shown view.
  - **Agent**: `set_drawing` takes `breaks` (list replaces; [] clears); the v2 hint gains `breaks?: [{axis,from,to}]`.
  - **Studio**: the BREAKS card — Add break (the middle third of the part's longest axis, whole mm, `suggestBreak`),
    each break's axis and ends, remove; a change that would reverse a break or make two meet is refused with a toast.
- **Why model terms**: a break chosen per view would let the front and top views disagree about where X 450 is; in
  model terms one interval serves every view that shows the axis and projection holds by construction.
- **Not in DR-2**: breaks in the isometric view, curved (S-break) symbols for round bars, a break inside a detail.
- **Evidence**: `test/drawing-breaks.test.ts`, 8 tests — the coordinate map and its inverse at hand-computed points;
  a line split at ±5, a circle's arcs at ±π/3 and ±2π/3 and an ellipse's at acos(±¼) in closed form; a 500 × 20 × 20
  bar with a Ø8 hole at X 450 broken X 100–400 at 1:2: the front and top views 0.5·200 + 6 = 106 mm long and in
  projection at X 0, 50, 100, 400, 450, 500, the right view whole, the top edge in pieces 0–50 and 56–106, the break
  lines at 50 and 56, the hole at 81; a dimension across it reading 500 with arrow tips 106 apart; Auto on A4
  without the isometric view 1:5 whole (500s + 20s + 22 ≤ 249) and 1:1 broken; a broken section's cut face in two
  parts in projection; BREAK_NO_VIEW and its fix; set_drawing; the DXF read back by ezdxf (the two edge pieces at
  their shifted places, no whole edge). Flow step "broken views (CG5 DR-2)".
