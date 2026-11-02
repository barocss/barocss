import { type Brep } from '../brep/brep-core.js';
import type { Point } from '../types.js';
import { type TriangleBvh } from './triangle-bvh.js';
export type FacetPointClass = 'inside' | 'outside' | 'on';
/** The triangles of a facet body and the hierarchy over them (K2, D141: the kernel's one triangle hierarchy). */
export type FacetBvh = TriangleBvh;
/** The hierarchy over a facet body's triangles (made once per B-rep); refused unless every face is a facet face. */
export declare function facetBvh(brep: Brep): FacetBvh;
/**
 * Whether a point is inside, outside or on a facet body (all its faces facets), to `tolerance` (default 1e-9
 * of the body's size): three clean rays' parities vote; a point on a triangle is on the body.
 */
export declare function classifyPointInFacets(brep: Brep, point: Point | readonly number[], tolerance?: number): FacetPointClass;
