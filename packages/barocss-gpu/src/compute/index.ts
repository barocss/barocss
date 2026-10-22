/**
 * EXPERIMENTAL (G25): GPU compute for analyses — the kernel's triangle hierarchy packed for WGSL, with a CPU mirror of its
 * queries. It may change without a version bump; no docs page yet.
 */
export { BVH_NODE_WORDS, BVH_STACK, BVH_TRIANGLE_WORDS, f32Down, f32Up, packBvh, packedNearestDistance2, packedRayHit, type PackedBvh } from './bvhPack.js';
