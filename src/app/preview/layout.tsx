import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Preview" };

/**
 * The preview route shows each screen with fixture data. It needs no account and no database.
 * It exists in development only. Its buttons that change stock do not work.
 */
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
