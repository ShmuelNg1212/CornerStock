"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { useAccount } from "@/components/account-context";
import { LocationPicker } from "@/components/location-picker";
import { buttonClass, SectionTitle } from "@/components/ui/field";
import { initials } from "@/lib/format";

/** The signed-in person, the location, and sign-out. Staff see it at Account; the owner sees it at the top of Settings. */
export function AccountPanel() {
  const account = useAccount();
  if (!account) return null;
  return (
    <section aria-labelledby="account-heading" className="rounded-(--radius-card) bg-card p-4 shadow-(--shadow-card)">
      <div className="flex items-center gap-3.5">
        <span className="font-heading grid size-14 shrink-0 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground" aria-hidden="true">
          {initials(account.name)}
        </span>
        <div className="min-w-0">
          <h2 id="account-heading" className="text-lg leading-snug font-semibold break-words">
            {account.name || "Staff"}
          </h2>
          <p className="text-sm text-muted-foreground">{account.owner ? "Owner" : "Staff"}</p>
        </div>
      </div>
      {account.locations.length > 0 && (
        <div className="mt-5">
          <SectionTitle className="mb-2">Location</SectionTitle>
          <LocationPicker locations={account.locations} selected={account.selected} />
        </div>
      )}
      <Link href="/catalog" className={`${buttonClass.quiet} mt-5 w-full`}>Browse catalog</Link>
      <form action={account.signOut} data-leaves-scan className="mt-5">
        <button type="submit" className={`${buttonClass.quiet} w-full`}>
          <LogOut className="size-5" aria-hidden="true" />
          Sign out
        </button>
      </form>
    </section>
  );
}
