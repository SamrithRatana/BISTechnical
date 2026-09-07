import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_TELEGRAM_CONFIG } from "@/services/telegramService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messageId, config } = body;

    const botToken = process.env.TELEGRAM_BOT_TOKEN || config?.botToken || DEFAULT_TELEGRAM_CONFIG.botToken;
    const chatId = process.env.TELEGRAM_CHAT_ID || config?.chatId || DEFAULT_TELEGRAM_CONFIG.chatId;

    if (!botToken || !chatId || !messageId) {
      return NextResponse.json(
        { success: false, error: "Missing botToken, chatId, or messageId" },
        { status: 400 }
      );
    }

    const payload = {
      chat_id: chatId,
      message_id: Number(messageId),
    };

    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await telegramRes.json();

    if (result.ok) {
      return NextResponse.json({ success: true, result: result.result });
    }

    // If message is already deleted or not found, consider it handled
    const desc = result.description || "";
    if (desc.includes("message to delete not found") || desc.includes("message can't be deleted")) {
      return NextResponse.json({ success: true, warning: desc });
    }

    return NextResponse.json({
      success: false,
      error: desc || "Telegram delete error",
      errorCode: result.error_code,
    });
  } catch (err: unknown) {
    console.error("[Telegram Delete Error]:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to delete Telegram message" },
      { status: 500 }
    );
  }
}
