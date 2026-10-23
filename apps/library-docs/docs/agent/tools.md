# Tools (v2 actions)

The agent works through one tool contract, `barocss-cad-tools-v2`. The chat, [`cad-mcp`](/agent/cli) and
[`cad-cli`](/agent/cli) all serve this list and nothing else. It has 13 tools:

- `model`
- `features`
- `query`
- `history`
- `requirements`
- `proposals`
- `assembly`
- `library`
- `print`
- `drawing`
- `subd`
- `image`
- `describe`

## How a call looks

A call names a tool, and its arguments carry an `action`:

```json
{ "name": "query", "arguments": { "action": "measure", "a": "n1.top" } }
```

That is `query.measure`.

- **One action.** A tool with a single action takes it without saying so: `model` with `{ "source": … }` runs a
  script.
- **The handlers.** Each action stands for one of the tool layer's handlers. The call goes through that handler's own
  gates and gives its results and refusals.
- **Naming faces and edges.** Faces and edges are named as the studio names them: `n1.top`, or an edge as two faces,
  `n1.side0|n1.side1`. Selectors work too: `{"feature": 1, "role": "top"}`, `{"normal": [0, 0, 1], "pick": "max"}`.

## `describe`

The list a model reads each turn stays short, and `describe` gives the detail on request:

| Ask | Returns |
|---|---|
| `{}` | Every tool's actions |
| `{"tool"}` | That tool's actions |
| `{"tool", "action"}` | The action's full description and arguments |
| `{"command"}` | A command's selection and values |
| `{"feature"}` | A feature kind's node JSON |

New commands and feature kinds need no change to the list. The `features` tool names them, and `describe` gives their
detail.

## Results and refusals

- **Data back.** A call returns JSON. A read gives what it read; a change says what it changed.
- **Refusals.** A refused call leaves the part exactly as it was and says why, often with a code the agent can act on.
  For example, `needs_proposal` at L2, or `needs_approval` for a change to the assembly, mates, the drawing, the robot
  or a locked part.
- **Rows.** Rows the agent wrote itself are refused with `[ROWS_NOT_FROM_PERSON]`.
- **All or nothing.** `features.batch` runs several calls all or nothing, and `dryRun` tries them without keeping
  them. `model.run` runs a whole script the same way.

These calls come from `samples/agent-mcp.test.mjs`, which runs them through `cad-mcp` on a 60 × 40 × 8 plate:

<<< @/../samples/agent-mcp.test.mjs#l2

At autonomy L3 the same hole applies, and `cad-mcp` saves the file at once:

<<< @/../samples/agent-mcp.test.mjs#l3

## The per-turn budget

Everything a model reads every turn is held to 25,000 characters at most: the tool list as MCP lists it, and the
system prompt. A test fails if it grows past that, so the detail stays behind `describe`.

## Every action

These tables are generated from the contract's source (`chat/groups.ts`), and the docs check fails if they fall
behind it.

<!--@include: ./_tools.md-->
