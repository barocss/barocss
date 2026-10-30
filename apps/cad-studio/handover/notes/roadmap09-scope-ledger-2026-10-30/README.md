# Roadmap 09 scope ledger — bounded close (2026-10-30)

Status: **BOUNDED_CLOSED** at D348–D358 and D366, by owner order. The order was relayed by the coordinator on 2026-10-30: "Ellipse first", then close bounded 09 with a scope ledger and start B1.

This ledger adds no code and runs nothing. It maps the row's original requirement to delivered evidence, and lists what stays separately scoped. None of the separately scoped items blocks B1.

## Original requirement

Roadmap row 09 (Advanced sketch — CG3) asks for "remaining spline handles, conics, text/blocks and diagnostic/edit consumers".

Its acceptance:
- Returned geometry meets the original residual limits.
- The sketcher distinguishes DOF, conflict, redundancy and nonconvergence.
- Authored coordinates, dimensions and references are preserved through actual constraint edits, downstream features and Save/fresh Open.

## Delivered evidence

| Area | Evidence (qualification in each notes folder) |
|---|---|
| Edit consumers: identity through edits | D348 feature-editor dimension edits keep the sketch id, side ids, construction and target. D349 reopen→Finish keeps `on` and node extras. D355 a rectangle's side ids survive reopen. D358 a reopened sketch keeps its main circle, its id, its bindings and its circle rules, through unchanged Finish, split, trim, offset, tool switch and a circle click. |
| Edit consumers: parameters | D356 bound sketches reopen at the parameters' values and keep their bindings, or report the loss. D357 previews, handles and Loft read bound sketches (Loft copies are a stated snapshot). |
| Diagnostics | DOF ("Under-defined · N DOF") and redundancy ("Over-defined · N redundant") predate this work. D350 proves rectilinear conflicts exactly and keeps the honest nonconvergence text elsewhere. |
| Spline handles | D351 repairs the Spline tool: clicked points are kept and joints are exact. D352 stores fit points and adds numeric tangent handles. D353 adds viewport dragging of closed-spline handles and fit points. |
| Bézier (#2051 §2) | D354 adds quadratic and cubic Bézier authoring from control points, kept with the sketch, with exact NURBS via Make curves for Loft guides. |
| Conics | D366 adds the Ellipse tool. Its profile is tangent arcs within 1e-5 of the longer semi-axis, and Make curves gives the exact NURBS. Fillets on its sides are refused until the kernel scales. |
| Earlier repairs in the row | D318 skeleton file admission and ids. D335 edited-sketch id loss. |

Each item has its Model tests, an independent Opus audit, and an actual Studio run with Save/fresh Open. The retained failures are recorded in each D-record.

## Separately scoped (not 09 prerequisites; candidates for later rows or issues)

- **Sketch text and blocks.** There is no sketch-level text entity or reusable block. Text relief exists as a feature (07).
- **Other conics.** Parabola, hyperbola and general conic through five points.
- **Exact elliptic profile edges.** This needs elliptic loop segments in the kernel. Today kernel loops are lines and arcs.
- **Ellipse limits.**
  - Fillets and chamfers on its side edges: kernel throughput and the 64-edge rim limit, #2265 and #2259 ([repro](../ellipse-sketch-2026-10-30/audit/fillet-scaling.md)).
  - Dimensions on an ellipse: the solver's 64-segment limit.
  - Centre and quadrant snaps.
  - Refusal coverage for sheet-base and sweep-curve side names.
  - The definition is kept only on the main shape.
- **Splines.**
  - Open-spline-in-outline editing: a spline joined with lines loses its definition.
  - Handle magnitude (tension).
  - Dragging open splines.
- **General conflict proofs.** Beyond the rectilinear class of D350: angles, arcs and tangency.
- **Associative and parameter work.**
  - #2232: associative inward offset that removes and restores an arc corner.
  - #2250: parameter expression shown beside its value.
  - #2069: T2 sketch layers.
- **Noise and low items.**
  - D355 S2: a 3.33e-16 slot centre drift on round trip. Floating-point noise, not a defect.
  - D358 N3: circle regions stored after a polygon region flip order once (ids and geometry unchanged).
  - D357 S1: `loopOf` returns NaN for bound input (no caller passes one).
  - A reopened distant standalone sketch is framed off-screen.

## Next

Per the owner order, B1 is next: the associative 2D band (roadmap "After 09" row). At this boundary, reproduced correctness defects still come first (owner rule): the #2229 sweep budget/contact and the 20② fillet drag value jump are the known candidates.
