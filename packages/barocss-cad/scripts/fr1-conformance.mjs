// FR1 (D123): writes conformance/fr/'s member cases, every expected value by closed form here (not by the kernel).
// node scripts/fr1-conformance.mjs [dir]   (default: conformance/fr)
import { writeFileSync } from 'node:fs';
const dir = process.argv[2] ?? new URL('../conformance/fr', import.meta.url).pathname;
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const SP = 1 - Math.PI / 4, hyp = (a, b) => Math.hypot(...a.map((x, i) => b[i] - x)), mid = (a, b) => a.map((x, i) => (x + b[i]) / 2);
const write = (name, c) => writeFileSync(`${dir}/${name}.json`, JSON.stringify({ id: `fr-${name}`, step: 'FR', decisions: ['D123'], ...c }, null, 2) + '\n');
{ // a round-cornered rectangular tube on an oblique line
  const b = 40, h = 40, t = 3, ro = 6, ri = 3, p0 = [10, -20, 5], p1 = [310, 140, 205], L = hyp(p0, p1), k = 4 - Math.PI;
  const A = b * h - k * ro * ro - ((b - 2 * t) * (h - 2 * t) - k * ri * ri), Po = 2 * (b + h) - 8 * ro + 2 * Math.PI * ro, Pi = 2 * (b + h - 4 * t) - 8 * ri + 2 * Math.PI * ri;
  write('member-rect-tube-oblique', { about: 'FR1: a 40 × 40 × 3 rectangular tube, corners ro 6 (bore ri 3), along an oblique 3D line, anchored at its centroid: A·L, the centroid the line\'s midpoint, the surface (Po + Pi)·L + 2A, its role names.',
    input: { partDocument: D([{ id: 'm', kind: 'frame-member', section: { kind: 'rect-tube', width: b, height: h, wall: t, outerRadius: ro }, start: p0, end: p1 }]) },
    expect: { outputs: [{ volumeMM3: { value: A * L, relTol: 1e-9 }, centroidMM: { value: mid(p0, p1), absTol: 1e-9 }, areaMM2: { value: (Po + Pi) * L + 2 * A, relTol: 1e-12 }, bodies: 1, topology: [{ shells: 1, genus: 1 }],
      faceNames: ['m.bore.bottom', 'm.bore.left', 'm.bore.right', 'm.bore.round.bl', 'm.bore.round.br', 'm.bore.round.tl', 'm.bore.round.tr', 'm.bore.top', 'm.bottom', 'm.end', 'm.left', 'm.right', 'm.round.bl', 'm.round.br', 'm.round.tl', 'm.round.tr', 'm.start', 'm.top'],
      member: { areaMM2: A, lengthMM: L, centroid: [0, 0], derived: { innerRadius: 'concentric: ro − t' }, absTol: 1e-9 } }], stepRoundTrip: { relTol: 1e-9 } },
    oracle: 'Closed forms: A = bh − (4 − π)ro² − [(b − 2t)(h − 2t) − (4 − π)ri²], ri = ro − t (the bore concentric with the corners: a derived geometric rule, reported as such); a prism\'s volume A·L and centroid on its centroidal line\'s midpoint; perimeters 2(b + h) − 8r + 2πr outside and in the bore.' });
}
{ // an angle anchored at its heel along +Y: its centroidal line by the spandrel decomposition
  const a = 50, b = 30, t = 5, r1 = 6, r2 = 3, L = 400, s1 = SP * r1 * r1, s2 = SP * r2 * r2, c1 = r1 * (10 - 3 * Math.PI) / (3 * (4 - Math.PI)), c2 = r2 * (10 - 3 * Math.PI) / (3 * (4 - Math.PI));
  const A = t * (a + b - t) + SP * (r1 * r1 - 2 * r2 * r2);
  const cx = (a * t * a / 2 + t * (b - t) * t / 2 + s1 * (t + c1) - s2 * (a - c2) - s2 * (t - c2)) / A, cy = (a * t * t / 2 + t * (b - t) * (t + b) / 2 + s1 * (t + c1) - s2 * (t - c2) - s2 * (b - c2)) / A;
  // Along +Y, up +Z: the section's y is +Z, x = y × u = Z × Y = −X.
  write('member-angle-heel', { about: 'FR1: a 50 × 30 × 5 angle (root r1 6, toes r2 3) along +Y anchored at its heel: A·L, its centroid on the centroidal line (section x along −X, y along +Z), its role names.',
    input: { partDocument: D([{ id: 'm', kind: 'frame-member', section: { kind: 'angle', legX: a, legY: b, thickness: t, rootRadius: r1, toeRadius: r2 }, start: [0, 0, 0], end: [0, L, 0], anchor: 'origin' }]) },
    expect: { outputs: [{ volumeMM3: { value: A * L, relTol: 1e-9 }, centroidMM: { value: [-cx, L / 2, cy], absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 0 }],
      faceNames: ['m.back.x', 'm.back.y', 'm.end', 'm.end.x', 'm.end.y', 'm.face.x', 'm.face.y', 'm.root', 'm.start', 'm.toe.x', 'm.toe.y'],
      member: { areaMM2: A, lengthMM: L, centroid: [cx, cy], xAxis: [-1, 0, 0], yAxis: [0, 0, 1], absTol: 1e-9 } }], stepRoundTrip: { relTol: 1e-9 } },
    oracle: 'Closed forms: A = t(a + b − t) + (1 − π/4)(r1² − 2r2²); the centroid by moments of the two legs, the root\'s spandrel added and the toes\' taken off (a spandrel\'s centroid r(10 − 3π)/(3(4 − π)) from its corner).' });
}
{ // a channel turned 90° about its line
  const h = 80, b = 40, tw = 5, tf = 8, r = 7, L = 300, S = SP * r * r, c = r * (10 - 3 * Math.PI) / (3 * (4 - Math.PI)), A = h * tw + 2 * (b - tw) * tf + 2 * S;
  const cx = (h * tw * tw / 2 + 2 * (b - tw) * tf * (tw + b) / 2 + 2 * S * (tw + c)) / A;
  // Along +X, up +Z, roll 90: x = +Z, y = u × x = X × Z = −Y. Anchored at the centroid at [0, 0, 100].
  write('member-channel-roll', { about: 'FR1: an 80 × 40 channel (web 5, flanges 8, roots 7) along +X, turned 90° about its line: A·L, its frame (x +Z, y −Y) exact, its centroid on the line.',
    input: { partDocument: D([{ id: 'm', kind: 'frame-member', section: { kind: 'channel', height: h, width: b, web: tw, flange: tf, rootRadius: r }, start: [0, 0, 100], end: [L, 0, 100], roll: 90 }]) },
    expect: { outputs: [{ volumeMM3: { value: A * L, relTol: 1e-9 }, centroidMM: { value: [L / 2, 0, 100], absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 0 }],
      member: { areaMM2: A, lengthMM: L, centroid: [cx, h / 2], xAxis: [0, 0, 1], yAxis: [0, -1, 0], absTol: 1e-9 } }], stepRoundTrip: { relTol: 1e-9 } },
    oracle: 'Closed forms: A = h·tw + 2(b − tw)tf + 2(1 − π/4)r²; the centroid by moments (web, flanges, the roots\' spandrels); a quarter turn exact.' });
}
{ // a vertical round tube: up along the line, +X instead
  const d = 33.7, t = 2.6, L = 250, A = Math.PI / 4 * (d * d - (d - 2 * t) ** 2);
  write('member-round-tube-vertical', { about: 'FR1: a Ø33.7 × 2.6 round tube standing on Z: up is along the line, so the section\'s y is +X (reported); A·L; the surface π(d + d − 2t)·L + 2A.',
    input: { partDocument: D([{ id: 'm', kind: 'frame-member', section: { kind: 'round-tube', diameter: d, wall: t }, start: [5, 5, 0], end: [5, 5, L] }]) },
    expect: { outputs: [{ volumeMM3: { value: A * L, relTol: 1e-9 }, centroidMM: { value: [5, 5, L / 2], absTol: 1e-9 }, areaMM2: { value: Math.PI * (2 * d - 2 * t) * L + 2 * A, relTol: 1e-12 }, bodies: 1, topology: [{ shells: 1, genus: 1 }],
      faceNames: ['m.bore', 'm.end', 'm.outside', 'm.start'], member: { areaMM2: A, lengthMM: L, centroid: [0, 0], xAxis: [0, -1, 0], yAxis: [1, 0, 0], upFallback: [1, 0, 0], derived: null, absTol: 1e-9 } }], stepRoundTrip: { relTol: 1e-9 } },
    oracle: 'Closed forms: A = π(d² − (d − 2t)²)/4; the fallback by definition (x = y × u).' });
}
{ // a 20 × 40 T-slot
  const a = 20, wo = 6.2, tl = 1.8, wu = 11, ds = 6.1, bore = 4.2, L = 500, A = 2 * a * a - 6 * (wo * ds + (wu - wo) ** 2 / 4) - 2 * Math.PI * bore * bore / 4;
  write('member-tslot-2040', { about: 'FR1: a 20 × 40 T-slot section (six slots, two core bores; the tslot-20 library\'s estimate sizes) along +X: A·L; symmetric, so its centroid is the box\'s centre.',
    input: { partDocument: D([{ id: 'm', kind: 'frame-member', section: { kind: 'tslot', size: a, cells: 2, opening: wo, lip: tl, undercut: wu, depth: ds, bore }, start: [0, 0, 0], end: [L, 0, 0] }]) },
    expect: { outputs: [{ volumeMM3: { value: A * L, relTol: 1e-9 }, centroidMM: { value: [L / 2, 0, 0], absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 2 }], faceNamePattern: '^m\\.(start|end|core[01]|(top|bottom|left|right)\\.\\d|(t1|t2|r|b1|b2|l)\\.(lip[01]|under[01]|taper[01]|wall[01]|floor))$',
      member: { areaMM2: A, lengthMM: L, centroid: [a / 2, 0], absTol: 1e-9 } }], stepRoundTrip: { relTol: 1e-9 } },
    oracle: 'Closed forms: A = 2a² − 6(wo·ds + (wu − wo)²/4) − 2π(bore/2)² (a slot: its opening and two 45° wings); the section symmetric about its box\'s centre. Checked against the library part\'s own 3D Booleans in test/fr-1.test.mjs.' });
}
{ // a sketch section with a hole
  const L = 250, A = 600 - 16 * Math.PI, cx = (600 * 15 - 16 * Math.PI * 10) / A;
  write('member-sketch-section', { about: 'FR1: a member of a closed sketch (a 30 × 20 plate with a Ø8 hole) along +Y anchored at its bottom-left corner: A·L and the centroid by moments.',
    input: { partDocument: D([{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20], holes: [[{ kind: 'arc', start: [14, 10], center: [10, 10], direction: 'ccw' }]] },
      { id: 'm', kind: 'frame-member', section: { kind: 'sketch', sketch: 's' }, start: [0, 0, 0], end: [0, L, 0], anchor: 'bottom-left' }]) },
    // Along +Y, up +Z: x = −X, y = +Z; the box's bottom-left (0, 0) on the line.
    expect: { outputs: [{ volumeMM3: { value: A * L, relTol: 1e-9 }, centroidMM: { value: [-cx, L / 2, 10], absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 1 }],
      member: { areaMM2: A, lengthMM: L, centroid: [cx, 10], absTol: 1e-9 } }], stepRoundTrip: { relTol: 1e-9 } },
    oracle: 'Closed forms: A = 600 − 16π; x̄ = (600·15 − 16π·10)/A, ȳ = 10.' });
}
write('refuse-section-dimensions', { about: 'FR1: a rectangular tube whose wall leaves no bore is refused by name.', input: { partDocument: D([{ id: 'm', kind: 'frame-member', section: { kind: 'rect-tube', width: 40, height: 30, wall: 15, outerRadius: 0 }, start: [0, 0, 0], end: [100, 0, 0] }]) },
  expect: { error: { code: 'PARAMETER', messageIncludes: '[SECTION_DIMENSIONS] a wall 15 leaves no bore in 40 × 30' } }, oracle: 'By construction: 2t ≥ min(b, h).' });
write('refuse-segment-zero-length', { about: 'FR1: a member whose start and end coincide is refused by name.', input: { partDocument: D([{ id: 'm', kind: 'frame-member', section: { kind: 'round-tube', diameter: 30, wall: 2 }, start: [1, 2, 3], end: [1, 2, 3] }]) },
  expect: { error: { code: 'PARAMETER', messageIncludes: '[SEGMENT_ZERO_LENGTH]' } }, oracle: 'By construction.' });
