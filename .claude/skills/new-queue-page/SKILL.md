---
name: new-queue-page
description: Add a new workflow queue page to the Next.js frontend — the route, its i18n keys in en and km, the sidebar/assistant nav entry, and the route-index doc. Use when the user asks for a new page, queue, screen, or menu item under TestingReact/src/app.
user-invocable: true
---

# new-queue-page — add a workflow queue

There are ~20 of these already and they are near-identical. The page file is
the *small* part; the four registration steps around it are what gets
forgotten. A page that renders but has no nav entry is invisible, and one with
an English-only label is a compile error on the Khmer dictionary.

Work from `TestingReact/`.

## Before you start

Ask, or infer from the request:

1. **Route** — kebab-case, e.g. `/third-party-repair`.
2. **Backend status** it lists. Must be one of `SERVICE_STATUSES_DB` in
   `src/services/types.ts` — these strings are **identity**, compared and
   posted on the wire, so they are never translated and never "corrected":

   | id | name | id | name |
   |----|------|----|------|
   | 1 | `Item Recieved` *(sic — DB misspelling, keep it)* | 7 | `Customer Rejected` |
   | 2 | `Inspection` | 8 | `Unrepairable` |
   | 3 | `Awaiting Customer Confirm` | 9 | `Repair by Third-Party` |
   | 4 | `Awaiting Sparepart` | 10 | `Inspecting` |
   | 5 | `Repairing` | 11 | `Sale Confirmed` |
   | 6 | `Finished` | 12 | `Sent Spareparts` |

3. **Tabs?** Optional strip of sibling statuses across the top.
4. **Which sidebar group** — Inventory, Customer, Technical, Stock, Sale,
   Rejected, or Reports.

## Step 1 — the page

`src/app/<route>/page.tsx`. Without tabs, this is the whole file:

```tsx
"use client";

import React from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";

export default function ThirdPartyRepairPage() {
  return (
    <PageWrapper titleKey="nav.thirdPartyRepair" subtitleKey="sub.thirdPartyRepair">
      <ServiceTable activeFilter="Repair by Third-Party" />
    </PageWrapper>
  );
}
```

With tabs, hold the active key in state and declare the tab list at module
scope — `StatusTabMenu` translates `labelKey` itself, so the const needs no
hook:

```tsx
"use client";

import React, { useState } from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";
import { TabItem } from "@/components/StatusTabMenu";

const THIRD_PARTY_TABS: TabItem[] = [
  { key: "Inspection", labelKey: "status.inspection", color: "cyan" },
  { key: "Repair by Third-Party", labelKey: "status.thirdParty", color: "purple" },
];

export default function ThirdPartyRepairPage() {
  const [activeTabKey, setActiveTabKey] = useState("Repair by Third-Party");

  return (
    <PageWrapper titleKey="nav.thirdPartyRepair" subtitleKey="sub.thirdPartyRepair">
      <ServiceTable
        activeFilter="Repair by Third-Party"
        activeTabKey={activeTabKey}
        tabs={THIRD_PARTY_TABS}
        onTabChange={setActiveTabKey}
      />
    </PageWrapper>
  );
}
```

`ServiceTable` uses `activeTabKey || activeFilter` as the effective filter, so
the initial `activeTabKey` should normally equal `activeFilter`.

`TabItem.color` names a hue (`blue | amber | emerald | rose | purple | cyan |
slate`) that `StatusTabMenu` maps to a tone token internally. It is a legacy
prop shape — pick the hue that matches the status's *meaning* (rejected → rose,
done → emerald, in-progress → cyan/blue).

**Do not add SSE wiring or search-param handling unless the page needs it.**
`ServiceTable` already owns fetching, infinite scroll, search and realtime
refresh. Pages only reach for `useRealtimeTickets` / `useSearchQueryParam`
directly when they render their *own* table instead of `ServiceTable` — see
`inspect-item/page.tsx` for that shape.

## Step 2 — i18n, both languages

`src/i18n/translations.ts`. Add to the `en` object **and** the `km` object.
`km` is typed `Record<TranslationKey, string>`, so missing either side fails
`tsc` — that is the safety net, not a suggestion.

You need at least:
- `nav.<camelCase>` — the sidebar label and page title
- `sub.<camelCase>` — the subtitle line

Khmer wording comes from the legacy Blazor app's
`src/Apps/ServiceMaintenance/Resources/App.km-KH.resx` vocabulary, so staff read
the same terms they always have. Reuse the dictionary's existing words —
គ្រឿងបន្លាស់ (spare part), វិនិច្ឆ័យ (inspection), ម៉ាស៊ីន (machine). If you
cannot determine correct Khmer for a genuinely new concept, **stop and ask**.
Do not ship a machine translation into a dictionary whose whole point is
inherited terminology.

## Step 3 — the nav entry

`src/config/navigation.ts`. This is the single source of truth for **both** the
sidebar and the AI assistant's knowledge of the app — adding the page here is
what puts it in front of the user *and* teaches the assistant it exists.

```ts
{
  nameKey: "nav.thirdPartyRepair",
  href: "/third-party-repair",
  purpose:
    "Jobs sent out to an external repairer. Track what is away and bring it back in when returned.",
  status: "Repair by Third-Party",
  tabs: ["Inspection", "Repair by Third-Party"],
},
```

`purpose` is **never rendered**. It is written for the assistant, so it can
answer "where do I …" from the real app. Write a plain-English sentence about
what someone *does* on the page, not a restatement of the route name.

If the route does not exist yet, set `available: false` — the assistant reads
that flag and refuses to send anyone to a dead route.

## Step 4 — the sidebar icon

`src/components/Sidebar.tsx` holds a local `ICONS: Record<string, React.ElementType>`
keyed by href. Add your route with a `lucide-react` icon, importing it at the
top. A missing entry means the row renders without an icon.

The icon map lives in the component, not in `navigation.ts`, deliberately —
`navigation.ts` is plain data imported server-side by the AI route, and pulling
a component library across that boundary for a menu list is not worth it.

## Step 5 — the route index

`src/app/CLAUDE.md` is a hand-maintained index of every route. Add a section
matching the existing format:

```markdown
## `/third-party-repair` — Third-party repair queue

- File: `third-party-repair/page.tsx`
- Client component.
- `ThirdPartyRepairPage()` — `PageWrapper` + `ServiceTable activeFilter="Repair by Third-Party"` with `THIRD_PARTY_TABS`.
```

## Verify

```bash
npx tsc --noEmit     # catches a missing km key
npm run lint
```

Then load the route in a browser and check the sidebar row, both languages, and
that rows actually come back for that status. See the `verify-ui` skill for the
auth bypass — the queue is behind `AuthGuard`.
