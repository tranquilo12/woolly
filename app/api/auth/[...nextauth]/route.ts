import NextAuth from "next-auth";
import { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

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
	callbacks: {
		async signIn({ user, account }) {
			if (!account || !user) return false;

			try {
				// Create or update user in our database
				const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/sync`, {
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
						expires_at: account.expires_at
					}),
				});

				if (!response.ok) {
					console.error('Failed to sync user:', await response.text());
					return false;
				}

				return true;
			} catch (error) {
				console.error('Error syncing user:', error);
				return false;
			}
		},
		async jwt({ token, account }) {
			if (account) {
				token.accessToken = account.access_token;
				token.azureId = account.providerAccountId;
			}
			return token;
		},
		async session({ session, token }) {
			if (session.user) {
				session.user.id = token.sub;
				session.accessToken = token.accessToken as string;
				session.azureId = token.azureId as string;
			}
			return session;
		}
	},
	debug: process.env.NODE_ENV === 'development',
	session: {
		strategy: "jwt",
		maxAge: 30 * 24 * 60 * 60, // 30 days
	},
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };