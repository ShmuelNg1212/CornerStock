"use client";

import { createContext, useContext } from "react";
import type { Location } from "@/lib/types";

export type Account = { name: string; owner: boolean; locations: Location[]; selected: string; signOut: () => Promise<void> };

const AccountContext = createContext<Account | null>(null);

/** Gives the signed-in account to the screens inside the shell. */
export function AccountProvider({ account, children }: { account?: Account; children: React.ReactNode }) {
  return <AccountContext.Provider value={account ?? null}>{children}</AccountContext.Provider>;
}

/** The signed-in account, or null while it loads. */
export const useAccount = () => useContext(AccountContext);
