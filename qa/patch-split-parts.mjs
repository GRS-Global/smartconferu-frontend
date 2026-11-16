import fs from "node:fs";
const f = "src/features/chair/components/chair-add-review-page.tsx";
let s = fs.readFileSync(f, "utf8");
const a = s.indexOf("/** The paper at the top of the review form");
const b = s.indexOf("export function ChairAddReviewPage");
let block = s.slice(a, b);
const ageLine = block.match(/const age = .*\n/)?.[0] ?? "";
s = s.slice(0, a) + s.slice(b);
// the age helper stays available to the chair page through the shared file
s = s.replace(ageLine, "");
s = s.replace(`import { PaperSplit } from "./paper-split";`, `import { AbstractCard, PaperHeader, age } from "./review-paper-parts";\nimport { PaperSplit } from "./paper-split";`);
fs.writeFileSync(f, s);
block = block.replace(/\/\*\* The paper at the top of the review form[^\n]*\n/, "");
block = block.replace("function FileIconAction", "function FileIconAction").replace("function PaperHeader(", "export function PaperHeader(").replace("function AbstractCard(", "export function AbstractCard(");
block = block.replace(/\{ paper, acronym, keywords, compact, file, onFile \}: \{ paper: ChairPaper;/, "{ paper, acronym, keywords, compact, file, onFile }: { paper: PaperLike;");
const head = `"use client";

import { BookOpen, ChevronDown, Download, Eye, Tag, Users, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { monogram } from "@/features/author/format";

/* Pieces of the review workspace shared by the chair's "Add your review" page and the reviewer's review page (the prototype's ReviewPaperHeader and
   ReviewAbstractCard): the paper's banner, the abstract, and the "Draft saved … ago" wording. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
/** What the banner needs of a paper (the reviewer's papers carry no authors: reviews are double-blind). */
export interface PaperLike { id: string; title: string; track: string; presentationType: string; submittedAt?: string; authors: { name: string; email?: string; affiliation?: string; corresponding?: boolean }[] }
export ${ageLine.trim()}

`;
fs.writeFileSync("src/features/chair/components/review-paper-parts.tsx", head + block);
console.log("ok");
