// Independent host evidence. No geometry producer or library-private maths are imported.
const F32_TOLERANCE_MM = .00005;
const GEOMETRY_TOLERANCE_MM = 1e-9;

function equalData(a, b) {
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return Object.is(a, b);
  const keys = Object.keys(a), other = Object.keys(b);
  return Array.isArray(a) === Array.isArray(b) && keys.length === other.length
    && keys.every(key => Object.hasOwn(b, key) && equalData(a[key], b[key]));
}
const pointAt = (values, index) => values.slice(index * 3, index * 3 + 3);
const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const distance = (a, b) => Math.hypot(...subtract(a, b));

function multiplyQuat(a, b) {
  return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
    a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
    a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
    a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
}
function rotate(point, quaternion) {
  const norm = Math.hypot(...quaternion), q = quaternion.map(value => value / norm);
  return multiplyQuat(multiplyQuat(q, [...point, 0]), [-q[0], -q[1], -q[2], q[3]]).slice(0, 3);
}
function expectedCorner(box, signs) {
  const local = signs.map((sign, axis) => sign * box.halfExtentsM[axis]);
  return rotate(local, box.orientationXYZW).map((value, axis) => (value + box.centerM[axis]) * 1000);
}
function faceCorners(box, role) {
  const [direction, axisName] = role.split('-'), axis = ['x', 'y', 'z'].indexOf(axisName);
  if (axis < 0 || !['positive', 'negative'].includes(direction)) throw new Error('Unknown face role');
  const sign = direction === 'positive' ? 1 : -1, free = [0, 1, 2].filter(value => value !== axis);
  const corners = [];
  for (const first of [-1, 1]) for (const second of [-1, 1]) {
    const signs = [0, 0, 0]; signs[axis] = sign; signs[free[0]] = first; signs[free[1]] = second;
    corners.push(expectedCorner(box, signs));
  }
  const localNormal = [0, 0, 0]; localNormal[axis] = sign;
  return { corners, normal: rotate(localNormal, box.orientationXYZW) };
}
function setError(actual, expected) {
  if (actual.length !== expected.length) return Infinity;
  const remaining = [...expected]; let maximum = 0;
  for (const point of actual) {
    const nearest = remaining.map(value => distance(point, value));
    const minimum = Math.min(...nearest), index = nearest.indexOf(minimum);
    maximum = Math.max(maximum, minimum); remaining.splice(index, 1);
  }
  return maximum;
}

function inspectPacket(packet) {
  const { positions, normals, indices, parameters } = packet;
  const dense = values => Array.isArray(values) && Object.getPrototypeOf(values) === Array.prototype
    && Reflect.ownKeys(values).length === values.length + 1
    && Array.from({ length: values.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(values, String(index));
      return descriptor && descriptor.enumerable && 'value' in descriptor && Number.isFinite(descriptor.value);
    }).every(Boolean);
  const count = positions.length / 3;
  let normalError = 0, minimumArea = Infinity, minimumOutwardDot = Infinity, f32Error = 0;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let vertex = 0; vertex < count; vertex++) {
    normalError = Math.max(normalError, Math.abs(Math.hypot(...pointAt(normals, vertex)) - 1));
    for (let axis = 0; axis < 3; axis++) {
      const value = positions[vertex * 3 + axis];
      min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
      f32Error = Math.max(f32Error, Math.abs(Math.fround(value) - value));
    }
  }
  const validIndices = indices.every(index => Number.isInteger(index) && index >= 0 && index < count);
  if (validIndices) for (let offset = 0; offset < indices.length; offset += 3) {
    const triangle = indices.slice(offset, offset + 3);
    const [a, b, c] = triangle.map(index => pointAt(positions, index));
    const normal = cross(subtract(b, a), subtract(c, a));
    minimumArea = Math.min(minimumArea, Math.hypot(...normal));
    for (const index of triangle) minimumOutwardDot = Math.min(minimumOutwardDot, dot(normal, pointAt(normals, index)));
  }
  return {
    count, triangles: indices.length / 3, normalError, minimumArea, minimumOutwardDot, f32Error,
    schema: packet.version === 0 && packet.revision === 0 && packet.lengthUnit === 'mm'
      && packet.coordinateSystem === 'right-handed-z-up' && packet.winding === 'ccw'
      && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(packet.surfaceId),
    arrays: [positions, normals, indices, parameters].every(dense) && Number.isInteger(count)
      && normals.length === positions.length && parameters.length === count * 2 && indices.length % 3 === 0,
    indices: validIndices,
    bounds: min.every((value, axis) => Object.is(value, packet.bounds.min[axis]))
      && max.every((value, axis) => Object.is(value, packet.bounds.max[axis])),
  };
}

/** Pure independent geometry checks; execution and acceptance belong to the root probe. */
export function geometryChecks(fixture, capsule, terrain) {
  const checks = [], metrics = { maxF32ComponentErrorMM: 0, maxCapsuleF32ComponentErrorMM: 0, maxNormalLengthError: 0,
    maxCapsuleRadiusErrorMM: 0, maxCapsuleAnalyticNormalError: 0, maxTerrainCornerErrorMM: 0,
    maxTerrainNormalError: 0, capsuleEdgeCount: 0, totalVertices: 0, totalIndices: 0 };
  const check = (name, passed, detail = null) => checks.push({ name, passed: passed === true, detail });
  try {
    const packets = [capsule, ...terrain.packets];
    check('object-cap', packets.length >= 1 && packets.length <= 4);
    check('unique-refs', new Set(packets.map(entry => `${entry.modelId}\0${entry.packet.surfaceId}`)).size === packets.length);
    check('unique-surface-ids', new Set(packets.map(entry => entry.packet.surfaceId)).size === packets.length);
    packets.forEach((entry, index) => {
      const proof = inspectPacket(entry.packet);
      metrics.maxF32ComponentErrorMM = Math.max(metrics.maxF32ComponentErrorMM, proof.f32Error);
      if (index === 0) metrics.maxCapsuleF32ComponentErrorMM = proof.f32Error;
      metrics.maxNormalLengthError = Math.max(metrics.maxNormalLengthError, proof.normalError);
      metrics.totalVertices += proof.count; metrics.totalIndices += entry.packet.indices.length;
      check(`packet-${index}-schema`, proof.schema && /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(entry.modelId));
      check(`packet-${index}-arrays`, proof.arrays);
      check(`packet-${index}-indices`, proof.indices);
      check(`packet-${index}-bounds`, proof.bounds);
      check(`packet-${index}-unit-normals`, proof.normalError <= 1e-5, proof.normalError);
      check(`packet-${index}-outward-nondegenerate`, proof.minimumArea > 0 && proof.minimumOutwardDot > 0);
    });
    check('aggregate-gpu-cap', metrics.totalVertices <= 4096 && metrics.totalIndices <= 24576);
    check('capsule-F32-mm-error', metrics.maxCapsuleF32ComponentErrorMM <= F32_TOLERANCE_MM, metrics.maxCapsuleF32ComponentErrorMM);

    const actor = capsule.packet, vertices = actor.positions.length / 3;
    check('capsule-identity-counts', capsule.modelId === 'physics-character' && actor.surfaceId === 'capsule-derived'
      && vertices === 386 && actor.indices.length === 768 * 3);
    check('capsule-exact-extents', equalData(actor.bounds, { min: [-150, -500, -150], max: [150, 500, 150] }));
    const levels = new Map(), edges = new Map();
    for (let index = 0; index < vertices; index++) {
      const point = pointAt(actor.positions, index), closestY = Math.min(350, Math.max(-350, point[1]));
      const outward = [point[0], point[1] - closestY, point[2]];
      metrics.maxCapsuleRadiusErrorMM = Math.max(metrics.maxCapsuleRadiusErrorMM, Math.abs(Math.hypot(...outward) - 150));
      metrics.maxCapsuleAnalyticNormalError = Math.max(metrics.maxCapsuleAnalyticNormalError,
        distance(outward.map(value => value / 150), pointAt(actor.normals, index)));
      if (index !== 0 && index !== vertices - 1) {
        const row = Math.floor((index - 1) / 24);
        if (!levels.has(row)) levels.set(row, []);
        levels.get(row).push(point);
      }
    }
    check('capsule-analytic-surface', metrics.maxCapsuleRadiusErrorMM <= GEOMETRY_TOLERANCE_MM
      && metrics.maxCapsuleAnalyticNormalError <= 1e-12);
    check('capsule-poles', equalData(pointAt(actor.positions, 0), [0, -500, 0])
      && equalData(pointAt(actor.positions, vertices - 1), [0, 500, 0]));
    let ringStructure = levels.size === 16;
    for (const [row, points] of levels) {
      ringStructure &&= points.length === 24 && points.every(point => point[1] === points[0][1]);
      const latitude = (row < 8 ? row - 7 : row - 8) * Math.PI / 16;
      const expectedY = (row < 8 ? -350 : 350) + 150 * Math.sin(latitude);
      ringStructure &&= Math.abs(points[0][1] - expectedY) <= GEOMETRY_TOLERANCE_MM;
      for (let sector = 0; sector < points.length; sector++) {
        const a = points[sector], b = points[(sector + 1) % points.length];
        const radialSquared = a[0] ** 2 + a[2] ** 2;
        ringStructure &&= Math.abs((a[0] * b[0] + a[2] * b[2]) / radialSquared - Math.cos(Math.PI / 12)) <= 1e-12
          && a[0] * b[2] - a[2] * b[0] > 0;
      }
    }
    check('capsule-16-by-24-rings-closed-seam', ringStructure);
    for (let offset = 0; offset < actor.indices.length; offset += 3) {
      const triangle = actor.indices.slice(offset, offset + 3);
      for (let side = 0; side < 3; side++) {
        const from = triangle[side], to = triangle[(side + 1) % 3];
        const key = `${Math.min(from, to)}:${Math.max(from, to)}`;
        const edge = edges.get(key) ?? { count: 0, balance: 0 };
        edge.count++; edge.balance += from < to ? 1 : -1; edges.set(key, edge);
      }
    }
    metrics.capsuleEdgeCount = edges.size;
    check('capsule-closed-oriented-topology', edges.size === 1152
      && [...edges.values()].every(edge => edge.count === 2 && edge.balance === 0)
      && vertices - edges.size + actor.indices.length / 3 === 2);

    const boxes = fixture.scene.boxes;
    check('terrain-complete-ledger', terrain.packets.length === boxes.length
      && terrain.sources.length === boxes.length && terrain.ledger.length === boxes.length);
    boxes.forEach((box, boxIndex) => {
      const entry = terrain.packets[boxIndex], source = terrain.sources[boxIndex], ledger = terrain.ledger[boxIndex];
      const packet = entry.packet;
      check(`terrain-${boxIndex}-identity`, ledger.boxIndex === boxIndex && ledger.boxId === box.id
        && ledger.targetId === `terrain:${box.id}` && entry.modelId === ledger.modelId
        && packet.surfaceId === ledger.surfaceId && source.modelId === entry.modelId
        && source.sourceFile === ledger.sourceFile && source.sourceVersion === 0
        && equalData(ledger.originalQueryBox, box) && equalData(source.originalQueryBox, box));
      check(`terrain-${boxIndex}-counts`, packet.positions.length === 24 * 3 && packet.indices.length === 12 * 3
        && ledger.vertexCount === 24 && ledger.triangleCount === 12
        && ledger.faces.length === 6 && source.faces.length === 6 && source.nativeModel.objects.length === 6);
      check(`terrain-${boxIndex}-native-model`, source.nativeModel.name === source.modelId
        && source.nativeModel.version === 0 && source.nativeModel.lengthUnit === 'mm');
      check(`terrain-${boxIndex}-six-roles`, new Set(ledger.faces.map(face => face.role)).size === 6
        && ['positive-x', 'negative-x', 'positive-y', 'negative-y', 'positive-z', 'negative-z']
          .every(role => ledger.faces.some(face => face.role === role)));
      ledger.faces.forEach((face, faceIndex) => {
        const surface = face.nativeSurface, expected = faceCorners(box, face.role);
        const corners = surface.controlPoints.flat();
        const displayed = Array.from({ length: 4 }, (_, vertex) => pointAt(packet.positions, faceIndex * 4 + vertex));
        const cornerError = Math.max(setError(corners, expected.corners), setError(displayed, expected.corners));
        metrics.maxTerrainCornerErrorMM = Math.max(metrics.maxTerrainCornerErrorMM, cornerError);
        check(`terrain-${boxIndex}-face-${faceIndex}-native`, surface.kind === 'surface' && surface.id === face.sourceFaceId
          && surface.degreeU === 1 && surface.degreeV === 1 && equalData(surface.knotsU, [0, 0, 1, 1])
          && equalData(surface.knotsV, [0, 0, 1, 1]) && equalData(surface.weights, [[1, 1], [1, 1]])
          && equalData(surface, source.nativeModel.objects[faceIndex]) && equalData(face, source.faces[faceIndex]));
        check(`terrain-${boxIndex}-face-${faceIndex}-corners`, cornerError <= GEOMETRY_TOLERANCE_MM, cornerError);
        const range = face.sourceRange;
        const declaration = source.source.slice(range.start, range.end);
        check(`terrain-${boxIndex}-face-${faceIndex}-source-range`, Number.isInteger(range.start) && Number.isInteger(range.end)
          && range.start >= 0 && range.end > range.start && range.end <= source.source.length
          && new RegExp(`^@surface\\s+#${face.sourceFaceId}\\s*\\{`).test(declaration)
          && /\}\s*$/.test(declaration));
        check(`terrain-${boxIndex}-face-${faceIndex}-ranges`, face.faceIndex === faceIndex
          && equalData(face.vertexRange, { start: faceIndex * 4, count: 4 })
          && equalData(face.indexRange, { start: faceIndex * 6, count: 6 })
          && equalData(face.triangleRange, { start: faceIndex * 2, count: 2 })
          && packet.indices.slice(faceIndex * 6, faceIndex * 6 + 6)
            .every(index => index >= faceIndex * 4 && index < faceIndex * 4 + 4));
        for (let vertex = 0; vertex < 4; vertex++) {
          metrics.maxTerrainNormalError = Math.max(metrics.maxTerrainNormalError,
            distance(pointAt(packet.normals, faceIndex * 4 + vertex), expected.normal));
        }
        const [a, b, c] = [corners[0], corners[2], corners[1]];
        check(`terrain-${boxIndex}-face-${faceIndex}-native-outward`, dot(cross(subtract(b, a), subtract(c, a)), expected.normal) > 0);
      });
    });
    check('terrain-analytic-normals', metrics.maxTerrainNormalError <= 1e-12, metrics.maxTerrainNormalError);
  } catch (error) {
    check('geometry-inspection-error', false, { name: error.name, message: error.message });
  }
  return { passed: checks.length > 0 && checks.every(value => value.passed), checks, metrics };
}
