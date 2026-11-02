# G1d reference review

READY_FOR_PARENT_FREEZE. Static review only. Runtime, resources, World,
recorder, build and numerical PASS are NOT_RUN by this reviewer.

| Reviewed source | SHA-256 |
| --- | --- |
| reference-integration.py | 8c99eba97ef421fee676b12ec55d453d746b0a6f024ea74c882c27c4ccce7762 |
| CONTRACT.md | 36c1c1ca616d652419a524296412afe337849323c4f989adb704d532898e1e3a |
| ../physics-rigid-rotation-g1c-2276/reference-frame.py | 91966d1e3d2fc3cabea2156dd670463faf70af811f05aecbf32d182e20590d19 |

No remaining mathematical blocker was found for the two named finite leaves.
The final harness, complete dependency pins, syntax and parent execution freeze
remain separate checks. A changed reference hash requires review of its delta.

## Principal load and expiry

The frozen-pair backcheck fixes the actual native geometry, mass and dt.
Independent volume monomial integrals give the physical Izz. The reference
does not substitute the rounded parser moment for that physical inertia.
Exact commands are Jz=1/64 and tauz=1/8, with zero initial spin. Thus:

    L* = Jz + tauz*dt
    omega* = L*/Izz
    theta_n = n*dt*omega*, n=1,2
    E* = L*^2/(2*Izz)

The command packet contains two step command arrays. Step 2 must be empty.
The reference compares loaded momentum and energy to L* and E*, rather than
asserting conservation against the zero pre-load state. Applied work is
reported as E*-E0 and observed E1-E0. Step-1-to-step-2 momentum and energy
drift have separate assertions and report fields. The harness must also retain
its exact step-2/step-1 spin-word check. These are principal-axis kick/free
semantics; they establish no off-axis torque integration order.

The full-angle matrix is the proper positive z rotation. Its quaternion is
[0,0,sin(theta_n/2),cos(theta_n/2)]. Both angles use n times the recorded
binary64 dt as an exact rational; there is no nominal-decimal time oracle.
For n=1,2 this also matches the representable public time labels exactly.

## Fixed rational trigonometry

Each sine/cosine evaluation sums exactly 20 terms. For 0<=x<=1/8, term
magnitudes decrease to zero. The code checks their nonnegative decrease.
Term 19 is subtracted and term 20 is positive, so [S20,S20+term20] encloses
the exact value. The recurrence denominators match sine and cosine indices.
Negating a sine interval reverses its endpoints. Full angles form R;
half angles form q. No quaternion sign branch is changed.

Both loaded states require ordered intervals of width <=1e-24 and the
unchanged R/omega/q endpoint gate. Eight new rational trigonometric
enclosures are counted per K packet. No Decimal, numerical ODE, square root
or library trigonometry is called. The imported geometry utility contains
definitions and metadata initialization, with no top-level physical audit.

## Recorded general flow

R uses the exact frozen off-axis input. Step n selects the authenticated
bank-80/120 endpoint 2*n: endpoint 02 for one dt120, endpoint 04 for two.
The code checks the saved window, Taylor order 32 and complete residual
degree 64. Both precisions retain width <=1e-24, enclosure intersection and
the existing endpoint accuracy gates. Initial/returned physical quantities
use the independent integral inertia and homogeneous proper quaternion R.

Restoration replays step 1 and continues step 2. Equality of reconstructed
states and logs is deterministic ownership/reconstruction evidence. It adds
no independent physical sample, new ODE window or new range qualification.
Actual recorder ownership, F03 rollback, hidden replay counts and cleanup
remain harness obligations; this reference review is not their runtime proof.

## Gates and accounting

Momentum and energy gates retain e+e*max(1,abs(expected),abs(observed)),
e=1e-12. Free drift uses the same rule with the prior accepted state.
Squared quaternion norm remains 1e-12. R/omega/q use
1e-11+1e-12*abs(reference endpoint). Zero translation, COM/linear behavior
and empty contact/joint/domain outputs remain checked. No tolerance changes.

Binary Fraction arithmetic and absolute values use the shared counted
wrappers. Powers in volume integrals use counted repeated multiplication.
Each packet performs nine new monomial integrals and audits two endpoints;
four successful Source/Native packets therefore mean 36 new monomial
integrals, eight endpoint state audits and 16 rational trig enclosures.
Paid validated bank work remains provenance, not new integration.

The new local retained-root traversal includes tuples and their Fraction
endpoints, unlike the historical utility's container traversal. It also counts
Fraction/string/Path identities. Passing audit locals includes initial R/L/E,
current and prior observables, expected values, both retained precision targets,
work/drift reports and raw/decoded packets. Its 1 MiB transient allowance is
inside the unchanged 8 MiB cap; the 8,192-object traversal limit stays active.
For this fixed plant, K angle operands have fewer than 200 bits; degree-41
terms need fewer than 9,000 bits and binary temporaries fewer than 18,000.
The finite series, bounded row parsing and <=64 KiB output fit this reserved
scratch allowance. Actual traversal/byte/time results must still pass the run.

Whole admitted range, other orientations/scales, off-axis loads, contacts,
joints, motors, projection, domain recording and canonical product adoption
remain NOT_RUN or HOLD. Preserve all original failures. READY; STOP.
