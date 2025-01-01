'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export default function SignIn() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [error, setError] = useState<string | null>(null);
	const { data: session, status } = useSession();

	useEffect(() => {
		const redirectAfterAuth = async () => {
			if (status === 'authenticated' && session) {
				try {
					// First try to get user's chats
					const response = await fetch('/api/chats', {
						headers: {
							'Content-Type': 'application/json',
							'Accept': 'application/json'
						}
					});
					const data = await response.json();

					if (data.chats && data.chats.length > 0) {
						// Redirect to most recent chat
						const latestChat = data.chats[0]; // assuming chats are sorted by date
						router.push(`/chat/${latestChat.id}`);
					} else {
						// No existing chats, redirect to create new chat
						router.push('/');
					}
				} catch (error) {
					console.error('Error fetching chats:', error);
					// On error, default to creating new chat
					router.push('/');
				}
			}
		};

		redirectAfterAuth();
	}, [searchParams, session, status, router]);

	const handleSignIn = async () => {
		try {
			const result = await signIn('azure-ad', {
				callbackUrl: '/',
				redirect: false,
			});

			if (result?.error) {
				setError('Failed to sign in. Please try again.');
			}
		} catch (error) {
			console.error('Sign in error:', error);
			setError('Failed to sign in. Please try again.');
		}
	};

	// If still loading, show nothing or a loading state
	if (status === 'loading') {
		return <div>Loading...</div>;
	}

	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="w-full max-w-md space-y-8 p-8 rounded-lg dark:bg-zinc-900 bg-white/80 backdrop-blur-sm border dark:border-zinc-800 border-zinc-200">
				<div className="text-center">
					<h2 className="mt-6 text-3xl font-bold dark:text-zinc-100 text-zinc-900">Sign in</h2>
					{error && (
						<p className="mt-2 text-sm text-red-600">{error}</p>
					)}
				</div>
				<button
					onClick={handleSignIn}
					className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
				>
					Sign in with Azure AD
				</button>
			</div>
		</div>
	);
}