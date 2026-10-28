<script setup>
import GearInvolute from '../.vitepress/components/algorithms/GearInvolute.vue';
import GearMesh from '../.vitepress/components/algorithms/GearMesh.vue';
import GearThread from '../.vitepress/components/algorithms/GearThread.vue';
</script>

# Threads, gears and springs

Gears, threads and springs are not drawn as sketches and extrusions. The kernel builds each one as a B-rep straight from
its defining geometry, in `packages/barocss-cad/src/machine/`: the involute of a circle for a gear tooth, the ISO profile
carried along a helix for a thread, a circle swept along a helix for a spring wire. The studio's Spur gear, Thread and Spring
commands and the part model's `gear`, `thread`, `face-thread` and `spring` features call these builders.

Two of these curves have no exact NURBS form: the involute and the helix. The kernel fits them with cubic pieces,
measures the fit's largest distance from the exact curve, and reports it. When the fit would need more pieces than its
budget, the builder refuses with PROFILE_BUDGET_EXCEEDED; it never loosens the tolerance (D129). Circles, arcs, planes and
the ruling of a band stay exact.

The figures play their steps as you reach them. Use **Play**/**Pause**, the arrows or a step's number to go at your own
pace; with reduced motion turned on in your system, each step is shown still. They run the kernel's formulas in the page
on the kernel's own test cases; each figure's note says what is computed and what is quoted from the built kernel.

## 1. The involute spur gear

A spur gear is set by its module m (mm of reference diameter per tooth), its number of teeth z, its pressure angle α
and its face width b. All lengths below are in millimetres (`spurGearDimensions`, `src/machine/gear.ts`).

| Quantity | Formula | Test gear: m 2, z 20 |
|---|---|---|
| Reference diameter d | m z | 40 |
| Base diameter d<sub>b</sub> | d cos α | 37.588 |
| Tip diameter d<sub>a</sub> | d + 2m + 2xm | 44 |
| Root diameter d<sub>f</sub> | d − 2.5m + 2xm | 35 |
| Tooth thickness s on d | πm/2 + 2xm tan α, less the thickness reduction | 3.1416 |
| Half thickness at radius r, as an angle | ψ(r) = s/d + inv α − inv φ(r), cos φ(r) = r<sub>b</sub>/r | ψ(r<sub>b</sub>) = 0.09344 |

Here x is the profile shift coefficient (the cutting rack moved out by x m, from −0.5 to 1) and inv φ = tan φ − φ. Only
α = 20° is built in this stage. The thickness reduction is this gear's share of a pair's backlash.

<GearInvolute />

The flank is the only fitted curve in the profile. Its pieces are C¹ Hermite cubics on the roll t, equally spaced, and
`flankDeviation` measures the largest distance from the involute along the circle at each radius, at 65 points a piece.
The default tolerance is 10<sup>−4</sup> m; the budget is five pieces, the most a side face takes (16 poles). The tip and
root arcs are exact rational quadratics, in spans of at most 90°.

Two roots are built:

| `rootPolicy` | Generator | Root | Report |
|---|---|---|---|
| `schematic-radial` (default) | `spur-gear@0` | A radial line from the base circle to the root circle when the root lies inside it, then a root arc | ROOT_TRANSITION_UNVALIDATED warning |
| `generated` | `spur-gear@1` | The envelope of the basic rack's tip round (ρ = 0.38 m by default), meeting the involute at the form circle (D130); at least 6 teeth | `generatedRoot`: form diameter, fillet pieces (up to 15) and their deviation |

With a schematic root, a gear with fewer teeth than z<sub>min</sub> = 2(1 − x)/sin²α (17.1 at 20°, unshifted) is refused
as undercut, naming the shift that would avoid it. A generated root cuts the undercut as the rack would: the involute is
trimmed where the tool's envelope crosses it, with an UNDERCUT warning.

A **helical** gear takes a normal module m<sub>n</sub>, a helix angle β (above 0, at most 45°) and a hand. Its transverse
section is a spur profile with m<sub>t</sub> = m<sub>n</sub> / cos β and tan α<sub>t</sub> = tan α<sub>n</sub> / cos β;
the section turns by z tan β / r as it rises (`helixTwist`). The turn is a cubic Hermite fit of the rotation e<sup>iθ</sup>,
exact at the piece ends, with at most four pieces in an axial segment and at most 64 segments; its deviation is measured
at the tip circle. For m<sub>n</sub> 2, z 20, β 15° right-hand and b 20, the built kernel reports a twist of 14.83° in one
segment of two pieces, 1.66 × 10<sup>−5</sup> mm off the exact turn.

## 2. Two gears in mesh

Two external gears mesh when their (normal) modules and pressure angles agree and, if helical, their helix angles are
equal and their hands opposite. Otherwise MATE_INCOMPATIBLE. Unshifted, the centre distance is a = m(z<sub>1</sub> +
z<sub>2</sub>)/2. Shifted, the working pressure angle solves inv α<sub>w</sub> = inv α + 2 tan α (x<sub>1</sub> +
x<sub>2</sub>)/(z<sub>1</sub> + z<sub>2</sub>) by Newton's method, and a = m(z<sub>1</sub> + z<sub>2</sub>) cos α / (2 cos
α<sub>w</sub>) (`workingDistance`).

<GearMesh />

`spurGearPairNominal` gives the formulas alone: centre distance, speed ratio −z<sub>1</sub>/z<sub>2</sub>, the ideal
contact ratio and the backlash as the sum of the thickness reductions. `checkSpurGearPair` adds what only geometry can
tell:

| Output | How |
|---|---|
| Working pressure angle, working pitch diameters | cos α<sub>w</sub> = a<sub>0</sub> cos α / a, d<sub>w1</sub> = 2a z<sub>1</sub>/(z<sub>1</sub> + z<sub>2</sub>) |
| Backlash | p<sub>w</sub> − s<sub>w1</sub> − s<sub>w2</sub> at the working pitch circle; negative when the teeth jam |
| Tip clearances | a − r<sub>a1</sub> − r<sub>f2</sub> and a − r<sub>a2</sub> − r<sub>f1</sub> |
| Usable contact ratio | the path of contact limited to where each flank's involute really starts (the base circle, the form circle, or an undercut's crossing) |
| Sweep | gear 1 through one tooth period at 64 and 128 positions, the two exact outlines (150 points a flank) measured near the mesh; the least clearance refined by golden-section search; `converged` when both scans agree within max(10<sup>−6</sup> m, 2 %) |

A crossing is SELF_INTERSECTION with its depth. A usable ratio below the ideal one is reported as a warning.
`checkPlacedSpurGears` takes two gears as they stand in a model, reads the centre distance and the relative phase from
their positions and turns, and requires their faces to overlap along the axis.

## 3. The other gears

Each kind has its own builder and its own pair check. All take α = 20° only.

| Kind | File | How the teeth are built |
|---|---|---|
| Internal (ring) | `gear-internal.ts` | The ring's tooth spaces are the teeth of a "space gear" (the shifted rack's gear at x<sub>2</sub> + 0.25); that profile is the ring's hole inside a plain rim, built directly, with no Boolean. Root: a schematic corner, or (`shaper-cut`) the envelope of a pinion-type cutter's tip round, fitted as the rack's. The pair check sweeps in the same sense and tests involute and trochoid interference and radial insertion. |
| Rack | `gear-rack.ts` | The basic rack itself: straight flanks at α, addendum m, dedendum 1.25 m; flanks, tips and roots are exact planes. A filleted root (radius 0.38 m) is an exact rational arc (an ellipse in a helical rack's transverse section); a helical rack slides its profile along the bar by z tan β, its flat faces still exact planes. |
| Straight bevel | `gear-bevel.ts` | On every sphere about the apex the tooth is the exact spherical involute of the base cone sin δ<sub>b</sub> = sin δ cos α. The flank is fitted as conic arcs to the involute's stereographic image, lifted back as rational degree-4 curves lying exactly on the sphere; the face is the cone through the apex over that curve. Tip and root are cones, the ends spheres. The only fitted part is the flank, its deviation measured at the heel. |
| Spiral bevel | `gear-bevel.ts` | The straight gear's spherical section, turned along the cone distance to follow a circular tooth trace; a cubic Hermite fit of that turn. An ideal conjugate pair, flagged IDEAL_MODEL: no face-milling or face-hobbing machine settings. |
| Worm | `gear-worm.ts` | ZI (an involute helicoid) or ZA (straight-sided in the axial section, an Archimedean spiral in the transverse one): the section's Hermite fit, twisted along the axis by the helical gear's rotation fit, 1–4 starts, lead angle at most 45°. Section and twist share the tolerance, three quarters and one quarter. |
| Worm wheel | `gear-worm.ts`, `gear-worm-wheel.ts` | Either a cylindrical helical gear at β = the worm's lead angle (point contact with a ZI worm), or a throated wheel for a ZA worm: in each plane square to the wheel's axis, the envelope of the worm's section in closed form; tip and root are exact tori; flanks and fillets are bicubic Hermite patches, their deviation measured plane by plane. |

## 4. Threads

`threadSolid` (`src/machine/thread-solid.ts`) builds a modelled ISO metric thread: a threaded rod, a hex head bolt (head
and threaded shank in one solid), or a hex nut with a threaded bore. It needs the pitch below half the diameter. The
profile is ISO 68-1's basic one (`isoThreadRadius`); the helical form is in `thread-helical.ts`.

<GearThread />

| Form | Surface | Names | Used by |
|---|---|---|---|
| `helical` (the default of `threadSolid`) | half-turn faces, degree (3, 1), ruled between cubic helices; quartic trim curves at the ends | `.thread#k`, `.end`, `.top`, `.seat`, `.head`, `.hex0`–`.hex5`, `.bottom` | the studio's modelled fasteners; `face-thread` |
| `faceted` | one closed mesh of flat facets, the helix sampled every 7.5° round and every P/12 along | `.facet<k>` | `thread` nodes in documents that name no form |

The faces' pieces are welded into shared vertices and edges with a tolerance of 10<sup>−7</sup> × the part's size, and
the solid is validated before it is returned. A nut's faces are turned over (its material is outside its bore), and its
thread is pushed out radially by a clearance, 0.04 mm by default (at least 0, below P/4).

The **`face-thread`** feature cuts such a thread on a picked cylindrical face of a part (`src/part/part-model.ts`):

| Face | What the feature does |
|---|---|
| A shaft | The shaft is cut down to a core of radius r − 0.8 P over the threaded length; a right-hand helical rod of the shaft's diameter is joined to it. A flat free end lets the thread run out; a shoulder, or a stop inside the face, leaves a relief groove (one pitch wide by default; zero is refused). |
| A hole (its tap drill) | The hole is filled over the length by a plug a pitch wider than the nominal radius, then the rod of the nominal diameter, with the nut's 0.04 mm clearance, is taken out; it runs a pitch past an end where the hole opens onto a face. |

A left-hand thread is the right-hand rod mirrored through a plane holding its axis. Each step checks its volume change
against the exact value it should have (to 10<sup>−7</sup> relative): material in the way is refused as
FACE_THREAD_NOT_CLEAR, a face that is not a whole cylinder between two end circles as FACE_THREAD_FACE.

## 5. Springs

`helicalSweep` (`src/machine/spring.ts`) sweeps a round wire of radius a along a helix-like centreline C(φ) = (R cos φ,
R sin φ, z(φ)). The pitch is constant on a run, or eases from one pitch to the next by a smoothstep in φ, so the wire
stays tangent-continuous. The section is the exact circle in the plane normal to C, on the frame e<sub>1</sub> toward
the axis and e<sub>2</sub> = T × e<sub>1</sub>.

A section point is affine in its (x, y), so each of the circle's four rational quarters is carried along φ by the paths
of its three control points. Each path is fitted with cubic Hermite pieces (exact value and derivative at the piece
ends). The surface's distance from the exact pipe is a weighted mean of the paths' errors, so the largest path error
bounds it: that is the reported deviation, held within 10<sup>−4</sup> d by default. A face is degree (2, 3) with at most
four pieces. The end discs and the level circles are exact.

For D 20, d 2, five active coils at pitch 6, open ends, the built kernel reports 112 pieces in 28 axial segments, a
deviation of 1.84 × 10<sup>−4</sup> mm (tolerance 2 × 10<sup>−4</sup>) and a wire 315.588 mm long.

| Spring | Ends |
|---|---|
| Compression, `open` | one run at the body's pitch |
| Compression, `closed` | a dead coil each end at the geometric solid pitch (the least pitch keeping neighbouring turns d apart), easing to the body's pitch over 90° by default |
| Compression, `closed-ground` | the closed spring cut square to the axis at the centreline's end heights by the analytic Boolean: faces `.ground0`, `.ground1` |
| Extension and torsion (`hookedSpring`) | the body close-wound at the solid pitch of a wire d + 2 × tolerance thick; hooks and legs from exact pipe pieces, straight (degree 2 × 1) and bent (the rational torus, degree 2 × 2), glued disc to disc |

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad/src/machine/gear.ts` | Spur and helical gears: `spurGearDimensions`, `spurGearProfile`, `flankPoles`, `flankDeviation`, the generated root (`rackRoot`, `filletPoint`), `extrudedProfile`, `helixTwist`; pairs: `spurGearPairNominal`, `checkSpurGearPair`, `exactProfile`, `checkPlacedSpurGears` |
| `packages/barocss-cad/src/machine/gear-internal.ts` | Internal (ring) gears, the shaper-cut root, the internal pair's checks |
| `packages/barocss-cad/src/machine/gear-rack.ts` | Racks, straight and helical, their filleted root, gear-and-rack checks |
| `packages/barocss-cad/src/machine/gear-bevel.ts` | Straight and spiral bevel gears on the sphere, their pair |
| `packages/barocss-cad/src/machine/gear-worm.ts` | ZI and ZA worms, the cylindrical wheel pair |
| `packages/barocss-cad/src/machine/gear-worm-wheel.ts` | The throated wheel of a ZA worm |
| `packages/barocss-cad/src/machine/thread-solid.ts` | `isoThreadRadius`, `threadSolid` (rod, bolt, nut), the faceted form |
| `packages/barocss-cad/src/machine/thread-helical.ts` | `helicalThreadSolid`: `helixRow`, `bandPolygon`, `cutSpan`, the end outlines, `assemble` |
| `packages/barocss-cad/src/machine/spring.ts` | `helicalSweep`, `compressionSpring`, `springSolidPitch`, `hookedSpring` |
| `packages/barocss-cad/src/part/part-model.ts` | The `face-thread` feature |
| `packages/barocss-cad/src/part/part-machine.ts` | The `thread`, `gear`, `spring` and other machine features of the part model |

## How it is checked

| Test | What it checks |
|---|---|
| `packages/barocss-cad/test/gear.test.mjs` | The test gear's d, d<sub>b</sub>, d<sub>a</sub>, d<sub>f</sub>, the pair's 60 mm and ε<sub>α</sub> 1.6351859636; the solid's volume against the exact profile's area (Green's theorem on the analytic involute) within what the measured deviation allows; fewer pieces for a looser tolerance and the five-piece refusal; the sweep's least clearance j cos α<sub>w</sub> / 2; KHK's shifted pair (α<sub>w</sub> 26.0886°, a 56.4999 mm); STEP round trip |
| `packages/barocss-cad/test/gear-generated-root.test.mjs`, `gear-generated-root-helical.test.mjs` | The rack's tool touches the generated profile and never goes in; the form circle by the textbook formula; undercut trimming; the volume from the envelope |
| `packages/barocss-cad/test/gear-helical.test.mjs` | The flanks turned along the helix within the measured twist fit; volume; refusals; a meshing helical pair in the part model |
| `packages/barocss-cad/test/gear-internal.test.mjs`, `gear-internal-shaper.test.mjs`, `gear-rack.test.mjs` | The ring's and the rack's volumes, their pair sweeps (j cos α / 2), interference conditions, meshing in the part model |
| `packages/barocss-cad/test/gear-bevel.test.mjs`, `gear-bevel-spiral.test.mjs`, `d150-bevel-pair.test.mjs` | The bevel gear's spherical construction, undercut by the exact spherical condition, the pair on the heel sphere |
| `packages/barocss-cad/test/gear-worm.test.mjs`, `gear-worm-wheel.test.mjs` | ZI and ZA worms, the wheel pairs, the throated wheel's envelope, refusals |
| `packages/barocss-cad/test/thread-solid.test.mjs` | The ISO 68-1 profile; rod, bolt and nut, faceted and helical, watertight and near the exact volume; STEP round trip; tessellation shared bit for bit at the corners |
| `packages/barocss-cad/test/face-thread.test.mjs`, `packages/barocss-cad-model/test/api-face-thread.test.ts` | Shafts with and without relief, tapped holes through and blind, any axis, the left hand as the mirror, refusals with their codes |
| `packages/barocss-cad/test/r12c-spring.test.mjs`, `r12c-hooked-spring.test.mjs` | V = πa² × centreline length, the distance from the centreline, each end type's free length, ground ends, hooks and legs, refusals |

## Limits

| Refused or approximate | Code |
|---|---|
| A pressure angle other than 20° (every gear kind) | UNSUPPORTED_GEAR_KIND |
| A profile shift outside −0.5 … 1 (spur), −0.5 … 0.75 (internal); an undercut tooth count with a schematic root | UNSUPPORTED_PROFILE_SHIFT |
| A fit needing more than its budget: 5 flank pieces, 15 fillet pieces, 64 twist segments (worms 128) | PROFILE_BUDGET_EXCEEDED |
| A tooth pointed below its tip, teeth meeting at the root | SELF_INTERSECTION |
| A bore leaving less than the rim (1 m by default) under the root circle; a geometric margin, not a strength check | BORE_INTERSECTION |
| Bevel: the Gleason system, shifts, hypoid offsets, crown and internal bevel gears; worms: ZN, ZK, ZC, globoid; throated wheels only for ZA worms | UNSUPPORTED_GEAR_KIND |
| Roots and profiles are geometry only: every gear report says `manufacturingValidated: false` | — |
| Threads: ISO metric basic profile only, right hand (a left hand by mirroring in `face-thread`); a pitch below half the diameter; a thread on mesh faces | RangeError, CAPABILITY |
| The helical thread's helices are cubic quarter circles: up to 2.7 × 10<sup>−4</sup> r outside the exact helix (1.1 µm on an M8) | — |
| Springs: round wire, cylindrical body; coils closer than the solid pitch; hooks or legs that come back onto the wire | INVALID_INPUT, UNSUPPORTED_SPRING_KIND, COILS_OVERLAP, LEG_OVERLAP |

The NURBS pieces these builders produce are ordinary B-spline data; see [NURBS curves and surfaces](/how/nurbs). A
`face-thread` joins or cuts with the [curved Boolean](/how/boolean).
