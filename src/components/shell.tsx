import { LogOut } from "lucide-react";
import Link from "next/link";
import { LocationSelect } from "@/components/location-select";
import { Logo } from "@/components/logo";
import { Nav } from "@/components/nav";
import type { Location } from "@/lib/types";

type ShellProps = {
  /** Not set while the account loads. The frame then shows no controls. */
  account?: { name: string; owner: boolean; locations: Location[]; selected: string; signOut: () => Promise<void> };
  /** A path prefix for the links. The preview route sets it. */
  base?: string;
  children?: React.ReactNode;
};

const signOutClass =
  "flex size-11 shrink-0 items-center justify-center rounded-lg text-rail-muted outline-none transition-colors duration-(--dur-fast) hover:bg-white/8 hover:text-white focus-visible:ring-3 focus-visible:ring-white/40";

/**
 * The frame of the app.
 * 1024px and wider: a navy rail at the left with the navigation and the location.
 * Narrower: a navy top bar and a tab bar at the bottom.
 */
export function Shell({ account, base = "", children }: ShellProps) {
  const home = `${base}/`;
  const signOut = account && (
    <form action={account.signOut} data-leaves-scan>
      <button type="submit" className={signOutClass} aria-label={`Sign out ${account.name}`} title="Sign out">
        <LogOut className="size-5" aria-hidden="true" />
      </button>
    </form>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col bg-rail px-3 py-5 text-rail-foreground lg:flex">
        <Link href={home} className="mx-1 mb-7 self-start rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-white/40" aria-label="Cornerstock, stock view">
          <Logo onDark />
        </Link>
        {account && <Nav owner={account.owner} variant="rail" base={base} />}
        {account && (
          <div className="mt-auto space-y-3">
            <LocationSelect locations={account.locations} selected={account.selected} />
            <div className="flex items-center gap-1 border-t border-white/15 pt-3 pl-3">
              <p className="min-w-0 flex-1 truncate text-sm text-rail-muted">{account.name || "Staff"}</p>
              {signOut}
            </div>
          </div>
        )}
      </aside>

      <div className="min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        {/* The names keep the bars in place, above a detail screen that moves in. */}
        <header style={{ viewTransitionName: "shell-top" }} className="sticky top-0 z-20 bg-rail pt-[env(safe-area-inset-top)] text-rail-foreground lg:hidden">
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 pr-2 pl-4">
            <Link href={home} className="shrink-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-white/40" aria-label="Cornerstock, stock view">
              <Logo onDark compact />
            </Link>
            {account && (
              <div className="ml-auto flex min-w-0 items-center gap-1">
                <LocationSelect locations={account.locations} selected={account.selected} className="max-w-52" />
                {signOut}
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-5 lg:mx-0 lg:max-w-none lg:px-8 lg:py-7">{children}</main>
        {account && <Nav owner={account.owner} variant="tabs" base={base} />}
      </div>
    </div>
  );
}
