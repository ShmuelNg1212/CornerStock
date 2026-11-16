import { LogOut } from "lucide-react";
import Link from "next/link";
import { AccountProvider } from "@/components/account-context";
import { LocationSelect } from "@/components/location-select";
import { Logo } from "@/components/logo";
import { Nav } from "@/components/nav";
import { initials } from "@/lib/format";
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
 * Narrower: a small navy top bar and a floating tab bar at the bottom. The location is on the stock screen.
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
    <AccountProvider account={account}>
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

        <div className="min-w-0 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {/* The names keep the bars in place, above a detail screen that moves in. */}
          <header style={{ viewTransitionName: "shell-top" }} className="sticky top-0 z-30 bg-rail pt-[env(safe-area-inset-top)] text-rail-foreground lg:hidden">
            <div className="mx-auto flex h-12 max-w-3xl items-center gap-2 pr-3 pl-4">
              <Link href={home} className="shrink-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-white/40" aria-label="Cornerstock, stock view">
                <Logo onDark compact />
              </Link>
              {account && (
                <Link
                  href={`${base}/account`}
                  aria-label={`Account of ${account.name || "staff"}`}
                  className="font-heading ml-auto grid size-9 place-items-center rounded-full bg-white/12 text-sm font-bold text-white outline-none ring-1 ring-white/20 transition-colors duration-(--dur-fast) hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-white/50"
                >
                  {initials(account.name)}
                </Link>
              )}
            </div>
          </header>
          <main className="mx-auto max-w-3xl px-4 py-5 lg:mx-0 lg:max-w-none lg:px-8 lg:py-7">{children}</main>
          {account && <Nav owner={account.owner} variant="tabs" base={base} />}
        </div>
      </div>
    </AccountProvider>
  );
}
