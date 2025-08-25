// Improved Proxy to Woolly Backend - AI SDK v5 Compatible
const WOOLLY_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// UUID validation function
function isValidUUID(str: string): boolean {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(str);
}

export const maxDuration = 60;

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { id, message } = body;

		// Transform frontend request to Woolly backend format
		const woollyRequest = {
			messages: [
				{
					role: message.role,
					content: message.parts.find(part => part.type === 'text')?.text || '',
					id: message.id,
				}
			],
			model: 'gpt-4o',
		};

		// Use provided ID or generate new UUID (backend will auto-create chat if needed)
		const chatId = id || crypto.randomUUID();

		// Proxy to Woolly backend
		const response = await fetch(`${WOOLLY_BACKEND_URL}/api/chat/${chatId}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'text/plain; charset=utf-8', // Match backend's media_type
			},
			body: JSON.stringify(woollyRequest),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Backend error (${response.status}):`, errorText);

			// Handle specific error cases
			if (response.status === 404) {
				throw new Error('Chat not found and could not be created');
			} else if (response.status === 422) {
				throw new Error('Invalid request format');
			} else {
				throw new Error(`Backend error: ${response.status} - ${errorText}`);
			}
		}

		// Return the streaming response with AI SDK v5 compatible headers
		return new Response(response.body, {
			headers: {
				'Content-Type': 'text/plain; charset=utf-8', // Match backend
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
				'Transfer-Encoding': 'chunked',
			},
		});

	} catch (error) {
		console.error('Error proxying to Woolly backend:', error);
		return new Response(
			JSON.stringify({ error: 'Failed to connect to backend' }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}

export async function DELETE(request: Request) {
	const { searchParams } = new URL(request.url);
	const id = searchParams.get('id');

	if (!id) {
		return new Response(
			JSON.stringify({ error: 'Chat ID is required' }),
			{ status: 400, headers: { 'Content-Type': 'application/json' } }
		);
	}

	try {
		// Proxy to Woolly backend
		const response = await fetch(`${WOOLLY_BACKEND_URL}/api/chat/${id}`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Delete error (${response.status}):`, errorText);
			throw new Error(`Backend responded with ${response.status}: ${errorText}`);
		}

		const result = await response.json();
		return Response.json(result, { status: 200 });

	} catch (error) {
		console.error('Error deleting chat:', error);
		return new Response(
			JSON.stringify({ error: 'Failed to delete chat' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
}
