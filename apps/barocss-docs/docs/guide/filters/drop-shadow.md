# filter: drop-shadow()

Utilities for applying drop-shadow filters to an element.


## Quick reference

| Class | Styles |
|---|---|
| `drop-shadow-xs` | `filter: drop-shadow(var(--drop-shadow-xs));` |
| `drop-shadow-sm` | `filter: drop-shadow(var(--drop-shadow-sm));` |
| `drop-shadow-md` | `filter: drop-shadow(var(--drop-shadow-md));` |
| `drop-shadow-lg` | `filter: drop-shadow(var(--drop-shadow-lg));` |
| `drop-shadow-xl` | `filter: drop-shadow(var(--drop-shadow-xl));` |
| `drop-shadow-2xl` | `filter: drop-shadow(var(--drop-shadow-2xl));` |
| `drop-shadow-3xl` | `filter: drop-shadow(var(--drop-shadow-3xl));` |
| `drop-shadow-none` | `filter: drop-shadow(0 0 #0000);` |
| `drop-shadow-(&lt;custom-property&gt;)` | `filter: drop-shadow(var(&lt;custom-property&gt;));` |
| `drop-shadow-(color:&lt;custom-property&gt;)` | `--tw-drop-shadow-color: var(&lt;custom-property&gt;);` |
| `drop-shadow-[&lt;value&gt;]` | `filter: drop-shadow(&lt;value&gt;);` |
| `drop-shadow-inherit` | `--tw-drop-shadow-color: inherit;` |
| `drop-shadow-current` | `--tw-drop-shadow-color: currentColor;` |
| `drop-shadow-transparent` | `--tw-drop-shadow-color: transparent;` |
| `drop-shadow-black` | `--tw-drop-shadow-color: var(--color-black);` |
| `drop-shadow-white` | `--tw-drop-shadow-color: var(--color-white);` |
| `drop-shadow-slate-50` | `--tw-drop-shadow-color: var(--color-slate-50);` |
| `drop-shadow-slate-100` | `--tw-drop-shadow-color: var(--color-slate-100);` |
| `drop-shadow-slate-200` | `--tw-drop-shadow-color: var(--color-slate-200);` |
| `drop-shadow-slate-300` | `--tw-drop-shadow-color: var(--color-slate-300);` |
| `drop-shadow-slate-400` | `--tw-drop-shadow-color: var(--color-slate-400);` |
| `drop-shadow-slate-500` | `--tw-drop-shadow-color: var(--color-slate-500);` |
| `drop-shadow-slate-600` | `--tw-drop-shadow-color: var(--color-slate-600);` |
| `drop-shadow-slate-700` | `--tw-drop-shadow-color: var(--color-slate-700);` |
| `drop-shadow-slate-800` | `--tw-drop-shadow-color: var(--color-slate-800);` |
| `drop-shadow-slate-900` | `--tw-drop-shadow-color: var(--color-slate-900);` |
| `drop-shadow-slate-950` | `--tw-drop-shadow-color: var(--color-slate-950);` |
| `drop-shadow-gray-50` | `--tw-drop-shadow-color: var(--color-gray-50);` |
| `drop-shadow-gray-100` | `--tw-drop-shadow-color: var(--color-gray-100);` |
| `drop-shadow-gray-200` | `--tw-drop-shadow-color: var(--color-gray-200);` |
| `drop-shadow-gray-300` | `--tw-drop-shadow-color: var(--color-gray-300);` |
| `drop-shadow-gray-400` | `--tw-drop-shadow-color: var(--color-gray-400);` |
| `drop-shadow-gray-500` | `--tw-drop-shadow-color: var(--color-gray-500);` |
| `drop-shadow-gray-600` | `--tw-drop-shadow-color: var(--color-gray-600);` |
| `drop-shadow-gray-700` | `--tw-drop-shadow-color: var(--color-gray-700);` |
| `drop-shadow-gray-800` | `--tw-drop-shadow-color: var(--color-gray-800);` |
| `drop-shadow-gray-900` | `--tw-drop-shadow-color: var(--color-gray-900);` |
| `drop-shadow-gray-950` | `--tw-drop-shadow-color: var(--color-gray-950);` |
| `drop-shadow-zinc-50` | `--tw-drop-shadow-color: var(--color-zinc-50);` |
| `drop-shadow-zinc-100` | `--tw-drop-shadow-color: var(--color-zinc-100);` |
| `drop-shadow-zinc-200` | `--tw-drop-shadow-color: var(--color-zinc-200);` |
| `drop-shadow-zinc-300` | `--tw-drop-shadow-color: var(--color-zinc-300);` |
| `drop-shadow-zinc-400` | `--tw-drop-shadow-color: var(--color-zinc-400);` |
| `drop-shadow-zinc-500` | `--tw-drop-shadow-color: var(--color-zinc-500);` |
| `drop-shadow-zinc-600` | `--tw-drop-shadow-color: var(--color-zinc-600);` |
| `drop-shadow-zinc-700` | `--tw-drop-shadow-color: var(--color-zinc-700);` |
| `drop-shadow-zinc-800` | `--tw-drop-shadow-color: var(--color-zinc-800);` |
| `drop-shadow-zinc-900` | `--tw-drop-shadow-color: var(--color-zinc-900);` |
| `drop-shadow-zinc-950` | `--tw-drop-shadow-color: var(--color-zinc-950);` |
| `drop-shadow-neutral-50` | `--tw-drop-shadow-color: var(--color-neutral-50);` |
| `drop-shadow-neutral-100` | `--tw-drop-shadow-color: var(--color-neutral-100);` |
| `drop-shadow-neutral-200` | `--tw-drop-shadow-color: var(--color-neutral-200);` |
| `drop-shadow-neutral-300` | `--tw-drop-shadow-color: var(--color-neutral-300);` |
| `drop-shadow-neutral-400` | `--tw-drop-shadow-color: var(--color-neutral-400);` |
| `drop-shadow-neutral-500` | `--tw-drop-shadow-color: var(--color-neutral-500);` |
| `drop-shadow-neutral-600` | `--tw-drop-shadow-color: var(--color-neutral-600);` |
| `drop-shadow-neutral-700` | `--tw-drop-shadow-color: var(--color-neutral-700);` |
| `drop-shadow-neutral-800` | `--tw-drop-shadow-color: var(--color-neutral-800);` |
| `drop-shadow-neutral-900` | `--tw-drop-shadow-color: var(--color-neutral-900);` |
| `drop-shadow-neutral-950` | `--tw-drop-shadow-color: var(--color-neutral-950);` |
| `drop-shadow-stone-50` | `--tw-drop-shadow-color: var(--color-stone-50);` |
| `drop-shadow-stone-100` | `--tw-drop-shadow-color: var(--color-stone-100);` |
| `drop-shadow-stone-200` | `--tw-drop-shadow-color: var(--color-stone-200);` |
| `drop-shadow-stone-300` | `--tw-drop-shadow-color: var(--color-stone-300);` |
| `drop-shadow-stone-400` | `--tw-drop-shadow-color: var(--color-stone-400);` |
| `drop-shadow-stone-500` | `--tw-drop-shadow-color: var(--color-stone-500);` |
| `drop-shadow-stone-600` | `--tw-drop-shadow-color: var(--color-stone-600);` |
| `drop-shadow-stone-700` | `--tw-drop-shadow-color: var(--color-stone-700);` |
| `drop-shadow-stone-800` | `--tw-drop-shadow-color: var(--color-stone-800);` |
| `drop-shadow-stone-900` | `--tw-drop-shadow-color: var(--color-stone-900);` |
| `drop-shadow-stone-950` | `--tw-drop-shadow-color: var(--color-stone-950);` |
| `drop-shadow-red-50` | `--tw-drop-shadow-color: var(--color-red-50);` |
| `drop-shadow-red-100` | `--tw-drop-shadow-color: var(--color-red-100);` |
| `drop-shadow-red-200` | `--tw-drop-shadow-color: var(--color-red-200);` |
| `drop-shadow-red-300` | `--tw-drop-shadow-color: var(--color-red-300);` |
| `drop-shadow-red-400` | `--tw-drop-shadow-color: var(--color-red-400);` |
| `drop-shadow-red-500` | `--tw-drop-shadow-color: var(--color-red-500);` |
| `drop-shadow-red-600` | `--tw-drop-shadow-color: var(--color-red-600);` |
| `drop-shadow-red-700` | `--tw-drop-shadow-color: var(--color-red-700);` |
| `drop-shadow-red-800` | `--tw-drop-shadow-color: var(--color-red-800);` |
| `drop-shadow-red-900` | `--tw-drop-shadow-color: var(--color-red-900);` |
| `drop-shadow-red-950` | `--tw-drop-shadow-color: var(--color-red-950);` |
| `drop-shadow-orange-50` | `--tw-drop-shadow-color: var(--color-orange-50);` |
| `drop-shadow-orange-100` | `--tw-drop-shadow-color: var(--color-orange-100);` |
| `drop-shadow-orange-200` | `--tw-drop-shadow-color: var(--color-orange-200);` |
| `drop-shadow-orange-300` | `--tw-drop-shadow-color: var(--color-orange-300);` |
| `drop-shadow-orange-400` | `--tw-drop-shadow-color: var(--color-orange-400);` |
| `drop-shadow-orange-500` | `--tw-drop-shadow-color: var(--color-orange-500);` |
| `drop-shadow-orange-600` | `--tw-drop-shadow-color: var(--color-orange-600);` |
| `drop-shadow-orange-700` | `--tw-drop-shadow-color: var(--color-orange-700);` |
| `drop-shadow-orange-800` | `--tw-drop-shadow-color: var(--color-orange-800);` |
| `drop-shadow-orange-900` | `--tw-drop-shadow-color: var(--color-orange-900);` |
| `drop-shadow-orange-950` | `--tw-drop-shadow-color: var(--color-orange-950);` |
| `drop-shadow-amber-50` | `--tw-drop-shadow-color: var(--color-amber-50);` |
| `drop-shadow-amber-100` | `--tw-drop-shadow-color: var(--color-amber-100);` |
| `drop-shadow-amber-200` | `--tw-drop-shadow-color: var(--color-amber-200);` |
| `drop-shadow-amber-300` | `--tw-drop-shadow-color: var(--color-amber-300);` |
| `drop-shadow-amber-400` | `--tw-drop-shadow-color: var(--color-amber-400);` |
| `drop-shadow-amber-500` | `--tw-drop-shadow-color: var(--color-amber-500);` |
| `drop-shadow-amber-600` | `--tw-drop-shadow-color: var(--color-amber-600);` |
| `drop-shadow-amber-700` | `--tw-drop-shadow-color: var(--color-amber-700);` |
| `drop-shadow-amber-800` | `--tw-drop-shadow-color: var(--color-amber-800);` |
| `drop-shadow-amber-900` | `--tw-drop-shadow-color: var(--color-amber-900);` |
| `drop-shadow-amber-950` | `--tw-drop-shadow-color: var(--color-amber-950);` |
| `drop-shadow-yellow-50` | `--tw-drop-shadow-color: var(--color-yellow-50);` |
| `drop-shadow-yellow-100` | `--tw-drop-shadow-color: var(--color-yellow-100);` |
| `drop-shadow-yellow-200` | `--tw-drop-shadow-color: var(--color-yellow-200);` |
| `drop-shadow-yellow-300` | `--tw-drop-shadow-color: var(--color-yellow-300);` |
| `drop-shadow-yellow-400` | `--tw-drop-shadow-color: var(--color-yellow-400);` |
| `drop-shadow-yellow-500` | `--tw-drop-shadow-color: var(--color-yellow-500);` |
| `drop-shadow-yellow-600` | `--tw-drop-shadow-color: var(--color-yellow-600);` |
| `drop-shadow-yellow-700` | `--tw-drop-shadow-color: var(--color-yellow-700);` |
| `drop-shadow-yellow-800` | `--tw-drop-shadow-color: var(--color-yellow-800);` |
| `drop-shadow-yellow-900` | `--tw-drop-shadow-color: var(--color-yellow-900);` |
| `drop-shadow-yellow-950` | `--tw-drop-shadow-color: var(--color-yellow-950);` |
| `drop-shadow-lime-50` | `--tw-drop-shadow-color: var(--color-lime-50);` |
| `drop-shadow-lime-100` | `--tw-drop-shadow-color: var(--color-lime-100);` |
| `drop-shadow-lime-200` | `--tw-drop-shadow-color: var(--color-lime-200);` |
| `drop-shadow-lime-300` | `--tw-drop-shadow-color: var(--color-lime-300);` |
| `drop-shadow-lime-400` | `--tw-drop-shadow-color: var(--color-lime-400);` |
| `drop-shadow-lime-500` | `--tw-drop-shadow-color: var(--color-lime-500);` |
| `drop-shadow-lime-600` | `--tw-drop-shadow-color: var(--color-lime-600);` |
| `drop-shadow-lime-700` | `--tw-drop-shadow-color: var(--color-lime-700);` |
| `drop-shadow-lime-800` | `--tw-drop-shadow-color: var(--color-lime-800);` |
| `drop-shadow-lime-900` | `--tw-drop-shadow-color: var(--color-lime-900);` |
| `drop-shadow-lime-950` | `--tw-drop-shadow-color: var(--color-lime-950);` |
| `drop-shadow-green-50` | `--tw-drop-shadow-color: var(--color-green-50);` |
| `drop-shadow-green-100` | `--tw-drop-shadow-color: var(--color-green-100);` |
| `drop-shadow-green-200` | `--tw-drop-shadow-color: var(--color-green-200);` |
| `drop-shadow-green-300` | `--tw-drop-shadow-color: var(--color-green-300);` |
| `drop-shadow-green-400` | `--tw-drop-shadow-color: var(--color-green-400);` |
| `drop-shadow-green-500` | `--tw-drop-shadow-color: var(--color-green-500);` |
| `drop-shadow-green-600` | `--tw-drop-shadow-color: var(--color-green-600);` |
| `drop-shadow-green-700` | `--tw-drop-shadow-color: var(--color-green-700);` |
| `drop-shadow-green-800` | `--tw-drop-shadow-color: var(--color-green-800);` |
| `drop-shadow-green-900` | `--tw-drop-shadow-color: var(--color-green-900);` |
| `drop-shadow-green-950` | `--tw-drop-shadow-color: var(--color-green-950);` |
| `drop-shadow-emerald-50` | `--tw-drop-shadow-color: var(--color-emerald-50);` |
| `drop-shadow-emerald-100` | `--tw-drop-shadow-color: var(--color-emerald-100);` |
| `drop-shadow-emerald-200` | `--tw-drop-shadow-color: var(--color-emerald-200);` |
| `drop-shadow-emerald-300` | `--tw-drop-shadow-color: var(--color-emerald-300);` |
| `drop-shadow-emerald-400` | `--tw-drop-shadow-color: var(--color-emerald-400);` |
| `drop-shadow-emerald-500` | `--tw-drop-shadow-color: var(--color-emerald-500);` |
| `drop-shadow-emerald-600` | `--tw-drop-shadow-color: var(--color-emerald-600);` |
| `drop-shadow-emerald-700` | `--tw-drop-shadow-color: var(--color-emerald-700);` |
| `drop-shadow-emerald-800` | `--tw-drop-shadow-color: var(--color-emerald-800);` |
| `drop-shadow-emerald-900` | `--tw-drop-shadow-color: var(--color-emerald-900);` |
| `drop-shadow-emerald-950` | `--tw-drop-shadow-color: var(--color-emerald-950);` |
| `drop-shadow-teal-50` | `--tw-drop-shadow-color: var(--color-teal-50);` |
| `drop-shadow-teal-100` | `--tw-drop-shadow-color: var(--color-teal-100);` |
| `drop-shadow-teal-200` | `--tw-drop-shadow-color: var(--color-teal-200);` |
| `drop-shadow-teal-300` | `--tw-drop-shadow-color: var(--color-teal-300);` |
| `drop-shadow-teal-400` | `--tw-drop-shadow-color: var(--color-teal-400);` |
| `drop-shadow-teal-500` | `--tw-drop-shadow-color: var(--color-teal-500);` |
| `drop-shadow-teal-600` | `--tw-drop-shadow-color: var(--color-teal-600);` |
| `drop-shadow-teal-700` | `--tw-drop-shadow-color: var(--color-teal-700);` |
| `drop-shadow-teal-800` | `--tw-drop-shadow-color: var(--color-teal-800);` |
| `drop-shadow-teal-900` | `--tw-drop-shadow-color: var(--color-teal-900);` |
| `drop-shadow-teal-950` | `--tw-drop-shadow-color: var(--color-teal-950);` |
| `drop-shadow-cyan-50` | `--tw-drop-shadow-color: var(--color-cyan-50);` |
| `drop-shadow-cyan-100` | `--tw-drop-shadow-color: var(--color-cyan-100);` |
| `drop-shadow-cyan-200` | `--tw-drop-shadow-color: var(--color-cyan-200);` |
| `drop-shadow-cyan-300` | `--tw-drop-shadow-color: var(--color-cyan-300);` |
| `drop-shadow-cyan-400` | `--tw-drop-shadow-color: var(--color-cyan-400);` |
| `drop-shadow-cyan-500` | `--tw-drop-shadow-color: var(--color-cyan-500);` |
| `drop-shadow-cyan-600` | `--tw-drop-shadow-color: var(--color-cyan-600);` |
| `drop-shadow-cyan-700` | `--tw-drop-shadow-color: var(--color-cyan-700);` |
| `drop-shadow-cyan-800` | `--tw-drop-shadow-color: var(--color-cyan-800);` |
| `drop-shadow-cyan-900` | `--tw-drop-shadow-color: var(--color-cyan-900);` |
| `drop-shadow-cyan-950` | `--tw-drop-shadow-color: var(--color-cyan-950);` |
| `drop-shadow-sky-50` | `--tw-drop-shadow-color: var(--color-sky-50);` |
| `drop-shadow-sky-100` | `--tw-drop-shadow-color: var(--color-sky-100);` |
| `drop-shadow-sky-200` | `--tw-drop-shadow-color: var(--color-sky-200);` |
| `drop-shadow-sky-300` | `--tw-drop-shadow-color: var(--color-sky-300);` |
| `drop-shadow-sky-400` | `--tw-drop-shadow-color: var(--color-sky-400);` |
| `drop-shadow-sky-500` | `--tw-drop-shadow-color: var(--color-sky-500);` |
| `drop-shadow-sky-600` | `--tw-drop-shadow-color: var(--color-sky-600);` |
| `drop-shadow-sky-700` | `--tw-drop-shadow-color: var(--color-sky-700);` |
| `drop-shadow-sky-800` | `--tw-drop-shadow-color: var(--color-sky-800);` |
| `drop-shadow-sky-900` | `--tw-drop-shadow-color: var(--color-sky-900);` |
| `drop-shadow-sky-950` | `--tw-drop-shadow-color: var(--color-sky-950);` |
| `drop-shadow-blue-50` | `--tw-drop-shadow-color: var(--color-blue-50);` |
| `drop-shadow-blue-100` | `--tw-drop-shadow-color: var(--color-blue-100);` |
| `drop-shadow-blue-200` | `--tw-drop-shadow-color: var(--color-blue-200);` |
| `drop-shadow-blue-300` | `--tw-drop-shadow-color: var(--color-blue-300);` |
| `drop-shadow-blue-400` | `--tw-drop-shadow-color: var(--color-blue-400);` |
| `drop-shadow-blue-500` | `--tw-drop-shadow-color: var(--color-blue-500);` |
| `drop-shadow-blue-600` | `--tw-drop-shadow-color: var(--color-blue-600);` |
| `drop-shadow-blue-700` | `--tw-drop-shadow-color: var(--color-blue-700);` |
| `drop-shadow-blue-800` | `--tw-drop-shadow-color: var(--color-blue-800);` |
| `drop-shadow-blue-900` | `--tw-drop-shadow-color: var(--color-blue-900);` |
| `drop-shadow-blue-950` | `--tw-drop-shadow-color: var(--color-blue-950);` |
| `drop-shadow-indigo-50` | `--tw-drop-shadow-color: var(--color-indigo-50);` |
| `drop-shadow-indigo-100` | `--tw-drop-shadow-color: var(--color-indigo-100);` |
| `drop-shadow-indigo-200` | `--tw-drop-shadow-color: var(--color-indigo-200);` |
| `drop-shadow-indigo-300` | `--tw-drop-shadow-color: var(--color-indigo-300);` |
| `drop-shadow-indigo-400` | `--tw-drop-shadow-color: var(--color-indigo-400);` |
| `drop-shadow-indigo-500` | `--tw-drop-shadow-color: var(--color-indigo-500);` |
| `drop-shadow-indigo-600` | `--tw-drop-shadow-color: var(--color-indigo-600);` |
| `drop-shadow-indigo-700` | `--tw-drop-shadow-color: var(--color-indigo-700);` |
| `drop-shadow-indigo-800` | `--tw-drop-shadow-color: var(--color-indigo-800);` |
| `drop-shadow-indigo-900` | `--tw-drop-shadow-color: var(--color-indigo-900);` |
| `drop-shadow-indigo-950` | `--tw-drop-shadow-color: var(--color-indigo-950);` |
| `drop-shadow-violet-50` | `--tw-drop-shadow-color: var(--color-violet-50);` |
| `drop-shadow-violet-100` | `--tw-drop-shadow-color: var(--color-violet-100);` |
| `drop-shadow-violet-200` | `--tw-drop-shadow-color: var(--color-violet-200);` |
| `drop-shadow-violet-300` | `--tw-drop-shadow-color: var(--color-violet-300);` |
| `drop-shadow-violet-400` | `--tw-drop-shadow-color: var(--color-violet-400);` |
| `drop-shadow-violet-500` | `--tw-drop-shadow-color: var(--color-violet-500);` |
| `drop-shadow-violet-600` | `--tw-drop-shadow-color: var(--color-violet-600);` |
| `drop-shadow-violet-700` | `--tw-drop-shadow-color: var(--color-violet-700);` |
| `drop-shadow-violet-800` | `--tw-drop-shadow-color: var(--color-violet-800);` |
| `drop-shadow-violet-900` | `--tw-drop-shadow-color: var(--color-violet-900);` |
| `drop-shadow-violet-950` | `--tw-drop-shadow-color: var(--color-violet-950);` |
| `drop-shadow-purple-50` | `--tw-drop-shadow-color: var(--color-purple-50);` |
| `drop-shadow-purple-100` | `--tw-drop-shadow-color: var(--color-purple-100);` |
| `drop-shadow-purple-200` | `--tw-drop-shadow-color: var(--color-purple-200);` |
| `drop-shadow-purple-300` | `--tw-drop-shadow-color: var(--color-purple-300);` |
| `drop-shadow-purple-400` | `--tw-drop-shadow-color: var(--color-purple-400);` |
| `drop-shadow-purple-500` | `--tw-drop-shadow-color: var(--color-purple-500);` |
| `drop-shadow-purple-600` | `--tw-drop-shadow-color: var(--color-purple-600);` |
| `drop-shadow-purple-700` | `--tw-drop-shadow-color: var(--color-purple-700);` |
| `drop-shadow-purple-800` | `--tw-drop-shadow-color: var(--color-purple-800);` |
| `drop-shadow-purple-900` | `--tw-drop-shadow-color: var(--color-purple-900);` |
| `drop-shadow-purple-950` | `--tw-drop-shadow-color: var(--color-purple-950);` |
| `drop-shadow-fuchsia-50` | `--tw-drop-shadow-color: var(--color-fuchsia-50);` |
| `drop-shadow-fuchsia-100` | `--tw-drop-shadow-color: var(--color-fuchsia-100);` |
| `drop-shadow-fuchsia-200` | `--tw-drop-shadow-color: var(--color-fuchsia-200);` |
| `drop-shadow-fuchsia-300` | `--tw-drop-shadow-color: var(--color-fuchsia-300);` |
| `drop-shadow-fuchsia-400` | `--tw-drop-shadow-color: var(--color-fuchsia-400);` |
| `drop-shadow-fuchsia-500` | `--tw-drop-shadow-color: var(--color-fuchsia-500);` |
| `drop-shadow-fuchsia-600` | `--tw-drop-shadow-color: var(--color-fuchsia-600);` |
| `drop-shadow-fuchsia-700` | `--tw-drop-shadow-color: var(--color-fuchsia-700);` |
| `drop-shadow-fuchsia-800` | `--tw-drop-shadow-color: var(--color-fuchsia-800);` |
| `drop-shadow-fuchsia-900` | `--tw-drop-shadow-color: var(--color-fuchsia-900);` |
| `drop-shadow-fuchsia-950` | `--tw-drop-shadow-color: var(--color-fuchsia-950);` |
| `drop-shadow-pink-50` | `--tw-drop-shadow-color: var(--color-pink-50);` |
| `drop-shadow-pink-100` | `--tw-drop-shadow-color: var(--color-pink-100);` |
| `drop-shadow-pink-200` | `--tw-drop-shadow-color: var(--color-pink-200);` |
| `drop-shadow-pink-300` | `--tw-drop-shadow-color: var(--color-pink-300);` |
| `drop-shadow-pink-400` | `--tw-drop-shadow-color: var(--color-pink-400);` |
| `drop-shadow-pink-500` | `--tw-drop-shadow-color: var(--color-pink-500);` |
| `drop-shadow-pink-600` | `--tw-drop-shadow-color: var(--color-pink-600);` |
| `drop-shadow-pink-700` | `--tw-drop-shadow-color: var(--color-pink-700);` |
| `drop-shadow-pink-800` | `--tw-drop-shadow-color: var(--color-pink-800);` |
| `drop-shadow-pink-900` | `--tw-drop-shadow-color: var(--color-pink-900);` |
| `drop-shadow-pink-950` | `--tw-drop-shadow-color: var(--color-pink-950);` |
| `drop-shadow-rose-50` | `--tw-drop-shadow-color: var(--color-rose-50);` |
| `drop-shadow-rose-100` | `--tw-drop-shadow-color: var(--color-rose-100);` |
| `drop-shadow-rose-200` | `--tw-drop-shadow-color: var(--color-rose-200);` |
| `drop-shadow-rose-300` | `--tw-drop-shadow-color: var(--color-rose-300);` |
| `drop-shadow-rose-400` | `--tw-drop-shadow-color: var(--color-rose-400);` |
| `drop-shadow-rose-500` | `--tw-drop-shadow-color: var(--color-rose-500);` |
| `drop-shadow-rose-600` | `--tw-drop-shadow-color: var(--color-rose-600);` |
| `drop-shadow-rose-700` | `--tw-drop-shadow-color: var(--color-rose-700);` |
| `drop-shadow-rose-800` | `--tw-drop-shadow-color: var(--color-rose-800);` |
| `drop-shadow-rose-900` | `--tw-drop-shadow-color: var(--color-rose-900);` |
| `drop-shadow-rose-950` | `--tw-drop-shadow-color: var(--color-rose-950);` |

## Examples

### Basic example

```html
<img class="drop-shadow-sm" src="/img/mountains.jpg" />
<img class="drop-shadow-lg" src="/img/mountains.jpg" />
```

### Using a custom value

```html
<img class="drop-shadow-[0_35px_35px_rgba(0,0,0,0.25)] ..." src="/img/mountains.jpg" />
```

For CSS variables:

```html
<img class="drop-shadow-(--my-drop-shadow) ..." src="/img/mountains.jpg" />
```

### Responsive design

```html
<img class="drop-shadow-none md:drop-shadow-lg ..." src="/img/mountains.jpg" />
```
