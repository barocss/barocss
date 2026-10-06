import { decimal } from './parameters.mjs';
function data(input,keys){if(!input||typeof input!=='object'||Object.getPrototypeOf(input)!==Object.prototype)throw new TypeError('Use plain dimension data');const descriptors=Object.getOwnPropertyDescriptors(input);if(Reflect.ownKeys(descriptors).length!==keys.length)throw new TypeError('Missing or foreign dimension fields');const result={};for(const key of Reflect.ownKeys(descriptors)){if(typeof key!=='string'||!keys.includes(key)||!('value' in descriptors[key])||!descriptors[key].enumerable)throw new TypeError('Dimension fields must be own data');result[key]=descriptors[key].value;}return result;}
function dimension(value){if(typeof value!=='number'||!Number.isFinite(value)||value<1||value>300)throw new RangeError('Dimensions must be finite numbers in 1..300 mm');return value;}
export function dimensionUpdate(input){const result=data(input,['size','height']);return{size:dimension(result.size),height:dimension(result.height)};}
export function preparePrimitive(input){
 const request=data(input,['kind','size','height']);if(!['sheet','quarter-wall'].includes(request.kind))throw new RangeError('Choose Sheet or Quarter-cylinder wall');
 const size=dimension(request.size),height=dimension(request.height),arc=request.kind==='quarter-wall';
 const points=arc?`[[${decimal(size)},0,0],[${decimal(size)},${decimal(size)},0],[0,${decimal(size)},0]]`:`[[0,0,0],[${decimal(size)},0,0]]`;
 const source=`@model tool_${arc?'quarter_wall':'sheet'} {\n version: 1; length-unit: mm;\n @curve #profile { type: nurbs; degree: ${arc?2:1}; knots: ${arc?'[0,0,0,1,1,1]':'[0,0,1,1]'};\n  control-points: ${points}; weights: ${arc?`[1,${decimal(Math.SQRT1_2)},1]`:'[1,1]'}; }\n @extrude #surface { curve: #profile; vector: [0,0,${decimal(height)}]; }\n}\n`;
 return{kind:request.kind,size,height,source,surfaceId:'surface',inputId:'profile',countU:arc?17:2,countV:arc?9:2,
  options:{mmToSceneUnit:.01,translate:[-size*.005,arc?-size*.005:0,-height*.005],color:[.2,.75,.9],background:[.025,.035,.055],camera:{eye:[4,3,6],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100}}};
}
