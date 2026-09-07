"use client";

/**
 * @file components/download/useDownloadQr.ts
 * @description Builds the per-platform setup-page URLs and their QR codes.
 *
 * The QR is scanned by a phone on the same network, so a `localhost` origin is
 * useless to it. Instead of the old hardcoded LAN IP fallback, this asks
 * `/api/scanner/network-ip` (the same endpoint the barcode scanner and face
 * pairing already use) for the machine's primary LAN address and rewrites the
 * host only when the page itself is being viewed on localhost.
 */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QR_DARK, QR_LIGHT, type DownloadPlatform } from "./downloadConstants";

interface NetworkIpResponse {
  primaryIp?: string;
}

export interface DownloadQrState {
  /** Absolute URL of the /download/{platform} setup page, phone-reachable. */
  pageUrl: Record<DownloadPlatform, string>;
  /** data: URL of the rendered QR, empty string while generating. */
  qrDataUrl: Record<DownloadPlatform, string>;
}

const EMPTY: DownloadQrState = {
  pageUrl: { android: "", ios: "" },
  qrDataUrl: { android: "", ios: "" },
};

function isLoopback(host: string): boolean {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

export function useDownloadQr(): DownloadQrState {
  const [state, setState] = useState<DownloadQrState>(EMPTY);

  useEffect(() => {
    const controller = new AbortController();

    const build = async (): Promise<void> => {
      let host = window.location.host;
      const protocol = window.location.protocol || "http:";

      if (isLoopback(host)) {
        try {
          const res = await fetch("/api/scanner/network-ip", {
            signal: controller.signal,
            cache: "no-store",
          });
          if (res.ok) {
            const body = (await res.json()) as NetworkIpResponse;
            if (body.primaryIp && body.primaryIp !== "127.0.0.1") {
              const port = window.location.port || "3000";
              host = `${body.primaryIp}:${port}`;
            }
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          // The QR still works for anyone viewing the page on its real host;
          // only the localhost developer preview loses the LAN rewrite.
          console.warn("network-ip lookup failed, QR will use current host", err);
        }
      }

      const pageUrl: DownloadQrState["pageUrl"] = {
        android: `${protocol}//${host}/download/android`,
        ios: `${protocol}//${host}/download/ios`,
      };

      const toQr = (url: string): Promise<string> =>
        QRCode.toDataURL(url, {
          width: 280,
          margin: 1.5,
          color: { dark: QR_DARK, light: QR_LIGHT },
        });

      try {
        const [android, ios] = await Promise.all([toQr(pageUrl.android), toQr(pageUrl.ios)]);
        if (controller.signal.aborted) return;
        setState({ pageUrl, qrDataUrl: { android, ios } });
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn("QR generation failed", err);
        setState({ pageUrl, qrDataUrl: EMPTY.qrDataUrl });
      }
    };

    void build();
    return () => controller.abort();
  }, []);

  return state;
}
