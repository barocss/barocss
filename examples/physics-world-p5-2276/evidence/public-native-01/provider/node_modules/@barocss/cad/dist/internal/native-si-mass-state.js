const bases = new WeakMap();
const results = new WeakMap();
/** Retain values already computed by the public integral path; do not integrate or change the public object. */
export function recordIntegralMass(props, density, central) {
    bases.set(props, { kind: 'integrals', density, central: Object.freeze([...central]) });
}
/** A metadata-only wrapper (volumeBound) retains the same tensor and basis. */
export function transferNativeMassBasis(from, to) {
    const basis = bases.get(from);
    if (basis)
        bases.set(to, basis);
}
/** Derived mass needs its own SI-order proof; never infer its raw moments from rounded MMGS data. */
export function unsupportedNativeMass(props, reason) {
    bases.set(props, { kind: 'unsupported', reason });
    return props;
}
/** Lookup only. A copy or worker clone has no provenance. No geometry or public mass API is called. */
export function readNativeSIInertia(props) {
    const cached = results.get(props);
    if (cached)
        return cached;
    const basis = bases.get(props);
    if (!basis || basis.kind === 'unsupported')
        return { ok: false, code: 'NATIVE_SI_PROVENANCE_UNAVAILABLE', reason: basis?.reason ?? 'untracked' };
    const [xx, yy, zz, xy, xz, yz] = basis.central;
    // Preserve the former kg/m³ coefficient and its application order before the MMGS rounding step.
    const k = (basis.density * 1000) * 1e-15;
    const inertia = Object.freeze([
        Object.freeze([k * (yy + zz), -k * xy, -k * xz]),
        Object.freeze([-k * xy, k * (xx + zz), -k * yz]),
        Object.freeze([-k * xz, -k * yz, k * (xx + yy)]),
    ]);
    const result = Object.freeze({ ok: true, inertia, density: basis.density });
    results.set(props, result);
    return result;
}
