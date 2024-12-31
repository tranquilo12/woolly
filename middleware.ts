import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
	const path = request.nextUrl.pathname

	// Define public paths that don't require authentication
	const isPublicPath = path === '/auth/signin' || path === '/auth/signup' || path === '/auth/verify'

	// Get the token from the NextAuth.js session token cookie
	// Check both possible cookie names (development and production)
	const token =
		request.cookies.get('next-auth.session-token')?.value ||
		request.cookies.get('__Secure-next-auth.session-token')?.value ||
		''

	// Add a small delay before redirecting to allow token to be set
	if (!token && !isPublicPath) {
		// Don't redirect API routes
		if (path.startsWith('/api/')) {
			return NextResponse.next()
		}
		return NextResponse.redirect(new URL('/auth/signin', request.url))
	}

	// Only redirect away from auth pages if we're certain we have a token
	if (token && isPublicPath && token.length > 0) {
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