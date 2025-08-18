import { openai } from '@ai-sdk/openai';
import { streamText, convertToModelMessages, type UIMessage } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
	try {
		const { messages }: { messages: UIMessage[] } = await req.json();

		// Convert UI messages to model messages
		const modelMessages = convertToModelMessages(messages);

		// Stream text using AI SDK v5
		const result = streamText({
			model: openai('gpt-4o'),
			messages: modelMessages,
			maxOutputTokens: 4000,
			temperature: 0.7,
		});

		// Return the UI message stream response (v5 format)
		return result.toUIMessageStreamResponse();
	} catch (error) {
		console.error('Chat API error:', error);
		return new Response('Internal Server Error', { status: 500 });
	}
}