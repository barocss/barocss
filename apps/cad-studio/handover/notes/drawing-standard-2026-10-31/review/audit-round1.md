# D396 audit round 1 — CHANGES_REQUIRED (Opus, full tier)

Byte identity with no standard: 91 outputs identical between HEAD and the working tree (SVG, DXF R2000/R12, PDF, issues, label placement, tolerance suggestions, 3D annotations, fixAll, autoLayout, chat drawing_issues) over an annotated plate (sections, detail, notes, table, basic/tolerance dims, point/line/area targets, flatness/concentricity/symmetry frames), first angle, auto layout, two assemblies with balloons/BOM, pan-tilt, bracket, cnc8-pocket, assembly-cut.

1. (medium) The preset was module-level state: toleranceSuggestions/acceptAll (datum placement) and the exported mark builders read it without anything setting it (latent: results matched on the probe plate). → explicit standard parameter.
2. (medium) The agent could not set the standard: set_drawing's schema had no `standard` (additionalProperties false).
3. (low-medium, other lane) DXF header DIMSTYLE DIMTXT 3.5 / DIMTAD 1 in packages/barocss-cad is wrong for ASME; the exploded dimension blocks are right, so a reader that regenerates dimensions from the style would show 3.5 mm text above the line — follow-up for the kernel lane.
4. (low) Test gaps: the ASME text-beside-the-line fallback, lettering of notes/section/detail/frame datum letters, the issue and label-placement paths.
5. (low) Dead open datum triangle branch.
6. (low) ISO projection symbol centre line 1 mm into the title room.
Standards accuracy (auditor's confidence): ISO 3098 3.5 mm high; ASME Y14.2 ≈ 3 mm medium-high; ISO 15° arrowhead medium; ASME 3:1 high; ASME unidirectional in a break high (ISO 129-1 also allows unidirectional — not offered); ISO 5456-2 symbol proportions medium; Y14.5-2018 removal of concentricity/symmetry high; ISO 5459 line target medium-high.
Mutations 48: 33 caught, 15 survived (ASME break details, lettering sizes, wrappers, dead branch).
Root image review (run02, zoomed renders): ASME horizontal text in a break of the line; ISO text aligned above the line, vertical dimensions read from the right.
