# Pydantic AI Chat Endpoint Guide

## 🎯 New Endpoint: `/api/chat/{chat_id}/ai`

We've successfully created a **new parallel chat endpoint** that uses Pydantic AI with full MCP integration while maintaining the existing OpenAI chat system unchanged.

## 🚀 What's New

### **Endpoint Comparison**

| Feature               | Regular Chat (`/api/chat/{chat_id}`) | Pydantic AI Chat (`/api/chat/{chat_id}/ai`) |
| --------------------- | ------------------------------------ | ------------------------------------------- |
| **Streaming Format**  | ✅ AI SDK V5                         | ✅ AI SDK V5 (identical)                    |
| **MCP Tool Access**   | ❌ None                              | ✅ Full access                              |
| **Code Awareness**    | ❌ Limited                           | ✅ Repository context                       |
| **Tool Capabilities** | Only `execute_python_code`           | All MCP tools + Python                      |
| **Request Format**    | Same                                 | Same                                        |
| **Response Headers**  | Standard                             | + `X-Chat-Type`, `X-MCP-Enabled`            |

### **Available MCP Tools**

- `search_code`: Find code patterns, functions, implementations
- `find_entities`: Discover classes, functions, files, modules
- `get_entity_relationships`: Map dependencies and relationships
- `qa_codebase`: Get comprehensive codebase insights
- `generate_diagram`: Create visual code structure representations

## 📡 Usage

### **Basic Request**

```bash
curl -X POST "http://localhost:8000/api/chat/{chat_id}/ai" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "How does the Universal Agent Factory work?",
        "id": "msg-123"
      }
    ],
    "model": "gpt-4o"
  }' \
  --no-buffer
```

### **With Repository Context**

```bash
curl -X POST "http://localhost:8000/api/chat/{chat_id}/ai?repository_name=woolly" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Find all API endpoints in this project",
        "id": "msg-456"
      }
    ]
  }' \
  --no-buffer
```

### **JavaScript/TypeScript Usage**

```typescript
// Same interface as regular chat, just different endpoint
const response = await fetch(`/api/chat/${chatId}/ai?repository_name=woolly`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: [
      {
        role: "user",
        content: "Explain the MCP integration pattern used here",
        id: generateId(),
      },
    ],
    model: "gpt-4o",
  }),
});

// Same AI SDK V5 streaming format
const reader = response.body?.getReader();
// ... handle streaming as usual
```

## 🎯 When to Use Each Endpoint

### **Use Regular Chat (`/api/chat/{chat_id}`) for:**

- General conversations
- Simple Q&A
- Non-code related discussions
- When you want faster responses (no MCP overhead)
- Python code execution only

### **Use Pydantic AI Chat (`/api/chat/{chat_id}/ai`) for:**

- Code-related questions
- Repository exploration
- Technical discussions needing context
- Architecture explanations
- API documentation queries
- Debugging help
- Code analysis requests

## 🔧 Smart Features

### **Automatic MCP Detection**

The endpoint automatically detects when MCP tools would be helpful based on keywords:

- Code terms: `code`, `function`, `class`, `file`, `api`, `implementation`
- Query terms: `how does`, `where is`, `find`, `search`, `explain`
- Technical terms: `architecture`, `pattern`, `design`, `bug`, `test`

### **Conversation Context**

- Maintains full conversation history
- Provides repository context to the AI
- Preserves chat state across messages
- Same database integration as regular chat

### **Error Handling**

- Graceful fallback if MCP server unavailable
- Specific error messages for different failure modes
- Maintains same error response format as regular chat

## 📊 Response Format

### **Headers**

```
Content-Type: text/plain; charset=utf-8
Cache-Control: no-cache
Connection: keep-alive
Transfer-Encoding: chunked
X-Chat-Type: pydantic-ai
X-MCP-Enabled: true
X-Repository: woolly
```

### **Streaming Format (AI SDK V5)**

```
1:{"id":"msg-789","role":"assistant","parts":[]}
0:{"type":"text","text":"I'll help you understand the Universal Agent Factory. Let me search the codebase first."}
9:{"toolCallId":"tool-123","toolName":"search_code","args":{"query":"UniversalAgentFactory"}}
a:{"toolCallId":"tool-123","toolName":"search_code","args":{"query":"UniversalAgentFactory"},"state":"result","result":{"matches":5,"files":["universal.py"]}}
0:{"type":"text","text":"Based on the code search, I found the Universal Agent Factory..."}
2:{"id":"msg-789","role":"assistant","parts":[{"type":"text","text":"Complete response content"}]}
e:{"finishReason":"stop","usage":{"promptTokens":150,"completionTokens":300},"isContinued":false}
```

## 🧪 Testing

### **Run the Test Script**

```bash
# Make sure your server is running
python test_pydantic_chat.py
```

### **Manual Testing**

```bash
# Test basic functionality
curl -X POST "http://localhost:8000/api/chat/$(uuidgen)/ai" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello!","id":"test-1"}]}' \
  --no-buffer

# Test MCP integration
curl -X POST "http://localhost:8000/api/chat/$(uuidgen)/ai" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"How does the agent system work?","id":"test-2"}]}' \
  --no-buffer
```

## 🛡️ Safety & Rollback

### **No Breaking Changes**

- Existing chat endpoint unchanged
- Same request/response format
- Same database schema
- Same frontend compatibility

### **Easy Rollback**

If issues arise:

1. Simply stop using the `/ai` endpoint
2. Regular chat continues working normally
3. No data loss or corruption
4. Can debug Pydantic AI issues separately

### **Monitoring**

- Check `X-Chat-Type` header to identify endpoint usage
- Monitor MCP server availability
- Track error rates between endpoints
- Compare response times

## 📈 Benefits Achieved

✅ **MCP Integration**: Chat now has full codebase access  
✅ **Code Reduction**: Simpler streaming logic using existing agent system  
✅ **Same Interface**: No frontend changes needed  
✅ **Parallel Development**: Can iterate without breaking existing system  
✅ **Easy Testing**: Side-by-side comparison possible  
✅ **Gradual Migration**: Can migrate users incrementally

## 🔮 Next Steps

1. **Frontend Integration**: Add UI toggle to switch between endpoints
2. **Performance Monitoring**: Compare response times and accuracy
3. **User Feedback**: Gather feedback on MCP-enabled responses
4. **Feature Expansion**: Add more MCP tools as needed
5. **Migration Strategy**: Plan gradual migration if Pydantic AI proves superior

---

**The new endpoint is ready for testing and provides full MCP integration while maintaining complete compatibility with the existing chat system!**
