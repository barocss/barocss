import { compileCadModel, evaluateSurfaceCurvature } from '@barocss/cad';

export const FIXTURES = Object.freeze({
  cylinder: Object.freeze({ key: 'cylinder', modelId: 'cylinder_r2_input', surfaceId: 'cylinder_r2',
    source: { file: 'rational_cylinder_r2.original.source0.css', bytes: 298, sha256: 'dc7d319c61e9263b5a6918267231c710eb0c531cbee94a323ff396d4dd48ba8f' },
    queries: { file: 'rational_cylinder_r2.authored-queries.json', bytes: 477, sha256: 'f5c85cd6fd93964b123fecc6c44f96e57a1fd56c88a8c05ccbfdd6cdb98dd842' },
    results: { file: 'rational_cylinder_r2.results.json', bytes: 5373, sha256: 'e51aeb4c3bf126d7e392f611a9cfa4e6d19dad151606e38f324e42aab2793d0d' } }),
  sphere: Object.freeze({ key: 'sphere', modelId: 'sphere_r2_input', surfaceId: 'sphere_r2',
    source: { file: 'rational_sphere_r2_away_pole.original.source0.css', bytes: 379, sha256: 'fd480a515641a573fb8e28cb52389cfa8f5c66ad797e18059668509ec9078fe1' },
    queries: { file: 'rational_sphere_r2_away_pole.authored-queries.json', bytes: 568, sha256: '398d8be3a0ed56fdb5fd7cd5b2e938364fd0f885a5a6b09796eab9a4433faad1' },
    results: { file: 'rational_sphere_r2_away_pole.results.json', bytes: 7229, sha256: 'd101f15542d44bdcb2b5cc5ed35f5eba50ecc39723e36ff5e8ccf1f9999de1af' } }),
});
export function assertSame(actual, expected, context = 'Original native data') {
  if (actual === null || expected === null || typeof actual !== 'object' || typeof expected !== 'object') {
    if (!Object.is(actual, expected)) throw new Error(`${context} differs`);
    return;
  }
  const keys = Object.keys(actual);
  if (keys.length !== Object.keys(expected).length || keys.some(key => !Object.hasOwn(expected, key))) throw new Error(`${context} fields differ`);
  for (const key of keys) assertSame(actual[key], expected[key], `${context}.${key}`);
}

export const PINS = Object.freeze(Object.values(FIXTURES).flatMap(fixture => [fixture.source, fixture.queries, fixture.results]));
export const REFUSAL_KINDS = Object.freeze(['nan-u', 'infinite-v', 'outside-u', 'outside-v', 'invalid-surface', 'forged-reference', 'sphere']);

/** Only copied complete files are read; historical sourceFile metadata is not fetched. */
export async function loadFixtures(readText) {
  const texts = Object.fromEntries(await Promise.all(PINS.map(async pin => [pin.file, await readText(pin.file)])));
  const fixtures = { texts };
  for (const definition of Object.values(FIXTURES)) {
    const source = texts[definition.source.file], queries = JSON.parse(texts[definition.queries.file]), results = JSON.parse(texts[definition.results.file]);
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    if (!compiled.ok || compiled.model.name !== definition.modelId || compiled.model.objects.length !== 1) throw new Error('Authentic original Surface source did not compile');
    assertSame(compiled.model.objects[0], queries.geometry, 'Complete original Surface bits');
    fixtures[definition.key] = { source, queries, results, model: compiled.model };
  }
  return fixtures;
}

export function refusalAction(kind, inspection, fixtures) {
  if (!REFUSAL_KINDS.includes(kind)) throw new RangeError('Unknown Surface inspection refusal');
  return () => {
    if (kind === 'nan-u') return inspection.query(NaN, 2);
    if (kind === 'infinite-v') return inspection.query(-3, Infinity);
    if (kind === 'outside-u') return inspection.query(-4, 2);
    if (kind === 'outside-v') return inspection.query(-3, 6);
    if (kind === 'invalid-surface') return evaluateSurfaceCurvature({ ...structuredClone(inspection.originalSurface), degreeU: 0 }, -3, 2);
    if (kind === 'forged-reference') return inspection.query(-3, 2, structuredClone(inspection.originalSurface));
    return inspection.admit(fixtures.sphere.source, -3, 2);
  };
}
