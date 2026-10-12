import { solveXYAffineSketch, buildXYAffineSketch, validateXYAffineSketch } from './xy-affine-sketch.js';
import { buildXYAffineSketchPrism, validateXYAffineSketchPrism, resolveXYAffineSketchPrismWall } from './xy-affine-sketch-prism.js';
import { validateConvexPlanarSolid } from './convex-planar-solid.js';
import { splitConvexPlanarSolid, validateConvexPlanarSolidSplit } from './convex-planar-solid-split.js';
import { intersectConvexPlanarSolids, validateConvexPlanarSolidIntersection } from './convex-planar-solid-intersection.js';
import { subtractConvexPlanarSlab, validateConvexPlanarSlabSubtraction } from './convex-planar-slab-subtraction.js';
import { chamferConvexPlanarSolid, validateConvexPlanarSolidChamfer } from './convex-planar-solid-chamfer.js';
import { measureConvexPlanarSolidMass, validateConvexPlanarSolidMass } from './convex-planar-solid-mass.js';
import { createCadDocument, parseCadDocument, serializeCadDocument, validateCadDocumentResult } from './cad-document.js';
import {
  evaluateXYAffinePrismFeatureDocumentV1, updateXYAffinePrismFeatureDocumentV1,
  parseXYAffinePrismFeatureDocumentV1, serializeXYAffinePrismFeatureDocumentV1,
  validateXYAffinePrismFeatureDocumentV1, validateXYAffinePrismFeatureDocumentUpdateV1,
} from './xy-affine-prism-feature-document.js';

/**
 * Concise, profile-qualified aliases for existing CAD APIs.
 *
 * Each leaf is the original function: signatures, overloads, units, result
 * ownership, diagnostics and refusal limits are unchanged. Only these namespace
 * records are frozen; caller data and provider functions are not frozen here.
 * Destructure a profile for short calls: `const { convex } = cad.solid`.
 */
export const cad = /* @__PURE__ */ Object.freeze({
  sketch: /* @__PURE__ */ Object.freeze({
    /** Exact affine constraints on XY line sketches in mm; not a general sketch solver. */
    affineXY: /* @__PURE__ */ Object.freeze({
      /** Return the original success/diagnostics union. */
      solve: solveXYAffineSketch,
      /** Build or throw the original XYAffineSketchError. */
      build: buildXYAffineSketch,
      validate: validateXYAffineSketch,
    }),
  }),
  solid: /* @__PURE__ */ Object.freeze({
    /** One 3..8-segment strictly convex XY cycle extruded along +Z, with explicit chart/options. */
    prismXY: /* @__PURE__ */ Object.freeze({
      build: buildXYAffineSketchPrism,
      validate: validateXYAffineSketchPrism,
      /** Resolve a source-qualified segment wall; preserve stale/deleted statuses. */
      wall: resolveXYAffineSketchPrismWall,
    }),
    /** Existing source-qualified closed convex planar Solids only; not arbitrary Solid operations. */
    convex: /* @__PURE__ */ Object.freeze({
      split: splitConvexPlanarSolid,
      intersect: intersectConvexPlanarSolids,
      /** Two selected opposite tool supports must define the admitted through slab. */
      subtractSlab: subtractConvexPlanarSlab,
      /** One source-qualified cardinal edge, equal physical distance on its two faces. */
      chamferCardinal: chamferConvexPlanarSolid,
      /** Explicit density in kg/m3 and fan-triangle budget; original exact mass profile. */
      mass: measureConvexPlanarSolidMass,
      validate: validateConvexPlanarSolid,
      validateSplit: validateConvexPlanarSolidSplit,
      validateIntersection: validateConvexPlanarSolidIntersection,
      validateSlab: validateConvexPlanarSlabSubtraction,
      validateChamfer: validateConvexPlanarSolidChamfer,
      validateMass: validateConvexPlanarSolidMass,
    }),
  }),
  document: /* @__PURE__ */ Object.freeze({
    /** Document format v1, source-version-0 curve/surface assets; not a Solid/feature document. */
    sourceV1: /* @__PURE__ */ Object.freeze({
      create: createCadDocument,
      parse: parseCadDocument,
      serialize: serializeCadDocument,
      validate: validateCadDocumentResult,
    }),
    /** Fixed-role XY prism feature document v1; optional chamfer is a sibling on the original parent prism. */
    prismV1: /* @__PURE__ */ Object.freeze({
      evaluate: evaluateXYAffinePrismFeatureDocumentV1,
      update: updateXYAffinePrismFeatureDocumentV1,
      parse: parseXYAffinePrismFeatureDocumentV1,
      serialize: serializeXYAffinePrismFeatureDocumentV1,
      validate: validateXYAffinePrismFeatureDocumentV1,
      validateUpdate: validateXYAffinePrismFeatureDocumentUpdateV1,
    }),
  }),
});
