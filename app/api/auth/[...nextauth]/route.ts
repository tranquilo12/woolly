import NextAuth from "next-auth";
import { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

const apiUrl = process.env.NODE_ENV === 'development'
	? 'http://127.0.0.1:3001'
	: process.env.NEXT_PUBLIC_API_URL;

export const authOptions: NextAuthOptions = {
	providers: [
		AzureADProvider({
			clientId: process.env.AZURE_AD_CLIENT_ID!,
			clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
			tenantId: process.env.AZURE_AD_TENANT_ID!,
			authorization: {
				params: {
					scope: "openid profile email offline_access",
					response_type: "code",
					response_mode: "query"
				}
			},
			httpOptions: {
				timeout: 10000
			}
		}),
	],
	pages: {
		signIn: '/auth/signin',
		signOut: '/auth/signin',
		error: '/auth/error',
	},
	session: {
		strategy: "jwt",
		maxAge: 30 * 24 * 60 * 60, // 30 days
	},
	callbacks: {
		async signIn({ user, account }) {
			if (!account || !user) return false;

			try {
				const expiresAt = account.expires_at
					? new Date(account.expires_at * 1000)
					: new Date();

				const response = await fetch(`${apiUrl}/api/users/sync`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						azure_id: user.id,
						email: user.email,
						name: user.name,
						access_token: account.access_token,
						refresh_token: account.refresh_token,
						expires_at: expiresAt
					}),
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error('Failed to sync user:', errorText);
					return false;
				}

				return true;
			} catch (error) {
				console.error('Error syncing user:', error);
				return false;
			}
		},
		async jwt({ token, account, trigger }) {
			if (account) {
				// Initial sign in
				return {
					...token,
					accessToken: account.access_token,
					refreshToken: account.refresh_token,
					expiresAt: account.expires_at,
					azureId: account.providerAccountId,
				};
			} else if (
				token.expiresAt &&
				Date.now() >= (token.expiresAt as number) * 1000 - 60000
			) {
				// Token is about to expire (within 1 minute), should implement refresh here
				// For now, we'll just return the existing token
				console.log("Token needs refresh - implementing soon");
			}
			return token;
		},
		async session({ session, token }) {
			return {
				...session,
				accessToken: token.accessToken,
				azureId: token.azureId,
				user: {
					...session.user,
					id: token.sub,
				},
				error: null
			};
		}
	},
	debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };