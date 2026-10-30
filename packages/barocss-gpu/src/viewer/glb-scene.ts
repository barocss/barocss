// A deliberately bounded GLB scene adapter. It does not allocate viewer or GPU resources.
import { decodeGlb } from './glb-container.js';
import { glbTextures, type PreparedGlbTexture } from './glb-texture-data.js';
import type { GeometryInput } from './geometry.js';
import { identity, multiply, normalMatrixInto, type Mat4, type Vec3 } from './math.js';
import type { Material } from './scene.js';
import { ViewerError } from './viewer-error.js';

/** A triangle primitive ready for `viewer.add(geometry, { material, transform })`. */
export interface PreparedGlbPrimitive {
  geometry: GeometryInput;
  material: Material;
  transform: Mat4;
}

/** A prepared primitive with an index into PreparedTexturedGlb.textures, or null. */
export interface PreparedTexturedGlbPrimitive extends PreparedGlbPrimitive { baseColorTexture: number | null }
/** Self-contained CPU inputs. No viewer or GPU resource is created. */
export interface PreparedTexturedGlb { primitives: PreparedTexturedGlbPrimitive[]; textures: PreparedGlbTexture[] }

type Obj = Record<string, unknown>;
const fail = (message: string): never => { throw new ViewerError('GEOMETRY_INVALID', `GLB: ${message}`); };
const object = (value: unknown, label: string): Obj => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return fail(`${label} must be an object`);
  return value as Obj;
};
const array = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) return fail(`${label} must be an array`);
  return value;
};
const optionalArray = (value: unknown, label: string): unknown[] => value === undefined ? [] : array(value, label);
const integer = (value: unknown, label: string, minimum = 0): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) return fail(`${label} must be an integer at least ${minimum}`);
  return value;
};
const number = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail(`${label} must be finite`);
  return value;
};
const unit = (value: unknown, label: string): number => {
  const n = number(value, label);
  if (n < 0 || n > 1) return fail(`${label} must be between 0 and 1`);
  return n;
};
const vector = (value: unknown, size: number, label: string): number[] => {
  const v = array(value, label);
  if (v.length !== size) return fail(`${label} must contain ${size} numbers`);
  return v.map((x, i) => number(x, `${label}[${i}]`));
};
const keys = (value: Obj, allowed: readonly string[], label: string): void => {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${label}.${key} is not supported`);
};
const ref = (value: unknown, list: readonly unknown[], label: string): number => {
  const i = integer(value, label);
  if (i >= list.length) return fail(`${label} is out of range`);
  return i;
};
const srgb = (x: number): number => x === 1 ? 1 : x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;

function materialOf(value: unknown, textured = false): Material {
  const m = value === undefined ? {} : object(value, 'material');
  keys(m, ['name', 'extras', 'pbrMetallicRoughness', 'alphaMode', 'doubleSided', 'emissiveFactor'], 'material');
  if (m.alphaMode !== undefined && m.alphaMode !== 'OPAQUE') fail('only OPAQUE materials are supported');
  if (m.doubleSided !== undefined && typeof m.doubleSided !== 'boolean') fail('material.doubleSided must be boolean');
  if (m.emissiveFactor !== undefined && vector(m.emissiveFactor, 3, 'material.emissiveFactor').some(x => x !== 0)) fail('emissive materials are not supported');
  const p = m.pbrMetallicRoughness === undefined ? {} : object(m.pbrMetallicRoughness, 'pbrMetallicRoughness');
  keys(p, textured ? ['baseColorFactor', 'metallicFactor', 'roughnessFactor', 'baseColorTexture'] : ['baseColorFactor', 'metallicFactor', 'roughnessFactor'], 'pbrMetallicRoughness');
  const base = p.baseColorFactor === undefined ? [1, 1, 1, 1] : vector(p.baseColorFactor, 4, 'baseColorFactor');
  base.forEach((x, i) => unit(x, `baseColorFactor[${i}]`));
  // glTF factors are linear. An OPAQUE material ignores base and vertex alpha.
  return { color: [srgb(base[0]), srgb(base[1]), srgb(base[2])] as Vec3, opacity: 1,
    metallic: p.metallicFactor === undefined ? 1 : unit(p.metallicFactor, 'metallicFactor'),
    roughness: p.roughnessFactor === undefined ? 1 : unit(p.roughnessFactor, 'roughnessFactor'),
    doubleSided: m.doubleSided === true };
}

function localMatrix(node: Obj): Mat4 {
  if (node.matrix !== undefined) {
    if (node.translation !== undefined || node.rotation !== undefined || node.scale !== undefined) fail('a node cannot have both matrix and TRS');
    const m = Float64Array.from(vector(node.matrix, 16, 'node.matrix'));
    if (m[3] !== 0 || m[7] !== 0 || m[11] !== 0 || m[15] !== 1) fail('node.matrix must be affine');
    return m;
  }
  const t = node.translation === undefined ? [0, 0, 0] : vector(node.translation, 3, 'node.translation');
  const s = node.scale === undefined ? [1, 1, 1] : vector(node.scale, 3, 'node.scale');
  const q = node.rotation === undefined ? [0, 0, 0, 1] : vector(node.rotation, 4, 'node.rotation');
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  if (Math.abs(len - 1) > 1e-4) fail('node.rotation must be a unit quaternion');
  const [x, y, z, w] = q.map(value => value / len);
  const m = identity();
  m[0] = (1 - 2 * (y * y + z * z)) * s[0]; m[1] = 2 * (x * y + z * w) * s[0]; m[2] = 2 * (x * z - y * w) * s[0];
  m[4] = 2 * (x * y - z * w) * s[1]; m[5] = (1 - 2 * (x * x + z * z)) * s[1]; m[6] = 2 * (y * z + x * w) * s[1];
  m[8] = 2 * (x * z + y * w) * s[2]; m[9] = 2 * (y * z - x * w) * s[2]; m[10] = (1 - 2 * (x * x + y * y)) * s[2];
  m[12] = t[0]; m[13] = t[1]; m[14] = t[2];
  return m;
}

function determinant(m: Mat4): number {
  return m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);
}

// Check products and partial sums in f32. The absolute bound intentionally refuses
// some finite cancellation cases because GPU evaluation order is not guaranteed.
function finiteF32Sum(a: number, b: number, c: number, d: number, label: string): number {
  const x = Math.fround(a), y = Math.fround(b), z = Math.fround(c), w = Math.fround(d);
  const s1 = Math.fround(x + y), s2 = Math.fround(s1 + z), sum = Math.fround(s2 + w);
  const b1 = Math.fround(Math.abs(x) + Math.abs(y));
  const b2 = Math.fround(b1 + Math.abs(z)), bound = Math.fround(b2 + Math.abs(w));
  if (![x, y, z, w, s1, s2, sum, b1, b2, bound].every(Number.isFinite)) fail(`${label} exceeds finite f32 range`);
  return sum;
}

/**
 * Decode a bounded, self-contained GLB 2.0 triangle scene into independent viewer inputs.
 * POSITION/NORMAL are FLOAT VEC3; indices are UNSIGNED_SHORT or UNSIGNED_INT SCALAR. Optional COLOR_0
 * is FLOAT VEC3/VEC4. Textures, integer colours, sparse or
 * strided data, morphs, skins, animations, cameras, extensions and non-opaque materials
 * are refused. Coordinates retain glTF metres and +Y up; no CAD-unit or axis conversion
 * is applied. Names and extras are not returned. Node and primitive limits bound memory
 * use. Viewer vertex colours use the viewer's existing linear RGBA8 quantization.
 * No GPU resources are created.
 */
export function prepareGlb(source: ArrayBuffer | Uint8Array): PreparedGlbPrimitive[] {
  return prepareGlbScene(source, false).primitives.map(({ geometry, material, transform }) => ({ geometry, material, transform }));
}

/** Prepare self-contained GLB scenes with embedded opaque PNG/JPEG base colour maps. */
export function prepareTexturedGlb(source: ArrayBuffer | Uint8Array): PreparedTexturedGlb {
  return prepareGlbScene(source, true);
}

function prepareGlbScene(source: ArrayBuffer | Uint8Array, textured: boolean): PreparedTexturedGlb {
  const { json, bin } = decodeGlb(source), gltf = object(json, 'root');
  keys(gltf, textured ? ['asset', 'buffers', 'bufferViews', 'accessors', 'materials', 'meshes', 'nodes', 'scenes', 'scene', 'extras', 'images', 'textures', 'samplers'] : ['asset', 'buffers', 'bufferViews', 'accessors', 'materials', 'meshes', 'nodes', 'scenes', 'scene', 'extras'], 'root');
  const asset = object(gltf.asset, 'asset');
  keys(asset, ['version', 'minVersion', 'generator', 'copyright', 'extras'], 'asset');
  if (asset.version !== '2.0' || (asset.minVersion !== undefined && asset.minVersion !== '2.0')) fail('only glTF 2.0 is supported');
  const buffers = array(gltf.buffers, 'buffers');
  if (buffers.length !== 1) fail('exactly one self-contained buffer is required');
  const buffer = object(buffers[0], 'buffer');
  keys(buffer, ['byteLength', 'name', 'extras'], 'buffer');
  const bufferLength = integer(buffer.byteLength, 'buffer.byteLength');
  if (bufferLength > bin.length || bin.length - bufferLength > 3) fail('BIN size does not match buffer.byteLength');
  for (let i = bufferLength; i < bin.length; i++) if (bin[i] !== 0) fail('BIN padding must be zero');
  const views = array(gltf.bufferViews, 'bufferViews'), accessors = array(gltf.accessors, 'accessors');
  const materials = optionalArray(gltf.materials, 'materials'), meshes = array(gltf.meshes, 'meshes');
  const nodes = array(gltf.nodes, 'nodes'), scenes = array(gltf.scenes, 'scenes');
  if (nodes.length > 4096 || meshes.length > 4096 || materials.length > 4096 || scenes.length > 4096 ||
      views.length > 16384 || accessors.length > 16384 || scenes.length === 0) fail('scene exceeds the supported collection limits or has no scene');
  const textures = textured ? glbTextures(gltf, bin, bufferLength, views) : [];
  const imageViews = new Set(textured ? optionalArray(gltf.images, 'images').map(image => ref(object(image, 'image').bufferView, views, 'image.bufferView')) : []);
  const preparedMaterials = materials.map(entry => {
    const material = materialOf(entry, textured), m = object(entry, 'material');
    const p = m.pbrMetallicRoughness === undefined ? {} : object(m.pbrMetallicRoughness, 'pbrMetallicRoughness');
    let texture: number | null = null;
    if (p.baseColorTexture !== undefined) {
      const info = object(p.baseColorTexture, 'baseColorTexture');
      keys(info, ['index', 'texCoord', 'extras'], 'baseColorTexture');
      if (info.texCoord !== undefined && info.texCoord !== 0) fail('only TEXCOORD_0 is supported');
      texture = ref(info.index, textures, 'baseColorTexture.index');
    }
    return { material, texture };
  });
  const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  let decodedScalars = 0;
  const usedViews = new Map<number, { kind: 'attribute' | 'index'; accessor: number }>();

  const readAccessor = (index: unknown, label: string, kind: 'position' | 'normal' | 'index' | 'color' | 'uv'): number[] => {
    const accessorIndex = ref(index, accessors, `${label} accessor`);
    const a = object(accessors[accessorIndex], `${label} accessor`);
    keys(a, ['bufferView', 'byteOffset', 'componentType', 'count', 'type', 'normalized', 'min', 'max', 'name', 'extras'], `${label} accessor`);
    const viewIndex = ref(a.bufferView, views, `${label}.bufferView`), usage = kind === 'index' ? 'index' : 'attribute';
    if (imageViews.has(viewIndex)) fail(`${label} cannot share an image bufferView`);
    const previous = usedViews.get(viewIndex);
    if (previous && (previous.kind !== usage || (usage === 'attribute' && previous.accessor !== accessorIndex))) fail(`${label} shares an unsupported bufferView`);
    usedViews.set(viewIndex, { kind: usage, accessor: accessorIndex });
    const view = object(views[viewIndex], `${label} bufferView`);
    keys(view, ['buffer', 'byteOffset', 'byteLength', 'target', 'name', 'extras'], `${label} bufferView`);
    if (view.buffer !== 0) fail(`${label} references a different buffer`);
    const viewOffset = view.byteOffset === undefined ? 0 : integer(view.byteOffset, `${label} view byteOffset`);
    const viewLength = integer(view.byteLength, `${label} view byteLength`);
    if (viewOffset + viewLength > bufferLength) fail(`${label} bufferView exceeds the buffer`);
    if (view.target !== undefined && view.target !== 34962 && view.target !== 34963) fail(`${label} bufferView target is invalid`);
    const component = integer(a.componentType, `${label}.componentType`);
    const components = kind === 'index' ? 1 : kind === 'uv' ? 2 : kind === 'color' && a.type === 'VEC4' ? 4 : 3;
    if (a.type !== (kind === 'index' ? 'SCALAR' : components === 2 ? 'VEC2' : components === 4 ? 'VEC4' : 'VEC3')) fail(`${label} accessor type is unsupported`);
    if ((kind === 'position' || kind === 'normal' || kind === 'uv') && component !== 5126) fail(`${label} must use FLOAT`);
    if (kind === 'index' && component !== 5123 && component !== 5125) fail('indices must use UNSIGNED_SHORT or UNSIGNED_INT');
    if (kind === 'color' && component !== 5126) fail('COLOR_0 must use FLOAT');
    if (a.normalized !== undefined && typeof a.normalized !== 'boolean') fail(`${label}.normalized must be boolean`);
    if (a.normalized === true) fail(`${label}.normalized is unsupported`);
    const size = component === 5126 || component === 5125 ? 4 : 2;
    const count = integer(a.count, `${label}.count`, 1), offset = a.byteOffset === undefined ? 0 : integer(a.byteOffset, `${label}.byteOffset`);
    const bytes = count * components * size, start = viewOffset + offset;
    if (!Number.isSafeInteger(bytes) || offset + bytes > viewLength || offset % size !== 0 || start % size !== 0 || (kind !== 'index' && offset % 4 !== 0)) fail(`${label} byte range or alignment is invalid`);
    if (count > 2_000_000) fail(`${label} exceeds the supported element count`);
    decodedScalars += count * components;
    if (decodedScalars > 12_000_000) fail('scene exceeds the supported decoded data limit');
    for (const bound of ['min', 'max']) if (a[bound] !== undefined) vector(a[bound], components, `${label}.${bound}`);
    const result = new Array<number>(count * components);
    for (let i = 0; i < result.length; i++) {
      const at = start + i * size;
      const raw = component === 5126 ? data.getFloat32(at, true) : component === 5125 ? data.getUint32(at, true) : data.getUint16(at, true);
      if (!Number.isFinite(raw)) fail(`${label} contains a non-finite value`);
      result[i] = raw;
      if (kind === 'color') unit(result[i], `${label}[${i}]`);
    }
    return result;
  };

  const decodedMeshes = meshes.map((entry, meshIndex) => {
    const mesh = object(entry, `mesh[${meshIndex}]`);
    keys(mesh, ['name', 'extras', 'primitives'], 'mesh');
    const primitives = array(mesh.primitives, 'mesh.primitives');
    if (!primitives.length || primitives.length > 4096) fail('a mesh must contain between 1 and 4096 primitives');
    return primitives.map((entry, primitiveIndex) => {
      const p = object(entry, `primitive[${primitiveIndex}]`);
      keys(p, ['attributes', 'indices', 'material', 'mode', 'extras'], 'primitive');
      if (p.mode !== undefined && p.mode !== 4) fail('only TRIANGLES primitives are supported');
      const attr = object(p.attributes, 'primitive.attributes');
      keys(attr, textured ? ['POSITION', 'NORMAL', 'COLOR_0', 'TEXCOORD_0'] : ['POSITION', 'NORMAL', 'COLOR_0'], 'primitive.attributes');
      const positions = readAccessor(attr.POSITION, 'POSITION', 'position');
      const normals = readAccessor(attr.NORMAL, 'NORMAL', 'normal');
      const indices = readAccessor(p.indices, 'indices', 'index');
      const indexAccessor = object(accessors[ref(p.indices, accessors, 'indices accessor')], 'indices accessor');
      const indexComponent = indexAccessor.componentType;
      const restart = indexComponent === 5125 ? 0xffffffff : 0xffff;
      const vertices = positions.length / 3;
      if (normals.length !== positions.length || indices.length % 3 || indices.some(i => i >= vertices || i === restart)) fail('triangle geometry has inconsistent counts, indices or a primitive-restart value');
      for (let i = 0; i < normals.length; i += 3) {
        if (normals[i] === 0 && normals[i + 1] === 0 && normals[i + 2] === 0) fail('NORMAL contains a zero direction');
      }
      let colors: number[] | undefined;
      if (attr.COLOR_0 !== undefined) {
        const colorAccessor = object(accessors[ref(attr.COLOR_0, accessors, 'COLOR_0 accessor')], 'COLOR_0 accessor');
        const raw = readAccessor(attr.COLOR_0, 'COLOR_0', 'color'), components = colorAccessor.type === 'VEC4' ? 4 : 3;
        if (raw.length !== vertices * components) fail('COLOR_0 count must match POSITION');
        colors = [];
        for (let i = 0; i < vertices; i++) colors.push(srgb(raw[i * components]), srgb(raw[i * components + 1]), srgb(raw[i * components + 2]));
      }
      const selected = p.material === undefined ? { material: materialOf(undefined), texture: null } : preparedMaterials[ref(p.material, preparedMaterials, 'primitive.material')];
      const uvs = attr.TEXCOORD_0 === undefined ? undefined : readAccessor(attr.TEXCOORD_0, 'TEXCOORD_0', 'uv');
      if (uvs && uvs.length !== vertices * 2) fail('TEXCOORD_0 count must match POSITION');
      if (selected.texture !== null && !uvs) fail('a base colour texture requires TEXCOORD_0');
      return { positions, normals, indices, indexComponent, colors, uvs, material: selected.material, texture: selected.texture };
    });
  });

  const parsedNodes = nodes.map((entry, i) => {
    const node = object(entry, `node[${i}]`);
    keys(node, ['name', 'extras', 'mesh', 'children', 'matrix', 'translation', 'rotation', 'scale'], 'node');
    const mesh = node.mesh === undefined ? null : ref(node.mesh, decodedMeshes, 'node.mesh');
    const children = optionalArray(node.children, 'node.children').map(child => ref(child, nodes, 'node.child'));
    if (new Set(children).size !== children.length) fail('a node cannot contain duplicate children');
    return { mesh, children, matrix: localMatrix(node) };
  });
  const parsedScenes = scenes.map((entry, i) => {
    const scene = object(entry, `scene[${i}]`);
    keys(scene, ['name', 'extras', 'nodes'], 'scene');
    const roots = optionalArray(scene.nodes, 'scene.nodes').map(node => ref(node, nodes, 'scene.node'));
    if (new Set(roots).size !== roots.length) fail('a scene cannot contain duplicate roots');
    return roots;
  });
  if (gltf.scene === undefined && parsedScenes.length !== 1) fail('a default scene is required when multiple scenes exist');
  const scene = gltf.scene === undefined ? 0 : ref(gltf.scene, parsedScenes, 'scene');
  const output: PreparedTexturedGlbPrimitive[] = [], active = new Set<number>(), visited = new Set<number>();
  let emittedVertices = 0, emittedIndices = 0;
  const visit = (index: number, parent: Mat4, depth: number): void => {
    if (depth > 1024 || active.has(index) || visited.has(index)) fail('scene has a cycle, repeated node, or exceeds the supported depth');
    active.add(index); visited.add(index);
    const node = parsedNodes[index], matrix = multiply(parent, node.matrix);
    if (Array.from(matrix).some(x => !Number.isFinite(x) || !Number.isFinite(Math.fround(x)))) fail('node transform exceeds finite f32 range');
    const f32 = Float64Array.from(matrix, Math.fround), det = determinant(f32);
    if (!Number.isFinite(det) || det === 0) fail('singular node transforms are not supported');
    const normal = normalMatrixInto(new Float64Array(16), matrix);
    if (normal.some(x => !Number.isFinite(x) || !Number.isFinite(Math.fround(x)))) fail('node normal transform exceeds finite f32 range');
    const normalF32 = Float64Array.from(normal, Math.fround);
    if (node.mesh !== null) for (const p of decodedMeshes[node.mesh]) {
      emittedVertices += p.positions.length / 3; emittedIndices += p.indices.length;
      if (emittedVertices > 2_000_000 || emittedIndices > 6_000_000 || output.length >= 4096) fail('scene exceeds the supported output limits');
      for (let i = 0; i < p.positions.length; i += 3) for (let axis = 0; axis < 3; axis++) {
        finiteF32Sum(f32[axis] * p.positions[i], f32[4 + axis] * p.positions[i + 1], f32[8 + axis] * p.positions[i + 2], f32[12 + axis], 'transformed POSITION');
      }
      for (let i = 0; i < p.normals.length; i += 3) {
        const direction = [0, 0, 0];
        for (let axis = 0; axis < 3; axis++) direction[axis] = finiteF32Sum(normalF32[axis] * p.normals[i], normalF32[4 + axis] * p.normals[i + 1], normalF32[8 + axis] * p.normals[i + 2], 0, 'transformed NORMAL');
        if (direction.every(x => x === 0)) fail('transformed NORMAL has no f32 direction');
      }
      const indices = p.indexComponent === 5125 ? Uint32Array.from(p.indices) : Uint16Array.from(p.indices);
      // Mirrored transforms reverse front-facing winding; the viewer uses a fixed CCW pipeline.
      if (det < 0) for (let i = 0; i < indices.length; i += 3) { const x = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = x; }
      output.push({ geometry: { positions: Float32Array.from(p.positions), normals: Float32Array.from(p.normals), indices, ...(p.colors ? { colors: [...p.colors] } : {}), ...(p.uvs ? { uvs: Float32Array.from(p.uvs) } : {}) },
        material: { ...p.material, color: Array.isArray(p.material.color) ? [p.material.color[0], p.material.color[1], p.material.color[2]] as Vec3 : p.material.color }, transform: matrix.slice(), baseColorTexture: p.texture });
    }
    for (const child of node.children) visit(child, matrix, depth + 1);
    active.delete(index);
  };
  for (const root of parsedScenes[scene]) visit(root, identity(), 0);
  return { primitives: output, textures };
}
