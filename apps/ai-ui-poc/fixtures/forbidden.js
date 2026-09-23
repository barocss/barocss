import { BENCHMARK_FIXTURES } from './benchmark.js';

const base = () => structuredClone(BENCHMARK_FIXTURES[0].mockTree);

export const FORBIDDEN_FIXTURES = Object.freeze([
  { id: 'html-tag', mutate: (tree) => { tree.children[0].props.text = '<script>alert(1)</script>'; }, code: 'SCHEMA' },
  { id: 'event-attribute', mutate: (tree) => { tree.props.onclick = 'alert(1)'; }, code: 'SCHEMA' },
  { id: 'javascript-url', mutate: (tree) => { tree.children.push({ id: 'bad-image', component: 'Image', props: { src: 'javascript:alert(1)', alt: 'bad' }, classes: [], children: [] }); }, code: 'SCHEMA' },
  { id: 'external-image', mutate: (tree) => { tree.children.push({ id: 'bad-image', component: 'Image', props: { src: 'https://example.com/x.png', alt: 'bad' }, classes: [], children: [] }); }, code: 'SCHEMA' },
  { id: 'css-url', mutate: (tree) => { tree.classes.push('bg-[url(https://example.com/x)]'); }, code: 'REJECTED_CLASS' },
  { id: 'arbitrary-value', mutate: (tree) => { tree.classes.push('bg-[#ff0000]'); }, code: 'REJECTED_CLASS' },
  { id: 'unknown-variant', mutate: (tree) => { tree.classes.push('group-hover:block'); }, code: 'REJECTED_CLASS' },
  { id: 'unknown-component', mutate: (tree) => { tree.component = 'Script'; }, code: 'SCHEMA' },
  { id: 'excess-depth', mutate: (tree) => { let child = tree; for (let i = 0; i < 7; i++) { const next = { id: `deep-${i}`, component: 'Stack', props: {}, classes: [], children: [] }; child.children = [next]; child = next; } }, code: 'LIMIT' },
  { id: 'excess-size', mutate: (tree) => { tree.extra = 'x'.repeat(13000); }, code: 'LIMIT' },
].map((fixture) => Object.freeze({
  id: fixture.id,
  code: fixture.code,
  mockTree: (() => { const tree = base(); fixture.mutate(tree); return tree; })(),
})));
