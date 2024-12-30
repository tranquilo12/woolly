import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function checkAuth() {
	const session = await getServerSession(authOptions);

	if (!session) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	return session;
} 