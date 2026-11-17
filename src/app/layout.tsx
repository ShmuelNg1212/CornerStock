import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { MotionProvider } from "@/components/motion-provider";
import startupImages from "@/lib/startup-images.json";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Cornerstock", template: "%s · Cornerstock" },
  description: "Bowling ball stock for Bowlers Corner.",
  // The startup images are made by scripts/make-startup-images.mjs, one for each iPhone and iPad screen.
  // "default" gives a solid status bar above the page. With "black-translucent", iOS 26.1 and later draw
  // a grey blur over the top of the page, and CSS cannot remove it. iOS reads this value at install time.
  appleWebApp: { capable: true, title: "Cornerstock", statusBarStyle: "default", startupImage: startupImages },
  robots: { index: false, follow: false },
  other: {
    // Next.js writes only "mobile-web-app-capable". iOS uses the status bar style and the startup
    // images only with this Apple tag. Without it, the home-screen app has a white status bar.
    "apple-mobile-web-app-capable": "yes",
    "cornerstock-release": "2026-11-17-stock-count-1",
  },
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
        {/* A navy band behind the clock and battery, also on screens with no top bar, such as sign-in. */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[env(safe-area-inset-top)] bg-rail" />
        <MotionProvider>{children}</MotionProvider>
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
