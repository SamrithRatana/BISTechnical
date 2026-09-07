/**
 * @file services/telegramService.ts
 * @description Complete Telegram Bot Notification & Message Lifecycle Service for Next.js.
 * Supports sending, editing in-place, deleting, per-topic tracking, and automatic
 * retraction of old messages across workflow status transitions.
 */

export interface TelegramTopicConfig {
  [key: string]: number;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  topics: TelegramTopicConfig;
}

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  botToken: "8312370431:AAG_mkyfjtplELy5KTnScYcPHZwqQNEAEQw",
  chatId: "-1004379506325",
  topics: {
    ItemReceived: 63,              // 📦 ម៉ាស៊ីនចូល (Topic 63)
    Inspecting: 61,                // ម៉ាស៊ីនកំពុងវិនិច្ឆ័យ (Topic 61)
    Inspection: 59,                // វិនិច្ឆ័យរួចរាល់ (Topic 59)
    AwaitingSparepart: 57,         // ផ្នែកជាងស្នើរគ្រឿងបន្លាស់ (Topic 57)
    AwaitingCustomerConfirm: 55,   // រង់ចាំ Confirm ពីភ្ញៀវ (Topic 55)
    SaleConfirmed: 53,             // ផ្នែកទីផ្សារ Confirmed & រង់ចាំ 4 ទៅ 6 (Topic 53)
    SentSpareparts: 51,            // បានបញ្ជូនគ្រឿងបន្លាស់ (Topic 51)
    Finished: 48,                  // ជួសជុលរួចរាល់ (Topic 48)
    CustomerRejected: 98,          // អតិថិជនមិនជួសជុល (Topic 98)
    Unrepairable: 100,             // ជួសជុលមិនបាន (Topic 100)
    StockOut: 755,                 // 🔴 Stock Out (Topic 755)
    StockIn: 753,                  // 🟢 Stock In (Topic 753)
  },
};

export interface ServiceTelegramMessageRecord {
  topicKey: string;
  messageId: number;
  createdAt?: string;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("jwt_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Send a notification message to a Telegram Topic
 */
export async function sendTelegramNotification(
  topicKey: string,
  messageHtml: string,
  customConfig?: Partial<TelegramConfig>
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  try {
    const res = await fetch("/api/telegram/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topicKey,
        text: messageHtml,
        config: customConfig,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Send an image notification (photo with caption) to a Telegram Topic
 */
export async function sendTelegramPhotoNotification(
  topicKey: string,
  photoBlob: Blob,
  captionHtml: string,
  customConfig?: Partial<TelegramConfig>
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  try {
    const formData = new FormData();
    formData.append("photo", photoBlob, `report-${topicKey}.png`);
    formData.append("caption", captionHtml);
    formData.append("topicKey", topicKey);
    if (customConfig) {
      formData.append("config", JSON.stringify(customConfig));
    }

    const res = await fetch("/api/telegram/send-photo", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    return data;
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Edit an existing Telegram message in-place
 */
export async function editTelegramNotification(
  messageId: number,
  messageHtml: string,
  customConfig?: Partial<TelegramConfig>
): Promise<{ success: boolean; error?: string; notModified?: boolean }> {
  try {
    const res = await fetch("/api/telegram/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId,
        text: messageHtml,
        config: customConfig,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Delete a Telegram message from chat
 */
export async function deleteTelegramNotification(
  messageId: number,
  customConfig?: Partial<TelegramConfig>
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/telegram/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId,
        config: customConfig,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

// ── Database Tracking Helpers (backed by ServiceTelegramMessages child table) ──

/**
 * Fetch all live (non-deleted) Telegram message records for a service ticket
 */
export async function getLiveTelegramMessages(
  serviceId: string
): Promise<ServiceTelegramMessageRecord[]> {
  if (!serviceId) return [];
  try {
    const res = await fetch(`/api/proxy/technicalservices/${serviceId}/telegram-messages`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((item: any) => ({
        topicKey: String(item.topicKey || item.TopicKey || "").trim(),
        messageId: Number(item.messageId ?? item.MessageId ?? 0),
        createdAt: item.createdAt || item.CreatedAt,
      }))
      .filter((m) => m.topicKey && m.messageId > 0);
  } catch (err) {
    console.warn("Failed to get live telegram messages:", err);
    return [];
  }
}

/**
 * Save a newly-sent Telegram message ID for a service ticket and topic
 */
export async function saveServiceTelegramMessage(
  serviceId: string,
  topicKey: string,
  messageId: number
): Promise<boolean> {
  if (!serviceId || !topicKey || !messageId) return false;
  try {
    const res = await fetch(`/api/proxy/technicalservices/${serviceId}/telegram-message`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        topicKey,
        messageId,
        TopicKey: topicKey,
        MessageId: messageId,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn("Failed to save service telegram message:", err);
    return false;
  }
}

/**
 * Soft-delete a Telegram message ID in DB
 */
export async function markTelegramMessageDeleted(messageId: number): Promise<boolean> {
  if (!messageId) return false;
  try {
    const res = await fetch(`/api/proxy/technicalservices/telegram-message/${messageId}/mark-deleted`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch (err) {
    console.warn("Failed to mark telegram message deleted in DB:", err);
    return false;
  }
}

/**
 * Soft-delete all Telegram message records for a service in DB
 */
export async function markAllTelegramMessagesDeleted(serviceId: string): Promise<boolean> {
  if (!serviceId) return false;
  try {
    const res = await fetch(`/api/proxy/technicalservices/${serviceId}/telegram-messages/mark-all-deleted`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch (err) {
    console.warn("Failed to mark all telegram messages deleted in DB:", err);
    return false;
  }
}

/**
 * Cleans up and deletes any previous Telegram messages from OLD topics for a ticket,
 * ensuring only the current topic maintains the active message.
 */
export async function cleanupOldTopicTelegramMessages(
  serviceId: string,
  currentTopicKeyToKeep?: string
): Promise<void> {
  if (!serviceId) return;
  try {
    const liveMessages = await getLiveTelegramMessages(serviceId);
    if (!liveMessages || liveMessages.length === 0) return;

    for (const msg of liveMessages) {
      if (
        currentTopicKeyToKeep &&
        msg.topicKey.trim().toLowerCase() === currentTopicKeyToKeep.trim().toLowerCase()
      ) {
        continue; // keep current active message
      }

      // 1. Delete message from Telegram chat
      await deleteTelegramNotification(msg.messageId);

      // 2. Mark deleted in database
      await markTelegramMessageDeleted(msg.messageId);
    }
  } catch (err) {
    console.warn("cleanupOldTopicTelegramMessages error:", err);
  }
}

/**
 * Cleans up and deletes ALL Telegram messages for a service ticket (when ticket is deleted)
 */
export async function cleanupAllTelegramMessagesForService(serviceId: string): Promise<void> {
  if (!serviceId) return;
  try {
    const liveMessages = await getLiveTelegramMessages(serviceId);
    if (!liveMessages || liveMessages.length === 0) return;

    for (const msg of liveMessages) {
      // 1. Delete message from Telegram
      await deleteTelegramNotification(msg.messageId);
      // 2. Mark deleted in database
      await markTelegramMessageDeleted(msg.messageId);
    }
    await markAllTelegramMessagesDeleted(serviceId);
  } catch (err) {
    console.warn("cleanupAllTelegramMessagesForService error:", err);
  }
}
