import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { Sidebar } from '@/components/sidebar';
import { SidebarProvider } from '@/components/sidebar-provider';

export default async function ChatLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await getServerSession(authOptions);

	// If there's no session, redirect to signin page
	if (!session?.user) {
		redirect('/auth/signin');
	}

	return (
		<div className="flex flex-col min-h-screen">
			<SidebarProvider>
				{/* Main chat container */}
				<main className="flex-1 overflow-hidden relative">
					<div className="h-full flex">
						{/* Sidebar */}
						<Sidebar />
						{/* Chat content */}
						<div className="flex-1 overflow-y-auto">
							{children}
						</div>
					</div>
				</main>
			</SidebarProvider>
		</div>
	);
} 