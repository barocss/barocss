import { copyNamedViews } from './review-file.js';

export function addNamedReview(entries, entry, scene) {
  return copyNamedViews([...copyNamedViews(entries, scene), entry], scene);
}

export function renameNamedReview(entries, name, nextName, scene) {
  const copied = copyNamedViews(entries, scene);
  const entry = copied.find(value => value.name === name);
  if (!entry) throw new RangeError('The saved view no longer exists.');
  entry.name = nextName;
  return copyNamedViews(copied, scene);
}

export function removeNamedReview(entries, name, scene) {
  const copied = copyNamedViews(entries, scene);
  if (!copied.some(value => value.name === name)) throw new RangeError('The saved view no longer exists.');
  return copied.filter(value => value.name !== name);
}

export function getNamedReview(entries, name, scene) {
  const entry = copyNamedViews(entries, scene).find(value => value.name === name);
  if (!entry) throw new RangeError('The saved view no longer exists.');
  return entry;
}

export function namedReviewCandidate(entry) {
  return { schema: 'barocss-viewer-measured-review', version: 1,
    review: entry.review, measurement: entry.measurement,
    ...(Object.hasOwn(entry, 'lighting') ? { lighting: entry.lighting } : {}) };
}
