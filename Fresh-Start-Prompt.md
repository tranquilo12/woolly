# Fresh Start Prompt: Phase 5.4 - Proper useChat Implementation & Multi-Chat Support

## 🎯 **CURRENT STATUS & CONTEXT**

**Project:** Woolly - Comprehensive codebase analysis and streaming optimization system  
**Architecture:** FastAPI + Pydantic AI + Universal Agent Factory (backend) + Next.js 15 + React 19 + shadcn/ui (frontend)  
**Achievement:** 81% code reduction through Universal Agent patterns  
**Current Phase:** Phase 5.4 - Proper useChat Implementation & Multi-Chat Support  
**Previous Phase Status:** ✅ Phase 5.3 Complete - Frontend-Backend Alignment & Component Cleanup

## 📋 **CRITICAL ISSUE IDENTIFIED**

We've veered from the original plan of using native `useChat` methods properly. The current implementation:

- ❌ Removed `/app/api/chat/[id]/route.ts` which is needed for multiple conversations
- ❌ Created a single `/api/chat` route that doesn't follow Vercel AI SDK patterns
- ❌ Not utilizing full `useChat` functionality for conversation management
- ❌ Missing proper chat routing to backend Universal Agent Factory

## 🎯 **PHASE 5.4 OBJECTIVES**

### **Primary Goal:** Implement proper `useChat` functionality with multiple conversation support

**Reference Documentation:**

- Vercel AI SDK: https://ai-sdk.dev/llms.txt
- Pydantic AI: https://ai.pydantic.dev/llms-full.txt
- Backend Plan: `Backend-Simplification-Plan.md` Phase 5 Section

### **Key Requirements:**

1. **Proper useChat Routes**: Implement all standard useChat API routes
2. **Multi-Chat Support**: Enable multiple simultaneous conversations
3. **Backend Integration**: Route all useChat calls to Universal Agent Factory
4. **Streaming Support**: Maintain real-time streaming capabilities
5. **Conversation Persistence**: Store and retrieve chat history

## 🔧 **TECHNICAL IMPLEMENTATION PLAN**

### **Step 1: Restore & Implement Proper useChat API Routes**

**Files to Create/Modify:**

```
app/api/chat/route.ts           - Main chat endpoint (POST)
app/api/chat/[id]/route.ts      - Individual chat operations (GET, PUT, DELETE)
app/api/chat/[id]/messages/route.ts - Message operations within chat
```

**Implementation Pattern (from ai-sdk.dev):**

```typescript
// app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";

export async function POST(req: Request) {
  const { messages, chatId } = await req.json();

  // Route to backend Universal Agent Factory
  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages: convertToModelMessages(messages),
    // Custom backend integration here
  });

  return result.toUIMessageStreamResponse();
}
```

### **Step 2: Backend Universal Agent Factory Integration**

**Files to Modify:**

```
app/api/chat/route.ts           - Main integration point
lib/api/backend-client.ts       - Backend communication layer
```

**Integration Pattern:**

```typescript
// Route useChat calls to backend Universal Agent Factory
const backendResponse = await fetch(
  `${BACKEND_URL}/api/v1/agents/execute/streaming`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_type: "UNIVERSAL",
      repository_name: "current-repo",
      user_query: lastMessage.content,
      conversation_history: previousMessages,
    }),
  }
);
```

### **Step 3: Multi-Chat Conversation Management**

**Files to Modify:**

```
app/chat/[id]/page.tsx          - Individual chat page
components/chat.tsx             - Main chat component
hooks/use-chats.ts              - Chat management hook
```

**useChat Integration:**

```typescript
// Proper useChat usage with conversation ID
const { messages, input, handleInputChange, handleSubmit } = useChat({
  id: chatId,
  api: "/api/chat",
  initialMessages: existingMessages,
  onFinish: (message) => {
    // Handle message completion
  },
});
```

### **Step 4: Conversation Persistence & History**

**Files to Modify:**

```
app/api/chat/[id]/route.ts      - CRUD operations for chats
lib/api/chat-storage.ts         - Chat persistence layer
```

**Database Integration:**

```typescript
// Use existing database models for chat persistence
// Reference: migrations/011e9d15d3e8_add_chat_and_message_tables.py
```

## 📊 **DETAILED TASK BREAKDOWN**

### **Phase 5.4-A: API Route Structure**

- [ ] **Task 1**: Create proper `app/api/chat/route.ts` with POST method
- [ ] **Task 2**: Restore `app/api/chat/[id]/route.ts` with GET/PUT/DELETE methods
- [ ] **Task 3**: Add `app/api/chat/[id]/messages/route.ts` for message operations
- [ ] **Task 4**: Test all routes with proper useChat integration

### **Phase 5.4-B: Backend Integration**

- [ ] **Task 5**: Create `lib/api/backend-client.ts` for Universal Agent Factory communication
- [ ] **Task 6**: Implement streaming response forwarding from backend
- [ ] **Task 7**: Add conversation history management
- [ ] **Task 8**: Test end-to-end backend integration

### **Phase 5.4-C: Frontend useChat Implementation**

- [ ] **Task 9**: Update `components/chat.tsx` to use proper useChat patterns
- [ ] **Task 10**: Implement multi-chat support in `app/chat/[id]/page.tsx`
- [ ] **Task 11**: Update `hooks/use-chats.ts` for conversation management
- [ ] **Task 12**: Test multi-chat functionality

### **Phase 5.4-D: Conversation Persistence**

- [ ] **Task 13**: Implement chat CRUD operations using existing database
- [ ] **Task 14**: Add conversation history retrieval
- [ ] **Task 15**: Test conversation persistence across sessions
- [ ] **Task 16**: Verify database integration with existing models

## 🚨 **CRITICAL CONSTRAINTS & REQUIREMENTS**

### **Must Maintain:**

1. **81% Code Reduction Achievement** - Don't add unnecessary complexity
2. **MCP Integration** - Keep working LLM-MCP interface intact [[memory:3011103]]
3. **Universal Agent Factory** - All requests must route through backend
4. **Streaming Capabilities** - Real-time responses must continue working
5. **shadcn/ui Components** - Use existing component library

### **Must Use MCP Client Tools:**

- Use provided MCP client via cursor MCP tools, not direct HTTP calls [[memory:2924205]]
- Access MCP server functionality through exposed tools only

### **Architecture Alignment:**

- Follow Backend-Simplification-Plan.md Phase 5 specifications
- Maintain Universal Agent Factory as single source of truth
- Preserve existing database schema and models
- Keep frontend-backend separation clean

## 🎯 **SUCCESS CRITERIA**

### **Functional Requirements:**

- [ ] Multiple chat conversations work simultaneously
- [ ] useChat hook properly manages conversation state
- [ ] All useChat methods (messages, input, handleSubmit) function correctly
- [ ] Conversation history persists across sessions
- [ ] Streaming responses work in real-time
- [ ] Backend Universal Agent Factory receives all requests

### **Technical Requirements:**

- [ ] All API routes follow Vercel AI SDK patterns
- [ ] TypeScript types are properly maintained
- [ ] React 19 hooks work without violations
- [ ] Database operations use existing models
- [ ] Error handling is graceful and informative

## 📁 **KEY FILES TO FOCUS ON**

### **High Priority (Must Change):**

```
app/api/chat/route.ts              - Main chat endpoint
app/api/chat/[id]/route.ts         - Individual chat operations
app/chat/[id]/page.tsx             - Chat page component
components/chat.tsx                - Main chat component
lib/api/backend-client.ts          - Backend communication
```

### **Medium Priority (May Change):**

```
hooks/use-chats.ts                 - Chat management
types/agent-messages.ts            - Type definitions
components/chat-context.tsx        - Chat context provider
```

### **Reference Files (Don't Change):**

```
Backend-Simplification-Plan.md     - Master plan reference
api/agents/universal.py            - Backend Universal Agent Factory
migrations/011e9d15d3e8_*.py       - Database schema
```

## 🔄 **NEXT STEPS FOR IMPLEMENTATION**

### **Immediate Actions:**

1. **Analyze Current State**: Review existing `/api/chat/route.ts` implementation
2. **Study AI SDK Patterns**: Reference ai-sdk.dev documentation for proper patterns
3. **Plan API Structure**: Design proper useChat-compatible API routes
4. **Create Todo List**: Generate specific, actionable todo items for implementation

### **Implementation Order:**

1. **API Routes First**: Establish proper endpoint structure
2. **Backend Integration**: Connect to Universal Agent Factory
3. **Frontend Updates**: Implement proper useChat usage
4. **Testing & Validation**: Verify multi-chat functionality

## 🎯 **TODO GENERATION INSTRUCTIONS**

**For the next conversation, create a todo list with these specific tasks:**

1. **API Route Analysis**: Review current `/api/chat/route.ts` and identify gaps
2. **useChat Pattern Research**: Study Vercel AI SDK documentation for proper implementation
3. **Backend Integration Planning**: Design connection to Universal Agent Factory
4. **Multi-Chat Architecture**: Plan conversation management system
5. **Database Integration**: Verify existing chat/message models compatibility
6. **Implementation Roadmap**: Create step-by-step implementation plan
7. **Testing Strategy**: Plan validation approach for multi-chat functionality

**Each todo should be:**

- Specific and actionable
- Have clear dependencies
- Include acceptance criteria
- Reference relevant files and documentation
- Support the overall Phase 5.4 objectives

## 📚 **REFERENCE DOCUMENTATION**

- **Vercel AI SDK**: https://ai-sdk.dev/llms.txt
- **Pydantic AI**: https://ai.pydantic.dev/llms-full.txt
- **Backend Plan**: Backend-Simplification-Plan.md (Phase 5 section)
- **Database Schema**: migrations/011e9d15d3e8_add_chat_and_message_tables.py
- **Universal Agent Factory**: api/agents/universal.py

---

**🎯 Current Priority: Implement proper useChat functionality with multiple conversation support while maintaining all existing achievements and architectural principles.**
