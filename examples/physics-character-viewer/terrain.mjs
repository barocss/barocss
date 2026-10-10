import { compileCadModel, tessellateSurface, validatePreviewPacket } from '@barocss/cad';

function decimal(value) {
  if (!Number.isFinite(value)) throw new RangeError('Terrain source coordinate must be finite');
  if (Object.is(value, -0)) return '-0';
  const text = String(value);
  if (!/[eE]/.test(text)) return text;
  const [coefficient, exponentText] = text.toLowerCase().split('e'), exponent = Number(exponentText);
  const negative = coefficient.startsWith('-'), unsigned = negative ? coefficient.slice(1) : coefficient;
  const [whole, fractional = ''] = unsigned.split('.'), digits = whole + fractional, split = whole.length + exponent;
  const expanded = split <= 0 ? '0.' + '0'.repeat(-split) + digits
    : split >= digits.length ? digits + '0'.repeat(split - digits.length) : digits.slice(0, split) + '.' + digits.slice(split);
  return (negative ? '-' : '') + expanded;
}
const list = values => '[' + values.map(decimal).join(',') + ']';
const poles = points => '[' + points.map(list).join(',') + ']';

function rotation(q) {
  const [x, y, z, w] = q, factor = 2 / (x * x + y * y + z * z + w * w);
  return [[1 - factor * (y * y + z * z), factor * (x * y - z * w), factor * (x * z + y * w)],
    [factor * (x * y + z * w), 1 - factor * (x * x + z * z), factor * (y * z - x * w)],
    [factor * (x * z - y * w), factor * (y * z + x * w), 1 - factor * (x * x + y * y)]];
}

// Each face stores [u][v] corners. Increasing U cross increasing V is the OUTWARD normal.
const FACE_CORNERS = [
  { role: 'positive-x', corners: [[[1,-1,-1],[1,-1,1]],[[1,1,-1],[1,1,1]]] },
  { role: 'negative-x', corners: [[[-1,-1,-1],[-1,1,-1]],[[-1,-1,1],[-1,1,1]]] },
  { role: 'positive-y', corners: [[[-1,1,-1],[1,1,-1]],[[-1,1,1],[1,1,1]]] },
  { role: 'negative-y', corners: [[[-1,-1,-1],[-1,-1,1]],[[1,-1,-1],[1,-1,1]]] },
  { role: 'positive-z', corners: [[[-1,-1,1],[-1,1,1]],[[1,-1,1],[1,1,1]]] },
  { role: 'negative-z', corners: [[[-1,-1,-1],[1,-1,-1]],[[-1,1,-1],[1,1,-1]]] },
];

function sameData(a, b) {
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return Object.is(a, b);
  const keys = Object.keys(a), other = Object.keys(b);
  return keys.length === other.length && keys.every(key => Object.hasOwn(b, key) && sameData(a[key], b[key]));
}

function authoredBox(box, boxIndex) {
  const modelId = `terrain_box_${boxIndex}`, matrix = rotation(box.orientationXYZW);
  const worldMM = signs => {
    const local = signs.map((sign, axis) => sign * box.halfExtentsM[axis]);
    return matrix.map((row, axis) => (row[0] * local[0] + row[1] * local[1] + row[2] * local[2] + box.centerM[axis]) * 1000);
  };
  const faces = FACE_CORNERS.map((face, faceIndex) => ({
    role: face.role,
    surface: {
      kind: 'surface', id: `box_${boxIndex}_face_${faceIndex}`, degreeU: 1, degreeV: 1,
      knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
      controlPoints: face.corners.map(row => row.map(worldMM)), weights: [[1, 1], [1, 1]],
    },
  }));
  const declarations = faces.map(({ surface }) => `  @surface #${surface.id} { type:nurbs; degree-u:1; degree-v:1; `
    + `knots-u:${list(surface.knotsU)}; knots-v:${list(surface.knotsV)}; `
    + `control-points:[${surface.controlPoints.map(poles).join(',')}]; weights:[[1,1],[1,1]]; }`);
  const source = `@model ${modelId} {\n  version:0; length-unit:mm;\n${declarations.join('\n')}\n}\n`;
  const compiled = compileCadModel(source, { sourceVersion: 0 });
  if (!compiled.ok) {
    const error = new Error('Actual six-face terrain Source0 compilation refused');
    error.diagnostics = structuredClone(compiled.diagnostics); throw error;
  }
  const expected = { name: modelId, version: 0, lengthUnit: 'mm', objects: faces.map(face => face.surface) };
  if (!sameData(compiled.model, expected)) throw new Error('Terrain native source did not retain every original coefficient and signed zero');
  return { modelId, source, faces, compiled };
}

/** Six native authored faces per unchanged query box; aggregate only for the bounded Viewer display. */
export function createTerrain(fixture) {
  const packets = [], sources = [], ledger = [];
  fixture.scene.boxes.forEach((box, boxIndex) => {
    const authored = authoredBox(box, boxIndex), positions = [], normals = [], indices = [], parameters = [], faceLedger = [];
    for (let faceIndex = 0; faceIndex < authored.faces.length; faceIndex++) {
      const nativeSurface = authored.compiled.model.objects[faceIndex];
      const sampled = tessellateSurface(nativeSurface, { countU: 2, countV: 2, revision: 0 });
      const vertexStart = positions.length / 3, indexStart = indices.length;
      positions.push(...sampled.packet.positions); normals.push(...sampled.packet.normals); parameters.push(...sampled.packet.parameters);
      indices.push(...sampled.packet.indices.map(index => index + vertexStart));
      const declaration = authored.compiled.ast.declarations.find(value => value.id === nativeSurface.id);
      faceLedger.push({
        faceIndex, role: authored.faces[faceIndex].role, sourceFaceId: nativeSurface.id,
        sourceRange: structuredClone(declaration.range), nativeSurface: structuredClone(nativeSurface),
        vertexRange: { start: vertexStart, count: sampled.packet.positions.length / 3 },
        indexRange: { start: indexStart, count: sampled.packet.indices.length },
        triangleRange: { start: indexStart / 3, count: sampled.packet.indices.length / 3 },
        tessellationReport: structuredClone(sampled.report),
      });
    }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let vertex = 0; vertex < positions.length / 3; vertex++) for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], positions[vertex * 3 + axis]); max[axis] = Math.max(max[axis], positions[vertex * 3 + axis]);
    }
    const packet = {
      version: 0, surfaceId: `terrain_${boxIndex}_derived`, revision: 0, lengthUnit: 'mm',
      coordinateSystem: 'right-handed-y-up', winding: 'ccw', positions, normals, indices, parameters, bounds: { min, max },
    };
    validatePreviewPacket(packet);
    const sourceFile = `terrain-box-${boxIndex}.cad`;
    packets.push({ modelId: authored.modelId, packet });
    sources.push({ sourceFile, sourceVersion: 0, source: authored.source, modelId: authored.modelId,
      nativeModel: structuredClone(authored.compiled.model), originalQueryBox: structuredClone(box), faces: structuredClone(faceLedger) });
    ledger.push({ boxIndex, boxId: box.id, targetId: `terrain:${box.id}`, sourceFile, modelId: authored.modelId,
      surfaceId: packet.surfaceId, originalQueryBox: structuredClone(box), faces: structuredClone(faceLedger),
      vertexCount: positions.length / 3, triangleCount: indices.length / 3 });
  });
  return { packets, sources, ledger };
}
