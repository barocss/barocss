// The slice of the Claude Messages API the chat uses: content blocks, messages and tool definitions.
// (The browser never talks to the API itself: the dev proxy in server/chatProxy.ts adds the key, the
// model and the request options.)

export type TextBlock = { type: 'text'; text: string };
export type ThinkingBlock = { type: 'thinking'; thinking: string; signature: string };
export type RedactedThinkingBlock = { type: 'redacted_thinking'; data: string };
export type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown };
/** A server-side fallback boundary: the model before it declined and the next one continued. */
export type FallbackBlock = { type: 'fallback'; [key: string]: unknown };
export type ContentBlock = TextBlock | ThinkingBlock | RedactedThinkingBlock | ToolUseBlock | FallbackBlock | { type: string; [key: string]: unknown };

export type ToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };
export type MessageParam =
  | { role: 'user'; content: (TextBlock | ToolResultBlock)[] }
  | { role: 'assistant'; content: ContentBlock[] };

export interface AssistantMessage {
  content: ContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'pause_turn' | 'refusal' | null | string;
  stop_details?: { category?: string | null; explanation?: string | null } | null;
  model?: string;
}

export interface ToolDefinition { name: string; description: string; input_schema: Record<string, unknown> }

/** What the browser sends the proxy: everything but the model and the request options. */
export interface ChatRequest { system: string; tools: ToolDefinition[]; messages: MessageParam[] }

/** One model call; `onText` receives text as it streams. */
export interface Transport {
  send(request: ChatRequest, options: { signal?: AbortSignal; onText?: (delta: string) => void }): Promise<AssistantMessage>;
}

/**
 * The assistant content to send back next time. After a mid-output fallback the declined attempt's
 * thinking and tool calls (before the last fallback block) are left out; everything else is kept as it came.
 */
export function echoContent(content: ContentBlock[]): ContentBlock[] {
  const last = content.map(b => b.type).lastIndexOf('fallback');
  if (last < 0) return content;
  return content.filter((b, i) => i > last || !['thinking', 'redacted_thinking', 'tool_use'].includes(b.type));
}

/** The tool calls to run: those after the last fallback boundary. */
export function toolUses(content: ContentBlock[]): ToolUseBlock[] {
  const last = content.map(b => b.type).lastIndexOf('fallback');
  return content.filter((b, i): b is ToolUseBlock => i > last && b.type === 'tool_use');
}
