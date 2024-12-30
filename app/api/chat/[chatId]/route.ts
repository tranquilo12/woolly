import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export async function GET(
	req: NextRequest,
	{ params }: { params: { chatId: string } }
) {
	const session = await checkAuth();
	if (session instanceof NextResponse) return session;

	try {
		// Preserve and forward headers
		const headers = new Headers({
			'Authorization': `Bearer ${session.accessToken}`,
			'Accept': req.headers.get('accept') || 'application/json'
		});

		// Forward any additional custom headers
		req.headers.forEach((value, key) => {
			if (!headers.has(key) && !['host', 'connection'].includes(key.toLowerCase())) {
				headers.set(key, value);
			}
		});

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'}/api/chat/${params.chatId}`,
			{
				headers
			}
		);

		if (!response.ok) {
			return new NextResponse(await response.text(), { status: response.status });
		}

		return NextResponse.json(await response.json());
	} catch (error) {
		console.error("Chat GET error:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}

export async function POST(
	req: NextRequest,
	{ params }: { params: { chatId: string } }
) {
	const session = await checkAuth();
	if (session instanceof NextResponse) return session;

	try {
		const body = await req.json();

		// Verify the user has access to this chat
		if (body.userId !== session.user?.id) {
			return new NextResponse("Unauthorized", { status: 403 });
		}

		// Your existing POST logic here

		return NextResponse.json({ /* your response */ });
	} catch (error) {
		console.error("Chat POST error:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
} 