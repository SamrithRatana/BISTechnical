"use client";

import React from "react";

interface HighlightTextProps {
  text?: string | null;
  query?: string;
  className?: string;
}

/**
 * @file HighlightText.tsx
 * @description Renders text with yellow highlight on any substring matching `query`.
 * Used across all table cells (Ref No, Company Name, Item Name, Serial Number, Phone, etc.)
 */
export default function HighlightText({
  text,
  query,
  className = "",
}: HighlightTextProps) {
  if (!text) return <span className={className}>—</span>;
  if (!query || !query.trim()) return <span className={className}>{text}</span>;

  const trimmedQuery = query.trim();
  const escaped = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-highlight text-highlight-fg font-bold px-1 rounded transition-colors "
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </span>
  );
}
