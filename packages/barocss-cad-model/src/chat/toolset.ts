// Which tool list a model reads (A5.3, O11): v1, the 58 tools one by one (`barocss-cad-tools-v1`), or v2, the 13
// consolidated tools (`barocss-cad-tools-v2`, groups.ts) with `describe` for the detail. Both run on the one tool layer
// (v2 calls are v1 calls), so the A/B (A5.5) compares only what the model reads. `CAD_TOOLSET=v2` picks v2 for the
// chat server and the MCP server; v1 stays the default until the A/B decides.
import type { ToolDefinition } from './api';
import { annotationsOf, outputSchemaOf, TOOL_CONTRACT_V2, TOOL_CONTRACT_VERSION, type JsonSchema } from './contract';
import { GROUPS, V2_OF } from './groups';
import { CHAT_COMMANDS, featureKinds, SYSTEM_PROMPT, TOOLS } from './tools';

/** `json` (A5.5): v1 without run_script — the A/B's JSON-only arm, today's tools before the script. */
export type Toolset = 'v1' | 'v2' | 'json';
export function toolset(): Toolset { const v = typeof process !== 'undefined' ? process.env?.CAD_TOOLSET : undefined; return v === 'v2' || v === 'json' ? v : 'v1'; }

const v1Tool = (name: string) => TOOLS.find(t => t.name === name)!;
/** Text with each v1 tool name that has an underscore written as its group's action (`apply_ops` → `features.batch`). */
const v2Names = (text: string) => text.replace(/\b[a-z]+(?:_[a-z]+)+\b/g, w => V2_OF.get(w) ?? w);
const actionList = (name: string) => Object.entries(GROUPS[name].actions).map(([a, [, hint]]) => hint ? `${a} (${hint})` : a).join('; ');

function groupTool(name: string): ToolDefinition {
  const g = GROUPS[name], actions = Object.keys(g.actions);
  if (name === 'model') { const t = v1Tool('run_script'); return { name, description: v2Names(t.description), input_schema: t.input_schema }; }
  if (name === 'describe') return {
    name, description: 'What this list leaves out, on request: {"tool"} its actions; {"tool", "action"} that action\'s full description and arguments; {"command"} a command\'s selection and values; {"feature"} a feature kind\'s node JSON. Ask before using an action, command or feature kind the first time.',
    input_schema: { type: 'object', properties: { tool: { type: 'string' }, action: { type: 'string' }, command: { type: 'string' }, feature: { type: 'string' } }, additionalProperties: false },
  };
  const extra = name === 'features' ? ` Commands: ${CHAT_COMMANDS.join(', ')}. Feature kinds: ${featureKinds().join(', ')}.` : '';
  return { name, description: `${g.about} Pass "action" and its arguments. Actions: ${actionList(name)}.${extra}`, input_schema: { type: 'object', properties: { action: { type: 'string', enum: actions } }, required: ['action'] } };
}
/** The consolidated tools. */
export const TOOLS_V2: ToolDefinition[] = Object.keys(GROUPS).map(groupTool);

/** The v1 prompt with each tool named as its group's action (`query.measure`), and how to call them. */
// (Tool names with an underscore are mapped as words; the few one-word names only where the prompt names the tool,
// never the English word: "propose it (propose)", "a section".)
const PHRASES: [string, string][] = [
  ['interference (overlap and clearance), section, wall_thickness and draft', 'query.interference (overlap and clearance), query.section, query.wall and query.draft'],
  ['(propose)', '(proposals.propose)'], ['inspect gives', 'query.inspect gives'], ['ops of propose', 'ops of proposals.propose'],
];
export const SYSTEM_PROMPT_V2 = v2Names(PHRASES.reduce((p, [a, b]) => p.split(a).join(b), SYSTEM_PROMPT))
  .replace(/\n\n/, '\n\nTools take an "action": query.measure is the query tool with action "measure". describe gives an action\'s arguments, a command\'s values or a feature kind\'s JSON when you need them.\n\n');

/** A tool as MCP lists it: title, annotations and, where the result has a fixed shape, its output schema. */
export function listed(t: ToolDefinition) {
  // (The title once, at the top as MCP lists it; the annotations' hints without it again — RD1: the list had grown past
  // A5.1's 15k-character guard on what the contract adds, a duplicated title being 1.6k of it.)
  // (A6.2: a read tool lists readOnlyHint without destructiveHint and idempotentHint, which MCP defines as meaningful only
  // when readOnlyHint is false — the list had grown past that guard again.)
  const { title, ...all } = annotationsOf(t.name), out = outputSchemaOf(t.name);
  // (A6.4: readOnlyHint always said; destructiveHint and idempotentHint left out at MCP's defaults (true, false); openWorldHint
  // false always said, its default being true. The internal annotations and the frozen contract keep every hint.)
  const hints = all.readOnlyHint ? { readOnlyHint: true, openWorldHint: all.openWorldHint } : { readOnlyHint: false, ...(all.destructiveHint ? {} : { destructiveHint: false }), ...(all.idempotentHint ? { idempotentHint: true } : {}), openWorldHint: all.openWorldHint };
  return { name: t.name, title, description: t.description, inputSchema: t.input_schema, ...(out ? { outputSchema: out } : {}), annotations: hints };
}
/** The JSON-only arm: the v1 tools but run_script, the prompt without its paragraph. */
const TOOLS_JSON = TOOLS.filter(t => t.name !== 'run_script');
export const SYSTEM_PROMPT_JSON = SYSTEM_PROMPT.replace(/\n\nFor a part of many steps or repeated features, write it as one run_script[^\n]*/, '');
/** What a model reads for a tool set: the contract's version, the tools, the system prompt. */
export function toolsetOf(set: Toolset = toolset()): { version: string; tools: ToolDefinition[]; prompt: string } {
  if (set === 'v2') return { version: TOOL_CONTRACT_V2, tools: TOOLS_V2, prompt: SYSTEM_PROMPT_V2 };
  return set === 'json' ? { version: TOOL_CONTRACT_VERSION, tools: TOOLS_JSON, prompt: SYSTEM_PROMPT_JSON } : { version: TOOL_CONTRACT_VERSION, tools: TOOLS, prompt: SYSTEM_PROMPT };
}
export type { JsonSchema };
