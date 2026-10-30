# D307 guarded raw midpoint conversion — 2026-10-29

Runtime 5eea67247866f310c988e3625afd8ad1ca96d3ce changes only the10 raw fixed128 midpoint conversions in the private
D306 formal-reference helper. zCenter still uses generic q.nearest. Source, moment intervals,
public formulas, exact density, budgets/audits, native basis transfer and false flags remain
unchanged. No public export, physical mass provider or product wrap is added.

## Conversion and accounting

The exact midpoint is n/2^129, n=lo+hi. n=0 returns positive0. For nonzero guarded abs(n)<2^256,
Number(n) is nearest/ties-even and exact power2 scaling by2^-129 stays normal and finite in
[2^-129,2^127]. This maps the same binary64 lattice, ties parity and binade boundaries as
generic q.nearest; negative rounding is sign-symmetric. n=2^256-1 may round to2^256, so equality
at the upper Number endpoint is permitted. Inputs outside the proved range refuse instead
of relaxing precision. Every successful nonzero path charges12 logical direct primitives;
zero charges2. Existing q/direct/bit/work accounting stays on the same request ledger.

An independent source review finds no mathematical or accounting defect. The proof applies
to this fixed denominator and explicit magnitude range, not arbitrary rational conversion.
The new generic nearest regression covers all actual raw estimates for positive, negative
and centered-zero cases. Prior-build complete result bit records provide separate differential
evidence; same-build generic reference tests alone are not the before/after proof.

## Mandatory performance and full receipt preservation

The existing perf-bench has formal-pad-mass: fresh R10/H30/Z=-7,U[.1,.4]xV[.2,.7],density7.85,
with unchanged explicit volume/mass/centroid/inertia budgets. It times the complete source
and formal mass request and returns only its mass properties for the existing fingerprint.
RUNS7 median9ms before and9ms after; fingerprint4ee49b3a32aa9a46 stays equal. No stable speedup
or Studio latency improvement is established. Generic shape mode is not meaningful for this
mass-properties result and is not used. Actual source B-rep is included in the full receipt
bit comparison, while D305 already independently checks shape/native-position invariance.

Two full actual receipts encode every Number with all64 IEEE bits, preserving signed zero.
Only each result's final counts record is excluded. All source geometry, options, exact
interval/error strings, raw midpoint estimates, public properties and metadata/false flags
match the retained prior build. Hidden native SI basis is not separately serialized by this
record; the unchanged deterministic provider receives identical estimate/density Numbers and
retains the same transfer path. Existing SI basis availability/finite tests still pass; no
rigorous native SI accuracy claim is added.

Standard mass40919->33095 operations, work69733->60142, maximum bits1153->1123. Source11544
operations stays unchanged, so local cost is21551. The separate asymmetric density7.85 case
52029->40804 operations, work89192->75385. These are separate fixed requests. Even summing
standard native179831 with local21551 gives201382 before new closed-reference work; no
combined200k acceptance is inferred, no limit is raised and no hidden retry is added.

## Verification boundary

Node22.19.0 build/lint/code-shape pass. Focused25/25 passes (527.998834ms). Whole
kernel2155 total/2149 pass/0 fail/6 existing skips passes (248759.209709ms). Generated tools/
refusals/unchanged API SCOPED_PASS/docs68pages/53shots/4488KiB/852labels pass.

No new validation failure. D306's original missing-destination evidence failure stays in its
own record. Source checksum pins/dependencies/schema migrations are not added. Model/Studio/
types/browser are NOT RUN; latest whole consumers/types remain D299901b4ce45. Push/PR/release
NOT RUN. Actual global source, cap/whole-shell closure, reference-to-B-rep mass transfer and
product wrap remain open. Next D308 first measures whether family-only exact fixed128
recurrence work can be reduced without changing bounds or standalone receipts, then consumes
the source-global plan on the same complete request before Part/Model/API/Studio integration.
