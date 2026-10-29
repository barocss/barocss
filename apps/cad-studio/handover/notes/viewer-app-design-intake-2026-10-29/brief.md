---
work_id: viewer-app-design-20261029
artifact_type: design
status: draft
owner_role: designer
source_request: "Viewer app design rethink: 너무 옛날 디자인"
last_updated: 2026-10-29
---

# Baro Viewer — review workspace concept

Visual thesis: A quiet off-white engineering workspace uses readable slate type and one blue accent to make the model and the review result clear.

Content plan: The viewport is the visual anchor. A single 56 px header holds file identity and file actions. A 220 px structure tree supports navigation. A 280 px inspector puts the accepted distance first. Native parameters and numeric detail remain available in collapsed sections. The footer holds units and session status. This is a utility workspace, so there is no marketing hero or CTA section.

Interaction thesis: Panels move as a single 160 ms layout transition. Selection has a brief outline transition and updates the inspector. Menus and drawers enter with a small 120 ms opacity/position transition. Reduced-motion preferences disable these motions.

## Reference and problem

Reviewed actual app screenshots: `runs/viewer-app-browser-20261029/native-8mm-desktop.png` and `compact-properties.png`.

The current header and two toolbars use about 146 px before the model. Permanent sidebars use about 532 px. Similar dark surfaces weaken the hierarchy. The completed distance appears below other controls and can fall below the viewport. Small isolated icons make common actions harder to find.

## Design decisions

- Default light canvas, off-white navigation, white inspector, one saturated blue for selection and primary actions. An optional dark theme keeps the same hierarchy.
- One 56 px header. File title and source/revision remain visible. Open and Export use labels.
- Large model area with controls directly on the canvas. Fewer frames and border boxes. A quiet grid supports spatial orientation.
- Measurement is a persistent top inspector result and an on-canvas A/B annotation. Its label says point to point, mm and not certified. It is not minimum clearance.
- Tree and inspector can collapse independently on desktop. At 900 px and below, each becomes a drawer. Only one drawer opens at a time. Escape closes the drawer or menu and returns focus to its trigger.
- A compact measurement summary remains over the viewport when drawers close. Important values do not require scrolling.
- Native t/u/v, authored XYZ, references and estimation tolerances remain available through disclosure sections. They are not removed to make the design clean.
- Saved views are accessed at the viewport. Export has explicit review/PNG choices. The prototype only opens these menus; it never reports a file as saved.

## Prototype data and boundary

`concept.html` is a standalone HTML/CSS/JS design prototype. It has no external dependencies or backend. The SVG engineering bracket is a concept illustration drawn for this prototype. It is not an output of the CAD engine, a loaded CAD file or evidence of support for solids. The file identity, labels, 8.000 mm value and coordinates are static illustrative data. The proposed Baro Viewer name is a design option; the actual product remains CAD Viewer.

Functional prototype interactions: tree selection updates inspector and illustrated selection; measure toggles its annotation; panel collapse/drawers; light/dark theme; Export/Open/Saved views menus; saved view selection changes the view label and scene orientation; Escape and focus return; keyboard-accessible disclosure controls. Export menu choices show a format explanation only. They do not create or save a file. Native numeric fields are inspectable static examples; they do not evaluate geometry.

No CAD editing, STEP support, server collaboration, comments service or certified geometry result is implied. Product source is unchanged.

## Acceptance and verification

1. At 1440 × 900, a 56 px header and calm footer leave the model dominant; both side panels remain readable.
2. At 720 × 700, header actions fit and the viewport is unobstructed when drawers close. Only one drawer opens. The distance stays visible without a page scroll.
3. Tree selection, measurement, panel controls, theme and menus work with accessible button names and visible keyboard focus.
4. Escape closes menus/drawers and returns focus. Reduced motion disables transitions.
5. Browser screenshots and interaction checks must be recorded before visual acceptance. Until then this is a draft concept, not an integrated or verified product change.

Build questions: finalize product name; decide whether assembly distance PNG should ship with this design; define the source/subset prerequisite summary for received review files. These choices do not block this visual prototype.

## Required conditions before product implementation

- A/B identification must show both instance/body names, original references, evaluated parameters and the coordinate basis. The compact endpoint summary in this concept is incomplete; do not rely on the model picture to identify a point.
- Define and design loading, invalid source, unsupported body, admission failure, review source/subset mismatch, device loss and recovery failure states. Keep accepted source/review state visible when it is retained. Do not report recovery complete from a device-created event alone.
- The conceptual assembly inspector illustrates where native parameters and estimates belong. Only expose each metric where the current public API supports it. Current assembly point inspection and document geometry estimates have different contracts.
- Validate body/instance selection, visibility, measurement and saved-view actions against the actual controller. The prototype changes illustrative UI state and SVG styling; it does not load or evaluate CAD data.
- Keep the 8.000 mm result pinned when advanced details scroll. For real measurements, include value precision and not-certified semantics without implying minimum clearance.
- Export choices in this concept describe output intent only. Product file creation needs actual download evidence and failure/cancellation handling. The concept does not claim successful output.

## Preview verification result

The 1440 × 900 light/dark and 720 × 700 viewport/inspection screenshots were rendered and visually reviewed. The guarded standalone interaction run passed 19 checks, including selection, disclosure, measurement toggle, menus, Escape focus return, desktop panel collapse, dark theme, fixed 56 px header, no page overflow, compact distance visibility and one active accessible drawer. Its first failure was search filtering.

The search cause was duplicate SVG symbol/control IDs. The final HTML prefixes SVG IDs with `glyph-`. Static validation found zero duplicate DOM IDs and JavaScript syntax passed. A browser recheck requested the shared gate for 30 seconds. It was refused with exit 75 at high load. No retry or bypass followed. Therefore final search behavior after the correction is **browser NOT_RUN**, and the concept remains **draft**. Screenshots precede this nonvisual ID correction.

The initial CUA iab attempt was unavailable. The initial cached CLI used Node 18 and failed; the existing Node 22 runtime then opened a separate owned browser. No package was installed. The guarded browser was closed, its lease was released, and the owned HTTP server on port 53117 was stopped. User tabs and other processes were preserved. Exact final HTML SHA, first failure, checks, screenshots and cleanup are in `verification.json` and `assets/` logs.
