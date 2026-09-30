// Freeze these content checks before collecting #458 output. They do not alter the prompts.
import { validateSpec } from '../../packages/barocss-render/src/contract.mjs';

const check = (id, pass) => ({ id, pass: Boolean(pass) });
const containsHangul = (text) => /[가-힣]/u.test(text);
const nodeValues = (spec, type) => Object.values(spec.elements).filter((node) => node.type === type);
const textValues = (spec) => nodeValues(spec, 'Text').map((node) => node.props.text);
const cardValues = (spec) => nodeValues(spec, 'Card');
const nameInput = (spec) => spec.elements.name?.type === 'Input' ? spec.elements.name : null;
const saveButton = (spec) => spec.elements.save?.type === 'Button' ? spec.elements.save : null;
const firstLayout = (spec) => spec.elements[spec.root];

export const RUBRIC_VERSION = 'profile-form-content-v1';
export const CONTENT_CHECKS = Object.freeze({
  '01': ['one-name-input', 'one-save-button'],
  '02': ['one-name-input', 'one-save-button', 'light-tone', 'korean-script-copy', 'manual-korean-language-quality'],
  '03': ['one-name-input', 'one-save-button', 'light-tone', 'exact-heading-profile-settings', 'exact-label-name', 'exact-button-save-profile'],
  '04': ['one-name-input', 'one-save-button', 'dark-tone'],
  '05': ['one-name-input', 'one-save-button', 'single-column', 'spacious-padding'],
  '06': ['one-name-input', 'one-save-button', 'responsive-columns', 'two-separate-cards', 'help-card-text'],
  '07': ['one-name-input', 'one-save-button', 'light-tone', 'fractional-gap', 'fractional-padding'],
  '08': ['one-name-input', 'one-save-button', 'dark-tone', 'wide-gap', 'spacious-padding'],
  '09': ['one-name-input', 'one-save-button', 'light-tone', 'exact-heading-my-profile', 'exact-label-korean-name', 'exact-button-korean-save'],
  '10': ['one-name-input', 'one-save-button', 'help-text-present', 'manual-local-confirmation-semantics'],
});

export function scoreInitialContent(rowId, spec) {
  if (!Object.hasOwn(CONTENT_CHECKS, rowId)) throw new Error('Unknown frozen row');
  const validation = validateSpec(spec);
  if (!validation.ok) return { eligible: false, reason: `shared-schema:${validation.errors[0].path}` };
  const input = nameInput(spec), button = saveButton(spec);
  const cards = cardValues(spec), texts = textValues(spec), layout = firstLayout(spec);
  const formCard = cards.find((card) => card.children.includes('name') && card.children.includes('save'));
  const helpCard = cards.find((card) => card !== formCard && card.children.some((id) => spec.elements[id]?.type === 'Text'));
  const visibleCopy = [...texts, ...nodeValues(spec, 'Input').map((node) => node.props.label),
    ...nodeValues(spec, 'Button').map((node) => node.props.label)];
  const definitions = {
    'one-name-input': nodeValues(spec, 'Input').length === 1 && input?.props.value?.$bindState === '/name',
    'one-save-button': nodeValues(spec, 'Button').length === 1 && button?.on?.press?.action === 'save',
    'light-tone': formCard?.props.tone === 'light',
    'dark-tone': formCard?.props.tone === 'dark',
    'korean-script-copy': visibleCopy.length > 0 && visibleCopy.every(containsHangul),
    'exact-heading-profile-settings': texts.includes('Profile settings'),
    'exact-label-name': input?.props.label === 'Name',
    'exact-button-save-profile': button?.props.label === 'Save profile',
    'single-column': layout.props.columns === 'single',
    'responsive-columns': layout.props.columns === 'responsive',
    'spacious-padding': formCard?.props.padding === 'spacious',
    'two-separate-cards': cards.length >= 2 && Boolean(formCard) && Boolean(helpCard),
    'help-card-text': Boolean(helpCard),
    'fractional-gap': layout.props.gap === 'fractional',
    'fractional-padding': formCard?.props.padding === 'fractional',
    'wide-gap': layout.props.gap === 'wide',
    'exact-heading-my-profile': texts.includes('내 프로필'),
    'exact-label-korean-name': input?.props.label === '이름',
    'exact-button-korean-save': button?.props.label === '저장',
    'help-text-present': texts.length >= 2,
  };
  const checks = CONTENT_CHECKS[rowId].map((id) => id === 'manual-local-confirmation-semantics'
    ? { id, pass: null, reason: 'Human review: help text must explain that save shows a local confirmation.' }
    : id === 'manual-korean-language-quality'
      ? { id, pass: null, reason: 'Human review: visible copy should read naturally in Korean.' }
      : check(id, definitions[id]));
  return { eligible: true, rubricVersion: RUBRIC_VERSION, checks,
    objectivePass: checks.filter((item) => item.pass !== null).every((item) => item.pass),
    manualPending: checks.some((item) => item.pass === null),
    observedCopy: { texts, inputLabel: input?.props.label ?? null, buttonLabel: button?.props.label ?? null } };
}
