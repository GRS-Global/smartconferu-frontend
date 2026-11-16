const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
}

/** "17–19 Feb 2027", "28 Feb – 2 Mar 2027" or "30 Dec 2026 – 2 Jan 2027". */
export function formatDateRange(startIso: string, endIso: string): string {
  const s = parts(startIso);
  const e = parts(endIso);
  if (s.y === e.y && s.m === e.m) {
    return s.d === e.d ? `${s.d} ${MONTHS[s.m]} ${s.y}` : `${s.d}–${e.d} ${MONTHS[s.m]} ${s.y}`;
  }
  if (s.y === e.y) return `${s.d} ${MONTHS[s.m]} – ${e.d} ${MONTHS[e.m]} ${s.y}`;
  return `${s.d} ${MONTHS[s.m]} ${s.y} – ${e.d} ${MONTHS[e.m]} ${e.y}`;
}

export function yearOf(iso: string): number {
  return parts(iso).y;
}
