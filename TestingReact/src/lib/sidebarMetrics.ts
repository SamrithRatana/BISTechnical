import type { SidebarStyleName } from "@/theme/themeConfig";

/**
 * The content column's left margin, per sidebar style and collapse state.
 *
 * The aside is `position: fixed`, so it occupies no layout space — this margin
 * is the only thing reserving room for it. The two must agree at EVERY
 * breakpoint or the rail paints on top of the page.
 *
 * This lived as a copy-pasted ternary in `PageWrapper`, `app/page.tsx` and
 * `app/users/page.tsx`, because those last two render the shell themselves
 * rather than going through `PageWrapper`. The copies drifted: `/users` never
 * learned about sidebar styles at all and always reserved 256px, so every
 * style wider than `classic` (dual-column is 320px) painted over the page.
 * One exported function is why that can't drift again.
 *
 * Widths these mirror, measured from the compiled CSS (see `Sidebar.tsx`):
 *
 *   style             open lg / xl     collapsed
 *   ----------------- ---------------  ---------
 *   dual-column       288 / 320        80
 *   enterprise-erp    288 / 304        80
 *   motion-expansion  268 / 284 *      84 *
 *   floating          240 / 256        80
 *   compact-rail      240 / 256        80
 *   classic|carbon|radiant  256 / 272  80
 *
 *   * motion-expansion is a floating card inset 12px from the left
 *     (`left-3`), so its right edge is 12px past its own width; the margin
 *     adds 4px so the card is not flush against the content.
 *
 * Below `lg` every style is an off-canvas drawer occupying no space, so none
 * of these carry an unprefixed margin — an `ml-64` with no `lg:` was what
 * indented `/users` by 256px on every phone.
 */
export function sidebarMarginClass(
  style: SidebarStyleName,
  open: boolean,
): string {
  if (!open) {
    return style === "motion-expansion" ? "lg:ml-[88px]" : "lg:ml-20";
  }
  switch (style) {
    case "dual-column":
      return "lg:ml-72 xl:ml-80";
    case "enterprise-erp":
      return "lg:ml-72 xl:ml-76";
    case "motion-expansion":
      return "lg:ml-[272px] xl:ml-[288px]";
    case "floating":
    case "compact-rail":
      return "lg:ml-60 xl:ml-64";
    default:
      return "lg:ml-64 xl:ml-68";
  }
}
