// Which tool list a model reads (A5.3, O11): v1, the 58 tools one by one (`barocss-cad-tools-v1`), or v2, the 13
// consolidated tools (`barocss-cad-tools-v2`, groups.ts) with `describe` for the detail. Both run on the one tool layer
// (v2 calls are v1 calls), so the A/B (A5.5) compares only what the model reads. `CAD_TOOLSET=v2` picks v2 for the
// chat server and the MCP server; v1 stays the default until the A/B decides.
import type { ToolDefinition } from './api';
import { annotationsOf, outputSchemaOf, TOOL_CONTRACT_V2, TOOL_CONTRACT_VERSION, type JsonSchema } from './contract';
import { GROUPS, V2_OF } from './groups';
import { CHAT_COMMANDS, featureKinds, SYSTEM_PROMPT, TOOLS } from './tools';

export type Toolset = 'v1' | 'v2';
export function toolset(): Toolset { return typeof process !== 'undefined' && process.env?.CAD_TOOLSET === 'v2' ? 'v2' : 'v1'; }

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
  const a = annotationsOf(t.name), out = outputSchemaOf(t.name);
  return { name: t.name, title: a.title, description: t.description, inputSchema: t.input_schema, ...(out ? { outputSchema: out } : {}), annotations: a };
}
/** What a model reads for a tool set: the contract's version, the tools, the system prompt. */
export function toolsetOf(set: Toolset = toolset()): { version: string; tools: ToolDefinition[]; prompt: string } {
  return set === 'v2' ? { version: TOOL_CONTRACT_V2, tools: TOOLS_V2, prompt: SYSTEM_PROMPT_V2 } : { version: TOOL_CONTRACT_VERSION, tools: TOOLS, prompt: SYSTEM_PROMPT };
}
export type { JsonSchema };
