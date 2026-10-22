// Fits (R12c.2, D155): a tolerance class on a cylindrical face (or a key's width, O138), and a hole–shaft pair declared from two classed faces.
// The classes offered are the loaded tables' (none built in); evaluation checks each against its face and the pair at
// its limit sizes (engine/fits.ts).
import { isHoleClass } from '@barocss/cad';
import { classOf, fitClasses, keyFitRole, setFaceClass, setFitPair } from '../engine/fits';
import type { Command, Ctx } from './commands';

const ok = { ok: true as const };
const no = (reason: string) => ({ ok: false as const, reason });
/** The picked faces' names, and whether each is curved (a cylinder's candidate). */
const picked = (ctx: Ctx) => ctx.selection.faces.map(f => ctx.bodies[f.body]?.mesh.faces[f.face]).filter(f => f !== undefined);

const fitClass: Command = {
  id: 'fit-class', label: 'Fit class', icon: 'cad-fit', group: 'inspect', keywords: 'fit tolerance iso 286 limits',
  hint: 'A tolerance class on a cylindrical face, or on a key\'s, keyseat\'s or keyway\'s side for the key\'s width (a hole\'s capital letter, a shaft\'s small one), from your fit tables: its limits in the body\'s notes. None is built in',
  available: ctx => {
    if (!fitClasses(ctx.doc).length) return no('Load a fit table first (Library panel, FITS): none is built in.');
    const f = picked(ctx);
    // (O138: or a key's width — a planar side of a key, its keyseat or its hub's keyway.)
    return f.length === 1 && (f[0].kind === 'curved' && f[0].exact?.kind === 'cylinder' || f[0].kind === 'plane' && keyFitRole(ctx.doc, f[0].name)) ? ok : no('Pick one cylindrical face (a bore or a shaft), or a side of a key, its keyseat or its keyway (the key\'s width).');
  },
  fields: ctx => [{ key: 'class', label: 'Class', kind: 'choice', options: [...fitClasses(ctx.doc).map(c => ({ value: c, label: `${c} (${isHoleClass(c) ? 'hole' : 'shaft'})` })), { value: 'none', label: 'None (clear it)' }] }],
  defaults: ctx => { const f = picked(ctx)[0], all = fitClasses(ctx.doc); return { class: (f && classOf(ctx.doc, f.name)) ?? all[0] ?? 'none' }; },
  build: (ctx, v) => setFaceClass(ctx.doc, picked(ctx)[0].name, v.class === 'none' ? null : String(v.class)),
};

const fitPair: Command = {
  id: 'fit-pair', label: 'Fit pair', icon: 'cad-fit', group: 'inspect', keywords: 'fit pair mmc lmc',
  hint: 'Declare a hole and a shaft (two faces with fit classes) a fit: their clearance from your tables, and the pair at its limit sizes checked by an exact Boolean — a clearance fit the geometry contradicts is refused',
  available: ctx => {
    const f = picked(ctx);
    if (f.length !== 2) return no('Pick two cylindrical faces with fit classes: a bore and a shaft.');
    if (f.some(x => x.exact?.kind !== 'cylinder')) return no('A pair is two cylindrical faces: a key\'s width fit needs none (the key pairs its classes with its seat\'s and keyway\'s).');
    const c = f.map(x => classOf(ctx.doc, x.name));
    if (c.some(x => !x)) return no('Give both faces a fit class first (Fit class).');
    return isHoleClass(c[0]!) !== isHoleClass(c[1]!) ? ok : no('One face must carry a hole\'s class (H7), the other a shaft\'s (g6).');
  },
  fields: () => [{ key: 'op', label: 'Pair', kind: 'choice', options: [{ value: 'declare', label: 'Declare it' }, { value: 'remove', label: 'Remove it' }] }],
  defaults: () => ({ op: 'declare' }),
  build: (ctx, v) => {
    const f = picked(ctx), [hole, shaft] = isHoleClass(classOf(ctx.doc, f[0].name)!) ? [f[0].name, f[1].name] : [f[1].name, f[0].name];
    return setFitPair(ctx.doc, hole, shaft, v.op === 'remove');
  },
};

export const fitCommands: Command[] = [fitClass, fitPair];
