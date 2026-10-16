// A chat tool as the model sees it (served to the claude CLI by server/cadMcp.ts).
export interface ToolDefinition { name: string; description: string; input_schema: Record<string, unknown> }
