// The site structure: config renders it and check-docs validates every linked page.
// Every linked node keeps its writing lane, including parents with children.
export const sidebar = [
  {
    text: 'Introduction',
    collapsed: true,
    items: [
      { text: 'What BaroCSS CAD is', link: '/', lane: 'coordinator' },
      { text: 'Getting started', link: '/guide/getting-started', lane: 'outer' },
      { text: 'Concepts', link: '/guide/concepts', lane: 'coordinator' },
      { text: 'Robot motion', link: '/guide/robot-motion', lane: 'physics-motion-2276' },
      { text: 'How it works', link: '/how/', lane: 'kernel' },
    ],
  },
  {
    text: 'CAD',
    link: '/packages/cad/',
    lane: 'kernel',
    collapsed: true,
    items: [
      { text: 'Modeling API', link: '/packages/cad/modeling', lane: 'kernel' },
      { text: 'B-rep, robustness and refusals', link: '/packages/cad/robustness', lane: 'kernel' },
      { text: 'Boolean operations in 3D', link: '/packages/cad/robustness#build-the-result-in-3d-one-stage-at-a-time', lane: 'kernel' },
      { text: 'Exchange formats', link: '/packages/cad/formats', lane: 'kernel' },
      {
        text: 'Object API',
        link: '/packages/api',
        lane: 'API',
        collapsed: true,
        items: [
          { text: 'Actual API results', link: '/packages/api#see-actual-api-results', lane: 'API' },
          { text: 'CAD kernel part', link: '/packages/api#parts', lane: 'API' },
          { text: 'CAD model part', link: '/packages/api#studio-parts', lane: 'API' },
          { text: 'Parameters and configurations', link: '/packages/api#parameters-configurations-and-suppression', lane: 'API' },
          { text: 'Assemblies', link: '/packages/api#assemblies', lane: 'API' },
          { text: 'Manufacturing', link: '/packages/api#manufacturing-inputs-and-outputs', lane: 'API' },
          { text: 'Scenes', link: '/packages/api#scenes', lane: 'API' },
          { text: 'Errors', link: '/packages/api#errors', lane: 'API' },
        ],
      },
      {
        text: 'How it works',
        collapsed: true,
        items: [
          { text: 'Booleans of curved solids', link: '/how/boolean', lane: 'kernel' },
          { text: 'NURBS curves and surfaces', link: '/how/nurbs', lane: 'kernel' },
          { text: 'Tessellating a B-rep for display', link: '/how/tessellation', lane: 'kernel' },
          { text: 'Volume, centroid and inertia', link: '/how/mass-properties', lane: 'kernel' },
          { text: 'Fillets: the rolling ball', link: '/how/fillets', lane: 'kernel' },
          { text: 'Exact arithmetic for planar solids', link: '/how/exact-boolean', lane: 'kernel' },
          { text: 'Hidden lines for drawings', link: '/how/hidden-lines', lane: 'kernel' },
          { text: 'Booleans of upright extrusions', link: '/how/prismatic', lane: 'kernel' },
          { text: 'Meshes, native tools and the BVH', link: '/how/mesh-boolean', lane: 'kernel' },
          { text: 'Closest points on curves and surfaces', link: '/how/closest-point', lane: 'kernel' },
          { text: 'Where a curve meets a plane', link: '/how/curve-roots', lane: 'kernel' },
          { text: 'Threads, gears and springs', link: '/how/threads-gears', lane: 'kernel' },
          { text: 'Subdivision surfaces as exact B-splines', link: '/how/subd', lane: 'kernel' },
          { text: 'Sheet metal: bends and the flat pattern', link: '/how/sheet-metal', lane: 'kernel' },
          { text: 'Mesh processing: simplify, repair, offset', link: '/how/mesh-processing', lane: 'kernel' },
          { text: 'Tolerances and numbers', link: '/how/tolerance', lane: 'kernel' },
          { text: 'What makes a B-rep valid', link: '/how/validity', lane: 'kernel' },
          { text: 'Reading STEP and IGES', link: '/how/import', lane: 'kernel' },
          { text: 'How results are checked', link: '/how/verification', lane: 'kernel' },
        ],
      },
    ],
  },
  {
    text: 'CAD Model',
    link: '/packages/cad-model/',
    lane: 'outer',
    collapsed: true,
    items: [
      { text: 'Body transforms', link: '/packages/cad-model/#transforming-one-body', lane: 'outer' },
      { text: 'STL and source records', link: '/packages/cad-model/#stl-and-its-source-record', lane: 'outer' },
      { text: 'Solid lofts', link: '/packages/cad-model/#solid-lofts-with-a-copied-guide', lane: 'outer' },
      { text: 'Direct surfaces', link: '/packages/cad-model/#direct-sweep-and-loft-surfaces', lane: 'outer' },
      { text: 'Route bundles', link: '/packages/cad-model/#route-bundles-in-code', lane: 'outer' },
      { text: 'Assembly and robot motions', link: '/packages/cad-model/#assembly-and-robot-motions', lane: 'outer' },
      { text: 'Studio document', link: '/packages/cad-model/#the-studio-document', lane: 'outer' },
      {
        text: 'How it works',
        collapsed: true,
        items: [
          { text: 'Solving sketch constraints', link: '/how/sketch-solver', lane: 'kernel' },
          { text: 'Names that survive edits', link: '/how/naming', lane: 'kernel' },
          { text: 'Lofts, sweeps and revolves', link: '/how/loft-sweep', lane: 'kernel' },
          { text: 'Text from font outlines', link: '/how/text', lane: 'outer' },
          { text: 'Assemblies, robots and drawings', link: '/how/cad-model', lane: 'outer' },
          { text: 'Machining, printing and moulding checks', link: '/how/manufacturing-previews', lane: 'outer' },
        ],
      },
    ],
  },
  {
    text: 'CAD React',
    link: '/packages/cad-react/',
    lane: 'outer',
    collapsed: true,
    items: [
      {
        text: 'Components and props', link: '/packages/cad-react/components', lane: 'outer', collapsed: true,
        items: [
          { text: 'Part', link: '/packages/cad-react/components/part', lane: 'outer' },
          { text: 'Rectangle', link: '/packages/cad-react/components/rectangle', lane: 'outer' },
          { text: 'Circle', link: '/packages/cad-react/components/circle', lane: 'outer' },
          { text: 'Polygon', link: '/packages/cad-react/components/polygon', lane: 'outer' },
          { text: 'Loop', link: '/packages/cad-react/components/loop', lane: 'outer' },
          { text: 'LineSegment', link: '/packages/cad-react/components/line-segment', lane: 'outer' },
          { text: 'ArcSegment', link: '/packages/cad-react/components/arc-segment', lane: 'outer' },
          { text: 'Profile', link: '/packages/cad-react/components/profile', lane: 'outer' },
          { text: 'Outer', link: '/packages/cad-react/components/outer', lane: 'outer' },
          { text: 'Voids', link: '/packages/cad-react/components/voids', lane: 'outer' },
          { text: 'Extrude', link: '/packages/cad-react/components/extrude', lane: 'outer' },
          { text: 'Revolve', link: '/packages/cad-react/components/revolve', lane: 'outer' },
          { text: 'Union', link: '/packages/cad-react/components/union', lane: 'outer' },
          { text: 'Difference', link: '/packages/cad-react/components/difference', lane: 'outer' },
          { text: 'Target', link: '/packages/cad-react/components/target', lane: 'outer' },
          { text: 'Tools', link: '/packages/cad-react/components/tools', lane: 'outer' },
          { text: 'Definitions', link: '/packages/cad-react/components/definitions', lane: 'outer' },
          { text: 'Translate', link: '/packages/cad-react/components/translate', lane: 'outer' },
          { text: 'Rotate', link: '/packages/cad-react/components/rotate', lane: 'outer' },
        ],
      },
      { text: 'References and compiler', link: '/packages/cad-react/references', lane: 'outer' },
      { text: 'Engine and Viewer', link: '/packages/cad-react/engine-viewer', lane: 'outer' },
      { text: 'Examples', link: '/packages/cad-react/examples', lane: 'outer' },
      { text: 'CAD Model support map', link: '/packages/cad-react/support-map', lane: 'outer' },
      { text: 'Support boundaries', link: '/packages/cad-react/limits', lane: 'outer' },
    ],
  },
  {
    text: 'Physics',
    link: '/packages/physics/',
    lane: 'physics-motion-2276',
    collapsed: true,
    items: [
      { text: 'Units and frames', link: '/packages/physics/units-and-frames', lane: 'physics-motion-2276' },
      { text: 'Profiles and lifecycle', link: '/packages/physics/profiles-and-lifecycle', lane: 'physics-motion-2276' },
    ],
  },
  {
    text: 'GPU',
    link: '/packages/gpu/',
    lane: 'GPU',
    collapsed: true,
    items: [
      { text: 'PBR data maps', link: '/packages/gpu/#pbr-data-maps', lane: 'GPU' },
      { text: 'Lights and shadows', link: '/packages/gpu/#light-and-shadow-limits', lane: 'GPU' },
      { text: 'Capture and lifetime', link: '/packages/gpu/#capture-pixels-and-release-the-viewer', lane: 'GPU' },
      { text: 'Progressive stills', link: '/packages/gpu/#progressive-still-images', lane: 'GPU' },
      { text: 'Depth of field', link: '/packages/gpu/#depth-of-field', lane: 'GPU' },
      { text: 'Errors', link: '/packages/gpu/#errors', lane: 'GPU' },
      { text: 'WebGPU and WebGL2', link: '/packages/gpu/#webgpu-and-webgl2', lane: 'GPU' },
      {
        text: 'How it works',
        collapsed: true,
        items: [
          { text: 'Rendering a model on the GPU', link: '/how/gpu', lane: 'GPU' },
        ],
      },
    ],
  },
  {
    text: 'Studio',
    link: '/studio/',
    lane: 'outer',
    collapsed: true,
    items: [
      { text: 'Tour of the studio', link: '/studio/tour', lane: 'GPU' },
      {
        text: 'Modeling',
        link: '/studio/modeling',
        lane: 'outer',
        collapsed: true,
        items: [
          { text: 'Sketches', link: '/studio/sketches', lane: 'outer' },
          { text: 'Part features', link: '/studio/features', lane: 'outer' },
          { text: 'Parameters and configurations', link: '/studio/parameters', lane: 'outer' },
          { text: 'Frames and weldments', link: '/studio/frames', lane: 'outer' },
        ],
      },
      {
        text: 'Assemblies and robots',
        link: '/studio/assembly-workflows',
        lane: 'outer',
        collapsed: true,
        items: [
          { text: 'Assemblies and mates', link: '/studio/assemblies', lane: 'outer' },
          { text: 'Robots', link: '/studio/robots', lane: 'outer' },
        ],
      },
      {
        text: 'Drawings and manufacturing',
        link: '/studio/drawing-workflows',
        lane: 'outer',
        collapsed: true,
        items: [
          { text: 'Drawings', link: '/studio/drawings', lane: 'outer' },
          { text: 'BOM and quotes', link: '/studio/bom', lane: 'outer' },
          { text: 'Manufacturing', link: '/studio/manufacturing', lane: 'outer' },
          { text: 'Shop rows', link: '/studio/rows', lane: 'outer' },
        ],
      },
      {
        text: 'Display and rendering',
        link: '/studio/display-workflows',
        lane: 'outer',
        collapsed: true,
        items: [
          { text: 'Display, sections and analysis', link: '/studio/display', lane: 'GPU' },
          { text: 'Rendering', link: '/studio/rendering', lane: 'outer' },
        ],
      },
      {
        text: 'Files and projects',
        link: '/studio/file-workflows',
        lane: 'outer',
        collapsed: true,
        items: [
          { text: 'Files and exports', link: '/studio/files', lane: 'outer' },
          { text: 'Projects and versions', link: '/studio/projects', lane: 'data' },
        ],
      },
    ],
  },
  {
    text: 'Viewer',
    link: '/packages/viewer/',
    lane: 'GPU',
    collapsed: true,
    items: [
      { text: 'Review files', link: '/packages/viewer/#capture-and-apply', lane: 'GPU' },
      { text: 'Host lifetime', link: '/packages/viewer/#host-lifetime', lane: 'GPU' },
    ],
  },
  {
    text: 'AI agent',
    collapsed: true,
    items: [
      { text: 'Designing with the agent', link: '/agent/', lane: 'outer' },
      { text: 'Tools (v2 actions)', link: '/agent/tools', lane: 'outer' },
      { text: 'cad-mcp and cad-cli', link: '/agent/cli', lane: 'outer' },
      { text: 'Proposals and autonomy', link: '/agent/proposals', lane: 'outer' },
    ],
  },
  {
    text: 'Reference',
    collapsed: true,
    items: [
      { text: 'Refusal codes', link: '/reference/refusals', lane: 'outer' },
      { text: 'The .bcad document', link: '/reference/document', lane: 'outer' },
      { text: 'Rows file formats', link: '/reference/rows', lane: 'outer' },
      { text: 'Limits', link: '/reference/limits', lane: 'coordinator' },
      { text: 'How it is verified', link: '/reference/verification', lane: 'coordinator' },
      { text: 'Physics verification', link: '/reference/physics-verification', lane: 'physics-motion-2276' },
    ],
  },
];

// The full sidebar above is the canonical page/lane inventory.
// Topic routes use their owning category; the overview belongs to Guide.
function activeMatchFor(prefixes) {
  const patterns = prefixes.map(prefix => {
    if (prefix === '/') return '/';
    if (prefix === '/how/') return '/how/?';
    if (prefix.startsWith('/how/')) return `${prefix}/?`;
    return `${prefix.replace(/\/$/, '')}(?:/.*)?`;
  });
  return `^(?:${patterns.join('|')})$`;
}

export const navigationSections = [
  {
    text: 'Guide', link: '/guide/getting-started', group: 'Introduction',
    prefixes: [
      '/guide/',
      '/how/',
      '/',
    ],
  },
  {
    text: 'CAD', link: '/packages/cad/', group: 'CAD',
    prefixes: [
      '/packages/cad/',
      '/packages/api',
      '/how/boolean',
      '/how/nurbs',
      '/how/tessellation',
      '/how/mass-properties',
      '/how/fillets',
      '/how/exact-boolean',
      '/how/hidden-lines',
      '/how/prismatic',
      '/how/mesh-boolean',
      '/how/closest-point',
      '/how/curve-roots',
      '/how/threads-gears',
      '/how/subd',
      '/how/sheet-metal',
      '/how/mesh-processing',
      '/how/tolerance',
      '/how/validity',
      '/how/import',
      '/how/verification',
    ],
  },
  {
    text: 'CAD Model', link: '/packages/cad-model/', group: 'CAD Model',
    prefixes: [
      '/packages/cad-model/',
      '/how/sketch-solver',
      '/how/naming',
      '/how/loft-sweep',
      '/how/text',
      '/how/cad-model',
      '/how/manufacturing-previews',
    ],
  },
  {
    text: 'CAD React', link: '/packages/cad-react/', group: 'CAD React',
    prefixes: [
      '/packages/cad-react/',
    ],
  },
  {
    text: 'Physics', link: '/packages/physics/', group: 'Physics',
    prefixes: [
      '/packages/physics/',
    ],
  },
  {
    text: 'GPU', link: '/packages/gpu/', group: 'GPU',
    prefixes: [
      '/packages/gpu/',
      '/how/gpu',
    ],
  },
  {
    text: 'Studio', link: '/studio/', group: 'Studio',
    prefixes: [
      '/studio/',
    ],
  },
  {
    text: 'Viewer', link: '/packages/viewer/', group: 'Viewer',
    prefixes: [
      '/packages/viewer/',
    ],
  },
  {
    text: 'Agent', link: '/agent/', group: 'AI agent',
    prefixes: [
      '/agent/',
    ],
  },
  {
    text: 'Reference', link: '/reference/refusals', group: 'Reference',
    prefixes: [
      '/reference/',
    ],
  },
].map(section => ({ ...section, activeMatch: activeMatchFor(section.prefixes) }));

// VitePress sorts by path segment count, preserving insertion order for ties.
// Explicit /how/topic routes must precede the /how/ overview fallback.
const routeEntries = navigationSections.flatMap(section => {
  const group = sidebar.find(item => item.text === section.group);
  if (!group) throw new Error(`Missing sidebar group: ${section.group}`);
  return section.prefixes.map(prefix => [prefix, [group]]);
});
export const sidebarByRoute = Object.fromEntries([
  ...routeEntries.filter(([prefix]) => prefix.startsWith('/how/') && prefix !== '/how/'),
  ...routeEntries.filter(([prefix]) => !prefix.startsWith('/how/') || prefix === '/how/'),
]);
