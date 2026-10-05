// Coordinates below are authored canonical millimetres, not a GPU rotation.
const cylinder = `@model visible_cylinder {
  version: 0; length-unit: mm;
  @surface #cylinder {
    type: nurbs; degree-u: 2; degree-v: 1;
    knots-u: [0,0,0,1,1,1]; knots-v: [0,0,1,1];
    control-points: [[[10,0,0],[10,30,0]],[[10,0,-10],[10,30,-10]],[[0,0,-10],[0,30,-10]]];
    weights: [[1,1],[0.7071067811865476,0.7071067811865476],[1,1]];
  }
}`;
const flat = `@model asymmetric_plane {
  version: 0; length-unit: mm;
  @surface #flat_patch {
    type: nurbs; degree-u: 1; degree-v: 1;
    knots-u: [-2,-2,3,3]; knots-v: [4,4,6,6];
    control-points: [[[1,2,2],[2,9,2]],[[7,3,2],[8,10,2]]];
    weights: [[1,1],[1,1]];
  }
}`;
const weighted = `@model rational_patch {
  version: 0; length-unit: mm;
  @surface #weighted_patch {
    type: nurbs; degree-u: 1; degree-v: 1;
    knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[1,7,3]],[[9,2,4],[12,8,-2]]];
    weights: [[1,2],[3,4]];
  }
}`;
const options = (translate, color) => ({ mmToSceneUnit: 0.1, translate, color, background: [0.025, 0.035, 0.055] });
export const fixtures = [
  { id: 'cylinder', label: 'Quarter-cylinder · radius 10 mm, height 30 mm', source: cylinder,
    countU: 17, countV: 9, options: options([-0.5, -1.5, 0.5], [0.2, 0.75, 0.9]) },
  { id: 'flat_patch', label: 'Asymmetric plane · distinct U/V domains', source: flat,
    countU: 2, countV: 2, options: options([-0.45, -0.6, -0.2], [0.9, 0.55, 0.2]) },
  { id: 'weighted_patch', label: 'Rational nonplanar patch', source: weighted,
    countU: 17, countV: 17, options: options([-0.6, -0.4, 0], [0.7, 0.4, 0.9]) },
];
export const density = { coarse: { countU: 5, countV: 5 }, fine: { countU: 33, countV: 17 } };
export function controlPointEdit(source) {
  if (source.includes('#cylinder')) return source.replace('[10,30,0]', '[16,30,4]');
  if (source.includes('#flat_patch')) return source.replace('[8,10,2]', '[12,13,5]');
  if (source.includes('#weighted_patch')) return source.replace('[12,8,-2]', '[16,12,3]');
  throw new RangeError('No control-point edit is defined for this source');
}
export function weightEdit(source) {
  if (source.includes('#cylinder')) return source.replace('[0.7071067811865476,0.7071067811865476]', '[0.2,0.2]');
  if (source.includes('#weighted_patch')) return source.replace('[[1,2],[3,4]]', '[[5,2],[3,4]]');
  throw new RangeError('This source has no rational-weight edit fixture');
}
export function singularSource(source) {
  if (source.includes('#cylinder')) return source.replace(
    '[[[10,0,0],[10,30,0]],[[10,0,-10],[10,30,-10]],[[0,0,-10],[0,30,-10]]]',
    '[[[0,0,0],[0,0,0]],[[0,0,0],[0,0,0]],[[0,0,0],[0,0,0]]]');
  if (source.includes('#flat_patch')) return source.replace(
    '[[[1,2,2],[2,9,2]],[[7,3,2],[8,10,2]]]',
    '[[[0,0,0],[0,0,0]],[[0,0,0],[0,0,0]]]');
  if (source.includes('#weighted_patch')) return source.replace(
    '[[[0,0,0],[1,7,3]],[[9,2,4],[12,8,-2]]]',
    '[[[0,0,0],[0,0,0]],[[0,0,0],[0,0,0]]]');
  throw new RangeError('No singular-source control is defined for this source');
}
