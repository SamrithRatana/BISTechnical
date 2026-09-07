import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_TELEGRAM_CONFIG } from "@/services/telegramService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messageId, text, config } = body;

    const botToken = process.env.TELEGRAM_BOT_TOKEN || config?.botToken || DEFAULT_TELEGRAM_CONFIG.botToken;
    const chatId = process.env.TELEGRAM_CHAT_ID || config?.chatId || DEFAULT_TELEGRAM_CONFIG.chatId;

    if (!botToken || !chatId || !messageId || !text) {
      return NextResponse.json(
        { success: false, error: "Missing botToken, chatId, messageId, or text" },
        { status: 400 }
      );
    }

    const payload = {
      chat_id: chatId,
      message_id: Number(messageId),
      text,
      parse_mode: "HTML",
    };

    let telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let result = await telegramRes.json();

    // If message is a photo message, fallback to editMessageCaption
    if (!result.ok && (result.description || "").includes("there is no text in the message to edit")) {
      telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/editMessageCaption`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: Number(messageId),
          caption: text,
          parse_mode: "HTML",
        }),
      });
      result = await telegramRes.json();
    }

    if (result.ok) {
      return NextResponse.json({ success: true, result: result.result });
    }

    const desc = result.description || "";
    // If message is identical ("message is not modified"), treat as success
    if (desc.includes("message is not modified")) {
      return NextResponse.json({ success: true, notModified: true });
    }

    return NextResponse.json({
      success: false,
      error: desc || "Telegram edit error",
      errorCode: result.error_code,
    });
  } catch (err: unknown) {
    console.error("[Telegram Edit Error]:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to edit Telegram message" },
      { status: 500 }
    );
  }
}
