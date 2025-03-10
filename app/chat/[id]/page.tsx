import { Chat } from "@/components/chat";

interface ChatPageProps {
	params: {
		id: string;
	};
}

export default async function ChatPage({ params }: ChatPageProps) {
	const parameters = await params
	return <Chat chatId={parameters.id} />;
} 
