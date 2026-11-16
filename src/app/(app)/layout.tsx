import { Suspense } from "react";
import { signOut } from "@/app/actions";
import { LiveRefresh } from "@/components/live-refresh";
import { Shell } from "@/components/shell";
import { StockListSkeleton } from "@/components/ui/skeleton";
import { getLocations, requireStaff } from "@/lib/auth";

async function SignedInShell({ children }: { children: React.ReactNode }) {
  const [profile, { locations, selected }] = await Promise.all([requireStaff(), getLocations()]);
  return (
    <Shell account={{ name: profile.full_name, owner: profile.role === "owner", locations, selected, signOut }}>
      <LiveRefresh />
      {children}
    </Shell>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <Shell>
          <div className="lg:max-w-2xl">
            <StockListSkeleton />
          </div>
        </Shell>
      }
    >
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}
