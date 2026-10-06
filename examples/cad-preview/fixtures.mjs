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

// Construction source is explicitly v1; native coordinates stay in their source axes.
const constructionCamera = { eye: [4,3,6], target: [0,0,0], up: [0,1,0], fovYDegrees: 45, near: 0.01, far: 100 };
export const constructionFixtures = [
  { id: 'wall', label: 'Construction v1 · extruded rational arc', sourceVersion: 1, source: `@model extruded_arc {
  version: 1;
  length-unit: mm;
  @curve #arc {
    type: nurbs;
    degree: 2;
    knots: [0,0,0,1,1,1];
    control-points: [[10,0,0],[10,10,0],[0,10,0]];
    weights: [1,0.7071067811865476,1];
  }
  @extrude #wall {
    curve: #arc;
    vector: [0,0,30];
  }
}`,
    countU: 17, countV: 9, options: { ...options([-0.5,-0.5,-1.5], [0.2,0.75,0.9]), camera: constructionCamera } },
  { id: 'oblique_wall', label: 'Construction v1 · asymmetric oblique extrusion', sourceVersion: 1, source: `@model extruded_asymmetric {
  version: 1;
  length-unit: mm;
  /* Forward reference; native geometry stays in declaration order. */
  @extrude #oblique_wall {
    curve: #polyline;
    vector: [3,-2,7];
  }
  @curve #polyline {
    type: nurbs;
    degree: 1;
    knots: [2,2,3,7,7];
    control-points: [[1,2,3],[5,7,-1],[12,3,4]];
    weights: [1,2,0.5];
  }
}`,
    countU: 17, countV: 9, options: { ...options([-0.75,-0.35,-0.5], [0.9,0.55,0.2]), camera: constructionCamera } },
];
export function vectorEdit(source) {
  if (source.includes('@extrude #wall')) return source.replace('vector: [0,0,30]', 'vector: [0,0,40]');
  if (source.includes('@extrude #oblique_wall')) return source.replace('vector: [3,-2,7]', 'vector: [5,-3,10]');
  throw new RangeError('This source has no construction-vector edit fixture');
}
export function constructionWeightEdit(source) {
  if (source.includes('@curve #arc')) return source.replace('weights: [1,0.7071067811865476,1]', 'weights: [1,0.2,1]');
  if (source.includes('@curve #polyline')) return source.replace('weights: [1,2,0.5]', 'weights: [1,3,0.5]');
  throw new RangeError('This source has no construction-weight edit fixture');
}

// Two surfaces and their native curves remain explicit and independently selectable.
const multiConstruction = `@model multi_construction {
 version: 1; length-unit: mm;
 @curve #arc { type: nurbs; degree: 2; knots: [0,0,0,1,1,1];
  control-points: [[10,0,0],[10,10,0],[0,10,0]]; weights: [1,0.7071067811865476,1]; }
 @curve #polyline { type: nurbs; degree: 1; knots: [2,2,3,7,7];
  control-points: [[1,2,3],[5,7,-1],[12,3,4]]; weights: [1,2,0.5]; }
 @extrude #wall { curve: #arc; vector: [0,0,30]; }
 @extrude #oblique_wall { curve: #polyline; vector: [3,-2,7]; }
}`;
const multiNative = `@model multi_native {
 version: 0; length-unit: mm;
 @curve #arc { type: nurbs; degree: 2; knots: [0,0,0,1,1,1];
  control-points: [[10,0,0],[10,10,0],[0,10,0]]; weights: [1,0.7071067811865476,1]; }
 @curve #polyline { type: nurbs; degree: 1; knots: [2,2,3,7,7];
  control-points: [[1,2,3],[5,7,-1],[12,3,4]]; weights: [1,2,0.5]; }
 @surface #wall { type: nurbs; degree-u: 2; degree-v: 1;
  knots-u: [0,0,0,1,1,1]; knots-v: [0,0,1,1];
  control-points: [[[10,0,0],[10,0,30]],[[10,10,0],[10,10,30]],[[0,10,0],[0,10,30]]];
  weights: [[1,1],[0.7071067811865476,0.7071067811865476],[1,1]]; }
 @surface #oblique_wall { type: nurbs; degree-u: 1; degree-v: 1;
  knots-u: [2,2,3,7,7]; knots-v: [0,0,1,1];
  control-points: [[[1,2,3],[4,0,10]],[[5,7,-1],[8,5,6]],[[12,3,4],[15,1,11]]];
  weights: [[1,1],[2,2],[0.5,0.5]]; }
}`;
export const objectFixtures = [
 {selectorId:'multi_native',id:'wall',label:'Objects · native v0 · two surfaces',source:multiNative,
  countU:17,countV:9,options:{...options([-0.75,-0.5,-1.5],[0.2,0.75,0.9]),camera:constructionCamera}},
 {selectorId:'multi_construction',id:'wall',label:'Objects · construction v1 · two surfaces',sourceVersion:1,source:multiConstruction,
  countU:17,countV:9,options:{...options([-0.75,-0.5,-1.5],[0.2,0.75,0.9]),camera:constructionCamera}},
];

export const parameterFixture = {
 selectorId:'shared_parameters',id:'wall',label:'Parameters · shared input and unused curve',sourceVersion:1,
 source:`@model shared_parameters {
 version: 1; length-unit: mm;
 @extrude #wall { curve: #arc; vector: [0,0,30]; }
 @curve #unused { type: nurbs; degree: 1; knots: [-2,-2,3,3];
  control-points: [[-0,0.0000001,0],[2,3,4]]; weights: [2,0.5]; }
 @curve #arc { type: nurbs; degree: 2; knots: [0,0,0,1,1,1];
  control-points: [[10,0,0],[10,10,0],[0,10,0]]; weights: [1,0.7071067811865476,1]; }
 @extrude #second_wall { curve: #arc; vector: [3,0,15]; }
}`,countU:17,countV:9,options:{...options([-0.5,-0.5,-1.5],[0.2,0.75,0.9]),camera:constructionCamera},
};
