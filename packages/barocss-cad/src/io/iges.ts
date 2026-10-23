import { validateCurve, validateSurface } from '../core/math.js'
import type { Curve, Model, Surface } from '../types.js'

export interface IGESObjectReport {
  id: string
  entity: 126 | 128
  directoryPointer: number
  parameterPointer: number
  parameterRecords: number
  domainU: [number, number]
  domainV?: [number, number]
  directoryLabel: string
}

export interface IGESExportReport {
  format: 'IGES 5.3 ASCII'
  model: string
  lengthUnit: 'mm'
  modelScale: 1
  geometryLoss: 'none'
  // IGES carries geometry only. Keep the native source and this full-ID map separately.
  nativeSourceIncluded: false
  solid: false
  objects: IGESObjectReport[]
  records: { S: number; G: number; D: number; P: number; T: number }
  timestampPolicy: 'fixed-20000101.000000'
}

function integer(value: number, width: number): string {
  const text = String(value)
  if (!Number.isSafeInteger(value) || value < 0 || text.length > width) {
    throw new RangeError('IGES integer field overflow')
  }
  return text.padStart(width, ' ')
}

function real(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError('IGES requires finite numbers')
  // The shortest round-trip decimal preserves each binary64 input. No rounding policy.
  const text = String(Object.is(value, -0) ? 0 : value).replace('e', 'E')
  return /[.E]/.test(text) ? text : `${text}.0`
}

function hollerith(value: string): string {
  if (!/^[\x20-\x7e]*$/.test(value) || value.length > 256) {
    throw new RangeError('IGES metadata must be printable ASCII, at most 256 characters')
  }
  return `${value.length}H${value}`
}

function record(body: string, section: string, sequence: number): string {
  if (body.length > 72) throw new RangeError('IGES record overflow')
  return body.padEnd(72, ' ') + section + integer(sequence, 7)
}

// Pack complete parameters when possible. Long Hollerith text continues at the next
// record without intervening padding, as required by its declared character count.
function pack(parameters: string[], width: number): string[] {
  const lines: string[] = []
  let current = ''
  for (let index = 0; index < parameters.length; index++) {
    let token = parameters[index] + (index === parameters.length - 1 ? ';' : ',')
    if (current && current.length + token.length > width) {
      lines.push(current.padEnd(width, ' '))
      current = ''
    }
    while (token.length > width) {
      lines.push(token.slice(0, width))
      token = token.slice(width)
    }
    current += token
  }
  if (current) lines.push(current.padEnd(width, ' '))
  return lines
}

function curveParameters(curve: Curve): string[] {
  const polynomial = curve.weights.every(weight => weight === curve.weights[0]) ? 1 : 0
  // General (nonplanar flag), open, nonperiodic curve. No plane restriction is added.
  const fields = [126, curve.controlPoints.length - 1, curve.degree, 0, 0, polynomial, 0]
  const data = [...curve.knots, ...curve.weights, ...curve.controlPoints.flat(),
    curve.knots[curve.degree], curve.knots[curve.controlPoints.length], 0, 0, 0]
  return [...fields.map(String), ...data.map(real)]
}

function surfaceParameters(surface: Surface): string[] {
  const nu = surface.controlPoints.length
  const nv = surface.controlPoints[0].length
  const weights: number[] = []
  const coordinates: number[] = []
  // Native grid is [u][v]. IGES 128 varies U fastest, for weights AND XYZ poles.
  for (let v = 0; v < nv; v++) {
    for (let u = 0; u < nu; u++) {
      weights.push(surface.weights[u][v])
      coordinates.push(...surface.controlPoints[u][v])
    }
  }
  const polynomial = weights.every(weight => weight === weights[0]) ? 1 : 0
  const fields = [128, nu - 1, nv - 1, surface.degreeU, surface.degreeV,
    0, 0, polynomial, 0, 0]
  const data = [...surface.knotsU, ...surface.knotsV, ...weights, ...coordinates,
    surface.knotsU[surface.degreeU], surface.knotsU[nu],
    surface.knotsV[surface.degreeV], surface.knotsV[nv]]
  return [...fields.map(String), ...data.map(real)]
}

/** Export explicitly selected native IDs, in caller order. No filesystem access. */
export function exportIGES(model: Model, ids: string[]): { iges: string; report: IGESExportReport } {
  if (model.version !== 0 || model.lengthUnit !== 'mm') {
    throw new RangeError('IGES export requires a version 0 millimetre model')
  }
  hollerith(model.name)
  if (!Array.isArray(model.objects) || model.objects.length < 1 || model.objects.length > 16) {
    throw new RangeError('Model must contain 1..16 objects')
  }
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 16 || new Set(ids).size !== ids.length) {
    throw new RangeError('Select 1..16 distinct object IDs')
  }
  const byId = new Map<string, Curve | Surface>()
  for (const object of model.objects) {
    if (typeof object.id !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(object.id) || object.id.length > 256) {
      throw new RangeError('Invalid native object ID')
    }
    if (byId.has(object.id)) throw new RangeError('Duplicate native object ID')
    if (object.kind === 'curve') validateCurve(object)
    else if (object.kind === 'surface') validateSurface(object)
    else throw new RangeError('Unsupported IGES entity kind')
    byId.set(object.id, object)
  }
  const selected = ids.map(id => {
    const object = byId.get(id)
    if (!object) throw new RangeError(`Unknown native object ID: ${id}`)
    return object
  })
  const directories: string[] = []
  const parameters: string[] = []
  const objects: IGESObjectReport[] = []
  let maximumCoordinate = 0
  for (const object of selected) {
    const type = object.kind === 'curve' ? 126 : 128
    const pointerD = directories.length + 1
    const pointerP = parameters.length + 1
    const chunks = pack(object.kind === 'curve' ? curveParameters(object) : surfaceParameters(object), 64)
    const label = object.id.slice(0, 8)
    const first = [type, pointerP, 0, 0, 0, 0, 0, 0].map(n => integer(n, 8)).join('') + '00000000'
    const second = [type, 0, 0, chunks.length, 0].map(n => integer(n, 8)).join('')
      + ' '.repeat(16) + label.padEnd(8, ' ') + integer(0, 8)
    directories.push(record(first, 'D', pointerD), record(second, 'D', pointerD + 1))
    for (const chunk of chunks) {
      parameters.push(record(chunk + integer(pointerD, 8), 'P', parameters.length + 1))
    }
    const points = object.kind === 'curve' ? object.controlPoints : object.controlPoints.flat()
    for (const point of points) for (const coordinate of point) {
      maximumCoordinate = Math.max(maximumCoordinate, Math.abs(coordinate))
    }
    const domainU: [number, number] = object.kind === 'curve'
      ? [object.knots[object.degree], object.knots[object.controlPoints.length]]
      : [object.knotsU[object.degreeU], object.knotsU[object.controlPoints.length]]
    objects.push({ id: object.id, entity: type, directoryPointer: pointerD,
      parameterPointer: pointerP, parameterRecords: chunks.length, directoryLabel: label, domainU,
      ...(object.kind === 'surface' ? { domainV: [object.knotsV[object.degreeV],
        object.knotsV[object.controlPoints[0].length]] as [number, number] } : {}) })
  }
  const date = hollerith('20000101.000000')
  const globals = pack([
    hollerith(','), hollerith(';'), hollerith('barocss-cad'), hollerith(`${model.name}.igs`),
    hollerith('barocss'), hollerith('cad-v0'), '32', '38', '6', '308', '17',
    hollerith('independent CAD consumer'), real(1), '2', hollerith('MM'), '1', real(0),
    date, real(1e-9), real(maximumCoordinate), hollerith('barocss'), hollerith('barocss'),
    '11', '0', date, hollerith(''),
  ], 72).map((body, index) => record(body, 'G', index + 1))
  const start = [record('barocss-cad v0: open rational B-spline geometry in MM', 'S', 1)]
  const records = { S: start.length, G: globals.length, D: directories.length, P: parameters.length, T: 1 }
  const terminate = record(['S', 'G', 'D', 'P'].map(section =>
    section + integer(records[section as 'S' | 'G' | 'D' | 'P'], 7)).join(''), 'T', 1)
  return { iges: [...start, ...globals, ...directories, ...parameters, terminate].join('\n') + '\n',
    report: { format: 'IGES 5.3 ASCII', model: model.name, lengthUnit: 'mm', modelScale: 1,
      geometryLoss: 'none', nativeSourceIncluded: false, solid: false, objects, records,
      timestampPolicy: 'fixed-20000101.000000' } }
}
