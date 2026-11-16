"use client";

import { useEffect, useState } from "react";
import QRCodeLib from "qrcode";

/** A QR code for `text` as a PNG data URL (null until generated). */
export function useQrDataUrl(text: string): string | null {
  const [state, setState] = useState<{ text: string; url: string } | null>(null);
  useEffect(() => {
    let alive = true;
    if (!text) return undefined;
    QRCodeLib.toDataURL(text, { width: 300, margin: 0, color: { dark: "#0B1020", light: "#FFFFFF" } })
      .then((u) => { if (alive) setState({ text, url: u }); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [text]);
  return state && state.text === text ? state.url : null;
}
