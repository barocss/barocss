// The tool list a model reads (A5.3, O11): 13 consolidated tools (`barocss-cad-tools-v2`, groups.ts), each action one of
// the tool layer's handlers, with `describe` for the detail. The owner, 2026-10-21 (O105): "우리는 릴리즈 한게 아니라서
// toolset v1 은 없어도 돼" — the 83-tool v1 list is gone as a surface; this is the only one the chat server, MCP and the
// CLI serve. The handlers keep their names (`run_command`, …): v2 calls are handler calls. New commands and feature kinds
// go into the live registries and are named in the features tool's text, their detail behind describe, never as a new
// enum or tool.
import type { ToolDefinition } from './api';
import { annotationsOf, outputSchemaOf, TOOL_CONTRACT_V2, type JsonSchema } from './contract';
import { GROUPS, v2Text } from './groups';
import { CHAT_COMMANDS, featureKinds, SYSTEM_PROMPT, TOOLS } from './tools';

/** A handler's own definition (its name, description and input schema): what describe and the model tool read. */
const handler = (name: string) => TOOLS.find(t => t.name === name)!;
const actionList = (name: string) => Object.entries(GROUPS[name].actions).map(([a, [, hint]]) => hint ? `${a} (${hint})` : a).join('; ');

function groupTool(name: string): ToolDefinition {
  const g = GROUPS[name], actions = Object.keys(g.actions);
  if (name === 'model') { const t = handler('run_script'); return { name, description: v2Text(t.description), input_schema: t.input_schema }; }
  if (name === 'describe') return {
    name, description: 'What this list leaves out, on request: {"tool"} its actions; {"tool", "action"} that action\'s full description and arguments; {"command"} a command\'s selection and values; {"feature"} a feature kind\'s node JSON. Ask before using an action, command or feature kind the first time.',
    input_schema: { type: 'object', properties: { tool: { type: 'string' }, action: { type: 'string' }, command: { type: 'string' }, feature: { type: 'string' } }, additionalProperties: false },
  };
  const extra = name === 'features' ? ` Commands: ${CHAT_COMMANDS.join(', ')}. Feature kinds: ${featureKinds().join(', ')}.` : '';
  return { name, description: `${g.about} Pass "action" and its arguments. Actions: ${actionList(name)}.${extra}`, input_schema: { type: 'object', properties: { action: { type: 'string', enum: actions } }, required: ['action'] } };
}
/** The consolidated tools. */
export const TOOLS_V2: ToolDefinition[] = Object.keys(GROUPS).map(groupTool);

/** The handlers' prompt with each tool named as its group's action (`query.measure`), and how to call them. */
// (Tool names with an underscore are mapped as words; the few one-word names only where the prompt names the tool,
// never the English word: "propose it (propose)", "a section".)
const PHRASES: [string, string][] = [
  ['interference (overlap and clearance), section, wall_thickness and draft', 'query.interference (overlap and clearance), query.section, query.wall and query.draft'],
  ['(propose)', '(proposals.propose)'], ['inspect gives', 'query.inspect gives'], ['ops of propose', 'ops of proposals.propose'],
];
export const SYSTEM_PROMPT_V2 = v2Text(PHRASES.reduce((p, [a, b]) => p.split(a).join(b), SYSTEM_PROMPT))
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
/** What a model reads: the contract's version, the tools, the system prompt. */
export const TOOLSET = { version: TOOL_CONTRACT_V2, tools: TOOLS_V2, prompt: SYSTEM_PROMPT_V2 } as const;
export type { JsonSchema };
