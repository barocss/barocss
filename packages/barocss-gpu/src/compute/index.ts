/**
 * EXPERIMENTAL (G25): GPU compute for analyses — the kernel's triangle hierarchy packed for WGSL, with a CPU mirror of its
 * queries. It may change without a version bump; no docs page yet.
 */
export { BVH_NODE_WORDS, BVH_STACK, BVH_TRIANGLE_WORDS, f32Down, f32Up, packBvh, packedNearestDistance2, packedRayHit, type PackedBvh } from './bvhPack.js';
export { WALL_THICKNESS_WGSL, cpuWallThickness, gpuWallThickness, wallRays, type WallRays, type WallThickness } from './thickness.js';
export { runCompute, type ComputeDevice, type ComputeJob } from './dispatch.js';
export { BVH_WGSL, NO_SKIP } from './bvhWgsl.js';
export { ACCESS_DIRECTIONS, ACCESS_WGSL, accessByTriangle, accessSampleSet, cpuAccessMasks, gpuAccessMasks, type AccessSamples } from './access.js';
