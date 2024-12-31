import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
	const session = await checkAuth();
	console.log('Auth check result:', session);

	if (session instanceof NextResponse) {
		console.log('Auth failed:', session.status);
		return session;
	}

	try {
		const body = {
			userId: session.user.id,
			messages: []
		};

		const headers = new Headers({
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${session.accessToken}`,
		});

		const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
		const response = await fetch(`${baseUrl}/api/chat/create`, {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
		});

		console.log('Python API response status:', response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Python API Error:', errorText);
			return new NextResponse(errorText, { status: response.status });
		}

		const data = await response.json();
		console.log('Success response:', data);
		return NextResponse.json(data);
	} catch (error) {
		console.error("Chat creation error:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
} 