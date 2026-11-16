import { LogOut } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/actions";
import { LiveRefresh } from "@/components/live-refresh";
import { LocationSelect } from "@/components/location-select";
import { Logo } from "@/components/logo";
import { Nav } from "@/components/nav";
import { getLocations, requireStaff } from "@/lib/auth";

function Frame({ controls, nav, children }: { controls?: React.ReactNode; nav?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <header className="sticky top-0 z-20 bg-primary pt-[env(safe-area-inset-top)] text-primary-foreground">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Link href="/" className="shrink-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-white/40" aria-label="Cornerstock, stock view">
            <Logo onDark />
          </Link>
          <div className="hidden sm:block">{nav}</div>
          <div className="ml-auto flex min-w-0 items-center gap-2">{controls}</div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      <div className="sm:hidden">{nav}</div>
    </div>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const [profile, { locations, selected }] = await Promise.all([requireStaff(), getLocations()]);
  const nav = <Nav owner={profile.role === "owner"} />;
  return (
    <Frame
      nav={nav}
      controls={
        <>
          <LocationSelect locations={locations} selected={selected} />
          <form action={signOut}>
            <button
              type="submit"
              className="flex size-10 items-center justify-center rounded-lg text-white/80 outline-none hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-white/40"
              aria-label={`Sign out ${profile.full_name}`}
              title="Sign out"
            >
              <LogOut className="size-5" aria-hidden="true" />
            </button>
          </form>
        </>
      }
    >
      <LiveRefresh />
      {children}
    </Frame>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <Frame>
          <p className="text-muted-foreground">Loading stock…</p>
        </Frame>
      }
    >
      <Shell>{children}</Shell>
    </Suspense>
  );
}
