import { classesFor } from '../../packages/barocss-render/src/contract.mjs';

export const BASE_CLASSES = [
  'min-h-screen', 'bg-slate-100', 'p-4', 'grid', 'grid-cols-1', 'md:grid-cols-2',
  'gap-2.5', 'gap-3.5', 'rounded-xl', 'p-3.5', 'p-5.5', 'bg-white', 'text-slate-900',
  'bg-slate-900', 'text-white', 'flex', 'flex-col', 'gap-2', 'font-semibold',
  'rounded-md', 'border', 'border-slate-400', 'px-2', 'py-1', 'bg-blue-600',
].join(' ');

export function Layout({ node, children }) {
  return <section data-node-id={node.props.id} className={classesFor(node)}>{children}</section>;
}
export function Card({ node, children }) {
  return <article data-node-id={node.props.id} className={`flex flex-col gap-2 ${classesFor(node)}`}>{children}</article>;
}
export function Text({ node }) {
  const Tag = node.props.id === 'heading' ? 'h2' : 'p';
  return <Tag data-node-id={node.props.id} className={node.props.id === 'heading' ? 'font-semibold' : ''}>{node.props.text}</Tag>;
}
export function Input({ node, value, onChange }) {
  return <label data-node-id={node.props.id}>{node.props.label}
    <input aria-label={node.props.label} className="rounded-md border border-slate-400 px-2 py-1"
      value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
  </label>;
}
export function Button({ node, onClick }) {
  return <button type="button" data-node-id={node.props.id} className="rounded-md bg-blue-600 px-2 py-1 text-white"
    onClick={onClick}>{node.props.label}</button>;
}
