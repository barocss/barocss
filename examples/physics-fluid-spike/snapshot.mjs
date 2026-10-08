import { writeFileSync } from 'node:fs';
import { VISUAL_BASIN_M, createFixture } from './fixture.mjs';
import { restDensity } from './metrics.mjs';
import { createPbf } from './pbf.mjs';
import { createSph } from './sph.mjs';

const count = 256;
const density = restDensity(createFixture(count).positions);
const methods = [['Pressure SPH spike', createSph], ['Density PBF spike', createPbf]];
const scaleX = 500;
const scaleY = 280;
const width = VISUAL_BASIN_M[0] * scaleX;
const height = VISUAL_BASIN_M[1] * scaleY;

function panel(label, create, left, steps) {
  const state = create(createFixture(count), density, VISUAL_BASIN_M);
  for (let step = 0; step < steps; step++) state.step();
  const circles = [];
  for (let index = 0; index < count; index++) {
    const offset = index * 3;
    const x = left + 28 + state.positions[offset] * scaleX;
    const y = 60 + (VISUAL_BASIN_M[1] - state.positions[offset + 1]) * scaleY;
    const opacity = (0.36 + 0.48 * state.positions[offset + 2] / VISUAL_BASIN_M[2]).toFixed(2);
    circles.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.2" fill="#31a9e0" fill-opacity="${opacity}"/>`);
  }
  return `<text x="${left + 28}" y="34" fill="#dceaf4" font-size="18">${label}</text>
    <rect x="${left + 28}" y="60" width="${width}" height="${height}" fill="#0c1c2b" stroke="#7f98a9"/>
    ${circles.join('\n')}`;
}

for (const [steps, filename] of [[60, 'solver-snapshot-256.svg'], [240, 'solver-settle-256.svg']]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 455">
    <rect width="1120" height="455" fill="#09131e"/>
    <text x="28" y="442" fill="#a7bac8" font-size="13">FLUID-00 compact-basin diagnostic X/Y projection · 256 particles · ${steps} steps · not Viewer</text>
    ${methods.map(([label, create], index) => panel(label, create, index * 560, steps)).join('\n')}
  </svg>`;
  writeFileSync(new URL(`./evidence/${filename}`, import.meta.url), svg);
}
