"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CertificateArtwork } from "./certificate-artwork";
import { BASE_SIZES, type Design } from "./data";

/* "Download": the certificate at its full size is printed to PDF by the browser (Save as PDF), so what is saved is the artwork exactly as it is
   drawn on screen, with the QR code. It is mounted off-screen, waits for the fonts and the QR code, and prints on its own: while the print
   dialog is open everything else on the page is hidden and the page is the certificate's own size. */

interface Item {
  cert: { typeKey: string; design: Design };
  recipient: { name: string; affiliation: string; roleLabel: string; paperId: string; paperTitle: string; serial: string };
  conference: { name?: string; acronym?: string; startDate?: string; endDate?: string; city?: string; country?: string };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function PrintCertificate({ item, onDone }: { item: Item; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const orientation = item.cert.design.orientation === "portrait" ? "portrait" : "landscape";
  const { w, h } = BASE_SIZES[orientation];

  useEffect(() => {
    let cancelled = false;
    const finish = () => { if (!cancelled) onDone(); };
    (async () => {
      try { await document.fonts?.ready; } catch { /* print anyway */ }
      // The QR code is drawn a moment after the artwork (the logo and the fonts too).
      for (let i = 0; i < 20 && !root.current?.querySelector('img[src^="data:"]') && item.cert.design.showQr; i++) await wait(100);
      await wait(150);
      if (cancelled) return;
      window.addEventListener("afterprint", finish, { once: true });
      window.print();
      // Browsers that do not fire afterprint still get the page back.
      setTimeout(finish, 60_000);
    })();
    return () => { cancelled = true; window.removeEventListener("afterprint", finish); };
    // The item is fixed for the life of this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div id="cert-print-root" ref={root} aria-hidden="true">
      <style>{`
        #cert-print-root { position: fixed; left: -100000px; top: 0; width: ${w}px; height: ${h}px; }
        @media print {
          @page { size: ${w}px ${h}px; margin: 0; }
          body > *:not(#cert-print-root) { display: none !important; }
          #cert-print-root { position: static; left: 0; display: block !important; width: ${w}px; height: ${h}px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <CertificateArtwork design={item.cert.design} recipient={item.recipient} conference={item.conference} width={w} />
    </div>,
    document.body,
  );
}
