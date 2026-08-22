import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * @file api/image-proxy/route.ts
 * @description Safe server-side proxy to fetch remote images with CORS headers
 * allowing client-side HTML5 Canvas pixel analysis without tainted canvas security errors.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new NextResponse("Missing url param", { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!res.ok) {
      return new NextResponse(`Failed to fetch image: ${res.statusText}`, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "image/png";
    const arrayBuffer = await res.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (err: any) {
    return new NextResponse(`Proxy error: ${err?.message || "Unknown"}`, { status: 500 });
  }
}
