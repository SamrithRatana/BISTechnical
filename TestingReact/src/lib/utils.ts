import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 *
 * Both packages were already dependencies but nothing exported this helper, so
 * every component that wanted a conditional class hand-rolled a template
 * string. The merge half matters more than the conditional half: without it,
 * `cn("p-4", props.className)` with `className="p-6"` emits both and the winner
 * is whichever Tailwind happened to order last in the stylesheet — which is not
 * something a caller can reason about.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resolves a picture URL (relative database path or remote absolute URL) into a valid browser image source URL.
 */
export function getImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return url;
  return `/${url}`;
}
