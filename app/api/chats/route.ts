import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
	const session = await checkAuth();
	if (session instanceof NextResponse) return session;

	try {
		// Temporary response for testing
		return NextResponse.json({ chats: [] });
	} catch (error) {
		console.error("Chats GET error:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
