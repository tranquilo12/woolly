import { Message } from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ToolResult } from "@/types/tool-result";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizeUIMessages(messages: Array<Message>): Array<Message> {
  const messagesBySanitizedToolInvocations = messages.map((message) => {
    if (message.role !== "assistant") return message;

    if (!message.toolInvocations) return message;

    const toolResultIds: Array<string> = [];

    for (const toolInvocation of message.toolInvocations) {
      if (toolInvocation.state === "result") {
        toolResultIds.push(toolInvocation.toolCallId);
      }
    }

    const sanitizedToolInvocations = message.toolInvocations.filter(
      (toolInvocation) =>
        toolInvocation.state === "result" ||
        toolResultIds.includes(toolInvocation.toolCallId),
    );

    return {
      ...message,
      toolInvocations: sanitizedToolInvocations,
    };
  });

  return messagesBySanitizedToolInvocations.filter(
    (message) =>
      message.content.length > 0 ||
      (message.toolInvocations && message.toolInvocations.length > 0),
  );
}

export function formatMetric(value: number, type: 'memory' | 'cpu' | 'time'): string {
  switch (type) {
    case 'memory':
      return `${value.toFixed(2)} MB`;
    case 'cpu':
      return `${value.toFixed(1)}%`;
    case 'time':
      return `${(value * 1000).toFixed(2)}ms`;
    default:
      return value.toString();
  }
}

export function parseToolResult(result: any): ToolResult {
  try {
    if (typeof result === 'string') {
      result = JSON.parse(result);
    }
    return result as ToolResult;
  } catch (e) {
    return {
      success: false,
      output: String(result),
      error: 'Failed to parse result',
      metrics: {
        memory_usage: 0,
        cpu_percent: 0,
        execution_time: 0
      }
    };
  }
}
