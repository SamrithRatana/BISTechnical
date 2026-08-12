"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

interface PageWrapperProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function PageWrapper({ title, subtitle, children }: PageWrapperProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="h-screen overflow-hidden bg-slate-100/70 text-slate-900 font-sans dark:bg-slate-950 dark:text-slate-100 flex">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Content Body */}
      <div
        className={`flex-1 flex flex-col h-screen overflow-hidden min-w-0 transition-all duration-300 ${
          sidebarOpen ? "ml-64" : "ml-20"
        }`}
      >
        {/* Header Bar */}
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        {/* Page Main Content Area */}
        <main className="flex-1 flex flex-col p-3 sm:p-4 lg:p-6 w-full mx-auto overflow-hidden min-h-0 gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
              {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
