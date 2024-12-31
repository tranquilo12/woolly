import NextAuth from "next-auth";
import { NextAuthOptions } from "next-auth";
import { JWT } from "next-auth/jwt";
import AzureADProvider from "next-auth/providers/azure-ad";

interface ExtendedJWT extends JWT {
	accessToken?: string;
	expiresAt?: number;
}

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
					scope: "openid profile email",
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
		error: '/auth/signin',
	},
	session: {
		strategy: 'jwt',
		maxAge: 12 * 60 * 60, // 12 hours
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
		async jwt({ token, account }) {
			if (account) {
				// Minimal token data
				return {
					sub: token.sub,
					accessToken: account.access_token,
					expiresAt: account.expires_at,
				};
			}
			return token;
		},
		async session({ session, token }) {
			// Minimal session data
			return {
				expires: session.expires,
				accessToken: (token as ExtendedJWT).accessToken,
				user: {
					id: token.sub,
					email: session.user?.email,
				}
			};
		},
		async redirect({ url, baseUrl }) {
			// Allows relative callback URLs
			if (url.startsWith("/")) return `${baseUrl}${url}`
			// Allows callback URLs on the same origin
			else if (new URL(url).origin === baseUrl) return url
			return baseUrl
		}
	},
	debug: false, // Disable debug messages
	cookies: {
		sessionToken: {
			name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
			options: {
				httpOnly: true,
				sameSite: 'lax',
				path: '/',
				secure: process.env.NODE_ENV === 'production',
			}
		}
	}
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };