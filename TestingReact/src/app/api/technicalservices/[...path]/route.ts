import { NextRequest, NextResponse } from "next/server";
import { recordRequest } from "@/services/activityTracker";

const TECHNICAL_API_BASE =
  process.env.NEXT_PUBLIC_TECHNICAL_API_URL || "http://localhost:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Read-only, so it never blocks a deploy — but it still means someone is
    // using the system, which the SSE session count alone would miss.
    recordRequest();

    const { path } = await params;
    const subPath = path ? path.join("/") : "";
    const search = req.nextUrl.search;

    const targetUrl = `${TECHNICAL_API_BASE}/api/technicalservices/${subPath}${search}`;

    const authHeader = req.headers.get("authorization");
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (authHeader) headers["Authorization"] = authHeader;

    const res = await fetch(targetUrl, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend API returned status ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("TechnicalServices Proxy GET Error:", error);
    return NextResponse.json(
      { error: "Failed to connect to Technical Services API" },
      { status: 500 }
    );
  }
}
