/**
 * @file LanguageScript.tsx
 * @description Stamps the saved language onto <html> before first paint.
 *
 * Without it a Khmer user sees one frame of Latin-font English while React
 * hydrates. Kept to the attributes only (no text substitution) so it cannot
 * disagree with what React renders.
 *
 * ── Why this is its own file, and why there is no `"use client"` above ──────
 *
 * This component used to be exported from `LanguageProvider.tsx`. That file
 * begins with `"use client"`, which made this a *client* component — and a
 * client component that renders a <script> is a contradiction React 19 reports
 * out loud:
 *
 *     Encountered a script tag while rendering React component. Scripts inside
 *     React components are never executed when rendering on the client.
 *
 * That warning is not pedantry. A <script> in a client component genuinely does
 * nothing: React creates the element through the DOM API, and a script node
 * inserted that way never runs. So the pre-paint stamp this file exists to
 * perform was silently not happening on any client render, and the element
 * additionally took part in hydration — where it mismatched, which made React
 * throw away the server HTML and re-render the entire tree on the client,
 * through all eight of the layout's context providers.
 *
 * Rendered from the server, the script is real markup in the streamed HTML and
 * the browser executes it before it paints, which is the whole point.
 * `ThemeScript.tsx` is a server component for exactly this reason and has
 * always worked; this file now matches it deliberately. Do not add
 * `"use client"` here, and do not move this back into the provider.
 *
 * `suppressHydrationWarning` matches `ThemeScript` too: the script mutates
 * <html> before React hydrates, so the attributes it writes are by design not
 * in the server markup.
 */

import { DEFAULT_LANGUAGE, STORAGE_KEY } from "./languageConfig";

export default function LanguageScript() {
  const js = `(function(){try{var l=localStorage.getItem('${STORAGE_KEY}');if(l!=='km'&&l!=='en')l='${DEFAULT_LANGUAGE}';document.documentElement.lang=l;document.documentElement.dataset.lang=l;}catch(e){}})();`;

  return <script id="lang-init" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: js }} />;
}
