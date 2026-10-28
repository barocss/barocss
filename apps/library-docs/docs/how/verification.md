<script setup>
import VerifyFuzz from '../.vitepress/components/algorithms/VerifyFuzz.vue';
import VerifyPrint from '../.vitepress/components/algorithms/VerifyPrint.vue';
import VerifyDiff from '../.vitepress/components/algorithms/VerifyDiff.vue';
</script>

# How results are checked

A kernel result is a body of thousands of numbers. A test that runs the kernel again and compares it with itself proves
only that it repeats. Each check on this page compares a result with something else: a value worked out by hand, a
program that shares no code with the kernel, a tool written by others, a relation that must hold, or an earlier build.

[How it is verified](/reference/verification) lists the suites, the commands and the external readers. This page
explains the techniques behind them, with real cases from the repository. The figures play their steps as you reach
them. Use **Play**/**Pause**, the arrows or a step's number to go through them at your own pace.

## The checks at a glance

| Check | What a result is compared with | Run by |
|---|---|---|
| Conformance cases | expected volume, centroid, bodies, topology and face names, each with a tolerance | `test/conformance.test.mjs` |
| Exact oracles | volumes integrated in closed form or by exact slices | `scripts/rb/oracle-*.mjs`, the property "exact oracles" |
| External readers | the readings of ezdxf, MuJoCo, usd-core and `check_urdf`, committed as data | `test/dxf-writer.test.mjs`, the robot tests |
| Properties | relations a correct kernel keeps, such as \|A ∪ B\| + \|A ∩ B\| = \|A\| + \|B\| | `scripts/rb/props.mjs` |
| The fuzz | random Boolean trees, measured by a ray oracle with no kernel code | `scripts/rb/fuzz.mjs` |
| Commutativity | A ∪ B against B ∪ A, A ∩ B against B ∩ A | `scripts/rb/commute.mjs` |
| Fingerprints | the whole result of the build before a change, to the bit | `scripts/perf-bench.mjs`, `scripts/r5-fingerprint.mjs` |
| Shape records | the counts, volume and centroid of the build before a change | `scripts/perf-bench.mjs shape-compare` |
| Differential runs | a shortcut's answer against the full test's, on every call | runs recorded in the commits |

Under all of them is one requirement: every result passes the strict check of
[What makes a B-rep valid](/how/validity).

Paths are under `packages/barocss-cad/` unless they say otherwise.

## 1. A conformance case

A conformance case is a JSON file: an input part document and the outputs any correct kernel must give. It holds the
expected values, their tolerances and where the values came from. Here is `conformance/r2/cylinder-block-union.json`,
shortened (`…`):

```json
{
  "id": "r2-cylinder-block-union",
  "about": "A Ø10 × 10 cylinder with a 4 × 4 block rising through its top: volume 250π + 64.",
  "input": { "partDocument": { "format": "barocss-cad-part", "features": [ … ] } },
  "expect": { "outputs": [{
    "volume": { "value": 849.3981633974482, "relTol": 1e-8 },
    "centroid": { "value": [0, 0, 5.527432268287556], "absTol": 0.000001 },
    "bodies": 1,
    "topology": [{ "shells": 1, "genus": 0 }],
    "faceNames": ["c.bottom", "c.side0", "c.top", "t.side0", "t.side1", "t.side2", "t.side3", "t.top"]
  }] },
  "oracle": "closed form"
}
```

The values are worked out by hand. The cylinder has volume π·5²·10 = 250π. The block runs from z = 8 to 14, so the
part above the cylinder's top is 4 × 4 × 4 = 64. The centroid's height is the volume-weighted mean of the two parts'
heights: (250π · 5 + 64 · 12) / (250π + 64) = 5.52743…. The built kernel gives 849.398163397448, 2.3 × 10⁻¹³ mm³ below
it: two units in the last place.

`test/conformance.test.mjs` runs every case through the built kernel. For each output it requires:

- the strict check to pass (`checkOutput`);
- the volume within max(relTol × |value|, absTol), and each centroid coordinate within absTol;
- the body count, and each body's closed shells and genus;
- the distinct face names, with the `#k` numbering removed and sorted. Face and edge counts are not compared, since
  kernels may split faces differently.

Optional keys check more: the surface area, a watertight tessellation (every mesh edge used exactly twice, by
position), a STEP round trip (strictly valid, with volume and area kept to relTol), sheet-metal bends and flat
patterns, structural members, SubD bounds, fits and cut lists. A case can instead expect a refusal: the error's code,
its category and part of its message.

There are 269 case files directly in the step folders. Six are superseded by a later step and kept as the record of
what their step promised; they are not run. 74 of the rest expect a refusal. Folder-shaped cases (DXF drawings, robot
exports) live in other step folders and have tests of their own.

The `oracle` field says where the expected values came from: a closed form, an independent tool, or this kernel. A
value from this kernel is marked so. It catches a change, but it is not evidence that the value is right.

## 2. Oracles that share no code with the kernel

An *oracle* is anything that gives the expected answer by another route. The kernel's checks use three kinds.

**Exact integrals.** `scripts/rb/oracle-cylinder-pair.mjs` integrates two crossed cylinders by parallel slices,
∫ 4√(a² − t²)√(b² − t²) dt / sin α. `scripts/rb/oracle-cylinder-box.mjs` integrates a cylinder against a turned box,
exactly across and by Gauss–Legendre along, between the kinks. The cases they build are in `robustness/corpus/oracle/`
and `conformance/rb4-oracle/`. Volumes must match to 10⁻⁶ relative, with a floor of 10⁻¹² mm³ (`VOLUME_TOL` in
`scripts/rb/oracle-cases.mjs`).

**The ray oracle.** It is used by the fuzz; see section 3.

**Tools written by others.** Exports are read back by programs the kernel does not depend on. Each is run by hand
outside the product, in a test environment of its own. Its reading is committed beside the case as
`oracle.<tool>.json`, and a test compares the reading with the studio's numbers. The repository holds 29 such files.

| Format | Reader (script that runs it) | Reading committed | Compared by |
|---|---|---|---|
| DXF | ezdxf (`scripts/dxf-oracle.py`, `dxf-underlay-oracle.py`) | `conformance/r11b/<case>/oracle.<version>.json`; also `r12/flat-dxf`, `r14/tables`, `a6/underlay` | `test/dxf-writer.test.mjs`: a clean audit; every entity, layer, line type, unit, text and coordinate (to 10⁻⁹) found in the reading; the file reproduced byte for byte. Also `test/r12-2.test.mjs` (flat patterns), and in `packages/barocss-cad-model/test/` `drawing-table.test.ts` and `dxf-underlay.test.ts` |
| MJCF | MuJoCo 3.3.0 (`scripts/mjcf-oracle.py`) | `conformance/rm/<case>/oracle.mujoco-3.3.0.json` | `apps/cad-studio/test/robot-mjcf.test.ts`: masses, frames and gravity torques to 10⁻⁶; a passive hang keeping its energy to 10⁻⁴; a damped hang settling |
| URDF | MuJoCo 3.3.0 (`scripts/urdf-oracle.py`); urdfdom's `check_urdf` | `rm/urdf-2r`, `rm/urdf-gears`; `rm/arm-6r/frames/oracle.check_urdf.json` | `apps/cad-studio/test/robot-urdf.test.ts` (to 10⁻⁶); `packages/barocss-cad-model/test/robot-frames.test.ts` |
| USD | usd-core 26.8 and UsdPhysics' parser (`scripts/usd-oracle.py`) | `conformance/rm/<case>/oracle.usd-core-26.8.json` | `packages/barocss-cad-model/test/robot-sdf-usd.test.ts` |

Committing the reading as data keeps the tests runnable anywhere, with no install. A deliberate change re-makes the
exported files and runs the readers again. When the faster stitch of D283 changed the last digits of exported points,
ezdxf, usd-core and MuJoCo were run again on the new files.

## 3. Properties and the fuzz

A property test needs no expected value: it checks a relation that holds for any correct answer.
`scripts/rb/property.mjs` has its own small harness. A seeded generator (mulberry32) draws the cases, so a seed always
gives the same ones. A failure is shrunk: each smaller candidate that still fails replaces it, until none does. The
twelve properties include:

- inclusion–exclusion, |A ∪ B| + |A ∩ B| = |A| + |B|, and |A − B| + |A ∩ B| = |A|;
- commutativity of the volume of ∪ and ∩;
- rigid motions that are exact in binary64 (quarter turns, power-of-two moves) keep the volume; a uniform scale s
  multiplies it by s³;
- knot insertion and degree elevation of a curved face keep its mass;
- a fillet's volume falls as its radius grows, and no faster than its edges allow;
- fillets against closed-form sections and Pappus, and the exact oracles above;
- mass by quadrature agrees with mass from finer and finer tessellations.
- names keep their meaning along a chain of bosses and pockets: a face the next feature does not come near keeps its
  name, area and centre (added after D282; on the build before D282 it fails at once, a boss's lower and upper wall
  halves trading `#1` and `#2`).

`pnpm rb:props` runs about 200 cases a property with seed 20261018. Known failures are listed in
`robustness/properties-todo.json` (empty now), and any other failure exits 1.

The fuzz goes further. It draws whole Boolean trees and measures each with an oracle that has no kernel code: rays
along z, each leaf's exact intervals along a ray, combined by the tree.

<VerifyFuzz />

Each finding is shrunk to its smallest tree that keeps its status (at most 80 steps). With `--save` it is written to
`robustness/corpus/fuzz/` as a replayable case holding the oracle's values; 37 are there now, and the robustness runner
(`pnpm rb`) runs them from then on. The fuzz judges only a tree's root. `scripts/rb/commute.mjs` judges every union
and intersection node of the same trees, in both orders: at the end of K16, 2,456 nodes gave SAME 2,418,
BOTH-REFUSED 37 and ONE-SIDED 1 (one order builds, the other refuses; listed in `robustness/commute-todo.json`).
None were DIFFER (both built, volumes apart), EMPTY-SIDED or BROKEN (D276).

## 4. Showing that a change changes nothing

A speed-up should give the same results. How strictly "the same" is checked depends on what the change may alter. The
methods below are from the performance work of 2026-10-27/28
(`apps/cad-studio/handover/notes/report-kernel-performance-2026-10-28.md` §3).

**Fingerprint.** A change that should alter nothing is checked bit for bit. `scripts/perf-bench.mjs` hashes each
workload's whole result with sha256 and compares the digest with the old build's. **Shape record.** A change judged
within tolerance cannot keep every bit. It compares validity and counts exactly, and volume and centroid to a bound.

<VerifyPrint />

| Record | Compares | Use |
|---|---|---|
| Fingerprint (`perf-bench.mjs save`, `compare`) | sha256 of the result's JSON, its first 16 hex digits | pure refactors |
| Shape record (`shape-save`, `shape-compare`) | validity, bodies, faces, edges, vertices exactly; volume to 10⁻⁷ relative; centroid to 10⁻⁵ mm; for a hidden-line projection, its lines, pieces, visible pieces and names | changes judged within tolerance |
| Corpus fingerprint (`r5-fingerprint.mjs`) | per case: validity, F/E/V, area and mass as float64 hex, a sha256 of the tessellation; refusals by name, code and message; one sha256 over all | refactors across the whole corpus |
| Determinism (`test/determinism.test.mjs`, D101) | each model alone, after the others and again: the same B-rep to the bit | no state outliving an evaluation |

In the report's series of commits (`de8463047` … `b3485b5e9`), every step except D281 left every bench result
bit-identical. D281 changed face names on purpose, and the later D283 changed the order of records and their last
digits on purpose. For both the shape record was compared instead, and every shape stayed the same.

**Differential run.** A shortcut skips work when it can tell the answer in advance. Before it is trusted, the
shortcut and the full test both run on every call of the real workloads, and their disagreements are counted.

<VerifyDiff />

| Shortcut | Calls compared | Disagreements |
|---|---|---|
| A ray hit outside the region's box is out | 217,861 skips | 0, after the box was made from the region |
| Point-in-region reads only rings whose box holds the point | 85,085 locations, 106,100 rings culled | 0 |
| A piece's interior point found only when asked for | 23,482 | 0 |
| One shared own-data copier for 18 + 26 copies | 20,020 generated inputs | 0 (refusals unchanged) |
| Vertex grids read only neighbour cells that can hold a match | 360,000 points crowded at cell sides | 0 |
| Two cuts lying along each other answered by their run's ends | all 212 such pairs on the workloads | 0 (the old search found the same points) |

## 5. The strict check under all of it

The checks above all assume a result is a valid solid, and each requires it. `checkOutput` runs `checkBrep` with
`strict: true` on a part's output and keeps the report. The conformance test, the fuzz worker, the robustness runner
and the corpus fingerprint all call it. The analytic Boolean's stitch checks every result's topology and refuses a
non-manifold one. Where a surface only touches another, or a sliver collapsed, it runs the strict check too; a body
that fails it is rebuilt without the re-judged pieces or refused. What the strict check asks is on [What makes a B-rep valid](/how/validity).

## Where it is in the code

| File | Responsibility |
|---|---|
| `conformance/<step>/*.json`, `conformance/README.md` | the cases and their format |
| `test/conformance.test.mjs` | every case against the built kernel |
| `scripts/rb/run.mjs`, `scripts/rb/stages.mjs` | the robustness runner: each case in its own worker under a kill timeout; validate, measure, tessellate, round trip, classify |
| `scripts/rb/property.mjs`, `scripts/rb/props.mjs` | the property harness (seeded generator, shrinking) and the properties |
| `scripts/rb/oracle-cylinder-pair.mjs`, `oracle-cylinder-box.mjs`, `oracle-cases.mjs` | the exact-integral oracles and their cases |
| `scripts/rb/fuzz-gen.mjs` | seeded random trees, their part documents, smaller trees for shrinking |
| `scripts/rb/fuzz-oracle.mjs` | the ray oracle: leaves' exact intervals, the interval algebra, the turned lattice and its shifts |
| `scripts/rb/fuzz.mjs`, `fuzz-worker.mjs` | the worker pool, judging, confirming, shrinking, saving |
| `scripts/rb/commute.mjs` | A op B against B op A over the fuzz's trees |
| `scripts/dxf-oracle.py`, `mjcf-oracle.py`, `urdf-oracle.py`, `usd-oracle.py`, `frames-oracle.py` | the external readers, run by hand |
| `scripts/perf-bench.mjs` | bench workloads, their times, fingerprints and shape records |
| `scripts/r5-fingerprint.mjs` | one digest over the whole corpus and two fuzz seeds |
| `src/part/part-model.ts` (`checkOutput`) | the strict check on an output, kept once made |

## How it is checked

The checkers are tested too:

- `test/fuzz-oracle.test.mjs` holds the ray oracle to closed forms within its own error: a ball, a frustum
  πh/3 (r₁² + r₁r₂ + r₂²), a rounded box wdh − 4(1 − π/4)r²h, shelled boxes closed and open, a box less a cylinder with
  its centroid, and a pattern of two overlapping boxes. It caught two oracle defects before the first fuzz run counted
  (D188).
- `test/property.test.mjs` checks that a seed repeats its cases and that a failing property shrinks to its smallest
  counterexample, then runs five cases of each kernel property.
- `test/determinism.test.mjs` evaluates eight models in order, in reverse and again, and requires the same B-rep to
  the bit.
- `test/fuzz-k14-findings.test.mjs`, `fuzz-k15-findings.test.mjs`, `fuzz-k16-findings.test.mjs` and
  `commute-k16-findings.test.mjs` pin the fixed fuzz and commutativity findings against the oracle.
- `test/boolean-boss-row.test.mjs` pins what the shape record found in D282: 8 bosses on a rounded plate add 6 edges
  and 4 vertices each, and the first boss's face name stays put.
- The external readings are compared by `test/dxf-writer.test.mjs`, `apps/cad-studio/test/robot-mjcf.test.ts`,
  `apps/cad-studio/test/robot-urdf.test.ts`, `packages/barocss-cad-model/test/robot-sdf-usd.test.ts` and
  `packages/barocss-cad-model/test/robot-frames.test.ts`.

## Limits

- **Values from this kernel.** A conformance value marked as this kernel's catches a change, not an error that was
  there when it was recorded.
- **The ray oracle has an error of its own.** Its bound e is statistical. A WRONG verdict is confirmed at 4n and 8
  shifts first, and a tessellated mass off by more than the bound but within the bound it states is counted as
  APPROX, not as a finding.
- **The fuzz draws only its own leaves.** These are boxes, cylinders, spheres, cones, rounded and shelled boxes, with
  Booleans and patterns. It does not draw fillets between leaves, sweeps, lofts or imported bodies.
- **External readers are run by hand.** A reading is as current as its last run, and must be run again after a
  deliberate change to the export. SDF is not yet read back by an external validator.
- **A fingerprint says only "same" or "not".** It cannot say how far apart two results are. The bench keeps 64 bits
  of the digest. The corpus digest changes whenever behaviour changes on purpose, so there is no fixed value to check
  against.
- **A shape record does not see order or bytes.** D283 kept every shape but changed the order of edges and vertices.
  A test that picked an edge by its place in the list, and byte-frozen exports, changed with it. Order and bytes are
  checked by those tests, not by the shape record.
- **Differential runs are not committed scripts.** The counts above are recorded in the commits (`8cfd1608f` and
  others) and the performance report. The harness that counted them was written for each change.
