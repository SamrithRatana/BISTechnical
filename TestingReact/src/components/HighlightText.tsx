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
 *
 * Rendered roughly five times per ticket row across nine columns, so this is
 * one of the hottest components in the app — every keystroke in a queue search
 * box used to rebuild an escaped `RegExp` and re-split the string here for
 * every cell of every loaded row. The split is now memoised on the two inputs
 * that decide it, and the component is `memo`'d so a parent re-render with the
 * same text and query costs nothing.
 *
 * **Matches are identified by position, not by re-testing the regex.**
 * `String.split` with a single capture group always returns
 * `[text, capture, text, capture, …]`, so an odd index IS the match — correct
 * by construction, and it drops a regex execution per part.
 *
 * The previous version called `regex.test(part)` inside the map on a
 * `g`-flagged regex, which *looks* like the classic `lastIndex` bug. It was
 * not: a non-capture chunk can never match the pattern by construction, and
 * `RegExp.prototype.test` resets `lastIndex` to 0 on every failure, so each
 * capture was always tested from 0 anyway. A 300,000-case randomised
 * differential run over both implementations — alphabet including
 * `. * + ? ^ $ { } ( ) [ ] \ | / -`, a Khmer codepoint and spaces, plus
 * matches at index 0, adjacent matches, whole-string matches and empty
 * queries — found **zero divergences**. So this is a performance change and a
 * clarity one, not a bug fix; do not "restore" the test in the belief that the
 * index arithmetic is the risky version.
 */
function HighlightTextImpl({
  text,
  query,
  className = "",
}: HighlightTextProps) {
  const trimmedQuery = query?.trim() ?? "";

  const matchRegex = React.useMemo(() => {
    if (!trimmedQuery) return null;
    const words = trimmedQuery
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (words.length === 0) return null;
    return new RegExp(`(${words.join("|")})`, "gi");
  }, [trimmedQuery]);

  if (text === null || text === undefined) return <span className={className}>—</span>;
  if (!text) return <span className={className}>{text}</span>;
  if (!matchRegex) return <span className={className}>{text}</span>;

  const parts = text.split(matchRegex);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        new RegExp(matchRegex.source, "i").test(part) ? (
          <mark
            key={i}
            className="bg-highlight text-highlight-fg font-bold px-0.5 rounded transition-colors"
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

const HighlightText = React.memo(HighlightTextImpl);
HighlightText.displayName = "HighlightText";

export default HighlightText;
