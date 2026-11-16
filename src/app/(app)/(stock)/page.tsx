import type { Metadata } from "next";
import { PaneHome } from "@/components/stock/pane-home";

export const metadata: Metadata = { title: "Stock" };

// The stock list is in the layout. This page is the detail pane with nothing open.
export default function StockPage() {
  return <PaneHome />;
}
