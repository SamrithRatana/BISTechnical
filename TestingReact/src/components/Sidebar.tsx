"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Package,
  Wrench,
  Users,
  ClipboardList,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Settings,
  Sparkles,
} from "lucide-react";

interface NavGroup {
  title: string;
  items: {
    name: string;
    href: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

const navGroups: NavGroup[] = [
  {
    title: "INVENTORY ITEMS",
    items: [
      { name: "Received Items Inventory", href: "/received-inventory", icon: Package },
      { name: "SparePart Inventory", href: "/spareparts", icon: Wrench },
    ],
  },
  {
    title: "CUSTOMER INFORMATION",
    items: [{ name: "Customer Center", href: "/customers", icon: Users }],
  },
  {
    title: "TECHNICAL",
    items: [
      { name: "Received Items", href: "/receive-item", icon: ClipboardList },
      { name: "Inspect Items", href: "/inspect-item", icon: Clock },
      { name: "Inspection", href: "/inspection", icon: FileText },
      { name: "Approve Repairing", href: "/approve-repair", icon: CheckCircle },
      { name: "Approve Verify", href: "/approve-verify", icon: CheckCircle },
    ],
  },
  {
    title: "STOCK",
    items: [
      { name: "Technical Spare Parts Request", href: "/spare-request", icon: Wrench },
      { name: "Confirmed Repair Sale", href: "/confirmed-sale", icon: CheckCircle },
    ],
  },
  {
    title: "SALE",
    items: [{ name: "Set Waiting Customer Confirm", href: "/waiting-confirm", icon: Clock }],
  },
  {
    title: "REJECTED SERVICE TRACKER",
    items: [
      { name: "Customer Rejected", href: "/rejected", icon: XCircle },
      { name: "Set Unrepairable", href: "/unrepairable", icon: ShieldAlert },
    ],
  },
];

export default function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (val: boolean) => void }) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 ${
        isOpen ? "w-64" : "w-20"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/40">
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          {isOpen && (
            <div className="flex flex-col">
              <span className="font-bold text-white tracking-wide text-sm leading-none">Service & Repair</span>
              <span className="text-[10px] text-cyan-400 font-medium tracking-wider uppercase mt-1">Management v2</span>
            </div>
          )}
        </Link>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 sm:py-4 space-y-4 sm:space-y-5 scrollbar-thin scrollbar-thumb-slate-700">
        {/* Main Dashboard Link */}
        <div>
          <Link
            href="/"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              pathname === "/"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "hover:bg-slate-800/80 text-slate-300"
            }`}
          >
            <Home className="w-5 h-5 shrink-0" />
            {isOpen && <span>Home Dashboard</span>}
          </Link>
        </div>

        {/* Dynamic Groups */}
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {isOpen && (
              <h3 className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {group.title}
              </h3>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={!isOpen ? item.name : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-blue-600/90 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {isOpen && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Profile or Settings */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/30">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition-colors"
        >
          <Settings className="w-4 h-4 shrink-0" />
          {isOpen && <span>System Settings</span>}
        </Link>
      </div>
    </aside>
  );
}
