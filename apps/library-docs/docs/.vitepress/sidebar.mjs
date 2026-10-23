// The site's structure, one place: the config reads it and scripts/check-docs.mjs checks every page in it exists.
// Each page names the lane that writes it (W1); the coordinator owns the structure.
export const sidebar = [
  {
    text: 'Introduction',
    items: [
      { text: 'What BaroCSS CAD is', link: '/', lane: 'coordinator' },
      { text: 'Getting started', link: '/guide/getting-started', lane: 'outer' },
      { text: 'Concepts', link: '/guide/concepts', lane: 'coordinator' },
    ],
  },
  {
    text: 'Studio',
    items: [
      { text: 'Tour of the studio', link: '/studio/tour', lane: 'GPU' },
      { text: 'Sketches', link: '/studio/sketches', lane: 'outer' },
      { text: 'Part features', link: '/studio/features', lane: 'outer' },
      { text: 'Parameters and configurations', link: '/studio/parameters', lane: 'outer' },
      { text: 'Assemblies and mates', link: '/studio/assemblies', lane: 'outer' },
      { text: 'Drawings', link: '/studio/drawings', lane: 'outer' },
      { text: 'BOM and quotes', link: '/studio/bom', lane: 'outer' },
      { text: 'Manufacturing', link: '/studio/manufacturing', lane: 'outer' },
      { text: 'Frames and weldments', link: '/studio/frames', lane: 'outer' },
      { text: 'Robots', link: '/studio/robots', lane: 'outer' },
      { text: 'Display, sections and analysis', link: '/studio/display', lane: 'GPU' },
      { text: 'Shop rows', link: '/studio/rows', lane: 'outer' },
      { text: 'Files and exports', link: '/studio/files', lane: 'outer' },
    ],
  },
  {
    text: 'AI agent',
    items: [
      { text: 'Designing with the agent', link: '/agent/', lane: 'outer' },
      { text: 'Tools (v2 actions)', link: '/agent/tools', lane: 'outer' },
      { text: 'cad-mcp and cad-cli', link: '/agent/cli', lane: 'outer' },
      { text: 'Proposals and autonomy', link: '/agent/proposals', lane: 'outer' },
    ],
  },
  {
    text: 'Packages',
    items: [
      { text: '@barocss/cad (kernel)', link: '/packages/cad/', lane: 'kernel' },
      { text: 'Modeling API', link: '/packages/cad/modeling', lane: 'kernel' },
      { text: 'B-rep, robustness and refusals', link: '/packages/cad/robustness', lane: 'kernel' },
      { text: 'Exchange formats', link: '/packages/cad/formats', lane: 'kernel' },
      { text: '@barocss/cad-model', link: '/packages/cad-model/', lane: 'outer' },
      { text: '@barocss/gpu', link: '/packages/gpu/', lane: 'GPU' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'Refusal codes', link: '/reference/refusals', lane: 'outer' },
      { text: 'The .bcad document', link: '/reference/document', lane: 'outer' },
      { text: 'Rows file formats', link: '/reference/rows', lane: 'outer' },
      { text: 'Limits', link: '/reference/limits', lane: 'coordinator' },
      { text: 'How it is verified', link: '/reference/verification', lane: 'coordinator' },
    ],
  },
];
