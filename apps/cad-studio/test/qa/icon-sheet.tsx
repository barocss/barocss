// Renders every CAD icon large and at rail size on one sheet (QA: node test/qa/icon-sheet.mjs out.html).
import { renderToStaticMarkup } from 'react-dom/server';
import { CAD_ICONS } from '../../src/ui/cadIcons';
import { writeFileSync } from 'node:fs';

const svg = (name: string, s: number) => renderToStaticMarkup(<svg className="cad-icon" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{CAD_ICONS[name]}</svg>);
const css = '.cad-icon{--icon-ac:#5aa2ff;--icon-bg:#2b2c31}.on .cad-icon{--icon-bg:#f5c542}.big .cad-icon{--icon-bg:#232428}.cad-icon .ac{stroke:var(--icon-ac)}.cad-icon .acf{fill:var(--icon-ac)}.on .cad-icon{--icon-ac:currentColor}';
const cells = Object.keys(CAD_ICONS).map(n => `<div class="c"><div class="big">${svg(n, 72)}</div><div class="row"><span>${svg(n, 20)}</span><span class="on">${svg(n, 20)}</span></div><div class="n">${n.slice(4)}</div></div>`).join('');
writeFileSync(process.argv[2], `<!doctype html><meta charset="utf-8"><style>body{background:#1b1c1f;color:#d7d9de;font:11px system-ui;margin:16px;display:grid;grid-template-columns:repeat(8,120px);gap:10px}.c{background:#232428;border-radius:8px;padding:8px;text-align:center}.row{display:flex;gap:8px;justify-content:center;margin-top:6px}.row span{display:inline-flex;padding:6px;border-radius:6px;background:#2b2c31}.row .on{background:#f5c542;color:#1d1e21}.n{margin-top:4px;color:#9a9ca3}${css}</style>${cells}`);
