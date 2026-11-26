"use client";

import { useMemo } from "react";
import type { CertTypeKey, Orientation } from "../data";
import type { PaperSpec } from "../paper";
import { pageSize } from "./model";
import { StudioPage } from "./render";
import { buildTemplateDoc } from "./templates";

/** A template drawn at `width` px with the same renderer the editor uses, so the thumbnail is the real thing. A sample ID makes the QR block draw as it will on a real certificate. */
export function TemplateThumb({ templateKey, typeKey, orientation, width, values, paper }: { templateKey: string; typeKey: CertTypeKey; orientation: Orientation; width: number; values: Record<string, string>; paper?: PaperSpec }) {
  const { w, h } = pageSize(orientation, paper);
  const doc = useMemo(() => buildTemplateDoc(templateKey, typeKey, orientation, undefined, paper), [templateKey, typeKey, orientation, paper]);
  const scale = width / w;
  return (
    <div style={{ width, height: Math.round(h * scale), position: "relative", overflow: "hidden", borderRadius: 3, boxShadow: "0 2px 10px rgba(11,16,32,0.14)", flexShrink: 0 }} aria-hidden="true">
      <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
        <StudioPage doc={doc} values={values} serial="SAMPLE-000" w={w} h={h} />
      </div>
    </div>
  );
}
