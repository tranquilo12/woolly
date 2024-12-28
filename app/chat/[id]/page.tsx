import { Chat } from "@/components/chat";
import { notFound } from "next/navigation";

interface ChatPageProps {
	params: {
		id: string;
	};
}

export default function ChatPage({ params }: ChatPageProps) {
	// // Basic validation of the ID format
	// if (!params.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
	// 	notFound();
	// }

	return <Chat chatId={params.id} />;
} 
