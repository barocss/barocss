import { profileMiddle, profileRings, loftSections } from './cur/packages/barocss-cad-model/src/app/profiles';
const W = { parameter: 'W' };
const a: any = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [W, 40] };
const b: any = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 20], plane: { origin: [0, 0, 10], normal: [0, 0, 1], xAxis: [1, 0, 0] } };
console.log('profileMiddle', JSON.stringify(profileMiddle(a)));
console.log('profileRings[0][1]', JSON.stringify(profileRings(a)[0][1]));
const s: any = loftSections([a, b], [0, 1]); console.log('loftSections', JSON.stringify('error' in s ? s : s.sections[0].node.segments));
