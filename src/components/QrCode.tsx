"use client";

import qrcode from "qrcode-generator";
import { useMemo } from "react";

/** Draws a QR code (as crisp SVG) for any link. */
export default function QrCode({ value, size = 220, label }: { value: string; size?: number; label?: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [value]);
  return (
    <div
      role="img"
      aria-label={label ?? `QR code for ${value}`}
      style={{ width: size, height: size, background: "#fff", borderRadius: 12, padding: 6 }}
      // The SVG is generated locally by the QR library from our own link.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
