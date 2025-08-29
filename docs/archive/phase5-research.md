# Phase 5 Research Notes: Streaming APIs Integration

## 1. Pydantic-AI Streaming (`agent.run_stream`)

### Entry-point

```python
async with agent.run_stream(prompt, deps=..., message_history=...) as stream:
```

Returns `StreamedRunResult`.

### `StreamedRunResult` core methods

- `new_messages()` – returns list of `Message` objects added during stream
- `stream_text()` – async iterable producing incremental text deltas (str)
- `get_output()` – awaitable -> final `output` once stream completes
- `all_messages()` – full conversation history (incl. new)

### Message Parts (pydantic_ai.messages)

- `TextPart` – plain text from the model
- `ToolCallPart` – model invocation request with:
  - `tool_name` (str)
  - `args_as_json_str()` helper
  - `tool_call_id` (str or correlating with result)
- `ToolReturnPart` – result payload with matching `tool_call_id`
- Parts can be iterated via `for part in message.parts:`

### Tool Sequencing Pattern

1. Model emits `ToolCallPart`
2. Agent runtime executes tool, injects `ToolReturnPart`
3. LLM continues generation (may chain)

### Back-pressure & Timeouts

`run_stream(..., timeout_s=float | None)` optional kwarg (default infinite). Cancel context to abort.

### Error Handling

Exceptions inside tools propagate as `ToolExceptionPart` (subclass of `MessagePart`) – safe to serialize.

### Pydantic-AI Loop Prevention Hooks

- `StreamedRunResult` exposes `usage` tokens after each message → usable for budget enforcement
- Manual iteration via `async with agent.iter(prompt) as run:` gives node-level access if deeper inspection required

---

## 2. Vercel AI SDK v4 Streaming Contract (`createStream`)

Reference: _ai-sdk.dev/llms.txt_

### Transport

Standard HTTP **SSE** (`text/event-stream`) OR chunked fetch; SDK abstracts both.

### Chunk Shape

One JSON object per `data:` line:

```json
{ "type": "event", "event": "message", "data": { ... } }
```

### Recognized `type` values

- `text`
- `toolCall`
- `toolResult`
- `error`
- `done`

### Event Payloads

- **`toolCall`**: `{ "id": <uuid>, "name": <tool_name>, "args": { ... } }`
- **`toolResult`**: `{ "id": <uuid>, "result": <any serialisable> }` – `id` must match earlier `toolCall`
- **`text`**: `{ "delta": "partial text" }` – multiple chunks accumulate
- **Termination**: Final chunk `{ "type": "done" }` signals stream end
- **Error**: `{ "type": "error", "message": "..." }` followed by stream close

### Client-side Usage Example

```ts
import { createStream } from "ai";

const stream = await createStream("/api/agent", { body: { prompt } });
for await (const chunk of stream) {
  if (chunk.type === "text") setText((prev) => prev + chunk.delta);
  else if (chunk.type === "toolCall") showToolCall(chunk);
  // etc.
}
```

---

## 3. Mapping Strategy

| Pydantic-AI Event              | Vercel Chunk `type` | Content Mapping                                                  |
| ------------------------------ | ------------------- | ---------------------------------------------------------------- |
| `TextPart` via `stream_text()` | `text`              | `{ "delta": <str> }`                                             |
| `ToolCallPart`                 | `toolCall`          | `{ "id": tool_call_id, "name": tool_name, "args": parsed_args }` |
| `ToolReturnPart`               | `toolResult`        | `{ "id": tool_call_id, "result": content }`                      |
| Error / Exception              | `error`             | `{ "message": str(exception) }`                                  |
| Stream completion              | `done`              | `{}`                                                             |

### Additional Headers

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

SDK also accepts chunked `application/json` without SSE framing if `Content-Type: application/stream+json`.

---

## 4. Open Points

1. Confirm whether chunk framing will be SSE (`data:` prefix) or raw JSON – SDK auto-detects but backend must stay consistent
2. Latency vs. throughput: decide flush interval (every awaitable yield vs. coalesce 50ms)
3. Token usage budgeting: current research shows `RunResult.usage` exposes tokens; integrate with `ToolBudget`
4. Nested tool calls: Pydantic-AI supports recursion; our budget logic must track `depth` parameter

---

## 5. Quick PoC Snippet

```python
async def stream_agent_response(request):
    query = request.json()['prompt']
    async with agent.run_stream(query, deps=deps) as result:
        async for delta in result.stream_text():
            yield sse_event('text', {'delta': delta})
        for message in result.new_messages():
            for part in message.parts:
                if isinstance(part, ToolCallPart):
                    yield sse_event('toolCall', {
                        'id': part.tool_call_id,
                        'name': part.tool_name,
                        'args': json.loads(part.args_as_json_str()),
                    })
                elif isinstance(part, ToolReturnPart):
                    yield sse_event('toolResult', {
                        'id': part.tool_call_id,
                        'result': part.content,
                    })
        yield sse_event('done', {})
```

`def sse_event(t, data):` helper returns `f"data: {json.dumps({'type': t, **data})}\n\n"`.

---

## 6. Next Actions (per Master Table)

- ✅ Research complete (tasks #1 & #2)
- ☐ Draft PoC endpoint returning mock events conforming to Vercel spec
- ☐ Start implementing `ToolBudget` model

---
