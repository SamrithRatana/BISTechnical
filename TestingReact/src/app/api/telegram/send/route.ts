import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_TELEGRAM_CONFIG } from "@/services/telegramService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topicKey, text, threadId, config } = body;

    const botToken = process.env.TELEGRAM_BOT_TOKEN || config?.botToken || DEFAULT_TELEGRAM_CONFIG.botToken;
    const chatId = process.env.TELEGRAM_CHAT_ID || config?.chatId || DEFAULT_TELEGRAM_CONFIG.chatId;

    if (!botToken || !chatId) {
      return NextResponse.json(
        { success: false, error: "Missing botToken or chatId" },
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
        const topicMap = config?.topics || DEFAULT_TELEGRAM_CONFIG.topics;
        messageThreadId =
          topicMap[topicKey] ??
          Object.entries(topicMap).find(
            ([k]) => k.toLowerCase() === String(topicKey).toLowerCase()
          )?.[1];
      }
    }

    const messageText = text || body.messageHtml || body.message || "🔔 Test Notification from Next.js";

    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text: messageText,
      parse_mode: "HTML",
    };

    if (messageThreadId) {
      payload.message_thread_id = Number(messageThreadId);
    }

    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await telegramRes.json();

    if (result.ok) {
      return NextResponse.json({
        success: true,
        messageId: result.result?.message_id,
        result: result.result,
      });
    }

    return NextResponse.json({
      success: false,
      error: result.description || "Telegram API error",
      errorCode: result.error_code,
    });
  } catch (err: unknown) {
    console.error("[Telegram Send Error]:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to send to Telegram" },
      { status: 500 }
    );
  }
}
