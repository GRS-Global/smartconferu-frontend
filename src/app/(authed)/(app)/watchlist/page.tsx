import type { Metadata } from "next";
import { WatchlistPage } from "@/features/account/watchlist-page";

export const metadata: Metadata = { title: "My CFP Watchlist" };

export default function Watchlist() {
  return <WatchlistPage />;
}
