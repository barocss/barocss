const paths = {
  document: 'M5 2.5h6.5L15 6v11.5H5v-15Z M11 2.5V7h4',
  lock: 'M5 8h10v9H5V8Z M7 8V5a3 3 0 0 1 6 0v3',
  open: 'M2.5 6V4.5h5l2 2H17V9 M2.5 6v10h13l2.5-7H5l-2.5 7',
  cube: 'm10 2 7 4v8l-7 4-7-4V6l7-4Z M3 6l7 4 7-4 M10 10v8',
  assembly: 'm6 2 4 2.5v5L6 12 2 9.5v-5L6 2Z M2 4.5 6 7l4-2.5M6 7v5 M14 8l4 2.5v5L14 18l-4-2.5v-5L14 8Z M10 10.5l4 2.5 4-2.5M14 13v5',
  save: 'M10 2.5v10m-3.5-3 3.5 3.5 3.5-3.5 M3 13v4h14v-4',
  upload: 'M10 13V3m-3.5 3.5L10 3l3.5 3.5 M3 13v4h14v-4',
  camera: 'M3 5h3l1.5-2h5L14 5h3v12H3V5Z',
  cameraMeasure: 'M3 5h3l1.5-2h5L14 5h3v12H3V5Z M6 11h8M6 9v4m8-4v4',
  panelLeft: 'M3 4h14v12H3V4Z M8 4v12',
  panelRight: 'M3 4h14v12H3V4Z M12 4v12',
  search: 'm12.5 12.5 4 4',
  fit: 'M7 3H3v4m10-4h4v4M3 13v4h4m6 0h4v-4M7 7h6v6H7V7Z',
  focus: 'M7 3H3v4m10-4h4v4M3 13v4h4m6 0h4v-4M10 7v6m-3-3h6',
  eye: 'M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z',
  hide: 'M3 3l14 14M8 5.3A9 9 0 0 1 10 5c5 0 8 5 8 5a16 16 0 0 1-2.5 2.8M12 14.7a9 9 0 0 1-2 .3c-5 0-8-5-8-5a16 16 0 0 1 2.5-2.8',
  isolate: 'M6 3H3v3m11-3h3v3M3 14v3h3m11-3v3h-3M7 7h6v6H7V7Z',
  close: 'm5 5 10 10M5 15 15 5',
  ruler: 'm3 13 10-10 4 4L7 17l-4-4Z M6 10l2 2m1-5 2 2m1-5 2 2',
  filter: 'M3 4h14l-5.5 6v5l-3 2v-7L3 4Z',
  arrow: 'M3.5 10h13m-5-5 5 5-5 5',
  surface: 'M3 6 13 3 17 14 7 17Z M6 5 10 16 M10 4 14 15 M5 10 15 7 M6 14 16 11',
  curve: 'M3 15C4 2 14 18 17 5 M3 14v2 M16 5h2',
  restore: 'M4 6a7 7 0 1 1-1 7M4 2v5h5',
  edit: 'm4 12 9-9 4 4-9 9-5 1 1-5Z M11 5l4 4',
  trash: 'M3 5h14M7 5V3h6v2M5 5l1 12h8l1-12M8 8v6m4-6v6',
  check: 'm4 10 4 4 8-8',
  plus: 'M10 4v12M4 10h12',
  pointA: 'M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z M6.5 14 10 6l3.5 8M8 11h4',
  pointB: 'M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z M7.5 6v8H11a2 2 0 0 0 0-4H7.5 M7.5 6H11a2 2 0 0 1 0 4',
};
const cubePath = paths.cube;
const viewFaces = {
  iso: 'm10 2 7 4-7 4-7-4 7-4Z M3 6l7 4v8l-7-4V6Z M10 10l7-4v8l-7 4v-8Z',
  front: 'M3 6l7 4v8l-7-4V6Z',
  top: 'm10 2 7 4-7 4-7-4 7-4Z',
  right: 'M10 10l7-4v8l-7 4v-8Z',
};
type IconName = keyof typeof paths | keyof typeof viewFaces;

export function ViewerIcon({ name, className }: { name: IconName; className?: string }) {
  const face = name in viewFaces ? viewFaces[name as keyof typeof viewFaces] : null;
  return <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
    {face && <path d={face} fill="currentColor" opacity="0.28" stroke="none" />}
    <path d={face ? cubePath : paths[name as keyof typeof paths]} />
    {name === 'camera' && <circle cx="10" cy="10.5" r="3" />}
    {name === 'search' && <circle cx="8.5" cy="8.5" r="5" />}
    {name === 'eye' && <circle cx="10" cy="10" r="2" />}
  </svg>;
}
