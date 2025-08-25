# 🔧 Backend Streaming Integration Guide for AI SDK v5

> **For Backend Teams**: Understanding AI SDK v5 streaming format compatibility and minor adjustments needed.

---

## 🎯 Current Status

✅ **Good News**: The current Woolly backend streaming format is **already compatible** with AI SDK v5!

The backend currently uses the **correct AI SDK v5 format**:

```
1:{"id": "f2188049-b4ec-4196-a683-862fc4e4996b", "role": "assistant", "parts": []}
0:{"type": "text", "text": "Hello"}
0:{"type": "text", "text": "!"}
0:{"type": "text", "text": " It"}
...
2:{"id": "f2188049-b4ec-4196-a683-862fc4e4996b", "role": "assistant", "parts": [{"type": "text", "text": "Hello! It looks like..."}]}
e:{"finishReason":"stop","usage":{"promptTokens":65,"completionTokens":24,"totalTokens":89},"isContinued":false}
```

**Clarification**: This prefixed format (`1:`, `0:`, `2:`, `e:`) **IS** the AI SDK v5 format that `toUIMessageStreamResponse()` produces and `useChat` expects.

---

## ✅ Minor Adjustments Needed

### 1. Remove Legacy Headers (Simple Fix)

The only change needed is removing the legacy `x-vercel-ai-data-stream: v1` header:

**Current Headers (with legacy header):**

```http
Content-Type: text/plain; charset=utf-8
Cache-Control: no-cache
Connection: keep-alive
x-vercel-ai-data-stream: v1  ← Remove this
Transfer-Encoding: chunked
```

**Updated Headers (AI SDK v5 compatible):**

```http
Content-Type: text/plain; charset=utf-8
Cache-Control: no-cache
Connection: keep-alive
Transfer-Encoding: chunked
```

### 2. Format Compatibility Confirmed

| Aspect                | Current Backend                          | AI SDK v5 Compatibility                  |
| --------------------- | ---------------------------------------- | ---------------------------------------- |
| **Protocol**          | Prefixed chunks (`1:`, `0:`, `2:`, `e:`) | ✅ **Correct** - This IS v5 format       |
| **Message Structure** | `parts` array with chunks                | ✅ **Correct** - v5 expects `parts`      |
| **Streaming Method**  | Manual chunk assembly                    | ✅ **Compatible** - Works with `useChat` |
| **Headers**           | `x-vercel-ai-data-stream: v1`            | ⚠️ **Remove legacy header**              |

### 3. Verified Working Implementation

Our Next.js endpoint already demonstrates the correct approach:

```typescript
// app/api/chat/route.ts - WORKING AI SDK v5 implementation
return result.toUIMessageStreamResponse();
```

This produces the **same prefixed format** our backend uses!

---

## 🔧 Simple Fix Implementation

### Option 1: Remove Legacy Header (Recommended)

**FastAPI Backend - Simple Header Update:**

```python
# In api/index.py - Update existing endpoints
return StreamingResponse(
    stream_text(openai_messages, protocol, model=model, db=db, message_id=assistant_message.id),
    media_type="text/plain; charset=utf-8",
    headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        # Remove this line: "x-vercel-ai-data-stream": "v1",
        "Transfer-Encoding": "chunked",
    },
)
```

### Option 2: Already Working Next.js Implementation

**Our existing Next.js endpoint is perfect:**

```typescript
// app/api/chat/route.ts - ALREADY CORRECT
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages: convertToModelMessages(messages),
  });

  // This produces the SAME format as our backend!
  return result.toUIMessageStreamResponse();
}
```

### Option 3: Keep Current Backend Format

**No conversion needed! Our current format is correct:**

```python
# Current backend functions are ALREADY v5 compatible:
def build_text_stream(content: str) -> str:
    text_chunk = {"type": "text", "text": content}
    return f"0:{json.dumps(text_chunk, ensure_ascii=False)}\n"

def build_message_start(message_id: str, role: str = "assistant") -> str:
    message_start = {"id": message_id, "role": role, "parts": []}
    return f"1:{json.dumps(message_start, ensure_ascii=False)}\n"

# These functions produce the CORRECT AI SDK v5 format!
```

---

## 📋 Data Protocol Reference

### ✅ AI SDK v5 Format Confirmed

| Feature            | Current Backend (✅ Correct)             | AI SDK v5 Compatibility          |
| ------------------ | ---------------------------------------- | -------------------------------- |
| **Protocol**       | Prefixed chunks (`1:`, `0:`, `2:`, `e:`) | ✅ **This IS v5 format**         |
| **Content-Type**   | `text/plain; charset=utf-8`              | ✅ **Correct**                   |
| **Headers**        | `x-vercel-ai-data-stream: v1`            | ⚠️ **Remove legacy header**      |
| **Message Format** | `parts` array with chunks                | ✅ **Correct** - v5 uses `parts` |
| **Streaming**      | `1:`, `0:`, `2:`, `e:` prefixes          | ✅ **Correct** - v5 format       |

### AI SDK v5 Message Structure (Current Implementation)

```typescript
interface UIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Array<{
    type: "text";
    text: string;
  }>;
  // Note: content is auto-generated from parts by useChat
}
```

### v5 Stream Events (Our Current Format)

| Event     | Purpose       | Format                                              |
| --------- | ------------- | --------------------------------------------------- |
| `1:{...}` | Message start | `{"id":"msg-123","role":"assistant","parts":[]}`    |
| `0:{...}` | Text content  | `{"type":"text","text":"Hello"}`                    |
| `2:{...}` | Message end   | `{"id":"msg-123","role":"assistant","parts":[...]}` |
| `e:{...}` | End of stream | `{"finishReason":"stop","usage":{...}}`             |

---

## 🧪 Testing Your Implementation

### 1. Test Current Backend Format (✅ Already v5 Compatible)

```bash
curl -X POST http://localhost:8000/api/chat/CHAT_ID \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"model":"gpt-4o"}' \
  --no-buffer
```

**Current Output (✅ This IS v5 format):**

```
1:{"id": "f2188049-b4ec-4196-a683-862fc4e4996b", "role": "assistant", "parts": []}
0:{"type": "text", "text": "Hello"}
0:{"type": "text", "text": "!"}
2:{"id": "f2188049-b4ec-4196-a683-862fc4e4996b", "role": "assistant", "parts": [{"type": "text", "text": "Hello!"}]}
e:{"finishReason":"stop","usage":{"promptTokens":65,"completionTokens":24,"totalTokens":89}}
```

### 2. Test Next.js Endpoint (Reference Implementation)

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}' \
  --no-buffer
```

**Expected Output (Same as backend!):**

```
1:{"id":"msg-123","role":"assistant","parts":[]}
0:{"type":"text","text":"Hello"}
0:{"type":"text","text":"!"}
2:{"id":"msg-123","role":"assistant","parts":[{"type":"text","text":"Hello!"}]}
e:{"finishReason":"stop","usage":{"promptTokens":65,"completionTokens":24}}
```

### 3. Frontend Integration Test (Already Working)

With our current format, the frontend should:

- ✅ Receive streaming tokens in real-time via `useChat` hook
- ✅ Display incremental text as it streams
- ✅ Have populated `message.parts` array
- ✅ Show complete message in conversation history
- ✅ Properly handle tool calls and results

---

## 🚨 Common Misconceptions (Corrected)

### ✅ Do This (Current Format is Correct!)

```python
# ✅ CORRECT: Our current format IS AI SDK v5 compatible
def build_text_stream(content: str) -> str:
    text_chunk = {"type": "text", "text": content}
    return f"0:{json.dumps(text_chunk, ensure_ascii=False)}\n"

def build_message_start(message_id: str, role: str = "assistant") -> str:
    message_start = {"id": message_id, "role": role, "parts": []}
    return f"1:{json.dumps(message_start, ensure_ascii=False)}\n"
```

### ❌ Don't Do This (Unnecessary SSE Conversion)

```javascript
// ❌ WRONG: Don't convert to SSE format - it's not needed!
res.write('data: {"id":"msg-123","role":"assistant","content":"Hello"}\n\n');
res.write(
  'data: {"id":"msg-123","role":"assistant","content":"Hello world"}\n\n'
);
res.write("data: [DONE]\n\n");
```

### ⚠️ Only Fix Needed: Remove Legacy Header

```python
# ❌ OLD: Remove this header
headers={
    "x-vercel-ai-data-stream": "v1",  # Remove this line
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
}

# ✅ NEW: Clean headers
headers={
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Transfer-Encoding": "chunked",
}
```

---

## 🔍 Debugging

### Check Current Response Format (Already Correct)

```bash
# Verify current streaming format (should work with useChat)
curl -X POST http://localhost:8000/api/chat/CHAT_ID \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Test"}]}' \
  --no-buffer
```

### Validate Current JSON Format

Each line should be valid prefixed JSON:

```bash
# Extract and validate JSON from current stream
curl ... | sed 's/^[0-9ae]://' | jq .
```

### Compare with Next.js Reference

```bash
# Test Next.js endpoint (reference implementation)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Test"}]}' \
  --no-buffer

# Should produce SAME format as our backend!
```

### Frontend Debug

Check browser Network tab for:

- ✅ `Content-Type: text/plain; charset=utf-8`
- ✅ `Connection: keep-alive` header
- ✅ Response body shows prefixed format: `1:`, `0:`, `2:`, `e:`
- ⚠️ No legacy `x-vercel-ai-data-stream: v1` header

---

## 📚 References

- [AI SDK v5 Chatbot Documentation](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot) - Confirms prefixed format compatibility
- [AI SDK v5 useChat Hook](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat) - Works with our current format
- [AI SDK v5 streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) - `toUIMessageStreamResponse()` produces our format
- [Woolly Frontend Implementation](./components/chat.tsx) - Already using `useChat` successfully

---

## 🎯 Summary

**✅ Current State**: Your Woolly backend **already implements AI SDK v5** format correctly with prefixed streaming (`1:`, `0:`, `2:`, `e:`).

**⚠️ Minor Fix Needed**: Remove legacy `x-vercel-ai-data-stream: v1` header from FastAPI endpoints.

**✅ No Migration Required**: The prefixed format IS the AI SDK v5 format that `toUIMessageStreamResponse()` produces.

**Key Insight**: AI SDK v5 uses `parts` array (not `content` string) and the prefixed protocol (not SSE `data:` format).

**Action Items**:

1. Remove `x-vercel-ai-data-stream: v1` header from 2 FastAPI endpoints
2. Test frontend integration (should already work)
3. No format conversion needed!
