import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_TELEGRAM_CONFIG } from "@/services/telegramService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const photo = formData.get("photo");
    const caption = (formData.get("caption") as string) || "";
    const topicKey = formData.get("topicKey") as string;
    const threadId = formData.get("threadId") as string;
    const customConfigRaw = formData.get("config") as string;

    let customConfig: any = undefined;
    if (customConfigRaw) {
      try {
        customConfig = JSON.parse(customConfigRaw);
      } catch {}
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN || customConfig?.botToken || DEFAULT_TELEGRAM_CONFIG.botToken;
    const chatId = process.env.TELEGRAM_CHAT_ID || customConfig?.chatId || DEFAULT_TELEGRAM_CONFIG.chatId;

    if (!botToken || !chatId) {
      return NextResponse.json(
        { success: false, error: "Missing botToken or chatId" },
        { status: 400 }
      );
    }

    if (!photo) {
      return NextResponse.json(
        { success: false, error: "Missing photo file or blob" },
        { status: 400 }
      );
    }

    // Resolve Topic Thread ID
    let messageThreadId = threadId;
    if (!messageThreadId && topicKey) {
      const envKey = `TELEGRAM_TOPIC_${String(topicKey).replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}`;
      const envThreadId = process.env[envKey];
      if (envThreadId) {
        messageThreadId = envThreadId;
      } else {
        const topicMap = customConfig?.topics || DEFAULT_TELEGRAM_CONFIG.topics;
        messageThreadId =
          topicMap[topicKey] ??
          Object.entries(topicMap).find(
            ([k]) => k.toLowerCase() === String(topicKey).toLowerCase()
          )?.[1];
      }
    }

    const tgFormData = new FormData();
    tgFormData.append("chat_id", chatId);
    if (messageThreadId) {
      tgFormData.append("message_thread_id", String(messageThreadId));
    }
    if (caption) {
      tgFormData.append("caption", caption);
      tgFormData.append("parse_mode", "HTML");
    }

    // Handle photo input (File/Blob or base64 data string)
    if (typeof photo === "string" && photo.startsWith("data:")) {
      const [header, base64Data] = photo.split(",");
      const mimeMatch = header.match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      const buffer = Buffer.from(base64Data, "base64");
      const fileBlob = new Blob([buffer], { type: mimeType });
      tgFormData.append("photo", fileBlob, "report.png");
    } else if (photo instanceof Blob) {
      tgFormData.append("photo", photo, (photo as File).name || "report.png");
    } else {
      tgFormData.append("photo", photo as any);
    }

    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      body: tgFormData,
    });

    const result = await telegramRes.json();

    if (result.ok) {
      return NextResponse.json({
        success: true,
        messageId: result.result?.message_id,
        result: result.result,
      });
    }

    console.error("[Telegram SendPhoto Error]:", result);
    return NextResponse.json({
      success: false,
      error: result.description || "Telegram API error",
      errorCode: result.error_code,
    });
  } catch (err: unknown) {
    console.error("[Telegram SendPhoto Server Error]:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to send photo to Telegram" },
      { status: 500 }
    );
  }
}
