import { NextResponse } from "next/server";

export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/storage/:path*", "/admin-panel/:path*", "/api/admin/:path*"],
};
