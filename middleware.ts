import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
	const path = request.nextUrl.pathname

	// Define public paths that don't require authentication
	const isPublicPath = path === '/auth/signin' || path === '/auth/signup' || path === '/auth/verify'

	// Get the token from the NextAuth.js session token cookie
	const token = request.cookies.get('next-auth.session-token')?.value || ''

	// Redirect unauthenticated users to login if they're trying to access a protected route
	if (!token && !isPublicPath) {
		return NextResponse.redirect(new URL('/auth/signin', request.url))
	}

	// Redirect authenticated users away from auth pages
	if (token && isPublicPath) {
		return NextResponse.redirect(new URL('/', request.url))
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