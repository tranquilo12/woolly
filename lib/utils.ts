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

    // Keep all tool invocations regardless of state
    return {
      ...message,
      toolInvocations: message.toolInvocations
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
  // Create a mirror div to measure text that exactly matches the textarea
  const div = document.createElement('div');
  const computed = window.getComputedStyle(element);

  // Copy ALL styles that could affect text layout and positioning
  const styles = computed.cssText;
  div.style.cssText = styles;

  // Critical positioning styles
  div.style.position = 'absolute';
  div.style.top = '0';
  div.style.left = '0';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.width = `${element.offsetWidth}px`; // Match textarea width exactly
  div.style.height = 'auto';

  // Create a span for the text before cursor
  const textBeforeCursor = element.value.substring(0, position);
  const textNode = document.createTextNode(textBeforeCursor);
  div.appendChild(textNode);

  // Create a span element that will represent the cursor position
  const span = document.createElement('span');
  span.textContent = element.value.charAt(position) || '.';
  div.appendChild(span);

  // Add the hidden div to the same container as the textarea
  element.parentNode?.appendChild(div);

  // Get the coordinates relative to the textarea
  const spanRect = span.getBoundingClientRect();
  const textareaRect = element.getBoundingClientRect();

  // Calculate the exact position considering scroll
  const coordinates = {
    top: spanRect.top - (textareaRect.top * 0.86) + element.scrollTop,
    left: spanRect.left - textareaRect.left + element.scrollLeft,
    lineHeight: parseInt(computed.lineHeight || '0')
  };

  // Clean up
  element.parentNode?.removeChild(div);

  return coordinates;
}
