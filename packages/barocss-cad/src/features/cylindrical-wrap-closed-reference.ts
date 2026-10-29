import type { Part } from '../part/part-model.js';
import type { CylindricalWrapAssemblyComponent } from './cylindrical-wrap-assembly.js';
import { buildCylindricalWrapSharedReference, type CylindricalWrapBoundReferenceOptions } from './cylindrical-wrap-bound-reference.js';
import { continueCylindricalWrapReferenceWalls } from './cylindrical-wrap-source-walls.js';
import { ReferenceProofContext, freezeReferenceProof } from './cylindrical-wrap-reference-context.js';
import { certifyOriginalReferenceCaps, certifyWrappedReferenceClosure } from './cylindrical-wrap-reference-closure.js';
import { certifyClosedReferenceMass } from './cylindrical-wrap-reference-mass.js';

/** Fresh one-pad construction. Reference closure/mass never imply literal rounded-face coincidence. */
export function buildCylindricalWrapClosedReference(part: Part, components: readonly CylindricalWrapAssemblyComponent[], options: CylindricalWrapBoundReferenceOptions) {
  const walls = continueCylindricalWrapReferenceWalls(buildCylindricalWrapSharedReference(part, components, options));
  const ctx = new ReferenceProofContext(walls.counts, walls.limits.exactOperations); ctx.structure(128);
  const caps = certifyOriginalReferenceCaps(walls, ctx), closure = certifyWrappedReferenceClosure(walls, caps, ctx), mass = certifyClosedReferenceMass(walls, ctx);
  const result = { walls, closure, mass, limits: walls.limits, meaning: {
    closedReferenceCertified: true as const, nativeFaceAssociationCertified: true as const, referenceMassCertified: true as const,
    literalStoredBrepClosureCertified: false as const, literalStoredBrepMass: false as const, partMassProvider: false as const, productFeature: false as const,
  }, solidQualified: false as const };
  freezeReferenceProof(result, ctx); ctx.check();
  return Object.freeze({ ...result, counts: Object.freeze(ctx.counts()) });
}
