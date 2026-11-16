import type { Metadata } from "next";
import { AccountPanel } from "@/components/account-panel";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-2xl lg:mx-0">
      <h1 className="mb-4 text-2xl font-bold">Account</h1>
      <AccountPanel />
    </div>
  );
}
