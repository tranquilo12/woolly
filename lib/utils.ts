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

interface CaretCoordinates {
  top: number;
  left: number;
  lineHeight: number;
}

export function getCaretCoordinates(element: HTMLTextAreaElement, position: number): CaretCoordinates {
  // Create a mirror div to measure text
  const div = document.createElement('div');
  const computed = window.getComputedStyle(element);

  // Copy the textarea's styles that affect text layout
  const properties = [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'letterSpacing',
    'lineHeight',
    'padding',
    'border',
    'boxSizing',
    'whiteSpace',
    'wordWrap',
    'overflowWrap'
  ];

  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.width = `${element.offsetWidth}px`;

  properties.forEach(prop => {
    div.style[prop as any] = computed[prop as any];
  });

  // Create content and measure
  const textContent = element.value.substring(0, position);
  const span = document.createElement('span');

  // Replace spaces with non-breaking spaces to preserve them
  div.textContent = textContent.replace(/ /g, '\u00a0');

  // Add a span at the caret position
  span.textContent = element.value.charAt(position) || '.';
  div.appendChild(span);

  document.body.appendChild(div);
  const rect = span.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  document.body.removeChild(div);

  return {
    top: rect.top - elementRect.top + element.scrollTop,
    left: rect.left - elementRect.left,
    lineHeight: parseInt(computed.lineHeight || '0')
  };
}
