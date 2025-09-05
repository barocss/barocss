# color

Utilities for controlling the text color of an element.

## Quick reference

| Class                    | Styles                                                              |
| ------------------------ | ------------------------------------------------------------------- |
| text-inherit             | color: inherit;                                                     |
| text-current             | color: currentColor;                                                |
| text-transparent         | color: transparent;                                                 |
| text-black               | color: var(--color-black); /* #000 */                             |
| text-white               | color: var(--color-white); /* #fff */                             |
| text-red-50              | color: var(--color-red-50); /* oklch(97.1% 0.013 17.38) */        |
| text-red-100             | color: var(--color-red-100); /* oklch(93.6% 0.032 17.717) */      |
| text-red-200             | color: var(--color-red-200); /* oklch(88.5% 0.062 18.334) */      |
| text-red-300             | color: var(--color-red-300); /* oklch(80.8% 0.114 19.571) */      |
| text-red-400             | color: var(--color-red-400); /* oklch(70.4% 0.191 22.216) */      |
| text-red-500             | color: var(--color-red-500); /* oklch(63.7% 0.237 25.331) */      |
| text-red-600             | color: var(--color-red-600); /* oklch(57.7% 0.245 27.325) */      |
| text-red-700             | color: var(--color-red-700); /* oklch(50.5% 0.213 27.518) */      |
| text-red-800             | color: var(--color-red-800); /* oklch(44.4% 0.177 26.899) */      |
| text-red-900             | color: var(--color-red-900); /* oklch(39.6% 0.141 25.723) */      |
| text-red-950             | color: var(--color-red-950); /* oklch(25.8% 0.092 26.042) */      |
| text-orange-50           | color: var(--color-orange-50); /* oklch(98% 0.016 73.684) */      |
| text-orange-100          | color: var(--color-orange-100); /* oklch(95.4% 0.038 75.164) */   |
| text-orange-200          | color: var(--color-orange-200); /* oklch(90.1% 0.076 70.697) */   |
| text-orange-300          | color: var(--color-orange-300); /* oklch(83.7% 0.128 66.29) */    |
| text-orange-400          | color: var(--color-orange-400); /* oklch(75% 0.183 55.934) */     |
| text-orange-500          | color: var(--color-orange-500); /* oklch(70.5% 0.213 47.604) */   |
| text-orange-600          | color: var(--color-orange-600); /* oklch(64.6% 0.222 41.116) */   |
| text-orange-700          | color: var(--color-orange-700); /* oklch(55.3% 0.195 38.402) */   |
| text-orange-800          | color: var(--color-orange-800); /* oklch(47% 0.157 37.304) */     |
| text-orange-900          | color: var(--color-orange-900); /* oklch(40.8% 0.123 38.172) */   |
| text-orange-950          | color: var(--color-orange-950); /* oklch(25.4% 0.08 37.889) */    |
| text-amber-50            | color: var(--color-amber-50); /* oklch(98.1% 0.018 85.873) */     |
| text-amber-100           | color: var(--color-amber-100); /* oklch(95.4% 0.043 85.873) */    |
| text-amber-200           | color: var(--color-amber-200); /* oklch(90.1% 0.086 85.873) */    |
| text-amber-300           | color: var(--color-amber-300); /* oklch(83.7% 0.143 85.873) */    |
| text-amber-400           | color: var(--color-amber-400); /* oklch(75% 0.204 85.873) */      |
| text-amber-500           | color: var(--color-amber-500); /* oklch(70.5% 0.234 85.873) */    |
| text-amber-600           | color: var(--color-amber-600); /* oklch(64.6% 0.243 85.873) */    |
| text-amber-700           | color: var(--color-amber-700); /* oklch(55.3% 0.215 85.873) */    |
| text-amber-800           | color: var(--color-amber-800); /* oklch(47% 0.177 85.873) */      |
| text-amber-900           | color: var(--color-amber-900); /* oklch(40.8% 0.143 85.873) */    |
| text-amber-950           | color: var(--color-amber-950); /* oklch(25.4% 0.093 85.873) */    |
| text-yellow-50           | color: var(--color-yellow-50); /* oklch(98.1% 0.018 85.873) */    |
| text-yellow-100          | color: var(--color-yellow-100); /* oklch(95.4% 0.043 85.873) */   |
| text-yellow-200          | color: var(--color-yellow-200); /* oklch(90.1% 0.086 85.873) */   |
| text-yellow-300          | color: var(--color-yellow-300); /* oklch(83.7% 0.143 85.873) */   |
| text-yellow-400          | color: var(--color-yellow-400); /* oklch(75% 0.204 85.873) */     |
| text-yellow-500          | color: var(--color-yellow-500); /* oklch(70.5% 0.234 85.873) */   |
| text-yellow-600          | color: var(--color-yellow-600); /* oklch(64.6% 0.243 85.873) */   |
| text-yellow-700          | color: var(--color-yellow-700); /* oklch(55.3% 0.215 85.873) */   |
| text-yellow-800          | color: var(--color-yellow-800); /* oklch(47% 0.177 85.873) */     |
| text-yellow-900          | color: var(--color-yellow-900); /* oklch(40.8% 0.143 85.873) */   |
| text-yellow-950          | color: var(--color-yellow-950); /* oklch(25.4% 0.093 85.873) */   |
| text-lime-50             | color: var(--color-lime-50); /* oklch(98.1% 0.018 85.873) */      |
| text-lime-100            | color: var(--color-lime-100); /* oklch(95.4% 0.043 85.873) */     |
| text-lime-200            | color: var(--color-lime-200); /* oklch(90.1% 0.086 85.873) */     |
| text-lime-300            | color: var(--color-lime-300); /* oklch(83.7% 0.143 85.873) */     |
| text-lime-400            | color: var(--color-lime-400); /* oklch(75% 0.204 85.873) */       |
| text-lime-500            | color: var(--color-lime-500); /* oklch(70.5% 0.234 85.873) */     |
| text-lime-600            | color: var(--color-lime-600); /* oklch(64.6% 0.243 85.873) */     |
| text-lime-700            | color: var(--color-lime-700); /* oklch(55.3% 0.215 85.873) */     |
| text-lime-800            | color: var(--color-lime-800); /* oklch(47% 0.177 85.873) */       |
| text-lime-900            | color: var(--color-lime-900); /* oklch(40.8% 0.143 85.873) */     |
| text-lime-950            | color: var(--color-lime-950); /* oklch(25.4% 0.093 85.873) */     |
| text-green-50            | color: var(--color-green-50); /* oklch(98.1% 0.018 85.873) */     |
| text-green-100           | color: var(--color-green-100); /* oklch(95.4% 0.043 85.873) */    |
| text-green-200           | color: var(--color-green-200); /* oklch(90.1% 0.086 85.873) */    |
| text-green-300           | color: var(--color-green-300); /* oklch(83.7% 0.143 85.873) */    |
| text-green-400           | color: var(--color-green-400); /* oklch(75% 0.204 85.873) */      |
| text-green-500           | color: var(--color-green-500); /* oklch(70.5% 0.234 85.873) */    |
| text-green-600           | color: var(--color-green-600); /* oklch(64.6% 0.243 85.873) */    |
| text-green-700           | color: var(--color-green-700); /* oklch(55.3% 0.215 85.873) */    |
| text-green-800           | color: var(--color-green-800); /* oklch(47% 0.177 85.873) */      |
| text-green-900           | color: var(--color-green-900); /* oklch(40.8% 0.143 85.873) */    |
| text-green-950           | color: var(--color-green-950); /* oklch(25.4% 0.093 85.873) */    |
| text-emerald-50          | color: var(--color-emerald-50); /* oklch(98.1% 0.018 85.873) */   |
| text-emerald-100         | color: var(--color-emerald-100); /* oklch(95.4% 0.043 85.873) */  |
| text-emerald-200         | color: var(--color-emerald-200); /* oklch(90.1% 0.086 85.873) */  |
| text-emerald-300         | color: var(--color-emerald-300); /* oklch(83.7% 0.143 85.873) */  |
| text-emerald-400         | color: var(--color-emerald-400); /* oklch(75% 0.204 85.873) */    |
| text-emerald-500         | color: var(--color-emerald-500); /* oklch(70.5% 0.234 85.873) */  |
| text-emerald-600         | color: var(--color-emerald-600); /* oklch(64.6% 0.243 85.873) */  |
| text-emerald-700         | color: var(--color-emerald-700); /* oklch(55.3% 0.215 85.873) */  |
| text-emerald-800         | color: var(--color-emerald-800); /* oklch(47% 0.177 85.873) */    |
| text-emerald-900         | color: var(--color-emerald-900); /* oklch(40.8% 0.143 85.873) */  |
| text-emerald-950         | color: var(--color-emerald-950); /* oklch(25.4% 0.093 85.873) */  |
| text-teal-50             | color: var(--color-teal-50); /* oklch(98.1% 0.018 85.873) */      |
| text-teal-100            | color: var(--color-teal-100); /* oklch(95.4% 0.043 85.873) */     |
| text-teal-200            | color: var(--color-teal-200); /* oklch(90.1% 0.086 85.873) */     |
| text-teal-300            | color: var(--color-teal-300); /* oklch(83.7% 0.143 85.873) */     |
| text-teal-400            | color: var(--color-teal-400); /* oklch(75% 0.204 85.873) */       |
| text-teal-500            | color: var(--color-teal-500); /* oklch(70.5% 0.234 85.873) */     |
| text-teal-600            | color: var(--color-teal-600); /* oklch(64.6% 0.243 85.873) */     |
| text-teal-700            | color: var(--color-teal-700); /* oklch(55.3% 0.215 85.873) */     |
| text-teal-800            | color: var(--color-teal-800); /* oklch(47% 0.177 85.873) */       |
| text-teal-900            | color: var(--color-teal-900); /* oklch(40.8% 0.143 85.873) */     |
| text-teal-950            | color: var(--color-teal-950); /* oklch(25.4% 0.093 85.873) */     |
| text-cyan-50             | color: var(--color-cyan-50); /* oklch(98.1% 0.018 85.873) */      |
| text-cyan-100            | color: var(--color-cyan-100); /* oklch(95.4% 0.043 85.873) */     |
| text-cyan-200            | color: var(--color-cyan-200); /* oklch(90.1% 0.086 85.873) */     |
| text-cyan-300            | color: var(--color-cyan-300); /* oklch(83.7% 0.143 85.873) */     |
| text-cyan-400            | color: var(--color-cyan-400); /* oklch(75% 0.204 85.873) */       |
| text-cyan-500            | color: var(--color-cyan-500); /* oklch(70.5% 0.234 85.873) */     |
| text-cyan-600            | color: var(--color-cyan-600); /* oklch(64.6% 0.243 85.873) */     |
| text-cyan-700            | color: var(--color-cyan-700); /* oklch(55.3% 0.215 85.873) */     |
| text-cyan-800            | color: var(--color-cyan-800); /* oklch(47% 0.177 85.873) */       |
| text-cyan-900            | color: var(--color-cyan-900); /* oklch(40.8% 0.143 85.873) */     |
| text-cyan-950            | color: var(--color-cyan-950); /* oklch(25.4% 0.093 85.873) */     |
| text-sky-50              | color: var(--color-sky-50); /* oklch(98.1% 0.018 85.873) */       |
| text-sky-100             | color: var(--color-sky-100); /* oklch(95.4% 0.043 85.873) */      |
| text-sky-200             | color: var(--color-sky-200); /* oklch(90.1% 0.086 85.873) */      |
| text-sky-300             | color: var(--color-sky-300); /* oklch(83.7% 0.143 85.873) */      |
| text-sky-400             | color: var(--color-sky-400); /* oklch(75% 0.204 85.873) */        |
| text-sky-500             | color: var(--color-sky-500); /* oklch(70.5% 0.234 85.873) */      |
| text-sky-600             | color: var(--color-sky-600); /* oklch(64.6% 0.243 85.873) */      |
| text-sky-700             | color: var(--color-sky-700); /* oklch(55.3% 0.215 85.873) */      |
| text-sky-800             | color: var(--color-sky-800); /* oklch(47% 0.177 85.873) */        |
| text-sky-900             | color: var(--color-sky-900); /* oklch(40.8% 0.143 85.873) */      |
| text-sky-950             | color: var(--color-sky-950); /* oklch(25.4% 0.093 85.873) */      |
| text-blue-50             | color: var(--color-blue-50); /* oklch(98.1% 0.018 85.873) */      |
| text-blue-100            | color: var(--color-blue-100); /* oklch(95.4% 0.043 85.873) */     |
| text-blue-200            | color: var(--color-blue-200); /* oklch(90.1% 0.086 85.873) */     |
| text-blue-300            | color: var(--color-blue-300); /* oklch(83.7% 0.143 85.873) */     |
| text-blue-400            | color: var(--color-blue-400); /* oklch(75% 0.204 85.873) */       |
| text-blue-500            | color: var(--color-blue-500); /* oklch(70.5% 0.234 85.873) */     |
| text-blue-600            | color: var(--color-blue-600); /* oklch(64.6% 0.243 85.873) */     |
| text-blue-700            | color: var(--color-blue-700); /* oklch(55.3% 0.215 85.873) */     |
| text-blue-800            | color: var(--color-blue-800); /* oklch(47% 0.177 85.873) */       |
| text-blue-900            | color: var(--color-blue-900); /* oklch(40.8% 0.143 85.873) */     |
| text-blue-950            | color: var(--color-blue-950); /* oklch(25.4% 0.093 85.873) */     |
| text-indigo-50           | color: var(--color-indigo-50); /* oklch(98.1% 0.018 85.873) */    |
| text-indigo-100          | color: var(--color-indigo-100); /* oklch(95.4% 0.043 85.873) */   |
| text-indigo-200          | color: var(--color-indigo-200); /* oklch(90.1% 0.086 85.873) */   |
| text-indigo-300          | color: var(--color-indigo-300); /* oklch(83.7% 0.143 85.873) */   |
| text-indigo-400          | color: var(--color-indigo-400); /* oklch(75% 0.204 85.873) */     |
| text-indigo-500          | color: var(--color-indigo-500); /* oklch(70.5% 0.234 85.873) */   |
| text-indigo-600          | color: var(--color-indigo-600); /* oklch(64.6% 0.243 85.873) */   |
| text-indigo-700          | color: var(--color-indigo-700); /* oklch(55.3% 0.215 85.873) */   |
| text-indigo-800          | color: var(--color-indigo-800); /* oklch(47% 0.177 85.873) */     |
| text-indigo-900          | color: var(--color-indigo-900); /* oklch(40.8% 0.143 85.873) */   |
| text-indigo-950          | color: var(--color-indigo-950); /* oklch(25.4% 0.093 85.873) */   |
| text-violet-50           | color: var(--color-violet-50); /* oklch(98.1% 0.018 85.873) */    |
| text-violet-100          | color: var(--color-violet-100); /* oklch(95.4% 0.043 85.873) */   |
| text-violet-200          | color: var(--color-violet-200); /* oklch(90.1% 0.086 85.873) */   |
| text-violet-300          | color: var(--color-violet-300); /* oklch(83.7% 0.143 85.873) */   |
| text-violet-400          | color: var(--color-violet-400); /* oklch(75% 0.204 85.873) */     |
| text-violet-500          | color: var(--color-violet-500); /* oklch(70.5% 0.234 85.873) */   |
| text-violet-600          | color: var(--color-violet-600); /* oklch(64.6% 0.243 85.873) */   |
| text-violet-700          | color: var(--color-violet-700); /* oklch(55.3% 0.215 85.873) */   |
| text-violet-800          | color: var(--color-violet-800); /* oklch(47% 0.177 85.873) */     |
| text-violet-900          | color: var(--color-violet-900); /* oklch(40.8% 0.143 85.873) */   |
| text-violet-950          | color: var(--color-violet-950); /* oklch(25.4% 0.093 85.873) */   |
| text-purple-50           | color: var(--color-purple-50); /* oklch(98.1% 0.018 85.873) */    |
| text-purple-100          | color: var(--color-purple-100); /* oklch(95.4% 0.043 85.873) */   |
| text-purple-200          | color: var(--color-purple-200); /* oklch(90.1% 0.086 85.873) */   |
| text-purple-300          | color: var(--color-purple-300); /* oklch(83.7% 0.143 85.873) */   |
| text-purple-400          | color: var(--color-purple-400); /* oklch(75% 0.204 85.873) */     |
| text-purple-500          | color: var(--color-purple-500); /* oklch(70.5% 0.234 85.873) */   |
| text-purple-600          | color: var(--color-purple-600); /* oklch(64.6% 0.243 85.873) */   |
| text-purple-700          | color: var(--color-purple-700); /* oklch(55.3% 0.215 85.873) */   |
| text-purple-800          | color: var(--color-purple-800); /* oklch(47% 0.177 85.873) */     |
| text-purple-900          | color: var(--color-purple-900); /* oklch(40.8% 0.143 85.873) */   |
| text-purple-950          | color: var(--color-purple-950); /* oklch(25.4% 0.093 85.873) */   |
| text-fuchsia-50          | color: var(--color-fuchsia-50); /* oklch(98.1% 0.018 85.873) */   |
| text-fuchsia-100         | color: var(--color-fuchsia-100); /* oklch(95.4% 0.043 85.873) */  |
| text-fuchsia-200         | color: var(--color-fuchsia-200); /* oklch(90.1% 0.086 85.873) */  |
| text-fuchsia-300         | color: var(--color-fuchsia-300); /* oklch(83.7% 0.143 85.873) */  |
| text-fuchsia-400         | color: var(--color-fuchsia-400); /* oklch(75% 0.204 85.873) */    |
| text-fuchsia-500         | color: var(--color-fuchsia-500); /* oklch(70.5% 0.234 85.873) */  |
| text-fuchsia-600         | color: var(--color-fuchsia-600); /* oklch(64.6% 0.243 85.873) */  |
| text-fuchsia-700         | color: var(--color-fuchsia-700); /* oklch(55.3% 0.215 85.873) */  |
| text-fuchsia-800         | color: var(--color-fuchsia-800); /* oklch(47% 0.177 85.873) */    |
| text-fuchsia-900         | color: var(--color-fuchsia-900); /* oklch(40.8% 0.143 85.873) */  |
| text-fuchsia-950         | color: var(--color-fuchsia-950); /* oklch(25.4% 0.093 85.873) */  |
| text-pink-50             | color: var(--color-pink-50); /* oklch(98.1% 0.018 85.873) */      |
| text-pink-100            | color: var(--color-pink-100); /* oklch(95.4% 0.043 85.873) */     |
| text-pink-200            | color: var(--color-pink-200); /* oklch(90.1% 0.086 85.873) */     |
| text-pink-300            | color: var(--color-pink-300); /* oklch(83.7% 0.143 85.873) */     |
| text-pink-400            | color: var(--color-pink-400); /* oklch(75% 0.204 85.873) */       |
| text-pink-500            | color: var(--color-pink-500); /* oklch(70.5% 0.234 85.873) */     |
| text-pink-600            | color: var(--color-pink-600); /* oklch(64.6% 0.243 85.873) */     |
| text-pink-700            | color: var(--color-pink-700); /* oklch(55.3% 0.215 85.873) */     |
| text-pink-800            | color: var(--color-pink-800); /* oklch(47% 0.177 85.873) */       |
| text-pink-900            | color: var(--color-pink-900); /* oklch(40.8% 0.143 85.873) */     |
| text-pink-950            | color: var(--color-pink-950); /* oklch(25.4% 0.093 85.873) */     |
| text-rose-50             | color: var(--color-rose-50); /* oklch(98.1% 0.018 85.873) */      |
| text-rose-100            | color: var(--color-rose-100); /* oklch(95.4% 0.043 85.873) */     |
| text-rose-200            | color: var(--color-rose-200); /* oklch(90.1% 0.086 85.873) */     |
| text-rose-300            | color: var(--color-rose-300); /* oklch(83.7% 0.143 85.873) */     |
| text-rose-400            | color: var(--color-rose-400); /* oklch(75% 0.204 85.873) */       |
| text-rose-500            | color: var(--color-rose-500); /* oklch(70.5% 0.234 85.873) */     |
| text-rose-600            | color: var(--color-rose-600); /* oklch(64.6% 0.243 85.873) */     |
| text-rose-700            | color: var(--color-rose-700); /* oklch(55.3% 0.215 85.873) */     |
| text-rose-800            | color: var(--color-rose-800); /* oklch(47% 0.177 85.873) */       |
| text-rose-900            | color: var(--color-rose-900); /* oklch(40.8% 0.143 85.873) */     |
| text-rose-950            | color: var(--color-rose-950); /* oklch(25.4% 0.093 85.873) */     |
| text-slate-50            | color: var(--color-slate-50); /* oklch(98.1% 0.018 85.873) */     |
| text-slate-100           | color: var(--color-slate-100); /* oklch(95.4% 0.043 85.873) */    |
| text-slate-200           | color: var(--color-slate-200); /* oklch(90.1% 0.086 85.873) */    |
| text-slate-300           | color: var(--color-slate-300); /* oklch(83.7% 0.143 85.873) */    |
| text-slate-400           | color: var(--color-slate-400); /* oklch(75% 0.204 85.873) */      |
| text-slate-500           | color: var(--color-slate-500); /* oklch(70.5% 0.234 85.873) */    |
| text-slate-600           | color: var(--color-slate-600); /* oklch(64.6% 0.243 85.873) */    |
| text-slate-700           | color: var(--color-slate-700); /* oklch(55.3% 0.215 85.873) */    |
| text-slate-800           | color: var(--color-slate-800); /* oklch(47% 0.177 85.873) */      |
| text-slate-900           | color: var(--color-slate-900); /* oklch(40.8% 0.143 85.873) */    |
| text-slate-950           | color: var(--color-slate-950); /* oklch(25.4% 0.093 85.873) */    |
| text-gray-50             | color: var(--color-gray-50); /* oklch(98.1% 0.018 85.873) */      |
| text-gray-100            | color: var(--color-gray-100); /* oklch(95.4% 0.043 85.873) */     |
| text-gray-200            | color: var(--color-gray-200); /* oklch(90.1% 0.086 85.873) */     |
| text-gray-300            | color: var(--color-gray-300); /* oklch(83.7% 0.143 85.873) */     |
| text-gray-400            | color: var(--color-gray-400); /* oklch(75% 0.204 85.873) */       |
| text-gray-500            | color: var(--color-gray-500); /* oklch(70.5% 0.234 85.873) */     |
| text-gray-600            | color: var(--color-gray-600); /* oklch(64.6% 0.243 85.873) */     |
| text-gray-700            | color: var(--color-gray-700); /* oklch(55.3% 0.215 85.873) */     |
| text-gray-800            | color: var(--color-gray-800); /* oklch(47% 0.177 85.873) */       |
| text-gray-900            | color: var(--color-gray-900); /* oklch(40.8% 0.143 85.873) */     |
| text-gray-950            | color: var(--color-gray-950); /* oklch(25.4% 0.093 85.873) */     |
| text-zinc-50             | color: var(--color-zinc-50); /* oklch(98.1% 0.018 85.873) */      |
| text-zinc-100            | color: var(--color-zinc-100); /* oklch(95.4% 0.043 85.873) */     |
| text-zinc-200            | color: var(--color-zinc-200); /* oklch(90.1% 0.086 85.873) */     |
| text-zinc-300            | color: var(--color-zinc-300); /* oklch(83.7% 0.143 85.873) */     |
| text-zinc-400            | color: var(--color-zinc-400); /* oklch(70.5% 0.015 286.067) */    |
| text-zinc-500            | color: var(--color-zinc-500); /* oklch(55.2% 0.016 285.938) */    |
| text-zinc-600            | color: var(--color-zinc-600); /* oklch(44.2% 0.017 285.786) */    |
| text-zinc-700            | color: var(--color-zinc-700); /* oklch(37% 0.013 285.805) */      |
| text-zinc-800            | color: var(--color-zinc-800); /* oklch(27.4% 0.006 286.033) */    |
| text-zinc-900            | color: var(--color-zinc-900); /* oklch(21% 0.006 285.885) */      |
| text-zinc-950            | color: var(--color-zinc-950); /* oklch(14.1% 0.005 285.823) */    |
| text-neutral-50          | color: var(--color-neutral-50); /* oklch(98.5% 0 0) */            |
| text-neutral-100         | color: var(--color-neutral-100); /* oklch(97% 0 0) */             |
| text-neutral-200         | color: var(--color-neutral-200); /* oklch(92.2% 0 0) */           |
| text-neutral-300         | color: var(--color-neutral-300); /* oklch(87% 0 0) */             |
| text-neutral-400         | color: var(--color-neutral-400); /* oklch(70.8% 0 0) */           |
| text-neutral-500         | color: var(--color-neutral-500); /* oklch(55.6% 0 0) */           |
| text-neutral-600         | color: var(--color-neutral-600); /* oklch(43.9% 0 0) */           |
| text-neutral-700         | color: var(--color-neutral-700); /* oklch(37.1% 0 0) */           |
| text-neutral-800         | color: var(--color-neutral-800); /* oklch(26.9% 0 0) */           |
| text-neutral-900         | color: var(--color-neutral-900); /* oklch(20.5% 0 0) */           |
| text-neutral-950         | color: var(--color-neutral-950); /* oklch(14.5% 0 0) */           |
| text-stone-50            | color: var(--color-stone-50); /* oklch(98.5% 0.001 106.423) */    |
| text-stone-100           | color: var(--color-stone-100); /* oklch(97% 0.001 106.424) */     |
| text-stone-200           | color: var(--color-stone-200); /* oklch(92.3% 0.003 48.717) */    |
| text-stone-300           | color: var(--color-stone-300); /* oklch(86.9% 0.005 56.366) */    |
| text-stone-400           | color: var(--color-stone-400); /* oklch(70.9% 0.01 56.259) */     |
| text-stone-500           | color: var(--color-stone-500); /* oklch(55.3% 0.013 58.071) */    |
| text-stone-600           | color: var(--color-stone-600); /* oklch(44.4% 0.011 73.639) */    |
| text-stone-700           | color: var(--color-stone-700); /* oklch(37.4% 0.01 67.558) */     |
| text-stone-800           | color: var(--color-stone-800); /* oklch(26.8% 0.007 34.298) */    |
| text-stone-900           | color: var(--color-stone-900); /* oklch(21.6% 0.006 56.043) */    |
| text-stone-950           | color: var(--color-stone-950); /* oklch(14.7% 0.004 49.25) */     |
| text-(&lt;custom-property&gt;) | color: var(&lt;custom-property&gt;);                                      |
| text-\[&lt;value&gt;\]         | color: &lt;value&gt;;                                                     |

Show more

## Examples

### Basic example

Use utilities like `text-blue-600` and `text-sky-400` to control the text color of an element:

The quick brown fox jumps over the lazy dog.

```html
<p class="text-blue-600 dark:text-sky-400">The quick brown fox...</p>
```

### Changing the opacity

Use the color opacity modifier to control the text color opacity of an element:

The quick brown fox jumps over the lazy dog.

The quick brown fox jumps over the lazy dog.

The quick brown fox jumps over the lazy dog.

The quick brown fox jumps over the lazy dog.

```html
<p class="text-blue-600/100 dark:text-sky-400/100">The quick brown fox...</p>
<p class="text-blue-600/75 dark:text-sky-400/75">The quick brown fox...</p>
<p class="text-blue-600/50 dark:text-sky-400/50">The quick brown fox...</p>
<p class="text-blue-600/25 dark:text-sky-400/25">The quick brown fox...</p>
```

### Using a custom value

Use the `text-[&lt;value&gt;]` syntax to set the text color based on a completely custom value:

```html
<p class="text-[#50d71e] ...">Lorem ipsum dolor sit amet...</p>
```

For CSS variables, you can also use the `text-(&lt;custom-property&gt;)` syntax:

```html
<p class="text-(--my-color) ...">Lorem ipsum dolor sit amet...</p>
```

This is just a shorthand for `text-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Applying on hover

Prefix a `color` utility with a variant like `hover:*` to only apply the utility in that state:

Hover over the text to see the expected behavior

Oh I gotta get on that internet, I'm late on everything!

```html
<p class="...">
  Oh I gotta get on that 
  <a class="underline hover:text-blue-600 dark:hover:text-blue-400" href="https://en.wikipedia.org/wiki/Internet">internet</a>, 
  I'm late on everything!
</p>
```

Learn more about using variants in the variants documentation.

### Responsive design

Prefix a `color` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="text-blue-600 md:text-green-600 ...">Lorem ipsum dolor sit amet...</p>
```

Learn more about using variants in the variants documentation.

## Customizing your theme

Use the `--color-*` theme variables to customize the color utilities in your project:

```css
@theme {
  --color-regal-blue: #243c5a;
}
```

Now the `text-regal-blue` utility can be used in your markup:

```html
<p class="text-regal-blue">Lorem ipsum dolor sit amet...</p>
```

Learn more about customizing your theme in the theme documentation.
