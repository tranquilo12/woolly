import { Chat } from "@/components/chat";
import { checkAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

interface ChatPageProps {
	params: {
		id: string;
	};
}
export default async function ChatPage({ params }: ChatPageProps) {
	const session = await checkAuth();
	if (session instanceof NextResponse) return session;

	return <Chat chatId={params.id} userId={session.user.id as string} />;
}
