const SVG_NS = 'http://www.w3.org/2000/svg';
const RING_SAMPLES = 64;

function tuple(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new TypeError(`${label} must contain three finite numbers`);
  }
  return value;
}

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalize(value) {
  const length = Math.hypot(...value);
  if (!(length > 0) || !Number.isFinite(length)) throw new TypeError('camera basis must be finite and nonzero');
  return value.map(component => component / length);
}

function cameraBasis(camera, width, height) {
  const eye = tuple(camera.eye, 'camera.eye');
  const target = tuple(camera.target, 'camera.target');
  const up = tuple(camera.up, 'camera.up');
  const { fovY, near, far } = camera;
  if (!Number.isFinite(fovY) || !(fovY > 0 && fovY < 180)
    || !Number.isFinite(near) || !Number.isFinite(far) || !(near > 0 && far > near)) {
    throw new TypeError('camera perspective must have valid fovY, near and far');
  }
  const forward = normalize(target.map((component, axis) => component - eye[axis]));
  const right = normalize(cross(forward, up));
  return { eye, forward, right, up: cross(right, forward), near, far,
    tangent: Math.tan(fovY * Math.PI / 360), aspect: width / height };
}

function toCamera(pointM, scale, basis) {
  const relative = pointM.map((component, axis) => component * scale - basis.eye[axis]);
  return [dot(relative, basis.right), dot(relative, basis.up), dot(relative, basis.forward)];
}

function clipDepth(a, b, near, far) {
  const delta = b[2] - a[2];
  if (delta === 0) return a[2] >= near && a[2] <= far ? [a, b] : null;
  const nearT = (near - a[2]) / delta;
  const farT = (far - a[2]) / delta;
  const start = Math.max(0, Math.min(nearT, farT));
  const end = Math.min(1, Math.max(nearT, farT));
  if (start > end) return null;
  const at = fraction => a.map((component, axis) => component + (b[axis] - component) * fraction);
  return [at(start), at(end)];
}

function toPixels(point, basis, width, height) {
  return [
    (1 + point[0] / (point[2] * basis.tangent * basis.aspect)) * width / 2,
    (1 - point[1] / (point[2] * basis.tangent)) * height / 2,
  ];
}

/** Draw a projected proxy guide. These SVG lines do not use the scene depth buffer. */
export function renderProxyGuide(svg, camera, {
  width = 900, height = 660, centreM = [0, .1, 0], radiusM = .3, mmToSceneUnit = .001,
} = {}) {
  tuple(centreM, 'centreM');
  if (![width, height, radiusM, mmToSceneUnit].every(value => Number.isFinite(value) && value > 0)) {
    throw new TypeError('guide dimensions, radius and scene scale must be positive and finite');
  }
  const basis = cameraBasis(camera, width, height);
  const scale = 1000 * mmToSceneUnit;
  const paths = [];
  let projectedSampleCount = 0;
  let drawnSegmentCount = 0;
  let depthClippedSegmentCount = 0;
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const extend = point => {
    bounds.minX = Math.min(bounds.minX, point[0]); bounds.maxX = Math.max(bounds.maxX, point[0]);
    bounds.minY = Math.min(bounds.minY, point[1]); bounds.maxY = Math.max(bounds.maxY, point[1]);
  };

  // XY, XZ and YZ world rings. The guide is independent of the CAD source.
  for (const axes of [[0, 1], [0, 2], [1, 2]]) {
    const samples = Array.from({ length: RING_SAMPLES }, (_, index) => {
      const angle = 2 * Math.PI * index / RING_SAMPLES;
      const point = [...centreM];
      point[axes[0]] += radiusM * Math.cos(angle);
      point[axes[1]] += radiusM * Math.sin(angle);
      return toCamera(point, scale, basis);
    });
    projectedSampleCount += samples.filter(point => point[2] >= basis.near && point[2] <= basis.far).length;
    const commands = [];
    for (let index = 0; index < RING_SAMPLES; index++) {
      const a = samples[index];
      const b = samples[(index + 1) % RING_SAMPLES];
      const clipped = clipDepth(a, b, basis.near, basis.far);
      if (a[2] < basis.near || a[2] > basis.far || b[2] < basis.near || b[2] > basis.far) depthClippedSegmentCount++;
      if (!clipped) continue;
      const start = toPixels(clipped[0], basis, width, height);
      const end = toPixels(clipped[1], basis, width, height);
      extend(start); extend(end); drawnSegmentCount++;
      commands.push(`M ${start[0]} ${start[1]} L ${end[0]} ${end[1]}`);
    }
    const path = svg.ownerDocument.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', commands.join(' '));
    paths.push(path);
  }
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.replaceChildren(...paths);
  return {
    ringCount: 3, samplesPerRing: RING_SAMPLES, sampleCount: 3 * RING_SAMPLES,
    projectedSampleCount, drawnSegmentCount, depthClippedSegmentCount,
    projectedBounds: drawnSegmentCount ? bounds : null, width, height,
    depthOcclusion: false,
  };
}
