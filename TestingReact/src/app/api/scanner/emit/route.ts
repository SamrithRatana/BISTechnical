import { NextRequest, NextResponse } from "next/server";
import {
  emitToSession,
  getActiveSession,
  setSessionDevice,
} from "@/lib/scannerBridge";
import { parseDeviceInfo } from "@/lib/loginSessionTracker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, type, barcode, format } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // Check if session is actively running on PC
    const session = getActiveSession(sessionId);

    // If PC logged out or session terminated, reject phone join and scan attempts!
    if (!session && type !== "terminate" && type !== "disconnect") {
      return NextResponse.json(
        {
          error: "SESSION_EXPIRED",
          message: "This scan session has expired or was terminated. Please scan a new QR code on your PC.",
        },
        { status: 410 }
      );
    }

    const phoneUserName = typeof body.userName === "string" ? body.userName.trim() : "";
    const phoneUserId = typeof body.userId === "string" ? body.userId.trim() : "";

    // ── STRICT ACCOUNT MISMATCH GUARD ──
    if (session && session.ownerUserName && phoneUserName) {
      if (session.ownerUserName.trim().toLowerCase() !== phoneUserName.toLowerCase()) {
        console.warn(`[ScannerEmit] Account mismatch rejected: Phone=${phoneUserName}, PC=${session.ownerUserName}`);
        return NextResponse.json(
          {
            error: "ACCOUNT_MISMATCH",
            mismatch: true,
            phoneUser: phoneUserName,
            pcUser: session.ownerUserName,
            message: `Account mismatch: Phone is logged in as '${phoneUserName}', but Web PC workspace belongs to '${session.ownerUserName}'.`,
          },
          { status: 403 }
        );
      }
    }

    if (type === "join") {
      const userAgent = req.headers.get("user-agent") || "";
      const forwardedFor = req.headers.get("x-forwarded-for") || "";
      const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";

      const { deviceDisplay } = parseDeviceInfo(userAgent);
      const deviceName = deviceDisplay || "Mobile Smartphone";

      setSessionDevice(sessionId, {
        name: deviceName,
        userAgent,
        ip,
        joinedAt: Date.now(),
        scanCount: 0,
        lastActiveAt: Date.now(),
      });

      emitToSession(sessionId, {
        type: "phone-joined",
        sessionId,
      });
      return NextResponse.json({
        success: true,
        status: "phone-joined",
        device: deviceName,
        pcUser: session?.ownerUserName,
      });
    }

    if (type === "scan") {
      const cleanBarcode = String(barcode || "").trim();
      if (!cleanBarcode) {
        return NextResponse.json({ error: "Empty barcode" }, { status: 400 });
      }

      const success = emitToSession(sessionId, {
        type: "barcode-scanned",
        sessionId,
        barcode: cleanBarcode,
        format: format || "CODE_128",
      });

      if (!success) {
        return NextResponse.json(
          {
            error: "SESSION_EXPIRED",
            message: "PC disconnected. Please scan a new QR code.",
          },
          { status: 410 }
        );
      }

      return NextResponse.json({ success: true, barcode: cleanBarcode });
    }

    if (type === "disconnect") {
      emitToSession(sessionId, {
        type: "disconnect",
        sessionId,
      });
      return NextResponse.json({ success: true, status: "disconnected" });
    }

    if (type === "terminate") {
      emitToSession(sessionId, {
        type: "terminate",
        sessionId,
      });
      return NextResponse.json({ success: true, status: "terminated" });
    }

    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  } catch (err: unknown) {
    console.error("Scanner emit error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
