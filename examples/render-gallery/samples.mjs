// Original synthetic specimens. Only composition, enum styles and literal text belong to the Spec.
const limitations = [
  'Only Layout, Card, Text, text Input and Button are supported.',
  'Image, Icon, Chart, Table, Modal, checkbox, select and date controls are not supported.',
  'Typography, control appearance and gallery shell styling come from the gallery-v1 host preset.',
  'No arbitrary CSS, className, HTML, URL or executable action parameters are accepted.',
];
const text = (id, value) => ({ id, type: 'Text', props: { text: value } });
const input = (id, label, path) => ({ id, type: 'Input', props: { label, value: { $bindState: path } } });
const button = (id, label, action) => ({ id, type: 'Button', props: { label }, on: { press: { action } } });
const card = (id, tone, padding, ...children) => ({ id, type: 'Card', props: { tone, padding }, children });
const layout = (id, columns, gap, ...children) => ({ id, type: 'Layout', props: { columns, gap }, children });
function spec(tree) {
  const elements = {};
  function visit(node) {
    const children = node.children ?? [];
    elements[node.id] = { type: node.type, props: { id: node.id, ...node.props }, children: children.map((child) => child.id), ...(node.on ? { on: node.on } : {}) };
    children.forEach(visit);
  }
  visit(tree);
  return { root: tree.id, elements };
}
function record(sha, id, title, category, tree, initialState = {}, tags = [], notes = []) {
  const screen = spec(tree), nodes = Object.values(screen.elements);
  return {
    version: 1, id, revision: 1, title, category, tags,
    spec: screen,
    contract: {
      textBindings: [...new Set(nodes.filter((node) => node.type === 'Input').map((node) => node.props.value.$bindState))],
      actions: [...new Set(nodes.filter((node) => node.type === 'Button').map((node) => node.on.press.action))],
    },
    initialState, source: { kind: 'authored', path: 'examples/render-gallery/samples.mjs', sha },
    preset: 'gallery-v1', limitations: [...limitations, ...notes],
  };
}
export function catalog(candidateSha) {
  if (typeof candidateSha !== 'string' || !/^[0-9a-f]{40}$/.test(candidateSha)) throw new Error('Expected an exact candidate commit SHA');
  const make = (...args) => record(candidateSha, ...args);
  return [
    make('studio-notes', 'Studio notes / 작업실 소식', 'information', layout('studio', 'responsive', 'wide',
      card('today', 'dark', 'spacious', text('today-title', 'TODAY · 오늘'), text('today-body', 'Open studio: print, fold, share. 14:00–18:00')),
      card('next', 'light', 'fractional', text('next-title', 'Next gathering'), text('next-body', 'Saturday · Paper lantern workshop'), button('details', 'Inspect details', 'inspect'))), {}, ['bilingual', 'two-cards']),
    make('travel-brief', 'A small travel brief', 'information', layout('brief', 'single', 'fractional',
      text('brief-title', 'SEOUL / 서울 — a quiet afternoon'),
      card('walk', 'light', 'spacious', text('walk-title', '01 · Riverside walk'), text('walk-body', 'Meet at the north gate. Bring water and a notebook.')),
      card('stop', 'dark', 'fractional', text('stop-title', '02 · Coffee stop'), text('stop-body', 'A synthetic itinerary, with no external booking link.'))), {}, ['vertical', 'itinerary']),
    make('weekly-metrics', 'Weekly text summary', 'metrics', layout('weekly', 'responsive', 'fractional',
      card('visits', 'dark', 'spacious', text('visits-label', 'Studio visits'), text('visits-value', '128'), text('visits-note', '+12 compared with last week')),
      card('sessions', 'light', 'spacious', text('sessions-label', 'Completed sessions'), text('sessions-value', '24'), text('sessions-note', 'Synthetic values · illustrative only'))), {}, ['text-metrics', 'contrast'], ['These are literal text summaries, not charts or live analytics.']),
    make('reading-metrics', 'Reading log / 독서 기록', 'metrics', layout('reading', 'single', 'wide',
      text('reading-title', '이번 달 · This month'), text('reading-books', 'Books completed: 3'), text('reading-pages', 'Pages read: 642'), text('reading-time', 'Reading time: 18 hours'), text('reading-note', 'Synthetic authored totals')), {}, ['no-card', 'text-metrics'], ['These are literal text summaries, not charts or live analytics.']),
    make('creative-profile', 'Creative profile', 'profile', layout('profile', 'responsive', 'wide',
      card('intro', 'dark', 'spacious', text('intro-title', 'Make room for your next idea'), text('intro-body', 'A synthetic creative profile with two editable text fields.')),
      card('editor', 'light', 'spacious', input('display-name', 'Display name / 이름', '/profile/name'), input('practice', 'Creative practice', '/profile/practice'), button('save-profile', 'Save profile', 'save-profile'), button('reset-profile', 'Reset draft', 'reset-profile'))), { profile: { name: 'Mina 김민아', practice: 'Paper & light' } }, ['bilingual', 'two-fields', 'two-actions']),
    make('speaker-profile', 'Speaker introduction', 'profile', layout('speaker', 'single', 'fractional',
      text('speaker-title', 'Introduce yourself'), input('speaker-name', 'Name', '/speaker/name'), input('speaker-bio', 'Short introduction', '/speaker/bio'), button('preview-bio', 'Inspect introduction', 'preview'), button('save-bio', 'Save introduction', 'save')),
      { speaker: { name: 'Alex Park', bio: 'I build small tools for learning.' } }, ['no-card', 'two-fields', 'two-actions']),
    make('workspace-settings', 'Workspace preferences', 'settings', layout('preferences', 'responsive', 'wide',
      card('workspace', 'light', 'fractional', text('workspace-title', 'Workspace labels'), input('workspace-name', 'Workspace name', '/settings/workspace'), input('welcome', 'Welcome message', '/settings/welcome')),
      card('controls', 'dark', 'spacious', text('controls-title', 'Keep it simple'), text('controls-note', 'Preferences are text labels; no toggle or select widget is implied.'), button('apply-settings', 'Apply labels', 'apply'), button('restore-settings', 'Restore defaults', 'restore'))),
      { settings: { workspace: 'Quiet studio', welcome: '안녕하세요 · Welcome back' } }, ['preferences', 'two-actions'], ['Preferences use plain text Inputs, not select or checkbox controls.']),
    make('notification-settings', 'Notification wording / 알림 문구', 'settings', layout('notifications', 'single', 'wide',
      card('notification-card', 'dark', 'fractional', text('notification-title', '알림을 내 말로 · Make the wording yours'), input('notification-heading', 'Heading', '/notification/heading'), input('notification-footer', 'Footer', '/notification/footer'), button('save-wording', 'Save wording', 'save-wording'), button('test-wording', 'Inspect current values', 'inspect-wording'))),
      { notification: { heading: 'A new chapter awaits', footer: '오늘도 한 걸음 · One step today' } }, ['bilingual', 'text-preferences']),
    make('booking-review', 'Workshop request review', 'review', layout('review', 'responsive', 'fractional',
      card('summary', 'light', 'spacious', text('review-title', 'Review your workshop request'), text('review-person', 'Guest: Hana Lee'), text('review-topic', 'Topic: Folding paper landscapes'), text('review-note', 'Synthetic request · no payment')),
      card('decisions', 'dark', 'fractional', text('decision-title', 'Ready for the next step?'), button('edit-request', 'Edit request', 'edit'), button('confirm-request', 'Confirm request', 'confirm'))), {}, ['review', 'two-actions'], ['This sample inspects host actions; it does not book or charge anything.']),
    make('request-confirmation', 'Confirmation / 접수 완료', 'review', layout('confirmation', 'single', 'wide',
      text('confirmation-title', '접수 완료 · Request recorded'), text('confirmation-body', 'Thank you, Jun. Your synthetic request is ready for inspection.'),
      card('confirmation-details', 'dark', 'spacious', text('confirmation-reference', 'Reference: DEMO-042'), text('confirmation-topic', 'Topic: Tea and typography'), button('new-request', 'Start another draft', 'new-draft'))), {}, ['confirmation', 'bilingual']),
    make('help-desk', 'Nested help desk', 'nested', layout('help', 'single', 'wide',
      text('help-title', 'Small questions, useful answers'), layout('help-columns', 'responsive', 'fractional',
        card('help-first', 'light', 'spacious', text('help-first-title', 'Getting started'), text('help-first-body', 'Choose a sample, inspect its JSON, then edit its declared text fields.')),
        card('help-second', 'dark', 'fractional', text('help-second-title', 'Need a reminder?'), layout('help-actions', 'single', 'fractional', text('help-second-body', 'The host owns actions and state.'), button('inspect-help', 'Inspect help action', 'inspect-help'))))), {}, ['nested-layout', 'help']),
    make('welcome-nest', 'Nested welcome / 환영합니다', 'nested', layout('welcome-root', 'responsive', 'wide',
      card('welcome-outer', 'dark', 'spacious', text('welcome-title', '환영합니다 · Welcome'), card('welcome-inner', 'light', 'fractional', text('welcome-inner-title', 'A note inside a note'), text('welcome-inner-body', 'Nested Cards remain ordinary five-component composition.'))),
      layout('welcome-aside', 'single', 'fractional', text('welcome-aside-title', 'Your next step'), text('welcome-aside-body', 'Explore the data and its support limits.'), button('explore', 'Inspect exploration', 'explore'))), {}, ['nested-card', 'bilingual']),
  ];
}
