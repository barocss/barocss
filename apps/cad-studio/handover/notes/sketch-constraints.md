# Sketch constraints/dimensions session — hand-over (2026-10-16)

Branch: claude/studio-constraints-371737 (worktree .claude/worktrees/studio-constraints-371737), on top of 1ff129f2.
Commits: 813588f8 (feature), cef9f601 (UI polish), d64032d0 (flow step).

New files (no conflicts expected): src/sketch/{terms,rules,select}.ts, src/ui/{ConstraintTools,SketchMarks}.tsx,
src/ui/constraints.css (imported by the components; styles.css untouched), test/constraints.test.ts.

Shared-file edits (thin):
- App.tsx: TOOLS += select (S) / dimension (D); switchTool keeps the outline for them; Esc clears picks/editor
  before cancelling; Viewport props onSketchPick/onDimEdit/onDimCommit; SketchPanel onUi.
- Viewport.tsx: SketchTool union += 'select' | 'dimension'; polygon shape += hv?, rules?; SketchState += picked?, editDim?;
  3 optional props; pick/hover in pointer handlers; sketchMarks() rendered in the polygon overlay; H/V glyphs from hv.
- SketchPanel.tsx: uses solveShape (cached), Over-defined status, ConstraintTools replaces the read-only list for closed outlines.
- sketch/profile.ts: solveOutline takes hv + rules; report adds rows. sketch/settle.ts: freezes H/V at close,
  refuses edits that add redundancy, prunes redundant inferred relations.
- test/browser-flow.mjs: one step right after 'concentric arcs hold, a collapsing equal radius is refused'.
No doc.ts, root manifest, lockfile or package changes.

Verified: pnpm test 59/59, type-check clean, browser flow 32/32 on WebGPU (run 2026-10-16).

## Follow-up 881a4dbb (on top of integrated tip 2d9c79bc, fast-forward merged first)
- Rectangles: S/D convert the current rectangle to a 4-edge outline (hv kept); with no current shape the last
  finished outline/rectangle comes back (src/sketch/select.ts startPicking; App.tsx switchTool one-liner).
- Glyph font fix in constraints.css. New flow step 'a rectangle takes a typed dimension and a constraint'
  directly after my earlier step. Unit 66/66, flow 34/34 (first run: steps 29 render / 30 .barocad flaked, rerun clean).

## Follow-up 901e1488 (on 881a4dbb)
- Horizontal / vertical point distances (rules dx/dy; terms.ts helper points; profile.ts point limit counts them).
  Panel: two picked points show Distance / Horizontal / Vertical; viewport editor keys A/H/V switch.
- Only my files + one new flow step 'horizontal and vertical distances between two points' after my rectangle step.
- Unit 67/67, type-check clean, flow 35/35 on WebGPU.

## Follow-up (angle dimensions) on top of integrated tip 635591fd (merged first; rebuild @barocss/cad after that merge)
- Angle between two straight edges: rule 'angle' (degrees) → kernel signed-angle (terms.ts edgeAngle); panel Dimension
  with two lines; Dimension tool line → line. New flow step 'an angle between two lines from the Dimension tool'
  after my axis-distance step. Unit 76/76, flow 37/37 on WebGPU.

## Follow-up (sketch undo/redo)
- src/sketch/history.ts SketchHistory; App.tsx: updateShape records settled-outline edits, ⌘Z/⇧⌘Z in sketch use it.
  Behaviour change: ⌘Z while sketching no longer undoes the model behind the sketch.
- Flow step 'undo and redo step through constraint edits while sketching' after my angle step. Unit 77/77, flow 38/38.

## QA fixes 36557d92 (branch merged with tip 356c3a7f first → 385ad9c7; also carries bfb6e5b3 sketch undo)
- S1: fixed by bfb6e5b3 (sketch-level ⌘Z; no longer cancels the sketch or undoes the doc).
- S2: doc.ts SketchOutline + optional `outline` on sketch nodes; part.ts strips it for the kernel; loops.ts shapeNode stores it;
  src/sketch/outlineFields.ts + one line in app/editFields.ts → feature editor fields per driving dimension. Probe K18 now ok.
- W1/C1: loops.ts profileOf refuses crossing outlines ("Shapes i and j overlap…") and the no-outer case; regions-probe all refused, disjoint ok.
  Not done: an actual union of overlapping shapes, and reopening a finished sketch for full editing.
- U3: App.tsx keydown — sketch tool keys work from number inputs (blur + switch).
- Unit 84/84, type-check clean, flow 39/39 on WebGPU (new step after my undo step). constraints-mates-probe: 33/35, M09/M10 are mates.

## Reopen sketch (on tip abc47f67, merged first)
- src/sketch/reopen.ts (node → shapes); App.tsx: editSketch(), finishSketch replaces the node when sketch.editNode is set,
  NodeEditor gets an "Edit sketch" button, plane controls hidden while editing; Viewport SketchState += editNode?.
- Flow step 'a finished sketch reopens from the feature editor…' after my QA step. Unit 100/100, flow 41/41.

## QA S3 fix (tip 8d441bdc merged first): loops.ts rectangleNode + polygon flag fromRectangle (select.ts rectangleOutline, Viewport type). Unit 101/101, flow 41/41.

## Circles placed from the outline (on tip 8d441bdc)
- Polygon/SketchOutline += circles; rules cdist/cdx/cdy (terms.ts helper centres k<j>); select.ts picks/attaches done circles;
  SketchMarks draws attached circles + dims; profileOf flattens attached circles; reopen/outlineFields handle them.
- Viewport.tsx: pickSketch gets sk.done; marks get done. Flow step 'a hole is placed by dimensions from an outline corner'. Unit 103/103, flow 42/42.

## Edge→circle and circle↔circle distances (on tip d5fa5fa6, fast-forwarded first): rules cedge / ccdist|ccdx|ccdy; flow step 'holes placed from an edge and from each other'. Unit 118/118, flow 43/43.
