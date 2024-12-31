'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SignIn() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const error = searchParams?.get('error');
		if (error) {
			setError(
				error === 'AccessDenied'
					? 'Access denied. Please try again.'
					: 'An error occurred. Please try again.'
			);
		}
	}, [searchParams]);

	const handleSignIn = async () => {
		try {
			await signIn('azure-ad', {
				callbackUrl: '/chat',
				redirect: true,
			});
		} catch (error) {
			console.error('Sign in error:', error);
			setError('Failed to sign in. Please try again.');
		}
	};

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