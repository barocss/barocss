import type { Body } from '../../packages/barocss-physics/src/types.js';
/** Geometry only. No world, cache, response, projection or mutable caller reference. */
export declare function featureContact(a: Body, b: Body): import("./contact-types.js").ContactGeometry | null;
