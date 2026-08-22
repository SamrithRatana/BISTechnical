"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QRCodeSvgProps {
  value: string;
  size?: number;
  className?: string;
  darkColor?: string;
  lightColor?: string;
}

export default function QRCodeSvg({
  value,
  size = 200,
  className = "",
  darkColor = "#0f172a",
  lightColor = "#ffffff",
}: QRCodeSvgProps) {
  const [svgString, setSvgString] = useState<string>("");

  useEffect(() => {
    let active = true;
    if (!value) return;

    QRCode.toString(value, {
      type: "svg",
      margin: 1,
      width: size,
      color: {
        dark: darkColor,
        light: lightColor,
      },
      errorCorrectionLevel: "M",
    })
      .then((svg) => {
        if (active) setSvgString(svg);
      })
      .catch((err) => {
        console.error("QR generation failed:", err);
      });

    return () => {
      active = false;
    };
  }, [value, size, darkColor, lightColor]);

  if (!svgString) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse ${className}`}
      >
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div
      className={`inline-block overflow-hidden rounded-2xl bg-white p-2 shadow-md ${className}`}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
}
