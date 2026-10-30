import { KernelError } from '../core/barocss-error.js';
import { unsupportedNativeMass } from '../internal/native-si-mass-state.js';
import type { MassProperties } from '../brep/solid-mass.js';
import type { CadPartErrorCode, Part } from '../part/part-model.js';
import type { FormalPadBudgets, FormalPadRectangle } from './cylindrical-wrap-formal-mass.js';
import { buildCylindricalWrapClosedReference } from './cylindrical-wrap-closed-reference.js';

/** A bounded reference feature. The stored surfaces approximate this closed reference. */
export interface CylindricalWrapReport {
  readonly authority: 'closed-original-radial-reference';
  readonly coordinates: 'original-native-uv-first-positive-y-quarter';
  readonly sourceFace: string;
  readonly rectangle: FormalPadRectangle;
  readonly height: number;
  readonly factor: 2;
  readonly tolerance: number;
  readonly closedReferenceCertified: true;
  readonly nativeFaceAssociationCertified: true;
  readonly literalStoredBrepClosureCertified: false;
  readonly literalStoredBrepMass: false;
  readonly nativeSIAccuracy: false;
  readonly massRequiresLiveProvider: true;
}
type Fail = (code: CadPartErrorCode, detail: string) => never;
const BUDGETS: FormalPadBudgets = Object.freeze({ volume: 1e-8, mass: 1e-10,
  centroid: Object.freeze([1e-10, 1e-10, 1e-10] as const),
  inertia: Object.freeze([1e-7, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7] as const) });
function refused(error: unknown, fail: Fail): never {
  if (!(error instanceof KernelError)) throw error;
  const code = error.code === 'INPUT' ? 'INPUT' : error.code === 'SUPPORT' || error.code === 'BUDGET' ? 'CAPABILITY' : 'GEOMETRY';
  return fail(code, `cylindrical wrap: ${error.message}`);
}
/** The reference union has MMGS error audits, but no native SI-order accuracy proof. */
function publicReferenceMass(properties: MassProperties): MassProperties {
  return Object.freeze(unsupportedNativeMass({ ...properties }, 'combined'));
}
/** Only this fresh evaluation owns a provider. A serialized report supplies no mass authority. */
export function cylindricalWrapFeature(source: Part, face: string, rectangle: FormalPadRectangle, height: number, id: string, fail: Fail): Part {
  const components = [{ outer: [[rectangle.u[0], rectangle.v[0]], [rectangle.u[1], rectangle.v[0]], [rectangle.u[1], rectangle.v[1]], [rectangle.u[0], rectangle.v[1]]] as [number, number][], holes: [] }];
  let initial: ReturnType<typeof buildCylindricalWrapClosedReference>;
  try { initial = buildCylindricalWrapClosedReference(source, components, { id, height, density: 1, budgets: BUDGETS }); }
  catch (error) { return refused(error, fail); }
  const reference = initial.walls.reference, assembly = reference.native.assembly;
  if (assembly.proof.sourceName !== face) fail('CAPABILITY', 'cylindrical wrap requires the exact original positive-Y wall name; its first native quarter has U in (0, 0.5)');
  const ownedSource = { solid: { kind: 'upright' as const, solid: reference.formal.source.prismatic }, brep: reference.formal.source.brep };
  const ownedComponents = assembly.proof.components;
  const report: CylindricalWrapReport = Object.freeze({ authority: 'closed-original-radial-reference', coordinates: 'original-native-uv-first-positive-y-quarter',
    sourceFace: face, rectangle: reference.rectangle, height, factor: 2, tolerance: initial.closure.tolerance,
    closedReferenceCertified: true, nativeFaceAssociationCertified: true, literalStoredBrepClosureCertified: false,
    literalStoredBrepMass: false, nativeSIAccuracy: false, massRequiresLiveProvider: true });
  const initialMass = publicReferenceMass(initial.mass.properties);
  const mass = (density: number): MassProperties => {
    if (density === 1) return initialMass;
    try { return publicReferenceMass(buildCylindricalWrapClosedReference(ownedSource, ownedComponents, { id, height, density, budgets: BUDGETS }).mass.properties); }
    catch (error) { return refused(error, fail); }
  };
  return { solid: { kind: 'brep', brep: assembly.brep }, brep: assembly.brep, mass, cylindricalWrap: report };
}
