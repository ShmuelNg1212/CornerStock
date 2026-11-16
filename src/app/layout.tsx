import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Cornerstock", template: "%s · Cornerstock" },
  description: "Bowling ball stock for Bowlers Corner.",
  appleWebApp: { capable: true, title: "Cornerstock", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
  other: { "cornerstock-release": "2026-11-16-find-first-1" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#172a3a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-dvh">
        {children}
        <Toaster
          position="top-center"
          offset={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
          mobileOffset={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
          toastOptions={{
            duration: 3500,
            classNames: {
              toast: "!rounded-xl !border-primary !bg-primary !text-primary-foreground !font-sans !text-base !font-medium !shadow-[0_8px_24px_-8px_rgb(23_42_58/0.45)]",
              icon: "!text-gold",
            },
          }}
        />
      </body>
    </html>
  );
}
