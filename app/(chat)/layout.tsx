import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export default async function ChatLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await getServerSession(authOptions);

	// If there's no session, redirect to signin page
	if (!session) {
		redirect('/auth/signin');
	}

	return (
		<div className="flex flex-col min-h-screen">
			{/* Main chat container */}
			<main className="flex-1 overflow-hidden relative">
				<div className="h-full flex flex-col">
					{/* Chat content */}
					<div className="flex-1 overflow-y-auto">
						{children}
					</div>
				</div>
			</main>
		</div>
	);
} 