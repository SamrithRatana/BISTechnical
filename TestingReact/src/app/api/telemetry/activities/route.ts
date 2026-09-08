import { NextRequest, NextResponse } from "next/server";
import {
  getProcessActivities,
  recordProcessActivity,
  type ServiceId,
} from "@/services/systemObservability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "60", 10);
  const activities = getProcessActivities(limit);

  return NextResponse.json({
    success: true,
    total: activities.length,
    activities,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.serviceId || !body.descriptionKm) {
      return NextResponse.json({ error: "serviceId and descriptionKm are required." }, { status: 400 });
    }

    const event = recordProcessActivity({
      serviceId: body.serviceId as ServiceId,
      type: body.type || "BACKGROUND",
      descriptionKm: body.descriptionKm,
      descriptionEn: body.descriptionEn || body.descriptionKm,
      durationMs: body.durationMs,
      statusCode: body.statusCode,
      user: body.user,
      userContext: body.userContext,
    });

    return NextResponse.json({ success: true, event });
  } catch {
    return NextResponse.json({ error: "Failed to record process activity." }, { status: 500 });
  }
}
