import { KernelError } from '../core/barocss-error.js';
import { unsupportedNativeMass } from '../internal/native-si-mass-state.js';
import { buildCylindricalWrapClosedReference } from './cylindrical-wrap-closed-reference.js';
const BUDGETS = Object.freeze({ volume: 1e-8, mass: 1e-10,
    centroid: Object.freeze([1e-10, 1e-10, 1e-10]),
    inertia: Object.freeze([1e-7, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7]) });
function refused(error, fail) {
    if (!(error instanceof KernelError))
        throw error;
    const code = error.code === 'INPUT' ? 'INPUT' : error.code === 'SUPPORT' || error.code === 'BUDGET' ? 'CAPABILITY' : 'GEOMETRY';
    return fail(code, `cylindrical wrap: ${error.message}`);
}
/** The reference union has MMGS error audits, but no native SI-order accuracy proof. */
function publicReferenceMass(properties) {
    return Object.freeze(unsupportedNativeMass({ ...properties }, 'combined'));
}
/** Only this fresh evaluation owns a provider. A serialized report supplies no mass authority. */
export function cylindricalWrapFeature(source, face, rectangle, height, id, fail) {
    const components = [{ outer: [[rectangle.u[0], rectangle.v[0]], [rectangle.u[1], rectangle.v[0]], [rectangle.u[1], rectangle.v[1]], [rectangle.u[0], rectangle.v[1]]], holes: [] }];
    let initial;
    try {
        initial = buildCylindricalWrapClosedReference(source, components, { id, height, density: 1, budgets: BUDGETS });
    }
    catch (error) {
        return refused(error, fail);
    }
    const reference = initial.walls.reference, assembly = reference.native.assembly;
    if (assembly.proof.sourceName !== face)
        fail('CAPABILITY', 'cylindrical wrap requires the exact original positive-Y wall name; its first native quarter has U in (0, 0.5)');
    const ownedSource = { solid: { kind: 'upright', solid: reference.formal.source.prismatic }, brep: reference.formal.source.brep };
    const ownedComponents = assembly.proof.components;
    const report = Object.freeze({ authority: 'closed-original-radial-reference', coordinates: 'original-native-uv-first-positive-y-quarter',
        sourceFace: face, rectangle: reference.rectangle, height, factor: 2, tolerance: initial.closure.tolerance,
        closedReferenceCertified: true, nativeFaceAssociationCertified: true, literalStoredBrepClosureCertified: false,
        literalStoredBrepMass: false, nativeSIAccuracy: false, massRequiresLiveProvider: true });
    const initialMass = publicReferenceMass(initial.mass.properties);
    const mass = (density) => {
        if (density === 1)
            return initialMass;
        try {
            return publicReferenceMass(buildCylindricalWrapClosedReference(ownedSource, ownedComponents, { id, height, density, budgets: BUDGETS }).mass.properties);
        }
        catch (error) {
            return refused(error, fail);
        }
    };
    return { solid: { kind: 'brep', brep: assembly.brep }, brep: assembly.brep, mass, cylindricalWrap: report };
}
