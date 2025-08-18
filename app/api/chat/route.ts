import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
	try {
		const { messages } = await req.json();

		// Get the last user message
		const lastMessage = messages[messages.length - 1];
		if (!lastMessage || lastMessage.role !== 'user') {
			return new Response('Invalid message format', { status: 400 });
		}

		// Create a simple streaming response that forwards from backend
		const encoder = new TextEncoder();

		const stream = new ReadableStream({
			async start(controller) {
				try {
					const response = await fetch(`${BACKEND_URL}/api/v1/agents/execute/streaming`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							agent_type: 'CONVERSATIONAL',
							repository_name: 'woolly', // Default repository
							user_query: lastMessage.content,
							context: {
								conversation_history: messages.slice(0, -1) // All messages except the last one
							}
						}),
					});

					if (!response.ok) {
						throw new Error(`Backend request failed: ${response.status}`);
					}

					const reader = response.body?.getReader();
					if (!reader) {
						throw new Error('No response body');
					}

					const decoder = new TextDecoder();
					let buffer = '';

					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						buffer = lines.pop() || '';

						for (const line of lines) {
							if (line.startsWith('data: ')) {
								const data = line.slice(6);
								if (data === '[DONE]') continue;

								try {
									const parsed = JSON.parse(data);
									if (parsed.content) {
										// Send the text content as streaming data
										controller.enqueue(encoder.encode(parsed.content));
									}
								} catch (e) {
									// Skip invalid JSON
								}
							}
						}
					}
				} catch (error) {
					console.error('Streaming error:', error);
					controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
				} finally {
					controller.close();
				}
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
			},
		});
	} catch (error) {
		console.error('Chat API error:', error);
		return new Response('Internal Server Error', { status: 500 });
	}
} 