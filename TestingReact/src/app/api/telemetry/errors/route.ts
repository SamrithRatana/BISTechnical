import { NextRequest, NextResponse } from "next/server";
import {
  getSystemErrors,
  captureSystemError,
  clearSystemErrors,
  type ServiceId,
  type ErrorSeverity,
} from "@/services/systemObservability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serviceId = (searchParams.get("service") as ServiceId | "all") || "all";
  const severity = (searchParams.get("severity") as ErrorSeverity | "all") || "all";
  const search = searchParams.get("q") || "";
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  const errors = getSystemErrors({ serviceId, severity, search, limit });

  return NextResponse.json({
    success: true,
    total: errors.length,
    errors,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.serviceId || !body.message) {
      return NextResponse.json({ error: "serviceId and message are required." }, { status: 400 });
    }

    const entry = captureSystemError({
      serviceId: body.serviceId,
      message: body.message,
      statusCode: body.statusCode,
      severity: body.severity,
      endpoint: body.endpoint,
      method: body.method,
      stackTrace: body.stackTrace,
      payloadSnippet: body.payloadSnippet,
      userContext: body.userContext,
    });

    return NextResponse.json({ success: true, entry });
  } catch (ex) {
    return NextResponse.json({ error: "Failed to record error log." }, { status: 500 });
  }
}

export async function DELETE() {
  clearSystemErrors();
  return NextResponse.json({ success: true, message: "Error logs cleared." });
}
