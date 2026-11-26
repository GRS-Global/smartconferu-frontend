"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CertificateArtwork } from "./certificate-artwork";
import { BASE_SIZES, type Design } from "./data";
import { A4_SPEC, fitOnSheet, sheetOf, type PaperKey, type PaperSpec } from "./paper";
import { docPage, docPaper } from "./studio/model";

/* "Print": the certificate is printed by the browser on the chosen paper (A4 by default; see paper.ts). It is mounted off screen, waits for the fonts, the pictures and the QR code, then
   opens the print dialog on its own. While the dialog is open everything else on the page is hidden and the page is one sheet (landscape or
   portrait, as the design is) with the certificate scaled to fit it whole and centred (it fills an A4 sheet exactly: same proportions). Text stays real text, so the print
   is sharp; "Save as PDF" in the dialog makes a vector PDF. */

interface Item {
  cert: { typeKey: string; design: Design };
  recipient: { name: string; affiliation: string; roleLabel: string; paperId: string; paperTitle: string; serial: string; issuedAt?: number };
  conference: { name?: string; acronym?: string; startDate?: string; endDate?: string; city?: string; country?: string };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function PrintCertificate({ item, paper, onDone }: { item: Item; /** Print on another paper than the certificate's own (it is then fitted whole and centred). */ paper?: PaperKey | PaperSpec; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const design = item.cert.design;
  const orientation = design.orientation === "portrait" ? "portrait" : "landscape";
  const { w, h } = design.studio ? docPage(design.studio) : BASE_SIZES[orientation];
  // By default the sheet is the paper the certificate is made for, so it fills it exactly.
  const sheet = sheetOf(paper ?? (design.studio ? docPaper(design.studio) : A4_SPEC), orientation);
  const fit = fitOnSheet(w, h, sheet.w, sheet.h);
  const wantsQr = Boolean(item.recipient.serial) && (design.studio ? design.studio.elements.some((e) => e.type === "qr" && !e.hidden) : design.showQr);

  useEffect(() => {
    let cancelled = false;
    const finish = () => { if (!cancelled) onDone(); };
    (async () => {
      try { await document.fonts?.ready; } catch { /* print anyway */ }
      // The QR code is drawn a moment after the artwork.
      for (let i = 0; i < 30 && wantsQr && !root.current?.querySelector('img[src^="data:"]'); i++) await wait(100);
      // Pictures (the logo, library signatures) load over the network: wait for them too, but never forever.
      for (let i = 0; i < 50 && [...(root.current?.querySelectorAll("img") ?? [])].some((im) => !im.complete); i++) await wait(100);
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
          @page { size: ${sheet.w}mm ${sheet.h}mm; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; height: auto !important; }
          body > *:not(#cert-print-root) { display: none !important; }
          /* a hair under the sheet, so rounding can never push a blank second page */
          #cert-print-root { position: static; left: 0; display: block !important; width: ${sheet.w}mm; height: calc(${sheet.h}mm - 1px); overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* the on-screen drop shadow around the page is not part of the certificate */
          #cert-print-inner * { box-shadow: none !important; }
          #cert-print-inner { width: ${w}px; height: ${h}px; transform: translate(${fit.ox}px, ${fit.oy}px) scale(${fit.scale}); transform-origin: 0 0; }
        }
      `}</style>
      <div id="cert-print-inner">
        <CertificateArtwork design={design} recipient={item.recipient} conference={item.conference} width={w} />
      </div>
    </div>,
    document.body,
  );
}
