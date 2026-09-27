// Hand-authored, deterministic Tailwind 4 technique inputs. No generated model content.
export const tiles = [
  ['linear-gradient', 'Gradient', 'bg-linear-to-r from-sky-400 via-indigo-500 to-fuchsia-500'],
  ['radial-gradient', 'Gradient', 'bg-radial from-amber-300 via-orange-500 to-rose-700'],
  ['conic-gradient', 'Gradient', 'bg-conic from-cyan-400 via-violet-500 to-cyan-400'],
  ['gradient-angle', 'Gradient', 'bg-linear-45 from-emerald-400 to-blue-600'],
  ['gradient-oklch', 'Gradient', 'bg-linear-to-r/oklch from-red-500 via-purple-500 to-blue-500'],
  ['gradient-alpha', 'Gradient', 'bg-linear-to-r from-sky-500/20 via-sky-500/80 to-sky-500'],
  ['shadow-xl', 'Shadow', 'bg-white shadow-xl'],
  ['shadow-color', 'Shadow', 'bg-white shadow-xl shadow-purple-500/50'],
  ['inset-shadow', 'Shadow', 'bg-white inset-shadow-sm inset-shadow-sky-500/50'],
  ['ring', 'Shadow', 'bg-white ring-4 ring-indigo-500/60'],
  ['inset-ring', 'Shadow', 'bg-white inset-ring-4 inset-ring-emerald-500/70'],
  ['backdrop-blur', 'Glass', 'bg-white/40 backdrop-blur-xl ring-1 ring-white/60'],
  ['blur', 'Filter', 'bg-violet-500 blur-sm'],
  ['drop-shadow', 'Filter', 'bg-white drop-shadow-xl'],
  ['contrast', 'Filter', 'bg-orange-500 contrast-150'],
  ['hue-rotate', 'Filter', 'bg-sky-500 hue-rotate-60'],
  ['mix-blend', 'Blend', 'bg-fuchsia-500 mix-blend-multiply'],
  ['bg-blend', 'Blend', 'bg-blend-multiply bg-[linear-gradient(45deg,#f59e0b_50%,transparent_50%),linear-gradient(135deg,#a855f7_50%,transparent_50%)]'],
  ['mask-linear', 'Mask', 'bg-blue-600 mask-linear-from-20% mask-linear-to-90%'],
  ['mask-radial', 'Mask', 'bg-rose-500 mask-radial-from-20% mask-radial-to-90%'],
  ['clip-polygon', 'Clip', "bg-teal-500 [clip-path:polygon(50%_0%,100%_100%,0%_100%)]"],
  ['perspective', '3D', 'bg-lime-400 perspective-[600px]'],
  ['rotate-x', '3D', 'bg-blue-500 rotate-x-30'],
  ['rotate-y', '3D', 'bg-rose-500 rotate-y-30'],
  ['transform-3d', '3D', 'bg-cyan-500 transform-3d rotate-x-30'],
  ['transition-colors', 'Motion', 'bg-purple-500 transition-colors duration-700 ease-in-out'],
  ['animate-pulse', 'Motion', 'bg-amber-500 animate-pulse'],
  ['animate-spin', 'Motion', 'bg-indigo-500 animate-spin'],
  ['theme-keyframes', 'Motion', 'bg-pink-500 animate-orbit'],
  ['container-query', 'Layout', '@container bg-white'],
  ['aspect-video', 'Layout', 'bg-cyan-600 aspect-video'],
  ['grid-areas', 'Layout', "grid bg-white [grid-template-areas:'a_a'_'b_c']"],
  ['subgrid', 'Layout', 'grid grid-cols-subgrid col-span-2 bg-white'],
  ['line-clamp', 'Type', 'bg-white line-clamp-3 text-slate-900'],
  ['text-gradient', 'Type', 'bg-linear-to-r from-sky-500 to-purple-600 bg-clip-text text-transparent text-3xl font-black'],
  ['text-shadow', 'Type', 'bg-white text-slate-700 text-shadow-lg'],
  ['scroll-snap', 'Interaction', 'bg-white snap-x snap-mandatory overflow-x-auto'],
  ['dark-mode', 'Color', 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white'],
  ['color-opacity', 'Color', 'bg-blue-500/35'],
  ['oklch-color', 'Color', 'bg-[oklch(60%_0.2_240)]'],
  ['fluid-type', 'Type', 'bg-white text-slate-900 text-[clamp(1rem,3vw,2rem)]'],
  ['theme-font', 'Type', 'bg-white text-slate-900 font-display text-2xl'],
].map(([id, group, classes]) => ({ id, group, classes }));

export function tileMarkup({ id, group, classes }) {
  const text = id === 'line-clamp' ? 'A thoughtful interface balances clarity, rhythm, contrast, and precise detail across every viewport. Long-form content must be constrained by the clamp itself, so this sentence continues beyond the third visible line.' : 'Visual detail';
  const children = id === 'scroll-snap'
    ? '<span class="snap-center shrink-0 w-32 h-16 bg-sky-300"></span><span class="snap-center shrink-0 w-32 h-16 bg-pink-300"></span>'
    : id === 'container-query'
      ? '<span data-probe class="@min-[150px]:bg-violet-500 h-16 w-24 rounded-xl"></span>'
      : id === 'grid-areas'
        ? '<span class="[grid-area:a] bg-cyan-200">A</span><span class="[grid-area:b] bg-pink-200">B</span><span class="[grid-area:c] bg-amber-200">C</span>'
        : id === 'subgrid'
          ? '<span class="bg-cyan-200">A</span><span class="bg-pink-200">B</span>'
          : id === 'perspective' ? '<span class="block h-16 w-24 rotate-y-30 bg-orange-300">3D</span>' : text;
  const extra = id === 'container-query' ? ' @container' : id === 'scroll-snap' ? ' gap-3' : '';
  if (id === 'subgrid') return `<section data-tile="${id}" class="tile"><span class="tile-label">${group} · ${id}</span><div class="tile-stage"><div class="grid grid-cols-2 w-48"><div data-probe class="${classes}">${children}</div></div></div></section>`;
  const sizing = id === 'line-clamp' ? ' w-48 text-left' : id === 'aspect-video' ? ' flex w-48 items-center justify-center' : ' flex w-48 h-24 items-center justify-center';
  return `<section data-tile="${id}" class="tile"><span class="tile-label">${group} · ${id}</span><div class="tile-stage"><div data-probe class="relative${sizing} rounded-xl p-3 ${classes}${extra}">${children}</div></div></section>`;
}

export const showcases = [
  { id: 'chat', width: 900, height: 680, html: `<main class="h-full bg-slate-950 p-8 text-slate-100"><div class="mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl"><header data-probe class="flex items-center justify-between border-b border-white/10 px-7 py-5"><div><p class="text-sm text-cyan-300">WORKSPACE / ASSISTANT</p><h1 class="mt-1 text-2xl font-semibold tracking-tight">Design review</h1></div><span class="rounded-full bg-emerald-400/15 px-4 py-2 text-sm text-emerald-300 ring-1 ring-emerald-300/30">Live session</span></header><div class="flex-1 space-y-5 overflow-hidden px-7 py-7"><div data-probe class="ml-auto max-w-md rounded-2xl bg-indigo-500 px-5 py-4 shadow-xl shadow-indigo-950/40">Show three options for a calm finance dashboard.</div><div data-probe class="max-w-xl rounded-2xl border border-white/10 bg-slate-800/70 px-5 py-4 leading-relaxed shadow-lg"><p class="font-semibold text-white">Here is a focused direction</p><p class="mt-2 text-slate-300">Clear hierarchy, restrained color, and a short path to the next decision.</p><div class="mt-5 grid grid-cols-3 gap-3"><span class="rounded-xl bg-cyan-400/10 p-3 text-cyan-200 ring-1 ring-cyan-400/20">01 · Overview</span><span class="rounded-xl bg-violet-400/10 p-3 text-violet-200 ring-1 ring-violet-400/20">02 · Trends</span><span class="rounded-xl bg-rose-400/10 p-3 text-rose-200 ring-1 ring-rose-400/20">03 · Actions</span></div></div></div><footer data-probe class="m-5 flex items-center gap-4 rounded-2xl border border-white/15 bg-slate-900 px-5 py-4 text-slate-400"><span class="flex-1">Ask a follow-up...</span><span class="rounded-xl bg-cyan-400 px-4 py-2 font-bold text-slate-950">Send</span></footer></div></main>` },
  { id: 'dashboard', width: 900, height: 680, html: `<main class="h-full bg-slate-100 p-8 text-slate-900"><div class="mx-auto h-full max-w-4xl"><header data-probe class="flex items-center justify-between"><div><p class="text-sm font-semibold tracking-widest text-indigo-600">NORTHSTAR / ANALYTICS</p><h1 class="mt-2 text-3xl font-black tracking-tight">Operations overview</h1></div><span class="rounded-full bg-white px-5 py-3 text-sm font-semibold shadow-sm ring-1 ring-slate-200">September 2026</span></header><div class="mt-8 grid grid-cols-3 gap-5"><article data-probe class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70 ring-1 ring-slate-200"><p class="text-sm text-slate-500">Revenue</p><p class="mt-3 text-4xl font-bold tracking-tight">$284k</p><p class="mt-4 text-sm text-emerald-600">▲ 12.8% this month</p></article><article data-probe class="rounded-3xl bg-indigo-600 p-6 text-white shadow-xl shadow-indigo-300/60"><p class="text-sm text-indigo-100">Active customers</p><p class="mt-3 text-4xl font-bold tracking-tight">18.4k</p><p class="mt-4 text-sm text-indigo-100">Across 24 markets</p></article><article data-probe class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70 ring-1 ring-slate-200"><p class="text-sm text-slate-500">Conversion</p><p class="mt-3 text-4xl font-bold tracking-tight">6.24%</p><p class="mt-4 text-sm text-emerald-600">▲ 0.7 points</p></article></div><section data-probe class="mt-6 rounded-3xl bg-white p-7 shadow-lg shadow-slate-200/70 ring-1 ring-slate-200"><div class="flex items-center justify-between"><h2 class="text-lg font-bold">Growth trend</h2><span class="text-sm text-slate-400">Last six months</span></div><div class="mt-8 flex h-48 items-end gap-5 border-b border-slate-200">${[35, 48, 42, 61, 73, 88, 78, 96, 84, 100].map((n,i) => `<div class="flex-1 rounded-t-xl ${i === 9 ? 'bg-indigo-600' : 'bg-indigo-200'} h-[${n}%]"></div>`).join('')}</div><div class="mt-3 flex justify-between text-xs text-slate-400"><span>APR</span><span>MAY</span><span>JUN</span><span>JUL</span><span>AUG</span><span>SEP</span></div></section></div></main>` },
];
