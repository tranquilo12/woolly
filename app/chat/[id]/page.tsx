import { Chat } from "@/components/chat";
import { ChatLayout } from "@/components/chat-layout";

interface ChatPageProps {
	params: {
		id: string;
	};
}

export default async function ChatPage({ params }: { params: { id: string } }) {
	const parameters = await params
	return (
		<ChatLayout chatId={parameters.id}>
			<Chat chatId={parameters.id} />
		</ChatLayout>
	);
}