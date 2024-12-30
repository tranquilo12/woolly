import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export async function GET(
	req: NextRequest,
	{ params }: { params: { chatId: string } }
) {
	const session = await checkAuth();
	if (session instanceof NextResponse) return session;

	try {
		const { searchParams } = new URL(req.url);
		const userId = searchParams.get("userId");

		// Verify the user has access to these messages
		if (userId !== session.user?.id) {
			return new NextResponse("Unauthorized", { status: 403 });
		}

		// Your existing GET messages logic here

		return NextResponse.json({ /* your response */ });
	} catch (error) {
		console.error("Messages GET error:", error);
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

		// Verify the user has access to save messages
		if (body.userId !== session.user?.id) {
			return new NextResponse("Unauthorized", { status: 403 });
		}

		// Your existing POST message logic here

		return NextResponse.json({ /* your response */ });
	} catch (error) {
		console.error("Messages POST error:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
} 