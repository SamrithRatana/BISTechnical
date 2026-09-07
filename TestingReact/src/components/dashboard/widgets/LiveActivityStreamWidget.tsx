"use client";

import React, { useState, useEffect } from "react";
import { Radio, Activity, Clock, CheckCircle, RefreshCw, Zap } from "lucide-react";
import useRealtimeTickets from "@/hooks/useRealtimeTickets";
import { useTicketSeries } from "@/hooks/useTicketSeries";
import { useI18n } from "@/i18n/LanguageProvider";

interface ActivityLogItem {
  id: string;
  type: string;
  title: string;
  timestamp: string;
  status?: string;
  resource?: string;
}

export default function LiveActivityStreamWidget() {
  const { lang } = useI18n();
  const { items } = useTicketSeries();
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);

  // Seed initial logs from recent tickets
  useEffect(() => {
    if (items && items.length > 0 && logs.length === 0) {
      const initialLogs = items.slice(0, 6).map((ticket, i) => ({
        id: `init-${ticket.id}-${i}`,
        type: "ticket_updated",
        title: `${ticket.reportNo || "Ticket"} • ${ticket.itemName || "Item"}`,
        timestamp: ticket.serviceDate
          ? new Date(ticket.serviceDate).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Recently",
        status: ticket.status || "Updated",
        resource: "ticket",
      }));
      setLogs(initialLogs);
    }
  }, [items, logs.length]);

  // Listen to realtime events
  useRealtimeTickets(null, () => {
    const newLog: ActivityLogItem = {
      id: `live-${Date.now()}-${Math.random()}`,
      type: "status_changed",
      title: lang === "km" ? "ការផ្លាស់ប្តូរទិន្នន័យជាក់ស្តែង" : "Realtime System Update",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      status: "Synced",
      resource: "realtime",
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 19)]);
  });

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 p-4 shadow-xs flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 relative">
            <Radio className="w-4 h-4 animate-pulse" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <span>{lang === "km" ? "កំណត់ហេតុផ្សាយបន្តផ្ទាល់ (Live SSE)" : "Live Activity & SSE Stream"}</span>
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {lang === "km"
                ? "ការផ្សាយបន្តផ្ទាល់តាម SSE រាល់ពេលមានប្រតិបត្តិការ"
                : "Real-time audit log multiplexed across active tabs"}
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          LIVE
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto max-h-[260px] no-scrollbar">
        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400">
            {lang === "km" ? "រង់ចាំព្រឹត្តិការណ៍បន្តផ្ទាល់..." : "Listening for live stream events..."}
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="p-2.5 rounded-xl bg-zinc-50/60 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                    {log.title}
                  </p>
                  <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{log.timestamp}</span>
                  </p>
                </div>
              </div>

              {log.status && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                  {log.status}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
