<script setup>
import MassGreen from '../.vitepress/components/algorithms/MassGreen.vue';
import MassGauss from '../.vitepress/components/algorithms/MassGauss.vue';
import MassInertia from '../.vitepress/components/algorithms/MassInertia.vue';
</script>

# Volume, centroid and inertia

A part's mass properties are its volume, its mass, its centre of mass (the centroid) and its inertia tensor about that
centre. The kernel returns them from `massPropertiesOf(output, density)` and `brepMassProperties(brep, density)`
([Outputs](/packages/cad/modeling#outputs)). Parts lists, robot links, STEP validation properties and fit checks read them.
Units are MMGS: volume in mm³, mass in g, centroid in mm, inertia in g·mm², density in g/cm³.

The kernel never fills the solid with small cubes. It turns each volume integral into an integral over the boundary, and
then into sums along edges or over face domains. This page goes through those steps and shows where each one is exact.
Each figure plays its steps as you reach it. Use **Play**/**Pause**, the arrows or a step's number to go through it at
your own pace.

## Ten integrals make all of it

Every method ends with the same ten numbers, each an integral over the body's volume:

V = ∫dV, ∫x dV, ∫y dV, ∫z dV, ∫x² dV, ∫y² dV, ∫z² dV, ∫xy dV, ∫xz dV, ∫yz dV

`solidMassFromIntegrals` makes the result from them (`src/brep/solid-mass.ts`):

- **Centroid**: c = (∫x, ∫y, ∫z) / V.
- **Mass**: m = ρ V × 10⁻³ g, with ρ in g/cm³ (1 g/cm³ is 10⁻³ g/mm³).
- **Moments about the centroid**, by the parallel-axis theorem: xx = ∫x² − V c<sub>x</sub>², xy = ∫xy − V c<sub>x</sub> c<sub>y</sub>,
  and so on.
- **Inertia tensor**, with k = ρ × 10⁻³: I<sub>xx</sub> = k (yy + zz), I<sub>yy</sub> = k (xx + zz), I<sub>zz</sub> = k (xx + yy).
  The products of inertia are stored with their minus sign: I<sub>xy</sub> = −k xy.

A density that is not positive and finite is refused, and so is a body whose V is not positive.

## From the volume to its boundary

The divergence theorem says that the integral of div F over a volume equals the flux of F out through its boundary:
∭ div F dV = ∯ F · n dA. Choose F so that div F is the integrand you want. The kernel uses one field per integral, the
same on every face:

| Integral | Field F | Integral | Field F |
|---|---|---|---|
| V | (x, 0, 0) | ∫x² | (x³/3, 0, 0) |
| ∫x | (x²/2, 0, 0) | ∫y² | (0, y³/3, 0) |
| ∫y | (0, y²/2, 0) | ∫z² | (0, 0, z³/3) |
| ∫z | (0, 0, z²/2) | ∫xy | (x²y/2, 0, 0) |
| | | ∫xz, ∫yz | (x²z/2, 0, 0), (0, y²z/2, 0) |

So the body's ten integrals are sums of the faces' fluxes. The kernel takes them about the centre of the box of the
surfaces' control points and then moves them back to the origin. A face's small integration error is then not magnified
by the body's distance from the origin.

What the kernel does on each face depends on what the face is:

- **A planar face**: Green's theorem in its plane turns the face integral into a walk along its edges. Each edge is its
  exact curve, so a disc's rim is a circle, not its chords. The kernel takes 12 Gauss points a knot span along each edge
  and 4 across.
- **A curved face that is its whole patch**: a grid of Gauss points over the patch's (u, v) domain.
- **Any other curved face**: Gauss points over its display triangles, in its (u, v) domain.

Bodies of planar faces with straight edges, and mesh bodies, skip all this. They are split into tetrahedra from the
body's centre, one for each triangle of each face, and each tetrahedron's integrals have a closed form.

## Upright bodies: a section times its height

An upright (Z-prismatic) body is a stack of slabs, each one 2D section raised from z₀ to z₁. Its integrals need no
surface at all. Green's theorem gives the section's six area moments from a walk round its rings (`regionMoments`), and
each slab multiplies them by what z adds. `prismaticMassProperties` reports the result as `closed-form`.

<MassGreen />

## Revolved bodies: Pappus

A revolved body is a section turned about an axis by an angle α. In the half-plane through the axis, write h for the
distance along the axis and ρ for the distance from it. A small area dA of the section sweeps a volume ρ dφ dA as it
turns. The integrals over φ from 0 to α have closed forms, so only the section's moments ∬ hᵐ ρᵏ dA remain. Green's
theorem gives these, with 8 Gauss points on each line and on each piece of an arc (pieces of at most 1/16 turn).

The volume is Pappus's theorem: α times the section's first moment about the axis, V = α ∬ ρ dA = α A ρ̄. A ring section
of radii 10 to 20 mm and length 30 mm, turned a full turn, gives 28274.333882308132 mm³; π (20² − 10²) × 30 is
28274.333882308136. `revolveMassProperties` (`src/features/revolve.ts`) reports `closed-form`, and also handles a section
with holes.

Other features carry their own mass function too:

- **Swept bodies**: a sweep made of straight and bent pieces that meet only at their cross-sections adds its pieces' closed
  forms (`combineMassProperties`: each piece's tensor turned by R I Rᵀ and moved to the common centroid). Pieces that
  overlap go through the B-rep instead.
- **Ruled lofts**: their own Gauss rule, 3 points across each span and 24 along its edges, reported as `quadrature`.
- **Shelled revolves**: the hollow's closed form subtracted from the body's.
- **Moved copies**: their source's properties, turned and moved.

## Curved faces: Gauss–Legendre

An n-point Gauss–Legendre rule samples the integrand at n special points and adds the samples with weights. It is exact
for every polynomial of degree up to 2n − 1. A NURBS patch is a polynomial on each knot span, or a ratio of two, so the
kernel always integrates one span at a time.

<MassGauss />

A face is its **whole patch** when it has one loop, every edge lies on the patch's four sides and the loop is as long as
those sides. Each edge is sampled at nine points, each within 10⁻⁷ of the surface's size of a side, or within the edge's
own tolerance. The two lengths are measured as 64-segment polylines and must agree to 10⁻³. Such a face takes
min(20, ⌈5p/2⌉) points a direction in each span, 8 more for a rational patch, with the derivatives from the basis
functions. A polynomial patch then comes out exact to rounding.

Any other curved face (a **trimmed face**) is integrated over its display triangles in (u, v):

- **Mapped points**: each of a triangle's 16 points is mapped through the surface itself, so the result carries no chord
  error.
- **Knot lines**: each triangle is cut along the surface's knot lines first, so no rule spans a break between two
  polynomial pieces (D167).
- **Strips**: where a trim is not straight in (u, v), the thin strip between the triangles' chord and the trim is
  integrated on its own with 8 × 4 Gauss points. A narrow ribbon then closes the gap from the surface out to the edge's
  own curve, which lies off the surface by its fit (D177).
- **Checks**: each face's area is compared with its flat triangles' to 5 % (with a finer measure where a triangle spans a
  wide turn). Its vector area ∫ n dA must agree with the one its edges give, ½ ∮ x × dx, to 5 % of its area. If a strip
  had to be left out, that limit is 10⁻⁹. A face that fails sends the body to the tessellated route below. A sliver
  smaller than 10⁻⁶ of the body's box diagonal squared is taken by its flat triangles instead.

What is left of the error depends on the triangles, so the kernel runs at 8 and at 16 segments a quarter and
extrapolates. With the strips integrated, the error falls with the cube of the step, so the estimate is (8 F₁₆ − F₈)/7.
Faces beside a surface's pole keep an error that falls with its square, so for them it is (4 F₁₆ − F₈)/3. Faces
integrated exactly give the same value at both steps.

## Which method is reported

`massPropertiesOf(output, density)` refuses a sheet body (it encloses no volume). For any other body it takes the first
of these that applies:

| Case | Method | `method` |
|---|---|---|
| The feature carries its own mass (revolve, sweep, loft, shell of a revolve, moved copy) | its closed form or rule | `closed-form` or `quadrature` |
| An upright body | `prismaticMassProperties` | `closed-form` |
| Any other body | `brepMassProperties` with 32 segments a quarter for a fallback | below |

`brepMassProperties(brep, density, options)` tries, in order:

| Case | Method | `method` |
|---|---|---|
| Every face a facet patch, or planar with straight edges | tetrahedra from the centre, exact | `planar-exact` |
| Any face of degree above 1 in u or v, and `quadratureSegments` (8 by default) not 0 | quadrature over the exact surfaces, as above | `quadrature` |
| Otherwise, no curved face | tetrahedra over the tessellation, exact for planes | `planar-exact` |
| Otherwise | tetrahedra over the tessellation (`segmentsPerQuarter`, 64 by default) | `tessellated` |

A `tessellated` result carries `volumeBound`: the change in volume from a mesh of half the segments. The chord error falls
with the square of the step, so this is some three times the error itself (D200). `brepSurfaceArea` reads the same
quadrature run.

## Principal axes and other axes

The tensor depends on the frame it is written in. Turned to its principal axes, it is diagonal: the products of inertia
vanish, and the diagonal holds the principal moments. Finding that frame is a 3 × 3 symmetric eigenproblem.

<MassInertia />

Mass properties hold the tensor about the centroid, not its principal axes. The axes are computed where they are needed:

- **`symmetricEigen3`** (`src/features/section-properties.ts`) runs cyclic Jacobi sweeps. It stops when the off-diagonal's
  square is below 10⁻³⁰ of the diagonal's, or after 50 sweeps. It returns the values in ascending order and the unit
  vectors as columns. Robot links use it for their principal inertia, and flag a tensor that is not positive definite or
  whose moments break the triangle inequality (`packages/barocss-cad-model/src/robot/inertia.ts`).
- **`polygonSectionProperties`** gives a straight-edged plane section's area, centroid and second moments by Green's
  theorem. Its principal moments come in closed form: I₁,₂ = m ± r, with m = (I<sub>xx</sub> + I<sub>yy</sub>)/2 and
  r = √(((I<sub>xx</sub> − I<sub>yy</sub>)/2)² + I<sub>xy</sub>²). I₁'s axis is at ½ atan2(−2 I<sub>xy</sub>, I<sub>xx</sub> − I<sub>yy</sub>).

The moment about any other line is `momentOfInertiaAboutAxis(props, { point, direction })` (`src/brep/axis-inertia.ts`):
uᵀ I u + m ‖d × u‖², with u the unit direction and d = c − point
([Moment of inertia about an axis](/packages/cad/modeling#moment-of-inertia-about-an-axis)).

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad/src/brep/solid-mass.ts` | `brepMassProperties`, `prismaticMassProperties`, `solidMassFromIntegrals`, `combineMassProperties`, `brepSurfaceArea`; polyhedral and mesh tetrahedra; the Richardson step |
| `packages/barocss-cad/src/brep/brep-mass-quadrature.ts` | `brepQuadratureIntegrals`: the fields, planar faces by Green, whole patches by tensor Gauss, trimmed faces by the 16-point rule with knot-line cuts, strips and ribbons, and the checks |
| `packages/barocss-cad/src/core/quadrature.ts` | `gauss(n)`: Gauss–Legendre nodes and weights on [0, 1] by Newton's method on Pₙ |
| `packages/barocss-cad/src/brep/curved-arrangement.ts` | `regionMoments`: a section's six area moments by Green's theorem |
| `packages/barocss-cad/src/features/revolve.ts` | `revolveMassProperties`: revolved bodies in closed form |
| `packages/barocss-cad/src/features/loft.ts` | a ruled loft's mass by its own Gauss rule |
| `packages/barocss-cad/src/part/part-model.ts` | `massPropertiesOf`: which method a part's output takes |
| `packages/barocss-cad/src/brep/axis-inertia.ts` | `momentOfInertiaAboutAxis`: the parallel-axis query |
| `packages/barocss-cad/src/features/section-properties.ts` | `polygonSectionProperties`, `symmetricEigen3` (cyclic Jacobi) |

## How it is checked

| Test | What it covers |
|---|---|
| `packages/barocss-cad/test/mass-polyhedral.test.mjs` | mesh and straight-edged bodies against tetrahedra over their triangles (`planar-exact`); blocks with holes and L prisms against closed forms; a cylinder by `quadrature` |
| `packages/barocss-cad/test/analytic-boolean.test.mjs` | a whole cylinder wall by tensor Gauss to 10⁻¹¹, and the same wall integrated as trimmed after a union |
| `packages/barocss-cad/test/frk-8b.test.mjs` | a sphere's cap against its closed form and a sphere cut by a cylinder against an independent Gauss–Legendre; a bevel gear pair within 10⁻⁵ of its oracles, the same at 8, 16 and 32 segments a quarter, no strip dropped |
| `packages/barocss-cad/test/mass-pole-cap.test.mjs`, `mass-pole-steps.test.mjs`, `mass-pole-trims.test.mjs` | faces that reach a surface's pole |
| `packages/barocss-cad/test/mass-tessellated-bound.test.mjs` | the `tessellated` route states its volume's error, and the error lies within it (D200) |
| `packages/barocss-cad/test/frk-4-revolve.test.mjs` | revolved tubes with bores: volume, centroid and all nine inertia entries against independent closed forms |
| `packages/barocss-cad/test/sweep-mass-overlap.test.mjs` | a sweep whose bends overlap, and one whose pieces do not, against closed forms |
| `packages/barocss-cad/test/k5-section-eigen-volume.test.mjs` | section properties against closed forms; `symmetricEigen3` on random symmetric matrices (AV = VΛ, VᵀV = I, ascending) |
| `packages/barocss-cad/test/axis-inertia.test.mjs` | `momentOfInertiaAboutAxis`: COM axes, oblique and shifted axes, refusals |
| `packages/barocss-cad-model/test/robot-inertia.test.ts` | robot link inertia: a rotated cuboid to 10⁻¹², parallel-axis sums, the positive-definite and triangle checks, the eigen-solver on random symmetric matrices |
| `apps/library-docs/samples/cad-mmgs.test.mjs` | a 10 mm cube at 2.7 g/cm³: 1000 mm³, 2.7 g, centroid (5, 5, 5), 45 g·mm² on the diagonal |

## Limits

- **One density.** A call takes one density for the whole body.
- **Closed bodies only.** A sheet (an open mesh) has no volume and is refused.
- **Trimmed faces.** These keep a small error along trims that are not straight in (u, v), and the extrapolation takes
  most of it away. A face whose checks fail sends the body to the `tessellated` route. That route states its error in
  `volumeBound`.
- **Pieces.** Combined pieces add up only when they meet in faces. Overlapping sweep pieces go through a Boolean and the
  B-rep route.
- **Principal axes.** Mass properties carry no principal axes. `momentOfInertiaAboutAxis` checks only that its central
  term is not negative. It does not check that the tensor is symmetric or positive definite.
