import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
	const session = await checkAuth();
	if (session instanceof NextResponse) return session;

	try {
		const headers = new Headers({
			'Authorization': `Bearer ${session.accessToken}`,
			'Accept': 'application/json'
		});

		const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
		const response = await fetch(`${baseUrl}/api/chats?userId=${session.user.id}`, {
			headers
		});

		if (!response.ok) {
			throw new Error('Failed to fetch chats');
		}

		const data = await response.json();
		return NextResponse.json(data);
	} catch (error) {
		console.error("Chats GET error:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
