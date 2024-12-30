import { Chat } from "@/components/chat";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';

interface ChatPageProps {
	params: {
		id: string;
	};
}

export default async function ChatPage({ params }: ChatPageProps) {
	const session = await getServerSession(authOptions);

	if (!session) {
		redirect('/auth/signin');
	}

	return (
		<div className="mx-auto max-w-4xl w-full px-4">
			<Chat chatId={params.id} userId={session.user?.id as string} />
		</div>
	);
} 