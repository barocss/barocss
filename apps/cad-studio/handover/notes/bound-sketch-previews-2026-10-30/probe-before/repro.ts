// D357 reproduction: preview/command helpers on a parameter-bound sketch.
import { profileMiddle, profileRings, loftSections } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/app/profiles';
const bound: any = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'W' }, 40], id: 'n0' };
const top: any = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'W' }, 40], id: 'n1', plane: { origin: [0, 0, 30], normal: [0, 0, 1], xAxis: [1, 0, 0] } };
console.log('profileMiddle', JSON.stringify(profileMiddle(bound)));
console.log('profileRings', JSON.stringify(profileRings(bound)[0].slice(0, 2)));
const ls: any = loftSections([bound, top], [0, 1]);
console.log('loftSections', 'error' in ls ? ls.error : JSON.stringify(ls.sections.map((s: any) => s.node.segments ?? s.node.points ?? [s.node.min, s.node.max])));
