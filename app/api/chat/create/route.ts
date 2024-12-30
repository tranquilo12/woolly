import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { Message } from "ai";

// Match the Pydantic model from the Python backend
interface ChatCreateRequest {
	userId: string;
	messages: Message[];
}

export async function POST(req: NextRequest) {
	const session = await checkAuth();
	if (session instanceof NextResponse) return session;

	try {
		const body = await req.json();

		// Debug the token format
		console.log('Original token:', session.accessToken);

		// Ensure clean token without any Bearer prefix
		const accessToken = session.accessToken?.replace(/^Bearer\s+/i, '') || '';

		const headers = new Headers({
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${accessToken}`,
		});

		console.log('Final Authorization header:', headers.get('Authorization'));

		const pythonRequestBody: ChatCreateRequest = {
			userId: session.user.id as string,
			messages: body.messages || []
		};

		// Use 127.0.0.1 instead of localhost based on search results
		const baseUrl = process.env.NODE_ENV === "development"
			? "http://127.0.0.1:3001"
			: process.env.NEXT_PUBLIC_API_URL;

		const response = await fetch(
			`${baseUrl}/api/chat/create`,
			{
				method: 'POST',
				headers,
				body: JSON.stringify(pythonRequestBody)
			}
		);

		if (!response.ok) {
			const error = await response.text();
			console.error('Python API Error:', error);
			return new NextResponse(error, { status: response.status });
		}

		const data = await response.json();
		return NextResponse.json(data);
	} catch (error) {
		console.error("Chat creation error:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
} 