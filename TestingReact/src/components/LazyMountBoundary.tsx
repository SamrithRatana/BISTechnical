"use client";

/**
 * @file LazyMountBoundary.tsx
 * @description Contains a failed `next/dynamic` chunk so it cannot take the app down.
 *
 * `next/dynamic` is `React.lazy` + `Suspense`, and a rejected `import()` is
 * re-thrown during render. The two lazy hosts that need this — the AI panel and
 * the companion-scanner modal — are rendered by `app/layout.tsx` as siblings of
 * `<AuthGuard>`, which puts them OUTSIDE `app/error.tsx`'s boundary. The only
 * boundary above them is `app/global-error.tsx`, which replaces `<html>` and
 * `<body>` wholesale.
 *
 * So without this, one 404'd chunk replaces the entire application with the
 * global error page. That is a live scenario rather than a hypothetical: this
 * app is built for week-long sessions (§14), a deploy rotates the hashed chunk
 * filenames, and the first click on the AI launcher afterwards fetches a file
 * that no longer exists — discarding whatever the technician had open in a
 * ticket dialog.
 *
 * Rendering `null` on failure is the right degradation for both consumers:
 * each wraps an optional overlay, so the surrounding page keeps working and the
 * user can reload to pick up the new chunks. Same choice `LanguageProvider`
 * makes when the Khmer dictionary fails to load.
 */

import React from "react";

interface Props {
  children: React.ReactNode;
  /** Named in the console warning, so a failure says which chunk died. */
  label: string;
}

interface State {
  failed: boolean;
}

export default class LazyMountBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Not swallowed silently: a chunk that stops loading after a deploy is a
    // real operational signal, and this is the only place it is observable.
    console.error(`[LazyMountBoundary] ${this.props.label} failed to load.`, error);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
