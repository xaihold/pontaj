import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const response = NextResponse.next();

    // Allow embedding from ANY origin — this app is an internal GHL tool,
    // could be on any white-label domain (crm.youragency.com, app.gohighlevel.com, etc.)
    // Security comes from URL auth params (user_id), not from CSP framing restrictions.
    response.headers.set('Content-Security-Policy', "frame-ancestors *");

    // Remove X-Frame-Options entirely — it conflicts with CSP frame-ancestors
    response.headers.delete('X-Frame-Options');

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
