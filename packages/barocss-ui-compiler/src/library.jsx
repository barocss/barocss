import React from 'react';
import { UI_CLASSES } from '@barocss/ui-compiler/classes';

export function Layout({ children }) {
  return <section data-node-id="root" className={UI_CLASSES[0]}>{children}</section>;
}
export function Card({ children }) {
  return <article data-node-id="card" className={UI_CLASSES[1]}>{children}</article>;
}
export function Text({ children }) { return <p>{children}</p>; }
export function Input({ label, value, onChange }) {
  return <label>{label}<input aria-label={label} value={value} maxLength={80} onChange={onChange} /></label>;
}
export function Button({ children, disabled = false, onClick }) {
  return <button type="button" disabled={disabled} onClick={onClick}>{children}</button>;
}
