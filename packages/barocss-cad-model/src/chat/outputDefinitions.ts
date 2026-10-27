// Schema metadata stays independent of output execution and its team/tool consumers.
import type { ToolDefinition } from './api';

const string = { type: 'string' }, number = { type: 'number' };
const part = { ...string, description: 'base (default) or an existing instance id; local coordinates.' };
const definition = (name: string, description: string, properties: Record<string, unknown>): ToolDefinition => ({ name, description, input_schema: { type: 'object', properties: { ...properties, expectedRevision: { ...string, description: 'Optional documentRevision precondition: a mismatch refuses the output as stale.' } }, additionalProperties: false } });
export const OUTPUT_TOOLS: ToolDefinition[] = [
  definition('output_bom', 'Reads the current BOM using the same generator as the BOM panel, including bought and made elements and bead completeness. Returns bom.json with its content, byte size and SHA-256. Does not change or approve the document.', {}),
  definition('output_purchase_csv', 'Reads the current purchase list as the BOM panel exports it: catalogue, source and estimate fields retained. withMade adds made lines. Returns purchase.csv; does not change the document.', { withMade: { type: 'boolean' } }),
  definition('output_clearance', 'Reads the current assembly clearance map. Contact remains contact until an exact overlap check; designed seats remain identified. Returns clearance.json, with pending and refused states retained. No collision approval is implied. near: the gap reported as near, mm (default 1).', { near: number }),
  definition('output_cam_package', 'Exports the selected part’s existing 2.5D CAM preview package. NOT FOR PRODUCTION: no G-code. Uses the shop stock rows, including inherited rows and local overrides; refuses missing or non-fitting stock. toolDiameter: the cutter, mm. Returns cam-package.json without changing the document.', { part, toolDiameter: number }),
  definition('output_print_layers', 'Exports selected display-mesh print layers, not slicer or machine toolpaths. layers is up to 64 distinct zero-based indices, default [0]. direction defaults to +Z; layerHeight (mm) defaults to estimated 0.2 mm and overhangLimit (degrees from the vertical) to estimated 45°. Returns print-layers.json without changing the document.', { part, layerHeight: number, overhangLimit: number, direction: { type: 'array', items: number, minItems: 3, maxItems: 3 }, layers: { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 64 } }),
  definition('output_bundle', 'Exports the existing approval evidence bundle only when complete, current and independently verified. baseline chooses an existing approved BOM baseline, otherwise the newest approved one. Refuses missing approval, material sources, incomplete bead accounting or stale evidence. Never creates or approves a baseline.', { baseline: string }),
];
export const OUTPUT_TOOL_NAMES = new Set(OUTPUT_TOOLS.map(t => t.name));
