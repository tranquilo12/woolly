# 🚀 Frontend AI SDK Integration Guide

## Overview

This guide provides comprehensive instructions for integrating your frontend application with the Woolly Backend API using Vercel's AI SDK. The backend is fully compatible with **AI SDK V5** and provides streaming chat, agent execution, and triage capabilities.

## 🏗️ Architecture Overview

```
Frontend (AI SDK V5) ←→ Woolly Backend API (V5 Compatible) ←→ OpenAI/LLMs
     ↓                           ↓                              ↓
- React/Next.js            - FastAPI Streaming           - GPT-4o/Claude
- useChat hook             - V5 Format (0:, 9:, a:, e:)  - Tool Calling
- Tool UI Components       - Agent System                - Structured Output
- Streaming UI             - MCP Integration              - Real-time Response
```

## 📦 Installation

Install the AI SDK and required dependencies:

```bash
# Core AI SDK
npm install ai

# Provider packages (choose your LLM provider)
npm install @ai-sdk/openai @ai-sdk/anthropic

# UI components (for React/Next.js)
npm install @ai-sdk/react

# Optional: For structured data validation
npm install zod
```

## 🔧 Environment Configuration

Create a `.env.local` file with your backend configuration:

```env
# Woolly Backend API Configuration
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
# or for production:
# NEXT_PUBLIC_BACKEND_URL=https://your-woolly-backend.com

# Optional: Direct LLM provider keys (if not using backend proxy)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

## 🤖 Basic Chat Integration

### 1. Simple Chat Component

```tsx
"use client";

import { useChat } from "ai/react";

export default function ChatComponent() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat`,
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        model: "gpt-4o", // Specify your preferred model
      },
    });

  return (
    <div className="chat-container">
      {/* Messages Display */}
      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <strong>{message.role}:</strong> {message.content}
          </div>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="chat-form">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
```

### 2. Chat with Existing Chat ID

```tsx
"use client";

import { useChat } from "ai/react";
import { useEffect, useState } from "react";

export default function ExistingChatComponent({ chatId }: { chatId: string }) {
  const [initialMessages, setInitialMessages] = useState([]);

  // Load existing messages
  useEffect(() => {
    async function loadMessages() {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat/${chatId}/messages`
      );
      const messages = await response.json();
      setInitialMessages(messages);
    }

    if (chatId) {
      loadMessages();
    }
  }, [chatId]);

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat/${chatId}`,
      initialMessages,
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        model: "gpt-4o",
      },
    });

  return <div className="chat-container">{/* Same UI as above */}</div>;
}
```

## 🧠 Agent System Integration

### 1. Universal Agent Execution

```tsx
"use client";

import { useState } from "react";
import { useChat } from "ai/react";

interface AgentExecutionProps {
  repositoryName: string;
}

export default function AgentExecution({
  repositoryName,
}: AgentExecutionProps) {
  const [selectedAgents, setSelectedAgents] = useState<string[]>([
    "documentation",
  ]);
  const [isExecuting, setIsExecuting] = useState(false);

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/agents/execute/streaming`,
    headers: {
      "Content-Type": "application/json",
    },
    body: {
      repository_name: repositoryName,
      agent_types: selectedAgents,
      enable_streaming: true,
    },
    onFinish: () => setIsExecuting(false),
    onError: (error) => {
      console.error("Agent execution error:", error);
      setIsExecuting(false);
    },
  });

  const handleAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExecuting(true);
    handleSubmit(e);
  };

  return (
    <div className="agent-execution">
      <h2>🤖 AI Agent Analysis</h2>

      {/* Agent Selection */}
      <div className="agent-selector">
        <h3>Select Agents:</h3>
        {[
          "simplifier",
          "tester",
          "convo_starter",
          "summarizer",
          "documentation",
        ].map((agent) => (
          <label key={agent}>
            <input
              type="checkbox"
              checked={selectedAgents.includes(agent)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedAgents([...selectedAgents, agent]);
                } else {
                  setSelectedAgents(selectedAgents.filter((a) => a !== agent));
                }
              }}
            />
            {agent.charAt(0).toUpperCase() + agent.slice(1)}
          </label>
        ))}
      </div>

      {/* Messages Display */}
      <div className="agent-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            {message.content}
          </div>
        ))}
      </div>

      {/* Query Input */}
      <form onSubmit={handleAgentSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="What would you like the agents to analyze?"
          disabled={isExecuting}
        />
        <button
          type="submit"
          disabled={isExecuting || selectedAgents.length === 0}
        >
          {isExecuting ? "Executing Agents..." : "Run Analysis"}
        </button>
      </form>
    </div>
  );
}
```

### 2. Single Agent Execution

```tsx
"use client";

import { useChat } from "ai/react";

interface SingleAgentProps {
  repositoryName: string;
  agentType:
    | "simplifier"
    | "tester"
    | "convo_starter"
    | "summarizer"
    | "documentation";
}

export default function SingleAgent({
  repositoryName,
  agentType,
}: SingleAgentProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/agents/execute/single`,
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        repository_name: repositoryName,
        agent_type: agentType,
        enable_streaming: true,
      },
    });

  return (
    <div className="single-agent">
      <h2>🎯 {agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent</h2>

      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            {message.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder={`Ask the ${agentType} agent...`}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Processing..." : "Ask Agent"}
        </button>
      </form>
    </div>
  );
}
```

## 🎯 Triage System Integration

```tsx
"use client";

import { useChat } from "ai/react";

interface TriageSystemProps {
  repositoryName: string;
}

export default function TriageSystem({ repositoryName }: TriageSystemProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/triage/execute/streaming`,
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        repository_name: repositoryName,
      },
    });

  return (
    <div className="triage-system">
      <h2>🧠 Intelligent Triage System</h2>
      <p>
        Ask any question and the triage agent will automatically select the best
        specialist agents to help you.
      </p>

      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            {message.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask anything about your codebase..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Analyzing..." : "Ask Triage"}
        </button>
      </form>
    </div>
  );
}
```

## 🛠️ Tool Calling Integration

The Woolly backend supports tool calling through the MCP system. Here's how to handle tool calls in your frontend:

```tsx
"use client";

import { useChat } from "ai/react";
import { ToolInvocation } from "ai";

export default function ToolCallingChat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat`,
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        model: "gpt-4o",
      },
    });

  return (
    <div className="tool-calling-chat">
      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            {/* Regular message content */}
            {message.content && (
              <div className="message-content">{message.content}</div>
            )}

            {/* Tool invocations */}
            {message.toolInvocations?.map((toolInvocation: ToolInvocation) => (
              <div key={toolInvocation.toolCallId} className="tool-invocation">
                <div className="tool-name">🔧 {toolInvocation.toolName}</div>
                <div className="tool-args">
                  <pre>{JSON.stringify(toolInvocation.args, null, 2)}</pre>
                </div>
                {toolInvocation.result && (
                  <div className="tool-result">
                    <strong>Result:</strong>
                    <pre>{JSON.stringify(toolInvocation.result, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about your codebase (tools will be used automatically)..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Processing..." : "Send"}
        </button>
      </form>
    </div>
  );
}
```

## 📱 Advanced UI Components

### 1. Chat Management Component

```tsx
"use client";

import { useState, useEffect } from "react";

interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export default function ChatManager() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chats`
      );
      const chatsData = await response.json();
      setChats(chatsData);
    } catch (error) {
      console.error("Failed to load chats:", error);
    }
  };

  const createNewChat = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat/create`,
        {
          method: "POST",
        }
      );
      const newChat = await response.json();
      setSelectedChatId(newChat.id);
      loadChats(); // Refresh the list
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat/${chatId}`, {
        method: "DELETE",
      });
      loadChats(); // Refresh the list
      if (selectedChatId === chatId) {
        setSelectedChatId(null);
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  return (
    <div className="chat-manager">
      <div className="chat-sidebar">
        <button onClick={createNewChat} className="new-chat-btn">
          + New Chat
        </button>

        <div className="chat-list">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-item ${
                selectedChatId === chat.id ? "active" : ""
              }`}
              onClick={() => setSelectedChatId(chat.id)}
            >
              <div className="chat-title">{chat.title || "Untitled Chat"}</div>
              <div className="chat-date">
                {new Date(chat.updated_at).toLocaleDateString()}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChat(chat.id);
                }}
                className="delete-btn"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-content">
        {selectedChatId ? (
          <ExistingChatComponent chatId={selectedChatId} />
        ) : (
          <div className="no-chat-selected">
            Select a chat or create a new one to get started
          </div>
        )}
      </div>
    </div>
  );
}
```

### 2. Repository Selector Component

```tsx
"use client";

import { useState, useEffect } from "react";

interface Repository {
  name: string;
  status: "indexed" | "indexing" | "error";
}

interface RepositorySelectorProps {
  onRepositorySelect: (repo: string) => void;
  selectedRepository?: string;
}

export default function RepositorySelector({
  onRepositorySelect,
  selectedRepository,
}: RepositorySelectorProps) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRepositories();
  }, []);

  const loadRepositories = async () => {
    try {
      // Note: This endpoint might need to be implemented in your backend
      // or you can use a static list of known repositories
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/repositories`
      );
      const repos = await response.json();
      setRepositories(repos);
    } catch (error) {
      console.error("Failed to load repositories:", error);
      // Fallback to known repositories
      setRepositories([
        { name: "woolly", status: "indexed" },
        { name: "your-repo-name", status: "indexed" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading repositories...</div>;
  }

  return (
    <div className="repository-selector">
      <h3>📁 Select Repository</h3>
      <select
        value={selectedRepository || ""}
        onChange={(e) => onRepositorySelect(e.target.value)}
        className="repo-select"
      >
        <option value="">Choose a repository...</option>
        {repositories.map((repo) => (
          <option
            key={repo.name}
            value={repo.name}
            disabled={repo.status !== "indexed"}
          >
            {repo.name} {repo.status === "indexing" ? "(Indexing...)" : ""}
            {repo.status === "error" ? "(Error)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
```

## 🎨 Styling Examples

### CSS for Chat Components

```css
/* Chat Container */
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
}

/* Messages */
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background-color: #f8f9fa;
}

.message {
  margin-bottom: 1rem;
  padding: 0.75rem;
  border-radius: 8px;
  max-width: 80%;
}

.message.user {
  background-color: #007bff;
  color: white;
  margin-left: auto;
  text-align: right;
}

.message.assistant {
  background-color: white;
  border: 1px solid #e1e5e9;
}

/* Tool Invocations */
.tool-invocation {
  background-color: #f1f3f4;
  border: 1px solid #dadce0;
  border-radius: 4px;
  padding: 0.5rem;
  margin: 0.5rem 0;
}

.tool-name {
  font-weight: bold;
  color: #1a73e8;
  margin-bottom: 0.25rem;
}

.tool-args,
.tool-result {
  font-family: monospace;
  font-size: 0.875rem;
  background-color: #f8f9fa;
  padding: 0.25rem;
  border-radius: 2px;
  margin: 0.25rem 0;
}

/* Chat Form */
.chat-form {
  display: flex;
  padding: 1rem;
  border-top: 1px solid #e1e5e9;
  background-color: white;
}

.chat-form input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #e1e5e9;
  border-radius: 4px;
  margin-right: 0.5rem;
}

.chat-form button {
  padding: 0.75rem 1.5rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.chat-form button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

/* Agent Components */
.agent-execution,
.single-agent,
.triage-system {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

.agent-selector {
  margin-bottom: 1rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.agent-selector label {
  display: block;
  margin-bottom: 0.5rem;
  cursor: pointer;
}

.agent-selector input[type="checkbox"] {
  margin-right: 0.5rem;
}

/* Chat Manager */
.chat-manager {
  display: flex;
  height: 100vh;
}

.chat-sidebar {
  width: 300px;
  background-color: #f8f9fa;
  border-right: 1px solid #e1e5e9;
  padding: 1rem;
}

.new-chat-btn {
  width: 100%;
  padding: 0.75rem;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 1rem;
}

.chat-list {
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

.chat-item {
  padding: 0.75rem;
  border: 1px solid #e1e5e9;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  position: relative;
}

.chat-item:hover {
  background-color: #e9ecef;
}

.chat-item.active {
  background-color: #007bff;
  color: white;
}

.chat-content {
  flex: 1;
  padding: 1rem;
}

.no-chat-selected {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6c757d;
  font-size: 1.125rem;
}
```

## 🔧 Error Handling

```tsx
"use client";

import { useChat } from "ai/react";
import { useState } from "react";

export default function ErrorHandlingChat() {
  const [error, setError] = useState<string | null>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat`,
      onError: (error) => {
        console.error("Chat error:", error);
        setError(
          error.message || "An error occurred while processing your request."
        );
      },
      onFinish: () => {
        setError(null); // Clear error on successful completion
      },
    });

  return (
    <div className="error-handling-chat">
      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Rest of your chat UI */}
    </div>
  );
}
```

## 🧪 Testing Your Integration

### 1. Test Basic Chat

```bash
# Test your frontend integration
npm run dev

# Open browser to http://localhost:3000
# Try sending a message to verify V5 streaming works
```

### 2. Test Agent Integration

```tsx
// Create a test component to verify agent streaming
export default function TestAgents() {
  return (
    <div>
      <h1>Test Agent Integration</h1>
      <AgentExecution repositoryName="woolly" />
    </div>
  );
}
```

### 3. Verify V5 Compatibility

Check your browser's Network tab to verify:

- ✅ Requests go to correct backend endpoints
- ✅ Responses use `text/plain` content type
- ✅ Streaming format uses V5 codes (`0:`, `9:`, `a:`, `e:`)
- ✅ Token usage includes `totalTokens`

## 📚 API Reference

### Backend Endpoints Used

| Endpoint                                | Purpose       | AI SDK Hook |
| --------------------------------------- | ------------- | ----------- |
| `POST /api/chat`                        | Legacy chat   | `useChat`   |
| `POST /api/chat/{chat_id}`              | Chat with ID  | `useChat`   |
| `POST /api/v1/agents/execute/streaming` | Multi-agent   | `useChat`   |
| `POST /api/v1/agents/execute/single`    | Single agent  | `useChat`   |
| `POST /api/v1/triage/execute/streaming` | Triage system | `useChat`   |
| `GET /api/chats`                        | List chats    | `fetch`     |
| `POST /api/chat/create`                 | Create chat   | `fetch`     |
| `DELETE /api/chat/{chat_id}`            | Delete chat   | `fetch`     |

### AI SDK Hooks Reference

Based on the [Vercel AI SDK documentation](https://vercel.com/docs/ai-sdk), the main hooks you'll use:

- **`useChat`**: For streaming chat interfaces
- **`useCompletion`**: For single completions
- **`useObject`**: For structured data generation
- **`useAssistant`**: For assistant-style interactions

## 🚀 Deployment

### Environment Variables for Production

```env
# Production backend URL
NEXT_PUBLIC_BACKEND_URL=https://your-woolly-backend.vercel.app

# Optional: Analytics and monitoring
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your-analytics-id
```

### Vercel Deployment

```bash
# Deploy to Vercel
npx vercel

# Or configure in vercel.json
{
  "env": {
    "NEXT_PUBLIC_BACKEND_URL": "https://your-woolly-backend.vercel.app"
  }
}
```

## 🔗 Additional Resources

- [AI SDK Documentation](https://vercel.com/docs/ai-sdk) - Official Vercel AI SDK docs
- [AI SDK Examples](https://github.com/vercel/ai/tree/main/examples) - Example implementations
- [Woolly Backend API Documentation](./api/BACKEND_API_README.md) - Backend API reference
- [Next.js Documentation](https://nextjs.org/docs) - Next.js framework docs

## 🎯 Best Practices

1. **Error Handling**: Always implement proper error handling for network requests
2. **Loading States**: Show loading indicators during streaming
3. **Accessibility**: Ensure chat interfaces are accessible with proper ARIA labels
4. **Performance**: Use React.memo() for message components to prevent unnecessary re-renders
5. **Security**: Validate and sanitize user inputs before sending to the backend
6. **Testing**: Write tests for your chat components and API integrations

---

This guide provides everything you need to integrate your frontend with the Woolly Backend API using the AI SDK V5. The backend is fully compatible and ready for production use! 🚀
