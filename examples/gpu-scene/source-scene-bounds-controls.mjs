/** #1320 independent, hand-derived bounds controls.
 * Expected boxes use closed-form axis/quarter-turn examples, not a generic
 * eight-corner transform implementation. Original source comments and -0
 * spellings belong to the inputs. Canonical numeric zero follows the provider.
 * These are binary64 box observations, not certified rounding enclosures.
 */

const local = {
  orb: { min: [-2, -2, -2], max: [2, 2, 2] },
  brick: { min: [-1, -2, -3], max: [1, 2, 3] },
  column: { min: [-1.5, -2.5, -1.5], max: [1.5, 2.5, 1.5] },
  link: { min: [-2.5, -1.5, -.5], max: [3.5, 2.5, 4.5] },
  rounded: { min: [-1.5, -2.5, -3.5], max: [1.5, 2.5, 3.5] },
  ring: { min: [-3.5, -.5, -3.5], max: [3.5, .5, 3.5] },
};
const box = (min, max) => ({ min, max });
const object = (objectId, kind, localBounds, worldBounds) => ({ objectId, kind, localBounds, worldBounds });
const source1Objects = [
  object('orb', 'sphere', local.orb, box([-1, 0, 1], [3, 4, 5])),
  object('brick', 'box', local.brick, box([-5, 3, -9], [-3, 7, -3])),
  object('column', 'cylinder', local.column, box([4.5, -9.5, 6.5], [7.5, -4.5, 9.5])),
  object('link', 'capsule', local.link, box([-10.5, 7.5, -10.5], [-4.5, 11.5, -5.5])),
  object('rounded', 'rounded-box', local.rounded, box([8.5, -13.5, 8.5], [11.5, -8.5, 15.5])),
  object('ring', 'torus', local.ring, box([-15.5, 12.5, -17.5], [-8.5, 13.5, -10.5])),
];
const source2Objects = [
  object('orb', 'sphere', local.orb, box([-3, 1, 0], [5, 3, 6])),
  object('brick', 'box', local.brick, box([-6, 4, -10.5], [-2, 6, -1.5])),
  object('column', 'cylinder', local.column, box([5.25, -12, 5.75], [6.75, -2, 10.25])),
  object('link', 'capsule', local.link, box([-11.75, 8.25, -11], [-2.75, 10.25, -1])),
  object('rounded', 'rounded-box', local.rounded, box([8.875, -14.125, 6.75], [11.125, -7.875, 17.25])),
  object('ring', 'torus', local.ring, box([-13.75, 12, -19.25], [-10.25, 14, -8.75])),
];

function sixSource(version) {
  const scales = version === 2 ? {
    orb: 'scale: 2 .5 1.5;', brick: 'scale: 2 .5 1.5;',
    column: 'scale: .5 2 1.5;', link: 'scale: 1.5 .5 2;',
    rounded: 'scale: .75 1.25 1.5;', ring: 'scale: .5 2 1.5;',
  } : {};
  return `/* Original all-six axis controls. Full text and comments stay owned. */
@scene bounds_six_${version} {
  version: ${version}; background: #102030;
  sphere #orb; box #brick; cylinder #column;
  capsule #link; rounded-box #rounded; torus #ring;
}
#orb { radius: 2; translate: 1 2 3; rotate-x: -0deg; color: #336699; ${scales.orb ?? ''} }
#brick { size: 2 4 6; translate: -4 5 -6; color: #cc6633; ${scales.brick ?? ''} }
#column { radius: 1.5; height: 5; translate: 6 -7 8; color: #669933; ${scales.column ?? ''} }
#link { radius: .5; start: -2 -1 -0; end: 3 2 4; translate: -8 9 -10; color: #9933cc; ${scales.link ?? ''} }
#rounded { size: 3 5 7; radius: .75; translate: 10 -11 12; color: #33cccc; ${scales.rounded ?? ''} }
#ring { major-radius: 3; minor-radius: .5; translate: -12 13 -14; color: #cc3399; ${scales.ring ?? ''} }
`;
}
const source1 = sixSource(1), source2 = sixSource(2);
const expected = (objects, bounds) => ({ objects, bounds });
const request = (sourceVersion, source, objectIds) => ({ sourceVersion, source,
  ...(objectIds === undefined ? {} : { objectIds }) });
const oneSource = (version, name, kind, declarations) => `/* Original ${name}; no GPU or camera data. */\n@scene ${name} { version: ${version}; background: #102030; ${kind} #item; }\n#item { ${declarations} }\n`;

// Half extents after S are [2,1,4.5]. Z45 gives X/Y extents (2+1)/sqrt(2).
const diagonalExtent = 3 / Math.sqrt(2);
const obliqueSource = oneSource(2, 'bounds_oblique_box', 'box', 'size: 2 4 6; scale: 2 .5 1.5; rotate-x: -0deg; rotate-y: 0deg; rotate-z: 45deg; translate: 10 -20 30;');
const obliqueWorld = box([10 - diagonalExtent, -20 - diagonalExtent, 25.5], [10 + diagonalExtent, -20 + diagonalExtent, 34.5]);
// X90 then Y90 maps (x,y,z) to (y,-z,-x); reversing the order differs.
const composedSource = oneSource(2, 'bounds_noncommuting_rotation', 'box', 'size: 2 4 6; scale: 2 .5 1.5; rotate-x: 90deg; rotate-y: 90deg; rotate-z: -0deg; translate: 10 -20 30;');
const composedWorld = box([9, -24.5, 28], [11, -15.5, 32]);

// The local capsule box is [-2.5,-1.5,-.5]..[3.5,2.5,4.5].
// Z90 maps (x,y,z) to (-y,x,z), after the optional explicit scale.
const capsule1 = oneSource(1, 'bounds_capsule_quarter', 'capsule', 'radius: .5; start: -2 -1 -0; end: 3 2 4; rotate-z: 90deg; translate: 10 20 30;');
const capsule2 = oneSource(2, 'bounds_scaled_capsule_quarter', 'capsule', 'radius: .5; start: -2 -1 -0; end: 3 2 4; scale: 2 .5 1.5; rotate-z: 90deg; translate: 10 20 30;');
const capsuleWorld1 = box([7.5, 17.5, 29.5], [11.5, 23.5, 34.5]);
const capsuleWorld2 = box([8.75, 15, 29.25], [10.75, 27, 36.75]);

// X90 maps (x,y,z) to (x,-z,y). Torus outer X/Z radius is 3+.5.
const torus1 = oneSource(1, 'bounds_torus_quarter', 'torus', 'major-radius: 3; minor-radius: .5; rotate-x: 90deg; translate: -10 20 -30;');
const torus2 = oneSource(2, 'bounds_scaled_torus_quarter', 'torus', 'major-radius: 3; minor-radius: .5; scale: 2 .5 1.5; rotate-x: 90deg; translate: -10 20 -30;');
const torusWorld1 = box([-13.5, 16.5, -30.5], [-6.5, 23.5, -29.5]);
const torusWorld2 = box([-17, 14.75, -30.25], [-3, 25.25, -29.75]);

// Bounds transform the enclosing cube, not the tight extrema of a sphere.
const sphereExtent = 2 * Math.sqrt(2);
const rotatedSphere = oneSource(1, 'bounds_rotated_sphere_box', 'sphere', 'radius: 2; rotate-z: 45deg; translate: -0 0 0;');
const sphereWorld = box([-sphereExtent, -sphereExtent, -2], [sphereExtent, sphereExtent, 2]);

// Each radius-one sphere is translated to [i,0,0], so each X interval is i +/- 1.
const names32 = Array.from({ length: 32 }, (_, index) => 's' + index);
const source32 = `/* Exactly 32 original objects; exactly 256 transformed box corners. */\n@scene bounds_capacity { version: 1; ${names32.map(name => 'sphere #' + name + ';').join(' ')} }\nsphere { radius: 1; }\n${names32.map((name, index) => '#' + name + ' { translate: ' + index + ' -0 0; }').join('\n')}\n`;
const objects32 = names32.map((name, index) => object(name, 'sphere', box([-1, -1, -1], [1, 1, 1]), box([index - 1, -1, -1], [index + 1, 1, 1])));

// Legal Source2 original half sizes [500,400,300] * 100 exceed camera limits.
const largeSource = oneSource(2, 'bounds_large_affine', 'box', 'size: 1000 800 600; scale: 100 100 100; translate: 1000 -1000 1000;');
const largeLocal = box([-500, -400, -300], [500, 400, 300]);
const largeWorld = box([-49000, -41000, -29000], [51000, 39000, 31000]);

/** One controls module consumed by the single actual source/API/file flow. */
export const controls = [
  { name: 'source1_all_six_axis', request: request(1, source1), expected: expected(source1Objects, box([-15.5, -13.5, -17.5], [11.5, 13.5, 15.5])) },
  { name: 'source2_all_six_scaled_axis', request: request(2, source2), expected: expected(source2Objects, box([-13.75, -14.125, -19.25], [11.125, 14, 17.25])) },
  { name: 'source1_subset_original_order', request: request(1, source1, ['ring', 'orb', 'link']), expected: expected([source1Objects[0], source1Objects[3], source1Objects[5]], box([-15.5, 0, -17.5], [3, 13.5, 5])) },
  { name: 'source2_subset_original_order', request: request(2, source2, ['ring', 'orb', 'link']), expected: expected([source2Objects[0], source2Objects[3], source2Objects[5]], box([-13.75, 1, -19.25], [5, 14, 6])) },
  { name: 'source1_explicit_empty_selection', request: request(1, source1, []), expected: expected([], null) },
  { name: 'source2_explicit_empty_selection', request: request(2, source2, []), expected: expected([], null) },
  { name: 'source1_empty_original_scene', request: request(1, '/* Full original empty scene. */\n@scene empty_one { version: 1; background: #102030; }\n'), expected: expected([], null) },
  { name: 'source2_empty_original_scene', request: request(2, '/* Full original empty affine scene. */\n@scene empty_two { version: 2; background: #102030; }\n'), expected: expected([], null) },
  { name: 'source2_oblique_asymmetric_box', request: request(2, obliqueSource), expected: expected([object('item', 'box', local.brick, obliqueWorld)], obliqueWorld), tolerance: 1e-12 },
  { name: 'source2_noncommuting_xyz_rotation', request: request(2, composedSource), expected: expected([object('item', 'box', local.brick, composedWorld)], composedWorld), tolerance: 1e-12 },
  { name: 'source1_capsule_quarter_turn', request: request(1, capsule1), expected: expected([object('item', 'capsule', local.link, capsuleWorld1)], capsuleWorld1), tolerance: 1e-12 },
  { name: 'source2_capsule_scale_before_quarter_turn', request: request(2, capsule2), expected: expected([object('item', 'capsule', local.link, capsuleWorld2)], capsuleWorld2), tolerance: 1e-12 },
  { name: 'source1_torus_quarter_turn', request: request(1, torus1), expected: expected([object('item', 'torus', local.ring, torusWorld1)], torusWorld1), tolerance: 1e-12 },
  { name: 'source2_torus_scale_before_quarter_turn', request: request(2, torus2), expected: expected([object('item', 'torus', local.ring, torusWorld2)], torusWorld2), tolerance: 1e-12 },
  { name: 'source1_rotated_sphere_enclosing_box', request: request(1, rotatedSphere), expected: expected([object('item', 'sphere', local.orb, sphereWorld)], sphereWorld), tolerance: 1e-12 },
  { name: 'source1_32_objects_256_corners', request: request(1, source32), expected: expected(objects32, box([-1, -1, -1], [32, 1, 1])) },
  { name: 'source2_legal_extent_exceeds_camera_range', request: request(2, largeSource), expected: expected([object('item', 'box', largeLocal, largeWorld)], largeWorld) },
];
