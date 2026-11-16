import type { Metadata } from "next";
import { LogoMark } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <LogoMark className="size-14" />
      <h1 className="mt-5 text-3xl font-bold tracking-tight">CORNERSTOCK</h1>
      <p className="mt-1 flex items-center gap-3 text-muted-foreground">
        <span className="h-px w-6 bg-gold" aria-hidden="true" />
        For Bowlers Corner
      </p>
      <LoginForm />
      <p className="mt-6 text-sm text-muted-foreground">No account? Ask the owner to make one for you.</p>
    </main>
  );
}
