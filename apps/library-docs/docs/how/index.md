# How it works

How the kernel and the packages around it compute what they compute: one page a topic, each with figures that play their
steps, the formulas, where the code is and how the result is checked. Every statement is checked against the code as it
is; the figures run small cases worked out in the page with the kernel's methods and constants.

Use **Play**/**Pause**, the arrows or a step's number to go through a figure at your own pace. With reduced motion
turned on in your system, each step is shown still.

| Page | What it explains |
|---|---|
| [Booleans of curved solids](/how/boolean) | Surface intersections, splitting faces, classifying and stitching pieces |
| [NURBS curves and surfaces](/how/nurbs) | Basis functions, weights, knot insertion, subdivision, degree elevation |
| [Tessellating a B-rep for display](/how/tessellation) | Shared edge samples, density, ear clipping, curved faces |
| [Volume, centroid and inertia](/how/mass-properties) | Divergence theorem, Green and Pappus closed forms, Gauss–Legendre on patches and trimmed faces, principal axes |
| [Fillets: the rolling ball](/how/fillets) | Closed-form sections, the rolling ball, lofting the tool, refusals |
| [Exact arithmetic for planar solids](/how/exact-boolean) | Binary64 as exact fractions, orientation signs, cutting faces, ray classification, the planar retry |
| [Hidden lines for drawings](/how/hidden-lines) | Candidate curves, exact projection, silhouettes, visibility by sampling and bisection |
| [Solving sketch constraints](/how/sketch-solver) | Constraints as residuals, damped Newton steps, degrees of freedom, arcs |
| [Names that survive edits](/how/naming) | Face and edge names, #k numbering, references and their refusals |
| [Booleans of upright extrusions](/how/prismatic) | Height intervals, section Booleans, merging slabs, rebuilding walls and caps |
| [Meshes, native tools and the BVH](/how/mesh-boolean) | The mixed mesh/native Boolean, T-junction mending, the triangle hierarchy and its queries |
| [Closest points on curves and surfaces](/how/closest-point) | Gauss–Newton projection onto surfaces, golden-section search on curves, the Boolean's projections |
| [Where a curve meets a plane](/how/curve-roots) | Distance as a Bernstein polynomial, hull test, turning points and bisection, tangent refusals, spans |
| [Lofts, sweeps and revolves](/how/loft-sweep) | Revolve on rational arcs, draft, sweeps with rotation-minimising frames, lofts |
| [Threads, gears and springs](/how/threads-gears) | Involute flanks fitted to tolerance, gear pairs and contact ratio, helical threads, springs |
| [Subdivision surfaces as exact B-splines](/how/subd) | Catmull–Clark rules, the cage as a bicubic net, phantom points, G1 caps at extraordinary vertices |
| [Sheet metal: bends and the flat pattern](/how/sheet-metal) | Neutral layer and K-factor, bend allowance, bend tables, unfolding a B-rep, reliefs, DXF |
