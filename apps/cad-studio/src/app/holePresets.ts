import type { Values } from '@barocss/cad-model/app/commands';

export type HoleOptions =
  | { type: 'through'; d: number }
  | { type: 'blind'; d: number; depth: number }
  | { type: 'counterbore'; d: number; cd: number; ch: number }
  | { type: 'countersink'; d: number; csd: number };

export type HolePreset = { name: string; options: HoleOptions };
type Store = Pick<Storage, 'getItem' | 'setItem'> | null;
type Result = { ok: true; presets: HolePreset[] } | { ok: false; message: string };

export const HOLE_PRESETS_KEY = 'barocss:cad:hole-presets:v1';
export const HOLE_PRESET_NAME_LIMIT = 48;
const PRESET_LIMIT = 24;
const STORAGE_LIMIT = 16_384;
const unavailable = 'Hole preset storage is unavailable.';
const malformed = 'Saved hole presets could not be read.';
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const atLeast = (value: unknown, minimum: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= minimum;
const knownType = (type: unknown): type is HoleOptions['type'] =>
  type === 'through' || type === 'blind' || type === 'counterbore' || type === 'countersink';

export function canUseHolePresets(values: Values): boolean {
  return values.pat === 'one' && knownType(values.type);
}

export function holePresetName(value: string): string | null {
  const name = value.trim();
  if (!name || name.length > HOLE_PRESET_NAME_LIMIT) return null;
  for (const character of name) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) return null;
  }
  return name;
}

export const sameHolePresetName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function readOptions(value: Record<string, unknown>): HoleOptions | null {
  const { type, d } = value;
  if (!atLeast(d, 0.5)) return null;
  if (type === 'through') return { type, d };
  if (type === 'blind' && atLeast(value.depth, 0.5)) return { type, d, depth: value.depth };
  if (type === 'counterbore' && atLeast(value.cd, 1) && value.cd > d && atLeast(value.ch, 0.5)) {
    return { type, d, cd: value.cd, ch: value.ch };
  }
  if (type === 'countersink' && atLeast(value.csd, 1) && value.csd > d) return { type, d, csd: value.csd };
  return null;
}

export function holePresetOptions(values: Values): HoleOptions | null {
  return canUseHolePresets(values) ? readOptions(values) : null;
}

function decode(data: unknown): HolePreset[] | null {
  if (!record(data) || data.version !== 1 || !Array.isArray(data.presets) || Object.keys(data).length !== 2 ||
      data.presets.length > PRESET_LIMIT) return null;
  const presets: HolePreset[] = [];
  for (const entry of data.presets) {
    if (!record(entry) || Object.keys(entry).length !== 2) return null;
    const { name, options: raw } = entry;
    if (typeof name !== 'string' || holePresetName(name) !== name || !record(raw) ||
        presets.some(preset => sameHolePresetName(preset.name, name))) return null;
    const options = readOptions(raw);
    if (!options || Object.keys(raw).length !== Object.keys(options).length) return null;
    presets.push({ name, options });
  }
  return presets;
}

export function readHolePresets(store: Store): Result {
  if (!store) return { ok: false, message: unavailable };
  let text: string | null;
  try { text = store.getItem(HOLE_PRESETS_KEY); }
  catch { return { ok: false, message: unavailable }; }
  if (text === null) return { ok: true, presets: [] };
  try {
    const presets = text.length <= STORAGE_LIMIT ? decode(JSON.parse(text)) : null;
    return presets ? { ok: true, presets } : { ok: false, message: malformed };
  } catch { return { ok: false, message: malformed }; }
}

export function writeHolePresets(store: Store, before: readonly HolePreset[], next: HolePreset[]): Result {
  if (!store) return { ok: false, message: unavailable };
  const current = readHolePresets(store);
  if (!current.ok) return current;
  if (JSON.stringify(current.presets) !== JSON.stringify(before)) {
    return { ok: false, message: 'Hole presets changed. Review the current list and try again.' };
  }
  if (next.length > PRESET_LIMIT) return { ok: false, message: `Save up to ${PRESET_LIMIT} hole presets.` };
  const data = { version: 1, presets: next };
  const validated = decode(data);
  if (!validated) return { ok: false, message: 'The hole preset could not be saved.' };
  try { store.setItem(HOLE_PRESETS_KEY, JSON.stringify({ version: 1, presets: validated })); }
  catch { return { ok: false, message: 'Hole preset changes could not be saved.' }; }
  return { ok: true, presets: validated };
}
