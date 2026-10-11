const PINS = [
  {
    "file": "edited.actual-model5.source0.css",
    "bytes": 1906,
    "sha256": "fe015aa76e9adf6f190af4a36b1dd911aad77640f6a4ab8e629162b47e5ca35b"
  },
  {
    "file": "edited.band-result.json",
    "bytes": 348829,
    "sha256": "93a1ffe78fa0d96a47ea1b842e075b2eed1926069b6bdef057e8a8b403ad27d6"
  },
  {
    "file": "edited.independent-coefficient-oracle.json",
    "bytes": 25196,
    "sha256": "e195c3373776f3ea6d58240af78347d40cb27016be9f5102ab21e04c1a18fddf"
  },
  {
    "file": "main.actual-model5.source0.css",
    "bytes": 1897,
    "sha256": "c9c3589c130c2aac68d38eaa64bba53502abbb02f8f30ed465d5c68f78c7ff5b"
  },
  {
    "file": "main.band-result.json",
    "bytes": 348393,
    "sha256": "fbd9e91ceddccf4c23543cd115ca9e3d7fe8f0af474b413bf110bb99f23ccfa4"
  },
  {
    "file": "main.independent-coefficient-oracle.json",
    "bytes": 25159,
    "sha256": "272993465e132147aac31cf74728453f7e8d5cd747a8903079192b4b8b64d3c3"
  },
  {
    "file": "rev.actual-model5.source0.css",
    "bytes": 1894,
    "sha256": "26d7f00185c46c2a4ec5d2638c9cafba0d6d94cd204b736c0f7ea70a4e728e30"
  },
  {
    "file": "rev.band-result.json",
    "bytes": 348286,
    "sha256": "2e2b878392d1a4336eb0327d838acb0fce261481ee41c79a106ca4bfdcfb4490"
  }
];
const CASE_DATA = [
  {
    "key": "main",
    "resultFile": "main.band-result.json",
    "sourceFile": "main.actual-model5.source0.css",
    "oracleFile": "main.independent-coefficient-oracle.json",
    "curveIds": [
      "warp4lo_cut",
      "main_right",
      "warp4hi_cut",
      "main_left"
    ]
  },
  {
    "key": "rev",
    "resultFile": "rev.band-result.json",
    "sourceFile": "rev.actual-model5.source0.css",
    "oracleFile": null,
    "curveIds": [
      "warp4lo_cut",
      "rev_right",
      "warp4hi_cut",
      "rev_left"
    ]
  },
  {
    "key": "edited",
    "resultFile": "edited.band-result.json",
    "sourceFile": "edited.actual-model5.source0.css",
    "oracleFile": "edited.independent-coefficient-oracle.json",
    "curveIds": [
      "editedlo_cut",
      "edited_right",
      "editedhi_cut",
      "edited_left"
    ]
  }
];
// Browser-safe original authority and the shared genuine source-binding guard.
export const ORIGINAL_PINS = Object.freeze(PINS.map(pin => Object.freeze(pin)));
export const CASES = Object.freeze(CASE_DATA.map(row => Object.freeze({...row, curveIds: Object.freeze(row.curveIds)})));
export const surfaceOptions = Object.freeze({sourceVersion: 0, countU: 17, countV: 9, unitsPerMillimeter: 0.001});
export function selectedOptions(curveId) {
  return {sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: {version: 1, count: 129}, curveId};
}
function fail(label) { throw new Error(label); }
function descriptors(value, label) {
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') fail(label + ': symbol own key');
    const descriptor = fields[key];
    if (!descriptor || !('value' in descriptor) || (!descriptor.enumerable && !(Array.isArray(value) && key === 'length'))) {
      fail(label + ': getter or hidden own data');
    }
  }
  return fields;
}
export function assertSame(actual, expected, label = '$') {
  const visited = new WeakMap();
  function compare(a, b, path) {
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
      if (!Object.is(a, b)) fail(path + ': value/sign differs');
      return;
    }
    if (Array.isArray(a) !== Array.isArray(b)) fail(path + ': array rank differs');
    if (visited.get(a) === b) return;
    visited.set(a, b);
    const ad = descriptors(a, path), bd = descriptors(b, path);
    const ak = Object.keys(ad).filter(key => ad[key].enumerable), bk = Object.keys(bd).filter(key => bd[key].enumerable);
    if (ak.length !== bk.length || ak.some((key, index) => key !== bk[index])) fail(path + ': ordered keys differ');
    if (Array.isArray(a) && !Object.is(ad.length.value, bd.length.value)) fail(path + ': array length differs');
    for (const key of ak) compare(ad[key].value, bd[key].value, path + '.' + key);
  }
  compare(actual, expected, label);
}
export function negativeZeroPaths(value) {
  const paths = [], ancestors = new Set();
  function visit(item, path) {
    if (typeof item === 'number' && Object.is(item, -0)) { paths.push(path); return; }
    if (!item || typeof item !== 'object') return;
    if (ancestors.has(item)) fail(path + ': cycle');
    ancestors.add(item);
    const data = descriptors(item, path);
    for (const key of Object.keys(data)) if (data[key].enumerable) visit(data[key].value, path + '.' + key);
    ancestors.delete(item);
  }
  visit(value, '$');
  return paths;
}
const bindingMessage = 'Exact Surface band display source must equal the complete original native world source';
function ownValue(value, key) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(bindingMessage);
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) throw new TypeError(bindingMessage);
  return descriptor.value;
}
export function requireOriginalWorldSourceBinding(asset) {
  const source = ownValue(asset, 'worldSource'), native = ownValue(asset, 'native');
  const world = ownValue(native, 'world'), original = ownValue(world, 'source');
  if (typeof source !== 'string' || typeof original !== 'string' || source !== original) throw new TypeError(bindingMessage);
  return source;
}

function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export const FROZEN_CAMERA=freeze({"width":640,"height":480,"pixelRatio":1,"fixed":{"position":[0.07750000040978193,-0.040000000596046456,0.07150000119581819],"quaternion":[0.29187982754681546,0.32837384349522153,-0.10746629083028846,0.8918675807061252],"scale":[1,1,1],"matrix":[0.7612432304867112,5.551115123125783e-17,-0.648466455599791,0,0.38338280324108087,0.8065143252128423,0.45005807336996445,0,0.522997485861229,-0.5912145492344328,0.613953570358834,0,0.07750000040978193,-0.040000000596046456,0.07150000119581819,1],"matrixWorld":[0.7612432304867112,5.551115123125783e-17,-0.648466455599791,0,0.38338280324108087,0.8065143252128423,0.45005807336996445,0,0.522997485861229,-0.5912145492344328,0.613953570358834,0,0.07750000040978193,-0.040000000596046456,0.07150000119581819,1],"left":-0.043897402523249654,"right":0.043897402523249654,"top":0.03292305189243724,"bottom":-0.03292305189243724,"near":0.04995194523905783,"far":0.19780413591377005,"zoom":1,"up":[0,1,0],"projection":[22.780391151170363,0,0,0,0,30.373854868227156,0,0,0,0,-13.527023109181894,0,0,0,-1.6757011175973238,1],"inverse":[0.7612432304867114,0.3833828032410809,0.5229974858612292,0,0,0.8065143252128424,-0.591214549234433,0,-0.6484664555997912,0.45005807336996456,0.6139535703588341,0,-0.012630998323830798,-0.02963074670319351,-0.10807856870516233,1]},"marker":[-0.015000000968575476,0.04000000059604645,0.014000000339001418],"radius":0.000900000013411045});
export const serializeSigned=(value,space)=>JSON.stringify(value,(_key,item)=>typeof item==='number'&&Object.is(item,-0)?JSON.rawJSON('-0'):item,space)+'\n';
export async function loadCase(key,readText){
 const descriptor=CASES.find(row=>row.key===key);if(!descriptor)throw new TypeError('Unknown original Surface band case');
 const originalText=await readText(descriptor.resultFile),worldSource=await readText(descriptor.sourceFile),oracleText=descriptor.oracleFile?await readText(descriptor.oracleFile):null;
 const native=JSON.parse(originalText),oracle=oracleText===null?null:JSON.parse(oracleText);requireOriginalWorldSourceBinding({worldSource,native});
 return{key,native,worldSource,originalText,oracle,pins:ORIGINAL_PINS.filter(pin=>[descriptor.resultFile,descriptor.sourceFile,descriptor.oracleFile].includes(pin.file))};
}
