import test from 'node:test'
import assert from 'node:assert/strict'
import { exportIGES } from '../dist/index.js'

const curve = {
  kind: 'curve', id: 'circle', degree: 2, knots: [0, 0, 0, 1, 1, 1],
  controlPoints: [[10, 0, 0], [10, 10, 0], [0, 10, 0]], weights: [1, Math.SQRT1_2, 1],
}
const surface = {
  kind: 'surface', id: 'patch', degreeU: 1, degreeV: 1,
  knotsU: [2, 2, 5, 5], knotsV: [7, 7, 11, 11],
  controlPoints: [[[1, 2, 3], [4, 5, 6]], [[7, 8, 9], [10, 11, 12]]],
  weights: [[1, 2], [3, 4]],
}
const model = { name: 'exchange', version: 0, lengthUnit: 'mm', objects: [curve, surface] }
const rows = iges => iges.trimEnd().split('\n')
const sections = iges => {
  const result = { S: [], G: [], D: [], P: [], T: [] }
  for (const row of rows(iges)) result[row[72]].push(row)
  return result
}
const parameterValues = (iges, pointer) => sections(iges).P
  .filter(row => Number(row.slice(64, 72)) === pointer)
  .map(row => row.slice(0, 64)).join('').replace(/\s/g, '').replace(/;$/, '').split(',').map(Number)

test('IGES is deterministic ASCII with complete fixed-width records and correct pointer/count fields', () => {
  const first = exportIGES(model, ['circle', 'patch'])
  assert.deepEqual(first, exportIGES(model, ['circle', 'patch']))
  assert.match(first.iges, /^[\x20-\x7e\n]+$/)
  for (const row of rows(first.iges)) assert.equal(row.length, 80)
  const grouped = sections(first.iges)
  for (const [section, list] of Object.entries(grouped)) {
    assert.equal(first.report.records[section], list.length)
    list.forEach((row, index) => assert.equal(Number(row.slice(73)), index + 1))
  }
  for (let index = 0; index < first.report.objects.length; index++) {
    const entry = first.report.objects[index]
    const row = grouped.D[index * 2]
    const next = grouped.D[index * 2 + 1]
    assert.equal(Number(row.slice(0, 8)), entry.entity)
    assert.equal(Number(row.slice(8, 16)), entry.parameterPointer)
    assert.equal(Number(next.slice(24, 32)), entry.parameterRecords)
    const owned = grouped.P.filter(row => Number(row.slice(64, 72)) === entry.directoryPointer)
    assert.equal(owned.length, entry.parameterRecords)
    assert.equal(Number(owned[0].slice(73)), entry.parameterPointer)
  }
  const terminate = grouped.T[0]
  for (let index = 0; index < 4; index++) {
    const section = ['S', 'G', 'D', 'P'][index]
    assert.equal(terminate[index * 8], section)
    assert.equal(Number(terminate.slice(index * 8 + 1, index * 8 + 8)), grouped[section].length)
  }
  assert.equal(first.report.lengthUnit, 'mm')
  assert.equal(first.report.modelScale, 1)
  assert.equal(first.report.geometryLoss, 'none')
  assert.equal(first.report.nativeSourceIncluded, false)
  assert.equal(first.report.solid, false)
})

test('126 parameters retain rational weights, all coordinates, knots and domain', () => {
  const { iges, report } = exportIGES(model, ['circle'])
  const values = parameterValues(iges, 1)
  assert.deepEqual(values.slice(0, 7), [126, 2, 2, 0, 0, 0, 0])
  assert.deepEqual(values.slice(7, 13), curve.knots)
  assert.deepEqual(values.slice(13, 16), curve.weights)
  assert.deepEqual(values.slice(16, 25), curve.controlPoints.flat())
  assert.deepEqual(values.slice(25), [0, 1, 0, 0, 0])
  assert.deepEqual(report.objects[0].domainU, [0, 1])
})

test('128 serializes U fastest for asymmetric weights and poles, then U/V domain pairs', () => {
  const { iges, report } = exportIGES(model, ['patch'])
  const values = parameterValues(iges, 1)
  assert.deepEqual(values.slice(0, 10), [128, 1, 1, 1, 1, 0, 0, 0, 0, 0])
  assert.deepEqual(values.slice(10, 18), [...surface.knotsU, ...surface.knotsV])
  assert.deepEqual(values.slice(18, 22), [1, 3, 2, 4])
  assert.deepEqual(values.slice(22, 34), [1, 2, 3, 7, 8, 9, 4, 5, 6, 10, 11, 12])
  assert.deepEqual(values.slice(34), [2, 5, 7, 11])
  assert.deepEqual(report.objects[0].domainU, [2, 5])
  assert.deepEqual(report.objects[0].domainV, [7, 11])
})

test('selection is explicit, ordered, and full IDs remain in the report', () => {
  const long = { ...curve, id: 'curve_identifier_more_than_eight' }
  const exported = exportIGES({ ...model, objects: [long, surface] }, ['patch', long.id])
  assert.deepEqual(exported.report.objects.map(entry => entry.id), ['patch', long.id])
  assert.equal(exported.report.objects[1].directoryLabel, 'curve_id')
  assert.equal(exported.report.objects[1].directoryPointer, 3)
  assert.throws(() => exportIGES(model, []), /Select/)
  assert.throws(() => exportIGES(model, ['circle', 'circle']), /Select/)
  assert.throws(() => exportIGES(model, ['absent']), /Unknown/)
  assert.throws(() => exportIGES({ ...model, objects: [curve, curve] }, ['circle']), /Duplicate/)
})

test('rejects unsupported units/entities and invalid native geometry instead of approximating', () => {
  assert.throws(() => exportIGES({ ...model, lengthUnit: 'inch' }, ['circle']), /millimetre/)
  assert.throws(() => exportIGES({ ...model, version: 1 }, ['circle']), /version 0/)
  assert.throws(() => exportIGES({ ...model, objects: [{ ...curve, kind: 'solid' }] }, ['circle']), /Unsupported/)
  assert.throws(() => exportIGES({ ...model, objects: [{ ...curve, weights: [1, -1, 1] }] }, ['circle']))
  assert.throws(() => exportIGES({ ...model, objects: [{ ...curve, controlPoints: [[Infinity, 0, 0]] }] }, ['circle']))
  assert.throws(() => exportIGES({ ...model, name: '한글' }, ['circle']), /ASCII/)
})

test('global section contains exact Hollerith lengths and unit/scale fields', () => {
  const { iges } = exportIGES({ ...model, name: 'a,b;name' }, ['circle'])
  const globals = sections(iges).G.map(row => row.slice(0, 72)).join('')
  assert.match(globals, /1H,,1H;,/)
  assert.match(globals, /1\.0,2,2HMM,/)
  assert.match(globals, /14H20000101\.000000/)
  // Delimiters in a name are Hollerith content, not extra global parameters.
  assert.match(globals, /12Ha,b;name\.igs/)
})
