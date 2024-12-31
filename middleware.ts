import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
	const path = request.nextUrl.pathname

	// Define public paths that don't require authentication
	const isPublicPath = path === '/auth/signin' || path === '/auth/signup' || path === '/auth/verify'

	// Get the token from NextAuth.js
	const token = await getToken({
		req: request,
		secret: process.env.NEXTAUTH_SECRET
	})

	// Add a small delay before redirecting to allow token to be set
	if (!token && !isPublicPath) {
		// Don't redirect API routes
		if (path.startsWith('/api/')) {
			return NextResponse.next()
		}
		return NextResponse.redirect(new URL('/auth/signin', request.url))
	}

	// Redirect authenticated users away from auth pages
	if (token && isPublicPath) {
		return NextResponse.redirect(new URL('/chat', request.url))
	}

	return NextResponse.next()
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public files (public/*)
		 */
		'/((?!api|_next/static|_next/image|favicon.ico|public/).*)',
	],
}