export const PRESET = Object.freeze({ version: 1, id: 'workflow-host-v1',
  description: 'Authored host typography, compact controls and list-detail shell; not renderer Spec properties.',
  roles: Object.freeze({ title: 'text-base font-bold tracking-tight', body: 'text-sm leading-relaxed', caption: 'text-xs opacity-70 leading-relaxed',
    metric: 'text-lg font-bold tracking-tight', action: 'w-full text-left rounded-lg border border-slate-300 bg-slate-50 text-slate-900 px-3 py-2 text-sm font-medium hover:bg-slate-200 focus:ring-2' }),
  shell: 'min-h-screen bg-slate-100 text-slate-900', control: 'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
  limitations: ['Fictional authored data; no model generation or real payments.', 'Host controls own navigation/filter/sort/pagination; current projected Specs own bounded business panels.',
    'Five existing renderer types only; no Table, Chart, Image, Modal or new style props.'] });
