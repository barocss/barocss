/** #1184 authored example originals and independent, pre-observation oracle.
 * Private example data, not a public codec or renderer/pixel implementation.
 */
const SCENE = {"background":[-0,0.1,0.2],"camera":{"eye":[0,0,6],"far":100,"fovY":45,"near":0.01,"target":[0,0,0],"up":[0,1,0]},"coordinateSystem":"right-handed-y-up","format":"barocss-gpu-engine-scene","geometries":[{"coordinateSystem":"right-handed-y-up","format":"barocss-gpu-triangle-geometry","id":"quad","indices":[-0,1,2,0,2,3],"normals":[0,0,1,0,0,1,0,0,1,0,0,1],"positionUnit":"scene","positions":[-0.75,-0.75,-0,0.75,-0.75,0,0.75,0.75,0,-0.75,0.75,0],"uvs":[-0,0,1,0,1,1,0,1],"version":0,"winding":"ccw"}],"id":"runtime_source_scene","materials":[{"color":[1,0.5,0.25],"colorSpace":"linear","id":"left_material","type":"unlit"},{"color":[0.25,0.5,0.75],"colorSpace":"linear","id":"right_material","type":"unlit"}],"nodes":[{"geometryId":"quad","id":"left_instance","materialId":"left_material","parentId":null,"rotationXYZW":[0,0,0,1],"scale":[2,0.5,1],"translation":[1.25,-0.5,0.25],"type":"mesh","visible":true},{"geometryId":"quad","id":"right_instance","materialId":"right_material","parentId":null,"rotationXYZW":[0,0,0,1],"scale":[0.5,2,1],"translation":[-1.25,0.5,-0.25],"type":"mesh","visible":true}],"positionUnit":"scene","version":0};
const TEXTURES = {"bindings":[{"materialId":"left_material","textureId":"shared_image"},{"materialId":"right_material","textureId":"shared_image"}],"format":"barocss-gpu-engine-texture-bindings","sceneId":"runtime_source_scene","textures":[{"colorSpace":"srgb","filter":"nearest","format":"rgba8","height":2,"id":"shared_image","pixels":[64,-0,128,255,192,96,32,255,8,144,240,255,224,176,80,255],"rowOrigin":"bottom-left","width":2,"wrapS":"clamp-to-edge","wrapT":"clamp-to-edge"}],"version":0};
const SOURCES = ["// Full original é😀\r\n@shader #same_shader_id {@uniform amount:float(-0,1,.25);@sampler image:sampler2d;@fragment{color:mix(sample(image,uv_u,uv_v),#204080,amount);}}\r\n", "@shader #same_shader_id {@uniform amount:float(-0,1,.5);@sampler albedo:sampler2d;@fragment{color:mix(sample(albedo,uv_u,uv_v),#80C040,amount);}}"];
const clone = value => structuredClone(value);

/** Finite private proof JSON; preserve original -0 and reject oversized/deep data. */
export function serializeEngineUVProofOriginals(value) {
  let work = 0;
  function visit(item, depth) {
    if (++work > 32768 || depth > 32) throw new Error('Private original JSON work limit');
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new Error('Original numbers must be finite');
      return Object.is(item, -0) ? '-0' : JSON.stringify(item);
    }
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return JSON.stringify(item);
    if (Array.isArray(item)) return '[' + item.map(child => visit(child, depth + 1)).join(',') + ']';
    if (item && Object.getPrototypeOf(item) === Object.prototype)
      return '{' + Object.keys(item).sort().map(key => JSON.stringify(key) + ':' + visit(item[key], depth + 1)).join(',') + '}';
    throw new Error('Private original JSON requires plain finite data');
  }
  const text = visit(value, 0);
  if (new TextEncoder().encode(text).length > 262144) throw new Error('Private original JSON exceeds256KiB');
  return text;
}

const clamp = value => Math.max(0, Math.min(1, value));
function outputByte(linear) {
  const v = clamp(linear);
  return Math.floor(255 * (v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055) + .5);
}
function decodedByte(byte) {
  const v = byte / 255;
  return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
}
function projectedWindow(node, u, v, camera, options) {
  const k = options.height / (2 * Math.tan(camera.fovY * Math.PI / 360) * (camera.eye[2] - node.translation[2]));
  const worldX = node.translation[0] + node.scale[0] * (1.5 * u - .75);
  const worldY = node.translation[1] + node.scale[1] * (1.5 * v - .75);
  const center = [Math.floor(options.width / 2 + k * worldX), Math.floor(options.height / 2 - k * worldY)];
  const texelU = Math.floor(2 * u), texelV = Math.floor(2 * v);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = center[0] + dx, y = center[1] + dy;
    const actualU = (((x + .5 - options.width / 2) / k - node.translation[0]) / node.scale[0] + .75) / 1.5;
    const actualV = (((options.height / 2 - y - .5) / k - node.translation[1]) / node.scale[1] + .75) / 1.5;
    if (x < 0 || x >= options.width || y < 0 || y >= options.height || actualU <= 0 || actualU >= 1 || actualV <= 0 || actualV >= 1
      || Math.floor(2 * actualU) !== texelU || Math.floor(2 * actualV) !== texelV)
      throw new Error('Declared window does not lie strictly in its intended texel');
  }
  return center;
}

/** Six explicit authored phases; no shader evaluation or private prepared input. */
export function createEngineUVProofFixture(phase = 0) {
  if (!Number.isInteger(phase) || phase < 0 || phase > 5) throw new Error('Proof phase must be0..5');
  const scene = clone(SCENE), textureBindings = clone(TEXTURES);
  const authoredMaterials = [
    { materialId: 'left_material', source: SOURCES[0], uniforms: {} },
    { materialId: 'right_material', source: SOURCES[1], uniforms: { amount: -0 } },
  ];
  const options = { width: 320, height: phase >= 4 ? 256 : 240 };
  if (phase >= 1) authoredMaterials[0].uniforms.amount = .75;
  if (phase >= 2) textureBindings.textures[0].pixels[0] = 96;
  if (phase >= 3) authoredMaterials[0].source = authoredMaterials[0].source.replace('#204080', '#102030');
  if (phase >= 5) scene.nodes[0].visible = false;
  const samples = [], identities = [];
  const quarters = [[.25, .25], [.75, .25], [.25, .75], [.75, .75]];
  for (const node of scene.nodes.filter(node => node.visible)) {
    const isLeft = node.id === 'left_instance';
    const ratio = isLeft ? (phase >= 1 ? .75 : .25) : 0;
    const hex = isLeft ? (phase >= 3 ? [16, 32, 48] : [32, 64, 128]) : [128, 192, 64];
    const firstSample = samples.length;
    for (let i = 0; i < quarters.length; i++) {
      const [u, v] = quarters[i];
      const rgba = [0, 1, 2].map(channel => outputByte(decodedByte(textureBindings.textures[0].pixels[4 * i + channel]) * (1 - ratio) + (hex[channel] / 255) ** 2.2 * ratio));
      rgba.push(255);
      samples.push({ nodeId: node.id, center: projectedWindow(node, u, v, scene.camera, options), radius: 1, rgba });
    }
    identities.push({ point: [...samples[firstSample].center], ref: { sceneId: scene.id, nodeId: node.id, geometryId: node.geometryId } });
  }
  const background = { nodeId: null, center: [4, 4], radius: 0, rgba: [...scene.background.map(outputByte), 255] };
  identities.push({ point: [4, 4], ref: null });
  const pixels = options.width * options.height, drawCount = scene.nodes.filter(node => node.visible).length;
  const geometryBytes = 48 + 32 + 12, textureBytes = 16, uniformBytes = 128 + 64 * 2 + 80 * drawCount;
  const colorIdentityBytes = 8 * pixels, depthBudgetBytes = 4 * pixels;
  const resources = { geometryBytes, textureBytes, uniformBytes, colorIdentityBytes, depthTexels: pixels, depthBudgetBytes,
    chargedBytes: geometryBytes + textureBytes + uniformBytes + colorIdentityBytes + depthBudgetBytes,
    readbackBytes: Math.ceil(4 * options.width / 256) * 256 * options.height,
    buffers: 3 + 1 + 2 + drawCount, textures: 1 + 3, bindGroups: 2 * 2 + drawCount, pipelines: 2 };
  return { phase, scene, textureBindings, authoredMaterials, options, oracle: { samples, background, identities, tolerance: 3, resources } };
}
