/* The Peer Review list's view (filter, track, search, sort, column filters, extra columns) and, once a paper is opened, the order of the papers it
   showed — kept for this browser tab, so coming back from a paper lands on the same view and the paper page can step through that list (Prev / Next).
   The prototype's readPeerReviewView / savePeerReviewView (same key, same fields). Nothing here touches the database. */

const KEY = "smartconferu.peerReviewView";

export interface PeerReviewView {
  conferenceId: string;
  filter?: string; query?: string; track?: string; sort?: { key: string | null; dir: "asc" | "desc" };
  ic?: string; pl?: string; idq?: string; rv?: string; du?: string; sc?: string; dc?: string;
  cols?: string[];
  queue?: string[]; queueLabel?: string;
}

export function readPeerReviewView(conferenceId: string): PeerReviewView | null {
  if (typeof window === "undefined") return null;
  try {
    const v = JSON.parse(window.sessionStorage.getItem(KEY) || "null") as PeerReviewView | null;
    return v && v.conferenceId === conferenceId ? v : null;
  } catch { return null; }
}

export function savePeerReviewView(view: PeerReviewView): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(KEY, JSON.stringify(view)); } catch { /* storage off */ }
}
