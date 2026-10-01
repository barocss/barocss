// Authored host presentation. These styles are not properties of a generated Spec.
export const PRESET = Object.freeze({ id: 'gallery-v1', description: 'One fixed authored host preset: plain typography and text controls.',
  styles: Object.freeze({ shell: 'min-h-screen bg-slate-100 p-4 text-slate-900', Text: 'min-w-0 break-words text-base',
    Input: 'block w-full min-w-0 rounded border border-slate-400 bg-white p-2 text-slate-900',
    Button: 'rounded bg-blue-700 p-2 text-white' }),
  limitations: Object.freeze(['Typography, text controls and gallery chrome are authored host styling.',
    'Spec choices control only composition and declared Layout/Card enum styles.',
    'Images, icons, charts, tables, modals, checkboxes, selects and date controls are unsupported.']) });
